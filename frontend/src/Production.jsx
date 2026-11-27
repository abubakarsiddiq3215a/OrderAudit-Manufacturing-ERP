
import { useEffect, useMemo, useState } from "react";
import {
    getBoms,
    getBomDetails,
    getProductionRuns,
    createProductionRun,
} from "./api";

function Production() {
    const [boms, setBoms] = useState([]);
    const [selectedBomId, setSelectedBomId] = useState("");
    const [bomDetails, setBomDetails] = useState(null);
    const [productionRuns, setProductionRuns] = useState([]);

    const [batchSize, setBatchSize] = useState("1");
    const [runNumber, setRunNumber] = useState("");
    const [productionDate, setProductionDate] = useState(() => {
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        return today.toISOString().slice(0, 10);
    });
    const [actualConsumption, setActualConsumption] = useState([]);
    const [goodOutput, setGoodOutput] = useState("");
    const [rejectedOutput, setRejectedOutput] = useState("0");
    const [notes, setNotes] = useState("");

    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Load BOM list and production history
    async function loadInitialData() {
        try {
            setLoading(true);
            setError("");

            const [bomData, productionData] = await Promise.all([
                getBoms(),
                getProductionRuns(),
            ]);

            const availableBoms = Array.isArray(bomData.boms)
                ? bomData.boms
                : [];

            setBoms(availableBoms);

            setProductionRuns(
                Array.isArray(productionData.production_runs)
                    ? productionData.production_runs
                    : []
            );

            if (availableBoms.length > 0) {
                setSelectedBomId(String(availableBoms[0].bom_id));
            }
        } catch (err) {
            setError(err.message || "Unable to load production data.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadInitialData();
    }, []);

    // Load selected BOM details
    useEffect(() => {
        if (!selectedBomId) {
            setBomDetails(null);
            setActualConsumption([]);
            return;
        }

        async function loadDetails() {
            try {
                setDetailsLoading(true);
                setError("");

                const data = await getBomDetails(selectedBomId);

                setBomDetails(data.bom || null);

                const materials = Array.isArray(data.materials)
                    ? data.materials
                    : [];

                setActualConsumption(
                    materials.map((material) => ({
                        material_id: material.material_id,
                        material_name: material.material_name,
                        unit_id: material.unit_id,
                        unit_code: material.unit_code,
                        planned_quantity: Number(material.required_quantity || 0),
                        actual_quantity: String(
                            Number(material.required_quantity || 0) *
                            Number(batchSize || 1)
                        ),
                    }))
                );

                if (data.bom) {
                    setGoodOutput(
                        String(
                            Number(data.bom.expected_output_qty || 0) *
                            Number(batchSize || 1)
                        )
                    );
                }
            } catch (err) {
                setError(err.message || "Unable to load BOM details.");
            } finally {
                setDetailsLoading(false);
            }
        }

        loadDetails();
    }, [selectedBomId]);

    // Calculate planned output
    const plannedOutput = useMemo(() => {
        return (
            Number(bomDetails?.expected_output_qty || 0) *
            Number(batchSize || 0)
        );
    }, [bomDetails, batchSize]);

    // Calculate yield variance
    const latestRun = productionRuns[0];

    const yieldVariance = useMemo(() => {
        if (!latestRun || Number(latestRun.planned_output_qty) <= 0) {
            return 0;
        }

        return (
            ((Number(latestRun.good_output_qty) -
                Number(latestRun.planned_output_qty)) /
                Number(latestRun.planned_output_qty)) *
            100
        );
    }, [latestRun]);

    // Update actual material consumption
    function updateConsumption(index, value) {
        setActualConsumption((previous) =>
            previous.map((material, i) =>
                i === index
                    ? { ...material, actual_quantity: value }
                    : material
            )
        );
    }

    // Update batch size and refresh planned defaults
    function updateBatchSize(value) {
        setBatchSize(value);

        setActualConsumption((previous) =>
            previous.map((material) => ({
                ...material,
                actual_quantity: String(
                    material.planned_quantity * Number(value || 0)
                ),
            }))
        );

        if (bomDetails) {
            setGoodOutput(
                String(
                    Number(bomDetails.expected_output_qty || 0) *
                    Number(value || 0)
                )
            );
        }
    }

    // Submit a production run
    async function handleSubmit(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!selectedBomId || !bomDetails) {
            setError("Please select a valid BOM.");
            return;
        }

        if (!runNumber.trim()) {
            setError("Please enter a production run number.");
            return;
        }

        if (Number(batchSize) <= 0) {
            setError("Batch size must be greater than zero.");
            return;
        }

        if (Number(goodOutput) < 0 || goodOutput === "") {
            setError("Enter a valid good output quantity.");
            return;
        }

        if (Number(rejectedOutput) < 0) {
            setError("Rejected output cannot be negative.");
            return;
        }

        if (
            actualConsumption.some(
                (material) =>
                    material.actual_quantity === "" ||
                    Number(material.actual_quantity) < 0
            )
        ) {
            setError("Enter valid consumption quantities for all materials.");
            return;
        }

        const payload = {
            run_number: runNumber.trim(),
            bom_id: Number(selectedBomId),
            batch_size: Number(batchSize),
            actual_consumption: actualConsumption.map((material) => ({
                material_id: Number(material.material_id),
                quantity: Number(material.actual_quantity),
                unit_id: Number(material.unit_id),
            })),
            good_output_qty: Number(goodOutput),
            rejected_output_qty: Number(rejectedOutput || 0),
            production_date: productionDate,
            notes: notes.trim(),
        };

        try {
            setSaving(true);

            const result = await createProductionRun(payload);

            setSuccess(
                result.message || "Production run recorded successfully."
            );

            setRunNumber("");
            setNotes("");
            setRejectedOutput("0");

            await loadInitialData();
        } catch (err) {
            setError(err.message || "Unable to record production run.");
        } finally {
            setSaving(false);
        }
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 3,
        });
    }

    return (
        <section className="module-section production-module">
            <div className="welcome-section">
                <div>
                    <h2>Production Management</h2>
                    <p>
                        Record material consumption, production output and yield
                        performance.
                    </p>
                </div>

                <button
                    className="refresh-button"
                    onClick={loadInitialData}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "↻ Refresh data"}
                </button>
            </div>

            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            <div className="production-summary-grid">
                <div className="stat-card">
                    <div className="stat-top">
                        <span className="stat-icon blue">▤</span>
                        <span className="stat-caption">BOM</span>
                    </div>
                    <p className="stat-title">Available BOMs</p>
                    <h3>{loading ? "..." : boms.length}</h3>
                    <p className="stat-description">Active production recipes</p>
                </div>

                <div className="stat-card">
                    <div className="stat-top">
                        <span className="stat-icon green">⚙</span>
                        <span className="stat-caption">PRODUCTION</span>
                    </div>
                    <p className="stat-title">Production Runs</p>
                    <h3>{loading ? "..." : productionRuns.length}</h3>
                    <p className="stat-description">Recorded production batches</p>
                </div>

                <div className="stat-card">
                    <div className="stat-top">
                        <span className="stat-icon orange">▣</span>
                        <span className="stat-caption">PLANNED</span>
                    </div>
                    <p className="stat-title">Expected Output</p>
                    <h3>{formatNumber(plannedOutput)}</h3>
                    <p className="stat-description">Packets for selected batch size</p>
                </div>

                <div className="stat-card">
                    <div className="stat-top">
                        <span className="stat-icon purple">↗</span>
                        <span className="stat-caption">YIELD</span>
                    </div>
                    <p className="stat-title">Yield Variance</p>
                    <h3
                        className={
                            yieldVariance < 0 ? "variance-negative" : "variance-positive"
                        }
                    >
                        {formatNumber(yieldVariance)}%
                    </h3>
                    <p className="stat-description">Actual output versus planned</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="panel production-form-panel">
                    <div className="panel-heading">
                        <div>
                            <h3>New Production Run</h3>
                            <p>Enter production details and actual material usage</p>
                        </div>
                        <span className="live-badge">PRODUCTION</span>
                    </div>

                    <div className="production-fields">
                        <div className="production-field">
                            <label>Production Run Number</label>
                            <input
                                type="text"
                                value={runNumber}
                                onChange={(e) => setRunNumber(e.target.value)}
                                placeholder="Example: PROD-002"
                                required
                            />
                        </div>

                        <div className="production-field">
                            <label>Select BOM / Product</label>
                            <select
                                value={selectedBomId}
                                onChange={(e) => setSelectedBomId(e.target.value)}
                                required
                            >
                                <option value="">Select a BOM</option>
                                {boms.map((bom) => (
                                    <option key={bom.bom_id} value={bom.bom_id}>
                                        {bom.product_name} — BOM #{bom.bom_id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="production-field">
                            <label>Batch Size</label>
                            <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={batchSize}
                                onChange={(e) => updateBatchSize(e.target.value)}
                                required
                            />
                        </div>

                        <div className="production-field">
                            <label>Production Date</label>
                            <input
                                type="date"
                                value={productionDate}
                                onChange={(e) => setProductionDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="production-section-heading">
                        <div>
                            <h3>Material Consumption</h3>
                            <p>Compare BOM quantities with actual material usage.</p>
                        </div>
                    </div>

                    {detailsLoading ? (
                        <div className="empty-state">Loading BOM materials...</div>
                    ) : actualConsumption.length === 0 ? (
                        <div className="empty-state">
                            Select a BOM to view its materials.
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="production-table">
                                <thead>
                                    <tr>
                                        <th>MATERIAL</th>
                                        <th>PLANNED QUANTITY</th>
                                        <th>ACTUAL QUANTITY</th>
                                        <th>UNIT</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {actualConsumption.map((material, index) => (
                                        <tr key={material.material_id}>
                                            <td className="item-name">
                                                {material.material_name}
                                            </td>
                                            <td>
                                                {formatNumber(
                                                    material.planned_quantity * Number(batchSize || 0)
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    className="consumption-input"
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    value={material.actual_quantity}
                                                    onChange={(e) =>
                                                        updateConsumption(index, e.target.value)
                                                    }
                                                    required
                                                />
                                            </td>
                                            <td>{material.unit_code}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="production-section-heading">
                        <div>
                            <h3>Production Output</h3>
                            <p>Record the actual quantity produced.</p>
                        </div>
                    </div>

                    <div className="production-fields">
                        <div className="production-field">
                            <label>Planned Output</label>
                            <input
                                type="text"
                                value={formatNumber(plannedOutput)}
                                readOnly
                            />
                        </div>

                        <div className="production-field">
                            <label>Good Output (Packets)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={goodOutput}
                                onChange={(e) => setGoodOutput(e.target.value)}
                                required
                            />
                        </div>

                        <div className="production-field">
                            <label>Rejected Output (Packets)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={rejectedOutput}
                                onChange={(e) => setRejectedOutput(e.target.value)}
                            />
                        </div>

                        <div className="production-field">
                            <label>Yield Variance</label>
                            <input
                                type="text"
                                value={`${formatNumber(yieldVariance)}%`}
                                readOnly
                            />
                        </div>
                    </div>

                    <div className="production-field production-notes">
                        <label>Production Notes</label>
                        <textarea
                            rows="3"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter wastage details, machine issues or other observations..."
                        />
                    </div>

                    <div className="production-actions">
                        <button
                            type="submit"
                            className="production-submit-button"
                            disabled={saving || loading || detailsLoading}
                        >
                            {saving ? "Recording production..." : "Record Production Run"}
                        </button>
                    </div>
                </div>
            </form>

            <div className="panel production-history-panel">
                <div className="panel-heading">
                    <div>
                        <h3>Production History</h3>
                        <p>Previously recorded production runs</p>
                    </div>
                    <span className="live-badge">LIVE DATA</span>
                </div>

                {loading ? (
                    <div className="empty-state">Loading production history...</div>
                ) : productionRuns.length === 0 ? (
                    <div className="empty-state">
                        No production runs have been recorded yet.
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="production-table history-table">
                            <thead>
                                <tr>
                                    <th>RUN NUMBER</th>
                                    <th>DATE</th>
                                    <th>PRODUCT</th>
                                    <th>PLANNED OUTPUT</th>
                                    <th>GOOD OUTPUT</th>
                                    <th>REJECTED</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>

                            <tbody>
                                {productionRuns.map((run) => (
                                    <tr key={run.production_run_id}>
                                        <td className="item-name">{run.run_number}</td>
                                        <td>{formatDate(run.production_date)}</td>
                                        <td>{run.product_name}</td>
                                        <td>{formatNumber(run.planned_output_qty)}</td>
                                        <td className="quantity">
                                            {formatNumber(run.good_output_qty)}
                                        </td>
                                        <td>{formatNumber(run.rejected_output_qty)}</td>
                                        <td>
                                            <span className="order-status approved">
                                                {run.status || "RECORDED"}
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
                Material consumption and production output are recorded through the
                production API. Stock validation is performed by the backend.
            </p>
        </section>
    );
}

export default Production;
