import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Subject } from '../models/Subject';
import { ClassSession, ISession } from '../models/Session';
import { Attendance } from '../models/Attendance';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import {
  currentCode,
  currentQrToken,
  newSessionSecret,
  resolveCode,
  resolveQrToken,
  isValidCodeShape,
} from '../utils/sessionTokens';

export const startSessionSchema = z.object({
  // Multi-subject: faculty can run one combined session for several subjects.
  subjectIds: z.array(z.string().min(1)).min(1).max(10),
  topic: z.string().trim().max(200).optional(),
});

export const markAttendanceSchema = z.object({
  // Either a rotating QR token (with dots) or a 6-char short code.
  code: z.string().min(4).max(200),
});

/**
 * Helper: load a faculty-owned subject set in one query and assert ownership.
 */
async function loadOwnedSubjects(subjectIds: string[], facultyId: string) {
  const ids = subjectIds.map((id) => new Types.ObjectId(id));
  const subjects = await Subject.find({ _id: { $in: ids } });
  if (subjects.length !== subjectIds.length) {
    throw new AppError('One or more subjects were not found', 404);
  }
  const notOwned = subjects.filter((s) => String(s.faculty) !== facultyId);
  if (notOwned.length > 0) {
    throw new AppError('You do not own all of the selected subjects', 403);
  }
  return subjects;
}

/**
 * Faculty: start an attendance session covering one or more subjects.
 *
 * Behaviour notes:
 *  - The session has no fixed expiry - it stays open until faculty closes it.
 *  - If an active session ALREADY covers the same exact subject set, we reuse
 *    it (prevents accidental duplicates on double-click).
 *  - If a different active session already covers any of these subjects we
 *    reject so the faculty closes the old one first - avoids ambiguity.
 */
export async function startSession(req: Request, res: Response): Promise<void> {
  const { subjectIds, topic } = req.body as z.infer<typeof startSessionSchema>;

  const subjects = await loadOwnedSubjects(subjectIds, req.user!.id);
  const subjectObjectIds = subjects.map((s) => s._id);

  const conflicting = await ClassSession.find({
    subjects: { $in: subjectObjectIds },
    closedAt: { $exists: false },
  });

  const requestedSet = new Set(subjectIds.map((id) => String(id)));
  const exactMatch = conflicting.find((s) => {
    if (s.subjects.length !== requestedSet.size) return false;
    return s.subjects.every((id) => requestedSet.has(String(id)));
  });
  if (exactMatch) {
    res.json({ success: true, session: exactMatch, reused: true });
    return;
  }
  if (conflicting.length > 0) {
    throw new AppError(
      'Another active session already covers one of these subjects. Close it before starting a new one.',
      409
    );
  }

  const session = await ClassSession.create({
    subjects: subjectObjectIds,
    faculty: req.user!.id,
    secret: newSessionSecret(),
    topic,
  });

  res.status(201).json({ success: true, session });
}

/** Faculty: explicitly close a session. */
export async function closeSession(req: Request, res: Response): Promise<void> {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  if (String(session.faculty) !== req.user!.id) {
    throw new AppError('You do not own this session', 403);
  }
  if (session.closedAt) {
    res.json({ success: true, session });
    return;
  }
  // Use a direct update so we don't re-run schema validation on docs that
  // may have legacy fields (this lets us cleanly close sessions written by
  // an older revision of the schema).
  const closedAt = new Date();
  await ClassSession.updateOne({ _id: session._id }, { $set: { closedAt } });
  session.closedAt = closedAt;
  res.json({ success: true, session });
}

/**
 * Faculty: returns the currently-active session (if any) that covers the given
 * subject. Used by the subject detail page to resume the live view on refresh.
 */
export async function getActiveSessionForSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.subjectId);
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) {
    throw new AppError('You do not own this subject', 403);
  }

  const session = await ClassSession.findOne({
    subjects: subject._id,
    closedAt: { $exists: false },
  }).populate('subjects', 'name code');

  res.json({ success: true, session: session ?? null });
}

/**
 * Faculty: returns the current rotating QR token and short code for an active
 * session, along with each one's `rotatesAt` so the UI can show a countdown
 * and re-fetch when needed.
 */
export async function getSessionTokens(req: Request, res: Response): Promise<void> {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  if (String(session.faculty) !== req.user!.id) {
    throw new AppError('You do not own this session', 403);
  }
  if (session.closedAt) throw new AppError('This session is closed', 410);

  const qr = currentQrToken(session);
  const code = currentCode(session);
  const qrDataUrl = await QRCode.toDataURL(qr.token);

  res.json({
    success: true,
    qr: { token: qr.token, qrDataUrl, rotatesAt: qr.rotatesAt },
    code: { value: code.value, rotatesAt: code.rotatesAt },
  });
}

/** Faculty: list recent sessions for one of their subjects, with present counts. */
export async function listSessions(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.subjectId);
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) {
    throw new AppError('You do not own this subject', 403);
  }

  const sessions = await ClassSession.find({ subjects: subject._id })
    .sort({ startedAt: -1 })
    .limit(50)
    .populate('subjects', 'name code')
    .lean();

  const sessionIds = sessions.map((s) => s._id);
  // Count is scoped to THIS subject so multi-subject sessions stay accurate.
  const counts = await Attendance.aggregate([
    { $match: { session: { $in: sessionIds }, subject: subject._id } },
    { $group: { _id: '$session', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count as number]));

  const enriched = sessions.map((s) => ({
    ...s,
    presentCount: countMap.get(String(s._id)) ?? 0,
    totalStudents: subject.students.length,
  }));

  res.json({ success: true, count: enriched.length, sessions: enriched });
}

/**
 * Student: submit either a rotating QR token or a 6-char short code to mark
 * attendance. For a multi-subject session this creates one row per enrolled
 * subject. Idempotent: re-submitting is a no-op.
 */
export async function markAttendance(req: Request, res: Response): Promise<void> {
  const { code: rawInput } = req.body as z.infer<typeof markAttendanceSchema>;

  // Pick the resolver based on shape: dotted = QR token, otherwise short code.
  const session: ISession | null = rawInput.includes('.')
    ? await resolveQrToken(rawInput)
    : isValidCodeShape(rawInput.trim().toUpperCase())
    ? await resolveCode(rawInput)
    : null;

  if (!session) throw new AppError('Invalid or expired attendance code', 404);
  if (session.closedAt) throw new AppError('This attendance session is closed', 410);

  const subjects = await Subject.find({ _id: { $in: session.subjects } });
  const enrolledSubjects = subjects.filter((s) =>
    s.students.some((id) => String(id) === req.user!.id)
  );
  if (enrolledSubjects.length === 0) {
    throw new AppError('You are not enrolled in any subject of this session', 403);
  }

  const docs = enrolledSubjects.map((s) => ({
    session: session._id,
    subject: s._id,
    student: req.user!.id,
  }));

  let inserted = 0;
  try {
    const result = await Attendance.insertMany(docs, { ordered: false });
    inserted = result.length;
  } catch (err: unknown) {
    const e = err as { writeErrors?: unknown[]; insertedDocs?: unknown[]; code?: number };
    if (Array.isArray(e.insertedDocs)) inserted = e.insertedDocs.length;
    const hasNonDupError =
      Array.isArray(e.writeErrors) &&
      e.writeErrors.some((w) => (w as { err?: { code?: number } }).err?.code !== 11000);
    if (hasNonDupError) throw err;
  }

  res.status(inserted > 0 ? 201 : 200).json({
    success: true,
    inserted,
    alreadyMarked: inserted === 0,
    subjects: enrolledSubjects.map((s) => ({ id: s._id, name: s.name, code: s.code })),
  });
}

/** Faculty or student: list attendance records for a session (per-subject). */
export async function listSessionAttendance(req: Request, res: Response): Promise<void> {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);

  if (req.user!.role === 'faculty' && String(session.faculty) !== req.user!.id) {
    throw new AppError('You do not own this session', 403);
  }

  const records = await Attendance.find({ session: session._id })
    .populate('student', 'name email rollNumber')
    .populate('subject', 'name code')
    .sort({ markedAt: 1 });

  res.json({ success: true, count: records.length, records });
}

/**
 * Faculty: full present/absent roster for a session, broken down per subject.
 * For each subject covered by the session, returns every enrolled student
 * flagged present or absent (with `markedAt` if present).
 */
export async function getSessionRoster(req: Request, res: Response): Promise<void> {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  if (String(session.faculty) !== req.user!.id) {
    throw new AppError('You do not own this session', 403);
  }

  const subjects = await Subject.find({ _id: { $in: session.subjects } });

  // Load all unique enrolled students across covered subjects in one query.
  const allStudentIds = new Set<string>();
  subjects.forEach((s) => s.students.forEach((id) => allStudentIds.add(String(id))));
  const users = await User.find({ _id: { $in: Array.from(allStudentIds) } })
    .select('name email rollNumber')
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const attendance = await Attendance.find({ session: session._id }).select(
    'student subject markedAt'
  );
  const presentKey = (studentId: string, subjectId: string) => `${studentId}|${subjectId}`;
  const presentMap = new Map<string, Date>(
    attendance.map((a) => [presentKey(String(a.student), String(a.subject)), a.markedAt])
  );

  const perSubject = subjects.map((subject) => {
    const subjectId = String(subject._id);
    const students = subject.students
      .map((id) => userMap.get(String(id)))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => {
        const markedAt = presentMap.get(presentKey(String(u._id), subjectId));
        return {
          studentId: String(u._id),
          name: u.name,
          email: u.email,
          rollNumber: u.rollNumber,
          present: Boolean(markedAt),
          markedAt: markedAt ?? null,
        };
      })
      // Present first, then alphabetical roll number for easy scanning.
      .sort((a, b) => {
        if (a.present !== b.present) return a.present ? -1 : 1;
        return (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '');
      });

    const presentCount = students.filter((s) => s.present).length;
    return {
      subject: { id: subjectId, name: subject.name, code: subject.code },
      totalStudents: students.length,
      presentCount,
      absentCount: students.length - presentCount,
      students,
    };
  });

  res.json({
    success: true,
    session: {
      id: String(session._id),
      startedAt: session.startedAt,
      closedAt: session.closedAt,
      topic: session.topic,
      isActive: !session.closedAt,
    },
    perSubject,
  });
}
