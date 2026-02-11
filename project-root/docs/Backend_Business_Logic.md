## PART 3: BUSINESS LOGIC BY MODULE

Each section follows this format:

- **URS Reference**: Section number from URS V1.2
- **What the frontend sends**: The request shape
- **What Express does**: The business logic (validation, computation, multi-step)
- **Database queries**: The SQL queries Express runs via the `pg` library
- **What the frontend receives**: The response shape
- **Gaps/Decisions**: Things not covered by your current DB or URS

---

### MODULE 1: AUTHENTICATION (URS 2.1.1 + 2.2.1)

#### 1A. Login

**Express Endpoint:** `POST /api/auth/login`

**Frontend sends:**

```json
{
  "identifier": "farmer1@email.com",   // email OR phone
  "password": "MyP@ssw0rd"
}
```

**Express business logic (step by step):**

```
1. VALIDATE input
   - identifier is required, non-empty
   - password is required, non-empty

2. FIND user account
   → SELECT user_account_id, email, phone_number, password_hash, status, failed_login_attempts
     FROM auth.user_account
     WHERE email = $1 OR phone_number = $1
   -- params: [identifier]
   
3. CHECK account exists
   - If not found → return 401 "Invalid credentials"
   - Log failed attempt:
     → INSERT INTO auth.login_attempt (user_account_id, login_identifier, status, failure_reason, ip_address)
       VALUES ($1, $2, 'FAILED', 'User not found', $3)

4. CHECK account status
   - If status != 'ACTIVE' → return 403 "Account is inactive"

5. CHECK failed attempts
   - If failed_login_attempts >= 5 → return 423 "Account locked. Contact admin."

6. VERIFY password
   - bcrypt.compare(password, stored password_hash)
   - If mismatch:
     → UPDATE auth.user_account SET failed_login_attempts = failed_login_attempts + 1 WHERE user_account_id = $1
     → INSERT INTO auth.login_attempt (user_account_id, login_identifier, status, failure_reason, ip_address)
       VALUES ($1, $2, 'FAILED', 'Invalid password', $3)
     → return 401 "Invalid credentials"

7. SUCCESS — Reset failed attempts & update last login
   → UPDATE auth.user_account SET failed_login_attempts = 0, last_login_at = NOW() WHERE user_account_id = $1
   → INSERT INTO auth.login_attempt (user_account_id, login_identifier, status, ip_address)
     VALUES ($1, $2, 'SUCCESS', $3)

8. FETCH user role & permissions
   → SELECT ur.role_id, r.role_name
     FROM rbac.user_role ur
     JOIN rbac.role r ON r.role_id = ur.role_id
     WHERE ur.user_account_id = $1
   -- params: [user_account_id]

   → SELECT p.module_name, p.action
     FROM rbac.role_permission rp
     JOIN rbac.permission p ON p.permission_id = rp.permission_id
     WHERE rp.role_id = $1
   -- params: [role_id]

9. FETCH user profile
   → SELECT * FROM core.user_profile WHERE user_account_id = $1
   -- params: [user_account_id]

10. GENERATE JWT token containing:
    { user_account_id, email, role_id, role_name, permissions: [...] }
    Sign with secret, expiry 24h

11. RETURN response
```

**Frontend receives:**

```json
{
  "token": "eyJhbG...",
  "user": {
    "user_account_id": 1,
    "email": "farmer1@email.com",
    "full_name": "Ahmad",
    "role": "Farm Owner",
    "permissions": [
      { "module": "goat", "actions": ["view", "create", "update", "delete"] },
      { "module": "vaccination", "actions": ["view", "create"] }
    ]
  }
}
```

**NPM packages needed:** `bcryptjs`, `jsonwebtoken`

---

#### 1B. Forgot Password — Request OTP

**Express Endpoint:** `POST /api/auth/forgot-password`

**Frontend sends:**

```json
{ "email": "farmer1@email.com" }
```

**Express business logic:**

```
1. FIND user
   → SELECT user_account_id, email FROM auth.user_account WHERE email = $1
   -- params: [email]
   - If not found → return 200 (don't reveal if email exists — security best practice)

2. GENERATE OTP
   - 6-digit random number
   - Expiry = now + 10 minutes

3. STORE OTP
   → INSERT INTO auth.otp (user_account_id, otp_code, purpose, expires_at)
     VALUES ($1, $2, 'PASSWORD_RESET', $3)
   -- params: [user_account_id, hashedOTP, expiresAt]

4. SEND OTP via email (or SMS if phone only)
   → INSERT INTO notify.notification (user_account_id, channel, message_type, status)
     VALUES ($1, 'EMAIL', 'OTP', 'PENDING')
   - Actual email sending: use nodemailer or a service like SendGrid/AWS SES
   
5. RETURN { message: "If email exists, OTP has been sent" }
```

**NPM packages needed:** `nodemailer` (or SendGrid SDK)

---

#### 1C. Forgot Password — Verify OTP & Reset

**Express Endpoint:** `POST /api/auth/reset-password`

**Frontend sends:**

```json
{
  "email": "farmer1@email.com",
  "otp": "482913",
  "new_password": "NewP@ss123"
}
```

**Express business logic:**

```
1. FIND user by email
   → SELECT user_account_id FROM auth.user_account WHERE email = $1
   -- params: [email]

2. FIND latest unused OTP for this user
   → SELECT otp_id, otp_code, expires_at FROM auth.otp
     WHERE user_account_id = $1 AND purpose = 'PASSWORD_RESET' AND is_used = false
     ORDER BY created_at DESC LIMIT 1
   -- params: [user_account_id]

3. VALIDATE OTP
   - Check otp matches (bcrypt.compare or plain compare depending on storage)
   - Check expires_at > now()
   - If invalid → return 400 "Invalid or expired OTP"

4. VALIDATE new password strength
   - Min 8 chars, uppercase, lowercase, number, special char
   - If weak → return 400 with specific message

5. HASH new password → bcrypt.hash(new_password, 12)

6. UPDATE password
   → UPDATE auth.user_account SET password_hash = $1, failed_login_attempts = 0 WHERE user_account_id = $2
   -- params: [hashedPassword, user_account_id]

7. MARK OTP as used
   → UPDATE auth.otp SET is_used = true WHERE otp_id = $1
   -- params: [otp_id]

8. LOG audit
   → INSERT INTO audit.audit_log (actor_user_id, action, entity_name, entity_id)
     VALUES ($1, 'PASSWORD_RESET', 'user_account', $2)
   -- params: [user_account_id, user_account_id]

9. RETURN { message: "Password reset successful" }
```

---

#### 1D. Auth Middleware (Applied to ALL protected routes)

```
Every request to /api/* (except /api/auth/login and /api/auth/forgot-password):

1. Extract token from header: Authorization: Bearer <token>
2. Verify JWT signature and expiry
3. Decode payload → { user_account_id, role_id, permissions }
4. Attach to request: req.user = decoded
5. If invalid/expired → return 401 "Unauthorized"
```

#### 1E. Permission Middleware (Applied per route)

```
checkPermission('goat', 'create') middleware:

1. Read req.user.permissions
2. Find entry where module_name == 'goat' AND action == 'create'
3. If not found → return 403 "Insufficient permissions"
4. If found → next()
```

---

### MODULE 2: ADMIN REFERENCE DATA (URS 2.1.3, 2.1.4, 2.1.5)

These three modules (Vaccine Type, Breeding Type, Goat Breed) follow the identical pattern. I'll show Vaccine Type in full, then note the differences.

#### 2A. Vaccine Type — CRUD

**Express Endpoints:**

```
GET    /api/admin/vaccine-types          → List all (active only by default)
POST   /api/admin/vaccine-types          → Create
PATCH  /api/admin/vaccine-types/:id      → Update
DELETE /api/admin/vaccine-types/:id      → Soft-delete (set is_active=false)
```

**Create — `POST /api/admin/vaccine-types`**

Frontend sends:

```json
{ "name": "CD&T", "interval_days": 180 }
```

Express logic:

```
1. AUTH: Verify JWT
2. PERMISSION: checkPermission('vaccine_type', 'create')
3. VALIDATE:
   - name: required, string, max 100 chars, trimmed
   - interval_days: required, integer, > 0
4. CHECK DUPLICATE name
   → SELECT vaccine_type_id FROM admin_ref.vaccine_type WHERE name = $1
   -- params: [name]
   - If exists → return 409 "Vaccine type name already exists"
5. CREATE
   → INSERT INTO admin_ref.vaccine_type (name, interval_days, is_active) VALUES ($1, $2, true) RETURNING *
   -- params: [name, interval_days]
6. AUDIT LOG
   → INSERT INTO audit.audit_log (actor_user_id, action, entity_name, entity_id, new_value)
     VALUES ($1, 'CREATE', 'vaccine_type', $2, $3)
   -- params: [req.user.user_account_id, new_id, JSON.stringify({ name, interval_days })]
7. RETURN created record
```

**Delete — `DELETE /api/admin/vaccine-types/:id`**

Express logic:

```
1. AUTH + PERMISSION check
2. CHECK if in use
   → SELECT 1 FROM farm.vaccination WHERE vaccine_type_id = $1 LIMIT 1
   -- params: [id]
   - If records exist → return 409 "Cannot delete: vaccine type is used in vaccination records"
3. SOFT DELETE (set inactive, don't actually delete)
   → UPDATE admin_ref.vaccine_type SET is_active = false WHERE vaccine_type_id = $1
   -- params: [id]
4. AUDIT LOG
5. RETURN 200 { message: "Vaccine type deactivated" }
```

**List — `GET /api/admin/vaccine-types?search=&active_only=true`**

Express logic:

```
1. AUTH + PERMISSION('vaccine_type', 'view')
2. BUILD SQL query:
   → SELECT * FROM admin_ref.vaccine_type WHERE is_active = true ORDER BY name ASC
   - If search param: add AND name ILIKE $1  -- params: ['%search%']
   - If active_only=false: remove is_active filter
3. RETURN array
```

#### 2B. Breeding Type — Same pattern as Vaccine Type

Differences:

- No `interval_days` field (only `name`)
- Check-in-use query: `SELECT 1 FROM farm.breeding_program WHERE breeding_type_id = $1 LIMIT 1`
- Database table: `admin_ref.breeding_type`

#### 2C. Goat Breed — Same pattern as Vaccine Type

Differences:

- No `interval_days` field (only `name`)
- Check-in-use query: `SELECT 1 FROM farm.goat WHERE goat_breed_id = $1 LIMIT 1`
- Database table: `admin_ref.goat_breed`

---

### MODULE 3: USER REGISTRATION (URS 2.1.6)

#### 3A. Register User (Admin creates user for User Web App)

**Express Endpoint:** `POST /api/admin/users`

**Frontend sends:**

```json
{
  "user_type": "Individual",
  "full_name": "Ahmad bin Ali",
  "ic_or_passport": "900101-01-1234",
  "address": "Kg Baru, Selangor",
  "phone_number": "+60123456789",
  "email": "ahmad@email.com",
  "premise_code": "P001",
  "premise_state": "Selangor",
  "premise_district": "Hulu Langat",
  "premise_address": "Kg Baru",
  "documents": []           // file upload handled separately (multipart)
}
```

For Company, additional fields: `company_name`, `company_registration_no`, `person_in_charge`

**Express business logic (multi-step transaction):**

```
1. AUTH + PERMISSION('user_registration', 'create')

2. VALIDATE all fields
   - user_type must be 'Individual' or 'Company'
   - If Individual: full_name, ic_or_passport required
   - If Company: company_name, company_registration_no required
   - email format validation (regex)
   - phone format validation (Malaysian format)
   - premise_code required

3. CHECK DUPLICATES
   → SELECT 1 FROM auth.user_account WHERE email = $1  -- (email unique check)
   → SELECT 1 FROM auth.user_account WHERE phone_number = $1  -- (phone unique check)
   → SELECT 1 FROM core.user_profile WHERE ic_or_passport = $1  -- (IC unique check)
   → SELECT 1 FROM core.premise WHERE premise_code = $1  -- (premise duplicate check)
   - If any exist → return 409 with specific message

4. GENERATE temporary password
   - crypto.randomBytes(8).toString('hex') → e.g., "a3f8b2c1"
   - Hash it: bcrypt.hash(tempPassword, 12)

--- BEGIN TRANSACTION (all steps 5-11 use the same db client) ---

5. CREATE user_account
   → INSERT INTO auth.user_account (email, phone_number, password_hash, status)
     VALUES ($1, $2, $3, 'ACTIVE') RETURNING user_account_id
   -- params: [email, phone_number, hashedPassword]

6. CREATE premise
   → INSERT INTO core.premise (premise_code, state, district, address, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING premise_id
   -- params: [premise_code, premise_state, premise_district, premise_address]

7. CREATE user_profile
   → INSERT INTO core.user_profile (user_account_id, user_type, full_name, company_name, ic_or_passport, company_registration_no, address, email, phone_number, premise_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING user_profile_id
   -- params: [user_account_id, user_type, full_name, company_name, ic_or_passport, company_registration_no, address, email, phone_number, premise_id]

8. UPLOAD documents (if any)
   - Save files to storage (local disk or S3)
   - For each file:
     → INSERT INTO core.user_document (user_profile_id, file_path, file_type)
       VALUES ($1, $2, $3)

9. ASSIGN default role
   → INSERT INTO rbac.user_role (user_account_id, role_id)
     VALUES ($1, $2)
   -- params: [user_account_id, default_farmer_role_id]

10. SEND credentials
    - If email exists: send email with { email, tempPassword }
    - If phone exists: send SMS with { phone, tempPassword }
    → INSERT INTO notify.notification (user_account_id, channel, message_type, status)
      VALUES ($1, $2, $3, 'SENT')

11. AUDIT LOG
    → INSERT INTO audit.audit_log (actor_user_id, action, entity_name, entity_id, new_value)
      VALUES ($1, 'CREATE', 'user_registration', $2, $3)

--- COMMIT TRANSACTION ---
--- On any error: ROLLBACK (all steps 5-11 are undone automatically) ---

12. RETURN { user_account_id, email, premise_code, message: "User created. Credentials sent." }
```

**NOTE: Transaction advantage** — With direct PostgreSQL connection via `pg`, steps 5-11 are wrapped in a single transaction (BEGIN/COMMIT/ROLLBACK). If any step fails, everything rolls back cleanly. No orphaned records.

**NPM packages needed:** `multer` (file uploads), `crypto` (temp password)

---

### MODULE 4: USER & ROLES — RBAC (URS 2.1.7 + 2.2.4)

#### 4A. Create Role

**Express Endpoint:** `POST /api/admin/roles`

**Frontend sends:**

```json
{
  "role_name": "Farm Supervisor",
  "permissions": [
    { "module_name": "goat", "actions": ["view", "create", "update"] },
    { "module_name": "vaccination", "actions": ["view", "create"] },
    { "module_name": "slaughter", "actions": ["view"] }
  ]
}
```

**Express logic:**

```
1. AUTH + PERMISSION('role', 'create')
2. CHECK duplicate:
   → SELECT 1 FROM rbac.role WHERE role_name = $1
   -- params: [role_name]
3. CREATE role:
   → INSERT INTO rbac.role (role_name, is_system_role) VALUES ($1, false) RETURNING role_id
4. For each module+action combo, find or create permission:
   → SELECT permission_id FROM rbac.permission WHERE module_name = $1 AND action = $2
   → If not exists: INSERT INTO rbac.permission (module_name, action) VALUES ($1, $2) RETURNING permission_id
5. Link permissions to role:
   → INSERT INTO rbac.role_permission (role_id, permission_id) VALUES ($1, $2)  -- (for each)
6. AUDIT LOG
7. RETURN role with permissions
```

#### 4B. Delete Role

```
1. CHECK if system role → if is_system_role=true → return 403 "Cannot delete system role"
2. CHECK if assigned:
   → SELECT 1 FROM rbac.user_role WHERE role_id = $1 LIMIT 1
   → If assigned → return 409 "Role is assigned to users. Reassign first."
3. DELETE role_permissions:
   → DELETE FROM rbac.role_permission WHERE role_id = $1
4. DELETE role:
   → DELETE FROM rbac.role WHERE role_id = $1
5. AUDIT LOG
```

#### 4C. Delete User (Soft Delete)

```
1. CHECK if Super Admin → block
2. UPDATE auth.user_account SET status = 'INACTIVE' WHERE user_account_id = $1
3. AUDIT LOG with old_value: { status: 'ACTIVE' }, new_value: { status: 'INACTIVE' }
```

#### Permission Module Names (Seed Data)

```
Modules: goat, vaccination, health_record, breeding_program, slaughter,
         feed_price_calculator, feed_calculator, vaccine_type, breeding_type,
         goat_breed, user_registration, user_role, dashboard, rfid_scan

Actions: view, create, update, delete
```

---

### MODULE 5: GOAT MANAGEMENT (URS 2.2.5)

#### 5A. Register Goat

**Express Endpoint:** `POST /api/goats`

**Frontend sends:**

```json
{
  "goat_id": "G005",
  "gender": "Female",
  "birth_date": "2024-06-15",
  "weight": 28.5,
  "goat_breed_id": 1,
  "sire_id": "G001",
  "dam_id": "G002",
  "rfid_tag_code": "RFID-0005"
}
```

Image uploaded separately via `POST /api/goats/:id/image` (multipart)

**Express logic:**

```
1. AUTH + PERMISSION('goat', 'create')

2. VALIDATE
   - goat_id: required, string, max 100
   - gender: required, must be 'Male' or 'Female'
   - birth_date: required, valid date, not in future
   - weight: required, number > 0
   - goat_breed_id: required, integer

3. CHECK goat_id unique
   → SELECT 1 FROM farm.goat WHERE goat_id = $1
   -- params: [goat_id]
   - If exists → 409 "Goat ID already registered"

4. CHECK breed exists & is active
   → SELECT 1 FROM admin_ref.goat_breed WHERE goat_breed_id = $1 AND is_active = true
   -- params: [goat_breed_id]
   - If not found → 400 "Invalid or inactive breed"

5. CHECK sire/dam exist (if provided)
   → SELECT gender FROM farm.goat WHERE goat_id = $1  -- verify exists & gender = 'Male'
   → SELECT gender FROM farm.goat WHERE goat_id = $1  -- verify exists & gender = 'Female'
   - If sire not male → 400 "Sire must be male"
   - If dam not female → 400 "Dam must be female"

6. HANDLE RFID tag
   → SELECT rfid_tag_id, is_active FROM farm.rfid_tag WHERE tag_code = $1
   -- params: [rfid_tag_code]
   - If not exists:
     → INSERT INTO farm.rfid_tag (tag_code, is_active, assigned_at) VALUES ($1, true, NOW()) RETURNING rfid_tag_id
   - If exists & is_active: check not already assigned to another goat
   - Get rfid_tag_id

7. GET premise_id from logged-in user's profile
   → SELECT premise_id FROM core.user_profile WHERE user_account_id = $1
   -- params: [req.user.user_account_id]

8. CREATE goat
   → INSERT INTO farm.goat (goat_id, premise_id, rfid_tag_id, sire_id, dam_id, goat_breed_id, gender, birth_date, weight, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE') RETURNING *
   -- params: [goat_id, premise_id, rfid_tag_id, sire_id, dam_id, goat_breed_id, gender, birth_date, weight]

9. AUDIT LOG

10. RETURN created goat record
```

#### 5B. List Goats

**Express Endpoint:** `GET /api/goats?gender=Female&breed_id=1&search=G00`

**Express logic:**

```
1. AUTH + PERMISSION('goat', 'view')
2. GET user's premise_id (scope goats to their farm)
3. BUILD SQL query:
   → SELECT g.*, gb.name AS breed_name
     FROM farm.goat g
     LEFT JOIN admin_ref.goat_breed gb ON gb.goat_breed_id = g.goat_breed_id
     WHERE g.premise_id = $1 AND g.status = 'ACTIVE'
     ORDER BY g.registered_at DESC
   - Add filters dynamically: AND g.gender = $2, AND g.goat_breed_id = $3, etc.
   - Add search: AND g.goat_id ILIKE $N  -- params: ['%search%']
4. ENRICH response:
   - For each goat, compute age from birth_date:
     - < 31 days → "X days"
     - 31-364 days → "X months"  
     - >= 365 days → "X years"
5. RETURN enriched array
```

#### 5C. RFID Scan (URS 2.2.3)

**Express Endpoint:** `GET /api/rfid/scan/:tag_code`

**Express logic:**

```
1. AUTH + PERMISSION('rfid_scan', 'view')

2. FIND RFID tag
   → SELECT rfid_tag_id FROM farm.rfid_tag WHERE tag_code = $1 AND is_active = true
   -- params: [tag_code]
   - If not found → 404 "Unknown RFID tag"

3. FIND goat by rfid_tag_id
   → SELECT * FROM farm.goat WHERE rfid_tag_id = $1
   -- params: [rfid_tag_id]
   - If not found → 404 "No goat assigned to this tag"

4. FETCH related data (parallel):
   → SELECT name FROM admin_ref.goat_breed WHERE goat_breed_id = $1
   → SELECT health_status FROM farm.health_record WHERE goat_id = $1 ORDER BY recorded_at DESC LIMIT 1
   → SELECT v.vaccinated_date, v.next_vaccinated_date, vt.name AS vaccine_type_name
     FROM farm.vaccination v
     JOIN admin_ref.vaccine_type vt ON vt.vaccine_type_id = v.vaccine_type_id
     WHERE v.goat_id = $1
     ORDER BY v.vaccinated_date DESC LIMIT 1

5. COMPUTE age (dynamic from birth_date, per URS display rules)

6. ASSEMBLE response:
   {
     goat_id, gender, breed_name, age_display,
     weight, registered_at, birth_date,
     health_status (from latest health_record),
     sire_id, dam_id,
     vaccine_type_name, vaccinated_date, next_vaccinated_date
   }

7. RETURN — target < 2 seconds (URS performance requirement)
```

---

### MODULE 6: SLAUGHTER (URS 2.2.6)

**Express Endpoint:** `POST /api/slaughter`

**Frontend sends:**

```json
{
  "goat_id": "G004",
  "weight": 35.0,
  "sold_amount": 900.00,
  "buyer_name": "Local Market",
  "slaughter_cost": 120.00,
  "slaughter_date": "2024-05-01"
}
```

**Express logic:**

```
1. AUTH + PERMISSION('slaughter', 'create')

2. VALIDATE inputs
   - goat_id: required, exists in farm.goat
   - weight, sold_amount, slaughter_cost: required, number >= 0
   - buyer_name: required, string
   - slaughter_date: required, valid date

3. CHECK goat exists & is ACTIVE
   → SELECT 1 FROM farm.goat WHERE goat_id = $1 AND status = 'ACTIVE'
   -- params: [goat_id]
   - If not found → 400 "Goat not found or already inactive"

--- BEGIN TRANSACTION ---

4. CREATE slaughter record
   → INSERT INTO farm.slaughter (goat_id, weight, sold_amount, buyer_name, slaughter_cost, slaughter_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *

5. UPDATE goat status to SLAUGHTERED
   → UPDATE farm.goat SET status = 'SLAUGHTERED' WHERE goat_id = $1

6. AUDIT LOG

--- COMMIT ---

7. RETURN created record
```

**GAP NOTE:** The URS mentions "Gender" and "Register Time" in slaughter — Gender comes from the goat record (join), Register Time = recorded_at (auto). These don't need to be sent by frontend; Express fetches them.

---

### MODULE 7: HEALTH TRACKER (URS 2.2.7)

**Express Endpoint:** `POST /api/health-records`

**Frontend sends:**

```json
{
  "goat_id": "G001",
  "health_status": "Mild Fever",
  "treatment": "Antibiotics - Oxytetracycline 10mg",
  "observation": "Reduced appetite, slightly elevated temperature"
}
```

**Express logic:**

```
1. AUTH + PERMISSION('health_record', 'create')

2. VALIDATE
   - goat_id: required, exists, active
   - health_status: required, non-empty
   - treatment: optional text
   - observation: optional text

3. VERIFY goat exists
   → SELECT 1 FROM farm.goat WHERE goat_id = $1 AND status = 'ACTIVE'
   -- params: [goat_id]

4. CREATE record
   → INSERT INTO farm.health_record (goat_id, health_status, treatment, observation)
     VALUES ($1, $2, $3, $4) RETURNING *

5. AUDIT LOG

6. RETURN created record (enriched with goat's gender, breed, age for display)
```

**URS mentions Gender, Breed, Age in health tracker form** — these are READ from the goat record, NOT stored again in health_record. Express joins them when returning data.

---

### MODULE 8: VACCINATION SCHEDULE (URS 2.2.8)

**Express Endpoint:** `POST /api/vaccinations`

**Frontend sends:**

```json
{
  "goat_id": "G001",
  "vaccine_type_id": 1,
  "vaccinated_date": "2025-01-10"
}
```

Note: `next_vaccinated_date` is NOT sent by frontend — Express calculates it.

**Express logic:**

```
1. AUTH + PERMISSION('vaccination', 'create')

2. VALIDATE
   - goat_id: required, exists, active
   - vaccine_type_id: required, exists, active
   - vaccinated_date: required, valid date

3. FETCH vaccine interval
   → SELECT interval_days FROM admin_ref.vaccine_type WHERE vaccine_type_id = $1 AND is_active = true
   -- params: [vaccine_type_id]
   - If not found → 400 "Invalid or inactive vaccine type"

4. COMPUTE next_vaccinated_date
   next_vaccinated_date = vaccinated_date + interval_days
   (using date-fns or dayjs: addDays(vaccinated_date, interval_days))

5. CREATE vaccination
   → INSERT INTO farm.vaccination (goat_id, vaccine_type_id, vaccinated_date, next_vaccinated_date)
     VALUES ($1, $2, $3, $4) RETURNING *

6. AUDIT LOG

7. RETURN created record with vaccine_type name enriched
```

**Vaccination Reminders (URS acceptance criteria: "Reminders are generated for upcoming vaccinations"):**

```
Option A — Cron job (recommended):
  Run daily at 6am:
  → SELECT v.*, g.goat_id
    FROM farm.vaccination v
    JOIN farm.goat g ON g.goat_id = v.goat_id
    WHERE v.next_vaccinated_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  For each, find goat's premise owner and send notification.

Option B — On-demand query:
  GET /api/vaccinations/upcoming  → returns vaccinations due in next 7 days

You'll need: node-cron or agenda.js for scheduled jobs
```

---

### MODULE 9: BREEDING PROGRAM (URS 2.2.9) — MOST COMPLEX

**Express Endpoint:** `POST /api/breeding-programs`

**Frontend sends:**

```json
{
  "sire_id": "G001",
  "dam_ids": ["G002", "G003"],
  "program_date": "2025-02-01",
  "breeding_type_id": 1
}
```

Note: `pregnancy_check_date` and `expected_birth_date` are NOT sent — Express calculates them.

**Express logic:**

```
1. AUTH + PERMISSION('breeding_program', 'create')

2. VALIDATE
   - sire_id: required
   - dam_ids: required, array, at least 1
   - program_date: required, valid date
   - breeding_type_id: required

3. VERIFY sire exists, is active, is MALE
   → SELECT gender FROM farm.goat WHERE goat_id = $1 AND status = 'ACTIVE'
   -- params: [sire_id]
   - If gender != 'Male' → 400 "Sire must be male"

4. VERIFY each dam exists, is active, is FEMALE
   → For each dam_id:
     SELECT gender FROM farm.goat WHERE goat_id = $1 AND status = 'ACTIVE'
     - If gender != 'Female' → 400 "Dam {dam_id} must be female"

5. VERIFY breeding type exists & is active
   → SELECT 1 FROM admin_ref.breeding_type WHERE breeding_type_id = $1 AND is_active = true
   -- params: [breeding_type_id]

6. ★ BREEDING LOGIC — Prevent parent-offspring breeding ★
   For each dam_id:
     a. Check if sire is parent of dam:
        → SELECT sire_id, dam_id FROM farm.goat WHERE goat_id = $1
        -- params: [dam_id]
        - If dam.sire_id == sire_id OR dam.dam_id == sire_id → BLOCK

     b. Check if dam is parent of sire:
        → SELECT sire_id, dam_id FROM farm.goat WHERE goat_id = $1
        -- params: [sire_id]
        - If sire.sire_id == dam_id OR sire.dam_id == dam_id → BLOCK

     c. Check if sire is offspring of dam (dam produced sire):
        Same as (b) above — sire's parent check

     d. If any blocked → return 400 "Breeding between parent and offspring is not allowed. Blocked pair: {sire_id} × {dam_id}"

7. COMPUTE dates
   pregnancy_check_date = program_date + 30 days
   expected_birth_date = program_date + 150 days

--- BEGIN TRANSACTION ---

8. CREATE breeding_program
   → INSERT INTO farm.breeding_program (sire_id, breeding_type_id, program_date, pregnancy_check_date, expected_birth_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING breeding_program_id

9. CREATE breeding_dam entries (one per dam)
   → For each dam_id:
     INSERT INTO farm.breeding_dam (breeding_program_id, dam_id) VALUES ($1, $2)

10. AUDIT LOG

--- COMMIT ---

11. RETURN complete record with all dams
```

#### 9B. Generate Birth Certificate (URS 2.2.9)

**Express Endpoint:** `POST /api/breeding-programs/:id/birth-certificate`

**Frontend sends:**

```json
{
  "offspring_goat_id": "G010",
  "birth_date": "2025-07-01"
}
```

**Express logic:**

```
1. AUTH + PERMISSION('breeding_program', 'create')
2. VERIFY breeding_program exists
3. VERIFY offspring goat exists
4. CREATE birth certificate
   → INSERT INTO farm.birth_certificate (breeding_program_id, offspring_goat_id, birth_date)
     VALUES ($1, $2, $3) RETURNING *
5. RETURN certificate data (enriched with sire/dam info for display/PDF generation)
```

---

### MODULE 10: FEED PRICE CALCULATOR (URS 2.2.10)

**Express Endpoint:** `POST /api/calculators/feed-price`

**Frontend sends:**

```json
{
  "number_of_goats": 50,
  "food_per_goat_grams": 500,
  "price_per_kg": 2.50,
  "total_months": 6
}
```

**Express logic:**

```
1. AUTH + PERMISSION('feed_price_calculator', 'create')

2. VALIDATE
   - All fields required, numeric, > 0

3. COMPUTE (URS formula):
   total_cost = ((number_of_goats × food_per_goat_grams) / 1000) × price_per_kg × (total_months × 31)

   Example: ((50 × 500) / 1000) × 2.50 × (6 × 31) = 25 × 2.50 × 186 = RM 11,625.00

4. SAVE record
   → INSERT INTO calc.feed_price_calculation (user_account_id, number_of_goats, food_per_goat_grams, price_per_kg, total_months, total_cost)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *

5. RETURN { ...inputs, total_cost: 11625.00 }
```

---

### MODULE 11: FEED CALCULATOR (URS 2.2.11)

**Express Endpoint:** `POST /api/calculators/feed`

**Frontend sends (Single/Custom tab):**

```json
{
  "mode": "custom",
  "number_of_goats": 20,
  "avg_goat_weight": 45.0,
  "stage": "Pembesaran",
  "hay_usage": true
}
```

**Frontend sends (All Goats tab):**

```json
{
  "mode": "all",
  "stage": "Maintenance",
  "hay_usage": false
}
```

**Express logic:**

```
1. AUTH + PERMISSION('feed_calculator', 'create')

2. IF mode == "all":
   → SELECT COUNT(*) AS count, AVG(weight) AS avg_weight
     FROM farm.goat
     WHERE status = 'ACTIVE' AND premise_id = $1
   -- params: [user's premise_id]
   - Set number_of_goats = count, avg_goat_weight = avg_weight

3. VALIDATE
   - number_of_goats > 0, avg_goat_weight > 0
   - stage must be one of: 'Pembesaran', 'Maintenance', 'Pembiakan', 'Menyusu'

4. GET stage coefficient
   STAGE_MAP = {
     'Pembesaran': 0.04,
     'Maintenance': 0.03,
     'Pembiakan': 0.036,
     'Menyusu': 0.043
   }
   coefficient = STAGE_MAP[stage]

5. COMPUTE (URS formulas):
   dmi = avg_goat_weight × coefficient × number_of_goats
   fresh_fodder = number_of_goats × dmi × 0.7 × 5.3
   hay = hay_usage ? (number_of_goats × dmi × 0.1) : 0
   concentrate = number_of_goats × dmi × 0.2

6. SAVE record
   → INSERT INTO calc.feed_calculation (user_account_id, number_of_goats, avg_goat_weight, stage, hay_usage, dmi, fresh_fodder, hay, concentrate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *

7. RETURN all inputs + computed outputs
```

---

### MODULE 12: DASHBOARD (URS 2.1.2 + 2.2.2)

#### 12A. Admin Dashboard

**Express Endpoint:** `GET /api/admin/dashboard?premise_id=&ic_number=`

**Express logic:**

```
1. AUTH + PERMISSION('dashboard', 'view')

2. PARALLEL QUERIES:
   a. Total registered premises:
      → SELECT COUNT(*) FROM core.premise WHERE status = 'ACTIVE'

   b. Premises by state:
      → SELECT state, COUNT(*) AS count FROM core.premise WHERE status = 'ACTIVE' GROUP BY state

   c. Premises by district:
      → SELECT state, district, COUNT(*) AS count FROM core.premise WHERE status = 'ACTIVE' GROUP BY state, district

   d. Total users:
      → SELECT COUNT(*) FROM auth.user_account WHERE status = 'ACTIVE'

   e. If premise_id filter:
      → Add WHERE premise_id = $1 to goat/user queries

   f. If ic_number filter:
      → SELECT premise_id FROM core.user_profile WHERE ic_or_passport = $1
      → Scope all queries with that premise_id

3. RETURN aggregated metrics
```

#### 12B. User Dashboard

**Express Endpoint:** `GET /api/dashboard`

```
1. AUTH
2. GET user's premise_id
3. PARALLEL QUERIES (scoped to premise):
   a. Total farmers:
      → SELECT COUNT(*) FROM core.user_profile WHERE premise_id = $1

   b. Goats by gender:
      → SELECT gender, COUNT(*) AS count FROM farm.goat WHERE premise_id = $1 AND status = 'ACTIVE' GROUP BY gender

   c. Goats by breed:
      → SELECT gb.name AS breed_name, COUNT(*) AS count
        FROM farm.goat g
        JOIN admin_ref.goat_breed gb ON gb.goat_breed_id = g.goat_breed_id
        WHERE g.premise_id = $1 AND g.status = 'ACTIVE'
        GROUP BY gb.name

4. RETURN metrics
```

---

## PROJECT ROOT DIRECTORY MAP

```
project-root/
├── docs/       ← All documentation (BLL.md, CSV, DevLog, Coding Standards)
├── frontend/   ← React + Vite frontend
├── api/        ← Express API (this document's code goes here)
└── database/   ← Database backups & schema exports
```

---

## PART 4: EXPRESS PROJECT STRUCTURE

```
api/
├── package.json
├── .env                          # JWT_SECRET, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, SMTP settings
├── src/
│   ├── index.js                  # Express app entry point
│   ├── config/
│   │   └── env.js                # Load & validate env vars
│   ├── middleware/
│   │   ├── auth.js               # JWT verification middleware
│   │   ├── permission.js         # RBAC permission checker
│   │   ├── validate.js           # Input validation wrapper
│   │   └── errorHandler.js       # Global error handler
│   ├── routes/
│   │   ├── auth.routes.js        # /api/auth/*
│   │   ├── admin.routes.js       # /api/admin/*
│   │   ├── goat.routes.js        # /api/goats/*
│   │   ├── rfid.routes.js        # /api/rfid/*
│   │   ├── health.routes.js      # /api/health-records/*
│   │   ├── vaccination.routes.js # /api/vaccinations/*
│   │   ├── breeding.routes.js    # /api/breeding-programs/*
│   │   ├── slaughter.routes.js   # /api/slaughter/*
│   │   ├── calculator.routes.js  # /api/calculators/*
│   │   └── dashboard.routes.js   # /api/dashboard/*
│   ├── services/                 # ★ BUSINESS LOGIC LIVES HERE ★
│   │   ├── auth.service.js       # Login, OTP, password reset logic
│   │   ├── user.service.js       # User registration, CRUD
│   │   ├── role.service.js       # Role/permission management
│   │   ├── goat.service.js       # Goat CRUD + validation
│   │   ├── rfid.service.js       # RFID scan + data assembly
│   │   ├── health.service.js     # Health record logic
│   │   ├── vaccination.service.js# Vaccination + next_date calc
│   │   ├── breeding.service.js   # Breeding + parent-child check
│   │   ├── slaughter.service.js  # Slaughter + status update
│   │   ├── calculator.service.js # Both feed calculators
│   │   ├── dashboard.service.js  # Dashboard aggregation
│   │   └── audit.service.js      # Audit log helper
│   ├── utils/
│   │   ├── db.js                 # PostgreSQL connection pool (data access layer)
│   │   ├── password.js           # bcrypt hash/compare helpers
│   │   ├── otp.js                # OTP generation
│   │   ├── age.js                # Age calculation (days/months/years)
│   │   ├── email.js              # Email sender (nodemailer)
│   │   └── validators.js         # Reusable validation schemas (Joi/Zod)
│   └── constants/
│       └── stages.js             # Feed calculator stage coefficients
├── tests/                        # Unit & integration tests
└── uploads/                      # Temporary file storage
```

**Key NPM packages:**

```json
{
  "dependencies": {
    "express": "^4.18",
    "cors": "^2.8",
    "helmet": "^7.0",           // Security headers
    "bcryptjs": "^2.4",         // Password hashing
    "jsonwebtoken": "^9.0",     // JWT
    "joi": "^17.0",             // Input validation (or use zod)
    "pg": "^8.11",              // PostgreSQL client (data access layer)
    "multer": "^1.4",           // File uploads
    "nodemailer": "^6.9",       // Email sending
    "date-fns": "^3.0",         // Date math (addDays, differenceInDays)
    "node-cron": "^3.0",        // Scheduled jobs (vaccination reminders)
    "morgan": "^1.10",          // HTTP request logging
    "dotenv": "^16.0"           // Env vars
  }
}
```

---

## PART 5: PostgreSQL DATA ACCESS LAYER

This is how Express talks to your database. Every service uses this.

**Rule:** Never hardcode connection details. Always use environment variables.

```javascript
// src/utils/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'raspberry_123',
  max: 20,                    // max connections in pool
  idleTimeoutMillis: 30000,   // close idle connections after 30s
});

module.exports = {
  /**
   * Run a query and return all rows.
   * Always use parameterized queries ($1, $2...) to prevent SQL injection.
   */
  async query(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
  },

  /**
   * Run a query and return the first row, or null if no results.
   */
  async queryOne(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
  },

  /**
   * Get a dedicated client for transactions.
   * Caller MUST call client.release() when done.
   *
   * Usage:
   *   const client = await db.getClient();
   *   try {
   *     await client.query('BEGIN');
   *     await client.query('INSERT INTO ...', [...]);
   *     await client.query('INSERT INTO ...', [...]);
   *     await client.query('COMMIT');
   *   } catch (e) {
   *     await client.query('ROLLBACK');
   *     throw e;
   *   } finally {
   *     client.release();
   *   }
   */
  async getClient() {
    return await pool.connect();
  },

  // Expose pool for graceful shutdown: pool.end()
  pool,
};

// ─── Usage Examples ───────────────────────────────────────────
// const db = require('../utils/db');
//
// Single query:
//   const users = await db.query('SELECT * FROM auth.user_account WHERE email = $1', ['farmer@email.com']);
//
// Single row:
//   const user = await db.queryOne('SELECT * FROM auth.user_account WHERE user_account_id = $1', [1]);
//
// Insert with RETURNING:
//   const [newGoat] = await db.query(
//     'INSERT INTO farm.goat (goat_id, gender, weight) VALUES ($1, $2, $3) RETURNING *',
//     ['G005', 'Female', 28.5]
//   );
//
// Transaction (multi-step that must all succeed):
//   const client = await db.getClient();
//   try {
//     await client.query('BEGIN');
//     const { rows: [account] } = await client.query(
//       'INSERT INTO auth.user_account (email, password_hash, status) VALUES ($1, $2, $3) RETURNING user_account_id',
//       [email, hash, 'ACTIVE']
//     );
//     await client.query(
//       'INSERT INTO core.user_profile (user_account_id, full_name) VALUES ($1, $2)',
//       [account.user_account_id, fullName]
//     );
//     await client.query('COMMIT');
//   } catch (e) {
//     await client.query('ROLLBACK');
//     throw e;
//   } finally {
//     client.release();
//   }
```

**Environment variables (.env file):**

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=raspberry_123
JWT_SECRET=your-secret-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Note for Raspberry Pi deployment:** If Express runs inside Docker, use `DB_HOST=postgres` (the Docker container name). If Express runs directly on the Pi, use `DB_HOST=localhost`.

---

## PART 6: IDENTIFIED GAPS & DECISIONS NEEDED

^590d01

|#|Gap|Where|Decision Needed|
|---|---|---|---|
|1|**No `rfid_scan_history` table**|URS 2.2.3 says display scan history — your Excel has an "RFID Scanner History" sheet but no DB table|Add table? Or use sensor_data?|
|2|**Goat `status` values** not enumerated|farm.goat.status is varchar(20)|Define enum: ACTIVE, SLAUGHTERED, SOLD, DEAD, RETIRED|
|3|**File storage strategy**|URS requires document uploads + goat images|Local disk? AWS S3? Need to decide|
|4|**OTP delivery**|URS says email + SMS/WhatsApp|Email = nodemailer/SendGrid. SMS = Twilio? WhatsApp Business API? Budget?|
|5|**Premise-to-user scoping**|farm.goat has premise_id but no user_account_id|Goats are scoped to premises, users are linked to premises via user_profile. This is correct but needs consistent enforcement.|
|6|**user_profile.premise_id** is nullable FK|What if a user has no premise?|Make required for farm users, optional for admins?|
|7|**vaccine_type_id FK** missing in farm.vaccination|vaccination.vaccine_type_id is int but no FK constraint in your CSV|Add FK constraint: `ALTER TABLE farm.vaccination ADD CONSTRAINT ... REFERENCES admin_ref.vaccine_type(vaccine_type_id)`|
|8|**goat_breed_id FK** missing in farm.goat|Same issue — no FK to admin_ref.goat_breed|Add FK constraint|
|9|**breeding_type_id FK** missing in farm.breeding_program|Same pattern|Add FK constraint|
|10|**premise_id FK** missing in farm.goat|goat.premise_id is int, no FK to core.premise|Add FK constraint|
|11|**Notification content**|notify.notification has no `message_body` or `recipient` column|Add columns or handle email content in Express only (don't store body in DB)|
|12|**Birth certificate PDF generation**|URS says "Generate Birth Certificates"|Use pdfkit or puppeteer in Express to generate PDF|
|13|**Dashboard customization**|URS 2.1.2: "Allow admins to select data to display"|Store admin dashboard preferences in a new table? Or handle frontend-side?|
|14|**Feed Calculator "All Goats" tab**|Needs avg weight from all active goats|Express computes this dynamically — no DB change needed|

---

## PART 7: DEVELOPMENT ORDER (Recommended)

Build in this order to get a working system fastest:

```
WEEK 1: Foundation
├── Day 1: Express project setup + PostgreSQL connection (db.js)
├── Day 2: Auth (login, JWT, middleware) — UNBLOCKS EVERYTHING
├── Day 3: RBAC middleware + seed roles/permissions
├── Day 4: Admin reference CRUD (vaccine_type, breeding_type, goat_breed)
└── Day 5: User registration (admin creates user)

WEEK 2: Core Farm Operations
├── Day 1: Goat CRUD + image upload
├── Day 2: RFID Scan endpoint
├── Day 3: Health Tracker CRUD
├── Day 4: Vaccination Schedule (with next_date auto-calc)
└── Day 5: Slaughter CRUD

WEEK 3: Complex Features
├── Day 1-2: Breeding Program (with parent-child validation)
├── Day 3: Birth Certificate generation
├── Day 4: Feed Price Calculator + Feed Calculator
└── Day 5: Dashboards (admin + user)

WEEK 4: Polish
├── Vaccination reminders (cron job)
├── Audit log review
├── Error handling hardening
└── Frontend integration testing
```

---

## PART 8: COMPLETE EXPRESS ENDPOINT REFERENCE

| Method | Express Route                                | URS Ref      | Database Tables Used                                                                                                         |
| ------ | -------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| POST   | /api/auth/login                              | 2.1.1, 2.2.1 | auth.user_account, auth.login_attempt, rbac.user_role, rbac.role_permission, rbac.permission, core.user_profile              |
| POST   | /api/auth/forgot-password                    | 2.1.1, 2.2.1 | auth.user_account, auth.otp, notify.notification                                                                             |
| POST   | /api/auth/reset-password                     | 2.1.1, 2.2.1 | auth.user_account, auth.otp, audit.audit_log                                                                                 |
| GET    | /api/admin/vaccine-types                     | 2.1.3        | admin_ref.vaccine_type                                                                                                       |
| POST   | /api/admin/vaccine-types                     | 2.1.3        | admin_ref.vaccine_type, audit.audit_log                                                                                      |
| PATCH  | /api/admin/vaccine-types/:id                 | 2.1.3        | admin_ref.vaccine_type, audit.audit_log                                                                                      |
| DELETE | /api/admin/vaccine-types/:id                 | 2.1.3        | admin_ref.vaccine_type, farm.vaccination, audit.audit_log                                                                    |
| GET    | /api/admin/breeding-types                    | 2.1.4        | admin_ref.breeding_type                                                                                                      |
| POST   | /api/admin/breeding-types                    | 2.1.4        | admin_ref.breeding_type, audit.audit_log                                                                                     |
| PATCH  | /api/admin/breeding-types/:id                | 2.1.4        | admin_ref.breeding_type, audit.audit_log                                                                                     |
| DELETE | /api/admin/breeding-types/:id                | 2.1.4        | admin_ref.breeding_type, farm.breeding_program, audit.audit_log                                                              |
| GET    | /api/admin/goat-breeds                       | 2.1.5        | admin_ref.goat_breed                                                                                                         |
| POST   | /api/admin/goat-breeds                       | 2.1.5        | admin_ref.goat_breed, audit.audit_log                                                                                        |
| PATCH  | /api/admin/goat-breeds/:id                   | 2.1.5        | admin_ref.goat_breed, audit.audit_log                                                                                        |
| DELETE | /api/admin/goat-breeds/:id                   | 2.1.5        | admin_ref.goat_breed, farm.goat, audit.audit_log                                                                             |
| POST   | /api/admin/users                             | 2.1.6        | auth.user_account, core.premise, core.user_profile, core.user_document, rbac.user_role, notify.notification, audit.audit_log |
| GET    | /api/admin/users                             | 2.1.6        | core.user_profile, auth.user_account, core.user_document                                                                     |
| PATCH  | /api/admin/users/:id                         | 2.1.6        | core.user_profile, auth.user_account, audit.audit_log                                                                        |
| DELETE | /api/admin/users/:id                         | 2.1.6        | auth.user_account (soft delete), audit.audit_log                                                                             |
| POST   | /api/admin/roles                             | 2.1.7        | rbac.role, rbac.permission, rbac.role_permission, audit.audit_log                                                            |
| GET    | /api/admin/roles                             | 2.1.7        | rbac.role, rbac.role_permission, rbac.permission                                                                             |
| PATCH  | /api/admin/roles/:id                         | 2.1.7        | rbac.role, rbac.role_permission, audit.audit_log                                                                             |
| DELETE | /api/admin/roles/:id                         | 2.1.7        | rbac.role, rbac.user_role, rbac.role_permission, audit.audit_log                                                             |
| GET    | /api/admin/dashboard                         | 2.1.2        | core.premise, auth.user_account, core.user_profile                                                                           |
| GET    | /api/dashboard                               | 2.2.2        | farm.goat, core.user_profile, admin_ref.goat_breed                                                                           |
| GET    | /api/rfid/scan/:tag_code                     | 2.2.3        | farm.rfid_tag, farm.goat, admin_ref.goat_breed, farm.health_record, farm.vaccination, admin_ref.vaccine_type                 |
| POST   | /api/goats                                   | 2.2.5        | farm.goat, farm.rfid_tag, admin_ref.goat_breed, audit.audit_log                                                              |
| GET    | /api/goats                                   | 2.2.5        | farm.goat, admin_ref.goat_breed                                                                                              |
| PATCH  | /api/goats/:id                               | 2.2.5        | farm.goat, audit.audit_log                                                                                                   |
| DELETE | /api/goats/:id                               | 2.2.5        | farm.goat, audit.audit_log                                                                                                   |
| POST   | /api/goats/:id/image                         | 2.2.5        | farm.goat_image                                                                                                              |
| POST   | /api/slaughter                               | 2.2.6        | farm.slaughter, farm.goat, audit.audit_log                                                                                   |
| GET    | /api/slaughter                               | 2.2.6        | farm.slaughter, farm.goat                                                                                                    |
| PATCH  | /api/slaughter/:id                           | 2.2.6        | farm.slaughter, audit.audit_log                                                                                              |
| DELETE | /api/slaughter/:id                           | 2.2.6        | farm.slaughter, audit.audit_log                                                                                              |
| POST   | /api/health-records                          | 2.2.7        | farm.health_record, farm.goat, audit.audit_log                                                                               |
| GET    | /api/health-records                          | 2.2.7        | farm.health_record, farm.goat, admin_ref.goat_breed                                                                          |
| PATCH  | /api/health-records/:id                      | 2.2.7        | farm.health_record, audit.audit_log                                                                                          |
| DELETE | /api/health-records/:id                      | 2.2.7        | farm.health_record, audit.audit_log                                                                                          |
| POST   | /api/vaccinations                            | 2.2.8        | farm.vaccination, admin_ref.vaccine_type, farm.goat, audit.audit_log                                                         |
| GET    | /api/vaccinations                            | 2.2.8        | farm.vaccination, admin_ref.vaccine_type, farm.goat                                                                          |
| GET    | /api/vaccinations/upcoming                   | 2.2.8        | farm.vaccination, farm.goat                                                                                                  |
| PATCH  | /api/vaccinations/:id                        | 2.2.8        | farm.vaccination, audit.audit_log                                                                                            |
| DELETE | /api/vaccinations/:id                        | 2.2.8        | farm.vaccination, audit.audit_log                                                                                            |
| POST   | /api/breeding-programs                       | 2.2.9        | farm.breeding_program, farm.breeding_dam, farm.goat, admin_ref.breeding_type, audit.audit_log                                |
| GET    | /api/breeding-programs                       | 2.2.9        | farm.breeding_program, farm.breeding_dam, farm.goat, admin_ref.breeding_type                                                 |
| PATCH  | /api/breeding-programs/:id                   | 2.2.9        | farm.breeding_program, farm.breeding_dam, audit.audit_log                                                                    |
| DELETE | /api/breeding-programs/:id                   | 2.2.9        | farm.breeding_program, farm.breeding_dam, audit.audit_log                                                                    |
| POST   | /api/breeding-programs/:id/birth-certificate | 2.2.9        | farm.birth_certificate, farm.breeding_program, farm.goat                                                                     |
| POST   | /api/calculators/feed-price                  | 2.2.10       | calc.feed_price_calculation                                                                                                  |
| GET    | /api/calculators/feed-price                  | 2.2.10       | calc.feed_price_calculation                                                                                                  |
| DELETE | /api/calculators/feed-price/:id              | 2.2.10       | calc.feed_price_calculation                                                                                                  |
| POST   | /api/calculators/feed                        | 2.2.11       | calc.feed_calculation, farm.goat (if "all" mode)                                                                             |
| GET    | /api/calculators/feed                        | 2.2.11       | calc.feed_calculation                                                                                                        |
| DELETE | /api/calculators/feed/:id                    | 2.2.11       | calc.feed_calculation                                                                                                        |
| GET    | /api/audit/logs                              | 2.1.7        | audit.audit_log                                                                                                              |

---

**Total: 42 Express endpoints covering all 11 URS functional modules + 2 dashboards.**

This document is your contract. Frontend builds to the request/response shapes. Backend implements the logic. Express connects to PostgreSQL directly via the `pg` library. No guessing.
