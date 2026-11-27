
import { useEffect, useMemo, useState } from "react";
import { getStock, getSalesOrders } from "./api";
import Invoices from "./Invoices";
import Production from "./Production";
import Reports from "./Reports";
import Purchases from "./Purchases";
import "./App.css";

function App() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  // Load inventory from the backend
  async function loadStock() {
    try {
      setLoading(true);
      setError("");

      const data = await getStock();
      setStock(Array.isArray(data.stock) ? data.stock : []);
    } catch (err) {
      setError(err.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  // Load sales orders from the backend
  async function loadSalesOrders() {
    try {
      setOrdersLoading(true);
      setOrdersError("");

      const data = await getSalesOrders();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setOrdersError(err.message || "Unable to load sales orders.");
    } finally {
      setOrdersLoading(false);
    }
  }

  // Load inventory when the application starts
  useEffect(() => {
    loadStock();
  }, []);

  // Load orders whenever the Sales Orders page is opened
  useEffect(() => {
    if (activePage === "Sales Orders") {
      loadSalesOrders();
    }
  }, [activePage]);

  const finishedGoods = useMemo(
    () => stock.filter((item) => item.item_type === "FINISHED_PRODUCT"),
    [stock]
  );

  const rawMaterials = useMemo(
    () => stock.filter((item) => item.item_type === "RAW_MATERIAL"),
    [stock]
  );

  // Sidebar navigation items
  const menuItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Sales Orders", icon: "▤" },
    { name: "Invoices", icon: "▧" },
    { name: "Inventory", icon: "▥" },
    { name: "Production", icon: "⚙" },
    { name: "Purchases", icon: "＋" },
    { name: "Reports", icon: "▨" },
  ];

  function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">OA</div>
          <div>
            <h2>OrderAudit</h2>
            <span>MANUFACTURING ERP</span>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav className="navigation">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? "active" : ""
                }`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">OW</div>
          <div>
            <strong>Owner</strong>
            <span>Administrator</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / {activePage}</p>
            <h1>{activePage}</h1>
          </div>

          <div className="topbar-right">
            <span className="system-status">
              <span className="status-dot"></span>
              System connected
            </span>
            <div className="profile-circle">OW</div>
          </div>
        </header>

        {/* DASHBOARD AND INVENTORY */}
        {activePage === "Dashboard" || activePage === "Inventory" ? (
          <>
            <section className="welcome-section">
              <div>
                <h2>
                  {activePage === "Dashboard"
                    ? "Business Overview"
                    : "Inventory Overview"}
                </h2>
                <p>
                  Monitor your manufacturing operations and stock position.
                </p>
              </div>

              <button className="refresh-button" onClick={loadStock}>
                ↻ Refresh data
              </button>
            </section>

            {error && <div className="error-banner">{error}</div>}

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon blue">▦</span>
                  <span className="stat-caption">LIVE DATA</span>
                </div>
                <p className="stat-title">Total Stock Items</p>
                <h3>{loading ? "..." : stock.length}</h3>
                <p className="stat-description">
                  Raw materials and finished goods
                </p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon green">▣</span>
                  <span className="stat-caption">FINISHED GOODS</span>
                </div>
                <p className="stat-title">Finished Products</p>
                <h3>{loading ? "..." : finishedGoods.length}</h3>
                <p className="stat-description">
                  Product types currently in stock
                </p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon orange">◈</span>
                  <span className="stat-caption">RAW MATERIALS</span>
                </div>
                <p className="stat-title">Raw Material Types</p>
                <h3>{loading ? "..." : rawMaterials.length}</h3>
                <p className="stat-description">
                  Materials available for production
                </p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-icon purple">↻</span>
                  <span className="stat-caption">DATABASE</span>
                </div>
                <p className="stat-title">Inventory Connection</p>
                <h3 className="connected-text">
                  {loading ? "Checking" : error ? "Error" : "Live"}
                </h3>
                <p className="stat-description">
                  Stock retrieved from PostgreSQL
                </p>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel inventory-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Current Inventory</h3>
                    <p>Live balances from your stock ledger</p>
                  </div>
                  <span className="live-badge">LIVE</span>
                </div>

                {loading ? (
                  <div className="empty-state">Loading inventory...</div>
                ) : stock.length === 0 ? (
                  <div className="empty-state">
                    No inventory records found.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>ITEM NAME</th>
                          <th>TYPE</th>
                          <th>AVAILABLE STOCK</th>
                          <th>UNIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.map((item) => (
                          <tr
                            key={`${item.item_type}-${item.item_id}`}
                          >
                            <td className="item-name">{item.item_name}</td>
                            <td>
                              <span
                                className={`type-tag ${item.item_type === "FINISHED_PRODUCT"
                                  ? "finished-tag"
                                  : "raw-tag"
                                  }`}
                              >
                                {item.item_type === "FINISHED_PRODUCT"
                                  ? "Finished"
                                  : "Raw material"}
                              </span>
                            </td>
                            <td className="quantity">
                              {Number(item.stock_quantity).toLocaleString(
                                "en-IN",
                                { maximumFractionDigits: 3 }
                              )}
                            </td>
                            <td>{item.unit_code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="panel summary-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Operations</h3>
                    <p>Core business workflows</p>
                  </div>
                </div>

                <div className="operation-item">
                  <span className="operation-icon blue">▤</span>
                  <div>
                    <strong>Sales Management</strong>
                    <p>Orders, approvals and invoices</p>
                  </div>
                </div>

                <div className="operation-item">
                  <span className="operation-icon orange">⚙</span>
                  <div>
                    <strong>Production Management</strong>
                    <p>BOM, material usage and output</p>
                  </div>
                </div>

                <div className="operation-item">
                  <span className="operation-icon green">▥</span>
                  <div>
                    <strong>Inventory Management</strong>
                    <p>Raw material and finished stock</p>
                  </div>
                </div>

                <div className="operation-item">
                  <span className="operation-icon purple">▨</span>
                  <div>
                    <strong>Accounts and Reports</strong>
                    <p>Payments, costs and audit reports</p>
                  </div>
                </div>
              </div>
            </section>

            <footer className="footer">
              Order-to-Audit Manufacturing System
              <span>Inventory data connected to PostgreSQL</span>
            </footer>
          </>
        ) : null}

        {/* SALES ORDERS */}
        {activePage === "Sales Orders" && (
          <section className="module-section">
            <div className="welcome-section">
              <div>
                <h2>Sales Order Management</h2>
                <p>
                  View customer orders and monitor their approval status.
                </p>
              </div>

              <button
                className="refresh-button"
                onClick={loadSalesOrders}
                disabled={ordersLoading}
              >
                {ordersLoading ? "Loading..." : "↻ Refresh orders"}
              </button>
            </div>

            <div className="order-summary-grid">
              <div className="stat-card">
                <p className="stat-title">Orders Retrieved</p>
                <h3>{ordersLoading ? "..." : orders.length}</h3>
                <p className="stat-description">
                  Orders returned by the API
                </p>
              </div>

              <div className="stat-card">
                <p className="stat-title">Pending Orders</p>
                <h3>
                  {ordersLoading
                    ? "..."
                    : orders.filter(
                      (order) => order.status === "PENDING"
                    ).length}
                </h3>
                <p className="stat-description">
                  Awaiting admin review
                </p>
              </div>

              <div className="stat-card">
                <p className="stat-title">Order Value</p>
                <h3 className="order-value">
                  {ordersLoading
                    ? "..."
                    : formatCurrency(
                      orders.reduce(
                        (sum, order) =>
                          sum + Number(order.order_total || 0),
                        0
                      )
                    )}
                </h3>
                <p className="stat-description">
                  Total value of retrieved orders
                </p>
              </div>
            </div>

            {ordersError && (
              <div className="error-banner">{ordersError}</div>
            )}

            <div className="panel orders-panel">
              <div className="panel-heading">
                <div>
                  <h3>Customer Orders</h3>
                  <p>Live sales order records from the backend</p>
                </div>
                <span className="live-badge">LIVE</span>
              </div>

              {ordersLoading ? (
                <div className="empty-state">Loading sales orders...</div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  No sales orders were returned by the API.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>ORDER NUMBER</th>
                        <th>DATE</th>
                        <th>CUSTOMER</th>
                        <th>TYPE</th>
                        <th>LOCATION</th>
                        <th>ITEMS</th>
                        <th>ORDER VALUE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.order_id}>
                          <td className="item-name">
                            {order.order_number}
                          </td>
                          <td>{formatDate(order.order_date)}</td>
                          <td>
                            <strong>{order.customer_name}</strong>
                          </td>
                          <td>{order.customer_type || "—"}</td>
                          <td>{order.state || "—"}</td>
                          <td>{order.total_items ?? "—"}</td>
                          <td className="quantity">
                            {formatCurrency(order.order_total)}
                          </td>
                          <td>
                            <span
                              className={`order-status ${String(order.status || "").toLowerCase()
                                }`}
                            >
                              {order.status || "UNKNOWN"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="module-note">
              Orders are displayed using the records returned by the
              administrator sales-orders API. Approval and rejection
              actions will be added after the order workflow is verified.
            </p>
          </section>
        )}

        {/* INVOICES MODULE */}
        {activePage === "Invoices" && <Invoices />}

        {/* PRODUCTION MODULE */}
        {activePage === "Production" && <Production />}

        {/* REPORTS MODULE */}
        {activePage === "Reports" && <Reports />}

        {/* PURCHASES MODULE */}
        {activePage === "Purchases" && <Purchases />}

        {/* OTHER MODULE PLACEHOLDERS */}
        {activePage !== "Dashboard" &&
          activePage !== "Inventory" &&
          activePage !== "Sales Orders" &&
          activePage !== "Invoices" &&
          activePage !== "Production" &&
          activePage !== "Reports" &&
          activePage !== "Purchases" && (
            <section className="coming-soon">
              <div className="coming-icon">◈</div>
              <h2>{activePage}</h2>
              <p>
                This module will be connected to the backend in the next
                development steps.
              </p>
              <button
                className="refresh-button"
                onClick={() => setActivePage("Dashboard")}
              >
                Return to Dashboard
              </button>
            </section>
          )}
      </main>
    </div>
  );
}

export default App;
