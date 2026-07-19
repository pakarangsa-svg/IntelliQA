// =================================================================
//  CloudSync — Firebase Auth + Firestore two-way sync for IntelliQA
//
//  Design: localStorage stays the synchronous source the app reads
//  from (zero changes to render/save code paths). This layer:
//    1. Intercepts localStorage writes on synced keys → pushes
//       changed/deleted records to Firestore (diff by content hash).
//    2. Subscribes (onSnapshot) per collection → writes remote data
//       back into localStorage and re-renders.
//    3. On first snapshot after login, MERGES local-only records up
//       to Firestore (= import ข้อมูลเดิมจากเครื่อง local อัตโนมัติ).
//
//  Firestore layout:
//    <collection>/<recordId>  = { u: updatedAt(ms), n: partCount, j: JSON }
//    parts/<col>::<id>::<i>   = { j: chunk }        (only when n > 1)
//    kv/<localStorageKey>     = { u, n, j }         (planner/contacts/settings)
//    users/<uid>              = { email, department, brand, updatedAt }
//
//  If firebase-config.js has no apiKey → LOCAL MODE: this file does
//  nothing and the app behaves exactly as before.
// =================================================================

(function() {
  const cfg = window.FIREBASE_CONFIG || {};
  const enabled = !!(cfg.apiKey && window.firebase);

  // Array stores: localStorage key → Firestore collection
  const ARRAY_STORES = {
    'qa-app::audits':            'audits',
    'qa-app::cleaning::records': 'cleaning',
    'qa-app::supplier::records': 'supplier',
    'qa-app::customer::records': 'customer'
  };
  // KV keys (exact or prefix) → stored in `kv` collection, doc id = key
  const KV_EXACT = ['qa-app::store-contacts', 'qa-app::email-recipients', 'qa-app::bzm-overrides'];
  const KV_PREFIX = ['qa-app::planner-type::', 'qa-app::planner-reason::', 'qa-app::planner::'];

  // Re-render pages that display each store
  const RENDER_PAGES = {
    audits:   ['home', 'history', 'dashboard', 'am-portal', 'report'],
    cleaning: ['cleaning'],
    supplier: ['supplier-complaint'],
    customer: ['customer-complaint'],
    kv:       ['home', 'about']
  };

  const CHUNK_CHARS = 200000; // ≤ ~600KB UTF-8 worst case, safely under 1MiB doc limit

  window.CloudSync = {
    enabled, user: null, status: enabled ? 'connecting' : 'local',
    login: null, signup: null, logout: null, saveProfile: null
  };
  if (!enabled) return;

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();
  try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) {}

  const nativeSet = localStorage.setItem.bind(localStorage);
  const nativeRemove = localStorage.removeItem.bind(localStorage);

  let applyingRemote = false;          // guard: snapshot-apply must not re-trigger push
  const ready = {};                    // collection → first snapshot processed
  const lastKnown = {};                // collection → { recId: { h, n } }
  const kvKnown = {};                  // lsKey → { h, n }
  let kvReady = false;
  const unsubs = [];

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }
  function chunk(json) {
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK_CHARS) parts.push(json.slice(i, i + CHUNK_CHARS));
    return parts.length ? parts : [''];
  }
  function safeRender(col) {
    if (typeof render !== 'function' || typeof state === 'undefined') return;
    const pages = RENDER_PAGES[col] || [];
    if (pages.includes(state.page)) { try { render(); } catch (e) {} }
  }
  function matchKvKey(key) {
    return KV_EXACT.includes(key) || KV_PREFIX.some(p => key.startsWith(p));
  }

  // ---------- PUSH: local → Firestore ----------
  async function writeDoc(col, docId, json, prevN) {
    const parts = chunk(json);
    const n = parts.length;
    const batch = db.batch();
    if (n === 1) {
      batch.set(db.collection(col).doc(docId), { u: Date.now(), n: 1, j: json });
    } else {
      parts.forEach((p, i) => batch.set(db.collection('parts').doc(`${col}::${docId}::${i}`), { j: p }));
      batch.set(db.collection(col).doc(docId), { u: Date.now(), n, j: '' });
    }
    // Remove leftover part docs when the record shrank.
    // Part docs only exist when a doc has n > 1.
    const hadParts = (prevN || 0) > 1 ? prevN : 0;
    const hasParts = n > 1 ? n : 0;
    for (let i = hasParts; i < hadParts; i++) {
      batch.delete(db.collection('parts').doc(`${col}::${docId}::${i}`));
    }
    await batch.commit();
    return n;
  }
  async function deleteDoc(col, docId, prevN) {
    const batch = db.batch();
    batch.delete(db.collection(col).doc(docId));
    const hadParts = (prevN || 0) > 1 ? prevN : 0;
    for (let i = 0; i < hadParts; i++) {
      batch.delete(db.collection('parts').doc(`${col}::${docId}::${i}`));
    }
    await batch.commit();
  }

  const pushTimers = {};
  function schedulePush(key) {
    clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(() => pushKey(key).catch(e => {
      console.warn('[CloudSync] push failed', key, e);
      const code = e && (e.code || e.name || '');
      // Doc-too-large / payload limits surface as invalid-argument or resource-exhausted
      if (/invalid-argument|resource-exhausted|out-of-range/i.test(String(code) + (e && e.message || ''))) {
        try { if (typeof window.toast === 'function')
          window.toast('ซิงก์ข้อมูลขึ้น cloud ไม่สำเร็จ — ข้อมูล/รูปมีขนาดใหญ่เกินไป กรุณาลดจำนวนรูป', 'error'); } catch(_) {}
      }
    }), 400);
  }

  async function pushKey(key) {
    if (!auth.currentUser) return;
    if (ARRAY_STORES[key]) {
      const col = ARRAY_STORES[key];
      if (!ready[col]) return; // wait for first snapshot; migration runs after
      let arr;
      try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return; }
      const known = lastKnown[col] = lastKnown[col] || {};
      const seen = new Set();
      for (const rec of arr) {
        if (!rec || !rec.id) continue;
        seen.add(rec.id);
        const json = JSON.stringify(rec);
        const h = hash(json);
        if (known[rec.id]?.h === h) continue;
        const n = await writeDoc(col, rec.id, json, known[rec.id]?.n);
        known[rec.id] = { h, n };
      }
      for (const id of Object.keys(known)) {
        if (seen.has(id)) continue;
        await deleteDoc(col, id, known[id].n);
        delete known[id];
      }
    } else if (matchKvKey(key)) {
      if (!kvReady) return;
      const val = localStorage.getItem(key);
      if (val === null) {
        if (kvKnown[key]) {
          await deleteDoc('kv', key, kvKnown[key].n);
          delete kvKnown[key];
        }
        return;
      }
      const h = hash(val);
      if (kvKnown[key]?.h === h) return;
      const n = await writeDoc('kv', key, val, kvKnown[key]?.n);
      kvKnown[key] = { h, n };
    }
  }

  // Intercept writes (removeItem matters for kv keys)
  localStorage.setItem = function(key, value) {
    nativeSet(key, value);
    if (!applyingRemote && (ARRAY_STORES[key] || matchKvKey(key))) schedulePush(key);
  };
  localStorage.removeItem = function(key) {
    nativeRemove(key);
    if (!applyingRemote && matchKvKey(key)) schedulePush(key);
  };

  // ---------- PULL: Firestore → local ----------
  async function docJson(col, docId, data) {
    if (!data) return null;
    if ((data.n || 1) <= 1) return data.j;
    const gets = [];
    for (let i = 0; i < data.n; i++) gets.push(db.collection('parts').doc(`${col}::${docId}::${i}`).get());
    const snaps = await Promise.all(gets);
    if (snaps.some(s => !s.exists)) return null; // parts still being written — next snapshot will retry
    return snaps.map(s => s.data().j).join('');
  }

  function sortForStore(col, arr) {
    try {
      if (col === 'audits') arr.sort((a, b) => new Date(b.header?.date || 0) - new Date(a.header?.date || 0));
      else if (col === 'cleaning') arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      else arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch (e) {}
    return arr;
  }

  function listenArrayStore(lsKey, col) {
    const unsub = db.collection(col).onSnapshot(async snap => {
      try {
        const known = {};
        const recs = [];
        for (const doc of snap.docs) {
          const data = doc.data();
          const json = await docJson(col, doc.id, data);
          if (json === null || json === undefined) continue;
          try {
            const rec = JSON.parse(json);
            recs.push(rec);
            known[doc.id] = { h: hash(json), n: data.n || 1 };
          } catch (e) {}
        }
        const firstTime = !ready[col];
        lastKnown[col] = known;

        if (firstTime) {
          // MERGE: keep local-only records (they get pushed right after) —
          // this is the automatic "import ข้อมูลจาก local" on first login.
          let local = [];
          try { local = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch (e) {}
          const remoteIds = new Set(recs.map(r => r.id));
          const localOnly = local.filter(r => r && r.id && !remoteIds.has(r.id));
          const merged = sortForStore(col, [...recs, ...localOnly]);
          applyingRemote = true;
          nativeSet(lsKey, JSON.stringify(merged));
          applyingRemote = false;
          ready[col] = true;
          if (localOnly.length) {
            console.log(`[CloudSync] importing ${localOnly.length} local record(s) → ${col}`);
            schedulePush(lsKey);
          }
        } else {
          applyingRemote = true;
          nativeSet(lsKey, JSON.stringify(sortForStore(col, recs)));
          applyingRemote = false;
        }
        safeRender(col);
      } catch (e) {
        console.warn('[CloudSync] snapshot apply failed', col, e);
      }
    }, err => console.warn('[CloudSync] listener error', col, err));
    unsubs.push(unsub);
  }

  function listenKv() {
    const unsub = db.collection('kv').onSnapshot(async snap => {
      try {
        const remoteKeys = new Set();
        for (const doc of snap.docs) {
          const key = doc.id;
          if (!matchKvKey(key)) continue;
          remoteKeys.add(key);
          const json = await docJson('kv', key, doc.data());
          if (json === null || json === undefined) continue;
          kvKnown[key] = { h: hash(json), n: doc.data().n || 1 };
          applyingRemote = true;
          nativeSet(key, json);
          applyingRemote = false;
        }
        const firstTime = !kvReady;
        kvReady = true;
        if (firstTime) {
          // Push local-only kv keys (planner data, contact edits, settings)
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && matchKvKey(key) && !remoteKeys.has(key)) schedulePush(key);
          }
        }
        safeRender('kv');
      } catch (e) {
        console.warn('[CloudSync] kv snapshot failed', e);
      }
    }, err => console.warn('[CloudSync] kv listener error', err));
    unsubs.push(unsub);
  }

  function startSync() {
    if (unsubs.length) return;
    Object.entries(ARRAY_STORES).forEach(([lsKey, col]) => listenArrayStore(lsKey, col));
    listenKv();
  }
  function stopSync() {
    unsubs.forEach(u => { try { u(); } catch (e) {} });
    unsubs.length = 0;
    Object.keys(ready).forEach(k => delete ready[k]);
    kvReady = false;
  }

  // ---------- AUTH + APPROVAL WORKFLOW ----------
  const domain = (window.FIREBASE_ALLOWED_DOMAIN || '').toLowerCase();
  const adminEmails = (window.FIREBASE_ADMIN_EMAILS || []).map(e => e.toLowerCase());
  function domainOk(email) {
    return !domain || String(email).toLowerCase().endsWith('@' + domain);
  }
  function isAdminEmail(email) {
    return adminEmails.includes(String(email || '').toLowerCase());
  }
  window.CloudSync.isAdminEmail = isAdminEmail;
  window.CloudSync.pendingInfo = null; // { email, status: 'pending'|'rejected' } — gates the app UI

  window.CloudSync.login = async function(email, password) {
    if (!domainOk(email)) throw new Error(`อนุญาตเฉพาะ email @${domain} เท่านั้น`);
    return auth.signInWithEmailAndPassword(email, password);
  };
  window.CloudSync.signup = async function(email, password, profile) {
    if (!domainOk(email)) throw new Error(`อนุญาตเฉพาะ email @${domain} เท่านั้น`);
    await auth.createUserWithEmailAndPassword(email, password);
    // Register with requested role — pending until admin approves
    const u = auth.currentUser;
    await db.collection('users').doc(u.uid).set({
      email: u.email,
      department: profile.department,
      brand: profile.brand || 'back-office',
      status: isAdminEmail(u.email) ? 'approved' : 'pending',
      requestedAt: Date.now(),
      updatedAt: Date.now()
    });
    await applyAuthState(u);
  };
  window.CloudSync.logout = function() { return auth.signOut(); };
  window.CloudSync.loadProfile = async function() {
    const u = auth.currentUser;
    if (!u) return null;
    const snap = await db.collection('users').doc(u.uid).get();
    return snap.exists ? snap.data() : null;
  };
  // Re-check approval status from the pending screen
  window.CloudSync.refreshStatus = async function() {
    if (auth.currentUser) await applyAuthState(auth.currentUser);
    return window.CloudSync.pendingInfo;
  };

  // ----- Admin API (server-enforced via firestore.rules: admin email only) -----
  window.CloudSync.adminListUsers = async function() {
    const snap = await db.collection('users').get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  };
  window.CloudSync.adminSetStatus = async function(uid, status) {
    await db.collection('users').doc(uid).set({
      status,
      approvedBy: auth.currentUser?.email || '',
      approvedAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });
  };
  window.CloudSync.adminUpdateUser = async function(uid, data) {
    await db.collection('users').doc(uid).set({ ...data, updatedAt: Date.now() }, { merge: true });
  };

  function setSession(email, prof) {
    const s = {
      email,
      department: prof?.department || 'QA/RD',
      brand: prof?.brand || 'back-office',
      signedAt: Date.now()
    };
    nativeSet('qa-app::session', JSON.stringify(s));
    if (typeof state !== 'undefined') state.session = s;
  }
  function clearLocalSession() {
    nativeRemove('qa-app::session');
    if (typeof state !== 'undefined') state.session = null;
  }

  async function applyAuthState(user) {
    window.CloudSync.user = user;
    if (!user) {
      window.CloudSync.status = 'signed-out';
      window.CloudSync.pendingInfo = null;
      stopSync();
      clearLocalSession();
      return;
    }
    let prof = null;
    let profErr = false;
    try { prof = await window.CloudSync.loadProfile(); }
    catch (e) { profErr = true; console.warn('[CloudSync] profile load failed', e); }

    if (isAdminEmail(user.email)) {
      // Admin: always approved; self-heal profile so it shows in the dashboard
      if (!profErr && (!prof || prof.status !== 'approved')) {
        try {
          await db.collection('users').doc(user.uid).set({
            email: user.email,
            department: prof?.department || 'QA/RD',
            brand: prof?.brand || 'back-office',
            status: 'approved',
            updatedAt: Date.now()
          }, { merge: true });
        } catch (e) {}
      }
      window.CloudSync.status = 'online';
      window.CloudSync.pendingInfo = null;
      setSession(user.email, prof);
      startSync();
      return;
    }

    if (profErr) {
      // Offline / transient error: fall back to previously-approved local session
      const localSession = (() => { try { return JSON.parse(localStorage.getItem('qa-app::session') || 'null'); } catch (e) { return null; } })();
      if (localSession && localSession.email === user.email) {
        window.CloudSync.status = 'online';
        window.CloudSync.pendingInfo = null;
        startSync();
      }
      return;
    }

    if (prof && prof.status === 'approved') {
      window.CloudSync.status = 'online';
      window.CloudSync.pendingInfo = null;
      // Role always comes from the cloud profile — not the login form
      setSession(user.email, prof);
      startSync();
    } else {
      // pending / rejected / no profile → block the app
      window.CloudSync.status = 'pending';
      window.CloudSync.pendingInfo = { email: user.email, status: prof ? (prof.status || 'pending') : 'pending' };
      stopSync();
      clearLocalSession();
    }
  }

  auth.onAuthStateChanged(async user => {
    try { await applyAuthState(user); } catch (e) { console.warn('[CloudSync] auth state failed', e); }
    if (typeof render === 'function') { try { render(); } catch (e) {} }
  });
})();
