"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const statusStyles = {
  matched: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
  exception: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10",
  pending: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10",
  resolved: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20",
};

const statusLabels = {
  matched: "Matched",
  exception: "Exception",
  pending: "Pending",
  resolved: "Resolved",
};

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [running, setRunning] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [dirty] = useState(false);
  const [resolutions, setResolutions] = useState({});

  // Detail view state
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [resolveDraft, setResolveDraft] = useState({ status: "resolved", matched_with: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    reloadDataset();
    reloadRuns(true);
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
      setSelectedRunId(data.runId || null);
      reloadRuns(false);
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

  async function reloadRuns(loadLatest) {
    try {
      const res = await fetch(`${API}/api/reconciliation/runs`);
      const data = await res.json();
      if (res.ok) {
        setRuns(data);
        if (loadLatest && data.length > 0) {
          const latest = data.find((r) => r.status === "success");
          if (latest) selectRun(latest);
        }
      }
    } catch {}
  }

  function selectRun(run) {
    setSelectedRunId(run._id);
    setAiResults(run.results || []);
    setRecommendations(run.recommendations || []);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reconciliation</h1>
          <p className="mt-1 text-sm text-gray-500">AI-powered transaction matching and exception resolution</p>
        </div>
        <button
          onClick={runReconciliation}
          disabled={running || transactions.length === 0}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {running && <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
          {running ? "Analyzing..." : "Run Reconciliation"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Transactions loaded from documents or saved datasets.</p>
          <button
            onClick={reloadDataset}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 shadow-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Matched", count: matchedCount, color: "text-green-600" },
          { label: "Exceptions", count: exceptionCount, color: "text-red-600" },
          { label: "Pending", count: pendingCount, color: "text-blue-600" },
          { label: "Resolved", count: resolvedCount, color: "text-teal-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{s.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-2">AI Recommendations</p>
          <div className="space-y-1">
            {recommendations.map((rec, i) => (
              <p key={i} className="text-[13px] text-gray-900">{rec}</p>
            ))}
          </div>
        </div>
      )}

      {/* Run History */}
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
            {runs.slice(0, 10).map((run) => (
              <div
                key={run._id}
                onClick={() => run.status === "success" && selectRun(run)}
                className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
                  run.status === "success" ? "cursor-pointer hover:bg-gray-50" : "cursor-default"
                } ${selectedRunId === run._id ? "bg-blue-50/50" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-gray-900">
                      {run.status === "success" ? "Success" : "Error"}
                    </p>
                    {selectedRunId === run._id && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Viewing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{new Date(run.createdAt).toLocaleString()}</p>
                </div>
                {run.summary && (
                  <div className="text-xs text-gray-500">
                    {run.summary.matched}/{run.summary.total} matched
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 border-b border-gray-100 px-4 py-3 bg-gray-50/50">
          {["all", "matched", "exception", "pending", "resolved"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No transactions loaded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["ID", "Source", "Counterparty", "Amount", "Date", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((txn, i) => (
                  <tr
                    key={`${txn.id || "row"}-${i}`}
                    onClick={() => openDetail(txn)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 text-[13px] font-medium text-gray-900">{txn.id || "—"}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-500">{txn.source || "—"}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-900">{txn.counterparty || "—"}</td>
                    <td className="px-5 py-3 text-[13px] font-medium tabular-nums text-gray-900">
                      {txn.amount || "—"}
                    </td>
                    <td className="px-5 py-3 text-[13px] tabular-nums text-gray-500">{txn.date || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ${
                        statusStyles[txn.status] || statusStyles.pending
                      }`}>
                        {statusLabels[txn.status] || "Unknown"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <svg className="h-4 w-4 inline-block text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedTxn(null)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
              <div className="h-5 w-px bg-gray-200" />
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-gray-900">Transaction {selectedTxn.id}</h2>
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  statusStyles[selectedStatus]
                }`}>
                  {statusLabels[selectedStatus]}
                </span>
              </div>
            </div>
            {["exception", "pending"].includes(selectedStatus) && (
              <button
                onClick={saveResolution}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Resolution"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Source Record</p>
                  </div>
                  <div className="p-5">
                    <TxnFieldList txn={selectedTxn} />
                  </div>
                </div>

                <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                  matchedTxn ? "border-gray-200" : "border-gray-200 bg-gray-50/20"
                }`}>
                  <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3.5">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                      matchedTxn ? "text-green-600" : "text-gray-400"
                    }`}>
                      {matchedTxn ? "Matched Record" : "No Matched Record"}
                    </p>
                  </div>
                  {matchedTxn ? (
                    <div className="p-5">
                      <TxnFieldList txn={matchedTxn} compareTo={selectedTxn} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-5">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">No counterparty match found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedAi?.notes || "Run reconciliation to find matches"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {matchedTxn && selectedStatus === "exception" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 mb-2">Discrepancies Detected</p>
                  <div className="space-y-1.5">
                    {selectedTxn.amount !== matchedTxn.amount && (
                      <p className="text-[13px] text-red-800">
                        Amount mismatch: <span className="font-semibold">{selectedTxn.amount}</span> vs <span className="font-semibold">{matchedTxn.amount}</span>
                        {selectedTxn.amount && matchedTxn.amount && (
                          <span className="ml-1 text-xs opacity-75">
                            (diff: {(parseFloat(String(selectedTxn.amount).replace(/[^0-9.-]/g, "")) - parseFloat(String(matchedTxn.amount).replace(/[^0-9.-]/g, ""))).toFixed(2)})
                          </span>
                        )}
                      </p>
                    )}
                    {selectedTxn.date !== matchedTxn.date && (
                      <p className="text-[13px] text-red-800">
                        Date mismatch: <span className="font-semibold">{selectedTxn.date}</span> vs <span className="font-semibold">{matchedTxn.date}</span>
                      </p>
                    )}
                    {selectedTxn.counterparty !== matchedTxn.counterparty && (
                      <p className="text-[13px] text-red-800">
                        Counterparty mismatch: <span className="font-semibold">{selectedTxn.counterparty || "—"}</span> vs <span className="font-semibold">{matchedTxn.counterparty || "—"}</span>
                      </p>
                    )}
                    {selectedAi?.notes && (
                      <p className="text-[13px] mt-2 text-red-700">{selectedAi.notes}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedAi && (
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-3">AI Analysis</p>
                  <p className="text-[13px] leading-relaxed text-gray-700">{selectedAi.notes || "No analysis notes."}</p>
                  {selectedAi.matched_with && (
                    <p className="text-xs mt-2 text-gray-500">Suggested match: <span className="font-mono">{selectedAi.matched_with}</span></p>
                  )}
                </div>
              )}

              {["exception", "pending"].includes(selectedStatus) && (
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-900 mb-4">Resolution</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Action</label>
                      <select
                        className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                        value={resolveDraft.status}
                        onChange={(e) => setResolveDraft({ ...resolveDraft, status: e.target.value })}
                      >
                        <option value="resolved">Mark Resolved</option>
                        <option value="matched">Confirm Match</option>
                        <option value="exception">Keep as Exception</option>
                        <option value="pending">Return to Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Matched With</label>
                      <input
                        className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                        value={resolveDraft.matched_with}
                        onChange={(e) => setResolveDraft({ ...resolveDraft, matched_with: e.target.value })}
                        placeholder="Transaction ID"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Notes</label>
                      <input
                        className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                        value={resolveDraft.notes}
                        onChange={(e) => setResolveDraft({ ...resolveDraft, notes: e.target.value })}
                        placeholder="Reason for resolution..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedResolution && (
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-900 mb-3">Resolution Record</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">Status</p>
                      <p className="mt-1 font-medium capitalize text-gray-900">{selectedResolution.status}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">Matched With</p>
                      <p className="mt-1 font-medium text-gray-900">{selectedResolution.matched_with || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">Notes</p>
                      <p className="mt-1 text-gray-900">{selectedResolution.notes || "—"}</p>
                    </div>
                  </div>
                  {selectedResolution.history?.length > 1 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-400">History</p>
                      <div className="space-y-2">
                        {selectedResolution.history.map((h, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="font-medium capitalize text-gray-700">{h.status}</span>
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

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Raw Transaction Data</p>
                </div>
                <div className="p-5 bg-slate-50">
                  <pre className="text-xs leading-relaxed overflow-x-auto text-gray-600 font-mono">
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
            <span className="text-[11px] font-medium uppercase tracking-wider shrink-0 pt-0.5 text-gray-400 min-w-[100px]">
              {field.replace(/_/g, " ")}
            </span>
            <span className={`text-[13px] font-medium text-right tabular-nums ${
              mismatch ? "text-red-600" : "text-gray-900"
            }`}>
              {typeof val === "object" ? JSON.stringify(val) : String(val)}
              {mismatch && (
                <svg className="inline-block ml-1 h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
