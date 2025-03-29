import dotenv from 'dotenv'; 
// Load environment variables from .env file
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from './config/db.js'; // Import DB connection function
import authRoutes from './routes/auth.routes.js'; // Import authentication routes

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

// --- Mount Routers ---
app.use("/auth", authRoutes); // Mount authentication routes under /auth path

app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// Simple alive check route
app.get("/server-alive", (req, res) => {
  res.send("Abhi hum zinda hai");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
