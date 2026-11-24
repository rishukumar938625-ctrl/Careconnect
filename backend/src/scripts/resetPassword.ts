/**
 * CareConnect Password Reset CLI Utility
 *
 * Securely updates a user's password in MongoDB Atlas with a cost-factor-12 bcrypt hash.
 * Preserves all patient health records, emergency contacts, appointments, and preferences.
 *
 * Usage:
 *   npx tsx src/scripts/resetPassword.ts <email> <newPassword>
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

async function resetPassword() {
  const args = process.argv.slice(2);
  const emailArg = args[0];
  const passwordArg = args[1];

  if (!emailArg || !passwordArg) {
    console.error('❌ Usage: npx tsx src/scripts/resetPassword.ts <email> <newPassword>');
    process.exit(1);
  }

  const normalizedEmail = emailArg.trim().toLowerCase();

  if (passwordArg.length < 8) {
    console.error('❌ Password must be at least 8 characters long.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log(`🔌 Connected to MongoDB database`);

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      console.error(`❌ No user account found with email: "${normalizedEmail}"`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(passwordArg, salt);

    user.passwordHash = passwordHash;
    await user.save();

    console.log(`✅ Successfully updated password for user "${normalizedEmail}" (id: ${user._id})`);
    console.log(`🔒 Password securely hashed with bcrypt (cost factor 12).`);
  } catch (error) {
    console.error('❌ Failed to update password:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

resetPassword();
