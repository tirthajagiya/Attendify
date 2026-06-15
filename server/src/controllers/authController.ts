import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { signToken } from '../utils/jwt';

export const registerSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['faculty', 'student']),
    rollNumber: z.string().trim().optional(),
    department: z.string().trim().optional(),
  })
  .refine((d) => d.role !== 'student' || !!d.rollNumber, {
    message: 'rollNumber is required for students',
    path: ['rollNumber'],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function toPublicUser(user: { _id: unknown; name: string; email: string; role: string; rollNumber?: string; department?: string }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    rollNumber: user.rollNumber,
    department: user.department,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, role, rollNumber, department } = req.body as z.infer<
    typeof registerSchema
  >;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 409);

  const user = await User.create({ name, email, password, role, rollNumber, department });
  const token = signToken({ id: String(user._id), role: user.role });

  res.status(201).json({ success: true, token, user: toPublicUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const token = signToken({ id: String(user._id), role: user.role });
  res.json({ success: true, token, user: toPublicUser(user) });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, user: toPublicUser(user) });
}
