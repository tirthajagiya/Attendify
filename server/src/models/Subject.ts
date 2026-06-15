import { Schema, model, Document, Types } from 'mongoose';

export interface ISubject extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  faculty: Types.ObjectId;
  students: Types.ObjectId[];
  department?: string;
  semester?: number;
  createdAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    faculty: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    department: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 12 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A faculty cannot have two subjects with the same code.
subjectSchema.index({ faculty: 1, code: 1 }, { unique: true });

export const Subject = model<ISubject>('Subject', subjectSchema);
