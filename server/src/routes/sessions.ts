import { Router } from 'express';
import {
  closeSession,
  getActiveSessionForSubject,
  getSessionRoster,
  getSessionTokens,
  listSessions,
  listSessionAttendance,
  markAttendance,
  markAttendanceSchema,
  startSession,
  startSessionSchema,
} from '../controllers/sessionController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.post('/', authorize('faculty'), validateBody(startSessionSchema), asyncHandler(startSession));
router.post('/:id/close', authorize('faculty'), asyncHandler(closeSession));

router.get(
  '/active/subject/:subjectId',
  authorize('faculty'),
  asyncHandler(getActiveSessionForSubject)
);
router.get('/subject/:subjectId', authorize('faculty'), asyncHandler(listSessions));

router.get('/:id/tokens', authorize('faculty'), asyncHandler(getSessionTokens));
router.get('/:id/roster', authorize('faculty'), asyncHandler(getSessionRoster));
router.get('/:id/attendance', asyncHandler(listSessionAttendance));

router.post(
  '/mark',
  authorize('student'),
  validateBody(markAttendanceSchema),
  asyncHandler(markAttendance)
);

export default router;
