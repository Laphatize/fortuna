const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Papa = require("papaparse");
const XLSX = require("xlsx");
const { dedalus, openai, hasDedalus, hasOpenAI } = require("../lib/openai");
const Document = require("../models/Document");
const DocumentRun = require("../models/DocumentRun");
const DocumentChat = require("../models/DocumentChat");
const ReconciliationDataset = require("../models/ReconciliationDataset");
const ComplianceDataset = require("../models/ComplianceDataset");
const RiskDataset = require("../models/RiskDataset");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

async function getOrCreateReconciliationDataset() {
  let dataset = await ReconciliationDataset.findOne();
  if (!dataset) dataset = await ReconciliationDataset.create({ transactions: [] });
  return dataset;
}

function normalizeTransaction(txn, index, doc) {
  const id = txn.id || txn.transaction_id || `DOC-${doc._id}-${index + 1}`;
  const counterparty =
    txn.counterparty ||
    txn.party ||
    txn.customer ||
    txn.beneficiary ||
    txn.vendor ||
    "Unknown";
  const date =
    txn.date ||
    txn.trade_date ||
    txn.settlement_date ||
    txn.value_date ||
    txn.posted_date ||
    null;
  const type = txn.type || txn.transaction_type || txn.category || "unknown";
  const amountValue = txn.amount?.amount ?? txn.amount;
  const amountCurrency = txn.amount?.currency || txn.currency;
  const amount =
    amountValue !== undefined && amountValue !== null
      ? amountCurrency
        ? `${amountCurrency} ${amountValue}`
        : String(amountValue)
      : "—";
  const source = txn.source || `Document: ${doc.originalName}`;

  return {
    id,
    source,
    counterparty,
    amount,
    date,
    type,
    raw: txn,
  };
}

function normalizeKey(key) {
  return String(key).trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeRow(row) {
  const normalized = {};
  Object.keys(row || {}).forEach((k) => {
    normalized[normalizeKey(k)] = row[k];
  });
  return normalized;
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

function mergeByKey(existing, incoming, key) {
  const map = new Map((existing || []).map((item) => [item[key], item]));
  (incoming || []).forEach((item) => {
    const id = item[key];
    if (id === undefined || id === null || id === "") {
      map.set(`${Math.random()}`, item);
    } else if (!map.has(id)) {
      map.set(id, item);
    }
  });
  return Array.from(map.values());
}

function extractStructuredData(rows, doc) {
  const normalizedRows = rows.map(normalizeRow);

  const transactions = [];
  const entities = [];
  const complianceTxns = [];
  const portfolio = [];
  const scenarios = [];

  normalizedRows.forEach((row, idx) => {
    const amount = pick(row, ["amount", "amt", "value", "gross", "net", "total"]);
    const counterparty = pick(row, ["counterparty", "party", "customer", "beneficiary", "vendor", "client"]);
    const date = pick(row, ["date", "trade_date", "settlement_date", "value_date", "posted_date"]);
    const currency = pick(row, ["currency", "ccy", "curr"]);
    const id = pick(row, ["id", "transaction_id", "txn_id", "reference", "ref", "trade_id"]);
    const type = pick(row, ["type", "transaction_type", "category", "txn_type"]);
    const description = pick(row, ["description", "memo", "details", "narrative"]);

    if (amount && (counterparty || date || description)) {
      transactions.push(
        normalizeTransaction(
          {
            id,
            counterparty,
            amount,
            currency,
            date,
            type,
            description,
            source: "Structured File",
          },
          idx,
          doc
        )
      );
    }

    const entityName = pick(row, ["name", "entity", "entity_name", "counterparty", "customer"]);
    if (entityName) {
      entities.push({
        name: entityName,
        type: pick(row, ["type", "entity_type", "category"]) || "Entity",
        kyc_expiry: pick(row, ["kyc_expiry", "kyc_expiration", "kyc_expires", "expiry", "expiration"]),
        jurisdiction: pick(row, ["jurisdiction", "country", "region", "country_code"]),
        raw: row,
      });
    }

    if (entityName && amount) {
      complianceTxns.push({
        id: id || `CMP-${doc._id}-${idx + 1}`,
        entity: entityName,
        amount: currency ? `${currency} ${amount}` : String(amount),
        type: type || "transaction",
        date: date || null,
        raw: row,
      });
    }

    const asset = pick(row, ["asset", "asset_name", "instrument", "position"]);
    const exposure = pick(row, ["exposure", "amount", "value", "market_value", "notional"]);
    if (asset && exposure) {
      portfolio.push({
        asset,
        exposure: String(exposure),
        percentage: Number(pick(row, ["percentage", "pct", "weight", "allocation"])) || 0,
        raw: row,
      });
    }

    const scenario = pick(row, ["scenario", "event", "stress", "name", "description"]);
    if (scenario) {
      scenarios.push(String(scenario));
    } else if (!asset && !entityName && Object.keys(row).length === 1) {
      const onlyValue = Object.values(row)[0];
      if (onlyValue) scenarios.push(String(onlyValue));
    }
  });

  return {
    transactions,
    compliance_entities: entities,
    compliance_transactions: complianceTxns,
    risk_portfolio: portfolio,
    risk_scenarios: scenarios,
  };
}

// POST /api/documents/process
router.post("/process", upload.single("file"), async (req, res) => {
  try {
    const { file } = req;
    const { text } = req.body;

    if (!file && !text) {
      return res.status(400).json({ error: "No file or text provided" });
    }

    const isPdf = !!file && file.mimetype === "application/pdf";
    const isImage = !!file && file.mimetype.startsWith("image/");
    const content =
      text ||
      (file && file.mimetype.startsWith("text/")
        ? fs.readFileSync(file.path, "utf-8")
        : "");
    const doc = await Document.create({
      filename: file ? path.basename(file.path) : `text_${Date.now()}.txt`,
      originalName: file ? file.originalname : "text_input.txt",
      mimeType: file ? file.mimetype : "text/plain",
      size: file ? file.size : Buffer.byteLength(content || "", "utf-8"),
      storagePath: file ? file.path : "",
      extractedText: content ? content.substring(0, 20000) : "",
      status: "uploaded",
    });

    let structured = null;
    if (file && (file.mimetype.includes("csv") || file.originalname.toLowerCase().endsWith(".csv"))) {
      const csvText = fs.readFileSync(file.path, "utf-8");
      const parsedCsv = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      structured = extractStructuredData(parsedCsv.data || [], doc);
    } else if (file && (file.mimetype.includes("sheet") || file.originalname.toLowerCase().endsWith(".xlsx"))) {
      const wb = XLSX.readFile(file.path);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      structured = extractStructuredData(rows, doc);
    }

    const structuredHasDataEarly =
      structured &&
      Object.values(structured).some((arr) => Array.isArray(arr) && arr.length > 0);

    if (!content && !isPdf && !isImage && !structuredHasDataEarly) {
      await DocumentRun.create({
        documentId: doc._id,
        status: "error",
        error: "Text extraction unavailable for this file type",
      });
      doc.status = "error";
      await doc.save();
      return res.json({ document: doc, result: null, error: "Text extraction unavailable for this file type" });
    }

    const canAI = hasDedalus || hasOpenAI;
    const chatClient = dedalus || openai;
    const chatModel = hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini";
    let parsed;
    let aiError = null;

    if (canAI) {
      try {
        if ((isPdf || isImage) && openai) {
        const bytes = fs.readFileSync(file.path);
        const base64 = bytes.toString("base64");
        const input = [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "You are a financial document processing AI. Extract structured data from the provided document. " +
                  "Return a JSON object with: document_type, fields (field_name, value, confidence 0-100), " +
                  "summary (one sentence), flags (array), extracted_text (short text excerpt), " +
                  "reconciliation_candidate (true/false), transactions (array of objects with id, date, amount, currency, counterparty, type, description). " +
                  "Return ONLY valid JSON, no markdown.",
              },
              isPdf
                ? {
                    type: "input_file",
                    filename: file.originalname,
                    file_data: base64,
                  }
                : {
                    type: "input_image",
                    image_url: `data:${file.mimetype};base64,${base64}`,
                  },
            ],
          },
        ];

        const response = await openai.responses.create({
          model: "gpt-4o-mini",
          input,
          text: { format: { type: "json_object" } },
        });

        const textOut =
          response.output_text ||
          response.output?.flatMap((o) => o.content || []).find((c) => c.type === "output_text")?.text ||
          "";
        if (!textOut) throw new Error("No text output from OCR response");
        parsed = JSON.parse(textOut);
      } else if (isPdf) {
        await DocumentRun.create({
          documentId: doc._id,
          status: "error",
          error: "PDF OCR requires OPENAI_API_KEY",
        });
        doc.status = "error";
        await doc.save();
        return res.json({
          document: doc,
          result: null,
          error: "PDF OCR requires OPENAI_API_KEY",
        });
      } else if (isImage) {
        const bytes = fs.readFileSync(file.path);
        const base64 = bytes.toString("base64");
        const response = await chatClient.chat.completions.create({
          model: chatModel,
          messages: [
            {
              role: "system",
              content: `You are a financial document processing AI. Extract structured data from the provided document.
Return a JSON object with:
- "document_type": the type of document (e.g., "Trade Confirmation", "Invoice", "Settlement Statement", "KYC Document", "Margin Call", "SWIFT Message")
- "fields": an array of objects, each with "field_name", "value", and "confidence" (0-100)
- "summary": a one-sentence summary of the document
- "flags": an array of any issues or anomalies detected (empty array if none)
- "extracted_text": short text excerpt from the document
- "reconciliation_candidate": boolean indicating whether this document contains transactions to reconcile
- "transactions": array of objects with id, date, amount, currency, counterparty, type, description
Return ONLY valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Process this document image." },
                { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${base64}` } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });
        parsed = JSON.parse(response.choices[0].message.content);
      } else {
        const response = await chatClient.chat.completions.create({
          model: chatModel,
          messages: [
            {
              role: "system",
              content: `You are a financial document processing AI. Extract structured data from the provided document.
Return a JSON object with:
- "document_type": the type of document (e.g., "Trade Confirmation", "Invoice", "Settlement Statement", "KYC Document", "Margin Call", "SWIFT Message")
- "fields": an array of objects, each with "field_name", "value", and "confidence" (0-100)
- "summary": a one-sentence summary of the document
- "flags": an array of any issues or anomalies detected (empty array if none)
- "extracted_text": short text excerpt from the document
- "reconciliation_candidate": boolean indicating whether this document contains transactions to reconcile
- "transactions": array of objects with id, date, amount, currency, counterparty, type, description
Return ONLY valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: `Process this financial document:\n\n${content.substring(0, 8000)}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });
        parsed = JSON.parse(response.choices[0].message.content);
      }
      } catch (err) {
        aiError = err;
      }
    } else {
      aiError = new Error("AI processing unavailable (missing API key)");
    }

    const structuredHasData = structuredHasDataEarly;

    if (!parsed && structuredHasData) {
      parsed = {
        document_type: "Structured Import",
        fields: [],
        summary: "Imported from structured file headers.",
        flags: aiError ? [`AI processing failed: ${aiError.message}`] : [],
        extracted_text: "",
        reconciliation_candidate: !!structured.transactions?.length,
        transactions: structured.transactions || [],
        compliance_entities: structured.compliance_entities || [],
        compliance_transactions: structured.compliance_transactions || [],
        risk_portfolio: structured.risk_portfolio || [],
        risk_scenarios: structured.risk_scenarios || [],
      };
    }

    if (!parsed && content) {
      parsed = {
        document_type: "Text Upload",
        fields: [],
        summary: "Text extracted from upload.",
        flags: aiError ? [`AI processing failed: ${aiError.message}`] : [],
        extracted_text: content.substring(0, 2000),
      };
    }

    if (!parsed) {
      await DocumentRun.create({
        documentId: doc._id,
        status: "error",
        error: aiError ? aiError.message : "AI processing failed",
      });
      doc.status = "error";
      await doc.save();
      return res.json({ document: doc, result: null, error: aiError ? aiError.message : "AI processing failed" });
    }

    if (structured) {
      if (structured.transactions?.length) {
        parsed.transactions = [...(parsed.transactions || []), ...structured.transactions];
        parsed.reconciliation_candidate = true;
      }
      if (structured.compliance_entities?.length) {
        parsed.compliance_entities = [
          ...(parsed.compliance_entities || []),
          ...structured.compliance_entities,
        ];
      }
      if (structured.compliance_transactions?.length) {
        parsed.compliance_transactions = [
          ...(parsed.compliance_transactions || []),
          ...structured.compliance_transactions,
        ];
      }
      if (structured.risk_portfolio?.length) {
        parsed.risk_portfolio = [...(parsed.risk_portfolio || []), ...structured.risk_portfolio];
      }
      if (structured.risk_scenarios?.length) {
        parsed.risk_scenarios = [...(parsed.risk_scenarios || []), ...structured.risk_scenarios];
      }
    }
    await DocumentRun.create({
      documentId: doc._id,
      status: aiError ? "error" : "success",
      aiResult: aiError ? null : parsed,
      error: aiError ? aiError.message : null,
    });

    doc.aiResult = parsed;
    if (parsed?.extracted_text && !doc.extractedText) {
      doc.extractedText = parsed.extracted_text.substring(0, 20000);
    }
    doc.status = "processed";
    await doc.save();

    if (Array.isArray(parsed?.transactions) && parsed.transactions.length > 0) {
      const dataset = await getOrCreateReconciliationDataset();
      const existingIds = new Set((dataset.transactions || []).map((t) => t.id));
      const normalized = parsed.transactions.map((t, i) => normalizeTransaction(t, i, doc));
      const merged = [
        ...(dataset.transactions || []),
        ...normalized.filter((t) => !existingIds.has(t.id)),
      ];
      dataset.transactions = merged;
      await dataset.save();
    }

    if (
      Array.isArray(parsed?.compliance_entities) ||
      Array.isArray(parsed?.compliance_transactions)
    ) {
      let dataset = await ComplianceDataset.findOne();
      if (!dataset) dataset = await ComplianceDataset.create({ entities: [], transactions: [] });
      if (Array.isArray(parsed.compliance_entities)) {
        dataset.entities = mergeByKey(dataset.entities, parsed.compliance_entities, "name");
      }
      if (Array.isArray(parsed.compliance_transactions)) {
        dataset.transactions = mergeByKey(dataset.transactions, parsed.compliance_transactions, "id");
      }
      await dataset.save();
    }

    if (Array.isArray(parsed?.risk_portfolio) || Array.isArray(parsed?.risk_scenarios)) {
      let dataset = await RiskDataset.findOne();
      if (!dataset) dataset = await RiskDataset.create({ portfolio: [], scenarios: [] });
      if (Array.isArray(parsed.risk_portfolio)) {
        dataset.portfolio = mergeByKey(dataset.portfolio, parsed.risk_portfolio, "asset");
      }
      if (Array.isArray(parsed.risk_scenarios)) {
        const existing = new Set(dataset.scenarios || []);
        const merged = [
          ...(dataset.scenarios || []),
          ...parsed.risk_scenarios.filter((s) => !existing.has(s)),
        ];
        dataset.scenarios = merged;
      }
      await dataset.save();
    }

    res.json({ document: doc, result: parsed, error: aiError ? aiError.message : undefined });
  } catch (error) {
    console.error("Document processing error:", error);
    res.status(500).json({ error: "Failed to process document" });
  }
});

// GET /api/documents
router.get("/", async (_req, res) => {
  const docs = await Document.find().sort({ createdAt: -1 }).lean();
  res.json(docs);
});

// GET /api/documents/:id
router.get("/:id", async (req, res) => {
  const doc = await Document.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

// GET /api/documents/:id/runs
router.get("/:id/runs", async (req, res) => {
  const runs = await DocumentRun.find({ documentId: req.params.id })
    .sort({ createdAt: -1 })
    .lean();
  res.json(runs);
});

// POST /api/documents/:id/chat
router.post("/:id/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (!hasDedalus && !hasOpenAI) {
      return res.status(500).json({ error: "DEDALUS_API_KEY or OPENAI_API_KEY not set" });
    }

    const chat =
      (await DocumentChat.findOne({ documentId: doc._id })) ||
      (await DocumentChat.create({ documentId: doc._id, messages: [] }));

    const system = {
      role: "system",
      content:
        "You are a financial document reviewer. Use the document content to answer questions, identify inaccuracies, and suggest corrections. If unsure, say so clearly.",
    };

    const docContext = doc.extractedText
      ? `Document content (truncated):\n${doc.extractedText.substring(0, 8000)}`
      : "Document content is unavailable (binary file).";

    const chatClient = dedalus || openai;
    const chatModel = hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini";

    const response = await chatClient.chat.completions.create({
      model: chatModel,
      messages: [
        system,
        { role: "user", content: docContext },
        ...chat.messages,
        { role: "user", content: question },
      ],
      temperature: 0.2,
    });

    const answer = response.choices[0].message.content;
    chat.messages.push({ role: "user", content: question });
    chat.messages.push({ role: "assistant", content: answer });
    await chat.save();

    res.json({ answer });
  } catch (error) {
    console.error("Document chat error:", error);
    res.status(500).json({ error: "Failed to chat about document" });
  }
});

// GET /api/documents/:id/chat
router.get("/:id/chat", async (req, res) => {
  const chat = await DocumentChat.findOne({ documentId: req.params.id }).lean();
  res.json(chat ? chat.messages : []);
});

module.exports = router;
