
import { useEffect, useMemo, useState } from "react";
import {
    getSuppliers,
    getMaterials,
    getPurchases,
    getPurchaseDetails,
    createPurchase,
} from "./api";

const formatCurrency = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const formatDate = (value) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-IN");
};

const emptyItem = () => ({
    material_id: "",
    quantity: "",
    rate: "",
    tax_rate: "5",
});

function Purchases() {
    const [suppliers, setSuppliers] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [purchases, setPurchases] = useState([]);

    const [supplierId, setSupplierId] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [purchaseDate, setPurchaseDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [remarks, setRemarks] = useState("");
    const [items, setItems] = useState([emptyItem()]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError("");

        try {
            const [supplierData, materialData, purchaseData] =
                await Promise.all([
                    getSuppliers(),
                    getMaterials(),
                    getPurchases(),
                ]);

            setSuppliers(supplierData.suppliers || []);
            setMaterials(materialData.materials || []);
            setPurchases(purchaseData.purchases || []);
        } catch (err) {
            setError(err.message || "Unable to load purchase information.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const calculations = useMemo(() => {
        let subtotal = 0;
        let taxAmount = 0;

        items.forEach((item) => {
            const quantity = Number(item.quantity) || 0;
            const rate = Number(item.rate) || 0;
            const taxRate = Number(item.tax_rate) || 0;

            const taxable = quantity * rate;
            const tax = taxable * (taxRate / 100);

            subtotal += taxable;
            taxAmount += tax;
        });

        return {
            subtotal,
            taxAmount,
            total: subtotal + taxAmount,
        };
    }, [items]);

    const updateItem = (index, field, value) => {
        setItems((previous) =>
            previous.map((item, itemIndex) =>
                itemIndex === index
                    ? { ...item, [field]: value }
                    : item
            )
        );
    };

    const addItem = () => {
        setItems((previous) => [...previous, emptyItem()]);
    };

    const removeItem = (index) => {
        setItems((previous) =>
            previous.length === 1
                ? previous
                : previous.filter((_, itemIndex) => itemIndex !== index)
        );
    };

    const resetForm = () => {
        setSupplierId("");
        setInvoiceNumber("");
        setPurchaseDate(new Date().toISOString().slice(0, 10));
        setRemarks("");
        setItems([emptyItem()]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!supplierId) {
            setError("Please select a supplier.");
            return;
        }

        if (!invoiceNumber.trim()) {
            setError("Please enter the supplier invoice number.");
            return;
        }

        if (!purchaseDate) {
            setError("Please select the purchase date.");
            return;
        }

        const validItems = items.filter(
            (item) =>
                item.material_id &&
                Number(item.quantity) > 0 &&
                Number(item.rate) >= 0 &&
                item.rate !== ""
        );

        if (validItems.length !== items.length || validItems.length === 0) {
            setError(
                "Please select a material and enter a valid quantity and rate for every line."
            );
            return;
        }

        const duplicateMaterials = validItems
            .map((item) => item.material_id)
            .filter(
                (id, index, array) => array.indexOf(id) !== index
            );

        if (duplicateMaterials.length > 0) {
            setError(
                "A material is selected more than once. Please combine its quantity into one line."
            );
            return;
        }

        setSaving(true);

        try {
            const payload = {
                supplier_id: Number(supplierId),
                invoice_number: invoiceNumber.trim(),
                purchase_date: purchaseDate,
                remarks: remarks.trim(),
                items: validItems.map((item) => {
                    const material = materials.find(
                        (entry) =>
                            Number(entry.material_id) === Number(item.material_id)
                    );

                    return {
                        material_id: Number(item.material_id),
                        quantity: Number(item.quantity),
                        unit_id: Number(material.unit_id),
                        rate: Number(item.rate),
                        tax_rate: Number(item.tax_rate) || 0,
                    };
                }),
            };

            const result = await createPurchase(payload);

            setSuccess(
                `Purchase ${result.invoice_number || invoiceNumber} recorded successfully.`
            );

            resetForm();
            await loadData();
        } catch (err) {
            setError(err.message || "Unable to record purchase.");
        } finally {
            setSaving(false);
        }
    };

    const viewDetails = async (purchaseId) => {
        setDetailsLoading(true);
        setError("");
        setSelectedPurchase(null);

        try {
            const result = await getPurchaseDetails(purchaseId);
            setSelectedPurchase(result);
        } catch (err) {
            setError(err.message || "Unable to load purchase details.");
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        setSelectedPurchase(null);
    };

    const selectedSupplier = suppliers.find(
        (supplier) => Number(supplier.supplier_id) === Number(supplierId)
    );

    const totalPurchases = purchases.length;

    const totalPurchaseValue = purchases.reduce(
        (sum, purchase) =>
            sum + Number(purchase.total_amount || 0),
        0
    );

    return (
        <section className="module-section purchases-module">
            <div className="welcome-section">
                <div>
                    <h2>Purchase Management</h2>
                    <p>
                        Record raw material purchases and maintain supplier
                        purchase history.
                    </p>
                </div>

                <button
                    className="refresh-button"
                    type="button"
                    onClick={loadData}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "↻ Refresh"}
                </button>
            </div>

            {error && (
                <div className="purchase-alert purchase-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="purchase-alert purchase-success">
                    {success}
                </div>
            )}

            <div className="order-summary-grid purchase-summary-grid">
                <div className="report-stat-card">
                    <p>Total Purchase Records</p>
                    <h3>{totalPurchases}</h3>
                    <span>Recorded supplier invoices</span>
                </div>

                <div className="report-stat-card">
                    <p>Total Purchase Value</p>
                    <h3>{formatCurrency(totalPurchaseValue)}</h3>
                    <span>Value of recorded purchases</span>
                </div>

                <div className="report-stat-card">
                    <p>Available Suppliers</p>
                    <h3>{suppliers.length}</h3>
                    <span>Registered suppliers</span>
                </div>
            </div>

            <div className="purchase-panel">
                <div className="purchase-panel-heading">
                    <div>
                        <h3>Record New Purchase</h3>
                        <p>Enter the details from the supplier invoice.</p>
                    </div>
                    <span className="purchase-section-tag">PURCHASE ENTRY</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="purchase-form-grid">
                        <div className="purchase-field">
                            <label>Supplier *</label>
                            <select
                                value={supplierId}
                                onChange={(event) => setSupplierId(event.target.value)}
                                required
                            >
                                <option value="">Select supplier</option>
                                {suppliers.map((supplier) => (
                                    <option
                                        key={supplier.supplier_id}
                                        value={supplier.supplier_id}
                                    >
                                        {supplier.supplier_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="purchase-field">
                            <label>Supplier Invoice Number *</label>
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(event) => setInvoiceNumber(event.target.value)}
                                placeholder="Example: ABC/2026/001"
                                required
                            />
                        </div>

                        <div className="purchase-field">
                            <label>Purchase Date *</label>
                            <input
                                type="date"
                                value={purchaseDate}
                                onChange={(event) => setPurchaseDate(event.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {selectedSupplier && (
                        <div className="purchase-supplier-info">
                            <strong>{selectedSupplier.supplier_name}</strong>
                            <span>
                                {selectedSupplier.city || "City not provided"}
                                {selectedSupplier.state
                                    ? `, ${selectedSupplier.state}`
                                    : ""}
                            </span>
                            <span>
                                GSTIN: {selectedSupplier.gstin || "Not provided"}
                            </span>
                        </div>
                    )}

                    <div className="purchase-items-heading">
                        <div>
                            <h3>Material Details</h3>
                            <p>Add each raw material appearing on the invoice.</p>
                        </div>

                        <button
                            type="button"
                            className="purchase-add-button"
                            onClick={addItem}
                        >
                            + Add Material
                        </button>
                    </div>

                    <div className="purchase-table-wrapper">
                        <table className="purchase-entry-table">
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>Quantity</th>
                                    <th>Rate (₹)</th>
                                    <th>GST (%)</th>
                                    <th>Taxable Amount</th>
                                    <th>Tax Amount</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>
                                {items.map((item, index) => {
                                    const material = materials.find(
                                        (entry) =>
                                            Number(entry.material_id) ===
                                            Number(item.material_id)
                                    );

                                    const taxable =
                                        (Number(item.quantity) || 0) *
                                        (Number(item.rate) || 0);

                                    const tax =
                                        taxable * ((Number(item.tax_rate) || 0) / 100);

                                    return (
                                        <tr key={index}>
                                            <td>
                                                <select
                                                    value={item.material_id}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            index,
                                                            "material_id",
                                                            event.target.value
                                                        )
                                                    }
                                                    required
                                                >
                                                    <option value="">Select material</option>
                                                    {materials.map((entry) => (
                                                        <option
                                                            key={entry.material_id}
                                                            value={entry.material_id}
                                                        >
                                                            {entry.material_name}
                                                        </option>
                                                    ))}
                                                </select>

                                                {material && (
                                                    <small className="purchase-unit-label">
                                                        Unit: {material.unit_name}
                                                    </small>
                                                )}
                                            </td>

                                            <td>
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    value={item.quantity}
                                                    onChange={(event) =>
                                                        updateItem(index, "quantity", event.target.value)
                                                    }
                                                    placeholder="0"
                                                    required
                                                />
                                            </td>

                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={item.rate}
                                                    onChange={(event) =>
                                                        updateItem(index, "rate", event.target.value)
                                                    }
                                                    placeholder="0.00"
                                                    required
                                                />
                                            </td>

                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="any"
                                                    value={item.tax_rate}
                                                    onChange={(event) =>
                                                        updateItem(index, "tax_rate", event.target.value)
                                                    }
                                                />
                                            </td>

                                            <td className="purchase-number">
                                                {formatCurrency(taxable)}
                                            </td>

                                            <td className="purchase-number">
                                                {formatCurrency(tax)}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="purchase-remove-button"
                                                    onClick={() => removeItem(index)}
                                                    disabled={items.length === 1}
                                                    title="Remove material"
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="purchase-bottom-grid">
                        <div className="purchase-field purchase-remarks">
                            <label>Remarks</label>
                            <textarea
                                value={remarks}
                                onChange={(event) => setRemarks(event.target.value)}
                                placeholder="Optional purchase notes..."
                                rows="3"
                            />
                        </div>

                        <div className="purchase-total-box">
                            <div>
                                <span>Subtotal</span>
                                <strong>{formatCurrency(calculations.subtotal)}</strong>
                            </div>

                            <div>
                                <span>GST Amount</span>
                                <strong>{formatCurrency(calculations.taxAmount)}</strong>
                            </div>

                            <div className="purchase-grand-total">
                                <span>Grand Total</span>
                                <strong>{formatCurrency(calculations.total)}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="purchase-form-actions">
                        <button
                            type="button"
                            className="purchase-cancel-button"
                            onClick={resetForm}
                        >
                            Clear Form
                        </button>

                        <button
                            type="submit"
                            className="purchase-submit-button"
                            disabled={saving || loading}
                        >
                            {saving ? "Recording..." : "Record Purchase"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="purchase-panel purchase-history-panel">
                <div className="purchase-panel-heading">
                    <div>
                        <h3>Purchase History</h3>
                        <p>Previously recorded supplier purchases.</p>
                    </div>
                    <span className="purchase-count">
                        {totalPurchases} Records
                    </span>
                </div>

                {loading ? (
                    <p className="purchase-empty">Loading purchase history...</p>
                ) : purchases.length === 0 ? (
                    <p className="purchase-empty">No purchase records found.</p>
                ) : (
                    <div className="purchase-table-wrapper">
                        <table className="purchase-history-table">
                            <thead>
                                <tr>
                                    <th>Purchase ID</th>
                                    <th>Invoice Number</th>
                                    <th>Supplier</th>
                                    <th>Date</th>
                                    <th>Taxable Amount</th>
                                    <th>GST</th>
                                    <th>Total Amount</th>
                                    <th>Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {purchases.map((purchase) => (
                                    <tr key={purchase.purchase_id}>
                                        <td>#{purchase.purchase_id}</td>
                                        <td>
                                            <strong>{purchase.invoice_number}</strong>
                                        </td>
                                        <td>{purchase.supplier_name || "—"}</td>
                                        <td>{formatDate(purchase.purchase_date)}</td>
                                        <td>{formatCurrency(purchase.subtotal)}</td>
                                        <td>{formatCurrency(purchase.tax_amount)}</td>
                                        <td className="purchase-number">
                                            <strong>
                                                {formatCurrency(purchase.total_amount)}
                                            </strong>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="purchase-view-button"
                                                onClick={() => viewDetails(purchase.purchase_id)}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {(detailsLoading || selectedPurchase) && (
                <div className="purchase-details-overlay">
                    <div className="purchase-details-modal">
                        <div className="purchase-panel-heading">
                            <div>
                                <h3>Purchase Details</h3>
                                <p>Supplier invoice and material information.</p>
                            </div>

                            <button
                                type="button"
                                className="purchase-close-button"
                                onClick={closeDetails}
                            >
                                ×
                            </button>
                        </div>


                        {detailsLoading ? (
                            <p className="purchase-empty">Loading details...</p>
                        ) : (
                            <>
                                {selectedPurchase?.purchase && (
                                    <div className="purchase-invoice">

                                        <div className="purchase-invoice-header">
                                            <div>
                                                <h2>OrderAudit</h2>
                                                <p>MANUFACTURING ERP</p>
                                                <span>Purchase Record</span>
                                            </div>

                                            <div className="purchase-invoice-number">
                                                <h3>{selectedPurchase.purchase.invoice_number}</h3>
                                                <span className="purchase-status">
                                                    {selectedPurchase.purchase.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="purchase-invoice-divider" />

                                        <div className="purchase-invoice-info">
                                            <div>
                                                <span className="purchase-info-label">SUPPLIER</span>
                                                <h3>{selectedPurchase.purchase.supplier_name}</h3>
                                                <p>{selectedPurchase.purchase.address || "Address not provided"}</p>
                                                <p>
                                                    {selectedPurchase.purchase.city || ""}
                                                    {selectedPurchase.purchase.state
                                                        ? `, ${selectedPurchase.purchase.state}`
                                                        : ""}
                                                </p>
                                                <p>
                                                    Phone: {selectedPurchase.purchase.phone || "Not provided"}
                                                </p>
                                                <p>
                                                    GSTIN: {selectedPurchase.purchase.gstin || "Not provided"}
                                                </p>
                                            </div>

                                            <div>
                                                <span className="purchase-info-label">PURCHASE INFORMATION</span>
                                                <p>
                                                    <strong>Purchase ID:</strong>{" "}
                                                    #{selectedPurchase.purchase.purchase_id}
                                                </p>
                                                <p>
                                                    <strong>Invoice:</strong>{" "}
                                                    {selectedPurchase.purchase.invoice_number}
                                                </p>
                                                <p>
                                                    <strong>Date:</strong>{" "}
                                                    {new Date(
                                                        selectedPurchase.purchase.purchase_date
                                                    ).toLocaleDateString("en-IN")}
                                                </p>
                                                <p>
                                                    <strong>Status:</strong>{" "}
                                                    {selectedPurchase.purchase.status}
                                                </p>
                                            </div>
                                        </div>

                                        <h4 className="purchase-invoice-items-title">
                                            Purchased Materials
                                        </h4>

                                        <div className="purchase-table-wrapper">
                                            <table className="purchase-invoice-table">
                                                <thead>
                                                    <tr>
                                                        <th>Material</th>
                                                        <th>Quantity</th>
                                                        <th>Rate</th>
                                                        <th>GST</th>
                                                        <th>Taxable Amount</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {(selectedPurchase.items || []).map((item) => (
                                                        <tr key={item.purchase_item_id}>
                                                            <td>
                                                                <strong>{item.material_name}</strong>
                                                                <small>{item.material_code}</small>
                                                            </td>
                                                            <td>
                                                                {Number(item.quantity).toLocaleString("en-IN")}{" "}
                                                                {item.unit_code}
                                                            </td>
                                                            <td>
                                                                {formatCurrency(item.rate)}
                                                            </td>
                                                            <td>{Number(item.tax_rate)}%</td>
                                                            <td>
                                                                {formatCurrency(item.taxable_amount)}
                                                            </td>
                                                            <td>
                                                                <strong>
                                                                    {formatCurrency(item.total_amount)}
                                                                </strong>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="purchase-invoice-footer">
                                            <div className="purchase-invoice-remarks">
                                                <span className="purchase-info-label">REMARKS</span>
                                                <p>
                                                    {selectedPurchase.purchase.remarks || "No remarks provided."}
                                                </p>
                                            </div>

                                            <div className="purchase-invoice-totals">
                                                <div>
                                                    <span>Subtotal</span>
                                                    <strong>
                                                        {formatCurrency(selectedPurchase.purchase.subtotal)}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>GST Amount</span>
                                                    <strong>
                                                        {formatCurrency(selectedPurchase.purchase.tax_amount)}
                                                    </strong>
                                                </div>

                                                <div className="purchase-invoice-grand-total">
                                                    <span>Grand Total</span>
                                                    <strong>
                                                        {formatCurrency(selectedPurchase.purchase.total_amount)}
                                                    </strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="purchase-invoice-bottom">
                                            Purchase record generated by OrderAudit Manufacturing ERP.
                                        </div>

                                        <div className="purchase-invoice-actions">
                                            <button
                                                type="button"
                                                className="purchase-print-button"
                                                onClick={() => window.print()}
                                            >
                                                Print Purchase Record
                                            </button>
                                        </div>

                                    </div>
                                )}
                            </>
                        )}

                    </div>
                </div>
            )}
        </section>
    );
}

export default Purchases;
