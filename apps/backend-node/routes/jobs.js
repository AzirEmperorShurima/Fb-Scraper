import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  createJob,
  listJobs,
  getJobStatus,
  stopJob,
  pauseJob,
  resumeJob,
  restartJob,
  getJobPosts,
  syncExtension,
  deleteJob,
  verifyStatus
} from "../controllers/jobsController.js";

export { runScrapingProcess } from "../services/scraperService.js";

const router = express.Router();
router.use(authenticateToken);

router.post("/", createJob);
router.get("/", listJobs);
router.get("/:id", getJobStatus);
router.post("/:id/stop", stopJob);
router.post("/:id/pause", pauseJob);
router.post("/:id/resume", resumeJob);
router.post("/:id/restart", restartJob);
router.get("/:id/posts", getJobPosts);
router.post("/sync-extension", syncExtension);
router.delete("/:id", deleteJob);
router.post("/:id/verify-status", verifyStatus);

export default router;
