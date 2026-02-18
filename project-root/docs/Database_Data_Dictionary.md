# Database Data Dictionary

## Purpose

This is the **source of truth for the database layer**. Coding AI must reference this file before writing any SQL query, INSERT, UPDATE, or SELECT statement.

- **Backend_Business_Logic.md** = source of truth for *what the API should do*
- **Frontend_Component_Mapping.csv** = source of truth for *what the UI shows*
- **Database_Data_Dictionary.md** = source of truth for *what the database actually contains*

If the BLL says one column name and this file says another, **this file wins** — it reflects the actual PostgreSQL schema.

**Last exported:** 2026-02-18 from PostgreSQL via pgAdmin (export_v1.txt query)

---

## How to Re-Export

Run the query in `database/export_v1.txt` in pgAdmin Query Tool, export result as CSV to `database/schema_export.csv`, then regenerate this document.

---

## CRITICAL: Known Discrepancies (BLL vs Actual DB)

These are places where the BLL document uses different names than what actually exists in PostgreSQL. **Coding AI must use the ACTUAL column names below, not the BLL names.**

| # | BLL Says | Actual DB Has | Impact |
|---|----------|---------------|--------|
| 1 | Table `admin_ref.goat_breed` with PK `goat_breed_id` | Table `admin_ref.breed_type` with PK `breed_id` | All queries referencing goat breed table must use `breed_type` and `breed_id` |
| 2 | `farm.vaccination.vaccinated_date` | `farm.vaccination.date_administered` | INSERT/SELECT vaccination must use `date_administered` |
| 3 | BLL Module 2C delete check: `SELECT 1 FROM farm.goat WHERE goat_breed_id = $1` | FK column is `goat_breed_id` but it references `breed_type.breed_id` | Query works but table name in BLL is wrong |
| 4 | `auth.user_account` has only auth fields in BLL | Actual table has extra columns: `address`, `company_name`, `company_reg_no`, `full_name`, `ic_number` | These overlap with `core.user_profile`. Decide: use profile table (BLL design) or account table (current DB)? |
| 5 | BLL says `farm.vaccination.vaccine_type_id` FK was "missing" (Gap #7) | FK **exists**: `vaccine_type_id -> vaccine_type.vaccine_type_id` | Gap #7 is resolved — no ALTER needed |
| 6 | BLL says `farm.goat.goat_breed_id` FK was "missing" (Gap #8) | FK **exists**: `goat_breed_id -> breed_type.breed_id` | Gap #8 is resolved — no ALTER needed |
| 7 | BLL says `farm.breeding_program.breeding_type_id` FK was "missing" (Gap #9) | FK **exists**: `breeding_type_id -> breeding_type.breeding_type_id` | Gap #9 is resolved — no ALTER needed |
| 8 | BLL says `farm.goat.premise_id` FK was "missing" (Gap #10) | FK **exists**: `premise_id -> premise.premise_id` | Gap #10 is resolved — no ALTER needed |

### Recommended Actions

- **Discrepancy #1 (breed table name)**: Either rename the table in pgAdmin OR update the BLL to use `breed_type` / `breed_id`. Since `farm.goat.goat_breed_id` FK already points to `breed_type.breed_id`, renaming is safer to avoid FK breakage.
- **Discrepancy #2 (vaccination date column)**: Either rename column in pgAdmin (`ALTER TABLE farm.vaccination RENAME COLUMN date_administered TO vaccinated_date;`) OR update BLL to use `date_administered`.
- **Discrepancy #4 (duplicate user fields)**: Decide on single source for user personal data. Recommendation: use `core.user_profile` as BLL intended, remove redundant columns from `auth.user_account` after confirming no code depends on them.

---

## Schema: auth (Authentication)

### auth.user_account

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **user_account_id** | integer | NOT NULL | auto-increment | **PK** |
| email | varchar(255) | NULL | — | **UNIQUE** |
| phone_number | varchar(20) | NULL | — | **UNIQUE** |
| password_hash | text | NOT NULL | — | |
| status | varchar(20) | NOT NULL | `'ACTIVE'` | Values: ACTIVE, INACTIVE |
| failed_login_attempts | integer | NULL | `0` | |
| last_login_at | timestamp | NULL | — | |
| created_at | timestamp | NULL | `now()` | |
| updated_at | timestamp | NULL | `now()` | |
| address | text | NULL | — | ⚠️ Overlaps with user_profile |
| company_name | varchar(255) | NULL | — | ⚠️ Overlaps with user_profile |
| company_reg_no | varchar(255) | NULL | — | ⚠️ Overlaps with user_profile |
| full_name | varchar(255) | NULL | — | ⚠️ Overlaps with user_profile |
| ic_number | varchar(20) | NULL | — | ⚠️ Overlaps with user_profile |

**Referenced by:** login_attempt, otp, user_profile, user_role, audit_log, notification, feed_calculation, feed_price_calculation

---

### auth.login_attempt

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **login_attempt_id** | integer | NOT NULL | auto-increment | **PK** |
| user_account_id | integer | NULL | — | **FK → auth.user_account** |
| login_identifier | varchar(255) | NULL | — | |
| status | varchar(20) | NOT NULL | — | Values: SUCCESS, FAILED |
| failure_reason | text | NULL | — | |
| ip_address | varchar(50) | NULL | — | |
| attempted_at | timestamp | NULL | `now()` | |

---

### auth.otp

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **otp_id** | integer | NOT NULL | auto-increment | **PK** |
| user_account_id | integer | NULL | — | **FK → auth.user_account** |
| otp_code | varchar(72) | NOT NULL | — | Stores bcrypt hash (not plain OTP) |
| purpose | varchar(50) | NULL | — | Values: PASSWORD_RESET |
| expires_at | timestamp | NOT NULL | — | |
| is_used | boolean | NULL | `false` | |
| created_at | timestamp | NULL | `now()` | |

---

## Schema: rbac (Role-Based Access Control)

### rbac.role

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **role_id** | integer | NOT NULL | auto-increment | **PK** |
| role_name | varchar(100) | NOT NULL | — | **UNIQUE** |
| is_system_role | boolean | NULL | `false` | |
| created_at | timestamp | NULL | `now()` | |

---

### rbac.permission

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **permission_id** | integer | NOT NULL | auto-increment | **PK** |
| module_name | varchar(100) | NOT NULL | — | |
| action | varchar(20) | NOT NULL | — | Values: view, create, update, delete |

---

### rbac.role_permission

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **role_id** | integer | NOT NULL | — | **PK**, **FK → rbac.role** |
| **permission_id** | integer | NOT NULL | — | **PK**, **FK → rbac.permission** |

**Composite PK:** (role_id, permission_id)

---

### rbac.user_role

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **user_account_id** | integer | NOT NULL | — | **PK**, **FK → auth.user_account** |
| **role_id** | integer | NOT NULL | — | **PK**, **FK → rbac.role** |
| assigned_at | timestamp | NULL | `now()` | |

**Composite PK:** (user_account_id, role_id)

---

## Schema: core (User Profiles & Premises)

### core.premise

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **premise_id** | integer | NOT NULL | auto-increment | **PK** |
| premise_code | varchar(100) | NOT NULL | — | **UNIQUE** |
| state | varchar(100) | NULL | — | |
| district | varchar(100) | NULL | — | |
| address | text | NULL | — | |
| status | varchar(20) | NULL | `'ACTIVE'` | |
| created_at | timestamp | NULL | `now()` | |

---

### core.user_profile

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **user_profile_id** | integer | NOT NULL | auto-increment | **PK** |
| user_account_id | integer | NULL | — | **UNIQUE**, **FK → auth.user_account** |
| user_type | varchar(20) | NOT NULL | — | Values: Individual, Company |
| full_name | varchar(255) | NULL | — | |
| company_name | varchar(255) | NULL | — | |
| ic_or_passport | varchar(50) | NOT NULL | — | **UNIQUE** |
| company_registration_no | varchar(100) | NULL | — | |
| address | text | NULL | — | |
| email | varchar(255) | NULL | — | |
| phone_number | varchar(20) | NULL | — | |
| premise_id | integer | NULL | — | **FK → core.premise** |
| created_at | timestamp | NULL | `now()` | |
| updated_at | timestamp | NULL | `now()` | |

---

### core.user_document

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **document_id** | integer | NOT NULL | auto-increment | **PK** |
| user_profile_id | integer | NULL | — | **FK → core.user_profile** |
| file_path | text | NOT NULL | — | |
| file_type | varchar(50) | NULL | — | |
| uploaded_at | timestamp | NULL | `now()` | |

---

## Schema: admin_ref (Admin Reference Data)

### admin_ref.breed_type

⚠️ **BLL calls this `goat_breed` with PK `goat_breed_id`** — actual table is `breed_type` with PK `breed_id`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **breed_id** | integer | NOT NULL | auto-increment | **PK** |
| name | varchar(100) | NOT NULL | — | **UNIQUE** |
| is_active | boolean | NULL | `true` | |
| created_at | timestamp | NULL | `now()` | |

**Referenced by:** farm.goat.goat_breed_id → breed_type.breed_id

---

### admin_ref.breeding_type

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **breeding_type_id** | integer | NOT NULL | auto-increment | **PK** |
| name | varchar(100) | NOT NULL | — | **UNIQUE** |
| is_active | boolean | NULL | `true` | |
| created_at | timestamp | NULL | `now()` | |

---

### admin_ref.vaccine_type

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **vaccine_type_id** | integer | NOT NULL | auto-increment | **PK** |
| name | varchar(100) | NOT NULL | — | **UNIQUE** |
| interval_days | integer | NOT NULL | — | |
| is_active | boolean | NULL | `true` | |
| created_at | timestamp | NULL | `now()` | |

---

## Schema: farm (Core Farm Operations)

### farm.goat

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **goat_id** | varchar(100) | NOT NULL | — | **PK** (string, not auto-increment) |
| premise_id | integer | NULL | — | **FK → core.premise** |
| rfid_tag_id | integer | NULL | — | **UNIQUE**, **FK → farm.rfid_tag** |
| sire_id | varchar(100) | NULL | — | **FK → farm.goat** (self-ref) |
| dam_id | varchar(100) | NULL | — | **FK → farm.goat** (self-ref) |
| goat_breed_id | integer | NULL | — | **FK → admin_ref.breed_type.breed_id** |
| gender | varchar(10) | NULL | — | Values: Male, Female |
| birth_date | date | NULL | — | |
| weight | numeric | NULL | — | |
| registered_at | timestamp | NULL | `now()` | |
| status | varchar(20) | NULL | `'ACTIVE'` | Values: ACTIVE, SLAUGHTERED, SOLD, DEAD |

---

### farm.rfid_tag

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **rfid_tag_id** | integer | NOT NULL | auto-increment | **PK** |
| tag_code | varchar(100) | NOT NULL | — | **UNIQUE** |
| is_active | boolean | NULL | `true` | |
| assigned_at | timestamp | NULL | — | |

---

### farm.goat_image

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **image_id** | integer | NOT NULL | auto-increment | **PK** |
| goat_id | varchar(100) | NULL | — | **FK → farm.goat** |
| image_path | text | NOT NULL | — | |
| uploaded_at | timestamp | NULL | `now()` | |

---

### farm.health_record

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **health_record_id** | integer | NOT NULL | auto-increment | **PK** |
| goat_id | varchar(100) | NULL | — | **FK → farm.goat** |
| health_status | varchar(100) | NULL | — | |
| treatment | text | NULL | — | |
| observation | text | NULL | — | |
| recorded_at | timestamp | NULL | `now()` | |

---

### farm.vaccination

⚠️ **BLL says `vaccinated_date`** — actual column is `date_administered`

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **vaccination_id** | integer | NOT NULL | auto-increment | **PK** |
| goat_id | varchar(100) | NULL | — | **FK → farm.goat** |
| vaccine_type_id | integer | NULL | — | **FK → admin_ref.vaccine_type** |
| date_administered | date | NULL | — | ⚠️ BLL calls this `vaccinated_date` |
| next_vaccinated_date | date | NULL | — | |
| recorded_at | timestamp | NULL | `now()` | |

---

### farm.slaughter

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **slaughter_id** | integer | NOT NULL | auto-increment | **PK** |
| goat_id | varchar(100) | NULL | — | **UNIQUE**, **FK → farm.goat** (one slaughter per goat) |
| weight | numeric | NULL | — | |
| sold_amount | numeric | NULL | — | |
| buyer_name | varchar(255) | NULL | — | |
| slaughter_cost | numeric | NULL | — | |
| slaughter_date | date | NULL | — | |
| recorded_at | timestamp | NULL | `now()` | |

---

### farm.breeding_program

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **breeding_program_id** | integer | NOT NULL | auto-increment | **PK** |
| sire_id | varchar(100) | NULL | — | **FK → farm.goat** |
| breeding_type_id | integer | NULL | — | **FK → admin_ref.breeding_type** |
| program_date | date | NULL | — | |
| pregnancy_check_date | date | NULL | — | Auto-calc: program_date + 30 days |
| expected_birth_date | date | NULL | — | Auto-calc: program_date + 150 days |
| created_at | timestamp | NULL | `now()` | |

---

### farm.breeding_dam

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **breeding_dam_id** | integer | NOT NULL | auto-increment | **PK** |
| breeding_program_id | integer | NULL | — | **FK → farm.breeding_program** |
| dam_id | varchar(100) | NULL | — | **FK → farm.goat** |

---

### farm.birth_certificate

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **certificate_id** | integer | NOT NULL | auto-increment | **PK** |
| breeding_program_id | integer | NULL | — | **FK → farm.breeding_program** |
| offspring_goat_id | varchar(100) | NULL | — | **FK → farm.goat** |
| birth_date | date | NULL | — | |
| generated_at | timestamp | NULL | `now()` | |

---

## Schema: calc (Calculators)

### calc.feed_price_calculation

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **calculation_id** | integer | NOT NULL | auto-increment | **PK** |
| user_account_id | integer | NULL | — | **FK → auth.user_account** |
| number_of_goats | integer | NULL | — | |
| food_per_goat_grams | numeric | NULL | — | |
| price_per_kg | numeric | NULL | — | |
| total_months | integer | NULL | — | |
| total_cost | numeric | NULL | — | |
| created_at | timestamp | NULL | `now()` | |

---

### calc.feed_calculation

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **feed_calc_id** | integer | NOT NULL | auto-increment | **PK** |
| user_account_id | integer | NULL | — | **FK → auth.user_account** |
| number_of_goats | integer | NULL | — | |
| avg_goat_weight | numeric | NULL | — | |
| stage | varchar(50) | NULL | — | Values: Pembesaran, Maintenance, Pembiakan, Menyusu |
| hay_usage | boolean | NULL | — | |
| dmi | numeric | NULL | — | |
| fresh_fodder | numeric | NULL | — | |
| hay | numeric | NULL | — | |
| concentrate | numeric | NULL | — | |
| created_at | timestamp | NULL | `now()` | |

---

## Schema: audit

### audit.audit_log

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **audit_log_id** | integer | NOT NULL | auto-increment | **PK** |
| actor_user_id | integer | NULL | — | **FK → auth.user_account** |
| action | varchar(50) | NULL | — | Values: CREATE, UPDATE, DELETE, PASSWORD_RESET |
| entity_name | varchar(100) | NULL | — | |
| entity_id | varchar(100) | NULL | — | |
| old_value | jsonb | NULL | — | |
| new_value | jsonb | NULL | — | |
| created_at | timestamp | NULL | `now()` | ⚠️ BLL references `timestamp` — actual is `created_at` |

---

## Schema: notify

### notify.notification

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| **notification_id** | integer | NOT NULL | auto-increment | **PK** |
| user_account_id | integer | NULL | — | **FK → auth.user_account** |
| channel | varchar(20) | NULL | — | Values: EMAIL, SMS |
| message_type | varchar(50) | NULL | — | Values: OTP, CREDENTIAL |
| status | varchar(20) | NULL | — | Values: PENDING, SENT, FAILED |
| sent_at | timestamp | NULL | `now()` | |

---

## Schema: public (Legacy/Hardware — DO NOT USE in Express API)

### public.sensor_data

**Owner:** Hardware team (RFID readers via Node-RED/MQTT)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| **id** | integer | NOT NULL | auto-increment |
| rfid | varchar(100) | NULL | — |
| createdt | timestamp | NULL | — |
| deviceid | varchar(100) | NULL | — |

### public.goat_test

**Purpose:** Early development test table. Not for production use.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| **goat_test_id** | varchar(20) | NOT NULL | — |
| gender_test / birth_date_test / weight_test / etc. | various | NULL | — |

---

## Foreign Key Map (Complete)

```
auth.user_account (PK: user_account_id)
  ├── auth.login_attempt.user_account_id
  ├── auth.otp.user_account_id
  ├── core.user_profile.user_account_id (UNIQUE — 1:1)
  ├── rbac.user_role.user_account_id
  ├── audit.audit_log.actor_user_id
  ├── notify.notification.user_account_id
  ├── calc.feed_calculation.user_account_id
  └── calc.feed_price_calculation.user_account_id

core.premise (PK: premise_id)
  ├── core.user_profile.premise_id
  └── farm.goat.premise_id

admin_ref.breed_type (PK: breed_id)
  └── farm.goat.goat_breed_id

admin_ref.breeding_type (PK: breeding_type_id)
  └── farm.breeding_program.breeding_type_id

admin_ref.vaccine_type (PK: vaccine_type_id)
  └── farm.vaccination.vaccine_type_id

farm.goat (PK: goat_id — varchar, NOT integer)
  ├── farm.goat.sire_id (self-ref)
  ├── farm.goat.dam_id (self-ref)
  ├── farm.goat_image.goat_id
  ├── farm.health_record.goat_id
  ├── farm.vaccination.goat_id
  ├── farm.slaughter.goat_id (UNIQUE — one slaughter per goat)
  ├── farm.breeding_program.sire_id
  ├── farm.breeding_dam.dam_id
  └── farm.birth_certificate.offspring_goat_id

farm.rfid_tag (PK: rfid_tag_id)
  └── farm.goat.rfid_tag_id (UNIQUE — one tag per goat)

farm.breeding_program (PK: breeding_program_id)
  ├── farm.breeding_dam.breeding_program_id
  └── farm.birth_certificate.breeding_program_id

rbac.role (PK: role_id)
  ├── rbac.user_role.role_id
  └── rbac.role_permission.role_id

rbac.permission (PK: permission_id)
  └── rbac.role_permission.permission_id

core.user_profile (PK: user_profile_id)
  └── core.user_document.user_profile_id
```

---

## Data Standards

### Status Values (UPPERCASE everywhere)
- `ACTIVE` — operational
- `INACTIVE` — deactivated / soft-deleted
- `SLAUGHTERED` — goat slaughtered (farm.goat only)

### String IDs vs Integer IDs
- `farm.goat.goat_id` = **varchar(100)** — user-defined like "G001"
- All other PKs = **integer** with auto-increment sequences

### Timestamps
- All `created_at` / `recorded_at` columns default to `now()`
- Type: `timestamp without time zone`

---

## Update Procedure

When the database schema changes:

1. Make the change in pgAdmin
2. Re-run the export query (`database/export_v1.txt`)
3. Export result to `database/schema_export.csv`
4. Update this document to match
5. Commit both the CSV export and this updated document

**Rule: Never let coding AI write SQL without checking this file first.**
