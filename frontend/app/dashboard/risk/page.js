"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const riskColor = { Low: "#16a34a", Medium: "#2563eb", High: "#dc2626" };
const sevColor = { high: "#dc2626", medium: "#2563eb", low: "#16a34a" };

export default function RiskPage() {
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [exposures, setExposures] = useState([]);
  const [stressTests, setStressTests] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);

  useEffect(() => {
    reloadDataset();
    reloadRuns(true);
  }, []);

  async function runAnalysis() {
    setRunning(true);
    try {
      if (!portfolio.length && !scenarios.length) {
        throw new Error("Load a portfolio or scenarios to run analysis.");
      }
      const res = await fetch(`${API}/api/risk/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio, scenarios }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadRunResults(data);
      setSelectedRunId(data.runId || null);
      reloadRuns(false);
    } catch (err) {
      console.error("Risk analysis failed:", err);
    } finally {
      setRunning(false);
    }
  }

  function loadRunResults(data) {
    setMetrics(data.metrics || null);
    setExposures(data.exposures || []);
    setStressTests(data.stress_tests || data.stressTests || []);
    setRecommendations(data.recommendations || []);
  }

  async function reloadDataset() {
    try {
      const res = await fetch(`${API}/api/risk/dataset`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPortfolio(data.portfolio || []);
      setScenarios(data.scenarios || []);
    } catch {}
  }

  async function reloadRuns(loadLatest) {
    try {
      const res = await fetch(`${API}/api/risk/runs`);
      const data = await res.json();
      if (res.ok) {
        setRuns(data);
        // On initial load, restore the latest successful run
        if (loadLatest && data.length > 0) {
          const latest = data.find((r) => r.status === "success");
          if (latest) {
            selectRun(latest);
          }
        }
      }
    } catch {}
  }

  function selectRun(run) {
    setSelectedRunId(run._id);
    setMetrics(run.metrics || null);
    setExposures(run.exposures || []);
    setStressTests(run.stressTests || run.stress_tests || []);
    setRecommendations(run.recommendations || []);
  }

  const displayMetrics = metrics
    ? [
        { label: "Value at Risk (95%)", value: metrics.var_95 },
        { label: "Expected Shortfall", value: metrics.expected_shortfall },
        { label: "Sharpe Ratio", value: metrics.sharpe_ratio },
        { label: "Max Drawdown", value: metrics.max_drawdown },
      ]
    : [
        { label: "Value at Risk (95%)", value: "—" },
        { label: "Expected Shortfall", value: "—" },
        { label: "Sharpe Ratio", value: "—" },
        { label: "Max Drawdown", value: "—" },
      ];

  const displayExposures = exposures.length > 0 ? exposures : portfolio.map((p) => ({ ...p, risk_level: "—" }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Risk Assessment</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>AI-driven portfolio risk analysis, stress testing, and exposure monitoring</p>
        </div>
        <button onClick={runAnalysis} disabled={running || (portfolio.length === 0 && scenarios.length === 0)}
          className="flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {running && <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
          {running ? "Analyzing..." : "Run Risk Analysis"}
        </button>
      </div>

      <div className="rounded border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Portfolio and scenarios loaded from documents or saved datasets.</p>
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

      {recommendations.length > 0 && (
        <div className="rounded border p-5 space-y-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>AI Recommendations</p>
          {recommendations.map((rec, i) => (
            <p key={i} className="text-[13px]" style={{ color: "var(--foreground)" }}>{rec}</p>
          ))}
        </div>
      )}

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
            {runs.slice(0, 10).map((run) => (
              <div
                key={run._id}
                onClick={() => run.status === "success" && selectRun(run)}
                className="flex items-center justify-between px-5 py-3 transition-colors"
                style={{
                  cursor: run.status === "success" ? "pointer" : "default",
                  background: selectedRunId === run._id ? "#f0f5ff" : "transparent",
                }}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                    {run.status === "success" ? "Success" : "Error"}
                    {selectedRunId === run._id && <span className="ml-2 text-[10px] font-semibold" style={{ color: "var(--accent)" }}>VIEWING</span>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                {run.metrics && (
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    VaR: {run.metrics.var_95 || "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {displayMetrics.map((m) => (
          <div key={m.label} className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{m.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>{m.value}</p>
            <p className="mt-1 text-xs" style={{ color: metrics ? "#3d8c5c" : "var(--muted)" }}>{metrics ? "Calculated" : "Run analysis"}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className=" px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Exposure Breakdown</h2>
          </div>
          {displayExposures.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>No portfolio loaded.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {displayExposures.map((e, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{e.asset}</span>
                      <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--foreground)" }}>{e.exposure}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1 flex-1 overflow-hidden rounded-sm" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-sm" style={{ width: `${e.percentage}%`, background: riskColor[e.risk_level] || "var(--muted)" }} />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: riskColor[e.risk_level] || "var(--muted)" }}>{e.risk_level}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className=" px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Stress Test Results</h2>
          </div>
          {stressTests.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>{running ? "Running stress tests..." : "No stress test results yet."}</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {stressTests.map((t, i) => (
                <div key={i} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-1.5 rounded-sm" style={{ background: sevColor[t.severity] || "var(--muted)" }} />
                      <span className="text-[13px]" style={{ color: "var(--foreground)" }}>{t.scenario}</span>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: sevColor[t.severity] || "var(--muted)" }}>{t.impact}</span>
                  </div>
                  {t.detail && <p className="mt-1 pl-4 text-[11px]" style={{ color: "var(--muted)" }}>{t.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
