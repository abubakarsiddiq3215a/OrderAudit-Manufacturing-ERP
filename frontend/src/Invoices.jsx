
import { useEffect, useState } from "react";
import { getInvoices, getInvoiceDetails } from "./api";

// Format amounts in Indian Rupees
function currency(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    });
}

// Format invoice dates
function dateFormat(value) {
    if (!value) return "—";

    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    // Load detailed information for one invoice
    async function openInvoice(invoiceId) {
        try {
            setDetailsLoading(true);
            setDetailsError("");
            setSelectedInvoice(null);

            const data = await getInvoiceDetails(invoiceId);

            setSelectedInvoice(data);
        } catch (err) {
            setDetailsError(
                err.message || "Unable to load invoice details."
            );
        } finally {
            setDetailsLoading(false);
        }
    }

    // Print invoice or save as PDF
    function printInvoice() {
        window.print();
    }

    // Load all invoices
    async function loadInvoices() {
        try {
            setLoading(true);
            setError("");

            const data = await getInvoices();

            setInvoices(data.invoices || []);
        } catch (err) {
            setError(err.message || "Unable to load invoices.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadInvoices();
    }, []);

    // Dashboard calculations
    const totalAmount = invoices.reduce(
        (sum, invoice) =>
            sum + Number(invoice.total_amount || 0),
        0
    );

    const totalPaid = invoices.reduce(
        (sum, invoice) =>
            sum + Number(invoice.paid_amount || 0),
        0
    );

    const totalOutstanding = invoices.reduce(
        (sum, invoice) =>
            sum + Number(invoice.outstanding_amount || 0),
        0
    );

    return (
        <section className="module-section">

            {/* Page heading */}
            <div className="welcome-section">
                <div>
                    <h2>Invoice Management</h2>
                    <p>
                        Monitor GST invoices, payments and dispatch records.
                    </p>
                </div>

                <button
                    className="refresh-button"
                    onClick={loadInvoices}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "↻ Refresh invoices"}
                </button>
            </div>

            {error && (
                <div className="error-banner">{error}</div>
            )}

            {/* Invoice summary cards */}
            <div className="order-summary-grid">

                <div className="stat-card">
                    <p className="stat-title">Total Invoices</p>
                    <h3>{loading ? "..." : invoices.length}</h3>
                    <p className="stat-description">
                        Generated invoices
                    </p>
                </div>

                <div className="stat-card">
                    <p className="stat-title">Invoice Value</p>
                    <h3 className="order-value">
                        {loading ? "..." : currency(totalAmount)}
                    </h3>
                    <p className="stat-description">
                        Total billed amount
                    </p>
                </div>

                <div className="stat-card">
                    <p className="stat-title">Amount Collected</p>
                    <h3 className="order-value">
                        {loading ? "..." : currency(totalPaid)}
                    </h3>
                    <p className="stat-description">
                        Payments received
                    </p>
                </div>

                <div className="stat-card">
                    <p className="stat-title">Outstanding</p>
                    <h3 className="order-value">
                        {loading ? "..." : currency(totalOutstanding)}
                    </h3>
                    <p className="stat-description">
                        Amount yet to be collected
                    </p>
                </div>

            </div>

            {/* Generated invoices table */}
            <div className="panel orders-panel">

                <div className="panel-heading">
                    <div>
                        <h3>Generated Invoices</h3>
                        <p>Live invoice records from PostgreSQL</p>
                    </div>

                    <span className="live-badge">LIVE</span>
                </div>

                {loading ? (
                    <div className="empty-state">
                        Loading invoices...
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="empty-state">
                        No invoices found.
                    </div>
                ) : (

                    <div className="table-wrapper">

                        <table className="orders-table">

                            <thead>
                                <tr>
                                    <th>INVOICE NUMBER</th>
                                    <th>DATE</th>
                                    <th>CUSTOMER</th>
                                    <th>ORDER</th>
                                    <th>TAXABLE VALUE</th>
                                    <th>CGST</th>
                                    <th>SGST</th>
                                    <th>IGST</th>
                                    <th>TOTAL</th>
                                    <th>PAID</th>
                                    <th>OUTSTANDING</th>
                                    <th>PAYMENT</th>
                                    <th>DISPATCH</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>

                            <tbody>

                                {invoices.map((invoice) => (

                                    <tr key={invoice.invoice_id}>

                                        <td className="item-name">
                                            {invoice.invoice_number}
                                        </td>

                                        <td>
                                            {dateFormat(invoice.invoice_date)}
                                        </td>

                                        <td>
                                            <strong>
                                                {invoice.customer_name}
                                            </strong>
                                        </td>

                                        <td>
                                            {invoice.order_number}
                                        </td>

                                        <td>
                                            {currency(invoice.taxable_amount)}
                                        </td>

                                        <td>
                                            {currency(invoice.cgst_amount)}
                                        </td>

                                        <td>
                                            {currency(invoice.sgst_amount)}
                                        </td>

                                        <td>
                                            {currency(invoice.igst_amount)}
                                        </td>

                                        <td className="quantity">
                                            {currency(invoice.total_amount)}
                                        </td>

                                        <td>
                                            {currency(invoice.paid_amount)}
                                        </td>

                                        <td>
                                            {currency(invoice.outstanding_amount)}
                                        </td>

                                        <td>
                                            <span
                                                className={`order-status ${String(
                                                    invoice.payment_status || ""
                                                ).toLowerCase()}`}
                                            >
                                                {invoice.payment_status}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className={`order-status ${invoice.dispatch_status === "DISPATCHED"
                                                        ? "dispatched"
                                                        : ""
                                                    }`}
                                            >
                                                {invoice.dispatch_status ||
                                                    "NOT DISPATCHED"}
                                            </span>
                                        </td>

                                        {/* View button belongs to this invoice row */}
                                        <td>
                                            <button
                                                className="refresh-button"
                                                onClick={() =>
                                                    openInvoice(invoice.invoice_id)
                                                }
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

            {/* Invoice details loading and errors */}
            {detailsError && (
                <div className="error-banner">
                    {detailsError}
                </div>
            )}

            {detailsLoading && (
                <div className="empty-state">
                    Loading invoice details...
                </div>
            )}

            {/* Detailed invoice view */}
            {selectedInvoice && (

                <div className="panel invoice-detail-panel">

                    <div className="panel-heading no-print">

                        <div>
                            <h3>Invoice Details</h3>

                            <p>
                                {selectedInvoice.invoice.invoice_number}
                            </p>
                        </div>

                        <div className="invoice-actions">

                            <button
                                className="refresh-button"
                                onClick={printInvoice}
                            >
                                Print / Save as PDF
                            </button>

                            <button
                                className="refresh-button"
                                onClick={() => setSelectedInvoice(null)}
                            >
                                Close
                            </button>

                        </div>

                    </div>

                    {/* Printable invoice */}
                    <div className="print-invoice">

                        <h2>GST TAX INVOICE</h2>

                        <h3>OrderAudit Manufacturing</h3>

                        <div className="invoice-parties">

                            <div>
                                <strong>Invoice Number</strong>

                                <p>
                                    {selectedInvoice.invoice.invoice_number}
                                </p>

                                <strong>Invoice Date</strong>

                                <p>
                                    {dateFormat(
                                        selectedInvoice.invoice.invoice_date
                                    )}
                                </p>
                            </div>

                            <div>
                                <strong>Bill To</strong>

                                <p>
                                    {selectedInvoice.invoice.customer_name}
                                </p>

                                <p>
                                    {selectedInvoice.invoice.state}
                                </p>

                                <p>
                                    GSTIN: {
                                        selectedInvoice.invoice.gstin ||
                                        "Not provided"
                                    }
                                </p>
                            </div>

                        </div>

                        {/* Actual invoice product items */}
                        <div className="table-wrapper">

                            <table className="orders-table">

                                <thead>
                                    <tr>
                                        <th>PRODUCT</th>
                                        <th>HSN</th>
                                        <th>QTY</th>
                                        <th>RATE</th>
                                        <th>GST %</th>
                                        <th>TAXABLE</th>
                                        <th>CGST</th>
                                        <th>SGST</th>
                                        <th>IGST</th>
                                        <th>TOTAL</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {selectedInvoice.items.map((item) => (

                                        <tr key={item.invoice_item_id}>

                                            <td>
                                                {item.product_name}
                                            </td>

                                            <td>
                                                {item.hsn_code || "Not provided"}
                                            </td>

                                            <td>
                                                {item.quantity}
                                            </td>

                                            <td>
                                                {currency(item.unit_price)}
                                            </td>

                                            <td>
                                                {item.gst_rate}%
                                            </td>

                                            <td>
                                                {currency(item.taxable_amount)}
                                            </td>

                                            <td>
                                                {currency(item.cgst_amount)}
                                            </td>

                                            <td>
                                                {currency(item.sgst_amount)}
                                            </td>

                                            <td>
                                                {currency(item.igst_amount)}
                                            </td>

                                            <td>
                                                {currency(item.total_amount)}
                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                        {/* Invoice tax summary */}
                        <div className="invoice-total">

                            <p>
                                Taxable Value: {
                                    currency(
                                        selectedInvoice.invoice.taxable_amount
                                    )
                                }
                            </p>

                            <p>
                                CGST: {
                                    currency(
                                        selectedInvoice.invoice.cgst_amount
                                    )
                                }
                            </p>

                            <p>
                                SGST: {
                                    currency(
                                        selectedInvoice.invoice.sgst_amount
                                    )
                                }
                            </p>

                            <p>
                                IGST: {
                                    currency(
                                        selectedInvoice.invoice.igst_amount
                                    )
                                }
                            </p>

                            <h3>
                                Grand Total: {
                                    currency(
                                        selectedInvoice.invoice.total_amount
                                    )
                                }
                            </h3>

                        </div>

                        <p className="invoice-footer">
                            This invoice was generated by the OrderAudit system.
                        </p>

                    </div>

                </div>

            )}

            <p className="module-note">
                Invoice amounts, tax breakdown, collections and dispatch
                information are retrieved from the backend.
            </p>

        </section>
    );
}

export default Invoices;
