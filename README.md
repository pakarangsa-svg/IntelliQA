# IntelliQA — Intelligent Restaurant Quality Assurance

A web-based QA platform for a 4-brand restaurant chain (Jae Dang · Yamachan · Santa Fe Happy Steak · Santa Fe Easy) covering Store Audits, Cleaning Programs, CEM, Supplier Complaints, and Audit Planning.

## ✨ Modules

- 🏪 **Store Audit** — per-brand QSC/OSS audit forms + scoring + history + AM Portal
- 🕵️ **Mystery Shopper (CEM)** — Santa Fe Happy CEM dashboard
- 🗓️ **Audit Planner** — quarterly schedule, workday-only suggestions (Thai-holiday aware), flight-cost heuristic for FS branches
- 🏭 **Supplier Complaint** — FM-QARD-style complaint log with dashboard
- 🧽 **Cleaning Program** — Swab/Coliform/Polar/Sanitizer tracking + branch portal

## 🚀 Running locally

It's a pure client-side app — no build step.

```bash
# From the qa-brand-standard-app directory:
python -m http.server 5173
# or
npx serve
```

Open <http://localhost:5173>.

## 🔐 First-time login

A modal asks for E-mail · Department · Brand. Departments determine module access:

| Department | Modules | Brand scope |
|---|---|---|
| QA/RD, IT | Everything | All brands |
| Purchase | Store Audit · CEM · Supplier Complaint | All brands |
| Operation · Training · Operation-Store | Store Audit · CEM · Cleaning Program | Own brand only |

"Back Office" brand option = cross-brand access regardless of department.

## 📦 Tech stack

Vanilla JavaScript SPA (~10k LOC) · Chart.js 4 · chartjs-plugin-datalabels · SheetJS (XLSX export) · localStorage persistence. No framework, no bundler, no backend.

## ☁️ Deploy to GitHub Pages

See [DEPLOY.md](DEPLOY.md) for step-by-step.

---
© 2026 Fab Food Holding · QA System
