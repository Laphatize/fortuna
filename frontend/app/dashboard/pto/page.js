"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const typeLabels = { vacation: "Vacation", sick: "Sick", personal: "Personal", bereavement: "Bereavement", other: "Other" };
const statusColors = { pending: "#d97706", approved: "#16a34a", denied: "#dc2626" };

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
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>PTO Management</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Track and manage paid time off requests</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncCalls}
            disabled={syncing}
            className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            {syncing && <div className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />}
            {syncing ? "Syncing..." : "Sync Calls"}
          </button>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
          >
            {analyzing && <div className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />}
            {analyzing ? "Analyzing..." : "AI Insights"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ background: "var(--accent)" }}
          >
            {showForm ? "Cancel" : "New Request"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div
          className="rounded border px-5 py-3 flex items-center justify-between"
          style={{
            background: syncResult.error ? "var(--error-bg)" : "#f0fdf4",
            borderColor: syncResult.error ? "#fecaca" : "#bbf7d0",
            color: syncResult.error ? "var(--error-text)" : "#166534",
          }}
        >
          <p className="text-sm">
            {syncResult.error
              ? `Sync error: ${syncResult.error}${syncResult.detail ? ` — ${syncResult.detail}` : ""}`
              : `Synced ${syncResult.synced} new request${syncResult.synced !== 1 ? "s" : ""} from ${syncResult.total_calls} call${syncResult.total_calls !== 1 ? "s" : ""}${syncResult.skipped ? ` (skipped: ${syncResult.skipped.already} already synced, ${syncResult.skipped.notEnded} in-progress, ${syncResult.skipped.noAnalysis} no analysis, ${syncResult.skipped.noData} missing data)` : ""}`}
          </p>
          <button onClick={() => setSyncResult(null)} className="text-xs font-medium opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className="rounded border p-5 space-y-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>AI Insights</p>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{analysis}</p>
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <form onSubmit={submitRequest} className="rounded border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>New PTO Request</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Reason (optional)</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief reason for time off..."
              className="w-full rounded border px-3 py-2 text-sm"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !form.startDate || !form.endDate}
            className="rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}

      {/* Requests List */}
      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className=" px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>PTO Requests</h2>
        </div>
        {requests.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>No PTO requests yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {requests.map((r) => (
              <div key={r._id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{r.employeeName}</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--background)", color: "var(--muted)" }}>
                        {typeLabels[r.type] || r.type}
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: r.source === "phone" ? "#dbeafe" : "#f0fdf4", color: r.source === "phone" ? "#2563eb" : "#16a34a" }}>
                        {r.source === "phone" ? "Phone" : "Web"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {new Date(r.startDate).toLocaleDateString()} — {new Date(r.endDate).toLocaleDateString()} ({r.days} day{r.days !== 1 ? "s" : ""})
                      {r.source === "phone" && r.employeePhone && <> &middot; {r.employeePhone}</>}
                    </p>
                    {r.reason && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{r.reason}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase" style={{ color: statusColors[r.status] || "var(--muted)" }}>
                    {r.status}
                  </span>
                  {r.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateStatus(r._id, "approved")}
                        className="rounded px-2.5 py-1 text-[11px] font-medium text-white"
                        style={{ background: "#16a34a" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(r._id, "denied")}
                        className="rounded px-2.5 py-1 text-[11px] font-medium text-white"
                        style={{ background: "#dc2626" }}
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
