# Development Log

## Purpose

This file is the handoff document between coding sessions. AI writes here, human reviews, then changes get applied to master documents.

**Rules:**
- AI writes proposed changes here
- Human confirms before changes go to master docs
- After confirmation, move completed items to `Development_Log_History.md`

---

## Current Session

**Date:** 2026-02-16 to 2026-02-18
**Working on:** Frontend-to-API Integration + SMTP + End-to-End Testing

---

## New Components Added

**Backend Components Created:**

| File | Purpose | Technology |
|------|---------|------------|
| api/package.json | Project dependencies | pg, bcryptjs, jsonwebtoken, joi, express, etc. |
| api/.env | Environment configuration | DB connection, JWT secret, SMTP config |
| api/src/index.js | Express server entry point | Express 4 |
| api/src/config/env.js | Environment validation | dotenv |
| api/src/utils/db.js | PostgreSQL connection pool | pg library (NOT PostgREST) |
| api/src/utils/password.js | Password hashing | bcryptjs (12 salt rounds) |
| api/src/utils/otp.js | OTP generation | 6-digit random, bcrypt hashed |
| api/src/middleware/auth.js | JWT verification | jsonwebtoken |
| api/src/middleware/permission.js | RBAC permission checker | Custom middleware |
| api/src/middleware/errorHandler.js | Global error handler | Handles Joi, PostgreSQL, JWT errors |
| api/src/services/auth.service.js | Authentication business logic | 11-step login, 5-step forgot, 9-step reset |
| api/src/services/audit.service.js | Audit logging | Inserts to audit.audit_log |
| api/src/routes/auth.routes.js | Authentication routes | POST /api/auth/login, /forgot-password, /reset-password |
| api/src/utils/email.js | OTP email sending via nodemailer | Gmail SMTP (smtp.gmail.com:587) with App Password |
| frontend/src/utils/api.js | Real API client (replaces mockApi.js) | axios, returns { status, data } matching mockApi format |

---

## Modified Components

| Comp_ID | Field Changed | Old Value | New Value | Reason |
|---------|---------------|-----------|-----------|--------|
| FORGOT-005, FORGOT-006, FORGOT-007 | Password validation regex | Only allowed `@ $ ! % * ? & #` as special chars | Allows ALL symbols: `! @ # $ % ^ & * ( ) _ - + = [ ] { } etc.` | User feedback: underscore `_` and other symbols should work. Broadened "special char" definition while maintaining URS 2.1.1 requirements (min 8, uppercase, lowercase, number, special). |
| LOGIN-001 to LOGIN-005 | API source | `mockAuthApi` from `mockApi.js` | `authApi` from `api.js` | Frontend now calls real Express API instead of in-browser mock |
| FORGOT-001 to FORGOT-007 | API source | `mockAuthApi` from `mockApi.js` | `authApi` from `api.js` | Frontend now calls real Express API instead of in-browser mock |
| auth.service.js | OTP delivery | `console.log` (TODO) | `sendOTP()` via nodemailer | Real OTP emails via Gmail SMTP, console.log kept as fallback |

---

## Deleted Components

| Comp_ID | Label | Reason |
|---------|-------|--------|
| | | |

---

## Status Updates (Progress Tracking)

Update these in `Frontend_Component_Mapping.csv` after confirmation:

| Comp_ID | UI_Ready | API_Ready | DB_Verified | Notes |
|---------|:--------:|:---------:|:-----------:|-------|
| LOGIN-001 | ✓ | ✓ | ✓ | Email/Phone input - End-to-end tested |
| LOGIN-002 | ✓ | ✓ | ✓ | Password input - End-to-end tested |
| LOGIN-003 | ✓ | ✓ | ✓ | Login button - JWT + DB verified |
| LOGIN-004 | ✓ | ✓ | ✓ | Forgot password - End-to-end tested |
| LOGIN-005 | ✓ | ✓ | ✓ | Error handling - End-to-end tested |
| FORGOT-001 | ✓ | ✓ | ✓ | Email input - End-to-end tested |
| FORGOT-002 | ✓ | ✓ | ✓ | Send OTP - Gmail email delivered |
| FORGOT-003 | ✓ | ✓ | ✓ | OTP input - End-to-end tested |
| FORGOT-004 | ✓ | ✓ | ✓ | Use Different Email - End-to-end tested |
| FORGOT-005 | ✓ | ✓ | ✓ | New password - End-to-end tested |
| FORGOT-006 | ✓ | ✓ | ✓ | Confirm password - End-to-end tested |
| FORGOT-007 | ✓ | ✓ | ✓ | Reset password - End-to-end tested |

**How to mark:** ✓ = Done, empty = Not done

**Meaning:**
- UI_Ready: React component coded and works
- API_Ready: Express endpoint coded and works  
- DB_Verified: Database table/columns confirmed working

**All 3 checked = End-to-end tested and complete**

---

## Proposed CSV Updates

**Status:** ⏳ WAITING FOR CONFIRMATION

Changes to apply to `Frontend_Component_Mapping.csv`:

```
UPDATE all LOGIN and FORGOT components (LOGIN-001 to LOGIN-005, FORGOT-001 to FORGOT-007):
- Set API_Ready = ✓ for all 12 components
- Set DB_Verified = ✓ for all 12 components (end-to-end tested 2026-02-17)
- UI_Ready already = ✓ (from SESSION 1)

All 12 components now have all 3 checks: UI_Ready ✓, API_Ready ✓, DB_Verified ✓
Login + Forgot Password feature is COMPLETE.
```

---

## Proposed Business Logic Updates

**Status:** ⏳ WAITING FOR CONFIRMATION

Changes to apply to `Backend_Business_Logic.md`:

```
1. All 3 authentication endpoints implemented exactly per BLL.md spec:
   - POST /api/auth/login (11-step flow) ✅ IMPLEMENTED
   - POST /api/auth/forgot-password (5-step flow) ✅ IMPLEMENTED
   - POST /api/auth/reset-password (9-step flow) ✅ IMPLEMENTED

2. PROPOSED: Add DATA STANDARDS section (between PROJECT ROOT DIRECTORY MAP and PART 4):

   ## DATA STANDARDS

   ### Status Field Values
   All `status` columns across the database use UPPERCASE values:
   - `ACTIVE` — account/record is active and operational
   - `INACTIVE` — account/record is deactivated
   - `LOCKED` — account locked due to failed login attempts

   Applies to: auth.user_account.status, and any future status fields.

   Reason: UPPERCASE is the industry standard for enum-like database values.
   Prevents case-comparison bugs ('Active' !== 'ACTIVE').
```

---

## Database Changes Made

**Status:** ✅ TABLES EXIST — End-to-end tested on 2026-02-17

Tables confirmed working via end-to-end login + forgot-password test:

```
✅ auth.user_account — 5 users (test account: newgoatproject@outlook.com)
✅ auth.login_attempt — login SUCCESS/FAILED entries recorded
✅ auth.otp — OTP records created, otp_code column widened to varchar(72)
✅ rbac.user_role — user 5 assigned Super Admin (role_id=1)
✅ rbac.role — 6 roles exist (Super Admin=1, Admin=2, Farmer=3, Staff=4, Vet=5, Test=6)
✅ rbac.role_permission — permissions exist
✅ rbac.permission — permissions exist
✅ core.user_profile — profiles exist (requires user_type + ic_or_passport NOT NULL)
✅ notify.notification — OTP notification records created
✅ audit.audit_log — verified working (column is created_at, not timestamp; audit.service.js fixed)
```

---

## Issues / Blockers

| Issue | Description | Status |
|-------|-------------|--------|
| PostgreSQL connection | Connected via Tailscale to `100.64.127.73:5432`. Health endpoint returns `{status: ok, db: connected}`. | ✅ Resolved |
| Database tables | Tables exist on Pi (auth.user_account has 4 test users). Need to verify all required tables. | ⏳ Verify during testing |
| SMTP configured | **Changed from Outlook to Gmail.** Outlook requires OAuth2 (basic auth disabled). Now using Gmail SMTP (`smtp.gmail.com:587`) with App Password. From address: `Orion System <poodletransformshere@gmail.com>`. Console.log fallback still in place. | ✅ Resolved |
| auth.otp.otp_code column | Was `varchar(10)`, too short for bcrypt hash (~60 chars). User ran `ALTER TABLE auth.otp ALTER COLUMN otp_code TYPE varchar(72)` in pgAdmin. | ✅ Resolved |
| SMTP credential sharing | `.env` is already in `.gitignore` (won't be pushed to git). **Decision needed:** How to securely share SMTP credentials with teammate? Options: (a) shared password manager, (b) `.env.example` with placeholder values in git + real values shared privately, (c) document in private team wiki. | ⏳ User to decide |
| .env in git? | `.env` is already excluded via `api/.gitignore` line 2. Safe to push — credentials will NOT appear on GitHub. Consider creating `api/.env.example` (without real passwords) so teammate knows what variables to set. | ⏳ User to decide |
| Status case mismatch | Database has `Active`/`Inactive` for some users, API expects `ACTIVE`/`INACTIVE`. Need to fix in pgAdmin. | ⏳ User to fix |
| User 4 password hash | Double `$$` in bcrypt hash — data entry error. Re-hash or use forgot-password flow. | ⏳ User to fix |
| AI has no DB schema access | AI cannot see table structures (columns, NOT NULL constraints, foreign keys). Had to guess INSERT columns, causing repeated failures. Docs describe tables but don't include full column definitions with constraints. **Needs solution:** either (a) export full schema DDL to `/docs` or `/database`, (b) give AI read access to `information_schema`, or (c) include column constraints in BLL.md table definitions. | ⏳ User to decide |
| Data quality: bcrypt salt rounds | Users 1-4 use inconsistent salt rounds (`$2b$10` for user 1, `$2a$04` for users 2-3). Our code uses `$2a$12` (password.js). Old hashes still work but are weaker. Consider re-hashing on next login. | ⏳ Carry forward |
| Data quality: test data formats | No standard format for ic_or_passport (IC numbers vs `TEST000005`), phone numbers (US format vs +60). Need a data dictionary before production deployment. | ⏳ Carry forward |
| Data quality: user 1 (teammate) | `spiggles.67@gmail.com` created outside normal flow — missing `core.user_profile` row, assigned Admin role (role_id=2) not Super Admin. | ⏳ User to fix |
| Data quality: users 2-4 no roles | Users 2, 3, 4 have no `rbac.user_role` entry — login would crash at permissions query. | ⏳ User to fix |

---

## Questions for Human

1. ❓ Confirm SESSION 2 complete? All API endpoints coded, frontend connected to real API, SMTP configured.
2. ✅ Frontend swapped from `mockApi.js` to `api.js` — now calls real Express API via axios.
3. ✅ SMTP configured: **Gmail** (`poodletransformshere@gmail.com`) via `smtp.gmail.com:587` with App Password. Outlook abandoned (requires OAuth2). Console.log fallback if SMTP fails.
4. ✅ PostgreSQL connected via Tailscale: `DB_HOST=100.64.127.73`, port 5432. Health check verified: `{status: ok, db: connected}`. For production on Pi, change to `localhost`.
5. ❓ Database status case: Users 2+4 have `Active` instead of `ACTIVE`. Run in pgAdmin: `UPDATE auth.user_account SET status = 'ACTIVE' WHERE status = 'Active';`
6. ❓ User 4 password hash has double `$$`. Re-hash with known password in pgAdmin, or reset via forgot-password flow.

---

## Next Session Should

**SESSION 3 COMPLETED — Migration Setup Done (2026-02-18):**

1. ✅ Database schema exported and converted to migration baseline
2. ✅ Knex migration system set up (`knexfile.js` + `database/migrations/`)
3. ✅ BLL updated to match actual DB column names (breed_type, date_administered)
4. ✅ Gaps #2, #7, #8, #9, #10 marked as RESOLVED in BLL
5. ✅ Frontend Coding Standards updated (Rule 6, 10, 12)
6. ✅ README updated with three truth sources + migration workflow

**THIS CYCLE (Login + Forgot Password) IS COMPLETE.**
Move completed items to `Development_Log_History.md` and clear this file for next feature.

**NEXT CYCLE — Pick next feature to build (starts at Session 1 again):**

Option A: Admin Reference CRUD (vaccine_type, breeding_type, breed_type) — simplest, repeats 3x
Option B: User Registration (Module 3) — multi-step transaction, enables creating test users
Option C: Goat Management (Module 5) — core feature, most visible progress

**Before starting next cycle:**
1. Run `npm install knex pg --save-dev` from project root (one-time setup)
2. Run `npx knex migrate:latest` to apply baseline
3. Run `npx knex migrate:status` to confirm
4. Fix data quality issues from this cycle (status case mismatch, user roles)

---

## Confirmation Log

| Date | Item | Confirmed By | Applied To |
|------|------|--------------|------------|
| 2026-02-08 | SESSION 1: Login & Forgot Password Frontend | Human | Frontend_Component_Mapping.csv |
| 2026-02-14 | SESSION 2: Authentication Backend API (pg library) | ⏳ PENDING | Frontend_Component_Mapping.csv |
| 2026-02-18 | SESSION 3: Migration setup + BLL/FCS sync | ⏳ PENDING | BLL, FCS, README, DevLog |

---

# How This File Works

```
SESSION START
    ↓
Human: "Today we're building the vaccination page"
    ↓
AI: Reads Backend_Business_Logic.md, Frontend_Component_Mapping.csv
    ↓
AI: Codes components with @component tags
    ↓
AI: Logs new/modified/deleted components HERE
    ↓
SESSION END
    ↓
Human: Reviews this file
    ↓
Human: "Confirmed, update master docs"
    ↓
AI: Updates Excel and/or Business Logic
    ↓
Human: Moves confirmed items to History file
    ↓
NEXT SESSION
```
