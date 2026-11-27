
-- ==================================================
-- ORDER-TO-AUDIT SYSTEM
-- DAY 1 - STEP 5
-- INSERT BENCHMARK PRODUCT, MATERIALS, BOM AND STOCK
-- ==================================================

BEGIN;


-- ==================================================
-- 1. INSERT MURUKKU PRODUCT
-- ==================================================

INSERT INTO products (
    product_code,
    product_name,
    pack_size_g,
    unit_id,
    selling_price,
    gst_rate
)
VALUES (
    'MUR-200',
    'Murukku',
    200,
    (SELECT unit_id FROM units WHERE unit_code = 'PACKET'),
    50.00,
    5.00
)
ON CONFLICT (product_code)
DO UPDATE SET
    product_name = EXCLUDED.product_name,
    pack_size_g = EXCLUDED.pack_size_g,
    unit_id = EXCLUDED.unit_id,
    selling_price = EXCLUDED.selling_price,
    gst_rate = EXCLUDED.gst_rate;


-- ==================================================
-- 2. INSERT RAW MATERIALS
-- ==================================================

INSERT INTO raw_materials (
    material_code,
    material_name,
    unit_id,
    reorder_level
)
VALUES
(
    'FLOUR',
    'Flour',
    (SELECT unit_id FROM units WHERE unit_code = 'KG'),
    20
),
(
    'OIL',
    'Cooking Oil',
    (SELECT unit_id FROM units WHERE unit_code = 'L'),
    10
),
(
    'SPICE',
    'Salt and Spice Mix',
    (SELECT unit_id FROM units WHERE unit_code = 'KG'),
    5
),
(
    'POUCH',
    '200g Packaging Pouch',
    (SELECT unit_id FROM units WHERE unit_code = 'PCS'),
    100
),
(
    'CARTON',
    'Carton (20 Packets)',
    (SELECT unit_id FROM units WHERE unit_code = 'PCS'),
    10
)

ON CONFLICT (material_code)
DO UPDATE SET
    material_name = EXCLUDED.material_name,
    unit_id = EXCLUDED.unit_id,
    reorder_level = EXCLUDED.reorder_level;


-- ==================================================
-- 3. CREATE MURUKKU BOM HEADER
-- ==================================================

INSERT INTO bom_headers (
    product_id,
    bom_version,
    batch_size,
    expected_output_qty,
    output_unit_id
)
VALUES (
    (SELECT product_id
     FROM products
     WHERE product_code = 'MUR-200'),

    1,
    1,
    200,

    (SELECT unit_id
     FROM units
     WHERE unit_code = 'PACKET')
)

ON CONFLICT (product_id, bom_version)
DO UPDATE SET
    batch_size = EXCLUDED.batch_size,
    expected_output_qty = EXCLUDED.expected_output_qty,
    output_unit_id = EXCLUDED.output_unit_id;


-- ==================================================
-- 4. INSERT BOM MATERIAL REQUIREMENTS
-- ==================================================

INSERT INTO bom_items (
    bom_id,
    material_id,
    required_quantity,
    unit_id
)

SELECT
    bh.bom_id,
    rm.material_id,
    v.required_quantity,
    u.unit_id

FROM (
    VALUES
        ('FLOUR', 40.000, 'KG'),
        ('OIL', 10.000, 'L'),
        ('SPICE', 1.200, 'KG'),
        ('POUCH', 200.000, 'PCS'),
        ('CARTON', 10.000, 'PCS')
) AS v(material_code, required_quantity, unit_code)

JOIN raw_materials rm
    ON rm.material_code = v.material_code

JOIN units u
    ON u.unit_code = v.unit_code

JOIN bom_headers bh
    ON bh.product_id = (
        SELECT product_id
        FROM products
        WHERE product_code = 'MUR-200'
    )
    AND bh.bom_version = 1

ON CONFLICT (bom_id, material_id)
DO UPDATE SET
    required_quantity = EXCLUDED.required_quantity,
    unit_id = EXCLUDED.unit_id;


-- ==================================================
-- 5. INSERT OPENING RAW MATERIAL STOCK
-- ==================================================

INSERT INTO stock_movements (
    material_id,
    product_id,
    movement_type,
    quantity,
    unit_id,
    source_type,
    source_id,
    remarks
)

SELECT
    rm.material_id,
    NULL,
    'OPENING',
    v.quantity,
    u.unit_id,
    'INITIAL_SETUP',
    NULL,
    'Benchmark opening stock'

FROM (
    VALUES
        ('FLOUR', 100.000, 'KG'),
        ('OIL', 30.000, 'L'),
        ('SPICE', 5.000, 'KG'),
        ('POUCH', 500.000, 'PCS'),
        ('CARTON', 30.000, 'PCS')
) AS v(material_code, quantity, unit_code)

JOIN raw_materials rm
    ON rm.material_code = v.material_code

JOIN units u
    ON u.unit_code = v.unit_code

WHERE NOT EXISTS (
    SELECT 1
    FROM stock_movements sm
    WHERE sm.material_id = rm.material_id
      AND sm.movement_type = 'OPENING'
      AND sm.source_type = 'INITIAL_SETUP'
);


-- ==================================================
-- 6. INSERT OPENING FINISHED GOODS STOCK
-- ==================================================

INSERT INTO stock_movements (
    material_id,
    product_id,
    movement_type,
    quantity,
    unit_id,
    source_type,
    source_id,
    remarks
)

SELECT
    NULL,
    p.product_id,
    'OPENING',
    50.000,
    u.unit_id,
    'INITIAL_SETUP',
    NULL,
    'Benchmark opening finished goods stock'

FROM products p

JOIN units u
    ON u.unit_code = 'PACKET'

WHERE p.product_code = 'MUR-200'

AND NOT EXISTS (
    SELECT 1
    FROM stock_movements sm
    WHERE sm.product_id = p.product_id
      AND sm.movement_type = 'OPENING'
      AND sm.source_type = 'INITIAL_SETUP'
);


COMMIT;
