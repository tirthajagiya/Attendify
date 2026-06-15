/**
 * Seeds the database with a faculty user, a couple of students, and one subject
 * so the app is demo-ready out of the box. Safe to re-run.
 *
 * Usage: npm run seed
 */
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Subject } from '../models/Subject';
import mongoose from 'mongoose';

async function upsertUser(opts: {
  name: string;
  email: string;
  password: string;
  role: 'faculty' | 'student';
  rollNumber?: string;
  department?: string;
}) {
  const existing = await User.findOne({ email: opts.email });
  if (existing) return existing;
  return User.create(opts);
}

async function run(): Promise<void> {
  await connectDB();

  const faculty = await upsertUser({
    name: 'Dr. Asha Iyer',
    email: 'faculty@attendify.dev',
    password: 'password123',
    role: 'faculty',
    department: 'Computer Science',
  });

  const studentSeeds = [
    { name: 'Rahul Sharma', email: 'rahul@attendify.dev', rollNumber: 'CS2101' },
    { name: 'Priya Patel', email: 'priya@attendify.dev', rollNumber: 'CS2102' },
    { name: 'Aman Verma', email: 'aman@attendify.dev', rollNumber: 'CS2103' },
  ];

  const students = await Promise.all(
    studentSeeds.map((s) =>
      upsertUser({ ...s, password: 'password123', role: 'student', department: 'Computer Science' })
    )
  );

  let subject = await Subject.findOne({ faculty: faculty._id, code: 'CS301' });
  if (!subject) {
    subject = await Subject.create({
      name: 'Database Management Systems',
      code: 'CS301',
      faculty: faculty._id,
      department: 'Computer Science',
      semester: 5,
      students: students.map((s) => s._id),
    });
  } else {
    const existingIds = new Set(subject.students.map((id) => String(id)));
    for (const s of students) {
      if (!existingIds.has(String(s._id))) subject.students.push(s._id);
    }
    await subject.save();
  }

  console.log('\nSeed complete!');
  console.log('  Faculty -> faculty@attendify.dev / password123');
  console.log('  Students -> rahul@/priya@/aman@attendify.dev / password123');
  console.log(`  Subject -> ${subject.code} ${subject.name}\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
