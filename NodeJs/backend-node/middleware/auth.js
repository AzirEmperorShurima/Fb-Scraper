import jwt from "jsonwebtoken";
import { User } from "../database.js";

export const SECRET_KEY = process.env.SECRET_KEY || "super-secret-development-key-change-in-production";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.sub });
    if (!user) {
      return res.status(401).json({ detail: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: "Could not validate credentials" });
  }
};
