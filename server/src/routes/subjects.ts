import { Router } from 'express';
import {
  createSubject,
  createSubjectSchema,
  deleteSubject,
  enrollSchema,
  enrollStudents,
  getSubject,
  listMySubjects,
  removeStudent,
  updateSubject,
  updateSubjectSchema,
} from '../controllers/subjectController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listMySubjects));
router.get('/:id', asyncHandler(getSubject));

router.post('/', authorize('faculty'), validateBody(createSubjectSchema), asyncHandler(createSubject));
router.patch(
  '/:id',
  authorize('faculty'),
  validateBody(updateSubjectSchema),
  asyncHandler(updateSubject)
);
router.delete('/:id', authorize('faculty'), asyncHandler(deleteSubject));

router.post(
  '/:id/students',
  authorize('faculty'),
  validateBody(enrollSchema),
  asyncHandler(enrollStudents)
);
router.delete('/:id/students/:studentId', authorize('faculty'), asyncHandler(removeStudent));

export default router;
