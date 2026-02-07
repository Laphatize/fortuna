"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadOverview() {
    try {
      const res = await fetch(`${API}/api/overview`);
      const data = await res.json();
      if (res.ok) setStats(data.stats);
    } catch {}
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`${API}/api/overview/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const displayStats = [
    { label: "Transactions", value: stats?.transactions_processed ?? "—" },
    { label: "Compliance", value: stats?.compliance_score != null ? `${stats.compliance_score}%` : "—" },
    { label: "Exceptions", value: stats?.open_exceptions ?? "—" },
    { label: "Documents", value: stats?.documents_processed ?? "—" },
  ];

  const greeting = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";
  const firstName = user?.displayName ? user.displayName.split(" ")[0] : "";

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Stats bar */}
      <div className="flex gap-3 mb-4">
        {displayStats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-5 space-y-4 min-h-full flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
              <p className="text-lg font-medium text-gray-900">
                Good {greeting}{firstName ? `, ${firstName}` : ""}
              </p>
              <p className="mt-2 text-sm max-w-md text-gray-500">
                Ask me anything about your operations — reconciliation status, compliance alerts, risk metrics, or documents.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  "What's my current compliance status?",
                  "Any open reconciliation exceptions?",
                  "Summarize my risk exposure",
                  "How many documents have been processed?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-all hover:border-blue-300 hover:text-blue-600 hover:shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-3 ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-50 text-gray-900"
                    }`}
                  >
                    {m.role === "assistant" && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-gray-400">Assisto</p>
                    )}
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:0.2s]" />
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your operations..."
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
