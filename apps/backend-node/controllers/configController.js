import { FBAccount } from "../models/index.js";

export const createOrUpdateFBAccount = async (req, res) => {
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
};

export const listFBAccounts = async (req, res) => {
  try {
    const accounts = await FBAccount.find({});
    res.json(accounts);
  } catch (err) {
    console.error("Error listing accounts:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const deleteFBAccount = async (req, res) => {
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
};

export const updateFBAccount = async (req, res) => {
  const accountId = req.params.id;
  const { email, password, cookies_json } = req.body;
  try {
    const existing = await FBAccount.findById(accountId);
    if (!existing) return res.status(404).json({ detail: "Account not found" });

    if (email) existing.email = email;
    if (password !== undefined) existing.password = password;
    if (cookies_json) existing.cookies_json = cookies_json;
    existing.status = "valid"; // reset status on update
    
    await existing.save();
    res.json(existing);
  } catch (err) {
    console.error("Error updating account:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};
