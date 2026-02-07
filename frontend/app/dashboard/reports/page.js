"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const typeLabel = {
  reconciliation: "Reconciliation",
  compliance: "Compliance",
  risk: "Risk",
  document: "Documents",
};

const statusStyles = {
  success: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10",
  pending: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10",
};

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports");
      setReports(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generated from reconciliation, compliance, and risk runs
          </p>
        </div>
        <button
          onClick={loadReports}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-medium text-blue-600 shadow-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Report History</h2>
        </div>
        {reports.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No reports generated yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((r) => (
              <div key={r._id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-gray-900">
                        {typeLabel[r.type] || r.type} — {r.title}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium ${
                          statusStyles[r.status] || statusStyles.pending
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{r.summary || "—"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
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
