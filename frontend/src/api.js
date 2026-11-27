
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Check backend connection
export async function getHealth() {
    const response = await fetch(`${API_URL}/api/health`);

    if (!response.ok) {
        throw new Error("Backend connection failed");
    }

    return response.json();
}

// Fetch current inventory
export async function getStock() {
    const response = await fetch(`${API_URL}/api/stock`);

    if (!response.ok) {
        throw new Error("Unable to fetch stock");
    }

    return response.json();
}

// Fetch all sales orders for admin
export async function getSalesOrders() {
    const response = await fetch(`${API_URL}/api/admin/sales-orders`);

    if (!response.ok) {
        throw new Error("Unable to fetch sales orders");
    }

    return response.json();
}



export async function getInvoices() {
    const response = await fetch(
        `${API_URL}/api/admin/invoices`
    );

    if (!response.ok) {
        throw new Error("Unable to fetch invoices");
    }

    return response.json();
}


export async function getInvoiceDetails(invoiceId) {
    const response = await fetch(
        `${API_URL}/api/admin/invoices/${invoiceId}`
    );

    if (!response.ok) {
        throw new Error("Unable to fetch invoice details");
    }

    return response.json();
}


// ==========================================
// PRODUCTION MODULE API FUNCTIONS
// ==========================================

// Fetch all active Bills of Materials
export async function getBoms() {
    const response = await fetch(`${API_URL}/api/bom`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Unable to fetch BOMs");
    }

    return data;
}

// Fetch details and materials of a selected BOM
export async function getBomDetails(bomId) {
    const response = await fetch(
        `${API_URL}/api/bom/${bomId}`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Unable to fetch BOM details");
    }

    return data;
}

// Fetch production history
export async function getProductionRuns() {
    const response = await fetch(
        `${API_URL}/api/production`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Unable to fetch production history");
    }

    return data;
}

// Submit a new production run
export async function createProductionRun(productionData) {
    const response = await fetch(
        `${API_URL}/api/production`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(productionData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Unable to record production");
    }

    return data;
}
