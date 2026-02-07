"use client";

import { useState } from "react";

const integrations = [
  {
    id: "slack",
    name: "Slack",
    description: "Monitor Slack channels for compliance violations, sensitive data leaks, and policy breaches",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#611f69"/>
      </svg>
    ),
    fields: [
      { key: "token", label: "Bot Token", placeholder: "xoxb-...", type: "password" },
      { key: "channels", label: "Channels to Monitor", placeholder: "#general, #finance, #trading" },
    ],
    monitors: ["Message content screening", "File sharing alerts", "DLP policy enforcement", "Keyword triggers"],
  },
  {
    id: "email",
    name: "Email (IMAP)",
    description: "Scan inbound/outbound emails for regulatory violations and data exfiltration",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
    fields: [
      { key: "host", label: "IMAP Host", placeholder: "imap.gmail.com" },
      { key: "email", label: "Email Address", placeholder: "compliance@company.com" },
      { key: "password", label: "App Password", placeholder: "password", type: "password" },
    ],
    monitors: ["Attachment scanning", "PII detection", "Unauthorized recipient alerts", "Keyword matching"],
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Monitor Teams conversations for compliance and insider threat detection",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M20.625 6.547h-3.422v-2.39A2.156 2.156 0 0 1 19.36 2.003h.109a2.156 2.156 0 0 1 2.156 2.156v1.39a1 1 0 0 1-1 .998zm-3.422 1h4.047a.75.75 0 0 1 .75.75v4.89a3.282 3.282 0 0 1-3.125 3.283 3.25 3.25 0 0 1-1.672-.465zM15.14 4.688a2.844 2.844 0 1 0-5.687 0 2.844 2.844 0 0 0 5.688 0zM16 8.547H8.594a.75.75 0 0 0-.75.75v6.14a4.97 4.97 0 0 0 4.453 4.96 5.03 5.03 0 0 0 4.453-2.02A4.97 4.97 0 0 0 17 14.437V9.297a.75.75 0 0 0-.75-.75H16zM5.906 9.547H2.75a.75.75 0 0 0-.75.75v3.89a2.782 2.782 0 0 0 2.625 2.783A2.75 2.75 0 0 0 7.5 14.22V11.14a1.594 1.594 0 0 0-1.594-1.594zM5.5 7.547a1.656 1.656 0 1 0 0-3.313 1.656 1.656 0 0 0 0 3.313z" fill="#5059C9"/>
      </svg>
    ),
    fields: [
      { key: "tenantId", label: "Tenant ID", placeholder: "Azure AD Tenant ID" },
      { key: "clientId", label: "Client ID", placeholder: "App Registration Client ID" },
      { key: "clientSecret", label: "Client Secret", placeholder: "secret", type: "password" },
    ],
    monitors: ["Chat compliance", "Meeting transcript analysis", "File sharing monitoring", "Guest access alerts"],
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Receive events from any system via webhook for real-time compliance monitoring",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
    fields: [
      { key: "name", label: "Source Name", placeholder: "Trading Platform Alerts" },
    ],
    monitors: ["Custom event processing", "Threshold alerts", "Pattern detection", "Anomaly flagging"],
  },
];

let nextId = 0;

export default function DataSourcesPage() {
  const [connectedSources, setConnectedSources] = useState([]);
  const [configuring, setConfiguring] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  function startConfigure(integration) {
    setConfiguring(integration.id);
    setFormData({});
  }

  function cancelConfigure() {
    setConfiguring(null);
    setFormData({});
  }

  function saveSource(integration) {
    setSaving(true);
    const newSource = {
      id: integration.id + "-" + (++nextId),
      type: integration.id,
      name: integration.name,
      config: { ...formData },
      status: "connected",
      connectedAt: new Date().toISOString(),
      eventsProcessed: 0,
      flaggedEvents: 0,
    };
    setConnectedSources((prev) => [...prev, newSource]);
    setConfiguring(null);
    setFormData({});
    setSaving(false);
  }

  function disconnectSource(sourceId) {
    setConnectedSources((prev) => prev.filter((s) => s.id !== sourceId));
  }

  const connectedTypes = new Set(connectedSources.map((s) => s.type));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Data Sources</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Connect communication channels and systems to monitor for compliance violations</p>
      </div>

      {/* Connected Sources */}
      {connectedSources.length > 0 && (
        <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Connected Sources</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {connectedSources.map((source) => {
              const integration = integrations.find((i) => i.id === source.type);
              return (
                <div key={source.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded" style={{ background: "#f8f9fa" }}>
                      {integration?.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{source.name}</span>
                        <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#16a34a" }} />
                          Connected
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        Connected {new Date(source.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectSource(source.id)}
                    className="rounded px-3 py-1.5 text-[11px] font-medium transition-colors"
                    style={{ color: "#dc2626", border: "1px solid #fecaca" }}
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div className="rounded border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Available Integrations</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {integrations.map((integration) => {
            const isConfiguring = configuring === integration.id;
            const isConnected = connectedTypes.has(integration.id);

            return (
              <div key={integration.id} className="px-5 py-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded" style={{ background: "#f8f9fa" }}>
                      {integration.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{integration.name}</span>
                        {isConnected && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "#f0fdf4", color: "#16a34a" }}>Active</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 max-w-md" style={{ color: "var(--muted)" }}>{integration.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {integration.monitors.map((m) => (
                          <span key={m} className="rounded px-2 py-0.5 text-[10px]" style={{ background: "var(--background)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {!isConfiguring && (
                    <button
                      onClick={() => startConfigure(integration)}
                      className="rounded-sm px-4 py-2 text-sm font-medium transition-colors"
                      style={{
                        background: isConnected ? "var(--background)" : "var(--accent)",
                        color: isConnected ? "var(--accent)" : "white",
                        border: isConnected ? "1px solid var(--border)" : "none",
                      }}
                    >
                      {isConnected ? "Add Another" : "Connect"}
                    </button>
                  )}
                </div>

                {/* Configuration Form */}
                {isConfiguring && (
                  <div className="mt-4 ml-14 rounded border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                    {integration.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>
                          {field.label}
                        </label>
                        <input
                          type={field.type || "text"}
                          placeholder={field.placeholder}
                          value={formData[field.key] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full rounded border px-3 py-2 text-sm"
                          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveSource(integration)}
                        disabled={saving || integration.fields.some((f) => !formData[f.key])}
                        className="rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: "var(--accent)" }}
                      >
                        {saving ? "Connecting..." : "Connect Source"}
                      </button>
                      <button
                        onClick={cancelConfigure}
                        className="rounded-sm px-4 py-2 text-sm font-medium"
                        style={{ color: "var(--muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>How Monitoring Works</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {[
            { title: "Ingest", desc: "Messages and events are pulled from connected sources in real-time or at scheduled intervals." },
            { title: "Analyze", desc: "AI scans content for compliance violations, sensitive data exposure, and policy breaches." },
            { title: "Alert", desc: "Flagged events appear in the Compliance dashboard with severity levels and recommended actions." },
          ].map((step, i) => (
            <div key={i}>
              <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>{i + 1}</span>
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
