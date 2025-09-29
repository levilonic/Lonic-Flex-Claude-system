import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "lonicflex-api", timestamp: new Date().toISOString() });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("🌍 LonicFlex API is running");
});

app.listen(PORT, () => {
  console.log(`✅ LonicFlex API running on http://localhost:${PORT}`);
});
