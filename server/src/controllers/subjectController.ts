import { Request, Response } from 'express';
import { z } from 'zod';
import { Subject } from '../models/Subject';
import { User } from '../models/User';
import { ClassSession } from '../models/Session';
import { Attendance } from '../models/Attendance';
import { AppError } from '../utils/AppError';

export const createSubjectSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  department: z.string().optional(),
  semester: z.number().int().min(1).max(12).optional(),
});

// Every field is optional - faculty may want to rename, change code, etc.
export const updateSubjectSchema = z
  .object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).max(20).optional(),
    department: z.string().optional(),
    semester: z.number().int().min(1).max(12).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const enrollSchema = z.object({
  // Either pass a list of emails or roll numbers. Whichever resolves wins.
  emails: z.array(z.string().email()).optional(),
  rollNumbers: z.array(z.string()).optional(),
});

/** Faculty: create a new subject under their own account. */
export async function createSubject(req: Request, res: Response): Promise<void> {
  const { name, code, department, semester } = req.body as z.infer<typeof createSubjectSchema>;

  const subject = await Subject.create({
    name,
    code,
    department,
    semester,
    faculty: req.user!.id,
    students: [],
  });

  res.status(201).json({ success: true, subject });
}

/** Faculty: list subjects they own. Student: list subjects they are enrolled in. */
export async function listMySubjects(req: Request, res: Response): Promise<void> {
  const filter =
    req.user!.role === 'faculty' ? { faculty: req.user!.id } : { students: req.user!.id };

  const subjects = await Subject.find(filter)
    .populate('faculty', 'name email')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: subjects.length, subjects });
}

/** Faculty: subject details including student roster. Students get a slim view. */
export async function getSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.id)
    .populate('faculty', 'name email')
    .populate('students', 'name email rollNumber department');

  if (!subject) throw new AppError('Subject not found', 404);

  const isOwner = String(subject.faculty._id ?? subject.faculty) === req.user!.id;
  const isEnrolled = subject.students.some((s) => String((s as { _id: unknown })._id ?? s) === req.user!.id);

  if (req.user!.role === 'faculty' && !isOwner) {
    throw new AppError('You do not own this subject', 403);
  }
  if (req.user!.role === 'student' && !isEnrolled) {
    throw new AppError('You are not enrolled in this subject', 403);
  }

  res.json({ success: true, subject });
}

/** Faculty: enroll students by email or roll number. */
export async function enrollStudents(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) throw new AppError('You do not own this subject', 403);

  const { emails = [], rollNumbers = [] } = req.body as z.infer<typeof enrollSchema>;
  if (emails.length === 0 && rollNumbers.length === 0) {
    throw new AppError('Provide emails or rollNumbers to enroll', 400);
  }

  const students = await User.find({
    role: 'student',
    $or: [{ email: { $in: emails } }, { rollNumber: { $in: rollNumbers } }],
  }).select('_id name email rollNumber');

  if (students.length === 0) throw new AppError('No matching students found', 404);

  const existingIds = new Set(subject.students.map((id) => String(id)));
  const added: typeof students = [];
  for (const s of students) {
    const id = String(s._id);
    if (!existingIds.has(id)) {
      subject.students.push(s._id);
      added.push(s);
    }
  }
  await subject.save();

  res.json({ success: true, addedCount: added.length, added });
}

/** Faculty: update editable fields of a subject they own. */
export async function updateSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) {
    throw new AppError('You do not own this subject', 403);
  }

  const updates = req.body as z.infer<typeof updateSubjectSchema>;
  if (updates.name !== undefined) subject.name = updates.name;
  if (updates.code !== undefined) subject.code = updates.code.toUpperCase();
  if (updates.department !== undefined) subject.department = updates.department;
  if (updates.semester !== undefined) subject.semester = updates.semester;

  try {
    await subject.save();
  } catch (err: unknown) {
    if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
      throw new AppError('You already have another subject with this code', 409);
    }
    throw err;
  }
  res.json({ success: true, subject });
}

/**
 * Faculty: delete a subject and cascade-delete all attendance + any sessions
 * that exclusively belonged to it. Sessions covering multiple subjects only
 * have this subject removed from their `subjects` array (and are deleted if
 * the array becomes empty).
 */
export async function deleteSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) {
    throw new AppError('You do not own this subject', 403);
  }

  await Attendance.deleteMany({ subject: subject._id });
  await ClassSession.updateMany(
    { subjects: subject._id },
    { $pull: { subjects: subject._id } }
  );
  await ClassSession.deleteMany({ subjects: { $size: 0 } });
  await subject.deleteOne();

  res.json({ success: true });
}

/** Faculty: remove a student from the roster. */
export async function removeStudent(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) throw new AppError('You do not own this subject', 403);

  subject.students = subject.students.filter((id) => String(id) !== req.params.studentId);
  await subject.save();

  res.json({ success: true });
}
