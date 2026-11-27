-- ============================================
-- ORDER-TO-AUDIT SYSTEM
-- MODULE: BILL OF MATERIALS (BOM)
-- ============================================

-- TABLE 1: BOM HEADERS
-- Stores the main manufacturing recipe information.

CREATE TABLE IF NOT EXISTS bom_headers (

    bom_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id INTEGER NOT NULL,

    bom_version INTEGER NOT NULL DEFAULT 1,

    batch_size NUMERIC(12, 3) NOT NULL DEFAULT 1,

    expected_output_qty NUMERIC(12, 3) NOT NULL,

    output_unit_id INTEGER NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bom_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    CONSTRAINT fk_bom_output_unit
        FOREIGN KEY (output_unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT unique_bom_version
        UNIQUE (product_id, bom_version),

    CONSTRAINT check_batch_size
        CHECK (batch_size > 0),

    CONSTRAINT check_expected_output
        CHECK (expected_output_qty > 0)
);


-- TABLE 2: BOM ITEMS
-- Stores the materials required for each BOM.

CREATE TABLE IF NOT EXISTS bom_items (

    bom_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bom_id INTEGER NOT NULL,

    material_id INTEGER NOT NULL,

    required_quantity NUMERIC(15, 3) NOT NULL,

    unit_id INTEGER NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bom_item_header
        FOREIGN KEY (bom_id)
        REFERENCES bom_headers(bom_id),

    CONSTRAINT fk_bom_item_material
        FOREIGN KEY (material_id)
        REFERENCES raw_materials(material_id),

    CONSTRAINT fk_bom_item_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT unique_bom_material
        UNIQUE (bom_id, material_id),

    CONSTRAINT check_required_quantity
        CHECK (required_quantity > 0)
);


-- ============================================
-- BOM TABLES CREATED
-- ============================================