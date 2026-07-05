# ☁️ IntelliQA — Host จากเครื่องนี้ ผ่าน Cloudflare Tunnel

**เอกสารนี้เจาะจงแค่ 1 เส้นทาง**: host แอปบน PC เครื่องนี้ + Cloudflare Tunnel → เปิดให้อินเทอร์เน็ตเข้าถึงได้อย่างปลอดภัย

**เวลาที่ใช้**: ~30 นาที · **ค่าใช้จ่าย**: ฟรี · **ต้องมี**: Windows 11 (เครื่องนี้) + email

---

## ทำไมใช้ Cloudflare Tunnel

- ✅ **ไม่ต้องแตะ router** — ไม่ต้อง port forward, ไม่ต้อง Public IP จริง
- ✅ **ทำงานทั้งบน CGNAT + ISP ที่ block port 80/443**
- ✅ **HTTPS อัตโนมัติ + real certificate** (Cloudflare ออกให้)
- ✅ **ซ่อน IP บ้าน/ออฟฟิศ** — คนใช้เห็นแต่ IP ของ Cloudflare
- ✅ **DDoS protection ฟรี**
- ✅ **Cloudflare Access** — จำกัดให้เฉพาะ email `@fabfood.co.th` เข้าได้

---

## ภาพรวม 4 ขั้นตอน

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Step 1      │────▶│  Step 2      │────▶│  Step 3      │────▶│  Step 4      │
│  Cloudflare  │     │  Install     │     │  Install     │     │  รันทั้งคู่ +  │
│  Signup +    │     │  Caddy       │     │  cloudflared │     │  set service │
│  Add domain  │     │  (web srv)   │     │  + tunnel    │     │  ให้ auto     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
    ~10 นาที             ~5 นาที             ~10 นาที             ~5 นาที
```

---

## Step 1 — Cloudflare Signup + Add Domain

### 1.1 สมัคร Cloudflare

1. เปิด <https://dash.cloudflare.com/sign-up>
2. Sign up ด้วย email (ใช้ email ที่จะเป็นเจ้าของระบบ เช่น `qa@fabfood.co.th`)
3. Verify email ที่ inbox

### 1.2 มี Domain มั้ย?

**ถ้ามี** เช่น `fabfood.co.th`:

1. Cloudflare Dashboard → **Add a Site**
2. กรอก `fabfood.co.th` → Continue
3. เลือก **Free plan** → Continue
4. Cloudflare แสดง **nameservers 2 ตัว** (เช่น `alice.ns.cloudflare.com` + `bob.ns.cloudflare.com`)
5. เข้า **DNS registrar เดิม** (ที่จด domain — เช่น GoDaddy, Namecheap, ThnicRegistrar) → **เปลี่ยน nameservers** ตามที่ Cloudflare ให้
6. รอ propagate ~1–24 ชั่วโมง — Cloudflare จะ email เมื่อ active

**ถ้าไม่มี domain** → ข้ามข้อนี้ก่อน จะใช้ **trycloudflare.com** ทดสอบ (URL ตัวอย่าง: `https://xxx-yyy.trycloudflare.com`) แล้วค่อยซื้อ domain ทีหลัง

---

## Step 2 — ติดตั้ง Caddy (Web Server)

**Caddy** = web server ตัวเดียวที่ทำ HTTPS + static file serving ในไม่กี่บรรทัด

### 2.1 ติดตั้ง

เปิด **PowerShell (Run as Administrator)**:

```powershell
winget install CaddyServer.Caddy
```

ถ้า winget ไม่รู้จัก → download manual: <https://caddyserver.com/download> → เลือก **Windows amd64** → extract แล้ววาง `caddy.exe` ที่ `C:\Program Files\Caddy\`

### 2.2 Verify

```powershell
caddy version
```

ควรได้ `v2.7.x` หรือใหม่กว่า

### 2.3 สร้าง Caddyfile

สร้างไฟล์ **`Caddyfile`** (ไม่มีนามสกุล) ใน folder ของ app:

Path: `C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app\Caddyfile`

Content:
```
:5173 {
    root * .
    file_server
    try_files {path} /index.html
    encode gzip

    # Cache JS/CSS 1 ชม.
    @assets path *.js *.css
    header @assets Cache-Control "public, max-age=3600"

    # Cache JSON 5 นาที (data ใหม่จะเห็นเร็ว)
    @data path *.json
    header @data Cache-Control "public, max-age=300"

    # Log
    log {
        output file access.log
        format json
    }
}
```

### 2.4 ทดสอบรัน

```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
caddy run
```

เปิดเบราว์เซอร์ → <http://localhost:5173> → **ควรเห็นแอป IntelliQA** ✅

กด `Ctrl+C` ปิด (เดี๋ยวเราตั้ง service ให้รันตลอด)

---

## Step 3 — ติดตั้ง cloudflared + สร้าง Tunnel

### 3.1 ติดตั้ง cloudflared

ใน PowerShell (Administrator):

```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -OutFile "$env:TEMP\cloudflared.msi"

# Install
Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\cloudflared.msi /qn"

# Verify (เปิด PowerShell ใหม่ก่อนถ้า command not found)
cloudflared --version
```

### 3.2 Login cloudflared

```powershell
cloudflared tunnel login
```

จะเปิดเบราว์เซอร์ → login Cloudflare → เลือก **domain** (จาก Step 1) → **Authorize**

จะได้ไฟล์ `C:\Users\pakarang_sa\.cloudflared\cert.pem`

### 3.3 สร้าง Tunnel

```powershell
cloudflared tunnel create intelliqa-tunnel
```

**Output**:
```
Tunnel credentials written to C:\Users\pakarang_sa\.cloudflared\<UUID>.json
Created tunnel intelliqa-tunnel with id abc123-def456-7890-...
```

**⚠️ Copy UUID เก็บไว้** (ตัวอย่าง: `abc123-def456-7890-1234-567890abcdef`) — เอาไปใส่ config ในข้อถัดไป

### 3.4 สร้าง config.yml

สร้างไฟล์ `C:\Users\pakarang_sa\.cloudflared\config.yml`:

```yaml
tunnel: abc123-def456-7890-1234-567890abcdef
credentials-file: C:\Users\pakarang_sa\.cloudflared\abc123-def456-7890-1234-567890abcdef.json

ingress:
  - hostname: intelliqa.fabfood.co.th
    service: http://localhost:5173
  - service: http_status:404
```

**แก้ 2 จุด**:
- `tunnel:` → UUID จากข้อ 3.3
- `credentials-file:` → path ไฟล์ .json (ชื่อไฟล์คือ UUID + `.json`)
- `hostname:` → subdomain ที่คุณอยากใช้ (เช่น `intelliqa.fabfood.co.th`)

### 3.5 Route DNS

```powershell
cloudflared tunnel route dns intelliqa-tunnel intelliqa.fabfood.co.th
```

Cloudflare จะสร้าง **CNAME record** ใน DNS อัตโนมัติ (ไปเช็คได้ที่ Cloudflare Dashboard → DNS → Records)

### 3.6 ทดสอบ Tunnel

**Terminal 1** — Caddy:
```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
caddy run
```

**Terminal 2** — Tunnel:
```powershell
cloudflared tunnel run intelliqa-tunnel
```

เปิดเบราว์เซอร์ → <https://intelliqa.fabfood.co.th> → **ควรเห็นแอปพร้อม HTTPS** ✅

ทดสอบจาก **มือถือปิด Wi-Fi ใช้ 4G** ก็ควรเข้าได้เหมือนกัน

---

## Step 4 — ตั้งให้รันอัตโนมัติ (Windows Service)

ทั้ง Caddy และ cloudflared ต้องรันตลอดเวลา ไม่งั้นเว็บล่ม ตั้งให้เป็น service:

### 4.1 cloudflared as Service

```powershell
cloudflared service install
```

Cloudflared จะ install ตัวเองเป็น Windows service, auto-start, auto-restart ถ้า crash

**Verify**:
```powershell
Get-Service cloudflared
```
→ Status ควรเป็น **Running**

### 4.2 Caddy as Service (ใช้ NSSM)

```powershell
# Install NSSM (Non-Sucking Service Manager)
winget install nssm

# Register Caddy
nssm install IntelliQACaddy "C:\Program Files\Caddy\caddy.exe" "run"
nssm set IntelliQACaddy AppDirectory "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
nssm set IntelliQACaddy Start SERVICE_AUTO_START
nssm set IntelliQACaddy AppStdout "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app\caddy.log"
nssm set IntelliQACaddy AppStderr "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app\caddy.log"

# Start
nssm start IntelliQACaddy

# Verify
Get-Service IntelliQACaddy
```
→ Status ควรเป็น **Running**

### 4.3 ปิด PC ไม่ให้ Sleep

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /hibernate off
```

### 4.4 Restart Test

Restart Windows → login กลับเข้ามา → เปิดเบราว์เซอร์ **โดยไม่ต้องรัน command อะไรเลย** → เข้า `https://intelliqa.fabfood.co.th` → ควรใช้งานได้ทันที ✅

---

## 🔒 (แนะนำเพิ่ม) จำกัดให้เฉพาะพนักงานเข้าใช้ได้

**Cloudflare Access** — ให้แค่คนที่ login ด้วย email `@fabfood.co.th` เท่านั้นถึงเห็นเว็บ (ก่อนถึง login modal ของ IntelliQA)

### 5.1 Enable Zero Trust

1. Cloudflare Dashboard → **Zero Trust** (menu ซ้าย)
2. First-time → เลือก **Free plan** (50 users)

### 5.2 สร้าง Application

1. Zero Trust → **Access → Applications → Add an application**
2. **Self-hosted**
3. Application name: `IntelliQA`
4. Session duration: `24 hours`
5. Application domain: `intelliqa.fabfood.co.th`
6. Next

### 5.3 สร้าง Policy

1. Policy name: `Allow Fab Food employees`
2. Action: **Allow**
3. Include → **Emails ending in** → `@fabfood.co.th`
4. Next → Add application

### 5.4 ผลลัพธ์

ตอนนี้เมื่อคนเข้า `https://intelliqa.fabfood.co.th`:
1. Cloudflare Access ถามให้ใส่ email
2. ถ้าไม่ใช่ `@fabfood.co.th` → **บล็อค**
3. ถ้าเป็น → Cloudflare ส่ง OTP ไป email → verify → เข้าเว็บได้

---

## 📋 Cheat Sheet — สั่ง 4 ชุดเสร็จ

**ก่อนเริ่ม**: สมัคร Cloudflare + add domain แล้ว (Step 1)

**Terminal 1 (PowerShell as Admin)**:
```powershell
# Install everything
winget install CaddyServer.Caddy
winget install nssm
Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -OutFile "$env:TEMP\cf.msi"
Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\cf.msi /qn"

# Reopen PowerShell so PATH updates
```

**Terminal 2 (PowerShell as Admin — reopened)**:
```powershell
# Cloudflare login + create tunnel
cloudflared tunnel login
cloudflared tunnel create intelliqa-tunnel
# ⚠️ Note UUID from output

# ⚠️ Edit these 2 files manually:
#   1. C:\Users\pakarang_sa\.cloudflared\config.yml   (ตาม Step 3.4)
#   2. Caddyfile in app folder                        (ตาม Step 2.3)

cloudflared tunnel route dns intelliqa-tunnel intelliqa.fabfood.co.th
cloudflared service install
```

**Terminal 3 (PowerShell as Admin)**:
```powershell
# Register Caddy as service
nssm install IntelliQACaddy "C:\Program Files\Caddy\caddy.exe" "run"
nssm set IntelliQACaddy AppDirectory "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
nssm set IntelliQACaddy Start SERVICE_AUTO_START
nssm start IntelliQACaddy

# ปิด sleep
powercfg /change standby-timeout-ac 0
powercfg /hibernate off
```

**Terminal 4 (Verify)**:
```powershell
Get-Service IntelliQACaddy, cloudflared
# ควรได้ทั้งคู่ Status: Running

Test-NetConnection -ComputerName localhost -Port 5173
# ควรได้ TcpTestSucceeded: True

# เปิดเบราว์เซอร์ → https://intelliqa.fabfood.co.th
```

---

## 🔧 Troubleshooting

### "This site can't be reached"

```powershell
Get-Service IntelliQACaddy, cloudflared     # ทั้งคู่ต้อง Running
cloudflared tunnel list                       # ต้องเห็น intelliqa-tunnel
Test-NetConnection localhost -Port 5173       # local reachable?
Resolve-DnsName intelliqa.fabfood.co.th       # DNS resolve ถูกมั้ย
```

### Restart tunnel/caddy หลังแก้ code

```powershell
Restart-Service IntelliQACaddy
Restart-Service cloudflared
```

ผู้ใช้ต้อง **Ctrl+Shift+R** hard reload เพื่อเห็นการเปลี่ยนแปลง (cache 1 ชม.)

### ดู log

- Caddy: `caddy.log` ใน app folder
- cloudflared: `Get-EventLog Application -Source cloudflared -Newest 20`
- Cloudflare Dashboard → Tunnel → **Metrics** → real-time request count

### Tunnel status = "not connected"

```powershell
cloudflared tunnel info intelliqa-tunnel
# แสดง connection status ของแต่ละ region
```

ถ้าดับหมด → restart service:
```powershell
Restart-Service cloudflared
```

---

## 📊 การ Update Code

หลังจากแก้ไข code ในโฟลเดอร์:

```powershell
# Restart Caddy (Cloudflare Tunnel ไม่ต้องแตะ)
Restart-Service IntelliQACaddy
```

ผู้ใช้ hard-refresh (`Ctrl+Shift+R`) ก็เห็นของใหม่ทันที

---

## 💰 ค่าใช้จ่าย

- **Cloudflare Free plan**: ฟรีถาวร — Tunnel unlimited, Access 50 users
- **Domain**: ~500 ฿/ปี (ถ้าซื้อใหม่)
- **ไฟฟ้า**: ~50–80 ฿/เดือน (PC เปิด 24/7)

**รวม**: ~40–100 ฿/เดือน

---

**© 2026 Fab Food Holding · IntelliQA Cloudflare Tunnel Setup v1.0**
