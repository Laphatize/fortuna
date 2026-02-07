"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const statusStyles = {
  processed: { bg: "#dcfce7", color: "#16a34a", label: "Processed" },
  uploaded: { bg: "#dbeafe", color: "#2563eb", label: "Uploaded" },
  error: { bg: "#fee2e2", color: "#dc2626", label: "Error" },
};

export default function DocumentsPage() {
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [docRuns, setDocRuns] = useState([]);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  function formatValue(value) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => formatValue(v)).join(", ");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  useEffect(() => {
    refreshDocuments();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadChat(selectedId);
      loadRuns(selectedId);
    }
  }, [selectedId]);

  async function refreshDocuments() {
    try {
      const res = await fetch(`${API}/api/documents`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load documents");
      setDocuments(data);
      if (data.length && !selectedId) setSelectedId(data[0]._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function processFile(file) {
    setProcessing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/api/documents/process`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await refreshDocuments();
      if (data.document?._id) setSelectedId(data.document._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function loadChat(docId) {
    try {
      const res = await fetch(`${API}/api/documents/${docId}/chat`);
      const data = await res.json();
      if (res.ok) setChatMessages(data);
    } catch {
      // ignore
    }
  }

  async function loadRuns(docId) {
    try {
      const res = await fetch(`${API}/api/documents/${docId}/runs`);
      const data = await res.json();
      if (res.ok) setDocRuns(data);
    } catch {
      // ignore
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !selectedId) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    try {
      const res = await fetch(`${API}/api/documents/${selectedId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }

  const selectedDoc = documents.find((d) => d._id === selectedId);
  const processedCount = documents.filter((d) => d.status === "processed").length;
  const totalFields = documents.reduce(
    (sum, d) => sum + (d.aiResult?.fields?.length || 0),
    0
  );
  const avgConfidence = totalFields > 0
    ? (
        documents.reduce(
          (sum, d) => sum + (d.aiResult?.fields || []).reduce((s, f) => s + (f.confidence || 0), 0),
          0
        ) / totalFields
      ).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI document processing — extract, validate, and classify financial documents
        </p>
      </div>

      <div
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-transparent"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.csv,.xlsx,.txt,.json,.xml" />
        <svg className="h-8 w-8 mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-gray-900">
          {processing ? "Processing..." : "Drop documents here or click to upload"}
        </p>
        <p className="mt-1 text-xs text-gray-500">Supports PDF, XLSX, CSV, TXT, JSON, XML</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Processed</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{processedCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Fields Extracted</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalFields}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Avg. Confidence</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{avgConfidence}{avgConfidence !== "—" && "%"}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
          </div>
          {documents.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-500">No documents uploaded.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <button
                  key={doc._id}
                  className={`w-full text-left px-5 py-3 transition-colors hover:bg-slate-50 ${selectedId === doc._id ? "bg-blue-50" : ""}`}
                  onClick={() => setSelectedId(doc._id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-gray-900">{doc.originalName}</p>
                      <p className="text-[11px] text-gray-500">{new Date(doc.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: statusStyles[doc.status]?.bg || "#f1f5f9", color: statusStyles[doc.status]?.color || "#64748b" }}>
                      {statusStyles[doc.status]?.label || doc.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
            </div>
            {!selectedDoc ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">Select a document to preview.</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Summary</p>
                  <p className="text-sm text-gray-900">{selectedDoc.aiResult?.summary || "No AI summary yet."}</p>
                </div>
                {selectedDoc.aiResult?.fields?.length > 0 && (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Field</th>
                        <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Value</th>
                        <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedDoc.aiResult.fields.map((f, i) => (
                        <tr key={i}>
                          <td className="py-2 text-[13px] text-gray-500">{f.field_name}</td>
                          <td className="py-2 text-[13px] font-medium text-gray-900">{formatValue(f.value)}</td>
                          <td className="py-2 text-right text-[13px] tabular-nums" style={{ color: f.confidence >= 90 ? "#16a34a" : "#2563eb" }}>{f.confidence}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Content Preview</p>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-slate-50 p-3 text-xs text-gray-900">
                    {selectedDoc.extractedText ? selectedDoc.extractedText.substring(0, 2000) : "No text extracted from this file."}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Processing History</p>
                  {docRuns.length === 0 ? (
                    <p className="text-sm text-gray-500">No runs yet.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-gray-100">
                      {docRuns.slice(0, 5).map((run) => (
                        <div key={run._id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-[12px] font-medium text-gray-900">
                              {run.status === "success" ? "Success" : "Error"}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {new Date(run.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {run.error && (
                            <p className="text-[11px] text-red-600">{run.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Document Review Chat</h2>
            </div>
            {!selectedDoc ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">Select a document to start reviewing.</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                <div className="space-y-2 max-h-56 overflow-auto">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm text-gray-500">Ask a question about this document.</p>
                  ) : (
                    chatMessages.map((m, i) => (
                      <div key={i} className="text-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{m.role}</p>
                        <p className="text-gray-900">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Ask what's incorrect or needs review..."
                  />
                  <button
                    onClick={sendChat}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-medium text-white shadow-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
