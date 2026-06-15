# Deploy to GitHub Pages

This is a static client-side app (no build step). GitHub Pages serves it directly.

## ⚠️ Before you push

The `imported_audits_*.json`, `imported_cleaning_*.json`, and `imported_supplier_*.json` files in this folder contain **real branch names, BZM names, and audit findings**. Pushing them to a public repo makes that data publicly indexable.

**Choose your path:**

- **Public repo + real data** → fine for demo / prototype, NOT for production internal data.
- **Public repo + demo data only** → edit `.gitignore` and uncomment the last 3 lines to exclude `imported_*.json`. The app will load with empty audit history; you can re-add data via the UI.
- **Private repo + Pages** → requires GitHub Pro/Team (~$4/mo). All data stays private.

## 1. Create the GitHub repo

```bash
# In your browser, go to https://github.com/new
# Repo name: intelliqa (or whatever you like)
# Visibility: Public (or Private if you have Pro)
# Don't initialize with README — we already have one
```

## 2. Initialize git + push

From `C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app` in PowerShell:

```powershell
git init
git add .
git status                                       # review what's about to be committed
git commit -m "Initial commit: IntelliQA prototype"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO>.git
git push -u origin main
```

Replace `<YOUR_USERNAME>` and `<REPO>` with your actual values.

## 3. Enable GitHub Pages

1. On the GitHub repo page → **Settings** → **Pages** (left sidebar).
2. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` · **Folder**: `/ (root)`
3. Click **Save**.
4. Wait ~1–2 minutes. GitHub will show the live URL at the top:
   `https://<YOUR_USERNAME>.github.io/<REPO>/`

## 4. Visit the live app

Open the URL in any browser. The login modal appears, you sign in, and all features work — **except**:

- **localStorage is per-browser** — data won't sync across users/devices. (This is a static-site limitation.)
- The 3 auto-loaded JSON files (`imported_*.json`) seed every new browser's localStorage with the same baseline data.

## 5. Updating the live app

After making changes locally:

```powershell
git add .
git commit -m "Describe what changed"
git push
```

GitHub Pages rebuilds within ~1 minute.

## 6. Custom domain (optional)

If you own a domain:

1. **Settings → Pages → Custom domain** → enter `intelliqa.fabfood.co.th` (or yours).
2. On your DNS provider, add a CNAME record pointing to `<YOUR_USERNAME>.github.io`.
3. Wait for DNS to propagate, then enable **Enforce HTTPS** in the same Pages settings.

---

## 🔒 If you need a true multi-user app (sync across browsers)

GitHub Pages is static-only — every browser has its own localStorage. For real multi-user data:

- **Cheap path**: add Supabase or Firebase (~free tier) as the data store, replace `Storage.loadAudits/saveAudits` with REST calls. ~1 day of work.
- **Internal path**: host on a small server (Vercel/Netlify/your own) with a real database.
- **Sharepoint/Teams path**: if you're on Microsoft 365, embed the static site in a Teams tab and use SharePoint Lists as the backend.

Happy to write any of those if it becomes needed.
