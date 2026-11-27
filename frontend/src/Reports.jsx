
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

const REPORT_TABS = [
    { id: "sales", label: "Sales Register" },
    { id: "gst", label: "GST Summary" },
    { id: "purchases", label: "Purchase Register" },
    { id: "stock-summary", label: "Stock Summary" },
    { id: "stock-ledger", label: "Stock Ledger" },
    { id: "production", label: "Production" },
    { id: "outstanding", label: "Payments & Outstanding" },
];

// ==========================================
// FORMATTING FUNCTIONS
// ==========================================

function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    });
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 3,
    });
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// ==========================================
// CSV EXPORT FUNCTION
// ==========================================

function downloadCSV(filename, headers, rows) {
    const escapeCSV = (value) => {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
        headers,
        ...rows,
    ]
        .map((row) => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${filename}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// ==========================================
// REUSABLE REPORT TABLE
// ==========================================

function ReportTable({ columns, rows, emptyMessage }) {
    if (!rows.length) {
        return (
            <div className="report-empty">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="table-wrapper">
            <table className="reports-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {rows.map((row, index) => (
                        <tr
                            key={
                                row.invoice_id ||
                                row.purchase_id ||
                                row.movement_id ||
                                (row.material_id
                                    ? `${row.production_run_id}-${row.material_id}`
                                    : null) ||
                                row.production_run_id ||
                                `${row.item_id}-${index}`
                            }
                        >
                            {columns.map((column) => (
                                <td key={column.key}>
                                    {column.render
                                        ? column.render(row[column.key], row)
                                        : row[column.key] ?? "—"}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ==========================================
// SUMMARY CARD
// ==========================================

function SummaryCard({
    label,
    value,
    description,
    tone = "blue",
}) {
    return (
        <div className="report-stat-card">
            <div className={`report-stat-icon ${tone}`}>
                ▦
            </div>

            <p>{label}</p>

            <h3>{value}</h3>

            <span>{description}</span>
        </div>
    );
}

// ==========================================
// MAIN REPORTS COMPONENT
// ==========================================

function Reports() {
    // Selected report tab
    const [activeTab, setActiveTab] = useState("sales");

    // Data received from backend
    const [reportData, setReportData] = useState({});

    // Loading and error states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Date filter states
    const [selectedFrom, setSelectedFrom] = useState("");
    const [selectedTo, setSelectedTo] = useState("");

    const [appliedFrom, setAppliedFrom] = useState("");
    const [appliedTo, setAppliedTo] = useState("");

    // ==========================================
    // LOAD ALL REPORTS FROM BACKEND
    // ==========================================

    const loadReports = useCallback(async () => {
        setLoading(true);
        setError("");

        const filterableReports = [
            "sales",
            "gst",
            "purchases",
            "stock-ledger",
            "production",
        ];

        const dateParams = new URLSearchParams();

        if (appliedFrom) {
            dateParams.append("from", appliedFrom);
        }

        if (appliedTo) {
            dateParams.append("to", appliedTo);
        }

        const queryString = dateParams.toString();

        try {
            const endpoints = REPORT_TABS.map(async (tab) => {
                const supportsDateFilter =
                    filterableReports.includes(tab.id);

                const url =
                    `${API_URL}/api/reports/${tab.id}` +
                    (
                        supportsDateFilter && queryString
                            ? `?${queryString}`
                            : ""
                    );

                const response = await fetch(url);

                const data = await response.json();

                if (!response.ok || data.status !== "success") {
                    throw new Error(
                        data.message ||
                        `Unable to load ${tab.label}`
                    );
                }

                return [tab.id, data];
            });

            // Fetch material-wise planned versus actual consumption.
            const consumptionUrl =
                `${API_URL}/api/reports/production-consumption` +
                (queryString ? `?${queryString}` : "");

            const consumptionEndpoint = (async () => {
                const response = await fetch(consumptionUrl);
                const data = await response.json();

                if (!response.ok || data.status !== "success") {
                    throw new Error(
                        data.message ||
                        "Unable to load production material consumption."
                    );
                }

                return ["production-consumption", data];
            })();

            const results = await Promise.all([
                ...endpoints,
                consumptionEndpoint
            ]);

            setReportData(
                Object.fromEntries(results)
            );

        } catch (err) {
            setError(
                err.message || "Unable to load reports."
            );
        } finally {
            setLoading(false);
        }
    }, [appliedFrom, appliedTo]);

    // Load reports when the component opens
    // and whenever applied date filters change.

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    // ==========================================
    // EXTRACT REPORT DATA
    // ==========================================

    const sales =
        reportData.sales?.sales || [];

    const gst =
        reportData.gst?.gst_summary || {};

    const purchases =
        reportData.purchases?.purchases || [];

    const stock =
        reportData["stock-summary"]?.stock || [];

    const ledger =
        reportData["stock-ledger"]?.ledger || [];

    const production =
        reportData.production?.production || [];

    const productionConsumption =
        reportData["production-consumption"]?.consumption || [];

    const outstanding =
        reportData.outstanding?.outstanding || [];

    const outstandingTotals =
        reportData.outstanding?.totals || {};

    // ==========================================
    // SUMMARY CALCULATIONS
    // ==========================================

    const totalSales = useMemo(
        () =>
            sales.reduce(
                (sum, row) =>
                    sum + Number(row.total_amount || 0),
                0
            ),
        [sales]
    );

    const totalPurchases = useMemo(
        () =>
            purchases.reduce(
                (sum, row) =>
                    sum + Number(row.total_amount || 0),
                0
            ),
        [purchases]
    );

    const currentTab = REPORT_TABS.find(
        (tab) => tab.id === activeTab
    );

    // ==========================================
    // APPLY AND CLEAR DATE FILTERS
    // ==========================================

    const applyDateFilters = () => {
        if (
            selectedFrom &&
            selectedTo &&
            selectedFrom > selectedTo
        ) {
            setError("Start date cannot be after end date.");
            return;
        }

        setError("");

        setAppliedFrom(selectedFrom);
        setAppliedTo(selectedTo);
    };

    const clearDateFilters = () => {
        setSelectedFrom("");
        setSelectedTo("");
        setAppliedFrom("");
        setAppliedTo("");
        setError("");
    };

    // ==========================================
    // CSV EXPORT HANDLER
    // ==========================================

    const handleExport = () => {
        let headers = [];
        let rows = [];

        switch (activeTab) {
            case "sales":
                headers = [
                    "Invoice Number",
                    "Date",
                    "Customer",
                    "GSTIN",
                    "Taxable Amount",
                    "CGST",
                    "SGST",
                    "IGST",
                    "Total Tax",
                    "Total Amount",
                    "Payment Status",
                ];

                rows = sales.map((r) => [
                    r.invoice_number,
                    r.invoice_date,
                    r.customer_name,
                    r.gstin,
                    r.taxable_amount,
                    r.cgst_amount,
                    r.sgst_amount,
                    r.igst_amount,
                    r.total_tax,
                    r.total_amount,
                    r.payment_status,
                ]);
                break;

            case "gst":
                headers = [
                    "GST Metric",
                    "Amount",
                ];

                rows = [
                    ["Invoice Count", gst.invoice_count],
                    ["Taxable Amount", gst.taxable_amount],
                    ["CGST", gst.cgst_amount],
                    ["SGST", gst.sgst_amount],
                    ["IGST", gst.igst_amount],
                    ["Total Tax", gst.total_tax],
                    ["Invoice Total", gst.total_amount],
                ];
                break;

            case "purchases":
                headers = [
                    "Purchase Invoice",
                    "Date",
                    "Supplier ID",
                    "Subtotal",
                    "Tax",
                    "Total",
                    "Status",
                    "Remarks",
                ];

                rows = purchases.map((r) => [
                    r.invoice_number,
                    r.purchase_date,
                    r.supplier_id,
                    r.subtotal,
                    r.tax_amount,
                    r.total_amount,
                    r.status,
                    r.remarks,
                ]);
                break;

            case "stock-summary":
                headers = [
                    "Item",
                    "Type",
                    "Stock Quantity",
                    "Unit",
                ];

                rows = stock.map((r) => [
                    r.item_name,
                    r.item_type,
                    r.stock_quantity,
                    r.unit_code,
                ]);
                break;

            case "stock-ledger":
                headers = [
                    "Date",
                    "Item",
                    "Item Type",
                    "Movement",
                    "Quantity",
                    "Unit",
                    "Source",
                    "Source ID",
                    "Remarks",
                ];

                rows = ledger.map((r) => [
                    r.movement_date,
                    r.item_name,
                    r.item_type,
                    r.movement_type,
                    r.quantity,
                    r.unit_code,
                    r.source_type,
                    r.source_id,
                    r.remarks,
                ]);
                break;

            case "production":
                headers = [
                    "Run Number",
                    "Date",
                    "Product",
                    "Status",
                    "Batch Size",
                    "Planned Output",
                    "Good Output",
                    "Rejected Output",
                    "Yield Variance %",
                ];

                rows = production.map((r) => [
                    r.run_number,
                    r.production_date,
                    r.product_name,
                    r.status,
                    r.batch_size,
                    r.planned_output_qty,
                    r.good_output,
                    r.rejected_output,
                    r.yield_variance_percent,
                ]);
                break;

            case "outstanding":
                headers = [
                    "Invoice Number",
                    "Date",
                    "Customer",
                    "Invoice Total",
                    "Paid Amount",
                    "Outstanding",
                    "Payment Status",
                ];

                rows = outstanding.map((r) => [
                    r.invoice_number,
                    r.invoice_date,
                    r.customer_name,
                    r.total_amount,
                    r.paid_amount,
                    r.outstanding_amount,
                    r.payment_status,
                ]);
                break;

            default:
                setError("Unknown report selected.");
                return;
        }

        if (!rows.length) {
            setError(
                "There are no records to export in this report."
            );
            return;
        }

        setError("");

        const today = new Date()
            .toISOString()
            .slice(0, 10);

        downloadCSV(
            `OrderAudit_${activeTab}_${today}`,
            headers,
            rows
        );
    };

    // ==========================================
    // MAIN USER INTERFACE
    // ==========================================

    return (
        <section className="module-section reports-module">

            {/* PAGE HEADING */}

            <div className="welcome-section">
                <div>
                    <h2>Reports & Accounting</h2>

                    <p>
                        Review sales, GST, purchases, inventory,
                        production and customer outstanding balances.
                    </p>
                </div>

                <button
                    className="refresh-button"
                    onClick={loadReports}
                    disabled={loading}
                >
                    {loading
                        ? "Loading..."
                        : "↻ Refresh reports"}
                </button>
            </div>

            {/* ERROR MESSAGE */}

            {error && (
                <div className="error-banner">
                    {error}

                    <button
                        onClick={() => {
                            setError("");
                            loadReports();
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* DATE FILTERS */}

            <div className="report-filter-bar">

                <div>
                    <label htmlFor="report-from-date">
                        From date
                    </label>

                    <input
                        id="report-from-date"
                        type="date"
                        value={selectedFrom}
                        max={selectedTo || undefined}
                        onChange={(event) =>
                            setSelectedFrom(event.target.value)
                        }
                    />
                </div>

                <div>
                    <label htmlFor="report-to-date">
                        To date
                    </label>

                    <input
                        id="report-to-date"
                        type="date"
                        value={selectedTo}
                        min={selectedFrom || undefined}
                        onChange={(event) =>
                            setSelectedTo(event.target.value)
                        }
                    />
                </div>

                <button
                    className="refresh-button"
                    onClick={applyDateFilters}
                    disabled={loading}
                >
                    Apply dates
                </button>

                <button
                    className="report-clear-button"
                    onClick={clearDateFilters}
                    disabled={loading}
                >
                    Clear dates
                </button>

            </div>

            {/* SUMMARY CARDS */}

            <div className="report-overview-grid">

                <SummaryCard
                    label="Total Sales"
                    value={
                        loading
                            ? "..."
                            : formatCurrency(totalSales)
                    }
                    description="Invoice value retrieved"
                    tone="blue"
                />

                <SummaryCard
                    label="GST Collected"
                    value={
                        loading
                            ? "..."
                            : formatCurrency(gst.total_tax)
                    }
                    description="CGST + SGST + IGST"
                    tone="green"
                />

                <SummaryCard
                    label="Total Purchases"
                    value={
                        loading
                            ? "..."
                            : formatCurrency(totalPurchases)
                    }
                    description="Recorded purchase value"
                    tone="orange"
                />

                <SummaryCard
                    label="Outstanding"
                    value={
                        loading
                            ? "..."
                            : formatCurrency(
                                outstandingTotals.outstanding_total
                            )
                    }
                    description="Pending customer payments"
                    tone="purple"
                />

            </div>

            {/* BUSINESS REPORTS PANEL */}

            <div className="panel reports-panel">

                <div className="panel-heading">

                    <div>
                        <h3>Business Reports</h3>

                        <p>
                            {currentTab?.label || "Reports"}
                            {" · "}
                            Live database records
                        </p>
                    </div>

                    <div className="report-actions">

                        <button
                            className="report-export-button"
                            onClick={handleExport}
                            disabled={loading}
                        >
                            ↓ Export CSV
                        </button>

                        <span className="live-badge">
                            LIVE DATA
                        </span>

                    </div>

                </div>

                {/* REPORT NAVIGATION */}

                <div className="report-tabs">

                    {REPORT_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            className={`report-tab ${activeTab === tab.id
                                ? "active"
                                : ""
                                }`}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setError("");
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}

                </div>

                {/* REPORT CONTENT */}

                {loading && !Object.keys(reportData).length ? (
                    <div className="report-empty">
                        Loading reports from database...
                    </div>
                ) : (

                    <>

                        {/* SALES REGISTER */}

                        {activeTab === "sales" && (
                            <>
                                <div className="report-section-title">
                                    <h3>Sales Register</h3>
                                    <span>
                                        {sales.length} invoices
                                    </span>
                                </div>

                                <ReportTable
                                    rows={sales}
                                    emptyMessage="No sales invoices found."
                                    columns={[
                                        {
                                            key: "invoice_number",
                                            label: "INVOICE",
                                        },
                                        {
                                            key: "invoice_date",
                                            label: "DATE",
                                            render: formatDate,
                                        },
                                        {
                                            key: "customer_name",
                                            label: "CUSTOMER",
                                        },
                                        {
                                            key: "taxable_amount",
                                            label: "TAXABLE VALUE",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "total_tax",
                                            label: "GST",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "total_amount",
                                            label: "TOTAL",
                                            render: (value) => (
                                                <strong>
                                                    {formatCurrency(value)}
                                                </strong>
                                            ),
                                        },
                                        {
                                            key: "payment_status",
                                            label: "PAYMENT STATUS",
                                        },
                                    ]}
                                />
                            </>
                        )}

                        {/* GST SUMMARY */}

                        {activeTab === "gst" && (
                            <>
                                <div className="report-section-title">
                                    <h3>GST Summary</h3>

                                    <span>
                                        {gst.invoice_count || 0} invoices
                                    </span>
                                </div>

                                <div className="gst-summary-grid">

                                    {[
                                        ["Taxable Amount", gst.taxable_amount],
                                        ["CGST", gst.cgst_amount],
                                        ["SGST", gst.sgst_amount],
                                        ["IGST", gst.igst_amount],
                                        ["Total Tax", gst.total_tax],
                                        ["Invoice Total", gst.total_amount],
                                    ].map(([label, value]) => (
                                        <div
                                            className="gst-summary-item"
                                            key={label}
                                        >
                                            <span>{label}</span>

                                            <strong>
                                                {formatCurrency(value)}
                                            </strong>
                                        </div>
                                    ))}

                                </div>
                            </>
                        )}

                        {/* PURCHASE REGISTER */}

                        {activeTab === "purchases" && (
                            <>
                                <div className="report-section-title">
                                    <h3>Purchase Register</h3>

                                    <span>
                                        {purchases.length} purchases
                                    </span>
                                </div>

                                <ReportTable
                                    rows={purchases}
                                    emptyMessage="No purchase records found."
                                    columns={[
                                        {
                                            key: "invoice_number",
                                            label: "PURCHASE INVOICE",
                                        },
                                        {
                                            key: "purchase_date",
                                            label: "DATE",
                                            render: formatDate,
                                        },
                                        {
                                            key: "supplier_id",
                                            label: "SUPPLIER ID",
                                        },
                                        {
                                            key: "subtotal",
                                            label: "SUBTOTAL",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "tax_amount",
                                            label: "TAX",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "total_amount",
                                            label: "TOTAL",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "status",
                                            label: "STATUS",
                                        },
                                    ]}
                                />
                            </>
                        )}

                        {/* STOCK SUMMARY */}

                        {activeTab === "stock-summary" && (
                            <>
                                <div className="report-section-title">
                                    <h3>Current Stock Summary</h3>

                                    <span>
                                        {stock.length} stock items
                                    </span>
                                </div>

                                <ReportTable
                                    rows={stock}
                                    emptyMessage="No stock records found."
                                    columns={[
                                        {
                                            key: "item_name",
                                            label: "ITEM NAME",
                                        },
                                        {
                                            key: "item_type",
                                            label: "TYPE",
                                            render: (value) =>
                                                value === "FINISHED_PRODUCT"
                                                    ? "Finished product"
                                                    : "Raw material",
                                        },
                                        {
                                            key: "stock_quantity",
                                            label: "AVAILABLE STOCK",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "unit_code",
                                            label: "UNIT",
                                        },
                                    ]}
                                />
                            </>
                        )}

                        {/* STOCK LEDGER */}

                        {activeTab === "stock-ledger" && (
                            <>
                                <div className="report-section-title">
                                    <h3>Stock Movement Ledger</h3>

                                    <span>
                                        {ledger.length} movements
                                    </span>
                                </div>

                                <ReportTable
                                    rows={ledger}
                                    emptyMessage="No stock movements found."
                                    columns={[
                                        {
                                            key: "movement_date",
                                            label: "DATE",
                                            render: formatDate,
                                        },
                                        {
                                            key: "item_name",
                                            label: "ITEM",
                                        },
                                        {
                                            key: "movement_type",
                                            label: "MOVEMENT",
                                        },
                                        {
                                            key: "quantity",
                                            label: "QUANTITY",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "unit_code",
                                            label: "UNIT",
                                        },
                                        {
                                            key: "source_type",
                                            label: "SOURCE",
                                        },
                                    ]}
                                />
                            </>
                        )}

                        {/* PRODUCTION REPORT */}

                        {activeTab === "production" && (
                            <>
                                <div className="report-section-title">
                                    <h3>Production Report</h3>

                                    <span>
                                        {production.length} production runs
                                    </span>
                                </div>

                                <ReportTable
                                    rows={production}
                                    emptyMessage="No production runs found."
                                    columns={[
                                        {
                                            key: "run_number",
                                            label: "RUN NUMBER",
                                        },
                                        {
                                            key: "production_date",
                                            label: "DATE",
                                            render: formatDate,
                                        },
                                        {
                                            key: "product_name",
                                            label: "PRODUCT",
                                        },
                                        {
                                            key: "planned_output_qty",
                                            label: "PLANNED",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "good_output",
                                            label: "GOOD OUTPUT",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "rejected_output",
                                            label: "REJECTED",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "yield_variance_percent",
                                            label: "YIELD VARIANCE",
                                            render: (value) => (
                                                <strong
                                                    className={
                                                        Number(value) < 0
                                                            ? "report-negative"
                                                            : "report-positive"
                                                    }
                                                >
                                                    {formatNumber(value)}%
                                                </strong>
                                            ),
                                        },
                                    ]}
                                />

                                <div className="report-section-title production-consumption-heading">
                                    <h3>Material Consumption Variance</h3>
                                    <span>
                                        {productionConsumption.length} material records
                                    </span>
                                </div>

                                <ReportTable
                                    rows={productionConsumption}
                                    emptyMessage="No material consumption records found."
                                    columns={[
                                        {
                                            key: "run_number",
                                            label: "RUN NUMBER",
                                        },
                                        {
                                            key: "material_name",
                                            label: "MATERIAL",
                                        },
                                        {
                                            key: "planned_quantity",
                                            label: "PLANNED",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "actual_quantity",
                                            label: "ACTUAL",
                                            render: formatNumber,
                                        },
                                        {
                                            key: "variance_quantity",
                                            label: "VARIANCE",
                                            render: (value) => (
                                                <strong
                                                    className={
                                                        Number(value) > 0
                                                            ? "report-negative"
                                                            : Number(value) < 0
                                                                ? "report-positive"
                                                                : ""
                                                    }
                                                >
                                                    {Number(value) > 0 ? "+" : ""}
                                                    {formatNumber(value)}
                                                </strong>
                                            ),
                                        },
                                        {
                                            key: "variance_percentage",
                                            label: "VARIANCE %",
                                            render: (value) => (
                                                <strong
                                                    className={
                                                        Number(value) > 0
                                                            ? "report-negative"
                                                            : Number(value) < 0
                                                                ? "report-positive"
                                                                : ""
                                                    }
                                                >
                                                    {Number(value) > 0 ? "+" : ""}
                                                    {formatNumber(value)}%
                                                </strong>
                                            ),
                                        },
                                        {
                                            key: "unit_code",
                                            label: "UNIT",
                                        },
                                    ]}
                                />

                                <p className="report-note">
                                    Positive consumption variance means more material
                                    was used than planned. Negative variance means
                                    actual usage was below the BOM quantity.
                                </p>
                            </>
                        )}

                        {/* PAYMENTS AND OUTSTANDING */}

                        {activeTab === "outstanding" && (
                            <>
                                <div className="report-section-title">
                                    <h3>Payments & Outstanding</h3>

                                    <span>
                                        {outstanding.length} invoices
                                    </span>
                                </div>

                                <div className="outstanding-summary">

                                    <div>
                                        <span>Invoice Total</span>

                                        <strong>
                                            {formatCurrency(
                                                outstandingTotals.invoice_total
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Received</span>

                                        <strong>
                                            {formatCurrency(
                                                outstandingTotals.paid_total
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Outstanding</span>

                                        <strong className="report-negative">
                                            {formatCurrency(
                                                outstandingTotals.outstanding_total
                                            )}
                                        </strong>
                                    </div>

                                </div>

                                <ReportTable
                                    rows={outstanding}
                                    emptyMessage="No outstanding invoices found."
                                    columns={[
                                        {
                                            key: "invoice_number",
                                            label: "INVOICE",
                                        },
                                        {
                                            key: "invoice_date",
                                            label: "DATE",
                                            render: formatDate,
                                        },
                                        {
                                            key: "customer_name",
                                            label: "CUSTOMER",
                                        },
                                        {
                                            key: "total_amount",
                                            label: "INVOICE TOTAL",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "paid_amount",
                                            label: "RECEIVED",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "outstanding_amount",
                                            label: "OUTSTANDING",
                                            render: formatCurrency,
                                        },
                                        {
                                            key: "payment_status",
                                            label: "STATUS",
                                        },
                                    ]}
                                />
                            </>
                        )}

                    </>
                )}

            </div>

            {/* FOOTER */}

            <p className="report-footer-note">
                Reports are retrieved from the OrderAudit PostgreSQL
                database. These views do not modify invoices, payments
                or inventory records.
            </p>

        </section>
    );
}

export default Reports;
