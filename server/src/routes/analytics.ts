import { Router } from 'express';
import {
  exportSubjectCsv,
  studentOverview,
  studentSubjectHistory,
  subjectAnalytics,
} from '../controllers/analyticsController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Faculty analytics
router.get('/subjects/:subjectId', authorize('faculty'), asyncHandler(subjectAnalytics));
router.get('/subjects/:subjectId/export', authorize('faculty'), asyncHandler(exportSubjectCsv));

// Student analytics
router.get('/me/overview', authorize('student'), asyncHandler(studentOverview));
router.get('/me/subjects/:subjectId', authorize('student'), asyncHandler(studentSubjectHistory));

export default router;
