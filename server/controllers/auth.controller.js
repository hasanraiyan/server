import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js'; // Adjust path as needed
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js'; // Adjust path as needed

// --- JWT Secret (Should come from environment variables) ---
const JWT_SECRET = process.env.JWT_SECRET || "your-very-strong-secret-key";

// POST /auth/register
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // 2. Check if username or email already exists in DB
    const existingUsername = await User.findOne({ username: username });
    if (existingUsername) {
      return res.status(409).json({ message: "Username already taken" });
    }
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // 5. Create and save user in DB
    const newUser = new User({
      username: username,
      email: email.toLowerCase(),
      passwordHash,
      isVerified: false,
      verificationToken,
    });
    await newUser.save();
    console.log("User registered (DB):", newUser.email);

    res.status(201).json({ message: "Registration successful. Please check your email to verify your account." });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Internal server error during registration" });
  }
};

// GET /auth/verify-email/:token
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Find user by verification token
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).send("<h1>Verification Failed</h1><p>Invalid or expired verification link.</p>");
    }

    // 2. Mark user as verified and remove token
    user.isVerified = true;
    user.verificationToken = undefined; // Clear the token
    await user.save();

    console.log(`User email verified: ${user.email}`);

    res.status(200).send("<h1>Email Verified Successfully!</h1><p>Your email address has been verified. You can now log in.</p>");

  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Internal server error during email verification" });
  }
};

// POST /auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 2. Find user by email (case-insensitive)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" }); // Email not found
    }

    // 3. Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: "Email not verified. Please check your inbox." });
    }

    // 4. Compare password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" }); // Incorrect password
    }

    // 5. Generate JWT
    const payload = {
      userId: user._id,
      email: user.email,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Adjust expiry as needed

    // 6. Send JWT back to client
    res.status(200).json({ message: "Login successful", token: token });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error during login" });
  }
};

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Validate input
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 2. Find user by email (case-insensitive)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    // 3. If user not found, send a success message anyway to prevent email enumeration
    if (!user) {
      return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    // 4. Generate reset token and expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // 5. Send password reset email
    const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, resetLink);

    res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error during forgot password" });
  }
};

// GET /auth/reset-password/:token (Optional: Render a form)
export const renderResetPasswordForm = async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Validate token
    if (!token) {
      return res.status(400).send("<h1>Reset Password Failed</h1><p>Invalid reset token.</p>");
    }

    // 2. Find user by resetPasswordToken and check expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send("<h1>Reset Password Failed</h1><p>Invalid or expired reset token.</p>");
    }

    // 3. Render a simple HTML form (or redirect to a frontend route)
    res.status(200).send(`
      <h1>Reset Password</h1>
      <form action="/auth/reset-password/${token}" method="POST">
        <label for="newPassword">New Password:</label>
        <input type="password" id="newPassword" name="newPassword" required>
        <button type="submit">Reset Password</button>
      </form>
    `);

  } catch (error) {
    console.error("Render reset password form error:", error);
    res.status(500).json({ message: "Internal server error while rendering reset password form" });
  }
};

// POST /auth/reset-password/:token
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // 1. Validate input
    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // 2. Find user by resetPasswordToken and check expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send("<h1>Reset Password Failed</h1><p>Invalid or expired reset token.</p>");
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    if (!passwordHash) {
      return res.status(500).json({ message: "Error hashing the new password" });
    }
    // 4. Update user's password and clear reset token
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // 5. Send success message (or redirect to a frontend route)
    res.status(200).send("<h1>Password Reset Successfully!</h1><p>Your password has been reset. You can now log in.</p>");

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error during password reset" });
  }
};
