import { Router } from 'express';
import { login, me, register, registerSchema, loginSchema } from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', validateBody(registerSchema), asyncHandler(register));
router.post('/login', validateBody(loginSchema), asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));

export default router;
