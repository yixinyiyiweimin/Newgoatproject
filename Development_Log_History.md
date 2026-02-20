# Development Log History

Archived completed sessions. See `Development_Log.md` for current session.

---

## Cycle 1: Login + Forgot Password (2026-02-08 to 2026-02-21)

### SESSION 1 — Frontend (2026-02-08)

Built LoginPage.jsx and ForgotPasswordPage.jsx with mockApi.js for local testing.

**Components:** LOGIN-001 to LOGIN-005, FORGOT-001 to FORGOT-007 (12 total)

### SESSION 2 — API + Integration (2026-02-14 to 2026-02-21)

**Backend created:**
| File | Purpose |
|------|---------|
| api/src/index.js | Express 4 server |
| api/src/config/env.js | Environment validation |
| api/src/utils/db.js | PostgreSQL connection pool (pg library) |
| api/src/utils/password.js | bcryptjs, 12 salt rounds |
| api/src/utils/otp.js | 6-digit OTP, bcrypt hashed |
| api/src/utils/email.js | Gmail SMTP via nodemailer |
| api/src/middleware/auth.js | JWT verification |
| api/src/middleware/permission.js | RBAC permission checker |
| api/src/middleware/errorHandler.js | Global error handler |
| api/src/services/auth.service.js | 11-step login, 5-step forgot, 9-step reset |
| api/src/services/audit.service.js | Audit logging |
| api/src/routes/auth.routes.js | 3 auth endpoints |
| frontend/src/utils/api.js | Real axios client (replaced mockApi.js) |

**Integration changes:**
- LoginPage.jsx + ForgotPasswordPage.jsx: swapped mockAuthApi → authApi
- auth.service.js: replaced console.log OTP with real email sending (Gmail SMTP)
- audit.service.js: fixed column name `timestamp` → `created_at`

**Issues resolved:**
- Outlook SMTP requires OAuth2 → switched to Gmail with App Password
- auth.otp.otp_code was varchar(10), too short for bcrypt hash → widened to varchar(72)
- AI had no DB schema access → resolved by Knex baseline migration

**End-to-end verified (2026-02-21):**
- Login: browser → Express API → PostgreSQL → JWT returned
- Forgot password: OTP email delivered via Gmail → password reset works
- DB tables verified: login_attempt, user_account, otp, audit_log all recording data

**All 12 components: UI_Ready ✓, API_Ready ✓, DB_Verified ✓**

### SESSION 3 — Migration Setup (2026-02-18)

- Knex migration system set up (`knexfile.js` + `database/migrations/`)
- Baseline migration captures all 24 tables across 8 schemas
- BLL updated to match actual DB column names
- Frontend Coding Standards updated
- README updated with three truth sources + migration workflow

### Decisions Made

- Mock data (users 1-4) left as-is — will be wiped before demo
- Status values standardized to UPPERCASE (ACTIVE, INACTIVE, LOCKED)
- `.env` excluded from git via root `.gitignore`
- SMTP: Gmail (`poodletransformshere@gmail.com`) with App Password

### Confirmation Log

| Date | Item | Confirmed By |
|------|------|--------------|
| 2026-02-08 | SESSION 1: Login & Forgot Password Frontend | Human |
| 2026-02-21 | SESSION 2: API + Frontend integration, SMTP, end-to-end verified | Human |
| 2026-02-21 | SESSION 3: Migration setup + BLL/FCS sync | Human |