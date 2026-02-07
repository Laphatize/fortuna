"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const severityStyles = {
  high: { bg: "#fce4ec", color: "#b54a4a" },
  medium: { bg: "#fff3e0", color: "#c4913b" },
  low: { bg: "#e8f5e9", color: "#2e7d32" },
};

export default function CompliancePage() {
  const [scanning, setScanning] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [scores, setScores] = useState([]);
  const [summary, setSummary] = useState("");
  const [entities, setEntities] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [entitiesInput, setEntitiesInput] = useState("[]");
  const [transactionsInput, setTransactionsInput] = useState("[]");
  const [inputError, setInputError] = useState("");
  const [runs, setRuns] = useState([]);
  const [selectedRules, setSelectedRules] = useState(["AML", "KYC", "OFAC", "SOX", "RegW", "Patterns"]);

  const complianceRules = [
    { id: "AML", label: "AML - Anti-Money Laundering" },
    { id: "KYC", label: "KYC - Know Your Customer" },
    { id: "OFAC", label: "OFAC - Sanctions Screening" },
    { id: "SOX", label: "SOX - Sarbanes-Oxley" },
    { id: "RegW", label: "Regulation W - Affiliate Limits" },
    { id: "Patterns", label: "Transaction Patterns" },
  ];

  useEffect(() => {
    reloadDataset();
    reloadRuns();
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
        body: JSON.stringify({ entities, transactions, selectedRules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAlerts(data.alerts || []);
      setScores(data.regulatory_scores || []);
      setSummary(data.summary || "");
      setInputError("");
      reloadRuns();
    } catch (err) {
      console.error("Compliance scan failed:", err);
      setInputError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function loadInputs() {
    try {
      const parsedEntities = JSON.parse(entitiesInput);
      const parsedTransactions = JSON.parse(transactionsInput);
      if (!Array.isArray(parsedEntities) || !Array.isArray(parsedTransactions)) {
        throw new Error("Inputs must be JSON arrays.");
      }
      setEntities(parsedEntities);
      setTransactions(parsedTransactions);
      setAlerts([]);
      setScores([]);
      setSummary("");
      setInputError("");
    } catch (err) {
      setInputError(err.message);
    }
  }

  async function saveDataset() {
    try {
      const parsedEntities = JSON.parse(entitiesInput);
      const parsedTransactions = JSON.parse(transactionsInput);
      if (!Array.isArray(parsedEntities) || !Array.isArray(parsedTransactions)) {
        throw new Error("Inputs must be JSON arrays.");
      }
      const res = await fetch(`${API}/api/compliance/dataset`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: parsedEntities, transactions: parsedTransactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntities(data.entities || []);
      setTransactions(data.transactions || []);
      setEntitiesInput(JSON.stringify(data.entities || [], null, 2));
      setTransactionsInput(JSON.stringify(data.transactions || [], null, 2));
      setInputError("");
    } catch (err) {
      setInputError(err.message);
    }
  }

  async function reloadDataset() {
    try {
      const res = await fetch(`${API}/api/compliance/dataset`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntities(data.entities || []);
      setTransactions(data.transactions || []);
      setEntitiesInput(JSON.stringify(data.entities || [], null, 2));
      setTransactionsInput(JSON.stringify(data.transactions || [], null, 2));
    } catch (err) {
      setInputError(err.message);
    }
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
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Compliance</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Regulatory monitoring, AI-driven alerts, and audit readiness</p>
        </div>
        <button onClick={runScan} disabled={scanning || (entities.length === 0 && transactions.length === 0)}
          className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {scanning && <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
          {scanning ? "Scanning..." : "Run Compliance Scan"}
        </button>
      </div>

      <div className="rounded border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Compliance Rules to Check</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Select which compliance rules to scan for.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {complianceRules.map((rule) => (
            <label key={rule.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRules.includes(rule.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRules([...selectedRules, rule.id]);
                  } else {
                    setSelectedRules(selectedRules.filter((r) => r !== rule.id));
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-xs" style={{ color: "var(--foreground)" }}>{rule.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Input Data</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Paste JSON arrays for entities and transactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadInputs}
              className="rounded-sm px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              Load Local
            </button>
            <button
              onClick={saveDataset}
              className="rounded-sm px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              Save to DB
            </button>
            <button
              onClick={reloadDataset}
              className="rounded-sm px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              Reload
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <textarea
            value={entitiesInput}
            onChange={(e) => setEntitiesInput(e.target.value)}
            rows={6}
            className="w-full rounded border p-3 text-xs font-mono"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            placeholder='[{"name":"Counterparty A","type":"Counterparty","kyc_expiry":"2026-03-01","jurisdiction":"US"}]'
          />
          <textarea
            value={transactionsInput}
            onChange={(e) => setTransactionsInput(e.target.value)}
            rows={6}
            className="w-full rounded border p-3 text-xs font-mono"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            placeholder='[{"id":"TXN-001","entity":"Counterparty A","amount":"1000","type":"Wire","date":"2026-02-07"}]'
          />
        </div>
        {inputError && <p className="text-xs" style={{ color: "#b54a4a" }}>{inputError}</p>}
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {entities.length} entity(ies), {transactions.length} transaction(s) loaded.
        </p>
      </div>

      {summary && (
        <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>AI Assessment</p>
          <p className="text-[13px]" style={{ color: "var(--foreground)" }}>{summary}</p>
        </div>
      )}

      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Run History</h2>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>No runs yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {runs.slice(0, 5).map((run) => (
              <div key={run._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                    {run.status === "success" ? "Success" : "Error"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                {run.alerts && (
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
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
          <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {alerts.length > 0 ? `Active Alerts (${alerts.length})` : "Active Alerts"}
              </h2>
            </div>
            {alerts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--muted)" }}>{scanning ? "Scanning..." : "Run a compliance scan to detect issues."}</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {alerts.map((alert, i) => (
                  <div key={alert.id || i} className="px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-2 rounded-sm" style={{ background: severityStyles[alert.severity]?.color || "var(--muted)" }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{alert.rule}</span>
                            <span className="rounded-sm px-2 py-0.5 text-[10px] font-medium capitalize"
                              style={{ background: severityStyles[alert.severity]?.bg, color: severityStyles[alert.severity]?.color }}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>{alert.entity}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 pl-[18px] text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{alert.detail}</p>
                    {alert.recommended_action && (
                      <p className="mt-1 pl-[18px] text-xs" style={{ color: "var(--accent)" }}>Action: {alert.recommended_action}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Regulatory Status</h2>
          </div>
          {scores.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>{scanning ? "Scoring..." : "Run scan to get scores."}</p>
            </div>
          ) : (
            <div className="space-y-1 p-3">
              {scores.map((reg, i) => (
                <div key={i} className="rounded-sm px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{reg.regulation}</p>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--accent)" }}>{reg.score}%</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-sm" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-sm transition-all" style={{
                      width: `${reg.score}%`,
                      background: reg.score >= 95 ? "#3d8c5c" : reg.score >= 85 ? "#c4913b" : "#b54a4a",
                    }} />
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{reg.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
