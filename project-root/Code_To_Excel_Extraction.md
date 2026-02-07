# Code to Excel Extraction Prompt

## Purpose

Use this prompt to regenerate `Frontend_Component_Mapping.xlsx` from the codebase. This ensures Excel stays in sync with actual code after development.

---

## When to Use

- After a coding sprint (multiple components added/changed)
- When you suspect Excel has drifted from code
- During code review / audit
- Before handoff to another developer

---

## The Extraction Prompt

Copy and paste this to AI:

```
TASK: Extract all @component tags from the frontend codebase and output as Excel-compatible data.

SCAN: All .jsx, .tsx, .js, .ts files in /frontend/src

LOOK FOR: Comment blocks starting with /* @component

EXTRACT THESE FIELDS (in order):
1. ur_id (from @ur_id, empty if not found)
2. id (from @id, REQUIRED)
3. label (from @label, REQUIRED)
4. path (from @path, REQUIRED)
5. archetype (from @archetype, REQUIRED)
6. links_to (from @links_to, empty if not found)
7. trigger (from @trigger, REQUIRED)
8. api_endpoint (from @api, empty if not found)
9. db_tables (leave empty - will be filled from Business Logic doc)
10. notes (from @notes, empty if not found)

OUTPUT FORMAT:
Tab-separated values (TSV) that can be pasted into Excel.

ALSO REPORT:
1. Components found in code but NOT in current Excel (NEW)
2. Components in Excel but NOT found in code (DELETED or MISSING TAG)
3. Components with field mismatches (MODIFIED)

EXAMPLE OUTPUT:

=== EXTRACTED COMPONENTS (199 total) ===

UR_ID	Comp_ID	Label	Path	Archetype	Links_To	Trigger	API_Endpoint	DB_Tables	Notes
2.2.5	U-GOAT-016	Save Button	/goats	ACTION		onClick	POST /api/goats		
2.2.5	U-GOAT-017	Edit Row Button	/goats	ACTION		onClick	PATCH /api/goats/:id		Permission-based
...

=== DISCREPANCIES ===

NEW (in code, not in Excel):
- U-GOAT-020: Export CSV Button (added during sprint)

MISSING (in Excel, not in code):
- U-GOAT-018: May have been deleted or tag removed

MODIFIED (field differences):
- U-GOAT-016: api changed from "POST /api/goats" to "POST /api/goats/register"

=== RECOMMENDED ACTIONS ===

1. Add U-GOAT-020 to Excel
2. Verify U-GOAT-018 deletion was intentional
3. Update U-GOAT-016 api field in Excel
```

---

## How to Use the Output

1. **Copy the TSV data** → Paste into Excel (it will auto-fill columns)
2. **Review discrepancies** → Decide what to do with each
3. **Update master Excel** → Only after human review

---

## Verification Checklist

After extraction, verify:

- [ ] Total component count matches expectation
- [ ] No duplicate @id values
- [ ] All required fields are present
- [ ] Paths match actual URL structure
- [ ] API endpoints match Backend_Business_Logic.md

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Component missing | No @component tag | Add tag to code |
| Wrong data | Tag has typo | Fix tag in code |
| Duplicate ID | Copy-paste error | Assign unique ID |
| Empty required field | Incomplete tag | Fill in code |

---

## Alternative: Manual Spot Check

If full extraction is too heavy, do a spot check:

```
TASK: List all @component @id values found in /frontend/src/pages/goats/

OUTPUT: Just the IDs, one per line

COMPARE: Against Excel rows where Path = "/goats"

REPORT: Any mismatches
```

---

## Automation Note

This process is manual (AI reads code, outputs data). For a fully automated pipeline, you would need:

1. A script that parses JSDoc-style comments
2. A script that writes to .xlsx files
3. A CI/CD hook that runs on every commit

For now, manual extraction with AI works well for a 3-person team.
