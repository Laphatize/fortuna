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
        <h1 className="text-xl font-semibold text-gray-900">Data Sources</h1>
        <p className="mt-1 text-sm text-gray-500">Connect communication channels and systems to monitor for compliance violations</p>
      </div>

      {/* Connected Sources */}
      {connectedSources.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Connected Sources</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {connectedSources.map((source) => {
              const integration = integrations.find((i) => i.id === source.type);
              return (
                <div key={source.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                      {integration?.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-900">{source.name}</span>
                        <span className="flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                          Connected
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 text-gray-500">
                        Connected {new Date(source.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectSource(source.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Available Integrations</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {integrations.map((integration) => {
            const isConfiguring = configuring === integration.id;
            const isConnected = connectedTypes.has(integration.id);

            return (
              <div key={integration.id} className="px-5 py-5 hover:bg-gray-50 transition-colors bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                      {integration.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-gray-900">{integration.name}</span>
                        {isConnected && (
                          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Active</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 max-w-md text-gray-500">{integration.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {integration.monitors.map((m) => (
                          <span key={m} className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {!isConfiguring && (
                    <button
                      onClick={() => startConfigure(integration)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm ${
                        isConnected
                          ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {isConnected ? "Configure Another" : "Connect"}
                    </button>
                  )}
                </div>

                {isConfiguring && (
                  <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/50 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Configure {integration.name}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {integration.fields.map((field) => (
                        <div key={field.key} className={field.type === "password" ? "col-span-1" : "col-span-2"}>
                          <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
                            {field.label}
                          </label>
                          <input
                            type={field.type || "text"}
                            placeholder={field.placeholder}
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full rounded-lg border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        onClick={cancelConfigure}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveSource(integration)}
                        disabled={saving || integration.fields.some((f) => !formData[f.key])}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Connecting..." : "Connect Source"}
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">How Monitoring Works</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {[
            { title: "Ingest", desc: "Messages and events are pulled from connected sources in real-time or at scheduled intervals." },
            { title: "Analyze", desc: "AI scans content for compliance violations, sensitive data exposure, and policy breaches." },
            { title: "Alert", desc: "Flagged events appear in the Compliance dashboard with severity levels and recommended actions." },
          ].map((step, i) => (
            <div key={i}>
              <p className="text-[13px] font-medium text-gray-900">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{i + 1}</span>
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}