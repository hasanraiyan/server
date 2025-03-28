import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true }); // Add createdAt and updatedAt timestamps

// Optional: Add methods or statics to the schema if needed later
// UserSchema.methods.comparePassword = async function(candidatePassword) { ... };

const User = mongoose.model("User", UserSchema);

export default User;
