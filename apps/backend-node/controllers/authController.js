import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { SECRET_KEY } from "../middleware/auth.js";

export const register = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ detail: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = new User({
      email,
      hashed_password: hash
    });
    
    await newUser.save();

    res.json({ id: newUser.id, email, is_active: true });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const email = req.body.username || req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ detail: "Incorrect email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) {
      return res.status(401).json({ detail: "Incorrect email or password" });
    }

    const token = jwt.sign({ sub: user.email }, SECRET_KEY, { expiresIn: "7d" });
    res.json({ access_token: token, token_type: "bearer" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const getMe = (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    gsheet_webhook: req.user.gsheet_webhook || "",
    is_active: !!req.user.is_active
  });
};

export const updateSettings = async (req, res) => {
  try {
    const { gsheet_webhook } = req.body;
    req.user.gsheet_webhook = gsheet_webhook;
    await req.user.save();
    res.json({ detail: "Settings updated successfully", gsheet_webhook: req.user.gsheet_webhook });
  } catch (err) {
    console.error("Settings update error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};
