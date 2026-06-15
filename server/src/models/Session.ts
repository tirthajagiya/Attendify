import { Schema, model, Document, Types } from 'mongoose';

/**
 * A ClassSession is one period for which attendance is being collected. Faculty
 * starts it and ends it manually - there is no fixed expiry, so the session
 * stays "active" until `closedAt` is set.
 *
 * Anti-fraud design: instead of one fixed code, the session stores a `secret`
 * from which BOTH the QR token and a short typeable code are derived via HMAC
 * and a time bucket (TOTP-style). The displayed values rotate independently:
 *   - QR token       -> rotates every 15 seconds
 *   - Short code     -> rotates every 30 seconds
 * A screenshot or forwarded code becomes useless very quickly.
 */
export interface ISession extends Document {
  _id: Types.ObjectId;
  subjects: Types.ObjectId[];
  faculty: Types.ObjectId;
  /** Hex-encoded HMAC secret unique to this session. */
  secret: string;
  topic?: string;
  startedAt: Date;
  closedAt?: Date;
}

const sessionSchema = new Schema<ISession>({
  subjects: [{ type: Schema.Types.ObjectId, ref: 'Subject', required: true }],
  faculty: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  secret: { type: String, required: true },
  topic: { type: String, trim: true },
  startedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
});

// Query helper: list sessions covering a given subject (uses the array index).
sessionSchema.index({ subjects: 1, startedAt: -1 });
// Speeds up "is there an active session?" lookups.
sessionSchema.index({ closedAt: 1, faculty: 1 });

sessionSchema.virtual('isActive').get(function getIsActive(this: ISession) {
  return !this.closedAt;
});

sessionSchema.set('toJSON', { virtuals: true });

export const ClassSession = model<ISession>('ClassSession', sessionSchema);
