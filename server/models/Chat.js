import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  encryptedMessages: { type: String, required: true },
  iv: { type: String, required: true }
}, { timestamps: true });

const Chat = mongoose.model('Chat', ChatSchema);

export default Chat;
