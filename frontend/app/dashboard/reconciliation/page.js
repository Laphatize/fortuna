"use client";

import { useEffect, useState, useCallback } from "react";

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
  const [runs, setRuns] = useState([]);
  const [dirty] = useState(false);
  const [resolutions, setResolutions] = useState({});

  // Detail view state
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [resolveDraft, setResolveDraft] = useState({ status: "resolved", matched_with: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    reloadDataset();
    reloadRuns();
    reloadResolutions();
    const interval = setInterval(() => {
      if (!dirty) reloadDataset();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelectedTxn(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function runReconciliation() {
    setRunning(true);
    try {
      if (!transactions.length) throw new Error("No transactions loaded.");
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

  async function reloadDataset() {
    try {
      const res = await fetch(`${API}/api/reconciliation/dataset`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTransactions(data.transactions || []);
    } catch {}
  }

  async function reloadRuns() {
    try {
      const res = await fetch(`${API}/api/reconciliation/runs`);
      const data = await res.json();
      if (res.ok) {
        setRuns(data);
        if (data.length > 0) {
          setAiResults(data[0].results || []);
          setRecommendations(data[0].recommendations || []);
        }
      }
    } catch {}
  }

  async function reloadResolutions() {
    try {
      const res = await fetch(`${API}/api/reconciliation/resolutions`);
      const data = await res.json();
      if (!res.ok) return;
      const map = {};
      data.forEach((r) => { map[r.transactionId] = r; });
      setResolutions(map);
    } catch {}
  }

  function getStatus(txnId) {
    const resolution = resolutions[txnId];
    if (resolution?.status) return resolution.status;
    if (!aiResults) return "pending";
    const r = aiResults.find((r) => r.id === txnId);
    return r?.status || "pending";
  }

  function getAiResult(txnId) {
    if (!aiResults) return null;
    return aiResults.find((r) => r.id === txnId) || null;
  }

  function getNotes(txnId) {
    const resolution = resolutions[txnId];
    if (resolution) {
      return [
        resolution.matched_with ? `Matched with ${resolution.matched_with}` : null,
        resolution.notes || null,
      ].filter(Boolean).join(" — ");
    }
    const r = getAiResult(txnId);
    return r?.notes || null;
  }

  const openDetail = useCallback((txn) => {
    const ai = getAiResult(txn.id);
    setSelectedTxn(txn);
    setResolveDraft({
      status: "resolved",
      matched_with: ai?.matched_with || "",
      notes: "",
    });
  }, [aiResults]);

  async function saveResolution() {
    if (!selectedTxn?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/reconciliation/resolutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: selectedTxn.id, ...resolveDraft }),
      });
      if (res.ok) {
        const data = await res.json();
        setResolutions((prev) => ({ ...prev, [data.transactionId]: data }));
        setSelectedTxn(null);
      }
    } catch (err) {
      console.error("Save resolution error:", err);
    } finally {
      setSaving(false);
    }
  }

  const rows = transactions.map((t) => ({ ...t, status: getStatus(t.id) }));
  const filtered = activeTab === "all" ? rows : rows.filter((t) => t.status === activeTab);
  const matchedCount = rows.filter((t) => t.status === "matched").length;
  const exceptionCount = rows.filter((t) => t.status === "exception").length;
  const pendingCount = rows.filter((t) => t.status === "pending").length;
  const resolvedCount = rows.filter((t) => t.status === "resolved").length;

  // For the detail view: find the matched counterparty transaction
  const matchedTxn = selectedTxn ? (() => {
    const ai = getAiResult(selectedTxn.id);
    const matchId = ai?.matched_with || resolutions[selectedTxn.id]?.matched_with;
    if (!matchId) return null;
    return transactions.find((t) => t.id === matchId) || null;
  })() : null;

  const selectedAi = selectedTxn ? getAiResult(selectedTxn.id) : null;
  const selectedResolution = selectedTxn ? resolutions[selectedTxn.id] : null;
  const selectedStatus = selectedTxn ? getStatus(selectedTxn.id) : "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Data source info */}
      <div className="rounded border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--muted)" }}>Transactions loaded from documents or saved datasets.</p>
          <button onClick={reloadDataset}
            className="rounded-sm px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Matched", count: matchedCount, color: "#16a34a" },
          { label: "Exceptions", count: exceptionCount, color: "#dc2626" },
          { label: "Pending", count: pendingCount, color: "#2563eb" },
          { label: "Resolved", count: resolvedCount, color: "#0f766e" },
        ].map((s) => (
          <div key={s.label} className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded border p-5 space-y-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>AI Recommendations</p>
          {recommendations.map((rec, i) => (
            <p key={i} className="text-[13px]" style={{ color: "var(--foreground)" }}>{rec}</p>
          ))}
        </div>
      )}

      {/* Run History */}
      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className=" px-5 py-4" style={{ borderColor: "var(--border)" }}>
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
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{new Date(run.createdAt).toLocaleString()}</p>
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

      {/* Transaction Table */}
      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1  px-4 py-3" style={{ borderColor: "var(--border)" }}>
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
              <tr className="" style={{ borderColor: "var(--border)" }}>
                {["ID", "Source", "Counterparty", "Amount", "Date", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filtered.map((txn, i) => {
                const s = statusColors[txn.status] || statusColors.pending;
                return (
                  <tr key={`${txn.id || "row"}-${i}`}
                    className="cursor-pointer transition-colors"
                    onClick={() => openDetail(txn)}
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--background)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <td className="px-5 py-3 text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{txn.id || "—"}</td>
                    <td className="px-5 py-3 text-[13px]" style={{ color: "var(--muted)" }}>{txn.source || "—"}</td>
                    <td className="px-5 py-3 text-[13px]" style={{ color: "var(--foreground)" }}>{txn.counterparty || "—"}</td>
                    <td className="px-5 py-3 text-[13px] font-medium tabular-nums" style={{ color: "var(--foreground)" }}>{txn.amount || "—"}</td>
                    <td className="px-5 py-3 text-[13px] tabular-nums" style={{ color: "var(--muted)" }}>{txn.date || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-sm px-2 py-0.5 text-[11px] font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <svg className="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--muted)">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ========== FULL-SCREEN DETAIL VIEW ========== */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "var(--background)" }}>
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between  px-6 py-4 z-10"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedTxn(null)}
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ color: "var(--muted)" }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
              <div className="h-5 w-px" style={{ background: "var(--border)" }} />
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                    Transaction {selectedTxn.id}
                  </h2>
                  <span className="rounded-sm px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: statusColors[selectedStatus].bg, color: statusColors[selectedStatus].color }}>
                    {statusColors[selectedStatus].label}
                  </span>
                </div>
              </div>
            </div>
            {["exception", "pending"].includes(selectedStatus) && (
              <button onClick={saveResolution} disabled={saving}
                className="rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--accent)" }}>
                {saving ? "Saving..." : "Save Resolution"}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto pt-[73px] px-6 pb-8">
            <div className="mx-auto max-w-6xl space-y-6 mt-6">
              {/* Side-by-side: Source vs Matched */}
              <div className="grid grid-cols-2 gap-6">
                {/* Source Transaction */}
                <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <div className=" px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Source Record</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <TxnFieldList txn={selectedTxn} />
                  </div>
                </div>

                {/* Matched / Counterparty Transaction */}
                <div className="rounded border" style={{ background: "var(--card)", borderColor: matchedTxn ? "var(--border)" : "var(--border)" }}>
                  <div className=" px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: matchedTxn ? "#16a34a" : "var(--muted)" }}>
                      {matchedTxn ? "Matched Record" : "No Matched Record"}
                    </p>
                  </div>
                  {matchedTxn ? (
                    <div className="p-5 space-y-4">
                      <TxnFieldList txn={matchedTxn} compareTo={selectedTxn} />
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col items-center justify-center py-12">
                      <svg className="h-8 w-8 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="var(--muted)">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                      <p className="text-sm" style={{ color: "var(--muted)" }}>No counterparty match found</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {selectedAi?.notes || "Run reconciliation to find matches"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Discrepancies highlight (if matched but amounts differ, etc.) */}
              {matchedTxn && selectedStatus === "exception" && (
                <div className="rounded border p-5" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#dc2626" }}>Discrepancies Detected</p>
                  <div className="space-y-1.5">
                    {selectedTxn.amount !== matchedTxn.amount && (
                      <p className="text-[13px]" style={{ color: "#991b1b" }}>
                        Amount mismatch: <span className="font-semibold">{selectedTxn.amount}</span> vs <span className="font-semibold">{matchedTxn.amount}</span>
                        {selectedTxn.amount && matchedTxn.amount && (
                          <span className="ml-1 text-xs">
                            (diff: {(parseFloat(String(selectedTxn.amount).replace(/[^0-9.-]/g, "")) - parseFloat(String(matchedTxn.amount).replace(/[^0-9.-]/g, ""))).toFixed(2)})
                          </span>
                        )}
                      </p>
                    )}
                    {selectedTxn.date !== matchedTxn.date && (
                      <p className="text-[13px]" style={{ color: "#991b1b" }}>
                        Date mismatch: <span className="font-semibold">{selectedTxn.date}</span> vs <span className="font-semibold">{matchedTxn.date}</span>
                      </p>
                    )}
                    {selectedTxn.counterparty !== matchedTxn.counterparty && (
                      <p className="text-[13px]" style={{ color: "#991b1b" }}>
                        Counterparty mismatch: <span className="font-semibold">{selectedTxn.counterparty || "—"}</span> vs <span className="font-semibold">{matchedTxn.counterparty || "—"}</span>
                      </p>
                    )}
                    {selectedAi?.notes && (
                      <p className="text-[13px] mt-2" style={{ color: "#991b1b" }}>{selectedAi.notes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {selectedAi && (
                <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--accent)" }}>AI Analysis</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--foreground)" }}>{selectedAi.notes || "No analysis notes."}</p>
                  {selectedAi.matched_with && (
                    <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Suggested match: {selectedAi.matched_with}</p>
                  )}
                </div>
              )}

              {/* Resolution Form */}
              {["exception", "pending"].includes(selectedStatus) && (
                <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--foreground)" }}>Resolution</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Action</label>
                      <select
                        className="w-full rounded border px-3 py-2 text-sm"
                        style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        value={resolveDraft.status}
                        onChange={(e) => setResolveDraft({ ...resolveDraft, status: e.target.value })}>
                        <option value="resolved">Mark Resolved</option>
                        <option value="matched">Confirm Match</option>
                        <option value="exception">Keep as Exception</option>
                        <option value="pending">Return to Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Matched With</label>
                      <input
                        className="w-full rounded border px-3 py-2 text-sm"
                        style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        value={resolveDraft.matched_with}
                        onChange={(e) => setResolveDraft({ ...resolveDraft, matched_with: e.target.value })}
                        placeholder="Transaction ID"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Notes</label>
                      <input
                        className="w-full rounded border px-3 py-2 text-sm"
                        style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        value={resolveDraft.notes}
                        onChange={(e) => setResolveDraft({ ...resolveDraft, notes: e.target.value })}
                        placeholder="Reason for resolution..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution already applied */}
              {selectedResolution && (
                <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground)" }}>Resolution Record</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Status</p>
                      <p className="mt-1 font-medium capitalize" style={{ color: statusColors[selectedResolution.status]?.color || "var(--foreground)" }}>
                        {selectedResolution.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Matched With</p>
                      <p className="mt-1 font-medium" style={{ color: "var(--foreground)" }}>{selectedResolution.matched_with || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Notes</p>
                      <p className="mt-1" style={{ color: "var(--foreground)" }}>{selectedResolution.notes || "—"}</p>
                    </div>
                  </div>
                  {selectedResolution.history?.length > 1 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>History</p>
                      <div className="space-y-2">
                        {selectedResolution.history.map((h, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                            <span className="font-medium capitalize" style={{ color: statusColors[h.status]?.color || "var(--muted)" }}>{h.status}</span>
                            {h.matched_with && <span>Matched: {h.matched_with}</span>}
                            {h.notes && <span>{h.notes}</span>}
                            {h.at && <span>{new Date(h.at).toLocaleString()}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* All transaction fields (raw data) */}
              <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className=" px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Raw Transaction Data</p>
                </div>
                <div className="p-5">
                  <pre className="text-xs leading-relaxed overflow-x-auto" style={{ color: "var(--foreground)" }}>
                    {JSON.stringify(selectedTxn, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Displays transaction fields in a structured layout
function TxnFieldList({ txn, compareTo }) {
  const knownFields = ["id", "source", "counterparty", "amount", "date", "currency", "reference", "description", "type", "category"];
  const extraFields = Object.keys(txn).filter((k) => !knownFields.includes(k) && k !== "status");
  const allFields = [...knownFields.filter((f) => txn[f] !== undefined), ...extraFields];

  return (
    <div className="space-y-3">
      {allFields.map((field) => {
        const val = txn[field];
        if (val === undefined || val === null) return null;
        const mismatch = compareTo && compareTo[field] !== undefined && String(compareTo[field]) !== String(val);
        return (
          <div key={field} className="flex items-start justify-between gap-4">
            <span className="text-[11px] font-medium uppercase tracking-wider shrink-0 pt-0.5" style={{ color: "var(--muted)", minWidth: 100 }}>
              {field.replace(/_/g, " ")}
            </span>
            <span className="text-[13px] font-medium text-right tabular-nums"
              style={{ color: mismatch ? "#dc2626" : "var(--foreground)" }}>
              {typeof val === "object" ? JSON.stringify(val) : String(val)}
              {mismatch && (
                <svg className="inline-block ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#dc2626">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
