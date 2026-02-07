"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const typeLabel = {
  reconciliation: "Reconciliation",
  compliance: "Compliance",
  risk: "Risk",
  document: "Documents",
};

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const res = await fetch(`${API}/api/reports`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports");
      setReports(data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Reports</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Generated from reconciliation, compliance, and risk runs
          </p>
        </div>
        <button
          onClick={loadReports}
          className="rounded-sm px-3 py-1.5 text-xs font-medium"
          style={{ background: "var(--background)", color: "var(--accent)", border: "1px solid var(--border)" }}
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: "#b54a4a" }}>{error}</p>}

      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Report History</h2>
        </div>
        {reports.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>No reports generated yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {reports.map((r) => (
              <div key={r._id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                      {typeLabel[r.type] || r.type} — {r.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{r.summary || "—"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                    <div className="mt-1">
                      <span
                        className="rounded-sm px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: r.status === "error" ? "#fce4ec" : "#e8f5e9",
                          color: r.status === "error" ? "#b54a4a" : "#2e7d32",
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
