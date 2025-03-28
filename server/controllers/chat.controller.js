import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios'; // Import axios instead of OpenAI
import User from '../models/User.js';
import Chat from '../models/Chat.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// --- Encryption Setup --- (Remains the same)
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || '32characterslongsecretkey!!'; // Manage securely!
const ALGORITHM = 'aes-256-cbc';

function encryptData(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decryptData(encryptedData, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedData, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
}

// --- Pollinations API Configuration ---
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai"; // Define the target URL

// Authentication Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("Auth header missing or malformed");
      return res.status(401).json({ message: "Unauthorized: Missing token." });
    }
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      next();
    } catch (error) {
      console.error("Authentication error:", error.message);
      if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ message: "Unauthorized: Invalid token." });
      } else if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ message: "Unauthorized: Token expired." });
      }
      return res.status(401).json({ message: "Unauthorized" });
    }
};


// POST /chat/message
router.post('/message', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'Message is required and must be a non-empty string.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found for ID: ${userId}`);
      return res.status(404).json({ message: 'User not found.' });
    }

    let chat = await Chat.findOne({ userId });
    let messages = [];
    if (chat && chat.encryptedMessages && chat.iv) {
      try {
          messages = decryptData(chat.encryptedMessages, chat.iv);
      } catch (decryptError) {
          console.error(`Failed to decrypt chat history for user ${userId}:`, decryptError);
          messages = []; // Reset on error
          return res.status(500).json({ message: 'Failed to load chat history. Please try again.' });
      }
    }

    messages.push({ sender: 'user', text: message, timestamp: new Date() });

    const MAX_HISTORY_LENGTH = 20;
    if (messages.length > MAX_HISTORY_LENGTH) {
      messages = messages.slice(-MAX_HISTORY_LENGTH);
    }

    const chatMessages = messages.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));

    // --- Call the Pollinations API using axios ---
    const referrerIdentifier = process.env.APP_IDENTIFIER || "MyExpressApp";

    // Prepare the payload for the Pollinations API
    const payload = {
        model: process.env.POLLINATIONS_MODEL || "openai", // Use configured model or default
        messages: chatMessages,
        max_tokens: 150,
        temperature: 0.7,
        referrer: referrerIdentifier // Optional: identify your app
        // seed: 42, // Optional
        // private: false // Optional
    };

    console.log(`Sending request to Pollinations API: ${POLLINATIONS_API_URL}`);
    // console.log('Payload:', JSON.stringify(payload, null, 2)); // Debug: Log payload

    // Make the POST request directly using axios
    const response = await axios.post(POLLINATIONS_API_URL, payload, {
        headers: {
            'Content-Type': 'application/json'
            // No 'Authorization' header needed for the public Pollinations endpoint
        },
        timeout: 60000 // Optional: Set a timeout (e.g., 60 seconds)
    });

    // Extract the AI's response message from the axios response data
    // The structure should still follow the OpenAI Chat Completions format
    if (!response.data || !response.data.choices || response.data.choices.length === 0 || !response.data.choices[0].message || !response.data.choices[0].message.content) {
        console.error("Unexpected response format from Pollinations API:", response.data);
        throw new Error("Invalid response format received from AI service.");
    }
    const aiMessage = response.data.choices[0].message.content.trim();
    console.log(`Received AI message for user ${userId}: ${aiMessage.substring(0, 100)}...`); // Log preview


    // Append the AI's response to the conversation
    messages.push({ sender: 'ai', text: aiMessage, timestamp: new Date() });

    // Encrypt the updated conversation
    const { iv, encryptedData } = encryptData(messages);

    // Save the updated conversation history
    if (chat) {
      chat.encryptedMessages = encryptedData;
      chat.iv = iv;
      chat.updatedAt = new Date();
      await chat.save();
    } else {
      chat = new Chat({
        userId,
        encryptedMessages: encryptedData,
        iv,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await chat.save();
    }

    // Return the AI message to the client
    res.status(200).json({ message: aiMessage });

  } catch (error) {
    // Axios error handling is slightly different but similar structure
    if (axios.isAxiosError(error)) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error("Pollinations API Error Status:", error.response.status);
            console.error("Pollinations API Error Data:", error.response.data);
            // Try to forward the API's error message if available
            const apiErrorMessage = typeof error.response.data === 'string'
                ? error.response.data
                : error.response.data?.message || error.response.data?.error?.message || 'AI service error';
            res.status(error.response.status || 502).json({ message: apiErrorMessage });
        } else if (error.request) {
            // The request was made but no response was received
            console.error("Pollinations API No Response:", error.request);
            res.status(504).json({ message: 'AI service did not respond (timeout or network issue).' });
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Axios Setup Error:', error.message);
            res.status(500).json({ message: 'Internal error setting up AI request.' });
        }
    } else {
        // Handle non-Axios errors (DB, encryption, etc.)
        console.error("Chat message internal error:", error.message, error.stack);
        res.status(500).json({ message: 'Internal server error.' });
    }
  }
});

export default router;