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
├── Code_To_Excel_Extraction.md
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
- If AI needs a column that doesn't exist, it writes a migration file — NOT a pgAdmin instruction
- pgAdmin is for VIEWING data and debugging, not for schema changes
- Every schema change = a migration file in git

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

See the setup instructions below. Only needed once per developer machine.

### Prerequisites
- Node.js installed on your local PC
- Tailscale running (to reach Pi at 100.64.127.73)

### Steps
```bash
# 1. From project root, install knex
npm install knex pg --save-dev

# 2. Verify connection to Pi
npx knex migrate:status

# 3. Apply baseline (safe — uses IF NOT EXISTS)
npx knex migrate:latest

# 4. Verify
npx knex migrate:status
# Should show: 20260218000000_baseline.js .... DONE
```
