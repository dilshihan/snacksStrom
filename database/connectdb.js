const mongoose = require("mongoose");
require("dotenv").config();

const cleanMongoUri = (rawUri) => {
  if (!rawUri) return "";
  let uri = rawUri.trim();
  if (uri.startsWith('"') && uri.endsWith('"')) {
    uri = uri.slice(1, -1).trim();
  }
  if (uri.startsWith("'") && uri.endsWith("'")) {
    uri = uri.slice(1, -1).trim();
  }
  if (uri.startsWith("MONGODB_URI=")) {
    uri = uri.substring("MONGODB_URI=".length).trim();
    if (uri.startsWith('"') && uri.endsWith('"')) {
      uri = uri.slice(1, -1).trim();
    }
    if (uri.startsWith("'") && uri.endsWith("'")) {
      uri = uri.slice(1, -1).trim();
    }
  }
  return uri;
};

const connectdb = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  const uri = cleanMongoUri(process.env.MONGODB_URI);
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is missing in Vercel settings.");
  }
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error(
      `Invalid scheme in MONGODB_URI. Expected string starting with "mongodb://" or "mongodb+srv://", but got: "${uri.substring(0, 15)}...". Please check the Value field in Vercel Environment Variables.`
    );
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    if (error.message && error.message.includes("querySrv")) {
      try {
        const dns = require("dns");
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        await mongoose.connect(uri, {
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
