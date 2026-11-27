-- ============================================
-- ORDER-TO-AUDIT SYSTEM
-- DATABASE: order_audit_db
-- MODULE: MASTER DATA
-- ============================================

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(15) UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
);

-- 3. UNITS
CREATE TABLE IF NOT EXISTS units (
    unit_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unit_code VARCHAR(20) NOT NULL UNIQUE,
    unit_name VARCHAR(50) NOT NULL,
    unit_type VARCHAR(30) NOT NULL,
    conversion_factor NUMERIC(15, 6) NOT NULL DEFAULT 1,

    CONSTRAINT check_conversion_factor
        CHECK (conversion_factor > 0)
);

-- 4. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    customer_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    customer_type VARCHAR(30) NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(150),
    gstin VARCHAR(15) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    pincode VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_customer_type
        CHECK (
            customer_type IN ('RETAILER', 'DISTRIBUTOR')
        )
);

-- 5. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(150),
    gstin VARCHAR(15) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    state_code VARCHAR(2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    product_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_code VARCHAR(30) NOT NULL UNIQUE,
    product_name VARCHAR(150) NOT NULL,
    pack_size_g NUMERIC(12, 3) NOT NULL,
    unit_id INTEGER NOT NULL,
    selling_price NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL,
    hsn_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT check_pack_size
        CHECK (pack_size_g > 0),

    CONSTRAINT check_selling_price
        CHECK (selling_price >= 0),

    CONSTRAINT check_gst_rate
        CHECK (gst_rate >= 0 AND gst_rate <= 100)
);

-- 7. RAW MATERIALS
CREATE TABLE IF NOT EXISTS raw_materials (
    material_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_code VARCHAR(30) NOT NULL UNIQUE,
    material_name VARCHAR(150) NOT NULL,
    unit_id INTEGER NOT NULL,
    reorder_level NUMERIC(15, 3) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_material_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT check_reorder_level
        CHECK (reorder_level >= 0)
);

-- ============================================
-- INSERT INITIAL ROLES
-- ============================================

INSERT INTO roles (role_name, description)
VALUES
    ('ADMIN', 'Factory administrator'),
    ('SALESMAN', 'Field sales representative'),
    ('PRODUCTION', 'Production supervisor'),
    ('ACCOUNTANT', 'Read-only accounting and reports'),
    ('OWNER', 'Business owner and dashboard access')
ON CONFLICT (role_name) DO NOTHING;

-- ============================================
-- INSERT STANDARD UNITS
-- ============================================

INSERT INTO units (
    unit_code,
    unit_name,
    unit_type,
    conversion_factor
)
VALUES
    ('KG', 'Kilogram', 'WEIGHT', 1000),
    ('G', 'Gram', 'WEIGHT', 1),
    ('L', 'Litre', 'VOLUME', 1000),
    ('ML', 'Millilitre', 'VOLUME', 1),
    ('PCS', 'Pieces', 'COUNT', 1),
    ('PACKET', 'Packet', 'COUNT', 1),
    ('CARTON', 'Carton', 'COUNT', 1)
ON CONFLICT (unit_code) DO NOTHING;