import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRouter from "./routes/auth.js";
import configRouter from "./routes/config.js";
import jobsRouter from "./routes/jobs.js";
import exportsRouter from "./routes/exports.js";
import analyticsRouter from "./routes/analytics.js";
import googleAuthRouter from "./routes/googleAuth.js";
import sheetsRouter from "./routes/sheets.js";
import statsRouter from "./routes/stats.js";
import scriptsRouter from "./routes/scripts.js";
import systemConfigRouter from "./routes/systemConfig.js";

import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "FBGroupScraper Pro Node.js Backend API is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/auth/google", googleAuthRouter);
app.use("/api/config", systemConfigRouter);
app.use("/api/config/fb-accounts", configRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/jobs", exportsRouter);
app.use("/api/jobs", analyticsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/sheets", sheetsRouter);
app.use("/api/scripts", scriptsRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
