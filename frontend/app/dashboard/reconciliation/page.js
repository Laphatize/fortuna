"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const statusColors = {
  matched: { bg: "#dcfce7", color: "#16a34a", label: "Matched" },
  exception: { bg: "#fee2e2", color: "#dc2626", label: "Exception" },
  pending: { bg: "#dbeafe", color: "#2563eb", label: "Pending" },
  resolved: { bg: "#ccfbf1", color: "#0f766e", label: "Resolved" },
};

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [running, setRunning] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  // JSON input hidden; data is sourced from documents/datasets
  const [runs, setRuns] = useState([]);
  const [dirty] = useState(false);
  const [resolutions, setResolutions] = useState({});
  const [resolveDraft, setResolveDraft] = useState(null);

  useEffect(() => {
    reloadDataset();
    reloadRuns();
    reloadResolutions();
    const interval = setInterval(() => {
      if (!dirty) reloadDataset();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function runReconciliation() {
    setRunning(true);
    try {
      if (!transactions.length) {
        throw new Error("Load at least one transaction to run reconciliation.");
      }
      const res = await fetch(`${API}/api/reconciliation/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiResults(data.results || []);
      setRecommendations(data.recommendations || []);
      reloadRuns();
      reloadResolutions();
    } catch (err) {
      console.error("Reconciliation failed:", err);
    } finally {
      setRunning(false);
    }
  }

  function loadTransactions() {}

  async function saveDataset() {}

  async function reloadDataset() {
    try {
      const res = await fetch(`${API}/api/reconciliation/dataset`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTransactions(data.transactions || []);
    } catch (err) {}
  }

  async function reloadRuns() {
    try {
      const res = await fetch(`${API}/api/reconciliation/runs`);
      const data = await res.json();
      if (res.ok) {
        setRuns(data);
        if (data.length > 0) {
          const latest = data[0];
          setAiResults(latest.results || []);
          setRecommendations(latest.recommendations || []);
        }
      }
    } catch {
      // ignore
    }
  }

  async function reloadResolutions() {
    try {
      const res = await fetch(`${API}/api/reconciliation/resolutions`);
      const data = await res.json();
      if (!res.ok) return;
      const map = {};
      data.forEach((r) => {
        map[r.transactionId] = r;
      });
      setResolutions(map);
    } catch {
      // ignore
    }
  }

  function getStatus(txnId) {
    const resolution = resolutions[txnId];
    if (resolution?.status) return resolution.status;
    if (!aiResults) return "pending";
    const r = aiResults.find((r) => r.id === txnId);
    return r?.status || "pending";
  }

  function getNotes(txnId) {
    const resolution = resolutions[txnId];
    if (resolution) {
      const extra = [
        resolution.matched_with ? `Matched with ${resolution.matched_with}` : null,
        resolution.notes ? resolution.notes : null,
      ].filter(Boolean);
      return extra.join(" — ");
    }
    if (!aiResults) return null;
    const r = aiResults.find((r) => r.id === txnId);
    return r?.notes || null;
  }

  async function saveResolution() {
    if (!resolveDraft?.transactionId) return;
    const res = await fetch(`${API}/api/reconciliation/resolutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resolveDraft),
    });
    if (res.ok) {
      const data = await res.json();
      setResolutions((prev) => ({ ...prev, [data.transactionId]: data }));
      setResolveDraft(null);
    }
  }

  const rows = transactions.map((t) => ({ ...t, status: getStatus(t.id) }));
  const filtered = activeTab === "all" ? rows : rows.filter((t) => t.status === activeTab);
  const matchedCount = rows.filter((t) => t.status === "matched").length;
  const exceptionCount = rows.filter((t) => t.status === "exception").length;
  const pendingCount = rows.filter((t) => t.status === "pending").length;
  const resolvedCount = rows.filter((t) => t.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Reconciliation</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>AI-powered transaction matching and exception resolution</p>
        </div>
        <button onClick={runReconciliation} disabled={running || transactions.length === 0}
          className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {running && <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
          {running ? "Analyzing..." : "Run Reconciliation"}
        </button>
      </div>

      <div className="rounded border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Transactions loaded from documents or saved datasets.</p>
          </div>
          <button
            onClick={reloadDataset}
            className="rounded-sm px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Matched</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "#16a34a" }}>{matchedCount}</p>
        </div>
        <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Exceptions</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "#dc2626" }}>{exceptionCount}</p>
        </div>
        <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Pending</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "#2563eb" }}>{pendingCount}</p>
        </div>
        <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Resolved</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "#0f766e" }}>{resolvedCount}</p>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="rounded border p-5 space-y-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>AI Recommendations</p>
          {recommendations.map((rec, i) => (
            <p key={i} className="text-[13px]" style={{ color: "var(--foreground)" }}>{rec}</p>
          ))}
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
                {run.summary && (
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {run.summary.matched}/{run.summary.total} matched
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          {["all", "matched", "exception", "pending", "resolved"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="rounded-sm px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={{ background: activeTab === tab ? "var(--background)" : "transparent", color: activeTab === tab ? "var(--accent)" : "var(--muted)" }}>
              {tab}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>No transactions loaded.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["ID", "Source", "Counterparty", "Amount", "Date", "Status", "Notes"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.map((txn, i) => (
                <tr key={`${txn.id || "row"}-${i}`}>
                  <td className="px-5 py-3 text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{txn.id || "—"}</td>
                  <td className="px-5 py-3 text-[13px]" style={{ color: "var(--muted)" }}>{txn.source || "—"}</td>
                  <td className="px-5 py-3 text-[13px]" style={{ color: "var(--foreground)" }}>{txn.counterparty || "—"}</td>
                  <td className="px-5 py-3 text-[13px] font-medium tabular-nums" style={{ color: "var(--foreground)" }}>{txn.amount || "—"}</td>
                  <td className="px-5 py-3 text-[13px] tabular-nums" style={{ color: "var(--muted)" }}>{txn.date || "—"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-sm px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: statusColors[txn.status].bg, color: statusColors[txn.status].color }}>
                      {statusColors[txn.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[11px] max-w-[260px]" style={{ color: "var(--muted)" }}>
                    {getNotes(txn.id) || "—"}
                    {txn.id && ["exception", "pending"].includes(txn.status) && (
                      <button
                        onClick={() => {
                          const ai = aiResults?.find((r) => r.id === txn.id);
                          setResolveDraft({
                            transactionId: txn.id,
                            status: "resolved",
                            matched_with: ai?.matched_with || "",
                            notes: "",
                          });
                          setTimeout(() => {
                            const panel = document.getElementById("resolve-panel");
                            panel?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 0);
                        }}
                        className="mt-2 block rounded-sm px-2 py-1 text-[10px] font-medium"
                        style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {resolveDraft && (
        <div
          id="resolve-panel"
          className="fixed bottom-6 right-6 z-50 w-[420px] rounded border p-4 shadow-lg"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Resolve {resolveDraft.transactionId}</p>
            <button
              onClick={() => setResolveDraft(null)}
              className="rounded-sm px-2 py-1 text-xs"
              style={{ background: "var(--background)", color: "var(--muted)", border: "1px solid var(--border)" }}
            >
              Close
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px]" style={{ color: "var(--muted)" }}>Status</label>
              <select
                className="mt-1 w-full rounded border px-2 py-1 text-xs"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                value={resolveDraft.status}
                onChange={(e) => setResolveDraft({ ...resolveDraft, status: e.target.value })}
              >
                <option value="resolved">Resolved</option>
                <option value="matched">Matched</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="text-[11px]" style={{ color: "var(--muted)" }}>Matched With</label>
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-xs"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                value={resolveDraft.matched_with}
                onChange={(e) => setResolveDraft({ ...resolveDraft, matched_with: e.target.value })}
                placeholder="TXN-1234"
              />
            </div>
            <div>
              <label className="text-[11px]" style={{ color: "var(--muted)" }}>Notes</label>
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-xs"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                value={resolveDraft.notes}
                onChange={(e) => setResolveDraft({ ...resolveDraft, notes: e.target.value })}
                placeholder="Reason / action"
              />
            </div>
          </div>
          <button
            onClick={saveResolution}
            className="mt-3 rounded-sm px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Save Resolution
          </button>
        </div>
      )}
    </div>
  );
}
