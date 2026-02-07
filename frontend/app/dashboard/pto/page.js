"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const typeLabels = { vacation: "Vacation", sick: "Sick", personal: "Personal", bereavement: "Bereavement", other: "Other" };

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  approved: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
  denied: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10",
};

export default function PTOManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "vacation", startDate: "", endDate: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, []);

  async function loadRequests() {
    try {
      const res = await fetch(`${API}/api/pto`);
      const data = await res.json();
      if (res.ok) setRequests(data);
    } catch {}
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API}/api/pto/stats`);
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {}
  }

  async function submitRequest(e) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return;
    setSubmitting(true);
    try {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      const diffTime = Math.abs(end - start);
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const res = await fetch(`${API}/api/pto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: user?.displayName || "User",
          employeeEmail: user?.email || "",
          type: form.type,
          startDate: form.startDate,
          endDate: form.endDate,
          days,
          reason: form.reason,
        }),
      });
      if (res.ok) {
        setForm({ type: "vacation", startDate: "", endDate: "", reason: "" });
        setShowForm(false);
        loadRequests();
        loadStats();
      }
    } catch (err) {
      console.error("Submit PTO error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      await fetch(`${API}/api/pto/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      loadRequests();
      loadStats();
    } catch {}
  }

  async function syncCalls() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/api/pto/sync-calls`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data);
        loadRequests();
        loadStats();
      } else {
        setSyncResult({ error: data.error || "Sync failed", detail: data.detail });
      }
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API}/api/pto/analyze`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setAnalysis(data.analysis);
    } catch {} finally {
      setAnalyzing(false);
    }
  }

  const statCards = [
    { label: "Total Requests", value: stats?.total ?? "—" },
    { label: "Pending", value: stats?.pending ?? "—" },
    { label: "Approved", value: stats?.approved ?? "—" },
    { label: "Days Used", value: stats?.totalDaysUsed ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">PTO Management</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage paid time off requests</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncCalls}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {syncing && <div className="h-3 w-3 animate-spin rounded-full border border-gray-500 border-t-transparent" />}
            {syncing ? "Syncing..." : "Sync Calls"}
          </button>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {analyzing && <div className="h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />}
            {analyzing ? "Analyzing..." : "AI Insights"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            {showForm ? "Cancel" : "New Request"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {syncResult && (
        <div
          className={`rounded-xl border px-5 py-3 flex items-center justify-between shadow-sm ${
            syncResult.error ? "bg-red-50 border-red-100 text-red-800" : "bg-green-50 border-green-100 text-green-800"
          }`}
        >
          <p className="text-sm">
            {syncResult.error
              ? `Sync error: ${syncResult.error}${syncResult.detail ? ` — ${syncResult.detail}` : ""}`
              : `Synced ${syncResult.synced} new request${syncResult.synced !== 1 ? "s" : ""} from ${syncResult.total_calls} call${syncResult.total_calls !== 1 ? "s" : ""}${syncResult.skipped ? ` (skipped: ${syncResult.skipped.already} already synced, ${syncResult.skipped.notEnded} in-progress, ${syncResult.skipped.noAnalysis} no analysis, ${syncResult.skipped.noData} missing data)` : ""}`}
          </p>
          <button onClick={() => setSyncResult(null)} className="text-xs font-medium opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {analysis && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-2">AI Insights</p>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-gray-700">{analysis}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={submitRequest} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-900">New PTO Request</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Reason (optional)</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief reason for time off..."
              className="w-full rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end">
             <button
              type="submit"
              disabled={submitting || !form.startDate || !form.endDate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">PTO Requests</h2>
        </div>
        {requests.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No PTO requests yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r._id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-gray-900">{r.employeeName}</span>
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {typeLabels[r.type] || r.type}
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        r.source === "phone" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
                      }`}>
                        {r.source === "phone" ? "Phone" : "Web"}
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-gray-500">
                      {new Date(r.startDate).toLocaleDateString()} — {new Date(r.endDate).toLocaleDateString()} ({r.days} day{r.days !== 1 ? "s" : ""})
                      {r.source === "phone" && r.employeePhone && <> &middot; {r.employeePhone}</>}
                    </p>
                    {r.reason && <p className="text-xs mt-0.5 text-gray-500 italic">"{r.reason}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ${
                    statusStyles[r.status] || "bg-gray-100 text-gray-600"
                  }`}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                  {r.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateStatus(r._id, "approved")}
                        className="rounded-md bg-green-600 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(r._id, "denied")}
                        className="rounded-md bg-red-600 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-red-700"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
