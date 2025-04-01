import mongoose from 'mongoose';


// Use environment variables for sensitive data like connection strings
// const MONGO_URI = "mongodb+srv://raiyanhasan:Raiyan%40123@dostify-user.vvkyza0.mongodb.net/dostify-users";
const MONGO_URI = "mongodb://localhost:27017/dostify-users";
console.log("MONGO_URI:", MONGO_URI);
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully using config/db.js");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    // Exit process with failure
    process.exit(1);
  }
};

export default connectDB;
