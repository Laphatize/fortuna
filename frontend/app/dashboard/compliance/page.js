"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const severityStyles = {
  high: { bg: "#fee2e2", color: "#dc2626" },
  medium: { bg: "#dbeafe", color: "#2563eb" },
  low: { bg: "#dcfce7", color: "#16a34a" },
};

export default function CompliancePage() {
  const [scanning, setScanning] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [scores, setScores] = useState([]);
  const [summary, setSummary] = useState("");
  const [entities, setEntities] = useState([]);
  const [transactions, setTransactions] = useState([]);
  // JSON inputs hidden; data is sourced from documents/datasets
  const [runs, setRuns] = useState([]);
  const [dirty] = useState(false);

  useEffect(() => {
    reloadDataset();
    reloadRuns();
    const interval = setInterval(() => {
      if (!dirty) {
        reloadDataset();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function runScan() {
    setScanning(true);
    try {
      if (!entities.length && !transactions.length) {
        throw new Error("Load entities or transactions to run a scan.");
      }
      const res = await fetch(`${API}/api/compliance/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities, transactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAlerts(data.alerts || []);
      setScores(data.regulatory_scores || []);
      setSummary(data.summary || "");
      reloadRuns();
    } catch (err) {
      console.error("Compliance scan failed:", err);
    } finally {
      setScanning(false);
    }
  }

  function loadInputs() {}
  async function saveDataset() {}

  async function reloadDataset() {
    try {
      const res = await fetch(`${API}/api/compliance/dataset`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntities(data.entities || []);
      setTransactions(data.transactions || []);
    } catch (err) {}
  }

  async function reloadRuns() {
    try {
      const res = await fetch(`${API}/api/compliance/runs`);
      const data = await res.json();
      if (res.ok) setRuns(data);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Compliance</h1>
          <p className="mt-1 text-sm text-gray-500">Regulatory monitoring, AI-driven alerts, and audit readiness</p>
        </div>
        <button onClick={runScan} disabled={scanning || (entities.length === 0 && transactions.length === 0)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50">
          {scanning && <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
          {scanning ? "Scanning..." : "Run Compliance Scan"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Entities and transactions loaded from documents or saved datasets.</p>
          </div>
          <button
            onClick={reloadDataset}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-medium text-blue-600 shadow-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {summary && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-blue-600">AI Assessment</p>
          <p className="text-[13px] text-gray-900">{summary}</p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Run History</h2>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-gray-500">No runs yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {runs.slice(0, 5).map((run) => (
              <div key={run._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-gray-900">
                    {run.status === "success" ? "Success" : "Error"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                {run.alerts && (
                  <div className="text-xs text-gray-500">
                    {run.alerts.length} alerts
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">
                {alerts.length > 0 ? `Active Alerts (${alerts.length})` : "Active Alerts"}
              </h2>
            </div>
            {alerts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">{scanning ? "Scanning..." : "Run a compliance scan to detect issues."}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map((alert, i) => (
                  <div key={alert.id || i} className="px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: severityStyles[alert.severity]?.color || "#6b7280" }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-gray-900">{alert.rule}</span>
                            <span className="rounded-md px-2 py-0.5 text-[10px] font-medium capitalize"
                              style={{ background: severityStyles[alert.severity]?.bg, color: severityStyles[alert.severity]?.color }}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{alert.entity}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 pl-[18px] text-xs leading-relaxed text-gray-500">{alert.detail}</p>
                    {alert.recommended_action && (
                      <p className="mt-1 pl-[18px] text-xs text-blue-600">Action: {alert.recommended_action}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Regulatory Status</h2>
          </div>
          {scores.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-500">{scanning ? "Scoring..." : "Run scan to get scores."}</p>
            </div>
          ) : (
            <div className="space-y-1 p-3">
              {scores.map((reg, i) => (
                <div key={i} className="rounded-sm px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-gray-900">{reg.regulation}</p>
                    <span className="text-xs font-semibold tabular-nums text-blue-600">{reg.score}%</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${reg.score}%`,
                      background: reg.score >= 95 ? "#16a34a" : reg.score >= 85 ? "#2563eb" : "#dc2626",
                    }} />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">{reg.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
