import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  createScript,
  listScripts,
  deleteScript,
  updateScript,
  executeScript,
  listExecutions,
  deleteExecution,
  getExecutionDetails,
  getExecutionPosts,
  logExecution,
  updateExecutionProgress,
  syncStep,
  completeExecution
} from "../controllers/scriptController.js";

export { runScriptProcess } from "../services/scriptService.js";

const router = express.Router();
router.use(authenticateToken);

router.post("/", createScript);
router.get("/", listScripts);
router.delete("/:id", deleteScript);
router.put("/:id", updateScript);

router.post("/:id/execute", executeScript);

router.get("/executions", listExecutions);
router.delete("/executions/:id", deleteExecution);
router.get("/executions/:id", getExecutionDetails);
router.get("/executions/:id/posts", getExecutionPosts);

// Extension callbacks
router.post("/executions/:id/log", logExecution);
router.post("/executions/:id/progress", updateExecutionProgress);
router.post("/executions/:id/sync-step", syncStep);
router.post("/executions/:id/complete", completeExecution);

export default router;

