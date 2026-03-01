# Newgoatproject

This repository is for Version Control (Git History), Progress Tracing (Frontend_Component_Mapping.csv) and Info Aggregation.

---

## Three Truth Sources

Every coding session must reference these. If any two disagree, fix the discrepancy BEFORE writing code.

| Truth Source | What It Defines | Location |
|---|---|---|
| **Backend_Business_Logic.md** | What the API should do (endpoints, logic, request/response shapes) | `docs/` |
| **Frontend_Component_Mapping.csv** | What the UI shows (components, status tracking) | `docs/` |
| **Migration files** | What the database actually contains (tables, columns, types, FKs) | `database/migrations/` |

If the BLL says one column name and the migration file says another, **the migration file wins** — it's the actual SQL that created the table.

**Supporting files:**

| File | Purpose |
|------|---------|
| `docs/Frontend_Coding_Standards.md` | Rules for writing tagged React code |
| `docs/Development_Log.md` | Session handoff (temporary, cleared after confirmation) |
| `knexfile.js` | Database connection config for migrations |

---

## Folder Structure

```
/project-root
├── README.md                           ← YOU ARE HERE
├── knexfile.js                         ← Database migration config
├── Development_Log_History.md
│
├── /docs
│   ├── Backend_Business_Logic.md       ← Truth 1: API contract
│   ├── Frontend_Component_Mapping.csv  ← Truth 2: UI components + progress
│   ├── Frontend_Coding_Standards.md    ← Rules for writing tagged code
│   └── Development_Log.md             ← Session handoff (temporary)
│
├── /database
│   └── /migrations                     ← Truth 3: Database schema
│       ├── 20260218000000_baseline.js  ← Existing 27 tables
│       └── (future migrations here)
│
├── /frontend                           ← React code with @component tags
│   └── /src
│
├── /api                                ← Express code
│   └── /src
│
└── /hardware                           ← Hardware team's domain
```

---

## Database Migrations

### What Are Migrations?

Migration files are SQL-in-JavaScript files that define your database schema. Instead of clicking in pgAdmin to create/alter tables, you write a migration file, commit it to git, and run a command. pgAdmin becomes a read-only viewer for data, not for schema changes.

### Common Commands (run from project root on your local PC)

```bash
npx knex migrate:status              # See which migrations have been applied
npx knex migrate:latest              # Apply all pending migrations
npx knex migrate:rollback            # Undo the last migration
npx knex migrate:make <name>         # Create a new empty migration file
```

### How to Make Database Changes

```bash
# 1. Create migration file
npx knex migrate:make add_weight_history_table

# 2. Edit the file (or let coding AI write it)
# 3. Review the SQL
# 4. Apply it
npx knex migrate:latest

# 5. Commit — schema change is now in git with red/green diffs
git add database/migrations/ && git commit -m "Add weight history table"
```

### Example: Small Migration

```javascript
// database/migrations/20260220_add_goat_color.js
exports.up = function(knex) {
  return knex.raw(`ALTER TABLE farm.goat ADD COLUMN color VARCHAR(50);`);
};
exports.down = function(knex) {
  return knex.raw(`ALTER TABLE farm.goat DROP COLUMN IF EXISTS color;`);
};
```

---

## Session Workflow

```
SESSION 1: Frontend Dev
├── AI reads: BLL.md, CSV, migration files, DevLog, Coding_Standards
├── AI writes: React code (with @component tags)
├── AI writes: DevLog "Added U-GOAT-016, needs POST /api/goats"
└── Human: Verify, then confirm "update CSV"

SESSION 2: API Dev
├── AI reads: BLL.md, CSV, migration files, DevLog
├── AI writes: Express code (using column names FROM migration files)
├── If new table/column needed: AI writes a new migration file
├── AI writes: DevLog "Implemented POST /api/goats"
└── Human: Review migration, run `npx knex migrate:latest`, confirm

SESSION 3: Database Verification
├── Human: Run `npx knex migrate:status` to confirm all applied
├── Human: Spot-check data in pgAdmin (pgAdmin is now VIEW ONLY)
├── Human: Update CSV checkboxes (DB_Verified)
└── Human: Move completed items to Development_Log_History.md
```

**Critical Rules:**
- If AI needs a column that doesn't exist, it writes a migration file -- NOT a pgAdmin instruction
- pgAdmin is for VIEWING data and debugging, not for schema changes
- Every schema change = a migration file in git

---

## Open Gaps & Decisions

> **Moved from BLL Part 6.** These are project-level decisions, not API specs. Resolved items kept for historical reference.

| # | Gap | Where | Decision Needed |
|---|-----|-------|-----------------|
| 1 | **No `rfid_scan_history` table** | URS 2.2.3 says display scan history | Add table? Or use sensor_data? |
| 2 | ~~**Goat `status` values** not enumerated~~ | farm.goat.status | **RESOLVED** -- Values: ACTIVE, SLAUGHTERED, SOLD, DEAD |
| 3 | **File storage strategy** | URS requires document uploads + goat images | Local disk? AWS S3? Need to decide |
| 4 | **OTP delivery** | URS says email + SMS/WhatsApp | **PARTIALLY RESOLVED** -- Email via Gmail SMTP. SMS/WhatsApp TBD. |
| 5 | **Premise-to-user scoping** | farm.goat has premise_id but no user_account_id | Correct design, needs consistent enforcement |
| 6 | **user_profile.premise_id** is nullable FK | What if a user has no premise? | Make required for farm users, optional for admins? |
| 7-10 | ~~FK gaps~~ | Various | **RESOLVED** -- All FKs exist in migration files |
| 11 | **Notification content** | notify.notification has no `message_body` column | Handle email content in Express only (don't store body in DB) |
| 12 | **Birth certificate PDF generation** | URS says "Generate Birth Certificates" | Use pdfkit or puppeteer in Express |
| 13 | **Dashboard customization** | URS 2.1.2: "Allow admins to select data to display" | Discussion_Pending in CSV |
| 14 | ~~**Feed Calculator "All Goats" tab**~~ | Needs avg weight from all active goats | **RESOLVED** -- Express computes dynamically |

---

## Deviations from URS V1.2

> **Purpose:** Tracks intentional differences between URS and implementation. These are not bugs -- they are design improvements found during development. URS stays as the client-facing spec; this table is the internal record. Append new rows as you go.

| # | URS Section | URS Says | We Did Instead | Reason |
|---|-------------|----------|----------------|--------|
| 1 | 2.1.6 | No role field in Individual/Company registration forms | Added role dropdown to create and edit modal | Usability -- admin shouldn't need two steps to assign role |
| 2 | 2.1.6 | Premise created inline during user registration | Separate Premise Management page; registration selects from dropdown | Prevents duplicate/invalid premise entries (found during testing) |
| 3 | 2.1.7 | Role deletion blocked if users assigned (409) | Auto-unassign users on delete with two-step confirm | Better UX -- avoids "go reassign manually first" dead end |
| 4 | 2.1.7 | User delete is soft-delete only | Soft delete if active; hard delete cascade if already inactive | Allows permanent removal of test/erroneous data |
| 5 | 2.1.3-2.1.5 | "Deleted types not selectable but remain in historical data" | Added archived records toggle with GET /archived endpoint | URS describes behavior but not UI mechanism; toggle makes it discoverable |
| 6 | 2.1.7 | "Default roles have system-wide permissions" | Added system role lock (is_system_role flag) preventing permission edit | Prevents accidental lockout of Super Admin |
| 7 | 2.1.6 | Person in Charge is a text field | DEFERRED -- keep text input until person_in_charge DB migration | Field not persisted in DB yet |

---

## When Starting a Coding Session with AI

Paste this at the beginning:

```
Read these files before coding:
- /docs/Backend_Business_Logic.md        (API contract — what endpoints should do)
- /database/migrations/                  (actual DB schema — use THESE column names)
- /docs/Frontend_Component_Mapping.csv   (component inventory + progress)
- /docs/Frontend_Coding_Standards.md     (coding rules)
- /docs/Development_Log.md              (pending work)

Rules:
- Use column names from migration files, NOT from BLL if they differ
- If you need a new table or column, write a migration file in database/migrations/
- Follow Frontend_Coding_Standards.md for React code
- Write all proposed changes to Development_Log.md
- Do not modify BLL or CSV directly — propose changes in DevLog
```

---

## Document Update Order

```
1. Propose change in Development_Log.md
2. Human confirms
3. If schema change: write migration file, run npx knex migrate:latest
4. If API change: update BLL if needed
5. THEN write/modify code
```

Never implement plans without updating docs first.

---

## First-Time Setup

Only needed once per developer machine.

### Prerequisites
- Node.js installed on your local PC
- Tailscale running (to reach Pi at 100.64.127.73)

### Steps
```bash
# 1. Install all dependencies (root + api + frontend)
cd project-root
npm run setup

# 2. Set up environment variables
cp api/.env.example api/.env
# Then fill in real values (ask team lead for credentials)

# 3. Verify database connection
npx knex migrate:status

# 4. Apply migrations (safe — uses IF NOT EXISTS)
npx knex migrate:latest
```

### Running the App
```bash
npm run dev:api        # Start Express API on port 3000
npm run dev:frontend   # Start React dev server (Vite)
```
