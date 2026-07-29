import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/index.js";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
  process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET"
);
const SECRET_KEY = process.env.SECRET_KEY || "super-secret-development-key-change-in-production";

export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ detail: "Missing Google Token" });
    }

    // Verify token with Google
    let payload;
    try {
      try {
        // Try to verify as an ID Token (JWT) from React Frontend
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
        });
        payload = ticket.getPayload();
      } catch (jwtError) {
        // If it fails (e.g. Wrong number of segments), it might be an Access Token from Chrome Extension
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error("Invalid access token and invalid ID token");
        }
        payload = await response.json();
      }
    } catch (err) {
      throw err;
    }

    const googleId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'];

    // Find or create user
    let user = await User.findOne({ email });
    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.name = name || user.name;
        await user.save();
      }
    } else {
      user = new User({
        email,
        googleId,
        name,
        hashed_password: "", // No password needed for Google users
      });
      await user.save();
    }

    // Generate JWT
    const access_token = jwt.sign(
      { sub: user.email, user_id: user._id },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.json({
      access_token,
      token_type: "bearer",
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ detail: "Xác thực Google thất bại" });
  }
};
