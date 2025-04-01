import express from 'express';
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  renderResetPasswordForm,
  resetPassword
} from '../controllers/auth.controller.js'; // Adjust path as needed
import { verifyToken, getUserProfile } from '../controllers/auth.controller.js';
const router = express.Router();

// Define authentication routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', renderResetPasswordForm); // Optional: To show a form
router.post('/reset-password/:token', resetPassword);

router.get('/users/:userId', verifyToken, getUserProfile);
// Add protected route
router.get('/profile', verifyToken, getUserProfile);


export default router;