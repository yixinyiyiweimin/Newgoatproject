## PART 3: BUSINESS LOGIC BY MODULE

Each section follows this format:

- **URS Reference**: Section number from URS V1.2
- **What the frontend sends**: The request shape
- **What Express does**: The business logic (validation, computation, multi-step)
- **PostgREST calls**: The actual HTTP calls Express makes to PostgREST
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
   → GET https://raspberrypi.tail08c084.ts.net:10000/auth/user_account?or=(email.eq.{identifier},phone_number.eq.{identifier})&select=user_account_id,email,phone_number,password_hash,status,failed_login_attempts
   
3. CHECK account exists
   - If not found → return 401 "Invalid credentials"
   - Log failed attempt → POST /audit/login_attempt

4. CHECK account status
   - If status != 'ACTIVE' → return 403 "Account is inactive"

5. CHECK failed attempts
   - If failed_login_attempts >= 5 → return 423 "Account locked. Contact admin."

6. VERIFY password
   - bcrypt.compare(password, stored password_hash)
   - If mismatch:
     → PATCH /auth/user_account?user_account_id=eq.{id}  body: { failed_login_attempts: current + 1 }
     → POST /auth/login_attempt  body: { user_account_id, login_identifier, status: 'FAILED', failure_reason: 'Invalid password', ip_address }
     → return 401 "Invalid credentials"

7. SUCCESS — Reset failed attempts & update last login
   → PATCH /auth/user_account?user_account_id=eq.{id}  body: { failed_login_attempts: 0, last_login_at: now() }
   → POST /auth/login_attempt  body: { user_account_id, login_identifier, status: 'SUCCESS', ip_address }

8. FETCH user role & permissions
   → GET /rbac/user_role?user_account_id=eq.{id}&select=role_id
   → GET /rbac/role_permission?role_id=eq.{role_id}&select=permission_id
   → GET /rbac/permission?permission_id=in.({ids})&select=module_name,action

9. FETCH user profile
   → GET /core/user_profile?user_account_id=eq.{id}&select=*

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
1. FIND user → GET /auth/user_account?email=eq.{email}&select=user_account_id,email
   - If not found → return 200 (don't reveal if email exists — security best practice)

2. GENERATE OTP
   - 6-digit random number
   - Expiry = now + 10 minutes

3. STORE OTP
   → POST /auth/otp  body: { user_account_id, otp_code: hashedOTP, purpose: 'PASSWORD_RESET', expires_at }

4. SEND OTP via email (or SMS if phone only)
   → POST /notify/notification  body: { user_account_id, channel: 'EMAIL', message_type: 'OTP', status: 'PENDING' }
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
   → GET /auth/user_account?email=eq.{email}

2. FIND latest unused OTP for this user
   → GET /auth/otp?user_account_id=eq.{id}&purpose=eq.PASSWORD_RESET&is_used=eq.false&order=created_at.desc&limit=1

3. VALIDATE OTP
   - Check otp matches (bcrypt.compare or plain compare depending on storage)
   - Check expires_at > now()
   - If invalid → return 400 "Invalid or expired OTP"

4. VALIDATE new password strength
   - Min 8 chars, uppercase, lowercase, number, special char
   - If weak → return 400 with specific message

5. HASH new password → bcrypt.hash(new_password, 12)

6. UPDATE password
   → PATCH /auth/user_account?user_account_id=eq.{id}  body: { password_hash: hashed, failed_login_attempts: 0 }

7. MARK OTP as used
   → PATCH /auth/otp?otp_id=eq.{otp_id}  body: { is_used: true }

8. LOG audit
   → POST /audit/audit_log  body: { actor_user_id: id, action: 'PASSWORD_RESET', entity_name: 'user_account', entity_id: id }

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
   → GET /admin_ref/vaccine_type?name=eq.{name}
   - If exists → return 409 "Vaccine type name already exists"
5. CREATE
   → POST /admin_ref/vaccine_type  body: { name, interval_days, is_active: true }
   Headers: { Prefer: 'return=representation' }
6. AUDIT LOG
   → POST /audit/audit_log  body: { actor_user_id, action: 'CREATE', entity_name: 'vaccine_type', entity_id: new_id, new_value: { name, interval_days } }
7. RETURN created record
```

**Delete — `DELETE /api/admin/vaccine-types/:id`**

Express logic:

```
1. AUTH + PERMISSION check
2. CHECK if in use
   → GET /farm/vaccination?vaccine_type_id=eq.{id}&limit=1
   - If records exist → return 409 "Cannot delete: vaccine type is used in vaccination records"
3. SOFT DELETE (set inactive, don't actually delete)
   → PATCH /admin_ref/vaccine_type?vaccine_type_id=eq.{id}  body: { is_active: false }
4. AUDIT LOG
5. RETURN 200 { message: "Vaccine type deactivated" }
```

**List — `GET /api/admin/vaccine-types?search=&active_only=true`**

Express logic:

```
1. AUTH + PERMISSION('vaccine_type', 'view')
2. BUILD PostgREST query:
   → GET /admin_ref/vaccine_type?is_active=eq.true&order=name.asc
   - If search param: add &name=ilike.*{search}*
   - If active_only=false: remove is_active filter
3. RETURN array
```

#### 2B. Breeding Type — Same pattern as Vaccine Type

Differences:

- No `interval_days` field (only `name`)
- Check-in-use query: `GET /farm/breeding_program?breeding_type_id=eq.{id}&limit=1`
- PostgREST table: `/admin_ref/breeding_type`

#### 2C. Goat Breed — Same pattern as Vaccine Type

Differences:

- No `interval_days` field (only `name`)
- Check-in-use query: `GET /farm/goat?goat_breed_id=eq.{id}&limit=1`
- PostgREST table: `/admin_ref/goat_breed`

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
   → GET /auth/user_account?email=eq.{email}  (email unique check)
   → GET /auth/user_account?phone_number=eq.{phone}  (phone unique check)
   → GET /core/user_profile?ic_or_passport=eq.{ic}  (IC unique check)
   → GET /core/premise?premise_code=eq.{premise_code}  (premise duplicate check)
   - If any exist → return 409 with specific message

4. GENERATE temporary password
   - crypto.randomBytes(8).toString('hex') → e.g., "a3f8b2c1"
   - Hash it: bcrypt.hash(tempPassword, 12)

5. CREATE user_account
   → POST /auth/user_account  body: { email, phone_number, password_hash: hashed, status: 'ACTIVE' }
   - Get back user_account_id

6. CREATE premise
   → POST /core/premise  body: { premise_code, state, district, address: premise_address, status: 'ACTIVE' }
   - Get back premise_id

7. CREATE user_profile
   → POST /core/user_profile  body: { user_account_id, user_type, full_name, company_name, ic_or_passport, company_registration_no, address, email, phone_number, premise_id }
   - Get back user_profile_id

8. UPLOAD documents (if any)
   - Save files to storage (local disk or S3)
   - For each file:
     → POST /core/user_document  body: { user_profile_id, file_path, file_type }

9. ASSIGN default role
   → POST /rbac/user_role  body: { user_account_id, role_id: default_farmer_role_id }

10. SEND credentials
    - If email exists: send email with { email, tempPassword }
    - If phone exists: send SMS with { phone, tempPassword }
    → POST /notify/notification  body: { user_account_id, channel: 'EMAIL'/'SMS', message_type: 'CREDENTIALS', status: 'SENT' }

11. AUDIT LOG
    → POST /audit/audit_log  body: { actor_user_id: admin_id, action: 'CREATE', entity_name: 'user_registration', entity_id: user_account_id, new_value: { email, full_name, premise_code } }

12. RETURN { user_account_id, email, premise_code, message: "User created. Credentials sent." }
```

**IMPORTANT: Error rollback** — If step 7 fails after step 5 succeeded, you have an orphaned user_account. Options:

- Option A: Wrap in try/catch and manually delete on failure
- Option B: Use PostgreSQL transaction via a PostgREST RPC function (more advanced)

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
2. CHECK duplicate: GET /rbac/role?role_name=eq.{name}
3. CREATE role: POST /rbac/role  body: { role_name, is_system_role: false }
4. For each module+action combo, find or create permission:
   → GET /rbac/permission?module_name=eq.{module}&action=eq.{action}
   → If not exists: POST /rbac/permission body: { module_name, action }
5. Link permissions to role:
   → POST /rbac/role_permission  body: { role_id, permission_id }  (for each)
6. AUDIT LOG
7. RETURN role with permissions
```

#### 4B. Delete Role

```
1. CHECK if system role → if is_system_role=true → return 403 "Cannot delete system role"
2. CHECK if assigned: GET /rbac/user_role?role_id=eq.{id}&limit=1
   → If assigned → return 409 "Role is assigned to users. Reassign first."
3. DELETE role_permissions: DELETE /rbac/role_permission?role_id=eq.{id}
4. DELETE role: DELETE /rbac/role?role_id=eq.{id}
5. AUDIT LOG
```

#### 4C. Delete User (Soft Delete)

```
1. CHECK if Super Admin → block
2. PATCH /auth/user_account?user_account_id=eq.{id}  body: { status: 'INACTIVE' }
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
   → GET /farm/goat?goat_id=eq.{goat_id}
   - If exists → 409 "Goat ID already registered"

4. CHECK breed exists & is active
   → GET /admin_ref/goat_breed?goat_breed_id=eq.{id}&is_active=eq.true
   - If not found → 400 "Invalid or inactive breed"

5. CHECK sire/dam exist (if provided)
   → GET /farm/goat?goat_id=eq.{sire_id}  — verify exists & gender = 'Male'
   → GET /farm/goat?goat_id=eq.{dam_id}   — verify exists & gender = 'Female'
   - If sire not male → 400 "Sire must be male"
   - If dam not female → 400 "Dam must be female"

6. HANDLE RFID tag
   → GET /farm/rfid_tag?tag_code=eq.{rfid_tag_code}
   - If not exists: POST /farm/rfid_tag body: { tag_code, is_active: true, assigned_at: now() }
   - If exists & is_active: check not already assigned to another goat
   - Get rfid_tag_id

7. GET premise_id from logged-in user's profile
   → GET /core/user_profile?user_account_id=eq.{req.user.user_account_id}&select=premise_id

8. CREATE goat
   → POST /farm/goat  body: { goat_id, premise_id, rfid_tag_id, sire_id, dam_id, goat_breed_id, gender, birth_date, weight, status: 'ACTIVE' }

9. AUDIT LOG

10. RETURN created goat record
```

#### 5B. List Goats

**Express Endpoint:** `GET /api/goats?gender=Female&breed_id=1&search=G00`

**Express logic:**

```
1. AUTH + PERMISSION('goat', 'view')
2. GET user's premise_id (scope goats to their farm)
3. BUILD PostgREST query:
   → GET /farm/goat?premise_id=eq.{premise_id}&status=eq.ACTIVE&order=registered_at.desc
   - Add filters: gender, goat_breed_id, birth_date ranges, weight ranges
   - Add search: &goat_id=ilike.*{search}*
4. ENRICH response:
   - For each goat, compute age from birth_date:
     - < 31 days → "X days"
     - 31-364 days → "X months"  
     - >= 365 days → "X years"
   - Join breed name from goat_breed_id
   → GET /admin_ref/goat_breed?goat_breed_id=in.({unique_ids})
5. RETURN enriched array
```

#### 5C. RFID Scan (URS 2.2.3)

**Express Endpoint:** `GET /api/rfid/scan/:tag_code`

**Express logic:**

```
1. AUTH + PERMISSION('rfid_scan', 'view')

2. FIND RFID tag
   → GET /farm/rfid_tag?tag_code=eq.{tag_code}&is_active=eq.true
   - If not found → 404 "Unknown RFID tag"

3. FIND goat by rfid_tag_id
   → GET /farm/goat?rfid_tag_id=eq.{rfid_tag_id}&select=*
   - If not found → 404 "No goat assigned to this tag"

4. FETCH related data (parallel):
   → GET /admin_ref/goat_breed?goat_breed_id=eq.{goat.goat_breed_id}
   → GET /farm/health_record?goat_id=eq.{goat.goat_id}&order=recorded_at.desc&limit=1
   → GET /farm/vaccination?goat_id=eq.{goat.goat_id}&order=vaccinated_date.desc&limit=1
   → GET /admin_ref/vaccine_type?vaccine_type_id=eq.{vaccination.vaccine_type_id}

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
   → GET /farm/goat?goat_id=eq.{goat_id}&status=eq.ACTIVE
   - If not found → 400 "Goat not found or already inactive"

4. CREATE slaughter record
   → POST /farm/slaughter  body: { goat_id, weight, sold_amount, buyer_name, slaughter_cost, slaughter_date }

5. UPDATE goat status to SLAUGHTERED
   → PATCH /farm/goat?goat_id=eq.{goat_id}  body: { status: 'SLAUGHTERED' }

6. AUDIT LOG

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
   → GET /farm/goat?goat_id=eq.{goat_id}&status=eq.ACTIVE

4. CREATE record
   → POST /farm/health_record  body: { goat_id, health_status, treatment, observation }

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
   → GET /admin_ref/vaccine_type?vaccine_type_id=eq.{id}&is_active=eq.true&select=interval_days
   - If not found → 400 "Invalid or inactive vaccine type"

4. COMPUTE next_vaccinated_date
   next_vaccinated_date = vaccinated_date + interval_days
   (using date-fns or dayjs: addDays(vaccinated_date, interval_days))

5. CREATE vaccination
   → POST /farm/vaccination  body: { goat_id, vaccine_type_id, vaccinated_date, next_vaccinated_date }

6. AUDIT LOG

7. RETURN created record with vaccine_type name enriched
```

**Vaccination Reminders (URS acceptance criteria: "Reminders are generated for upcoming vaccinations"):**

```
Option A — Cron job (recommended):
  Run daily at 6am:
  → GET /farm/vaccination?next_vaccinated_date=lte.{today+7days}&next_vaccinated_date=gte.{today}
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
   → GET /farm/goat?goat_id=eq.{sire_id}&status=eq.ACTIVE
   - If gender != 'Male' → 400 "Sire must be male"

4. VERIFY each dam exists, is active, is FEMALE
   → For each dam_id:
     GET /farm/goat?goat_id=eq.{dam_id}&status=eq.ACTIVE
     - If gender != 'Female' → 400 "Dam {dam_id} must be female"

5. VERIFY breeding type exists & is active
   → GET /admin_ref/breeding_type?breeding_type_id=eq.{id}&is_active=eq.true

6. ★ BREEDING LOGIC — Prevent parent-offspring breeding ★
   For each dam_id:
     a. Check if sire is parent of dam:
        → GET /farm/goat?goat_id=eq.{dam_id}&select=sire_id,dam_id
        - If dam.sire_id == sire_id OR dam.dam_id == sire_id → BLOCK

     b. Check if dam is parent of sire:
        → GET /farm/goat?goat_id=eq.{sire_id}&select=sire_id,dam_id
        - If sire.sire_id == dam_id OR sire.dam_id == dam_id → BLOCK

     c. Check if sire is offspring of dam (dam produced sire):
        Same as (b) above — sire's parent check

     d. If any blocked → return 400 "Breeding between parent and offspring is not allowed. Blocked pair: {sire_id} × {dam_id}"

7. COMPUTE dates
   pregnancy_check_date = program_date + 30 days
   expected_birth_date = program_date + 150 days

8. CREATE breeding_program
   → POST /farm/breeding_program  body: { sire_id, breeding_type_id, program_date, pregnancy_check_date, expected_birth_date }
   - Get back breeding_program_id

9. CREATE breeding_dam entries (one per dam)
   → For each dam_id:
     POST /farm/breeding_dam  body: { breeding_program_id, dam_id }

10. AUDIT LOG

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
   → POST /farm/birth_certificate  body: { breeding_program_id, offspring_goat_id, birth_date }
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
   → POST /calc/feed_price_calculation  body: { user_account_id, number_of_goats, food_per_goat_grams, price_per_kg, total_months, total_cost }

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
   → GET /farm/goat?status=eq.ACTIVE&premise_id=eq.{user's premise}&select=weight
   - Count = number of results
   - avg_weight = sum(weights) / count
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
   → POST /calc/feed_calculation  body: { user_account_id, number_of_goats, avg_goat_weight, stage, hay_usage, dmi, fresh_fodder, hay, concentrate }

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
      → GET /core/premise?select=count&status=eq.ACTIVE
      With header: Prefer: count=exact

   b. Premises by state:
      → GET /core/premise?select=state&status=eq.ACTIVE
      Group in Express code by state

   c. Premises by district:
      → GET /core/premise?select=district,state&status=eq.ACTIVE

   d. Total users:
      → GET /auth/user_account?select=count&status=eq.ACTIVE

   e. If premise_id filter:
      → Scope all queries with premise_id=eq.{id}

   f. If ic_number filter:
      → GET /core/user_profile?ic_or_passport=eq.{ic}&select=premise_id
      → Scope all queries with that premise_id

3. RETURN aggregated metrics
```

#### 12B. User Dashboard

**Express Endpoint:** `GET /api/dashboard`

```
1. AUTH
2. GET user's premise_id
3. PARALLEL QUERIES (scoped to premise):
   a. Total farmers: GET /core/user_profile?premise_id=eq.{id}&select=count
   b. Goats by gender: GET /farm/goat?premise_id=eq.{id}&status=eq.ACTIVE&select=gender
      → Group: { male: X, female: Y }
   c. Goats by breed: GET /farm/goat?premise_id=eq.{id}&status=eq.ACTIVE&select=goat_breed_id
      → Join breed names, group: { Boer: X, Katjang: Y }
4. RETURN metrics
```

---

## PART 4: EXPRESS PROJECT STRUCTURE

```
goat-rfid-api/
├── package.json
├── .env                          # JWT_SECRET, POSTGREST_URL, SMTP settings
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
│   │   ├── postgrest.js          # HTTP client wrapper for PostgREST
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
    "axios": "^1.6",            // HTTP client for PostgREST calls
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

## PART 5: PostgREST CLIENT UTILITY

This is how Express talks to your database. Every service uses this.

**Rule:** Never hardcode the URL. Always use environment variable.

```javascript
// src/utils/postgrest.js
const axios = require('axios');
const POSTGREST_URL = process.env.POSTGREST_URL || 'https://raspberrypi.tail08c084.ts.net:10000';

const client = axios.create({ baseURL: POSTGREST_URL });

module.exports = {
  // GET with filters
  async get(schema, table, params = {}, headers = {}) {
    const res = await client.get(`/${schema}/${table}`, { params, headers });
    return res.data;
  },

  // POST (create)
  async create(schema, table, body) {
    const res = await client.post(`/${schema}/${table}`, body, {
      headers: { Prefer: 'return=representation' }
    });
    return res.data;
  },

  // PATCH (update) with filter
  async update(schema, table, filter, body) {
    const res = await client.patch(`/${schema}/${table}?${filter}`, body, {
      headers: { Prefer: 'return=representation' }
    });
    return res.data;
  },

  // DELETE with filter
  async remove(schema, table, filter) {
    await client.delete(`/${schema}/${table}?${filter}`);
  }
};

// Usage example:
// const goats = await postgrest.get('farm', 'goat', { premise_id: 'eq.1', status: 'eq.ACTIVE' });
// const newGoat = await postgrest.create('farm', 'goat', { goat_id: 'G010', gender: 'Male', ... });
```

---

## PART 6: IDENTIFIED GAPS & DECISIONS NEEDED

^590d01

|#|Gap|Where|Decision Needed|
|---|---|---|---|
|1|**No `rfid_scan_history` table** in PostgREST|URS 2.2.3 says display scan history — your Excel has an "RFID Scanner History" sheet but no DB table|Add table? Or use sensor_data?|
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
├── Day 1: Express project setup + PostgREST client utility
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

| Method | Express Route                                | URS Ref      | PostgREST Tables Hit                                                                                                         |
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

This document is your contract. Frontend builds to the request/response shapes. Backend implements the logic. PostgREST is the database interface. No guessing.