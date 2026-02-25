import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import characterRoutes from "./routes/characters.js";
import chatRoutes from "./routes/chats.js";
import adminRoutes from "./routes/admin.js";
import lorebookRoutes from "./routes/lorebooks.js";
import memoryRoutes from "./routes/memories.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const PORT = Number(process.env.PORT) || 4000;
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

await initDb();

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === ORIGIN) return callback(null, true);
      return callback(new Error("CORS blocked"), false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/characters", characterRoutes);
app.use("/chats/:id/messages", messageLimiter);
app.use("/chats", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/lorebooks", lorebookRoutes);
app.use("/memories", memoryRoutes);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultWebDist = path.resolve(__dirname, "../../web/dist");
const webDist = process.env.WEB_DIST || defaultWebDist;
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res) => res.sendFile(path.join(webDist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
