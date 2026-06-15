import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Subject } from '../models/Subject';
import { ClassSession } from '../models/Session';
import { Attendance } from '../models/Attendance';
import { AppError } from '../utils/AppError';

/**
 * Faculty: per-student attendance summary for one subject.
 * Returns each enrolled student's present count, total sessions, and percentage.
 */
export async function subjectAnalytics(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.subjectId).populate(
    'students',
    'name email rollNumber'
  );
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) {
    throw new AppError('You do not own this subject', 403);
  }

  const totalSessions = await ClassSession.countDocuments({ subject: subject._id });

  const counts = await Attendance.aggregate<{ _id: Types.ObjectId; presentCount: number }>([
    { $match: { subject: subject._id } },
    { $group: { _id: '$student', presentCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.presentCount]));

  const students = (subject.students as unknown as Array<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    rollNumber?: string;
  }>).map((s) => {
    const present = countMap.get(String(s._id)) ?? 0;
    const percentage = totalSessions === 0 ? 0 : Math.round((present / totalSessions) * 100);
    return {
      studentId: String(s._id),
      name: s.name,
      email: s.email,
      rollNumber: s.rollNumber,
      presentCount: present,
      totalSessions,
      percentage,
    };
  });

  // Sort lowest attendance first - helps faculty spot at-risk students.
  students.sort((a, b) => a.percentage - b.percentage);

  const averagePercentage =
    students.length === 0
      ? 0
      : Math.round(students.reduce((sum, s) => sum + s.percentage, 0) / students.length);

  res.json({
    success: true,
    subject: { id: subject._id, name: subject.name, code: subject.code },
    totalSessions,
    totalStudents: students.length,
    averagePercentage,
    students,
  });
}

/**
 * Student: their own subject-wise attendance summary across all enrolled subjects.
 * This powers the student dashboard chart.
 */
export async function studentOverview(req: Request, res: Response): Promise<void> {
  const subjects = await Subject.find({ students: req.user!.id }).populate(
    'faculty',
    'name email'
  );

  const studentId = new Types.ObjectId(req.user!.id);
  const rows = await Promise.all(
    subjects.map(async (subject) => {
      const totalSessions = await ClassSession.countDocuments({ subject: subject._id });
      const presentCount = await Attendance.countDocuments({
        subject: subject._id,
        student: studentId,
      });
      const percentage = totalSessions === 0 ? 0 : Math.round((presentCount / totalSessions) * 100);
      return {
        subjectId: String(subject._id),
        name: subject.name,
        code: subject.code,
        faculty: (subject.faculty as unknown as { name: string }).name,
        presentCount,
        totalSessions,
        percentage,
      };
    })
  );

  const overall =
    rows.length === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length);

  res.json({ success: true, overallPercentage: overall, subjects: rows });
}

/** Student: detailed history for one subject. */
export async function studentSubjectHistory(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.subjectId);
  if (!subject) throw new AppError('Subject not found', 404);

  const isEnrolled = subject.students.some((id) => String(id) === req.user!.id);
  if (!isEnrolled) throw new AppError('You are not enrolled in this subject', 403);

  const sessions = await ClassSession.find({ subject: subject._id }).sort({ startedAt: -1 });
  const presentSessions = await Attendance.find({
    subject: subject._id,
    student: req.user!.id,
  }).select('session');
  const presentSet = new Set(presentSessions.map((p) => String(p.session)));

  const history = sessions.map((s) => ({
    sessionId: String(s._id),
    date: s.startedAt,
    topic: s.topic,
    present: presentSet.has(String(s._id)),
  }));

  res.json({
    success: true,
    subject: { id: subject._id, name: subject.name, code: subject.code },
    totalSessions: sessions.length,
    presentCount: presentSessions.length,
    percentage:
      sessions.length === 0 ? 0 : Math.round((presentSessions.length / sessions.length) * 100),
    history,
  });
}

/** Faculty: download per-student attendance for one subject as CSV. */
export async function exportSubjectCsv(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findById(req.params.subjectId).populate(
    'students',
    'name email rollNumber'
  );
  if (!subject) throw new AppError('Subject not found', 404);
  if (String(subject.faculty) !== req.user!.id) {
    throw new AppError('You do not own this subject', 403);
  }

  const totalSessions = await ClassSession.countDocuments({ subject: subject._id });
  const counts = await Attendance.aggregate<{ _id: Types.ObjectId; presentCount: number }>([
    { $match: { subject: subject._id } },
    { $group: { _id: '$student', presentCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.presentCount]));

  const header = ['Roll Number', 'Name', 'Email', 'Present', 'Total Sessions', 'Percentage'];
  const escape = (v: string | number | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = (subject.students as unknown as Array<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    rollNumber?: string;
  }>).map((s) => {
    const present = countMap.get(String(s._id)) ?? 0;
    const pct = totalSessions === 0 ? 0 : Math.round((present / totalSessions) * 100);
    return [s.rollNumber ?? '', s.name, s.email, present, totalSessions, `${pct}%`].map(escape).join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="attendance-${subject.code}-${Date.now()}.csv"`
  );
  res.send(csv);
}
