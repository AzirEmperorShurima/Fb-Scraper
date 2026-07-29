import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  hashed_password: { type: String },
  googleId: { type: String, sparse: true, unique: true },
  name: { type: String },
  gsheet_webhook: { type: String },
  is_active: { type: Boolean, default: true }
}, transformOptions);

export const User = mongoose.model("User", UserSchema);
