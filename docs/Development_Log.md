# Development Log

## Purpose

This file is the handoff document between coding sessions. AI writes here, human reviews, then changes get applied to master documents.

**Rules:**
- AI writes proposed changes here
- Human confirms before changes go to master docs
- After confirmation, move completed items to `../../Development_Log_History.md`

---

## Current Session

**Date:** 2026-02-22
**Working on:** Cycle 2 — All 6 Admin Pages (URS 2.1.2 through 2.1.7)

---

## New Components Added

| File | Purpose | Technology |
|------|---------|------------|
| `frontend/src/components/AuthGuard.jsx` | Redirects to /login if no token or wrong role | React Router Navigate |
| `frontend/src/components/AdminLayout.jsx` + `.css` | Sidebar navigation + Outlet for admin pages | React Router NavLink + Outlet |
| `frontend/src/components/AdminCrudTable.jsx` + `.css` | Reusable CRUD table for reference data pages | React (configurable via props) |
| `frontend/src/components/ConfirmDialog.jsx` + `.css` | Reusable delete confirmation modal | React |
| `frontend/src/pages/admin/dashboard/AdminDashboard.jsx` + `.css` | Admin dashboard with stat cards, filters, bar chart | React |
| `frontend/src/pages/admin/vaccine-types/VaccineTypes.jsx` | Vaccine types CRUD page | AdminCrudTable |
| `frontend/src/pages/admin/breeding-types/BreedingTypes.jsx` | Breeding types CRUD page | AdminCrudTable |
| `frontend/src/pages/admin/goat-breeds/GoatBreeds.jsx` | Goat breeds CRUD page | AdminCrudTable |
| `frontend/src/pages/admin/users/UserRegistration.jsx` + `.css` | User registration with Individual/Company tabs | React |
| `frontend/src/pages/admin/roles/UsersAndRoles.jsx` + `.css` | Users & Roles with permission grid | React |
| `api/src/routes/admin.routes.js` | Master admin router (mounts 6 sub-routers, applies auth) | Express |
| `api/src/routes/admin/dashboard.routes.js` | GET /api/admin/dashboard | Express |
| `api/src/routes/admin/vaccineType.routes.js` | CRUD /api/admin/vaccine-types | Express + Joi |
| `api/src/routes/admin/breedingType.routes.js` | CRUD /api/admin/breeding-types | Express + Joi |
| `api/src/routes/admin/goatBreed.routes.js` | CRUD /api/admin/goat-breeds | Express + Joi |
| `api/src/routes/admin/user.routes.js` | CRUD /api/admin/users + resend | Express + Joi |
| `api/src/routes/admin/role.routes.js` | CRUD /api/admin/roles + assign + status | Express + Joi |
| `api/src/services/referenceData.service.js` | Factory for CRUD services (shared by 3 ref pages) | pg |
| `api/src/services/vaccineType.service.js` | Vaccine type CRUD (uses factory) | pg |
| `api/src/services/breedingType.service.js` | Breeding type CRUD (uses factory) | pg |
| `api/src/services/goatBreed.service.js` | Goat breed CRUD (uses factory) | pg |
| `api/src/services/dashboard.service.js` | Admin dashboard aggregation queries | pg |
| `api/src/services/user.service.js` | User registration (multi-table transaction) | pg |
| `api/src/services/role.service.js` | Role CRUD with permission grid | pg |

---

## Modified Components

| Comp_ID | Field Changed | Old Value | New Value | Reason |
|---------|---------------|-----------|-----------|--------|
| - | `frontend/src/App.jsx` | 2 routes (login, forgot) | Added 6 nested admin routes with AuthGuard + AdminLayout | Cycle 2 admin pages |
| - | `frontend/src/utils/api.js` | Only authApi | Added Axios interceptors + 6 admin API exports | All admin pages need authenticated API calls |
| - | `api/src/index.js` | Only auth routes | Added `app.use('/api/admin', adminRoutes)` | Mount admin router |
| - | `api/src/utils/email.js` | Only sendOTP | Added sendCredentials function | User registration sends temp password |
| - | `frontend/vite.config.js` | port 3000 | port 5173 | Avoid conflict with API server on port 3000 |

---

## Deleted Components

| Comp_ID | Label | Reason |
|---------|-------|--------|
| (none) | | |

---

## Status Updates (Progress Tracking)

Update these in `Frontend_Component_Mapping.csv` after confirmation:

| Comp_ID | UI_Ready | API_Ready | DB_Verified | Notes |
|---------|:--------:|:---------:|:-----------:|-------|
| NAV-001 | Done | | | AdminLayout sidebar |
| A-DASH-001 | Done | Done | | Total Premises Card |
| A-DASH-002 | Done | Done | | Premises by Location Card |
| A-DASH-003 | Done | Done | | Premise ID Filter |
| A-DASH-004 | Done | Done | | IC Number Search |
| A-DASH-005 | Done | Done | | State Distribution Chart (CSS bar chart) |
| A-VAX-001 | Done | Done | | Add Vaccine Button |
| A-VAX-002 | Done | Done | | Vaccine List Table |
| A-VAX-003 | Done | Done | | Search Bar |
| A-VAX-004 | Done | Done | | Edit Row Button |
| A-VAX-005 | Done | Done | | Delete Row Button |
| A-VAX-006 | Done | Done | | Vaccine Form Modal |
| A-VAX-007 | Done | Done | | Vaccine Name Input |
| A-VAX-008 | Done | Done | | Interval Days Input |
| A-VAX-009 | Done | Done | | Save Vaccine Button |
| A-VAX-010 | Done | Done | | Cancel Button |
| A-BRTYPE-001 | Done | Done | | Add Breeding Type Button |
| A-BRTYPE-002 | Done | Done | | Breeding Type List Table |
| A-BRTYPE-003 | Done | Done | | Edit Row Button |
| A-BRTYPE-004 | Done | Done | | Delete Row Button |
| A-BRTYPE-005 | Done | Done | | Breeding Type Form Modal |
| A-BRTYPE-006 | Done | Done | | Breeding Type Name Input |
| A-BRTYPE-007 | Done | Done | | Save Breeding Type Button |
| A-GBREED-001 | Done | Done | | Add Goat Breed Button |
| A-GBREED-002 | Done | Done | | Goat Breed List Table |
| A-GBREED-003 | Done | Done | | Edit Row Button |
| A-GBREED-004 | Done | Done | | Delete Row Button |
| A-GBREED-005 | Done | Done | | Goat Breed Form Modal |
| A-GBREED-006 | Done | Done | | Goat Breed Name Input |
| A-GBREED-007 | Done | Done | | Save Goat Breed Button |
| A-UREG-001 | Done | Done | | Add User Button |
| A-UREG-002 | Done | Done | | User List Table |
| A-UREG-003 | Done | Done | | Search Bar |
| A-UREG-004 | Done | Done | | User Registration Form Modal |
| A-UREG-005 | Done | Done | | Individual Tab |
| A-UREG-006 | Done | Done | | Company Tab |
| A-UREG-007 | Done | Done | | Full Name Input |
| A-UREG-008 | Done | Done | | IC Number Input |
| A-UREG-009 | Done | Done | | Address Input |
| A-UREG-010 | Done | Done | | Phone Number Input |
| A-UREG-011 | Done | Done | | Premise ID Input |
| A-UREG-012 | Done | Done | | Email Input |
| A-UREG-013 | Done | | | Upload Documents — UI stub, backend deferred |
| A-UREG-014 | Done | Done | | Company Name Input |
| A-UREG-015 | Done | Done | | Company Registration Number Input |
| A-UREG-016 | Done | Done | | Person in Charge Input |
| A-UREG-017 | Done | Done | | Save User Button |
| A-UREG-018 | Done | Done | | View Details Button |
| A-UREG-019 | Done | Done | | Edit Row Button |
| A-UREG-020 | Done | Done | | Delete Row Button |
| A-UREG-021 | Done | Done | | Resend Credentials Button |
| A-ROLES-001 | Done | Done | | Users Tab |
| A-ROLES-002 | Done | Done | | Roles Tab |
| A-ROLES-003 | Done | Done | | System Users Table |
| A-ROLES-004 | Done | Done | | Roles Table |
| A-ROLES-005 | Done | Done | | Add User Button |
| A-ROLES-006 | Done | Done | | Add Role Button |
| A-ROLES-007 | Done | Done | | User Form Modal |
| A-ROLES-008 | Done | Done | | User Email Input |
| A-ROLES-009 | Done | Done | | User Phone Input |
| A-ROLES-010 | Done | Done | | User IC/Passport Input |
| A-ROLES-011 | Done | Done | | Role Assignment Dropdown |
| A-ROLES-012 | Done | Done | | Status Toggle |
| A-ROLES-013 | Done | Done | | Save User Button |
| A-ROLES-014 | Done | Done | | Role Form Modal |
| A-ROLES-015 | Done | Done | | Role Name Input |
| A-ROLES-016 | Done | Done | | Module Permissions Grid |
| A-ROLES-017 | Done | Done | | Save Role Button |

**DB_Verified:** Blank for all — human needs to verify via pgAdmin that permission seed data exists in `rbac.permission` and `rbac.role_permission` tables.

---

## Issues / Blockers

| Issue | Description | Status |
|-------|-------------|--------|
| Permission seed data | `rbac.permission` table must contain entries for all modules (vaccine_type, breeding_type, goat_breed, user_registration, user_role, dashboard, etc.) with view/create/update/delete actions. Without this, all admin API calls return 403. | RESOLVED — Migration `20260227000000_seed_admin_permissions.js` applied |
| Duplicate permissions | Migration created 6 duplicate rows (goat + health_record). | RESOLVED — Migration `20260228000000_deduplicate_permissions.js` applied, UNIQUE constraint added |
| Permission case mismatch | Routes used lowercase ('view'), DB stored UPPERCASE ('VIEW'). | RESOLVED — `permission.js` middleware now case-insensitive |
| Wrong role name in code | `user.service.js` looked for 'Farmer' but BLL 9A says 'Farm Owner'. | RESOLVED — Code updated to 'Farm Owner', role added via migration |
| Document upload | A-UREG-013 is a UI stub only. Backend file upload with multer is deferred. Storage decision: **local disk, relative paths, UPLOAD_DIR from .env**. | DECIDED — implement in Cycle 3 |
| Port change | Vite dev server moved from 3000 to 5173 to avoid conflict with API. Frontend `.env` VITE_API_URL still points to localhost:3000. | INFO |

---

## Truth Source Discrepancies

All resolved this cycle:
- ~~CSV `admin_ref.goat_breed` vs migration `admin_ref.breed_type`~~ — CSV fixed
- ~~BLL role_name references~~ — BLL verified aligned with DB

---

## Next Session Should

1. Start Cycle 3: User-facing pages (User Dashboard, Goat Management, RFID Scan, etc.)
2. Implement document upload (A-UREG-013) — storage decision made: local disk, relative paths, UPLOAD_DIR from .env
3. DB_Verified column still blank for all Cycle 2 admin components — spot-check in pgAdmin
4. Move this DevLog to Development_Log_History.md after confirmation

---

## Confirmation Log

| Date | Item | Confirmed By | Applied To |
|------|------|--------------|------------|
| | | | |

See [`Development_Log_History.md`](../../Development_Log_History.md) for past sessions.

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
