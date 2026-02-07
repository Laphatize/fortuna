const express = require("express");
const { VapiClient } = require("@vapi-ai/server-sdk");
const router = express.Router();
const PTORequest = require("../models/PTORequest");
const { dedalus, openai, hasDedalus, hasOpenAI } = require("../lib/openai");

// GET /api/pto — list all PTO requests
router.get("/", async (_req, res) => {
  try {
    const requests = await PTORequest.find().sort({ createdAt: -1 }).lean();
    res.json(requests);
  } catch (error) {
    console.error("PTO list error:", error);
    res.status(500).json({ error: "Failed to load PTO requests" });
  }
});

// GET /api/pto/stats — summary stats
router.get("/stats", async (_req, res) => {
  try {
    const all = await PTORequest.find().lean();
    const pending = all.filter((r) => r.status === "pending").length;
    const approved = all.filter((r) => r.status === "approved").length;
    const denied = all.filter((r) => r.status === "denied").length;
    const totalDaysUsed = all
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + (r.days || 0), 0);

    // Group by type
    const byType = {};
    all.filter((r) => r.status === "approved").forEach((r) => {
      byType[r.type] = (byType[r.type] || 0) + (r.days || 0);
    });

    res.json({ total: all.length, pending, approved, denied, totalDaysUsed, byType });
  } catch (error) {
    console.error("PTO stats error:", error);
    res.status(500).json({ error: "Failed to load PTO stats" });
  }
});

// POST /api/pto — create a new PTO request
router.post("/", async (req, res) => {
  try {
    const { employeeName, employeeEmail, type, startDate, endDate, days, reason } = req.body;
    if (!employeeName || !employeeEmail || !startDate || !endDate || !days) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const request = await PTORequest.create({
      employeeName,
      employeeEmail,
      type: type || "vacation",
      startDate,
      endDate,
      days,
      reason: reason || "",
    });
    res.json(request);
  } catch (error) {
    console.error("PTO create error:", error);
    res.status(500).json({ error: "Failed to create PTO request" });
  }
});

// PATCH /api/pto/:id — approve or deny
router.patch("/:id", async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    if (!["approved", "denied"].includes(status)) {
      return res.status(400).json({ error: "Status must be approved or denied" });
    }
    const request = await PTORequest.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote: reviewNote || "" },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
  } catch (error) {
    console.error("PTO update error:", error);
    res.status(500).json({ error: "Failed to update PTO request" });
  }
});

// DELETE /api/pto/:id
router.delete("/:id", async (req, res) => {
  try {
    await PTORequest.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("PTO delete error:", error);
    res.status(500).json({ error: "Failed to delete PTO request" });
  }
});

// POST /api/pto/analyze — AI analysis of PTO patterns
router.post("/analyze", async (req, res) => {
  try {
    if (!hasDedalus && !hasOpenAI) {
      return res.status(500).json({ error: "No AI API key configured" });
    }

    const all = await PTORequest.find().sort({ createdAt: -1 }).lean();
    if (all.length === 0) {
      return res.json({ analysis: "No PTO data available to analyze yet. Submit some PTO requests first." });
    }

    const summary = all.map((r) =>
      `${r.employeeName} | ${r.type} | ${r.startDate?.toISOString?.()?.split("T")[0] || r.startDate} to ${r.endDate?.toISOString?.()?.split("T")[0] || r.endDate} | ${r.days} days | ${r.status}${r.reason ? ` | Reason: ${r.reason}` : ""}`
    ).join("\n");

    const chatClient = dedalus || openai;
    const chatModel = hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini";

    const response = await chatClient.chat.completions.create({
      model: chatModel,
      messages: [
        {
          role: "system",
          content: "You are an HR analytics assistant. Analyze PTO request data and provide insights about patterns, coverage risks, and recommendations. Be concise and actionable.",
        },
        {
          role: "user",
          content: `Analyze these PTO requests and provide insights:\n\n${summary}`,
        },
      ],
      temperature: 0.3,
    });

    res.json({ analysis: response.choices[0].message.content });
  } catch (error) {
    console.error("PTO analyze error:", error);
    res.status(500).json({ error: "Failed to analyze PTO data" });
  }
});

// POST /api/pto/sync-calls — poll Vapi for recent calls and create PTO requests
router.post("/sync-calls", async (req, res) => {
  try {
    if (!process.env.VAPI_API_KEY) {
      return res.status(500).json({ error: "VAPI_API_KEY not set" });
    }

    const vapi = new VapiClient({ token: process.env.VAPI_API_KEY });

    // Fetch recent calls
    const calls = await vapi.calls.list({
      assistantId: process.env.VAPI_ASSISTANT_ID || undefined,
      limit: 50,
    });

    // Get all callIds we've already processed
    const existingCallIds = new Set(
      (await PTORequest.find({ source: "phone", callId: { $ne: "" } }).select("callId").lean())
        .map((r) => r.callId)
    );

    const validTypes = ["vacation", "sick", "personal", "bereavement", "other"];
    let created = 0;

    for (const call of calls) {
      // Skip already processed or still in-progress calls
      if (!call.id || existingCallIds.has(call.id)) continue;
      if (call.status !== "ended") continue;

      const structuredData = call.analysis?.structuredData || {};
      if (!structuredData.employee_name || !structuredData.start_date || !structuredData.end_date) continue;

      const start = new Date(structuredData.start_date);
      const end = new Date(structuredData.end_date);
      const days = structuredData.total_days || Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
      const ptoType = structuredData.pto_type || "other";
      const transcript = call.analysis?.summary || call.transcript || "";

      await PTORequest.create({
        employeeName: structuredData.employee_name,
        employeeEmail: structuredData.employee_email || "",
        employeePhone: call.customer?.number || structuredData.employee_phone || "",
        source: "phone",
        callId: call.id,
        transcript: typeof transcript === "string" ? transcript : JSON.stringify(transcript),
        type: validTypes.includes(ptoType) ? ptoType : "other",
        startDate: start,
        endDate: end,
        days,
        reason: structuredData.reason || "",
      });

      created++;
      console.log(`Vapi PTO request created for ${structuredData.employee_name} (call ${call.id})`);
    }

    res.json({ synced: created, total_calls: calls.length });
  } catch (error) {
    console.error("Vapi sync error:", error);
    res.status(500).json({ error: "Failed to sync Vapi calls" });
  }
});

module.exports = router;
