const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { dedalus, openai, hasDedalus, hasOpenAI } = require("../lib/openai");
const Document = require("../models/Document");
const DocumentRun = require("../models/DocumentRun");
const DocumentChat = require("../models/DocumentChat");

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

    if (!content && !isPdf && !isImage) {
      await DocumentRun.create({
        documentId: doc._id,
        status: "error",
        error: "Text extraction unavailable for this file type",
      });
      doc.status = "error";
      await doc.save();
      return res.json({ document: doc, result: null, error: "Text extraction unavailable for this file type" });
    }

    if (!hasDedalus && !hasOpenAI) {
      return res.status(500).json({ error: "DEDALUS_API_KEY or OPENAI_API_KEY not set" });
    }

    const chatClient = dedalus || openai;
    const chatModel = hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini";
    let parsed;

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
                  "summary (one sentence), flags (array), extracted_text (short text excerpt). " +
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
    } catch (aiError) {
      await DocumentRun.create({
        documentId: doc._id,
        status: "error",
        error: aiError.message,
      });
      doc.status = "error";
      await doc.save();
      return res.status(500).json({ error: aiError.message });
    }
    await DocumentRun.create({
      documentId: doc._id,
      status: "success",
      aiResult: parsed,
    });

    doc.aiResult = parsed;
    if (parsed?.extracted_text && !doc.extractedText) {
      doc.extractedText = parsed.extracted_text.substring(0, 20000);
    }
    doc.status = "processed";
    await doc.save();

    res.json({ document: doc, result: parsed });
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
