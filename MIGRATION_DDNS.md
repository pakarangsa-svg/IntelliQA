# 🌐 IntelliQA — คู่มือ Host บนเครื่องนี้ + เข้าถึงจากอินเทอร์เน็ต (DDNS)

เอกสารนี้อธิบายวิธี host IntelliQA บนเครื่อง PC เครื่องนี้ (Windows 11) แล้วให้ผู้ใช้จาก **อินเทอร์เน็ต** เข้ามาใช้งานผ่าน hostname เช่น `intelliqa.duckdns.org` หรือ `intelliqa.fabfood.co.th`

---

## 📑 สารบัญ

1. [ก่อนเริ่ม: 3 ข้อควรรู้](#1-ก่อนเริ่ม-3-ข้อควรรู้)
2. [เลือกเส้นทาง: DDNS vs Cloudflare Tunnel](#2-เลือกเส้นทาง-ddns-vs-cloudflare-tunnel)
3. [ตรวจสอบว่าใช้ได้ก่อน (5 นาที)](#3-ตรวจสอบว่าใช้ได้ก่อน-5-นาที)
4. [Path A — Cloudflare Tunnel (แนะนำ)](#4-path-a--cloudflare-tunnel-แนะนำ)
5. [Path B — DDNS + Port Forward](#5-path-b--ddns--port-forward)
6. [Web Server: Caddy (แนะนำ)](#6-web-server-caddy-แนะนำ)
7. [เปิด IntelliQA ให้รันตลอดเวลา](#7-เปิด-intelliqa-ให้รันตลอดเวลา)
8. [Auto-start เมื่อ Boot Windows](#8-auto-start-เมื่อ-boot-windows)
9. [Backup ข้อมูล](#9-backup-ข้อมูล)
10. [Security Hardening](#10-security-hardening)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. ก่อนเริ่ม: 3 ข้อควรรู้

### ⚠️ Data Model ไม่เปลี่ยน
IntelliQA เก็บข้อมูลใน **localStorage ของเบราว์เซอร์แต่ละคน** — เปลี่ยนที่ host แค่ให้คนอื่นเข้าถึงเว็บได้ แต่ **แต่ละคนยังมี localStorage ของตัวเอง** ข้อมูลไม่ sync ระหว่างกัน  
ถ้าต้องการ multi-user database จริงต้องเพิ่ม backend (Firestore/PostgreSQL/etc.) — อยู่นอกขอบเขตเอกสารนี้

### ⚠️ PC ต้องเปิดตลอด
- ตั้ง **Power settings → Sleep = Never**
- ถ้าดับไฟ / PC hang → เว็บล่มจนกว่าจะเปิดใหม่
- ค่าไฟเพิ่ม ~40–80 บาท/เดือน (คอมทั่วไปกินไฟ 50–100W × 24h × 30d × 4.5฿/kWh)

### ⚠️ Security คือเรื่องใหญ่
เปิด PC บ้านให้อินเทอร์เน็ตยิงตรงๆ = โจรทั่วโลกจะ scan เจอภายใน **ไม่กี่นาที** ถ้ามี bug ใน Windows/web server ที่ยังไม่ patch → **โดนแฮคได้ทันที**

**Path A (Cloudflare Tunnel) ปลอดภัยกว่ามาก** เพราะ:
- ซ่อน IP จริงของคุณ
- Cloudflare กัน DDoS + brute force ให้
- ไม่ต้องเปิด port ที่ router เลย

**ถ้าใช้ Path B** ต้อง harden Windows Firewall + ปิด SMB/RDP + patch ทุกเดือน

---

## 2. เลือกเส้นทาง: DDNS vs Cloudflare Tunnel

| ประเด็น | Path A: Cloudflare Tunnel | Path B: DDNS + Port Forward |
|---|---|---|
| Router config | **ไม่ต้อง** | ต้องเข้า router ตั้ง port-forward |
| HTTPS | **ฟรี + auto** | ต้องตั้ง Let's Encrypt เอง |
| CGNAT (ISP บาง ISP ใช้) | **ทำงาน** | **ทำงานไม่ได้เลย** |
| ISP block port 80/443 | **ไม่กระทบ** | **ไม่ทำงาน** |
| Domain name | ใช้ subdomain ของ Cloudflare หรือ own domain | ใช้ DDNS provider (duckdns.org) หรือ own domain |
| ซ่อน IP จริง | **ใช่** | ไม่ (IP บ้านโชว์) |
| DDoS protection | **ใช่** | ไม่ |
| ค่าใช้จ่าย | **ฟรี** (free tier กว้างมาก) | ฟรี (DuckDNS) |
| Setup time | ~20 นาที | ~45–60 นาที |
| Security risk | ต่ำ | สูง (ถ้าไม่ harden) |

**คำแนะนำ**: ใช้ **Path A (Cloudflare Tunnel)** ถ้าไม่มีเหตุผลเฉพาะที่ต้อง Path B

---

## 3. ตรวจสอบว่าใช้ได้ก่อน (5 นาที)

รันคำสั่งนี้ใน **PowerShell (Run as Administrator)** เพื่อเช็คว่าเครื่อง + network พร้อม:

```powershell
# 1. Public IP ของคุณ
$ip = (Invoke-RestMethod "https://api.ipify.org")
Write-Host "Public IP: $ip"

# 2. Local IP
Write-Host "Local IPs:"
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }).IPAddress

# 3. เช็คว่า port 80/443 ถูก block ที่ ISP หรือเปล่า
Write-Host "`nTesting outbound HTTP..."
Test-NetConnection -ComputerName google.com -Port 80

# 4. ISP info (บอกได้ว่าเป็น CGNAT หรือเปล่า)
Write-Host "`nISP info:"
Invoke-RestMethod "https://ipinfo.io/json" | Select-Object ip, city, region, country, org
```

**อ่านผลลัพธ์**:

- ถ้า **Public IP ≠ WAN IP บน router** → คุณอยู่ใน **CGNAT** → ต้องใช้ Path A เท่านั้น
- ถ้า `org` มีคำว่า "Mobile" หรือ "Cellular" → มือถือ/4G → CGNAT แน่นอน → Path A เท่านั้น
- ถ้าเป็น home fiber (AIS/True/3BB) → มักจะได้ Public IP จริง → **Path B ใช้ได้ ถ้า ISP ไม่ block port**

---

## 4. Path A — Cloudflare Tunnel (แนะนำ)

### 4.1 สมัคร Cloudflare (ฟรี)

1. เข้า <https://dash.cloudflare.com/sign-up>
2. สมัครด้วย email
3. Verify email

### 4.2 (Optional) Add Your Domain

**ถ้ามี domain เอง** เช่น `fabfood.co.th`:

1. Cloudflare Dashboard → **Add a Site**
2. กรอก `fabfood.co.th` → Continue
3. เลือก **Free plan**
4. Cloudflare จะให้ **nameservers** 2 ตัว (เช่น `alice.ns.cloudflare.com`)
5. เข้า DNS registrar ปัจจุบัน → เปลี่ยน nameservers ตามที่ Cloudflare ให้
6. รอ propagate ~1–24 ชม.

**ถ้าไม่มี domain** → ข้ามข้อ 4.2 นี้ Cloudflare Tunnel มี trial domain ให้ทดสอบ (แต่ URL จะไม่สวย เช่น `intelliqa.trycloudflare.com`)

### 4.3 ติดตั้ง cloudflared

เปิด **PowerShell (Administrator)**:

```powershell
# Download installer
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -OutFile "$env:TEMP\cloudflared.msi"

# Install
Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\cloudflared.msi /qn"

# Verify
cloudflared --version
```

### 4.4 Login cloudflared

```powershell
cloudflared tunnel login
```

จะเปิดเบราว์เซอร์ให้ authorize → เลือก domain ที่ add ในข้อ 4.2 (ถ้ามี) → **Authorize**

### 4.5 สร้าง Tunnel

```powershell
cloudflared tunnel create intelliqa-tunnel
```

Output:
```
Created tunnel intelliqa-tunnel with id abc123-def456-...
Wrote tunnel credentials to C:\Users\<you>\.cloudflared\abc123-....json
```

**จำ UUID** เอาไปใช้ใน config

### 4.6 สร้าง Config File

สร้างไฟล์ `C:\Users\<you>\.cloudflared\config.yml`:

```yaml
tunnel: abc123-def456-...       # ← UUID จากข้อ 4.5
credentials-file: C:\Users\<you>\.cloudflared\abc123-....json

ingress:
  # Route: intelliqa.fabfood.co.th → local port 5173
  - hostname: intelliqa.fabfood.co.th
    service: http://localhost:5173

  # Catch-all (required)
  - service: http_status:404
```

**ถ้าไม่มี domain เอง** → แก้ hostname เป็น `intelliqa.<your-cloudflare-account>.workers.dev` (Cloudflare จะให้)

### 4.7 Route DNS

```powershell
cloudflared tunnel route dns intelliqa-tunnel intelliqa.fabfood.co.th
```

Cloudflare จะสร้าง CNAME record ให้อัตโนมัติ

### 4.8 ทดสอบ Run Tunnel

**Terminal 1 — start web server** (ดู Section 6 ก่อน):
```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
caddy file-server --listen :5173
```

**Terminal 2 — start tunnel**:
```powershell
cloudflared tunnel run intelliqa-tunnel
```

เปิดเบราว์เซอร์ → `https://intelliqa.fabfood.co.th` → ควรเห็นแอป ✅

### 4.9 Install as Windows Service (ให้รันอัตโนมัติ)

```powershell
cloudflared service install
```

Now:
- Tunnel auto-start ทุกครั้งที่ boot Windows
- Restart อัตโนมัติถ้า crash
- ทำงาน background ไม่ต้องเปิด PowerShell ค้างไว้

Verify:
```powershell
Get-Service cloudflared
# ควรได้ Status: Running
```

---

## 5. Path B — DDNS + Port Forward

**ใช้เฉพาะกรณี**:
- มี Public IP จริง (ไม่อยู่ใน CGNAT — เช็คจาก Section 3)
- ISP ไม่ block port 80/443 inbound
- เข้าถึง router ได้ (admin password)
- ยอมรับความเสี่ยง security ที่สูงกว่า

### 5.1 สมัคร DDNS (DuckDNS ฟรี)

1. เข้า <https://www.duckdns.org/>
2. Sign in ด้วย Google/GitHub
3. หลัง login → กรอก subdomain: **`intelliqa-fabfood`** → **add domain**
4. คุณจะได้:
   - Hostname: `intelliqa-fabfood.duckdns.org`
   - Token: `abcd-1234-...` (จำไว้)

### 5.2 ติดตั้ง DDNS Updater (Windows)

Download **DDNS Updater**: <https://github.com/qdm12/ddns-updater/releases>

หรือใช้ script PowerShell แบบง่ายๆ:

```powershell
# Create C:\Scripts\ddns-update.ps1
$token = "YOUR_DUCKDNS_TOKEN"
$domain = "intelliqa-fabfood"
$url = "https://www.duckdns.org/update?domains=$domain&token=$token&ip="
Invoke-RestMethod $url
```

ตั้ง Task Scheduler ให้รันทุก 15 นาที (ดู Section 8 pattern เดียวกัน)

### 5.3 ตั้ง Port Forward ที่ Router

**ทุก router ตั้งไม่เหมือนกัน** — ตัวอย่างสำหรับ router ทั่วไป (TP-Link/Huawei/AIS):

1. เปิดเบราว์เซอร์ → ไปที่ router admin panel (มักเป็น `http://192.168.1.1` หรือ `http://192.168.100.1`)
2. Login ด้วย admin password
3. หา menu: **NAT / Forwarding / Virtual Server / Port Forwarding**
4. Add rule:
   - **Name**: `IntelliQA-HTTPS`
   - **External port**: `443`
   - **Internal IP**: Local IP ของ PC เครื่องนี้ (จาก Section 3 — เช่น `192.168.1.100`)
   - **Internal port**: `443`
   - **Protocol**: TCP
5. Save
6. ทำอีก rule สำหรับ port `80` (สำหรับ Let's Encrypt challenge)

### 5.4 ตั้ง Static Local IP

ถ้า PC ได้ IP จาก DHCP → IP อาจเปลี่ยนได้ ทำ port-forward เจ๊ง

**แก้**: เข้า router → LAN → DHCP → **Address Reservation** → เพิ่ม PC's MAC address → assign IP ตายตัวเช่น `192.168.1.100`

หรือตั้ง static IP บน Windows:
1. Settings → Network → Ethernet → Edit IP settings
2. Manual → เลือก IPv4 → กรอก IP/Subnet/Gateway/DNS
3. Save

### 5.5 เปิด Windows Firewall

```powershell
# เปิด port 80 + 443 inbound
New-NetFirewallRule -DisplayName "IntelliQA HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "IntelliQA HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

### 5.6 Verify Port Reachable

หลังตั้งเสร็จ → ทดสอบจากมือถือ (ปิด Wi-Fi ใช้ 4G) หรือ:

```powershell
# ใช้บริการ external check
Invoke-RestMethod "https://api.portcheck.io/check?port=443&host=intelliqa-fabfood.duckdns.org"
```

ถ้า `open: true` → เปิด port สำเร็จ  
ถ้า `false` → ISP block หรือ firewall ไม่ pass — กลับไป Path A

---

## 6. Web Server: Caddy (แนะนำ)

**Caddy** เป็น web server ตัวเดียวที่ทำ HTTPS อัตโนมัติ (Let's Encrypt) ไม่ต้อง config อะไร

### 6.1 ติดตั้ง Caddy

```powershell
# ใช้ winget
winget install CaddyServer.Caddy

# หรือ download แบบ manual: https://caddyserver.com/download
```

Verify:
```powershell
caddy version
```

### 6.2 สร้าง Caddyfile

สร้างไฟล์ `Caddyfile` ใน folder ของ app:

```
# C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app\Caddyfile

# Path A (Cloudflare Tunnel) — ไม่ต้องมี TLS เพราะ CF จัดการให้แล้ว
:5173 {
    root * .
    file_server
    try_files {path} /index.html
    encode gzip
    header Cache-Control "public, max-age=3600"
}

# Path B (Direct exposure) — ใช้ block นี้แทน :5173
# intelliqa-fabfood.duckdns.org {
#     root * .
#     file_server
#     try_files {path} /index.html
#     encode gzip
#     tls your-email@example.com   # Let's Encrypt auto
# }
```

### 6.3 รัน

**Test run** (foreground):
```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
caddy run
```

เปิด <http://localhost:5173> → ควรเห็นแอป

**Production run** (Windows Service — ดู Section 8)

---

## 7. เปิด IntelliQA ให้รันตลอดเวลา

**Web server ที่แนะนำ (ตามลำดับ)**:

| Server | ข้อดี | เมื่อไหร่ควรใช้ |
|---|---|---|
| **Caddy** | HTTPS auto, config ง่าย | **แนะนำ** — ครอบคลุมทุก use case |
| Nginx | Battle-tested, ตั้ง cache ละเอียด | ถ้ามีคนดูแลอยู่แล้ว |
| Python http.server | Setup ใน 5 วิ | **เฉพาะทดสอบ** — ไม่ควร production |
| IIS | มากับ Windows | ตั้งค่ายาก, ไม่แนะนำ |

**Python fallback** (สำหรับทดสอบก่อนติดตั้ง Caddy):
```powershell
cd "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
python -m http.server 5173
```

---

## 8. Auto-start เมื่อ Boot Windows

### 8.1 Caddy as Windows Service

Method 1 — **NSSM** (Non-Sucking Service Manager):

```powershell
# Install NSSM
winget install nssm

# Register Caddy as service
nssm install IntelliQACaddy "C:\Program Files\Caddy\caddy.exe" "run --config Caddyfile"
nssm set IntelliQACaddy AppDirectory "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
nssm set IntelliQACaddy Start SERVICE_AUTO_START
nssm start IntelliQACaddy

# Verify
Get-Service IntelliQACaddy
```

Method 2 — **Task Scheduler**:

```powershell
$action = New-ScheduledTaskAction -Execute "C:\Program Files\Caddy\caddy.exe" -Argument "run --config Caddyfile" -WorkingDirectory "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartOnIdle:$false -DontStopOnIdleEnd -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "IntelliQACaddy" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
```

### 8.2 ปิด Sleep + Hibernate

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /hibernate off
```

### 8.3 ตรวจสอบว่ารันจริง

หลัง reboot Windows แล้ว → open browser → ควรเห็นแอปโดยไม่ต้อง manual start

```powershell
# Check services
Get-Service IntelliQACaddy, cloudflared

# ควรได้ทั้งคู่ Status: Running
```

---

## 9. Backup ข้อมูล

**สำคัญ**: ข้อมูลที่ผู้ใช้กรอก อยู่ใน localStorage ของเบราว์เซอร์แต่ละคน — **backup ไม่ได้จาก server**

แนวทาง backup ที่ทำได้:

### 9.1 Backup Static Files (โค้ด + seed JSON)

```powershell
# Weekly backup ผ่าน Task Scheduler
$src = "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
$dst = "D:\Backups\IntelliQA-$(Get-Date -Format 'yyyy-MM-dd')"
Copy-Item -Path $src -Destination $dst -Recurse -Exclude "node_modules","*.py","Brand Standard AI Agent"
```

### 9.2 Backup ข้อมูลจริงของผู้ใช้

ให้ผู้ใช้แต่ละคนรัน DevTools script (จาก MIGRATION_GCP.md Section 4.1) แล้วส่งไฟล์ backup มาเก็บที่ shared folder เดือนละครั้ง

### 9.3 Long-term Solution — เพิ่ม Backend

ถ้าอยากมี backup รวมของทุกคนอัตโนมัติ → ต้องเพิ่ม backend (Node.js + SQLite/PostgreSQL) — อยู่นอกขอบเขตเอกสารนี้

---

## 10. Security Hardening

**ถ้าใช้ Path A (Cloudflare Tunnel)** — ปลอดภัยระดับหนึ่งอยู่แล้ว แต่ควรทำเพิ่ม:

- [ ] Enable **Cloudflare Access** (Zero Trust) — ให้เฉพาะคนที่ login ด้วย email `@fabfood.co.th` เห็นเว็บ
- [ ] เปิด **Web Application Firewall** ใน Cloudflare
- [ ] Rate limiting (ป้องกัน spam login)

**ถ้าใช้ Path B (DDNS)** — ต้องทำหลายอย่าง:

- [ ] **Windows Update** — ตั้ง auto-install monthly patches
- [ ] **Windows Defender** — เปิด real-time protection
- [ ] **ปิด SMB** (port 445) inbound ใน firewall
- [ ] **ปิด RDP** (port 3389) inbound ใน firewall — ถ้าจำเป็นต้องใช้ → บังคับ VPN
- [ ] **แก้ password Administrator** ให้ complex (≥16 ตัว, มีสัญลักษณ์)
- [ ] **ปิด Guest account**
- [ ] **Fail2ban equivalent** — ใช้ Caddy plugin `caddy-security` block IP ที่ถูกโจมตี
- [ ] **Log monitoring** — เช็ค Event Viewer อาทิตย์ละครั้งหา suspicious login

---

## 11. Troubleshooting

### 11.1 "This site can't be reached" จากภายนอก

**Diagnose**:
```powershell
# 1. Web server รันมั้ย
Get-Service IntelliQACaddy
Test-NetConnection -ComputerName localhost -Port 5173

# 2. Local network ok มั้ย
Test-NetConnection -ComputerName 192.168.1.100 -Port 443    # จาก PC เครื่องอื่นใน LAN

# 3. Tunnel ok มั้ย (Path A)
Get-Service cloudflared
cloudflared tunnel list

# 4. DNS resolve ถูกมั้ย
Resolve-DnsName intelliqa.fabfood.co.th
```

### 11.2 HTTPS Warning "Not Secure"

- Path A: Cloudflare cert ควรทำงานอัตโนมัติ — เช็ค SSL/TLS setting = **Full** ใน Cloudflare dashboard
- Path B: Caddy Let's Encrypt ล้ม — เช็คว่า port 80 เปิดจริง (Let's Encrypt ต้อง challenge ผ่าน HTTP)

### 11.3 Cache ไม่ update หลัง deploy code ใหม่

Caddy cache 1 ชม. → force refresh:
```powershell
# Restart service
Restart-Service IntelliQACaddy
```

ผู้ใช้ต้อง **Ctrl+Shift+R** (hard reload) หรือรอ 1 ชม.

### 11.4 PC ช้า / RAM หมด

Caddy กิน RAM น้อยมาก (~50 MB) — ถ้าช้าเพราะสาเหตุอื่น (Chrome, other apps) ตรวจ Task Manager

### 11.5 ISP บล็อค (Path B)

**สังเกต**: `Test-NetConnection` จาก external network fail แต่ local ok

**แก้**:
- เปลี่ยน port จาก 443 → 8443 (ISP บางรายไม่ block port แปลก)
- หรือ **switch to Path A (Cloudflare Tunnel)** — bypass port block ทั้งหมด

---

## 📞 Cheat Sheet — สั่ง 3 คำสั่ง (Path A)

```powershell
# 1. Install
winget install CaddyServer.Caddy
Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -OutFile "$env:TEMP\cf.msi"
Start-Process msiexec.exe -Wait -ArgumentList "/i $env:TEMP\cf.msi /qn"

# 2. Login + Setup (interactive)
cloudflared tunnel login
cloudflared tunnel create intelliqa-tunnel
# (แก้ config.yml + Caddyfile ตามด้านบน)
cloudflared tunnel route dns intelliqa-tunnel intelliqa.fabfood.co.th
cloudflared service install

# 3. Start Caddy as service
nssm install IntelliQACaddy "C:\Program Files\Caddy\caddy.exe" "run"
nssm set IntelliQACaddy AppDirectory "C:\Users\pakarang_sa\Desktop\FOOD COST MANAGEMENT\qa-brand-standard-app"
nssm start IntelliQACaddy
```

เปิดเบราว์เซอร์ → `https://intelliqa.fabfood.co.th` ✅

---

**© 2026 Fab Food Holding · IntelliQA Self-Hosting Guide v1.0**
