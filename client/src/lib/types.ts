export type UserRole = 'faculty' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  rollNumber?: string;
  department?: string;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  department?: string;
  semester?: number;
  faculty: { _id?: string; name: string; email?: string } | string;
  students: Array<{ _id: string; name: string; email: string; rollNumber?: string }> | string[];
  createdAt?: string;
}

export interface SessionSubjectRef {
  _id: string;
  name: string;
  code: string;
}

export interface ClassSession {
  _id: string;
  // Populated from API as objects; falls back to ID strings if not populated.
  subjects: SessionSubjectRef[] | string[];
  topic?: string;
  startedAt: string;
  closedAt?: string;
  isActive?: boolean;
  presentCount?: number;
  totalStudents?: number;
}

export interface SessionTokens {
  qr: { token: string; qrDataUrl: string; rotatesAt: string };
  code: { value: string; rotatesAt: string };
}

export interface SessionRosterEntry {
  studentId: string;
  name: string;
  email: string;
  rollNumber?: string;
  present: boolean;
  markedAt: string | null;
}

export interface SessionRoster {
  session: {
    id: string;
    startedAt: string;
    closedAt?: string;
    topic?: string;
    isActive: boolean;
  };
  perSubject: Array<{
    subject: { id: string; name: string; code: string };
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    students: SessionRosterEntry[];
  }>;
}

export interface AttendanceRecord {
  _id: string;
  student: { _id: string; name: string; email: string; rollNumber?: string };
  markedAt: string;
}

export interface SubjectAnalyticsRow {
  studentId: string;
  name: string;
  email: string;
  rollNumber?: string;
  presentCount: number;
  totalSessions: number;
  percentage: number;
}

export interface SubjectAnalytics {
  subject: { id: string; name: string; code: string };
  totalSessions: number;
  totalStudents: number;
  averagePercentage: number;
  students: SubjectAnalyticsRow[];
}

export interface StudentSubjectSummary {
  subjectId: string;
  name: string;
  code: string;
  faculty: string;
  presentCount: number;
  totalSessions: number;
  percentage: number;
}

export interface StudentOverview {
  overallPercentage: number;
  subjects: StudentSubjectSummary[];
}

export interface StudentSubjectHistory {
  subject: { id: string; name: string; code: string };
  totalSessions: number;
  presentCount: number;
  percentage: number;
  history: Array<{ sessionId: string; date: string; topic?: string; present: boolean }>;
}
