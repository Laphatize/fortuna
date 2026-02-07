"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const typeLabels = { vacation: "Vacation", sick: "Sick", personal: "Personal", bereavement: "Bereavement", other: "Other" };

export default function RequestPTO() {
  const [form, setForm] = useState({ employeeName: "", employeeEmail: "", type: "vacation", startDate: "", endDate: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employeeName || !form.employeeEmail || !form.startDate || !form.endDate) return;
    setSubmitting(true);
    setError("");
    try {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      if (end < start) { setError("End date must be after start date."); setSubmitting(false); return; }
      const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;

      const res = await fetch(`${API}/api/pto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, days }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to submit"); }
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-md rounded-lg border p-8 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#dcfce7" }}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#16a34a">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Request Submitted</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Your PTO request has been submitted and is pending review.</p>
          <button
            onClick={() => { setSubmitted(false); setForm({ employeeName: "", employeeEmail: "", type: "vacation", startDate: "", endDate: "", reason: "" }); }}
            className="mt-6 rounded px-4 py-2 text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 max-w-7xl" style={{ background: "var(--background)" }}>
      <div className=" max-w-xl w-full">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "var(--font-instrument-serif)" }}>Assisto</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Request Paid Time Off</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Full Name</label>
              <input
                value={form.employeeName}
                onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                placeholder="John Doe"
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Email</label>
              <input
                type="email"
                value={form.employeeEmail}
                onChange={(e) => setForm({ ...form, employeeEmail: e.target.value })}
                placeholder="john@company.com"
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                required
              />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
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
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief reason for your time off..."
              rows={3}
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
          </div>

          {error && <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting || !form.employeeName || !form.employeeEmail || !form.startDate || !form.endDate}
            className="w-full rounded py-2.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      <div className=" px-10 text-center mx-auto">
        <h1 style={{ color: "var(--foreground)", fontFamily: "var(--font-instrument-serif)" }} className="text-3xl">Don&apos;t want to fill out a form?</h1>
        <h1 className="font-semibold text-3xl">+1 (267) 655 0242</h1>

      </div>
    </div>
  );
}
