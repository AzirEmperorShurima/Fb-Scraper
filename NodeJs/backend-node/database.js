import mongoose from "mongoose";
export * from "./models/index.js";

const mongoUri = process.env.DATABASE_URL || "mongodb://localhost:27017/fbscraper";

export const initDatabase = async () => {
  console.log(`Connecting to MongoDB at URI: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully.");
};
