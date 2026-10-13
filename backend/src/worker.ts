import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from './config/db.js';
import { defaultWorker } from './services/notificationWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

async function runWorker() {
  console.log('🚀 Starting CareConnect Background Notification Worker...');
  await connectDB();

  defaultWorker.start();

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down worker gracefully...`);
    await defaultWorker.stop();
    await disconnectDB();
    console.log('✅ Background worker stopped.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

runWorker().catch((err) => {
  console.error('❌ Worker startup failed:', err);
  process.exit(1);
});
