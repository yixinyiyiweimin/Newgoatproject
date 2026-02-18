# Newgoatproject

This repository is for Version Control (Git History), Progress Tracing (Frontend_Component_Mapping.csv) and Info Aggregation.

---

## Three Truth Files

Every coding session must reference these. If any two disagree, fix the discrepancy BEFORE writing code.

| File | Source of Truth For | AI Reads Before |
|------|--------------------|-----------------| 
| `docs/Backend_Business_Logic.md` | What the API should do (endpoints, logic, request/response shapes) | Session 2 (API Dev) |
| `docs/Frontend_Component_Mapping.csv` | What the UI shows (components, status tracking) | Session 1 (Frontend Dev) |
| `docs/Database_Data_Dictionary.md` | What the database actually contains (tables, columns, types, FKs) | Session 2 (API Dev), Session 3 (DB) |

**Supporting files:**

| File | Purpose |
|------|---------|
| `docs/Frontend_Coding_Standards.md` | Rules for writing tagged React code |
| `docs/Development_Log.md` | Session handoff (temporary, cleared after confirmation) |
| `database/schema_export.csv` | Raw PostgreSQL export (source data for Data Dictionary) |
| `database/export_v1.txt` | SQL query to regenerate schema_export.csv |

---

## Folder Structure

```
/project-root
├── README.md                           ← YOU ARE HERE
├── Code_To_Excel_Extraction.md         ← Use AI to sync CSV from code
├── Development_Log_History.md          ← Completed session archive
│
├── /docs
│   ├── Backend_Business_Logic.md       ← Truth File 1: API contract
│   ├── Frontend_Component_Mapping.csv  ← Truth File 2: UI components + progress
│   ├── Database_Data_Dictionary.md     ← Truth File 3: Actual DB schema
│   ├── Frontend_Coding_Standards.md    ← Rules for writing tagged code
│   └── Development_Log.md             ← Session handoff (temporary)
│
├── /frontend                           ← React code with @component tags
│   └── /src
│
├── /api                                ← Express code
│   └── /src
│
├── /database
│   ├── schema_export.csv               ← Raw pgAdmin export
│   └── export_v1.txt                   ← SQL query to regenerate export
│
└── /hardware                           ← Hardware team's domain (hands off)
```

---

## Session Workflow

```
SESSION 1: Frontend Dev
├── AI reads: BLL.md, CSV, DataDictionary, DevLog, Coding_Standards
├── AI writes: React code (with @component tags)
├── AI writes: DevLog "Added U-GOAT-016, needs POST /api/goats"
└── Human: Verify, then confirm "update CSV"

SESSION 2: API Dev
├── AI reads: BLL.md, CSV, DataDictionary, DevLog
├── AI writes: Express code (using ACTUAL column names from DataDictionary)
├── AI writes: DevLog "Implemented POST /api/goats"
└── Human: Verify, then confirm "update BLL if logic changed"

SESSION 3: Database
├── AI reads: DevLog, DataDictionary
├── Human: Make changes in pgAdmin
├── Human: Re-run export_v1.txt → schema_export.csv
├── Human: Update Database_Data_Dictionary.md
├── Human: Update CSV checkboxes (DB_Verified)
└── Human: Move completed items to Development_Log_History.md
```

**Critical Rule:** If Session 2 (API Dev) needs a column that doesn't exist in the Data Dictionary, the AI must log it in DevLog as a proposed DB change — NOT guess the column name. The change happens in Session 3.

---

## When Starting a Coding Session with AI

Paste this at the beginning:

```
Read these files before coding:
- /docs/Backend_Business_Logic.md        (API contract)
- /docs/Database_Data_Dictionary.md      (actual DB schema — use THESE column names)
- /docs/Frontend_Component_Mapping.csv   (component inventory + progress)
- /docs/Frontend_Coding_Standards.md     (coding rules)
- /docs/Development_Log.md              (pending work)

Rules:
- Use column names from Database_Data_Dictionary.md, NOT from BLL.md if they differ
- Follow Frontend_Coding_Standards.md exactly
- Write all proposed changes to Development_Log.md
- Do not modify BLL, CSV, or Data Dictionary directly — propose changes in DevLog
```

---

## Document Update Order

When making changes, always update docs BEFORE coding:

```
1. Propose change in Development_Log.md
2. Human confirms
3. Update the relevant truth file(s)
4. THEN write/modify code
```

Never implement plans without updating docs first. This prevents document drift.
