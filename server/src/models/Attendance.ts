import { Schema, model, Document, Types } from 'mongoose';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  session: Types.ObjectId;
  subject: Types.ObjectId;
  student: Types.ObjectId;
  status: 'present';
  markedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>({
  session: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['present'], default: 'present' },
  markedAt: { type: Date, default: Date.now },
});

// One student can only have one attendance record per (session, subject).
// A multi-subject session creates several rows per student — one per subject.
attendanceSchema.index({ session: 1, student: 1, subject: 1 }, { unique: true });

export const Attendance = model<IAttendance>('Attendance', attendanceSchema);
