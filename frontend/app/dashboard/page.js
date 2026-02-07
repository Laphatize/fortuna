"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function DashboardOverview() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadOverview() {
    try {
      const res = await fetch(`${API}/api/overview`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStats(data.stats);
      setActivity(data.activity || []);
    } catch (err) {
      console.error("Overview load failed:", err);
    }
  }

  const displayStats = [
    { label: "Transactions Processed", value: stats?.transactions_processed ?? "—", color: "var(--foreground)" },
    { label: "Compliance Score", value: stats?.compliance_score != null ? `${stats.compliance_score}%` : "—", color: stats?.compliance_score >= 90 ? "#16a34a" : stats?.compliance_score >= 75 ? "#2563eb" : stats?.compliance_score != null ? "#dc2626" : "var(--foreground)" },
    { label: "Open Exceptions", value: stats?.open_exceptions ?? "—", color: stats?.open_exceptions > 0 ? "#dc2626" : "var(--foreground)" },
    { label: "Documents Processed", value: stats?.documents_processed ?? "—", color: "var(--foreground)" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Here&apos;s your back-office operations summary.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {displayStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              {stat.label}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-semibold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div
          className="col-span-2 rounded border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>No activity yet. Upload documents or run analyses to see results here.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                  <div
                    className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{
                      background:
                        item.status === "success" ? "#16a34a" :
                        item.status === "warning" ? "#2563eb" :
                        "#dc2626",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                      {item.action}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      {item.detail}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--muted)" }}>
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="rounded border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Quick Actions</h2>
          </div>
          <div className="space-y-1 p-3">
            {[
              { label: "Run Reconciliation", desc: "Match pending transactions", href: "/dashboard/reconciliation" },
              { label: "Compliance Check", desc: "Scan for regulatory issues", href: "/dashboard/compliance" },
              { label: "Upload Documents", desc: "Process new documents", href: "/dashboard/documents" },
              { label: "Risk Assessment", desc: "Analyze portfolio risk", href: "/dashboard/risk" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="w-full rounded-sm px-3 py-2.5 text-left transition-colors"
                style={{ color: "var(--foreground)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--background)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <p className="text-[13px] font-medium">{action.label}</p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>{action.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
