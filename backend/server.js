
require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// ==========================================
// API 1: Check backend
// ==========================================

app.get("/", (req, res) => {
    res.send("Order-to-Audit System Backend is running!");
});

// ==========================================
// API 2: Check database connection
// ==========================================

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database(), current_user, NOW()"
        );

        res.status(200).json({
            status: "success",
            message: "Node.js connected to PostgreSQL!",
            database: result.rows[0].current_database,
            user: result.rows[0].current_user,
            serverTime: result.rows[0].now
        });

    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Database connection failed"
        });
    }
});

// ==========================================
// API 3: Calculate current stock
// ==========================================

app.get("/api/stock", async (req, res) => {
    try {
        const query = `
            SELECT
                'RAW_MATERIAL' AS item_type,
                rm.material_id AS item_id,
                rm.material_name AS item_name,

                SUM(
                    CASE
                        WHEN sm.movement_type IN (
                            'OPENING',
                            'PURCHASE',
                            'PRODUCTION_OUTPUT',
                            'RETURN',
                            'ADJUSTMENT'
                        )
                        THEN sm.quantity

                        WHEN sm.movement_type IN (
                            'PRODUCTION_ISSUE',
                            'DISPATCH',
                            'WASTAGE'
                        )
                        THEN -sm.quantity

                        ELSE 0
                    END
                ) AS stock_quantity,

                u.unit_code

            FROM stock_movements sm

            JOIN raw_materials rm
                ON sm.material_id = rm.material_id

            JOIN units u
                ON sm.unit_id = u.unit_id

            WHERE sm.material_id IS NOT NULL

            GROUP BY
                rm.material_id,
                rm.material_name,
                u.unit_code

            UNION ALL

            SELECT
                'FINISHED_PRODUCT' AS item_type,
                p.product_id AS item_id,
                p.product_name AS item_name,

                SUM(
                    CASE
                        WHEN sm.movement_type IN (
                            'OPENING',
                            'PURCHASE',
                            'PRODUCTION_OUTPUT',
                            'RETURN',
                            'ADJUSTMENT'
                        )
                        THEN sm.quantity

                        WHEN sm.movement_type IN (
                            'PRODUCTION_ISSUE',
                            'DISPATCH',
                            'WASTAGE'
                        )
                        THEN -sm.quantity

                        ELSE 0
                    END
                ) AS stock_quantity,

                u.unit_code

            FROM stock_movements sm

            JOIN products p
                ON sm.product_id = p.product_id

            JOIN units u
                ON sm.unit_id = u.unit_id

            WHERE sm.product_id IS NOT NULL

            GROUP BY
                p.product_id,
                p.product_name,
                u.unit_code

            ORDER BY item_type, item_name;
        `;

        const result = await pool.query(query);

        res.status(200).json({
            status: "success",
            total_items: result.rows.length,
            stock: result.rows
        });

    } catch (error) {
        console.error("Stock API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to calculate stock"
        });
    }
});


// ==========================================
// PURCHASE MODULE: MASTER DATA AND HISTORY APIs
// ==========================================

// API: Get all suppliers
app.get("/api/suppliers", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                supplier_id,
                supplier_name,
                phone,
                email,
                gstin,
                address,
                city,
                state,
                state_code
            FROM suppliers
            ORDER BY supplier_name;
        `);

        res.status(200).json({
            status: "success",
            total_suppliers: result.rows.length,
            suppliers: result.rows
        });

    } catch (error) {
        console.error("Suppliers API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve suppliers."
        });
    }
});


// API: Get active raw materials
app.get("/api/materials", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                rm.material_id,
                rm.material_code,
                rm.material_name,
                rm.unit_id,
                rm.reorder_level,
                u.unit_code,
                u.unit_name,
                u.unit_type
            FROM raw_materials rm
            JOIN units u
                ON rm.unit_id = u.unit_id
            WHERE rm.is_active = TRUE
            ORDER BY rm.material_name;
        `);

        res.status(200).json({
            status: "success",
            total_materials: result.rows.length,
            materials: result.rows
        });

    } catch (error) {
        console.error("Materials API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve raw materials."
        });
    }
});


// API: Get measurement units
app.get("/api/units", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                unit_id,
                unit_code,
                unit_name,
                unit_type,
                conversion_factor
            FROM units
            ORDER BY unit_name;
        `);

        res.status(200).json({
            status: "success",
            total_units: result.rows.length,
            units: result.rows
        });

    } catch (error) {
        console.error("Units API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve units."
        });
    }
});


// API: Get purchase history
app.get("/api/purchases", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ph.purchase_id,
                ph.supplier_id,
                s.supplier_name,
                ph.invoice_number,
                ph.purchase_date,
                ph.subtotal,
                ph.tax_amount,
                ph.total_amount,
                ph.status,
                ph.remarks,
                ph.created_at
            FROM purchase_headers ph
            JOIN suppliers s
                ON ph.supplier_id = s.supplier_id
            ORDER BY ph.purchase_date DESC, ph.purchase_id DESC;
        `);

        res.status(200).json({
            status: "success",
            total_records: result.rows.length,
            purchases: result.rows
        });

    } catch (error) {
        console.error("Purchase history API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve purchase history."
        });
    }
});


// API: Get individual purchase details
app.get("/api/purchases/:id", async (req, res) => {
    try {
        const purchaseId = Number(req.params.id);

        if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid purchase ID."
            });
        }

        const headerResult = await pool.query(`
            SELECT
                ph.*,
                s.supplier_name,
                s.phone,
                s.email,
                s.gstin,
                s.address,
                s.city,
                s.state
            FROM purchase_headers ph
            JOIN suppliers s
                ON ph.supplier_id = s.supplier_id
            WHERE ph.purchase_id = $1;
        `, [purchaseId]);

        if (headerResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Purchase record not found."
            });
        }

        const itemsResult = await pool.query(`
            SELECT
                pi.purchase_item_id,
                pi.material_id,
                rm.material_code,
                rm.material_name,
                pi.quantity,
                pi.unit_id,
                u.unit_code,
                u.unit_name,
                pi.rate,
                pi.tax_rate,
                pi.taxable_amount,
                pi.tax_amount,
                pi.total_amount
            FROM purchase_items pi
            JOIN raw_materials rm
                ON pi.material_id = rm.material_id
            JOIN units u
                ON pi.unit_id = u.unit_id
            WHERE pi.purchase_id = $1
            ORDER BY pi.purchase_item_id;
        `, [purchaseId]);

        res.status(200).json({
            status: "success",
            purchase: headerResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {
        console.error("Purchase details API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve purchase details."
        });
    }
});


// ==========================================
// API 4: Record a raw material purchase
// ==========================================

app.post("/api/purchases", async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        const {
            supplier_id,
            invoice_number,
            purchase_date,
            items,
            remarks
        } = req.body;

        // Basic input validation
        if (
            !supplier_id ||
            !invoice_number ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                status: "error",
                message: "Supplier, invoice number and purchase items are required."
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        let subtotal = 0;
        let totalTax = 0;

        // Validate each item and calculate invoice totals
        const preparedItems = [];

        for (const item of items) {
            const {
                material_id,
                quantity,
                unit_id,
                rate,
                tax_rate = 0
            } = item;

            const qty = Number(quantity);
            const price = Number(rate);
            const taxPercent = Number(tax_rate);

            if (
                !Number.isInteger(Number(material_id)) ||
                !Number.isInteger(Number(unit_id)) ||
                !Number.isFinite(qty) ||
                !Number.isFinite(price) ||
                !Number.isFinite(taxPercent) ||
                qty <= 0 ||
                price < 0 ||
                taxPercent < 0
            ) {
                throw new Error("Invalid purchase item details.");
            }

            // Confirm that the material exists and the unit matches
            const materialResult = await client.query(
                `SELECT material_id, material_name, unit_id
                 FROM raw_materials
                 WHERE material_id = $1
                 AND is_active = TRUE`,
                [material_id]
            );

            if (materialResult.rows.length === 0) {
                throw new Error(
                    `Raw material ID ${material_id} does not exist or is inactive.`
                );
            }

            if (Number(materialResult.rows[0].unit_id) !== Number(unit_id)) {
                throw new Error(
                    `Incorrect unit for ${materialResult.rows[0].material_name}.`
                );
            }

            const taxableAmount = Number((qty * price).toFixed(2));

            const taxAmount = Number(
                (taxableAmount * taxPercent / 100).toFixed(2)
            );

            const itemTotal = Number(
                (taxableAmount + taxAmount).toFixed(2)
            );

            subtotal += taxableAmount;
            totalTax += taxAmount;

            preparedItems.push({
                material_id,
                quantity: qty,
                unit_id,
                rate: price,
                tax_rate: taxPercent,
                taxable_amount: taxableAmount,
                tax_amount: taxAmount,
                total_amount: itemTotal
            });
        }

        subtotal = Number(subtotal.toFixed(2));
        totalTax = Number(totalTax.toFixed(2));

        const totalAmount = Number(
            (subtotal + totalTax).toFixed(2)
        );

        // Save purchase invoice
        const purchaseResult = await client.query(
            `INSERT INTO purchase_headers
             (
                supplier_id,
                invoice_number,
                purchase_date,
                subtotal,
                tax_amount,
                total_amount,
                remarks
             )
             VALUES (
                $1,
                $2,
                COALESCE($3::date, CURRENT_DATE),
                $4,
                $5,
                $6,
                $7
             )
             RETURNING purchase_id`,
            [
                supplier_id,
                invoice_number,
                purchase_date || null,
                subtotal,
                totalTax,
                totalAmount,
                remarks || null
            ]
        );

        const purchaseId = purchaseResult.rows[0].purchase_id;

        // Save each purchase item and update stock ledger
        for (const item of preparedItems) {

            await client.query(
                `INSERT INTO purchase_items
                 (
                    purchase_id,
                    material_id,
                    quantity,
                    unit_id,
                    rate,
                    tax_rate,
                    taxable_amount,
                    tax_amount,
                    total_amount
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    purchaseId,
                    item.material_id,
                    item.quantity,
                    item.unit_id,
                    item.rate,
                    item.tax_rate,
                    item.taxable_amount,
                    item.tax_amount,
                    item.total_amount
                ]
            );

            // Add purchased quantity to inventory
            await client.query(
                `INSERT INTO stock_movements
                 (
                    material_id,
                    product_id,
                    movement_type,
                    quantity,
                    unit_id,
                    source_type,
                    source_id,
                    movement_date,
                    remarks
                 )
                 VALUES (
                    $1,
                    NULL,
                    'PURCHASE',
                    $2,
                    $3,
                    'PURCHASE',
                    $4,
                    COALESCE($5::timestamp, CURRENT_TIMESTAMP),
                    $6
                 )`,
                [
                    item.material_id,
                    item.quantity,
                    item.unit_id,
                    purchaseId,
                    purchase_date || null,
                    `Purchase invoice: ${invoice_number}`
                ]
            );
        }

        // Commit all database changes together
        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            status: "success",
            message: "Purchase recorded and stock updated successfully.",
            purchase_id: purchaseId,
            invoice_number,
            subtotal,
            tax_amount: totalTax,
            total_amount: totalAmount,
            items: preparedItems.length
        });

    } catch (error) {

        // Roll back only if this request successfully started a transaction.
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Purchase rollback error:", rollbackError.message);
            }
        }

        console.error("Purchase API error:", error.message);

        // PostgreSQL error 23505 means a UNIQUE constraint was violated.
        // In this module, this includes a duplicate supplier invoice number.
        if (error.code === "23505") {
            return res.status(409).json({
                status: "error",
                message: "This supplier invoice number has already been recorded. Please use a different invoice number."
            });
        }

        res.status(400).json({
            status: "error",
            message: error.message
        });

    } finally {
        client.release();
    }
});



// ==========================================
// API 5: Record a production run
// ==========================================

app.post("/api/production", async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        const {
            run_number,
            bom_id,
            batch_size = 1,
            actual_consumption,
            good_output_qty,
            rejected_output_qty = 0,
            production_date,
            notes
        } = req.body;

        // 1. Validate basic request details
        const batchSize = Number(batch_size);
        const goodOutput = Number(good_output_qty);
        const rejectedOutput = Number(rejected_output_qty);

        if (
            !run_number ||
            !Number.isInteger(Number(bom_id)) ||
            !Number.isFinite(batchSize) ||
            batchSize <= 0 ||
            !Array.isArray(actual_consumption) ||
            !Number.isFinite(goodOutput) ||
            goodOutput <= 0 ||
            !Number.isFinite(rejectedOutput) ||
            rejectedOutput < 0
        ) {
            return res.status(400).json({
                status: "error",
                message: "Please provide valid production details."
            });
        }

        await client.query("BEGIN");
        transactionStarted = true;

        // 2. Fetch the active BOM
        const bomResult = await client.query(
            `SELECT
                bom_id,
                product_id,
                batch_size,
                expected_output_qty,
                output_unit_id
             FROM bom_headers
             WHERE bom_id = $1
             AND is_active = TRUE`,
            [bom_id]
        );

        if (bomResult.rows.length === 0) {
            throw new Error("Active BOM not found.");
        }

        const bom = bomResult.rows[0];

        // 3. Fetch planned material quantities
        const bomItemsResult = await client.query(
            `SELECT
                bi.material_id,
                rm.material_name,
                bi.required_quantity,
                bi.unit_id
             FROM bom_items bi
             JOIN raw_materials rm
                ON bi.material_id = rm.material_id
             WHERE bi.bom_id = $1
             ORDER BY bi.material_id`,
            [bom_id]
        );

        const bomItems = bomItemsResult.rows;

        if (bomItems.length === 0) {
            throw new Error("No materials found in the selected BOM.");
        }

        // 4. Check actual consumption against the BOM
        if (actual_consumption.length !== bomItems.length) {
            throw new Error(
                "Actual consumption must contain every material in the BOM exactly once."
            );
        }

        const actualMap = new Map();

        for (const item of actual_consumption) {
            const materialId = Number(item.material_id);
            const quantity = Number(item.quantity);
            const unitId = Number(item.unit_id);

            if (
                !Number.isInteger(materialId) ||
                !Number.isInteger(unitId) ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                actualMap.has(materialId)
            ) {
                throw new Error("Invalid or duplicate material consumption.");
            }

            actualMap.set(materialId, {
                quantity,
                unit_id: unitId
            });
        }

        const consumptionRecords = [];

        for (const bomItem of bomItems) {
            const materialId = Number(bomItem.material_id);
            const actual = actualMap.get(materialId);

            if (!actual) {
                throw new Error(
                    `Actual consumption missing for ${bomItem.material_name}.`
                );
            }

            if (actual.unit_id !== Number(bomItem.unit_id)) {
                throw new Error(
                    `Incorrect unit for ${bomItem.material_name}.`
                );
            }

            const plannedQuantity = Number(
                (Number(bomItem.required_quantity) * batchSize).toFixed(3)
            );

            consumptionRecords.push({
                material_id: materialId,
                material_name: bomItem.material_name,
                planned_quantity: plannedQuantity,
                actual_quantity: actual.quantity,
                unit_id: actual.unit_id,
                variance: Number(
                    (actual.quantity - plannedQuantity).toFixed(3)
                )
            });
        }

        // 5. Lock material records to protect concurrent production updates
        const materialIds = consumptionRecords.map(
            item => item.material_id
        );

        await client.query(
            `SELECT material_id
             FROM raw_materials
             WHERE material_id = ANY($1::int[])
             FOR UPDATE`,
            [materialIds]
        );

        // 6. Verify sufficient raw material stock
        for (const item of consumptionRecords) {
            const stockResult = await client.query(
                `SELECT COALESCE(
                    SUM(
                        CASE
                            WHEN movement_type IN (
                                'OPENING',
                                'PURCHASE',
                                'PRODUCTION_OUTPUT',
                                'RETURN',
                                'ADJUSTMENT'
                            )
                            THEN quantity

                            WHEN movement_type IN (
                                'PRODUCTION_ISSUE',
                                'DISPATCH',
                                'WASTAGE'
                            )
                            THEN -quantity

                            ELSE 0
                        END
                    ), 0
                 ) AS current_stock
                 FROM stock_movements
                 WHERE material_id = $1
                 AND unit_id = $2`,
                [item.material_id, item.unit_id]
            );

            const availableStock = Number(
                stockResult.rows[0].current_stock
            );

            if (availableStock < item.actual_quantity) {
                throw new Error(
                    `Insufficient stock for ${item.material_name}. ` +
                    `Available: ${availableStock}, Required: ${item.actual_quantity}.`
                );
            }
        }

        // 7. Calculate expected production output
        const plannedOutput = Number(
            (Number(bom.expected_output_qty) * batchSize).toFixed(3)
        );

        const yieldPercentage = Number(
            ((goodOutput / plannedOutput) * 100).toFixed(2)
        );

        const yieldVariance = Number(
            (yieldPercentage - 100).toFixed(2)
        );

        // 8. Create production run
        const runResult = await client.query(
            `INSERT INTO production_runs
             (
                run_number,
                bom_id,
                product_id,
                batch_size,
                planned_output_qty,
                status,
                production_date,
                notes,
                completed_at
             )
             VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                'POSTED',
                COALESCE($6::date, CURRENT_DATE),
                $7,
                CURRENT_TIMESTAMP
             )
             RETURNING production_run_id`,
            [
                run_number,
                bom_id,
                bom.product_id,
                batchSize,
                plannedOutput,
                production_date || null,
                notes || null
            ]
        );

        const productionRunId =
            runResult.rows[0].production_run_id;

        // 9. Record consumption and deduct raw material stock
        for (const item of consumptionRecords) {

            await client.query(
                `INSERT INTO production_consumption
                 (
                    production_run_id,
                    material_id,
                    planned_quantity,
                    actual_quantity,
                    unit_id,
                    remarks
                 )
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    productionRunId,
                    item.material_id,
                    item.planned_quantity,
                    item.actual_quantity,
                    item.unit_id,
                    "Production material consumption"
                ]
            );

            await client.query(
                `INSERT INTO stock_movements
                 (
                    material_id,
                    product_id,
                    movement_type,
                    quantity,
                    unit_id,
                    source_type,
                    source_id,
                    movement_date,
                    remarks
                 )
                 VALUES (
                    $1,
                    NULL,
                    'PRODUCTION_ISSUE',
                    $2,
                    $3,
                    'PRODUCTION',
                    $4,
                    COALESCE($5::timestamp, CURRENT_TIMESTAMP),
                    $6
                 )`,
                [
                    item.material_id,
                    item.actual_quantity,
                    item.unit_id,
                    productionRunId,
                    production_date || null,
                    `Material consumed in run ${run_number}`
                ]
            );
        }

        // 10. Record good finished product output
        await client.query(
            `INSERT INTO production_outputs
             (
                production_run_id,
                product_id,
                output_type,
                output_quantity,
                unit_id,
                remarks
             )
             VALUES ($1, $2, 'GOOD', $3, $4, $5)`,
            [
                productionRunId,
                bom.product_id,
                goodOutput,
                bom.output_unit_id,
                "Good finished product"
            ]
        );

        // 11. Record rejected output separately, if any
        if (rejectedOutput > 0) {
            await client.query(
                `INSERT INTO production_outputs
                 (
                    production_run_id,
                    product_id,
                    output_type,
                    output_quantity,
                    unit_id,
                    remarks
                 )
                 VALUES ($1, $2, 'REJECTED', $3, $4, $5)`,
                [
                    productionRunId,
                    bom.product_id,
                    rejectedOutput,
                    bom.output_unit_id,
                    "Rejected finished product"
                ]
            );
        }

        // 12. Add only good finished goods to inventory
        await client.query(
            `INSERT INTO stock_movements
             (
                material_id,
                product_id,
                movement_type,
                quantity,
                unit_id,
                source_type,
                source_id,
                movement_date,
                remarks
             )
             VALUES (
                NULL,
                $1,
                'PRODUCTION_OUTPUT',
                $2,
                $3,
                'PRODUCTION',
                $4,
                COALESCE($5::timestamp, CURRENT_TIMESTAMP),
                $6
             )`,
            [
                bom.product_id,
                goodOutput,
                bom.output_unit_id,
                productionRunId,
                production_date || null,
                `Good output from run ${run_number}`
            ]
        );

        // 13. Commit the complete production transaction
        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            status: "success",
            message: "Production completed and inventory updated.",
            production_run_id: productionRunId,
            run_number,
            planned_output: plannedOutput,
            good_output: goodOutput,
            rejected_output: rejectedOutput,
            yield_percentage: yieldPercentage,
            yield_variance_percentage: yieldVariance,
            material_consumption: consumptionRecords
        });

    } catch (error) {

        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Production API error:", error.message);

        res.status(400).json({
            status: "error",
            message: error.message
        });

    } finally {
        client.release();
    }
});



// ==========================================
// API 6: Create a customer sales order
// ==========================================

app.post("/api/sales-orders", async (req, res) => {
    let client;

    try {
        const {
            order_number,
            customer_id,
            order_date,
            remarks,
            items
        } = req.body;

        // Validate the request before opening a database connection.
        const customerId = Number(customer_id);

        if (
            typeof order_number !== "string" ||
            order_number.trim() === "" ||
            !Number.isInteger(customerId) ||
            customerId <= 0 ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                status: "error",
                message: "A valid order number, customer ID and at least one item are required."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        // Verify that the customer exists.
        const customerResult = await client.query(
            `SELECT
                customer_id,
                customer_name,
                state,
                state_code
             FROM customers
             WHERE customer_id = $1`,
            [customerId]
        );

        if (customerResult.rows.length === 0) {
            throw new Error("Customer does not exist.");
        }

        const customer = customerResult.rows[0];

        // Prepare and validate all order items before inserting the order.
        const preparedItems = [];

        let subtotal = 0;
        let totalTax = 0;
        let grandTotal = 0;

        for (const item of items) {
            const productId = Number(item.product_id);
            const quantity = Number(item.quantity);
            const discount = Number(item.discount_amount ?? 0);

            if (
                !Number.isInteger(productId) ||
                productId <= 0 ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(discount) ||
                discount < 0
            ) {
                throw new Error(
                    "Each item must have a valid product ID, positive quantity and non-negative discount."
                );
            }

            // Fetch trusted price, GST rate and unit from the database.
            // Do not accept these values from the client request.
            const productResult = await client.query(
                `SELECT
                    product_id,
                    product_code,
                    product_name,
                    selling_price,
                    gst_rate,
                    unit_id
                 FROM products
                 WHERE product_id = $1
                 AND is_active = TRUE
                 FOR SHARE`,
                [productId]
            );

            if (productResult.rows.length === 0) {
                throw new Error(
                    `Product ID ${productId} does not exist or is inactive.`
                );
            }

            const product = productResult.rows[0];

            const unitPrice = Number(product.selling_price);
            const gstRate = Number(product.gst_rate);

            const grossAmount = Number(
                (quantity * unitPrice).toFixed(2)
            );

            if (discount > grossAmount) {
                throw new Error(
                    `Discount cannot exceed the amount for ${product.product_name}.`
                );
            }

            const taxableAmount = Number(
                (grossAmount - discount).toFixed(2)
            );

            const taxAmount = Number(
                (taxableAmount * gstRate / 100).toFixed(2)
            );

            const totalAmount = Number(
                (taxableAmount + taxAmount).toFixed(2)
            );

            preparedItems.push({
                product_id: product.product_id,
                product_name: product.product_name,
                quantity,
                unit_id: product.unit_id,
                unit_price: unitPrice,
                discount_amount: discount,
                gst_rate: gstRate,
                taxable_amount: taxableAmount,
                tax_amount: taxAmount,
                total_amount: totalAmount
            });

            subtotal += taxableAmount;
            totalTax += taxAmount;
            grandTotal += totalAmount;
        }

        subtotal = Number(subtotal.toFixed(2));
        totalTax = Number(totalTax.toFixed(2));
        grandTotal = Number(grandTotal.toFixed(2));

        // Create the order header.
        const orderResult = await client.query(
            `INSERT INTO sales_order_headers
             (
                order_number,
                customer_id,
                order_date,
                status,
                remarks
             )
             VALUES (
                $1,
                $2,
                COALESCE($3::date, CURRENT_DATE),
                'PENDING',
                $4
             )
             RETURNING
                order_id,
                order_number,
                order_date,
                status`,
            [
                order_number.trim(),
                customerId,
                order_date || null,
                remarks || null
            ]
        );

        const order = orderResult.rows[0];

        // Save all order lines.
        for (const item of preparedItems) {
            await client.query(
                `INSERT INTO sales_order_items
                 (
                    order_id,
                    product_id,
                    quantity,
                    unit_id,
                    unit_price,
                    discount_amount,
                    gst_rate,
                    taxable_amount,
                    tax_amount,
                    total_amount
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    order.order_id,
                    item.product_id,
                    item.quantity,
                    item.unit_id,
                    item.unit_price,
                    item.discount_amount,
                    item.gst_rate,
                    item.taxable_amount,
                    item.tax_amount,
                    item.total_amount
                ]
            );
        }

        // Commit the order and its items together.
        await client.query("COMMIT");

        res.status(201).json({
            status: "success",
            message: "Sales order created successfully. It is waiting for admin approval.",
            order_id: order.order_id,
            order_number: order.order_number,
            customer: {
                customer_id: customer.customer_id,
                customer_name: customer.customer_name,
                state: customer.state,
                state_code: customer.state_code
            },
            order_date: order.order_date,
            order_status: order.status,
            subtotal,
            tax_amount: totalTax,
            total_amount: grandTotal,
            items: preparedItems
        });

    } catch (error) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Sales order rollback error:",
                    rollbackError.message
                );
            }
        }

        console.error("Sales Order API error:", error.message);

        const isDuplicateOrder = error.code === "23505";

        res.status(isDuplicateOrder ? 409 : 400).json({
            status: "error",
            message: isDuplicateOrder
                ? "This order number already exists. Use a different order number."
                : error.message
        });

    } finally {
        if (client) {
            client.release();
        }
    }
});


// ==========================================
// ADMIN API 1: View all pending sales orders
// ==========================================

app.get("/api/admin/sales-orders", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                soh.order_id,
                soh.order_number,
                soh.order_date,
                soh.status,
                soh.remarks,
                c.customer_id,
                c.customer_name,
                c.customer_type,
                c.state,
                c.state_code,
                COUNT(soi.order_item_id) AS total_items,
                COALESCE(SUM(soi.total_amount), 0) AS order_total
             FROM sales_order_headers soh
             JOIN customers c
                ON soh.customer_id = c.customer_id
             LEFT JOIN sales_order_items soi
                ON soh.order_id = soi.order_id
             WHERE soh.status = 'PENDING'
             GROUP BY
                soh.order_id,
                c.customer_id
             ORDER BY soh.order_date DESC, soh.order_id DESC`
        );

        res.status(200).json({
            status: "success",
            total_orders: result.rows.length,
            orders: result.rows
        });

    } catch (error) {
        console.error("Pending orders API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve pending orders."
        });
    }
});


// ==========================================
// ADMIN API 2: View one sales order in detail
// ==========================================

app.get("/api/admin/sales-orders/:orderId", async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid order ID."
            });
        }

        const orderResult = await pool.query(
            `SELECT
                soh.order_id,
                soh.order_number,
                soh.order_date,
                soh.status,
                soh.remarks,
                c.customer_id,
                c.customer_name,
                c.customer_type,
                c.phone,
                c.email,
                c.gstin,
                c.address,
                c.city,
                c.state,
                c.state_code,
                c.pincode
             FROM sales_order_headers soh
             JOIN customers c
                ON soh.customer_id = c.customer_id
             WHERE soh.order_id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Sales order not found."
            });
        }

        const itemsResult = await pool.query(
            `SELECT
                soi.order_item_id,
                soi.product_id,
                p.product_code,
                p.product_name,
                soi.quantity,
                soi.unit_id,
                u.unit_code,
                soi.unit_price,
                soi.discount_amount,
                soi.gst_rate,
                soi.taxable_amount,
                soi.tax_amount,
                soi.total_amount
             FROM sales_order_items soi
             JOIN products p
                ON soi.product_id = p.product_id
             JOIN units u
                ON soi.unit_id = u.unit_id
             WHERE soi.order_id = $1
             ORDER BY soi.order_item_id`,
            [orderId]
        );

        res.status(200).json({
            status: "success",
            order: orderResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {
        console.error("Order details API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve order details."
        });
    }
});


// ==========================================
// ADMIN API 3: Approve a pending sales order
// ==========================================

app.patch("/api/admin/sales-orders/:orderId/approve", async (req, res) => {
    let client;

    try {
        const orderId = Number(req.params.orderId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid order ID."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        // Lock the order so it cannot be approved twice.
        const orderResult = await client.query(
            `SELECT order_id, order_number, status
             FROM sales_order_headers
             WHERE order_id = $1
             FOR UPDATE`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                status: "error",
                message: "Sales order not found."
            });
        }

        const order = orderResult.rows[0];

        if (order.status !== "PENDING") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                status: "error",
                message: `Only PENDING orders can be approved. Current status: ${order.status}.`
            });
        }

        // Read the products and quantities in this order.
        const itemsResult = await client.query(
            `SELECT
                soi.product_id,
                p.product_name,
                soi.quantity,
                soi.unit_id
             FROM sales_order_items soi
             JOIN products p
                ON soi.product_id = p.product_id
             WHERE soi.order_id = $1`,
            [orderId]
        );

        if (itemsResult.rows.length === 0) {
            throw new Error("This order has no items.");
        }

        const stockChecks = [];

        // Check the stock of every ordered product.
        for (const item of itemsResult.rows) {

            // Lock the product row to serialize approvals
            // for the same product.
            await client.query(
                `SELECT product_id
                 FROM products
                 WHERE product_id = $1
                 FOR UPDATE`,
                [item.product_id]
            );

            const stockResult = await client.query(
                `SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN movement_type IN (
                                    'OPENING',
                                    'PURCHASE',
                                    'PRODUCTION_OUTPUT',
                                    'RETURN',
                                    'ADJUSTMENT'
                                )
                                THEN quantity

                                WHEN movement_type IN (
                                    'PRODUCTION_ISSUE',
                                    'DISPATCH',
                                    'WASTAGE'
                                )
                                THEN -quantity

                                ELSE 0
                            END
                        ),
                        0
                    ) AS available_stock
                 FROM stock_movements
                 WHERE product_id = $1
                 AND unit_id = $2`,
                [item.product_id, item.unit_id]
            );

            const availableStock = Number(
                stockResult.rows[0].available_stock
            );

            const requestedQuantity = Number(item.quantity);

            stockChecks.push({
                product_id: item.product_id,
                product_name: item.product_name,
                requested_quantity: requestedQuantity,
                available_stock: availableStock,
                sufficient: availableStock >= requestedQuantity
            });

            if (availableStock < requestedQuantity) {
                throw new Error(
                    `Insufficient stock for ${item.product_name}. ` +
                    `Available: ${availableStock}, ` +
                    `Requested: ${requestedQuantity}.`
                );
            }
        }

        // Approve only after all products pass the stock check.
        const updateResult = await client.query(
            `UPDATE sales_order_headers
             SET status = 'APPROVED'
             WHERE order_id = $1
             AND status = 'PENDING'
             RETURNING order_id, order_number, status`,
            [orderId]
        );

        if (updateResult.rows.length === 0) {
            throw new Error("Order status changed before approval.");
        }

        await client.query("COMMIT");

        res.status(200).json({
            status: "success",
            message: "Sales order approved successfully.",
            order: updateResult.rows[0],
            stock_checks: stockChecks,
            inventory_deducted: false
        });

    } catch (error) {

        if (client) {
            await client.query("ROLLBACK");
        }

        console.error("Order approval error:", error.message);

        res.status(400).json({
            status: "error",
            message: error.message
        });

    } finally {
        if (client) {
            client.release();
        }
    }
});


// ==========================================
// ADMIN API 4: Reject a pending sales order
// ==========================================

app.patch("/api/admin/sales-orders/:orderId/reject", async (req, res) => {
    let client;

    try {
        const orderId = Number(req.params.orderId);
        const reason = req.body.reason;

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid order ID."
            });
        }

        if (
            typeof reason !== "string" ||
            reason.trim().length < 3
        ) {
            return res.status(400).json({
                status: "error",
                message: "Please provide a rejection reason of at least 3 characters."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const orderResult = await client.query(
            `SELECT order_id, order_number, status
             FROM sales_order_headers
             WHERE order_id = $1
             FOR UPDATE`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                status: "error",
                message: "Sales order not found."
            });
        }

        const order = orderResult.rows[0];

        if (order.status !== "PENDING") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                status: "error",
                message: `Only PENDING orders can be rejected. Current status: ${order.status}.`
            });
        }


        const updateResult = await client.query(
            `UPDATE sales_order_headers
     SET
        status = 'REJECTED',
        remarks = CONCAT(
            COALESCE(remarks, ''),
            CASE
                WHEN COALESCE(remarks, '') = '' THEN ''
                ELSE E'\\n'
            END,
            'Rejection reason: ',
            $2::text
        )
     WHERE order_id = $1
     RETURNING order_id, order_number, status, remarks`,
            [orderId, reason.trim()]
        );

        await client.query("COMMIT");

        res.status(200).json({
            status: "success",
            message: "Sales order rejected successfully.",
            order: updateResult.rows[0]
        });

    } catch (error) {

        if (client) {
            await client.query("ROLLBACK");
        }

        console.error("Order rejection error:", error.message);

        res.status(400).json({
            status: "error",
            message: error.message
        });

    } finally {
        if (client) {
            client.release();
        }
    }
});


// ==========================================
// ADMIN API 5: Generate GST invoice
// ==========================================

app.post("/api/admin/sales-orders/:orderId/invoice", async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
        const orderId = Number(req.params.orderId);
        const invoiceDateInput = req.body.invoice_date || null;

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid order ID."
            });
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // 1. Lock the order and retrieve customer details.
        const orderResult = await client.query(
            `SELECT
                soh.order_id,
                soh.order_number,
                soh.status,
                c.customer_id,
                c.customer_name,
                c.state,
                c.state_code
             FROM sales_order_headers soh
             JOIN customers c
                ON soh.customer_id = c.customer_id
             WHERE soh.order_id = $1
             FOR UPDATE OF soh`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            throw new Error("Sales order not found.");
        }

        const order = orderResult.rows[0];

        if (order.status !== "APPROVED") {
            throw new Error(
                `Only APPROVED orders can be invoiced. Current status: ${order.status}.`
            );
        }

        // 2. Check whether an invoice already exists.
        const existingInvoice = await client.query(
            `SELECT invoice_id, invoice_number
             FROM invoice_headers
             WHERE order_id = $1`,
            [orderId]
        );

        if (existingInvoice.rows.length > 0) {
            throw new Error(
                `Invoice already exists: ${existingInvoice.rows[0].invoice_number}.`
            );
        }

        // 3. Get the invoice date from PostgreSQL.
        const dateResult = await client.query(
            `SELECT COALESCE($1::date, CURRENT_DATE)::text AS invoice_date`,
            [invoiceDateInput]
        );

        const invoiceDate = dateResult.rows[0].invoice_date;

        // 4. Determine the financial year.
        const dateParts = invoiceDate.split("-");
        const year = Number(dateParts[0]);
        const month = Number(dateParts[1]);

        const financialYearStart = month >= 4 ? year : year - 1;
        const financialYearEnd = String(
            financialYearStart + 1
        ).slice(-2);

        const financialYear =
            `${financialYearStart}-${financialYearEnd}`;

        const invoicePrefix = `INV/${financialYear}`;

        // 5. Lock invoice numbering for this financial year.
        await client.query(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            [invoicePrefix]
        );

        const numberResult = await client.query(
            `SELECT COUNT(*)::integer + 1 AS next_number
             FROM invoice_headers
             WHERE invoice_number LIKE $1`,
            [`${invoicePrefix}/%`]
        );

        const nextNumber = numberResult.rows[0].next_number;

        const invoiceNumber =
            `${invoicePrefix}/${String(nextNumber).padStart(4, "0")}`;

        // 6. Retrieve all order items.
        const itemsResult = await client.query(
            `SELECT
                soi.product_id,
                p.product_name,
                p.hsn_code,
                soi.quantity,
                soi.unit_price,
                soi.gst_rate,
                soi.taxable_amount
             FROM sales_order_items soi
             JOIN products p
                ON soi.product_id = p.product_id
             WHERE soi.order_id = $1
             ORDER BY soi.order_item_id`,
            [orderId]
        );

        if (itemsResult.rows.length === 0) {
            throw new Error("The sales order contains no items.");
        }

        // 7. Determine whether the sale is intra-state or inter-state.
        const sellerStateCode = "33";
        const customerStateCode = String(order.state_code).trim();

        if (!customerStateCode) {
            throw new Error("Customer state code is missing.");
        }

        const isIntraState =
            sellerStateCode === customerStateCode;

        // 8. Calculate GST for every invoice item.
        const invoiceItems = [];

        let taxableTotal = 0;
        let cgstTotal = 0;
        let sgstTotal = 0;
        let igstTotal = 0;
        let grandTotal = 0;

        for (const item of itemsResult.rows) {
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price);
            const gstRate = Number(item.gst_rate);
            const taxableAmount = Number(
                Number(item.taxable_amount).toFixed(2)
            );

            if (
                !Number.isFinite(quantity) ||
                !Number.isFinite(unitPrice) ||
                !Number.isFinite(gstRate) ||
                !Number.isFinite(taxableAmount) ||
                quantity <= 0 ||
                unitPrice < 0 ||
                gstRate < 0 ||
                taxableAmount < 0
            ) {
                throw new Error("Invalid sales order item amounts.");
            }

            let cgstAmount = 0;
            let sgstAmount = 0;
            let igstAmount = 0;

            if (isIntraState) {
                cgstAmount = Number(
                    (taxableAmount * gstRate / 200).toFixed(2)
                );

                sgstAmount = Number(
                    (taxableAmount * gstRate / 200).toFixed(2)
                );
            } else {
                igstAmount = Number(
                    (taxableAmount * gstRate / 100).toFixed(2)
                );
            }

            const itemTax = Number(
                (cgstAmount + sgstAmount + igstAmount).toFixed(2)
            );

            const itemTotal = Number(
                (taxableAmount + itemTax).toFixed(2)
            );

            invoiceItems.push({
                product_id: item.product_id,
                product_name: item.product_name,
                hsn_code: item.hsn_code,
                quantity,
                unit_price: unitPrice,
                gst_rate: gstRate,
                taxable_amount: taxableAmount,
                cgst_amount: cgstAmount,
                sgst_amount: sgstAmount,
                igst_amount: igstAmount,
                total_amount: itemTotal
            });

            taxableTotal += taxableAmount;
            cgstTotal += cgstAmount;
            sgstTotal += sgstAmount;
            igstTotal += igstAmount;
            grandTotal += itemTotal;
        }

        taxableTotal = Number(taxableTotal.toFixed(2));
        cgstTotal = Number(cgstTotal.toFixed(2));
        sgstTotal = Number(sgstTotal.toFixed(2));
        igstTotal = Number(igstTotal.toFixed(2));

        const totalTax = Number(
            (cgstTotal + sgstTotal + igstTotal).toFixed(2)
        );

        grandTotal = Number(grandTotal.toFixed(2));

        // 9. Save the invoice header.
        const invoiceResult = await client.query(
            `INSERT INTO invoice_headers
            (
                invoice_number,
                order_id,
                customer_id,
                invoice_date,
                place_of_supply,
                seller_state_code,
                customer_state_code,
                taxable_amount,
                cgst_amount,
                sgst_amount,
                igst_amount,
                total_tax,
                total_amount,
                payment_status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, 'UNPAID'
            )
            RETURNING invoice_id, invoice_number`,
            [
                invoiceNumber,
                order.order_id,
                order.customer_id,
                invoiceDate,
                order.state,
                sellerStateCode,
                customerStateCode,
                taxableTotal,
                cgstTotal,
                sgstTotal,
                igstTotal,
                totalTax,
                grandTotal
            ]
        );

        const invoice = invoiceResult.rows[0];

        // 10. Save all invoice items.
        for (const item of invoiceItems) {
            await client.query(
                `INSERT INTO invoice_items
                (
                    invoice_id,
                    product_id,
                    hsn_code,
                    quantity,
                    unit_price,
                    gst_rate,
                    taxable_amount,
                    cgst_amount,
                    sgst_amount,
                    igst_amount,
                    total_amount
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    invoice.invoice_id,
                    item.product_id,
                    item.hsn_code,
                    item.quantity,
                    item.unit_price,
                    item.gst_rate,
                    item.taxable_amount,
                    item.cgst_amount,
                    item.sgst_amount,
                    item.igst_amount,
                    item.total_amount
                ]
            );
        }

        // 11. Mark the sales order as invoiced.
        await client.query(
            `UPDATE sales_order_headers
             SET status = 'INVOICED'
             WHERE order_id = $1
             AND status = 'APPROVED'`,
            [orderId]
        );

        // 12. Commit all invoice changes together.
        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            status: "success",
            message: "GST invoice generated successfully.",
            invoice: {
                invoice_id: invoice.invoice_id,
                invoice_number: invoice.invoice_number,
                invoice_date: invoiceDate,
                order_number: order.order_number,
                customer_name: order.customer_name,
                place_of_supply: order.state,
                seller_state_code: sellerStateCode,
                customer_state_code: customerStateCode,
                tax_type: isIntraState ? "CGST + SGST" : "IGST",
                taxable_amount: taxableTotal,
                cgst_amount: cgstTotal,
                sgst_amount: sgstTotal,
                igst_amount: igstTotal,
                total_tax: totalTax,
                total_amount: grandTotal,
                payment_status: "UNPAID"
            },
            items: invoiceItems,
            inventory_deducted: false
        });

    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Invoice API error:", error.message);

        res.status(400).json({
            status: "error",
            message: error.message
        });

    } finally {
        if (client) {
            client.release();
        }
    }
});


// ==========================================
// ADMIN API: Create dispatch and deduct stock
// ==========================================

app.post("/api/admin/invoices/:invoiceId/dispatch", async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
        const invoiceId = Number(req.params.invoiceId);

        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid invoice ID."
            });
        }

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // STEP 1: Lock and retrieve invoice and order.
        const invoiceResult = await client.query(
            `SELECT
                ih.invoice_id,
                ih.invoice_number,
                ih.order_id,
                soh.order_number,
                soh.status AS order_status
             FROM invoice_headers ih
             JOIN sales_order_headers soh
                ON ih.order_id = soh.order_id
             WHERE ih.invoice_id = $1
             FOR UPDATE OF ih, soh`,
            [invoiceId]
        );

        if (invoiceResult.rows.length === 0) {
            throw new Error("Invoice not found.");
        }

        const invoice = invoiceResult.rows[0];

        if (invoice.order_status !== "INVOICED") {
            throw new Error(
                `Only INVOICED orders can be dispatched. Current status: ${invoice.order_status}.`
            );
        }

        // STEP 2: Prevent duplicate dispatches.
        const existingDispatch = await client.query(
            `SELECT dispatch_id, dispatch_number
             FROM dispatches
             WHERE invoice_id = $1`,
            [invoiceId]
        );

        if (existingDispatch.rows.length > 0) {
            throw new Error(
                `This invoice has already been dispatched. Dispatch number: ${existingDispatch.rows[0].dispatch_number}.`
            );
        }

        // STEP 3: Retrieve invoiced products and quantities.
        const itemsResult = await client.query(
            `SELECT
                ii.product_id,
                p.product_name,
                p.unit_id,
                SUM(ii.quantity)::numeric AS quantity
             FROM invoice_items ii
             JOIN products p
                ON ii.product_id = p.product_id
             WHERE ii.invoice_id = $1
             GROUP BY
                ii.product_id,
                p.product_name,
                p.unit_id
             ORDER BY ii.product_id`,
            [invoiceId]
        );

        if (itemsResult.rows.length === 0) {
            throw new Error("No products found in this invoice.");
        }

        // STEP 4: Generate a financial-year dispatch number.
        const dateResult = await client.query(
            `SELECT
                EXTRACT(YEAR FROM CURRENT_DATE)::integer AS yr,
                EXTRACT(MONTH FROM CURRENT_DATE)::integer AS mon,
                CURRENT_DATE AS dispatch_date`
        );

        const { yr, mon, dispatch_date } = dateResult.rows[0];

        const startYear = mon >= 4 ? yr : yr - 1;
        const endYear = String(startYear + 1).slice(-2);

        const prefix = `DSP/${startYear}-${endYear}`;

        await client.query(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            [prefix]
        );

        const countResult = await client.query(
            `SELECT COUNT(*)::integer + 1 AS next_number
             FROM dispatches
             WHERE dispatch_number LIKE $1`,
            [`${prefix}/%`]
        );

        const nextNumber = countResult.rows[0].next_number;

        const dispatchNumber =
            `${prefix}/${String(nextNumber).padStart(4, "0")}`;

        // STEP 5: Lock products and verify available stock.
        const dispatchItems = [];

        for (const item of itemsResult.rows) {
            const productId = Number(item.product_id);
            const requiredQuantity = Number(item.quantity);
            const unitId = Number(item.unit_id);

            if (
                !Number.isFinite(requiredQuantity) ||
                requiredQuantity <= 0
            ) {
                throw new Error(
                    `Invalid quantity for ${item.product_name}.`
                );
            }

            await client.query(
                `SELECT product_id
                 FROM products
                 WHERE product_id = $1
                 FOR UPDATE`,
                [productId]
            );

            const stockResult = await client.query(
                `SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN movement_type IN (
                                    'OPENING',
                                    'PURCHASE',
                                    'PRODUCTION_OUTPUT',
                                    'RETURN',
                                    'ADJUSTMENT'
                                )
                                THEN quantity

                                WHEN movement_type IN (
                                    'PRODUCTION_ISSUE',
                                    'DISPATCH',
                                    'WASTAGE'
                                )
                                THEN -quantity

                                ELSE 0
                            END
                        ),
                        0
                    ) AS available_stock
                 FROM stock_movements
                 WHERE product_id = $1`,
                [productId]
            );

            const availableStock = Number(
                stockResult.rows[0].available_stock
            );

            if (availableStock < requiredQuantity) {
                throw new Error(
                    `Insufficient stock for ${item.product_name}. ` +
                    `Available: ${availableStock}, Required: ${requiredQuantity}.`
                );
            }

            dispatchItems.push({
                product_id: productId,
                product_name: item.product_name,
                quantity: requiredQuantity,
                unit_id: unitId,
                available_stock: availableStock
            });
        }

        // STEP 6: Create the dispatch record.
        const dispatchResult = await client.query(
            `INSERT INTO dispatches
            (
                dispatch_number,
                invoice_id,
                dispatch_date,
                status,
                remarks
            )
            VALUES ($1, $2, $3, 'DISPATCHED', $4)
            RETURNING
                dispatch_id,
                dispatch_number,
                invoice_id,
                dispatch_date,
                status`,
            [
                dispatchNumber,
                invoiceId,
                dispatch_date,
                `Dispatch created for invoice ${invoice.invoice_number}`
            ]
        );

        const dispatch = dispatchResult.rows[0];

        // STEP 7: Record finished-goods stock deductions.
        for (const item of dispatchItems) {
            await client.query(
                `INSERT INTO stock_movements
                (
                    material_id,
                    product_id,
                    movement_type,
                    quantity,
                    unit_id,
                    source_type,
                    source_id,
                    movement_date,
                    remarks
                )
                VALUES (
                    NULL, $1, 'DISPATCH', $2, $3,
                    'DISPATCH', $4, CURRENT_TIMESTAMP, $5
                )`,
                [
                    item.product_id,
                    item.quantity,
                    item.unit_id,
                    dispatch.dispatch_id,
                    `Dispatched against invoice ${invoice.invoice_number}`
                ]
            );
        }

        // STEP 8: Update the sales order status.
        await client.query(
            `UPDATE sales_order_headers
             SET status = 'DISPATCHED'
             WHERE order_id = $1
             AND status = 'INVOICED'`,
            [invoice.order_id]
        );

        // STEP 9: Commit all changes.
        await client.query("COMMIT");
        transactionStarted = false;

        res.status(201).json({
            status: "success",
            message: "Dispatch created and finished stock deducted successfully.",
            dispatch: {
                dispatch_id: dispatch.dispatch_id,
                dispatch_number: dispatch.dispatch_number,
                invoice_id: dispatch.invoice_id,
                invoice_number: invoice.invoice_number,
                order_number: invoice.order_number,
                dispatch_date: dispatch.dispatch_date,
                status: dispatch.status
            },
            items: dispatchItems.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                dispatched_quantity: item.quantity,
                unit_id: item.unit_id,
                previous_stock: item.available_stock,
                remaining_stock:
                    item.available_stock - item.quantity
            }))
        });

    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error("Dispatch API error:", error.message);

        res.status(400).json({
            status: "error",
            message: error.message
        });

    } finally {
        if (client) {
            client.release();
        }
    }
});


app.post("/api/admin/invoices/:invoiceId/payments", async (req, res) => {
    let client;

    try {
        const invoiceId = Number(req.params.invoiceId);
        const amount = Number(req.body.amount);
        const paymentMethod = req.body.payment_method || "CASH";
        const referenceNumber = req.body.reference_number || null;
        const remarks = req.body.remarks || null;

        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid invoice ID."
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Payment amount must be greater than zero."
            });
        }

        client = await pool.connect();
        await client.query("BEGIN");

        const invoiceResult = await client.query(
            `SELECT invoice_id, customer_id, total_amount
             FROM invoice_headers
             WHERE invoice_id = $1
             FOR UPDATE`,
            [invoiceId]
        );

        if (invoiceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                status: "error",
                message: "Invoice not found."
            });
        }

        const invoice = invoiceResult.rows[0];

        const paymentTotalResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS paid_amount
             FROM customer_payments
             WHERE invoice_id = $1`,
            [invoiceId]
        );

        const paidBefore = Number(
            paymentTotalResult.rows[0].paid_amount
        );

        const invoiceTotal = Number(invoice.total_amount);
        const outstandingBefore = invoiceTotal - paidBefore;

        if (amount > outstandingBefore + 0.001) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                status: "error",
                message: "Payment exceeds the outstanding invoice amount.",
                outstanding_amount: outstandingBefore
            });
        }

        const paymentResult = await client.query(
            `INSERT INTO customer_payments
             (
                invoice_id,
                customer_id,
                payment_date,
                amount,
                payment_method,
                reference_number,
                remarks
             )
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)
             RETURNING *`,
            [
                invoiceId,
                invoice.customer_id,
                amount,
                paymentMethod,
                referenceNumber,
                remarks
            ]
        );

        const totalPaid = paidBefore + amount;
        const outstanding = Math.max(0, invoiceTotal - totalPaid);

        let paymentStatus = "PARTIAL";

        if (outstanding <= 0.001) {
            paymentStatus = "PAID";
        } else if (totalPaid <= 0.001) {
            paymentStatus = "UNPAID";
        }

        await client.query(
            `UPDATE invoice_headers
             SET payment_status = $1
             WHERE invoice_id = $2`,
            [paymentStatus, invoiceId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            status: "success",
            message: "Customer payment recorded successfully.",
            payment: paymentResult.rows[0],
            invoice_total: invoiceTotal,
            total_paid: totalPaid,
            outstanding_amount: outstanding,
            payment_status: paymentStatus
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }

        console.error("Payment recording error:", error.message);

        res.status(500).json({
            status: "error",
            message: error.message
        });

    } finally {
        if (client) {
            client.release();
        }
    }
});



// ==========================================
// ADMIN API: View all generated invoices
// ==========================================

app.get("/api/admin/invoices", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ih.invoice_id,
                ih.invoice_number,
                ih.invoice_date,
                ih.order_id,
                soh.order_number,
                c.customer_name,
                c.customer_type,
                c.gstin,
                c.state,
                ih.taxable_amount,
                ih.cgst_amount,
                ih.sgst_amount,
                ih.igst_amount,
                ih.total_tax,
                ih.total_amount,
                ih.payment_status,

                COALESCE(pay.paid_amount, 0) AS paid_amount,

                GREATEST(
                    ih.total_amount - COALESCE(pay.paid_amount, 0),
                    0
                ) AS outstanding_amount,

                d.dispatch_number,
                d.dispatch_date,
                d.status AS dispatch_status

            FROM invoice_headers ih

            JOIN customers c
                ON ih.customer_id = c.customer_id

            JOIN sales_order_headers soh
                ON ih.order_id = soh.order_id

            LEFT JOIN (
                SELECT
                    invoice_id,
                    SUM(amount) AS paid_amount
                FROM customer_payments
                GROUP BY invoice_id
            ) pay
                ON ih.invoice_id = pay.invoice_id

            LEFT JOIN dispatches d
                ON ih.invoice_id = d.invoice_id

            ORDER BY ih.invoice_date DESC, ih.invoice_id DESC
        `);

        res.status(200).json({
            status: "success",
            total_invoices: result.rows.length,
            invoices: result.rows
        });

    } catch (error) {
        console.error("Invoice listing error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve invoices."
        });
    }
});


// ==========================================
// ADMIN API: View one invoice with its items
// ==========================================

app.get("/api/admin/invoices/:invoiceId", async (req, res) => {
    try {
        const { invoiceId } = req.params;

        if (!/^\d+$/.test(invoiceId)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid invoice ID."
            });
        }

        const invoiceResult = await pool.query(`
            SELECT
                ih.*,
                c.customer_name,
                c.customer_type,
                c.gstin,
                c.state,
                c.state_code
            FROM invoice_headers ih
            JOIN customers c
                ON ih.customer_id = c.customer_id
            WHERE ih.invoice_id = $1
        `, [invoiceId]);

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Invoice not found."
            });
        }

        const itemsResult = await pool.query(`
            SELECT
                ii.invoice_item_id,
                ii.invoice_id,
                ii.product_id,
                p.product_code,
                p.product_name,
                ii.hsn_code,
                ii.quantity,
                ii.unit_price,
                ii.gst_rate,
                ii.taxable_amount,
                ii.cgst_amount,
                ii.sgst_amount,
                ii.igst_amount,
                ii.total_amount
            FROM invoice_items ii
            JOIN products p
                ON ii.product_id = p.product_id
            WHERE ii.invoice_id = $1
            ORDER BY ii.invoice_item_id
        `, [invoiceId]);

        res.status(200).json({
            status: "success",
            invoice: invoiceResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {
        console.error("Invoice details error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve invoice details."
        });
    }
});


// ==========================================
// PRODUCTION API: Get all active BOMs
// ==========================================

app.get("/api/bom", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                bh.bom_id,
                bh.product_id,
                p.product_name,
                bh.batch_size,
                bh.expected_output_qty,
                bh.output_unit_id,
                u.unit_code AS output_unit
            FROM bom_headers bh
            JOIN products p
                ON bh.product_id = p.product_id
            JOIN units u
                ON bh.output_unit_id = u.unit_id
            WHERE bh.is_active = TRUE
            ORDER BY bh.bom_id;
        `);

        res.status(200).json({
            status: "success",
            total_boms: result.rows.length,
            boms: result.rows
        });

    } catch (error) {
        console.error("BOM list API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve BOM list."
        });
    }
});


// ==========================================
// PRODUCTION API: Get BOM details and materials
// ==========================================

app.get("/api/bom/:bomId", async (req, res) => {
    try {
        const bomId = Number(req.params.bomId);

        if (!Number.isInteger(bomId) || bomId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid BOM ID."
            });
        }

        const bomResult = await pool.query(`
            SELECT
                bh.bom_id,
                bh.product_id,
                p.product_name,
                bh.batch_size,
                bh.expected_output_qty,
                bh.output_unit_id,
                u.unit_code AS output_unit
            FROM bom_headers bh
            JOIN products p
                ON bh.product_id = p.product_id
            JOIN units u
                ON bh.output_unit_id = u.unit_id
            WHERE bh.bom_id = $1
            AND bh.is_active = TRUE;
        `, [bomId]);

        if (bomResult.rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Active BOM not found."
            });
        }

        const materialsResult = await pool.query(`
            SELECT
                bi.material_id,
                rm.material_name,
                bi.required_quantity,
                bi.unit_id,
                u.unit_code
            FROM bom_items bi
            JOIN raw_materials rm
                ON bi.material_id = rm.material_id
            JOIN units u
                ON bi.unit_id = u.unit_id
            WHERE bi.bom_id = $1
            ORDER BY bi.material_id;
        `, [bomId]);

        res.status(200).json({
            status: "success",
            bom: bomResult.rows[0],
            materials: materialsResult.rows
        });

    } catch (error) {
        console.error("BOM details API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve BOM details."
        });
    }
});


// ==========================================
// PRODUCTION API: Get production history
// ==========================================

app.get("/api/production", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                pr.production_run_id,
                pr.run_number,
                pr.production_date,
                pr.status,
                pr.batch_size,
                pr.planned_output_qty,
                p.product_name,

                COALESCE(
                    SUM(po.output_quantity)
                    FILTER (WHERE po.output_type = 'GOOD'),
                    0
                ) AS good_output_qty,

                COALESCE(
                    SUM(po.output_quantity)
                    FILTER (WHERE po.output_type = 'REJECTED'),
                    0
                ) AS rejected_output_qty

            FROM production_runs pr

            JOIN products p
                ON pr.product_id = p.product_id

            LEFT JOIN production_outputs po
                ON pr.production_run_id = po.production_run_id

            GROUP BY
                pr.production_run_id,
                p.product_name

            ORDER BY
                pr.production_date DESC,
                pr.production_run_id DESC;
        `);

        res.status(200).json({
            status: "success",
            total_runs: result.rows.length,
            production_runs: result.rows
        });

    } catch (error) {
        console.error("Production history API error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve production history."
        });
    }
});


/* ==========================================
   REPORTS MODULE - READ ONLY APIs
   ========================================== */

// Validate optional date filters
function getReportDateFilters(req) {
    const { from, to } = req.query;

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (from && !datePattern.test(from)) {
        throw new Error("Invalid start date. Use YYYY-MM-DD.");
    }

    if (to && !datePattern.test(to)) {
        throw new Error("Invalid end date. Use YYYY-MM-DD.");
    }

    if (from && to && from > to) {
        throw new Error("Start date cannot be after end date.");
    }

    return [from || null, to || null];
}


// ==========================================
// REPORT 1: SALES REGISTER
// ==========================================

app.get("/api/reports/sales", async (req, res) => {
    try {
        const dates = getReportDateFilters(req);

        const result = await pool.query(`
            SELECT
                ih.invoice_id,
                ih.invoice_number,
                ih.invoice_date,
                c.customer_name,
                c.gstin,
                ih.taxable_amount,
                ih.cgst_amount,
                ih.sgst_amount,
                ih.igst_amount,
                ih.total_tax,
                ih.total_amount,
                ih.payment_status
            FROM invoice_headers ih
            JOIN customers c
                ON ih.customer_id = c.customer_id
            WHERE
                ($1::date IS NULL OR ih.invoice_date >= $1::date)
                AND
                ($2::date IS NULL OR ih.invoice_date <= $2::date)
            ORDER BY ih.invoice_date DESC, ih.invoice_id DESC
        `, dates);

        res.json({
            status: "success",
            total_records: result.rows.length,
            sales: result.rows
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// REPORT 2: GST SUMMARY
// ==========================================

app.get("/api/reports/gst", async (req, res) => {
    try {
        const dates = getReportDateFilters(req);

        const result = await pool.query(`
            SELECT
                COUNT(*) AS invoice_count,
                COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
                COALESCE(SUM(cgst_amount), 0) AS cgst_amount,
                COALESCE(SUM(sgst_amount), 0) AS sgst_amount,
                COALESCE(SUM(igst_amount), 0) AS igst_amount,
                COALESCE(SUM(total_tax), 0) AS total_tax,
                COALESCE(SUM(total_amount), 0) AS total_amount
            FROM invoice_headers
            WHERE
                ($1::date IS NULL OR invoice_date >= $1::date)
                AND
                ($2::date IS NULL OR invoice_date <= $2::date)
        `, dates);

        res.json({
            status: "success",
            gst_summary: result.rows[0]
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// REPORT 3: PURCHASE REGISTER
// ==========================================

app.get("/api/reports/purchases", async (req, res) => {
    try {
        const dates = getReportDateFilters(req);

        const result = await pool.query(`
            SELECT
                ph.purchase_id,
                ph.invoice_number,
                ph.purchase_date,
                ph.supplier_id,
                ph.subtotal,
                ph.tax_amount,
                ph.total_amount,
                ph.status,
                ph.remarks
            FROM purchase_headers ph
            WHERE
                ($1::date IS NULL OR ph.purchase_date >= $1::date)
                AND
                ($2::date IS NULL OR ph.purchase_date <= $2::date)
            ORDER BY ph.purchase_date DESC, ph.purchase_id DESC
        `, dates);

        res.json({
            status: "success",
            total_records: result.rows.length,
            purchases: result.rows
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// REPORT 4: STOCK SUMMARY
// ==========================================

app.get("/api/reports/stock-summary", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                'RAW_MATERIAL' AS item_type,
                rm.material_id AS item_id,
                rm.material_name AS item_name,
                SUM(
                    CASE
                        WHEN sm.movement_type IN (
                            'OPENING',
                            'PURCHASE',
                            'PRODUCTION_OUTPUT',
                            'RETURN',
                            'ADJUSTMENT'
                        ) THEN sm.quantity

                        WHEN sm.movement_type IN (
                            'PRODUCTION_ISSUE',
                            'DISPATCH',
                            'WASTAGE'
                        ) THEN -sm.quantity

                        ELSE 0
                    END
                ) AS stock_quantity,
                u.unit_code
            FROM stock_movements sm
            JOIN raw_materials rm
                ON sm.material_id = rm.material_id
            JOIN units u
                ON sm.unit_id = u.unit_id
            WHERE sm.material_id IS NOT NULL
            GROUP BY
                rm.material_id,
                rm.material_name,
                u.unit_code

            UNION ALL

            SELECT
                'FINISHED_PRODUCT' AS item_type,
                p.product_id AS item_id,
                p.product_name AS item_name,
                SUM(
                    CASE
                        WHEN sm.movement_type IN (
                            'OPENING',
                            'PURCHASE',
                            'PRODUCTION_OUTPUT',
                            'RETURN',
                            'ADJUSTMENT'
                        ) THEN sm.quantity

                        WHEN sm.movement_type IN (
                            'PRODUCTION_ISSUE',
                            'DISPATCH',
                            'WASTAGE'
                        ) THEN -sm.quantity

                        ELSE 0
                    END
                ) AS stock_quantity,
                u.unit_code
            FROM stock_movements sm
            JOIN products p
                ON sm.product_id = p.product_id
            JOIN units u
                ON sm.unit_id = u.unit_id
            WHERE sm.product_id IS NOT NULL
            GROUP BY
                p.product_id,
                p.product_name,
                u.unit_code

            ORDER BY item_type, item_name
        `);

        res.json({
            status: "success",
            total_items: result.rows.length,
            stock: result.rows
        });

    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// REPORT 5: STOCK LEDGER
// ==========================================

app.get("/api/reports/stock-ledger", async (req, res) => {
    try {
        const dates = getReportDateFilters(req);

        const result = await pool.query(`
            SELECT
                sm.movement_id,
                sm.movement_date,
                sm.movement_type,
                sm.source_type,
                sm.source_id,
                sm.quantity,
                sm.remarks,
                u.unit_code,

                CASE
                    WHEN sm.material_id IS NOT NULL
                    THEN 'RAW_MATERIAL'
                    ELSE 'FINISHED_PRODUCT'
                END AS item_type,

                COALESCE(rm.material_name, p.product_name)
                    AS item_name

            FROM stock_movements sm

            JOIN units u
                ON sm.unit_id = u.unit_id

            LEFT JOIN raw_materials rm
                ON sm.material_id = rm.material_id

            LEFT JOIN products p
                ON sm.product_id = p.product_id

            WHERE
                ($1::date IS NULL OR sm.movement_date >= $1::date)
                AND
                ($2::date IS NULL OR sm.movement_date < ($2::date + INTERVAL '1 day'))

            ORDER BY sm.movement_date DESC, sm.movement_id DESC
        `, dates);

        res.json({
            status: "success",
            total_movements: result.rows.length,
            ledger: result.rows
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// REPORT 6: PRODUCTION REPORT
// ==========================================

app.get("/api/reports/production", async (req, res) => {
    try {
        const dates = getReportDateFilters(req);

        const result = await pool.query(`
            SELECT
                pr.production_run_id,
                pr.run_number,
                pr.production_date,
                pr.status,
                pr.batch_size,
                pr.planned_output_qty,
                p.product_name,

                COALESCE(out.good_output, 0) AS good_output,
                COALESCE(out.rejected_output, 0) AS rejected_output,

                CASE
                    WHEN pr.planned_output_qty > 0
                    THEN ROUND(
                        (
                            (
                                COALESCE(out.good_output, 0)
                                - pr.planned_output_qty
                            ) / pr.planned_output_qty
                        ) * 100,
                        2
                    )
                    ELSE 0
                END AS yield_variance_percent,

                COALESCE(cons.planned_consumption, 0)
                    AS planned_consumption,

                COALESCE(cons.actual_consumption, 0)
                    AS actual_consumption

            FROM production_runs pr

            JOIN products p
                ON pr.product_id = p.product_id

            LEFT JOIN (
                SELECT
                    production_run_id,
                    SUM(output_quantity)
                        FILTER (WHERE output_type = 'GOOD')
                        AS good_output,
                    SUM(output_quantity)
                        FILTER (WHERE output_type = 'REJECTED')
                        AS rejected_output
                FROM production_outputs
                GROUP BY production_run_id
            ) out
                ON pr.production_run_id = out.production_run_id

            LEFT JOIN (
                SELECT
                    production_run_id,
                    SUM(planned_quantity) AS planned_consumption,
                    SUM(actual_quantity) AS actual_consumption
                FROM production_consumption
                GROUP BY production_run_id
            ) cons
                ON pr.production_run_id = cons.production_run_id

            WHERE
                ($1::date IS NULL OR pr.production_date >= $1::date)
                AND
                ($2::date IS NULL OR pr.production_date <= $2::date)

            ORDER BY pr.production_date DESC,
                     pr.production_run_id DESC
        `, dates);

        res.json({
            status: "success",
            total_runs: result.rows.length,
            production: result.rows
        });

    } catch (error) {
        res.status(400).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// REPORT 7: PAYMENTS AND OUTSTANDING
// ==========================================

app.get("/api/reports/outstanding", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ih.invoice_id,
                ih.invoice_number,
                ih.invoice_date,
                c.customer_name,
                ih.total_amount,

                COALESCE(pay.paid_amount, 0) AS paid_amount,

                GREATEST(
                    ih.total_amount - COALESCE(pay.paid_amount, 0),
                    0
                ) AS outstanding_amount,

                ih.payment_status

            FROM invoice_headers ih

            JOIN customers c
                ON ih.customer_id = c.customer_id

            LEFT JOIN (
                SELECT
                    invoice_id,
                    SUM(amount) AS paid_amount
                FROM customer_payments
                GROUP BY invoice_id
            ) pay
                ON ih.invoice_id = pay.invoice_id

            ORDER BY ih.invoice_date DESC, ih.invoice_id DESC
        `);

        const totals = result.rows.reduce(
            (summary, row) => {
                summary.invoice_total += Number(row.total_amount);
                summary.paid_total += Number(row.paid_amount);
                summary.outstanding_total += Number(row.outstanding_amount);
                return summary;
            },
            {
                invoice_total: 0,
                paid_total: 0,
                outstanding_total: 0
            }
        );

        res.json({
            status: "success",
            total_invoices: result.rows.length,
            totals,
            outstanding: result.rows
        });

    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});


// ==========================================
// API: Production Material Consumption Report
// ==========================================

app.get("/api/reports/production-consumption", async (req, res) => {
    try {
        const { from, to } = req.query;

        if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid start date. Use YYYY-MM-DD."
            });
        }

        if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid end date. Use YYYY-MM-DD."
            });
        }

        if (from && to && from > to) {
            return res.status(400).json({
                status: "error",
                message: "Start date cannot be after end date."
            });
        }

        const result = await pool.query(
            `
            SELECT
                pr.production_run_id,
                pr.run_number,
                pr.production_date,
                p.product_name,
                pc.material_id,
                rm.material_name,
                pc.planned_quantity,
                pc.actual_quantity,
                (pc.actual_quantity - pc.planned_quantity)
                    AS variance_quantity,
                CASE
                    WHEN pc.planned_quantity > 0
                    THEN ROUND(
                        (
                            (pc.actual_quantity - pc.planned_quantity)
                            / pc.planned_quantity
                        ) * 100,
                        2
                    )
                    ELSE 0
                END AS variance_percentage,
                u.unit_code

            FROM production_consumption pc

            JOIN production_runs pr
                ON pc.production_run_id = pr.production_run_id

            JOIN raw_materials rm
                ON pc.material_id = rm.material_id

            JOIN products p
                ON pr.product_id = p.product_id

            JOIN units u
                ON pc.unit_id = u.unit_id

            WHERE
                ($1::date IS NULL OR pr.production_date >= $1::date)
                AND
                ($2::date IS NULL OR pr.production_date <= $2::date)

            ORDER BY
                pr.production_date DESC,
                pr.production_run_id DESC,
                rm.material_name;
            `,
            [from || null, to || null]
        );

        res.status(200).json({
            status: "success",
            total_records: result.rows.length,
            consumption: result.rows
        });

    } catch (error) {
        console.error(
            "Production consumption report error:",
            error.message
        );

        res.status(500).json({
            status: "error",
            message: "Unable to retrieve production material consumption."
        });
    }
});


// ==========================================
// START SERVER
// ==========================================



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

