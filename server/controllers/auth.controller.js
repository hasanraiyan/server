import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js'; // Adjust path as needed
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js'; // Adjust path as needed

// --- Debug Mode ---
// Set to true for verbose logging, false for production
const DEBUG_MODE = true;

// --- JWT Secret (Should come from environment variables) ---
const JWT_SECRET = process.env.JWT_SECRET || "your-very-strong-secret-key";
if (DEBUG_MODE && JWT_SECRET === "your-very-strong-secret-key") {
  console.warn('[AUTH] Using default JWT_SECRET. Set process.env.JWT_SECRET in production!');
}

// POST /auth/register
export const register = async (req, res) => {
  if (DEBUG_MODE) console.log('[register] Function start');
  try {
    const { username, email, password, name } = req.body;
    if (DEBUG_MODE) console.log('[register] Received body:', { username, email: email?.toLowerCase(), name }); // Log sensitive data carefully

    // 1. Validate input
    if (DEBUG_MODE) console.log('[register] Validating input...');
    if (!username || !email || !password || !name) {
      if (DEBUG_MODE) console.log('[register] Validation failed: Missing required fields');
      return res.status(400).json({ message: "Username, email, name and password are required" });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        if (DEBUG_MODE) console.log(`[register] Validation failed: Invalid email format for ${email}`);
        return res.status(400).json({ message: "Invalid email format" });
    }
    if (password.length < 6) {
        if (DEBUG_MODE) console.log('[register] Validation failed: Password too short');
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    if (DEBUG_MODE) console.log('[register] Input validation passed.');

    // 2. Check if username or email already exists in DB
    if (DEBUG_MODE) console.log(`[register] Checking DB for existing username: ${username}`);
    const existingUsername = await User.findOne({ username: username });
    if (DEBUG_MODE) console.log(`[register] Username check result: ${existingUsername ? `Found (ID: ${existingUsername._id})` : 'Not Found'}`);
    if (existingUsername) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const lowerCaseEmail = email.toLowerCase();
    if (DEBUG_MODE) console.log(`[register] Checking DB for existing email: ${lowerCaseEmail}`);
    const existingUser = await User.findOne({ email: lowerCaseEmail });
    if (DEBUG_MODE) console.log(`[register] Email check result: ${existingUser ? `Found (ID: ${existingUser._id})` : 'Not Found'}`);
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }
    if (DEBUG_MODE) console.log('[register] Username and email are unique.');

    // 3. Hash password
    if (DEBUG_MODE) console.log('[register] Generating salt...');
    const salt = await bcrypt.genSalt(10);
    if (DEBUG_MODE) console.log('[register] Hashing password...');
    const passwordHash = await bcrypt.hash(password, salt);
    if (DEBUG_MODE) console.log('[register] Password hashed successfully.');

    // 4. Generate verification token
    if (DEBUG_MODE) console.log('[register] Generating verification token...');
    const verificationToken = crypto.randomBytes(32).toString("hex");
    if (DEBUG_MODE) console.log(`[register] Verification token generated: ${verificationToken.substring(0, 10)}...`); // Log only a snippet

    // 5. Create user object
    if (DEBUG_MODE) console.log('[register] Creating new user object...');
    const newUser = new User({
      name: name,
      username: username,
      email: lowerCaseEmail,
      passwordHash,
      isVerified: false,
      verificationToken,
    });
    if (DEBUG_MODE) console.log('[register] New user object created:', { email: newUser.email, username: newUser.username, name: newUser.name });

    // 6. Save user in DB
    if (DEBUG_MODE) console.log('[register] Saving new user to DB...');
    await newUser.save();
    if (DEBUG_MODE) console.log(`[register] User saved successfully to DB. ID: ${newUser._id}, Email: ${newUser.email}`);

    // 7. Send verification email (CRITICAL - WAS MISSING)
    try {
        if (DEBUG_MODE) console.log(`[register] Attempting to send verification email to ${newUser.email}...`);
        const verificationLink = `${req.protocol}://${req.get('host')}/auth/verify-email/${verificationToken}`; // Construct link here
         await sendVerificationEmail(newUser.email, verificationLink); // Pass the full link
        if (DEBUG_MODE) console.log(`[register] Verification email successfully requested for ${newUser.email}.`);
    } catch (emailError) {
        console.error(`[register] Failed to send verification email to ${newUser.email}:`, emailError);
        // Decide if registration should fail if email fails. Usually, we proceed but log the error.
        // Optionally, you could queue the email for retry.
    }

    // 8. Send response
    if (DEBUG_MODE) console.log('[register] Sending 201 success response.');
    res.status(201).json({ message: "Registration successful. Please check your email to verify your account." });

  } catch (error) {
    if (DEBUG_MODE) console.error("[register] Error caught in catch block:", error);
    console.error("Registration error:", error); // Keep standard error log
    res.status(500).json({ message: "Internal server error during registration" });
  }
};

// GET /auth/verify-email/:token
export const verifyEmail = async (req, res) => {
  if (DEBUG_MODE) console.log('[verifyEmail] Function start');
  try {
    const { token } = req.params;
    if (DEBUG_MODE) console.log(`[verifyEmail] Received token: ${token ? token.substring(0, 10) + '...' : 'undefined'}`);

    // 1. Find user by verification token
    if (DEBUG_MODE) console.log(`[verifyEmail] Searching for user with verification token...`);
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      if (DEBUG_MODE) console.log('[verifyEmail] User not found for the given token.');
      return res.status(400).send("<h1>Verification Failed</h1><p>Invalid or expired verification link.</p>");
    }
    if (DEBUG_MODE) console.log(`[verifyEmail] User found: ID: ${user._id}, Email: ${user.email}`);

    // 2. Mark user as verified and remove token
    if (DEBUG_MODE) console.log(`[verifyEmail] Marking user ${user.email} as verified and clearing token...`);
    user.isVerified = true;
    user.verificationToken = undefined; // Clear the token
    await user.save();
    if (DEBUG_MODE) console.log(`[verifyEmail] User ${user.email} updated successfully in DB.`);

    console.log(`User email verified: ${user.email}`); // Standard log

    // 3. Send success response
    if (DEBUG_MODE) console.log('[verifyEmail] Sending 200 success HTML response.');
    res.status(200).send("<h1>Email Verified Successfully!</h1><p>Your email address has been verified. You can now log in.</p>");

  } catch (error) {
    if (DEBUG_MODE) console.error("[verifyEmail] Error caught in catch block:", error);
    console.error("Email verification error:", error); // Keep standard error log
    res.status(500).json({ message: "Internal server error during email verification" }); // Send JSON for API errors
  }
};

// POST /auth/login
export const login = async (req, res) => {
  if (DEBUG_MODE) console.log('[login] Function start');
  try {
    const { email, password } = req.body;
    if (DEBUG_MODE) console.log('[login] Received body:', { email: email?.toLowerCase() }); // Log sensitive data carefully

    // 1. Validate input
    if (DEBUG_MODE) console.log('[login] Validating input...');
    if (!email || !password) {
      if (DEBUG_MODE) console.log('[login] Validation failed: Missing email or password');
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (DEBUG_MODE) console.log('[login] Input validation passed.');

    // 2. Find user by email (case-insensitive)
    const lowerCaseEmail = email.toLowerCase();
    if (DEBUG_MODE) console.log(`[login] Searching for user with email: ${lowerCaseEmail}`);
    const user = await User.findOne({ email: { $regex: new RegExp(`^${lowerCaseEmail}$`, 'i') } });

    if (!user) {
      if (DEBUG_MODE) console.log(`[login] User not found for email: ${lowerCaseEmail}`);
      return res.status(401).json({ message: "Invalid credentials" }); // Email not found
    }
    if (DEBUG_MODE) console.log(`[login] User found: ID: ${user._id}, Email: ${user.email}`);

    // 3. Check if user is verified
    if (DEBUG_MODE) console.log(`[login] Checking if user ${user.email} is verified...`);
    if (!user.isVerified) {
      if (DEBUG_MODE) console.log(`[login] User ${user.email} is not verified. Denying login.`);
      return res.status(403).json({ message: "Email not verified. Please check your inbox." });
    }
    if (DEBUG_MODE) console.log(`[login] User ${user.email} is verified.`);

    // 4. Compare password hash
    if (DEBUG_MODE) console.log(`[login] Comparing provided password with hash for user ${user.email}...`);
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (DEBUG_MODE) console.log(`[login] Password comparison result: ${isPasswordValid}`);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" }); // Incorrect password
    }
    if (DEBUG_MODE) console.log(`[login] Password is valid for user ${user.email}.`);

    // 5. Generate JWT
    if (DEBUG_MODE) console.log(`[login] Generating JWT for user ${user.email} (ID: ${user._id})...`);
    const payload = {
      userId: user._id,
      email: user.email,
      // Add other relevant non-sensitive info if needed (e.g., roles)
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    if (DEBUG_MODE) console.log(`[login] JWT generated: ${token.substring(0, 15)}...`);

    // 6. Send JWT back to client
    if (DEBUG_MODE) console.log('[login] Sending 200 success response with token and user info.');
    res.status(200).json({
        message: "Login successful",
        token: token,
        user: { id: user._id, email: user.email, name: user.name, username: user.username /* Add other safe fields */ }
    });

  } catch (error) {
    if (DEBUG_MODE) console.error("[login] Error caught in catch block:", error);
    console.error("Login error:", error); // Keep standard error log
    res.status(500).json({ message: "Internal server error during login" });
  }
};

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
  if (DEBUG_MODE) console.log('[forgotPassword] Function start');
  try {
    const { email } = req.body;
    if (DEBUG_MODE) console.log('[forgotPassword] Received body:', { email: email?.toLowerCase() });

    // 1. Validate input
    if (DEBUG_MODE) console.log('[forgotPassword] Validating input...');
    if (!email) {
        if (DEBUG_MODE) console.log('[forgotPassword] Validation failed: Missing email');
      return res.status(400).json({ message: "Email is required" });
    }
    if (DEBUG_MODE) console.log('[forgotPassword] Input validation passed.');

    // 2. Find user by email (case-insensitive)
    const lowerCaseEmail = email.toLowerCase();
    if (DEBUG_MODE) console.log(`[forgotPassword] Searching for user with email: ${lowerCaseEmail}`);
    const user = await User.findOne({ email: { $regex: new RegExp(`^${lowerCaseEmail}$`, 'i') } });

    // 3. Handle user not found (SECURITY: always send success)
    if (!user) {
      if (DEBUG_MODE) console.log(`[forgotPassword] User not found for email: ${lowerCaseEmail}. Sending generic success response.`);
      return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
    }
    if (DEBUG_MODE) console.log(`[forgotPassword] User found: ID: ${user._id}, Email: ${user.email}`);

    // 4. Generate reset token and expiry
    if (DEBUG_MODE) console.log(`[forgotPassword] Generating password reset token for user ${user.email}...`);
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    if (DEBUG_MODE) console.log(`[forgotPassword] Reset token generated: ${resetToken.substring(0, 10)}... Expiry set.`);

    // 5. Save updated user token/expiry
    if (DEBUG_MODE) console.log(`[forgotPassword] Saving reset token and expiry for user ${user.email} to DB...`);
    await user.save();
    if (DEBUG_MODE) console.log(`[forgotPassword] User ${user.email} updated successfully in DB.`);

    // 6. Send password reset email
    const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`; // Ensure frontend route matches if applicable
    if (DEBUG_MODE) console.log(`[forgotPassword] Generated reset link: ${resetLink}`);
    try {
        if (DEBUG_MODE) console.log(`[forgotPassword] Attempting to send password reset email to ${user.email}...`);
        await sendPasswordResetEmail(user.email, resetLink);
        if (DEBUG_MODE) console.log(`[forgotPassword] Password reset email successfully requested for ${user.email}.`);
    } catch(emailError) {
        console.error(`[forgotPassword] Failed to send password reset email to ${user.email}:`, emailError);
        // Log error but still send success response to user to avoid leaking info
    }


    // 7. Send success response
    if (DEBUG_MODE) console.log('[forgotPassword] Sending 200 generic success response.');
    res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });

  } catch (error) {
    if (DEBUG_MODE) console.error("[forgotPassword] Error caught in catch block:", error);
    console.error("Forgot password error:", error); // Keep standard error log
    res.status(500).json({ message: "Internal server error during forgot password" });
  }
};

// GET /auth/reset-password/:token (Optional: Render a form)
export const renderResetPasswordForm = async (req, res) => {
    if (DEBUG_MODE) console.log('[renderResetPasswordForm] Function start');
    try {
      const { token } = req.params;
      if (DEBUG_MODE) console.log(`[renderResetPasswordForm] Received token: ${token ? token.substring(0, 10) + '...' : 'undefined'}`);

      // 1. Validate token presence (basic)
      if (!token) {
        if (DEBUG_MODE) console.log('[renderResetPasswordForm] Validation failed: No token provided in URL.');
        return res.status(400).send("<h1>Reset Password Failed</h1><p>Invalid reset token link.</p>");
      }

      // 2. Find user by resetPasswordToken and check expiry
      if (DEBUG_MODE) console.log(`[renderResetPasswordForm] Searching for user with valid reset token...`);
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        if (DEBUG_MODE) console.log('[renderResetPasswordForm] User not found or token expired.');
        return res.status(400).send("<h1>Reset Password Failed</h1><p>Invalid or expired reset token.</p>");
      }
      if (DEBUG_MODE) console.log(`[renderResetPasswordForm] Valid token found for user: ${user.email}`);


      // 3. Render a simple HTML form
      if (DEBUG_MODE) console.log('[renderResetPasswordForm] Sending 200 HTML form response.');
      // IMPORTANT: The form action MUST point to the correct POST endpoint
      // If your frontend handles this, you might redirect instead:
      // return res.redirect(`https://your-frontend.com/reset-password?token=${token}`);
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reset Password</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            label { display: block; margin-bottom: 5px; }
            input[type="password"] { width: 250px; padding: 8px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; }
            button { padding: 10px 15px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background-color: #0056b3; }
            .error { color: red; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Reset Password</h1>
          <form id="resetForm" action="/auth/reset-password/${token}" method="POST">
            <label for="newPassword">New Password:</label>
            <input type="password" id="newPassword" name="newPassword" required minlength="6">
            <br>
             <label for="confirmPassword">Confirm New Password:</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6">
            <br>
            <button type="submit">Reset Password</button>
             <p id="error-message" class="error" style="display: none;"></p>
          </form>
           <script>
                const form = document.getElementById('resetForm');
                const newPassword = document.getElementById('newPassword');
                const confirmPassword = document.getElementById('confirmPassword');
                const errorMessage = document.getElementById('error-message');

                form.addEventListener('submit', function(event) {
                    errorMessage.style.display = 'none'; // Hide previous errors
                    if (newPassword.value !== confirmPassword.value) {
                        event.preventDefault(); // Stop form submission
                        errorMessage.textContent = 'Passwords do not match.';
                        errorMessage.style.display = 'block';
                    } else if (newPassword.value.length < 6) {
                         event.preventDefault(); // Stop form submission
                         errorMessage.textContent = 'Password must be at least 6 characters long.';
                         errorMessage.style.display = 'block';
                    }
                    // If passwords match and length is okay, the form submits normally
                });
            </script>
        </body>
        </html>
      `);

    } catch (error) {
      if (DEBUG_MODE) console.error("[renderResetPasswordForm] Error caught in catch block:", error);
      console.error("Render reset password form error:", error); // Keep standard error log
      // Send a generic error page for GET request failures
      res.status(500).send("<h1>Internal Server Error</h1><p>Sorry, something went wrong while trying to load the password reset page.</p>");
    }
};


// POST /auth/reset-password/:token
export const resetPassword = async (req, res) => {
  if (DEBUG_MODE) console.log('[resetPassword] Function start');
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (DEBUG_MODE) console.log(`[resetPassword] Received token: ${token ? token.substring(0, 10) + '...' : 'undefined'}`);
    if (DEBUG_MODE) console.log(`[resetPassword] Received new password (length): ${newPassword?.length}`); // Don't log password itself

    // 1. Validate input
    if (DEBUG_MODE) console.log('[resetPassword] Validating input...');
    if (!newPassword) {
      if (DEBUG_MODE) console.log('[resetPassword] Validation failed: Missing new password');
      // Send JSON error for API-like interaction, or HTML if form posts directly
      return res.status(400).json({ message: "New password is required" });
      // Or: return res.status(400).send("<h1>Reset Failed</h1><p>New password is required.</p>");
    }
    if (newPassword.length < 6) {
      if (DEBUG_MODE) console.log('[resetPassword] Validation failed: Password too short');
       return res.status(400).json({ message: "Password must be at least 6 characters long" });
       // Or: return res.status(400).send("<h1>Reset Failed</h1><p>Password must be at least 6 characters long.</p>");
    }
    if (DEBUG_MODE) console.log('[resetPassword] Input validation passed.');


    // 2. Find user by resetPasswordToken and check expiry
    if (DEBUG_MODE) console.log(`[resetPassword] Searching for user with valid reset token...`);
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      if (DEBUG_MODE) console.log('[resetPassword] User not found or token expired.');
      return res.status(400).send("<h1>Reset Password Failed</h1><p>Invalid or expired reset token.</p>");
    }
    if (DEBUG_MODE) console.log(`[resetPassword] Valid token found for user: ${user.email}`);

    // 3. Hash new password
    if (DEBUG_MODE) console.log(`[resetPassword] Generating salt for user ${user.email}...`);
    const salt = await bcrypt.genSalt(10);
    if (DEBUG_MODE) console.log(`[resetPassword] Hashing new password for user ${user.email}...`);
    const passwordHash = await bcrypt.hash(newPassword, salt);
     if (!passwordHash) { // Extra check
        if (DEBUG_MODE) console.error('[resetPassword] Failed to hash the new password!');
        return res.status(500).json({ message: "Error processing the new password" });
    }
    if (DEBUG_MODE) console.log(`[resetPassword] New password hashed successfully for user ${user.email}.`);

    // 4. Update user's password and clear reset token
    if (DEBUG_MODE) console.log(`[resetPassword] Updating password and clearing reset token/expiry for user ${user.email}...`);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    if (DEBUG_MODE) console.log(`[resetPassword] User ${user.email} updated successfully in DB.`);

    // 5. Send success message
    if (DEBUG_MODE) console.log('[resetPassword] Sending 200 success HTML response.');
    // If your frontend handles this, you might send JSON:
    // return res.status(200).json({ message: "Password reset successfully. You can now log in." });
    res.status(200).send("<h1>Password Reset Successfully!</h1><p>Your password has been reset. You can now log in.</p>");

  } catch (error) {
    if (DEBUG_MODE) console.error("[resetPassword] Error caught in catch block:", error);
    console.error("Reset password error:", error); // Keep standard error log
     // Send JSON error for API-like interaction, or HTML if form posts directly
    res.status(500).json({ message: "Internal server error during password reset" });
    // Or: res.status(500).send("<h1>Internal Server Error</h1><p>Sorry, something went wrong while resetting your password.</p>");
  }
};


// Middleware to verify JWT and get user details
export const verifyToken = (req, res, next) => {
    const functionName = '[verifyToken Middleware]';
    if (DEBUG_MODE) console.log(`${functionName} Function start`);
    try {
        if (DEBUG_MODE) console.log(`${functionName} Checking for Authorization header...`);
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1]; // Expecting "Bearer <token>"

        if (!token) {
          if (DEBUG_MODE) console.log(`${functionName} No token found in Authorization header.`);
          return res.status(401).json({ message: "Access denied. No token provided." });
        }
        if (DEBUG_MODE) console.log(`${functionName} Token found: ${token.substring(0, 15)}...`);

        // Verify the token
        if (DEBUG_MODE) console.log(`${functionName} Verifying JWT...`);
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
          if (err) {
            if (DEBUG_MODE) console.log(`${functionName} JWT verification failed: ${err.message}`);
            return res.status(403).json({ message: "Invalid or expired token." }); // Use 403 for forbidden access due to bad token
          }

          // Attach user details to request
          if (DEBUG_MODE) console.log(`${functionName} JWT verified successfully. Decoded payload:`, decoded);
          req.user = decoded; // Contains { userId, email, iat, exp } from the payload
          if (DEBUG_MODE) console.log(`${functionName} Attaching decoded user to req.user and calling next().`);
          next(); // Proceed to the next middleware or route handler
        });
    } catch (error) {
        // This catch block might not be reached for jwt.verify errors as it uses a callback
        // But good practice to keep it for other potential synchronous errors
        if (DEBUG_MODE) console.error(`${functionName} Error caught in catch block:`, error);
        console.error("JWT Verification error:", error); // Keep standard error log
        res.status(500).json({ message: "Internal server error during token verification." });
    }
};

// Example usage in a protected route
// GET /users/:userId/profile (assuming a route like this)
export const getUserProfile = async (req, res) => {
  const functionName = '[getUserProfile - Own Profile]';
  if (DEBUG_MODE) console.log(`${functionName} Function start`);
  try {
    // 1. Check if verifyToken attached user data
    if (DEBUG_MODE) console.log(`${functionName} Checking for req.user...`);
    if (!req.user || !req.user.userId) {
      if (DEBUG_MODE) console.log(`${functionName} req.user not found or invalid.`);
      return res.status(401).json({ message: "Unauthorized access." });
    }

    // 2. Use the ID from the authenticated user's token
    const loggedInUserId = req.user.userId;
    if (DEBUG_MODE) console.log(`${functionName} Getting profile for logged-in user ID: ${loggedInUserId}`);

    // 3. Build query - Use EXCLUSION only. Email will be included by default.
    if (DEBUG_MODE) console.log(`${functionName} Building user query for ID: ${loggedInUserId}`);
    const userQuery = User.findById(loggedInUserId)
                           // --- CORRECTED SELECT ---
                           .select("-passwordHash -resetPasswordToken -resetPasswordExpires -verificationToken -__v");
                           // ------------------------
                           // No +email needed here, it's included because it's not excluded.

    // 4. Execute query
    if (DEBUG_MODE) console.log(`${functionName} Executing DB query...`);
    const user = await userQuery;

    // 5. Check if user was found
    if (!user) {
      if (DEBUG_MODE) console.log(`${functionName} User with ID ${loggedInUserId} not found in DB (token might be for deleted user?).`);
      return res.status(404).json({ message: "User not found." });
    }
    if (DEBUG_MODE) console.log(`${functionName} User found successfully.`); // Be careful logging full user object

    // 6. Send response
    if (DEBUG_MODE) console.log(`${functionName} Sending 200 success response with user data.`);
    res.status(200).json({ user }); // User object now has email but excludes sensitive fields

  } catch (error) {
    if (DEBUG_MODE) console.error(`${functionName} Error caught in catch block:`, error);
    console.error("Get user profile error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};