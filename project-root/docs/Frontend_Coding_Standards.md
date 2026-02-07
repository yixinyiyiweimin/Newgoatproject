# Frontend Coding Standards

## Purpose

This document tells AI how to write frontend code so that:
1. Every UI component is tagged and traceable
2. Code can be parsed back into Excel automatically
3. Nothing gets lost between coding sessions

---

## Rule 1: Every Component Must Have a Tag Block

Place this comment block directly above every interactive UI component:

```jsx
/* @component
 * @id: U-GOAT-016
 * @label: Save Button
 * @path: /goats
 * @archetype: ACTION
 * @trigger: onClick
 * @api: POST /api/goats
 * @ur_id: 2.2.5
 * @notes: Validates form before submit
 */
const SaveGoatButton = () => {
  // component code here
};
```

---

## Rule 2: Tag Block Fields Explained

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| @id | Yes | {VIEW}-{PAGE}-{NUMBER} | `U-GOAT-016`, `A-VAX-003` |
| @label | Yes | Human readable name | `Save Button`, `Email Input Field` |
| @path | Yes | URL path | `/goats`, `/admin/vaccine-types` |
| @archetype | Yes | One of 4 types | `INPUT`, `ACTION`, `DISPLAY`, `CONTAINER` |
| @trigger | Yes | Event type | `onClick`, `onChange`, `onLoad`, `onSubmit` |
| @api | No | Express endpoint | `POST /api/goats`, `GET /api/goats` |
| @ur_id | No | Requirement reference | `2.2.5`, `2.1.3` |
| @links_to | No | Navigation target | `/goats/success`, `/dashboard` |
| @notes | No | Any extra info | `Required field`, `Multi-select` |

---

## Rule 3: Component ID Format

```
{VIEW}-{PAGE}-{NUMBER}

VIEW:
  U = User view
  A = Admin view
  S = Shared (like login)

PAGE (examples):
  LOGIN, FORGOT, DASH, GOAT, VAX, BREED, HEALTH, SLAUGH, FEEDPRICE, FEEDCALC, ROLES, UREG

NUMBER:
  Three digits, sequential: 001, 002, 003...
```

**Examples:**
- `S-LOGIN-001` → Shared Login page, first component
- `U-GOAT-016` → User Goat Management page, 16th component
- `A-VAX-003` → Admin Vaccine Type page, 3rd component

---

## Rule 4: Archetype Definitions

| Archetype | Purpose | Examples |
|-----------|---------|----------|
| **INPUT** | Collects data from user | Text field, dropdown, datepicker, file upload, checkbox, radio, toggle |
| **ACTION** | Triggers an event or navigation | Button, link |
| **DISPLAY** | Shows read-only information | Text, table, chart, alert message |
| **CONTAINER** | Wraps other components | Card, modal, tab panel |

---

## Rule 5: File Organization

```
/frontend
  /src
    /pages
      /login
        LoginPage.jsx        ← S-LOGIN-xxx components
      /admin
        /dashboard
          AdminDashboard.jsx ← A-DASH-xxx components
        /vaccine-types
          VaccineTypes.jsx   ← A-VAX-xxx components
      /user
        /dashboard
          Dashboard.jsx      ← U-DASH-xxx components
        /goats
          GoatManagement.jsx ← U-GOAT-xxx components
    /components
      /shared
        Button.jsx           ← Reusable, no @component tag needed
        Input.jsx            ← Reusable, no @component tag needed
```

**Note:** Only tag PAGE-LEVEL components that have specific business meaning. Reusable UI primitives (generic Button, Input) don't need tags.

---

## Rule 6: What AI Must NOT Do

1. **Never modify these files directly:**
   - `Frontend_Component_Mapping.xlsx`
   - `Backend_Business_Logic.md`

2. **Instead, write proposed changes to `Development_Log.md`:**
   ```markdown
   ## Proposed Excel Update
   - Add row: U-GOAT-019, Export PDF Button, /goats, ACTION, onClick, GET /api/goats/export
   
   ## Proposed Business Logic Update
   - New endpoint needed: GET /api/goats/export
   - Returns: CSV file of all goats
   ```

3. **Wait for human confirmation** before any master document update.

---

## Rule 7: When Adding a New Component

1. Check existing components in that page to find the next number
2. Create the tag block with all required fields
3. Write the component code
4. Add entry to `Development_Log.md` under "Proposed Excel Update"

**Example:**
```markdown
// Development_Log.md

## 2025-02-07 - Session: Goat Management Page

### New Components Added
| ID | Label | Path | Archetype | API |
|----|-------|------|-----------|-----|
| U-GOAT-019 | Export PDF Button | /goats | ACTION | GET /api/goats/export |

### Proposed Excel Update
Add above row to Frontend_Component_Mapping.xlsx

### Proposed Business Logic Update
New endpoint GET /api/goats/export not in current Backend_Business_Logic.md
Needs: Returns PDF/CSV of filtered goat list

### Status: WAITING FOR CONFIRMATION
```

---

## Rule 8: When Modifying an Existing Component

1. Find the component by its @id
2. Update the tag block if any field changes
3. Log the change in `Development_Log.md`

**Example:**
```markdown
## Modified Components
| ID | What Changed | Old Value | New Value |
|----|--------------|-----------|-----------|
| U-GOAT-016 | @api | POST /api/goats | POST /api/goats/register |
```

---

## Rule 9: When Deleting a Component

1. Remove the component code
2. Log in `Development_Log.md` with reason

**Example:**
```markdown
## Deleted Components
| ID | Label | Reason |
|----|-------|--------|
| U-GOAT-018 | Delete Row Button | Merged into U-GOAT-017 as dropdown option |
```

---

## Rule 10: Session Start Checklist

Before coding, AI should:

1. Read `Backend_Business_Logic.md` (understand what APIs exist)
2. Read `Frontend_Component_Mapping.xlsx` (understand what components exist)
3. Read `Development_Log.md` (understand pending work)
4. Ask human: "What are we working on today?"

---

## Rule 11: Session End Checklist

Before ending, AI should:

1. List all new/modified/deleted components in `Development_Log.md`
2. Note any proposed changes to Excel or Business Logic
3. Ask human: "Should I update the master documents?"
4. Only update after explicit confirmation

---

## Quick Reference: Tag Block Template

Copy this for new components:

```jsx
/* @component
 * @id: 
 * @label: 
 * @path: 
 * @archetype: 
 * @trigger: 
 * @api: 
 * @ur_id: 
 * @notes: 
 */
```
