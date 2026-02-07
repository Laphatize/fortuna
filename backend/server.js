const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
// Increase payload limit for large JSON inputs (multipart handled by multer)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));


// Routes
const userRoutes = require("./routes/users");
const documentRoutes = require("./routes/documents");
const reconciliationRoutes = require("./routes/reconciliation");
const complianceRoutes = require("./routes/compliance");
const riskRoutes = require("./routes/risk");
const reportRoutes = require("./routes/reports");
const overviewRoutes = require("./routes/overview");

app.use("/api/users", userRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/overview", overviewRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
