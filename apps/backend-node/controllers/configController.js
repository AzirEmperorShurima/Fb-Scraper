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

const checkCookieValidity = async (cookies_json) => {
  let cookieStr = "";
  try {
    const cookies = typeof cookies_json === "string" ? JSON.parse(cookies_json) : cookies_json;
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    
    cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
  } catch (e) {
    return false;
  }

  try {
    const res = await fetch("https://mbasic.facebook.com/", {
      headers: {
        "cookie": cookieStr,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
      method: "GET"
    });
    const text = await res.text();
    // mbasic redirects to login or shows "Log in" button if not authenticated.
    if (text.includes('name="login"') || text.includes('action="/login/device-based/regular/login/"') || res.url.includes("login")) {
      return false;
    }
    return true; // Likely valid
  } catch (err) {
    return false;
  }
};

export const checkFBAccountCookie = async (req, res) => {
  const accountId = req.params.id;
  try {
    const account = await FBAccount.findById(accountId);
    if (!account) return res.status(404).json({ detail: "Account not found" });
    
    const isValid = await checkCookieValidity(account.cookies_json);
    account.status = isValid ? "valid" : "invalid";
    if (!isValid) account.fail_count = (account.fail_count || 0) + 1;
    await account.save();
    
    res.json({ accountId: account._id, email: account.email, isValid, status: account.status });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const checkAllFBAccountsCookies = async (req, res) => {
  try {
    const accounts = await FBAccount.find({});
    const results = [];
    
    for (const account of accounts) {
      const isValid = await checkCookieValidity(account.cookies_json);
      account.status = isValid ? "valid" : "invalid";
      if (!isValid) account.fail_count = (account.fail_count || 0) + 1;
      await account.save();
      
      results.push({
        accountId: account._id,
        email: account.email,
        isValid,
        status: account.status
      });
      // Sleep a little bit to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
    
    res.json({ results });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
};
