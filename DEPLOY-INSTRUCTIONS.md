# 🚀 Deploy Instructions - Bug Fix

## Quick Start

```bash
# One-command deploy (recommended)
./push-and-deploy.sh
```

---

## What Was Fixed

**Bug:** "Invalid character in header content [\"Authorization\"]"

**Cause:** node-fetch v3 incompatibility with Firebase Functions

**Solution:** Use Node.js 22 native fetch

**Affected Endpoints:**
- ✅ `/reports/sales-comparison` (FASE 1)
- ✅ `/reports/sales-summary`
- ✅ `/reports/sales-top`

---

## Deploy Options

### Option A: Automated (Recommended)
```bash
./push-and-deploy.sh
```
- Pushes to GitHub
- Deploys to Firebase
- Auto-tests endpoints

### Option B: Deploy Only
```bash
./deploy-fix.sh
```
- Deploys to Firebase
- Auto-tests endpoints

### Option C: Manual
```bash
git push origin main
npx firebase deploy --only functions
```

---

## Testing After Deploy

### 1. Visual Testing Tool
```bash
open tests/manual-testing.html
```

### 2. Frontend
https://lightspeed-middleware.web.app/dashboard

### 3. curl
```bash
curl "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/reports/sales-comparison?date_from=2025-01-09&date_to=2025-02-09&outlet_id=1" \
  -H "Authorization: Bearer sk-IVG-LS-20250821-aK7b9N3pXzW5rD1v" | jq '.'
```

---

## Verification Checklist

- [ ] `/health` responds OK
- [ ] `/reports/sales-comparison` works
- [ ] Dashboard loads without errors
- [ ] PeriodSelector updates metrics
- [ ] Sales chart displays correctly

---

## Documentation

- Quick Start: [tests/README.md](tests/README.md)
- Testing Guide: [tests/TESTING_GUIDE.md](tests/TESTING_GUIDE.md)
- Session Docs: [SESSION-2026-02-09-FIX.md](SESSION-2026-02-09-FIX.md)

---

**Ready?** Run: `./push-and-deploy.sh`
