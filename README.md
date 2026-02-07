# Newgoatproject
This repository is for Version control (Git History), Progress tracing (Frontend_Component_Mapping.xslx) and Info aggregation (Better README to be drafted)

---

# Folder Structure
```
/project-root
    ├── Code_To_Excel_Extraction.md     ← Use AI to sync Excel
    ├──Development_Log_History.md.md    ← Teamwork reference
  /docs
    ├── Backend_Business_Logic.md      ← This is the Design intent
    ├── Frontend_Component_Mapping.xlsx ← Using Code_To_Excel_Extraction.md to extract updates from code
    ├── Frontend_Coding_Standards.md    ← AI reads before coding
    └── Development_Log.md              ← Session handoff
  
  /frontend
    └── (React code with @component tags)
  
  /api
    └── (Express code)
  
  /database
    └── schema_export.sql
```
---
## Reminder

When you start a coding session with any AI, paste this at the beginning:

```
Read these files before coding:
- /docs/Backend_Business_Logic.md
- /docs/Frontend_Component_Mapping.xlsx  
- /docs/Frontend_Coding_Standards.md
- /docs/Development_Log.md

Follow the rules in Frontend_Coding_Standards.md exactly.
Write all proposed changes to Development_Log.md.
Do not modify Backend_Business_Logic.md or Frontend_Component_Mapping.xlsx directly.
```
From Development_Log
```
SESSION START
    ↓
Human: "Today we're building the vaccination page"
    ↓
AI: Reads Backend_Business_Logic.md, Frontend_Component_Mapping.xlsx
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
From D16.1
```
SESSION 1: Frontend Dev
├── AI reads: BLL.md, Excel
├── AI writes: React code (with tags)
├── AI writes: DEVLOG.md "Added U-GOAT-016, needs POST /api/goats"
└── Human: Verify, then confirm "update Excel"

SESSION 2: API Dev  
├── AI reads: BLL.md, DEVLOG.md (sees what frontend needs)
├── AI writes: Express code
├── AI writes: DEVLOG.md "Implemented POST /api/goats, needs farm.goat table"
└── Human: Verify, then confirm "update BLL if logic changed"

SESSION 3: Database
├── AI reads: DEVLOG.md (sees what API needs)
├── Human: Update pgAdmin
├── Export: schema_export.sql
└── Human: Move DEVLOG to LOG_HISTORY.md, clear DEVLOG
```


