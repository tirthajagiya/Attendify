import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env';
import { Attendance } from '../models/Attendance';
import { ClassSession } from '../models/Session';

// Many home/corporate routers strip DNS SRV records, which breaks `mongodb+srv://`
// (it does a SRV lookup to discover replica set members). Forcing Node to use
// Google + Cloudflare DNS sidesteps the issue without requiring the user to
// change OS-level DNS settings.
dns.setServers(['8.8.8.8', '1.1.1.1']);

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`[db] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  // The Attendance uniqueness rule changed from (session, student) to
  // (session, student, subject) to support multi-subject sessions. If a stale
  // copy of the old index exists in the database it would block legitimate
  // inserts, so drop it best-effort on boot.
  // Best-effort drops of indexes from earlier schema revisions.
  const staleIndexes: Array<[mongoose.Model<unknown>, string]> = [
    [Attendance as unknown as mongoose.Model<unknown>, 'session_1_student_1'],
    [ClassSession as unknown as mongoose.Model<unknown>, 'code_1'],
  ];
  for (const [Model, indexName] of staleIndexes) {
    try {
      await Model.collection.dropIndex(indexName);
      console.log(`[db] dropped stale index ${Model.modelName}.${indexName}`);
    } catch {
      // Index doesn't exist (fresh DB / already dropped) - safe to ignore.
    }
  }
  await Attendance.syncIndexes();
  await ClassSession.syncIndexes();

  // Sessions created before the rotating-token refactor have no `secret` and
  // can't produce valid QR/Code tokens. Drop them so they don't show up as
  // ghost "active" sessions blocking new ones.
  const legacy = await ClassSession.collection.deleteMany({
    $or: [{ secret: { $exists: false } }, { secret: null }],
  });
  if (legacy.deletedCount > 0) {
    console.log(`[db] removed ${legacy.deletedCount} legacy session(s) without secret`);
  }
}
