-- ============================================
-- ORDER-TO-AUDIT SYSTEM
-- MODULE: INVENTORY STOCK MOVEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS stock_movements (

    movement_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    material_id INTEGER,

    product_id INTEGER,

    movement_type VARCHAR(30) NOT NULL,

    quantity NUMERIC(15, 3) NOT NULL,

    unit_id INTEGER NOT NULL,

    source_type VARCHAR(30) NOT NULL,

    source_id BIGINT,

    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    remarks TEXT,

    created_by INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_movement_material
        FOREIGN KEY (material_id)
        REFERENCES raw_materials(material_id),

    CONSTRAINT fk_movement_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_id),

    CONSTRAINT fk_movement_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT fk_movement_user
        FOREIGN KEY (created_by)
        REFERENCES users(user_id),

    CONSTRAINT check_movement_quantity
        CHECK (quantity > 0),

    CONSTRAINT check_movement_type
        CHECK (
            movement_type IN (
                'OPENING',
                'PURCHASE',
                'PRODUCTION_ISSUE',
                'PRODUCTION_OUTPUT',
                'DISPATCH',
                'RETURN',
                'WASTAGE',
                'ADJUSTMENT'
            )
        ),

    CONSTRAINT check_stock_item
        CHECK (
            (material_id IS NOT NULL AND product_id IS NULL)
            OR
            (material_id IS NULL AND product_id IS NOT NULL)
        )
);

-- Indexes for faster stock history searches

CREATE INDEX IF NOT EXISTS idx_stock_material
ON stock_movements(material_id);

CREATE INDEX IF NOT EXISTS idx_stock_product
ON stock_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movement_date
ON stock_movements(movement_date);