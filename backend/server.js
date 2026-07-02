const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const redis = require("./services/redis");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/auth", require("./routes/auth"));

// Health check
app.get("/health", (req, res) => {
  const redisStatus = redis.getClient().status;
  const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    redis: redisStatus,
    mongo: mongoStatus,
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend for all other routes (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

// ── Error middleware ─────────────────────────────────────────────────────────
// Catches unhandled errors from async route handlers
app.use((err, req, res, _next) => {
  console.error("[Unhandled Error]", err.message);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
async function start() {
  // Initialize Redis
  redis.getClient();

  // Connect MongoDB
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/otp_auth";
  try {
    await mongoose.connect(mongoUri);
    console.log("[MongoDB] Connected to", mongoUri);
  } catch (err) {
    console.warn("[MongoDB] Could not connect:", err.message);
    console.warn("[MongoDB] Running without persistent user storage.");
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 OTP Auth POC running at http://localhost:${PORT}`);
    console.log(`📱 MSG91 mode: ${process.env.MSG91_API_KEY ? "LIVE" : "MOCK (add credentials to .env)"}`);
    console.log(`📄 Docs: see PROVIDER_DECISION.md\n`);
  });
}

// Only auto-start when run directly (not when required by tests)
if (require.main === module) {
  start().catch(console.error);
}

module.exports = { app, start };

