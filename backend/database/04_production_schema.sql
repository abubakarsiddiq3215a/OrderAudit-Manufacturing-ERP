-- ============================================
-- ORDER-TO-AUDIT SYSTEM
-- MODULE: PRODUCTION MANAGEMENT
-- ============================================


-- TABLE 1: PRODUCTION RUNS
-- Stores the main details of each production batch.

CREATE TABLE IF NOT EXISTS production_runs (

    production_run_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    run_number VARCHAR(50) NOT NULL UNIQUE,

    bom_id INTEGER NOT NULL,

    product_id INTEGER NOT NULL,

    batch_size NUMERIC(12, 3) NOT NULL DEFAULT 1,

    planned_output_qty NUMERIC(15, 3) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    production_date DATE NOT NULL DEFAULT CURRENT_DATE,

    notes TEXT,

    created_by INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMP,

    CONSTRAINT fk_production_bom
        FOREIGN KEY (bom_id)
        REFERENCES bom_headers(bom_id),

    CONSTRAINT fk_production_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    CONSTRAINT fk_production_user
        FOREIGN KEY (created_by)
        REFERENCES users(user_id),

    CONSTRAINT check_production_batch
        CHECK (batch_size > 0),

    CONSTRAINT check_planned_output
        CHECK (planned_output_qty > 0),

    CONSTRAINT check_production_status
        CHECK (
            status IN ('DRAFT', 'POSTED', 'CANCELLED')
        )
);


-- TABLE 2: PRODUCTION CONSUMPTION
-- Stores planned and actual material consumption.

CREATE TABLE IF NOT EXISTS production_consumption (

    consumption_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_run_id BIGINT NOT NULL,

    material_id INTEGER NOT NULL,

    planned_quantity NUMERIC(15, 3) NOT NULL,

    actual_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,

    unit_id INTEGER NOT NULL,

    remarks TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_consumption_run
        FOREIGN KEY (production_run_id)
        REFERENCES production_runs(production_run_id),

    CONSTRAINT fk_consumption_material
        FOREIGN KEY (material_id)
        REFERENCES raw_materials(material_id),

    CONSTRAINT fk_consumption_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT unique_run_material
        UNIQUE (production_run_id, material_id),

    CONSTRAINT check_planned_consumption
        CHECK (planned_quantity > 0),

    CONSTRAINT check_actual_consumption
        CHECK (actual_quantity >= 0)
);


-- TABLE 3: PRODUCTION OUTPUTS
-- Stores good and rejected finished production quantities.

CREATE TABLE IF NOT EXISTS production_outputs (

    output_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_run_id BIGINT NOT NULL,

    product_id INTEGER NOT NULL,

    output_type VARCHAR(20) NOT NULL,

    output_quantity NUMERIC(15, 3) NOT NULL,

    unit_id INTEGER NOT NULL,

    remarks TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_output_run
        FOREIGN KEY (production_run_id)
        REFERENCES production_runs(production_run_id),

    CONSTRAINT fk_output_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    CONSTRAINT fk_output_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT check_output_type
        CHECK (
            output_type IN ('GOOD', 'REJECTED')
        ),

    CONSTRAINT check_output_quantity
        CHECK (output_quantity > 0)
);


-- ============================================
-- INDEXES FOR FASTER SEARCHING
-- ============================================

CREATE INDEX IF NOT EXISTS idx_production_date
ON production_runs(production_date);

CREATE INDEX IF NOT EXISTS idx_consumption_run
ON production_consumption(production_run_id);

CREATE INDEX IF NOT EXISTS idx_output_run
ON production_outputs(production_run_id);