/**
 * BASELINE MIGRATION
 * 
 * Captures the existing PostgreSQL schema as of 2026-02-18.
 * Uses "IF NOT EXISTS" so it's safe to run against the Pi database
 * that already has these tables.
 * 
 * This is the ONLY migration that should be this large.
 * Future migrations should be small, focused changes.
 */

exports.up = function(knex) {
  return knex.raw(`

    -- ===================== SCHEMAS =====================
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS rbac;
    CREATE SCHEMA IF NOT EXISTS core;
    CREATE SCHEMA IF NOT EXISTS admin_ref;
    CREATE SCHEMA IF NOT EXISTS farm;
    CREATE SCHEMA IF NOT EXISTS calc;
    CREATE SCHEMA IF NOT EXISTS audit;
    CREATE SCHEMA IF NOT EXISTS notify;

    -- ===================== auth =====================

    CREATE TABLE IF NOT EXISTS auth.user_account (
        user_account_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        phone_number VARCHAR(20) UNIQUE,
        password_hash TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        failed_login_attempts INTEGER DEFAULT 0,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        address TEXT,
        company_name VARCHAR(255),
        company_reg_no VARCHAR(255),
        full_name VARCHAR(255),
        ic_number VARCHAR(20)
    );

    CREATE TABLE IF NOT EXISTS auth.login_attempt (
        login_attempt_id SERIAL PRIMARY KEY,
        user_account_id INTEGER,
        login_identifier VARCHAR(255),
        status VARCHAR(20) NOT NULL,
        failure_reason TEXT,
        ip_address VARCHAR(50),
        attempted_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id)
    );

    CREATE TABLE IF NOT EXISTS auth.otp (
        otp_id SERIAL PRIMARY KEY,
        user_account_id INTEGER,
        otp_code VARCHAR(72) NOT NULL,
        purpose VARCHAR(50),
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id)
    );

    -- ===================== rbac =====================

    CREATE TABLE IF NOT EXISTS rbac.role (
        role_id SERIAL PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL UNIQUE,
        is_system_role BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS rbac.permission (
        permission_id SERIAL PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        action VARCHAR(20) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rbac.role_permission (
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES rbac.role(role_id),
        FOREIGN KEY (permission_id) REFERENCES rbac.permission(permission_id)
    );

    CREATE TABLE IF NOT EXISTS rbac.user_role (
        user_account_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        assigned_at TIMESTAMP DEFAULT now(),
        PRIMARY KEY (user_account_id, role_id),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id),
        FOREIGN KEY (role_id) REFERENCES rbac.role(role_id)
    );

    -- ===================== core =====================

    CREATE TABLE IF NOT EXISTS core.premise (
        premise_id SERIAL PRIMARY KEY,
        premise_code VARCHAR(100) NOT NULL UNIQUE,
        state VARCHAR(100),
        district VARCHAR(100),
        address TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS core.user_profile (
        user_profile_id SERIAL PRIMARY KEY,
        user_account_id INTEGER UNIQUE,
        user_type VARCHAR(20) NOT NULL,
        full_name VARCHAR(255),
        company_name VARCHAR(255),
        ic_or_passport VARCHAR(50) NOT NULL UNIQUE,
        company_registration_no VARCHAR(100),
        address TEXT,
        email VARCHAR(255),
        phone_number VARCHAR(20),
        premise_id INTEGER,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (premise_id) REFERENCES core.premise(premise_id),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id)
    );

    CREATE TABLE IF NOT EXISTS core.user_document (
        document_id SERIAL PRIMARY KEY,
        user_profile_id INTEGER,
        file_path TEXT NOT NULL,
        file_type VARCHAR(50),
        uploaded_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (user_profile_id) REFERENCES core.user_profile(user_profile_id)
    );

    -- ===================== admin_ref =====================

    CREATE TABLE IF NOT EXISTS admin_ref.breed_type (
        breed_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS admin_ref.breeding_type (
        breeding_type_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS admin_ref.vaccine_type (
        vaccine_type_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        interval_days INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
    );

    -- ===================== farm =====================

    CREATE TABLE IF NOT EXISTS farm.rfid_tag (
        rfid_tag_id SERIAL PRIMARY KEY,
        tag_code VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        assigned_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS farm.goat (
        goat_id VARCHAR(100) NOT NULL PRIMARY KEY,
        premise_id INTEGER,
        rfid_tag_id INTEGER UNIQUE,
        sire_id VARCHAR(100),
        dam_id VARCHAR(100),
        goat_breed_id INTEGER,
        gender VARCHAR(10),
        birth_date DATE,
        weight NUMERIC,
        registered_at TIMESTAMP DEFAULT now(),
        status VARCHAR(20) DEFAULT 'ACTIVE',
        FOREIGN KEY (premise_id) REFERENCES core.premise(premise_id),
        FOREIGN KEY (rfid_tag_id) REFERENCES farm.rfid_tag(rfid_tag_id),
        FOREIGN KEY (goat_breed_id) REFERENCES admin_ref.breed_type(breed_id),
        FOREIGN KEY (sire_id) REFERENCES farm.goat(goat_id),
        FOREIGN KEY (dam_id) REFERENCES farm.goat(goat_id)
    );

    CREATE TABLE IF NOT EXISTS farm.goat_image (
        image_id SERIAL PRIMARY KEY,
        goat_id VARCHAR(100),
        image_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (goat_id) REFERENCES farm.goat(goat_id)
    );

    CREATE TABLE IF NOT EXISTS farm.health_record (
        health_record_id SERIAL PRIMARY KEY,
        goat_id VARCHAR(100),
        health_status VARCHAR(100),
        treatment TEXT,
        observation TEXT,
        recorded_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (goat_id) REFERENCES farm.goat(goat_id)
    );

    CREATE TABLE IF NOT EXISTS farm.vaccination (
        vaccination_id SERIAL PRIMARY KEY,
        goat_id VARCHAR(100),
        vaccine_type_id INTEGER,
        date_administered DATE,
        next_vaccinated_date DATE,
        recorded_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (goat_id) REFERENCES farm.goat(goat_id),
        FOREIGN KEY (vaccine_type_id) REFERENCES admin_ref.vaccine_type(vaccine_type_id)
    );

    CREATE TABLE IF NOT EXISTS farm.slaughter (
        slaughter_id SERIAL PRIMARY KEY,
        goat_id VARCHAR(100) UNIQUE,
        weight NUMERIC,
        sold_amount NUMERIC,
        buyer_name VARCHAR(255),
        slaughter_cost NUMERIC,
        slaughter_date DATE,
        recorded_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (goat_id) REFERENCES farm.goat(goat_id)
    );

    CREATE TABLE IF NOT EXISTS farm.breeding_program (
        breeding_program_id SERIAL PRIMARY KEY,
        sire_id VARCHAR(100),
        breeding_type_id INTEGER,
        program_date DATE,
        pregnancy_check_date DATE,
        expected_birth_date DATE,
        created_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (sire_id) REFERENCES farm.goat(goat_id),
        FOREIGN KEY (breeding_type_id) REFERENCES admin_ref.breeding_type(breeding_type_id)
    );

    CREATE TABLE IF NOT EXISTS farm.breeding_dam (
        breeding_dam_id SERIAL PRIMARY KEY,
        breeding_program_id INTEGER,
        dam_id VARCHAR(100),
        FOREIGN KEY (breeding_program_id) REFERENCES farm.breeding_program(breeding_program_id),
        FOREIGN KEY (dam_id) REFERENCES farm.goat(goat_id)
    );

    CREATE TABLE IF NOT EXISTS farm.birth_certificate (
        certificate_id SERIAL PRIMARY KEY,
        breeding_program_id INTEGER,
        offspring_goat_id VARCHAR(100),
        birth_date DATE,
        generated_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (breeding_program_id) REFERENCES farm.breeding_program(breeding_program_id),
        FOREIGN KEY (offspring_goat_id) REFERENCES farm.goat(goat_id)
    );

    -- ===================== calc =====================

    CREATE TABLE IF NOT EXISTS calc.feed_price_calculation (
        calculation_id SERIAL PRIMARY KEY,
        user_account_id INTEGER,
        number_of_goats INTEGER,
        food_per_goat_grams NUMERIC,
        price_per_kg NUMERIC,
        total_months INTEGER,
        total_cost NUMERIC,
        created_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id)
    );

    CREATE TABLE IF NOT EXISTS calc.feed_calculation (
        feed_calc_id SERIAL PRIMARY KEY,
        user_account_id INTEGER,
        number_of_goats INTEGER,
        avg_goat_weight NUMERIC,
        stage VARCHAR(50),
        hay_usage BOOLEAN,
        dmi NUMERIC,
        fresh_fodder NUMERIC,
        hay NUMERIC,
        concentrate NUMERIC,
        created_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id)
    );

    -- ===================== audit =====================

    CREATE TABLE IF NOT EXISTS audit.audit_log (
        audit_log_id SERIAL PRIMARY KEY,
        actor_user_id INTEGER,
        action VARCHAR(50),
        entity_name VARCHAR(100),
        entity_id VARCHAR(100),
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (actor_user_id) REFERENCES auth.user_account(user_account_id)
    );

    -- ===================== notify =====================

    CREATE TABLE IF NOT EXISTS notify.notification (
        notification_id SERIAL PRIMARY KEY,
        user_account_id INTEGER,
        channel VARCHAR(20),
        message_type VARCHAR(50),
        status VARCHAR(20),
        sent_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (user_account_id) REFERENCES auth.user_account(user_account_id)
    );

  `);
};

exports.down = function(knex) {
  return knex.raw(`
    -- WARNING: This drops ALL application tables. Only use to fully reset.
    DROP TABLE IF EXISTS notify.notification CASCADE;
    DROP TABLE IF EXISTS audit.audit_log CASCADE;
    DROP TABLE IF EXISTS calc.feed_calculation CASCADE;
    DROP TABLE IF EXISTS calc.feed_price_calculation CASCADE;
    DROP TABLE IF EXISTS farm.birth_certificate CASCADE;
    DROP TABLE IF EXISTS farm.breeding_dam CASCADE;
    DROP TABLE IF EXISTS farm.breeding_program CASCADE;
    DROP TABLE IF EXISTS farm.slaughter CASCADE;
    DROP TABLE IF EXISTS farm.vaccination CASCADE;
    DROP TABLE IF EXISTS farm.health_record CASCADE;
    DROP TABLE IF EXISTS farm.goat_image CASCADE;
    DROP TABLE IF EXISTS farm.goat CASCADE;
    DROP TABLE IF EXISTS farm.rfid_tag CASCADE;
    DROP TABLE IF EXISTS admin_ref.vaccine_type CASCADE;
    DROP TABLE IF EXISTS admin_ref.breeding_type CASCADE;
    DROP TABLE IF EXISTS admin_ref.breed_type CASCADE;
    DROP TABLE IF EXISTS core.user_document CASCADE;
    DROP TABLE IF EXISTS core.user_profile CASCADE;
    DROP TABLE IF EXISTS core.premise CASCADE;
    DROP TABLE IF EXISTS rbac.user_role CASCADE;
    DROP TABLE IF EXISTS rbac.role_permission CASCADE;
    DROP TABLE IF EXISTS rbac.permission CASCADE;
    DROP TABLE IF EXISTS rbac.role CASCADE;
    DROP TABLE IF EXISTS auth.otp CASCADE;
    DROP TABLE IF EXISTS auth.login_attempt CASCADE;
    DROP TABLE IF EXISTS auth.user_account CASCADE;
  `);
};
