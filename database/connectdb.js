const mongoose = require("mongoose");
require("dotenv").config();

const connectdb = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing in Vercel settings.");
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    if (error.message && error.message.includes("querySrv")) {
      try {
        const dns = require("dns");
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log("MongoDB Connected (via DNS fallback)");
        return;
      } catch (dnsErr) {
        throw new Error(`MongoDB Connection Failed (DNS fallback): ${dnsErr.message}`);
      }
    }
    throw error;
  }
};

module.exports = connectdb;
