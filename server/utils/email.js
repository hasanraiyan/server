import nodemailer from 'nodemailer';

// TODO: Configure Nodemailer with your email service credentials
const transporter = nodemailer.createTransport({
  service: 'gmail', // Example: Gmail, SendGrid, Mailgun, etc.
  auth: {
    user: process.env.EMAIL_USER || "dostify.climb@gmail.com", // Use environment variables
    pass: process.env.EMAIL_PASS || "issa nwwf inaz lvfr",
  },
});

// Function to send a verification email
export const sendVerificationEmail = async (email, verificationLink) => {
  try {
    if (process.env.SEND_EMAILS === 'true') {
      await transporter.sendMail({
        to: email,
        subject: 'Verify Your Email Address',
        html: `Please click this link to verify your email: <a href="${verificationLink}">${verificationLink}</a>`,
      });
      console.log(`Verification email sent to ${email}`);
    } else {
      console.log('Email sending is disabled in the current environment.');
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error; // Re-throw to be handled in the controller
  }
};

// Function to send a password reset email
export const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    if (process.env.SEND_EMAILS === 'true') {
      await transporter.sendMail({
        to: email,
        subject: 'Password Reset Request',
        html: `Please click this link to reset your password: <a href="${resetLink}">${resetLink}</a>`,
      });
      console.log(`Password reset email sent to ${email}`);
    } else {
      console.log('Email sending is disabled in the current environment.');
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error; // Re-throw to be handled in the controller
  }
};
