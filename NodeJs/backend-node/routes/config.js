import express from "express";
import { FBAccount } from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

// Create or update FB Account cookies
router.post("/", async (req, res) => {
  const { email, password, cookies_json } = req.body;
  if (!email) {
    return res.status(400).json({ detail: "Email is required" });
  }

  try {
    const existing = await FBAccount.findOne({ email });
    
    if (existing) {
      existing.cookies_json = cookies_json || [];
      existing.status = "valid";
      existing.last_used = new Date();
      if (password) {
        existing.password = password;
      }
      await existing.save();
      return res.json(existing);
    } else {
      const newAcc = new FBAccount({
        email,
        password: password || null,
        cookies_json: cookies_json || [],
        status: "valid"
      });
      await newAcc.save();
      return res.json(newAcc);
    }
  } catch (err) {
    console.error("Error configuring FB account:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// List FB Accounts
router.get("/", async (req, res) => {
  try {
    const accounts = await FBAccount.find({});
    res.json(accounts);
  } catch (err) {
    console.error("Error listing accounts:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Delete FB Account
router.delete("/:id", async (req, res) => {
  const accountId = req.params.id;
  try {
    const existing = await FBAccount.findById(accountId);
    if (!existing) {
      return res.status(404).json({ detail: "Account profile not found" });
    }

    await FBAccount.findByIdAndDelete(accountId);
    res.json({ message: "Account profile deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
