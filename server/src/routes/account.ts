import express from 'express';
import { body } from 'express-validator';
import { uploadAvatar, getAvatar, deleteAvatar, deleteAccount } from '../controllers/accountController';
import { authenticateToken } from '../middleware/auth';
import { avatarUpload, avatarUploadRateLimit } from '../middleware/avatarUpload';
import { createApiLimiter } from '../middleware/rateLimit';

const router = express.Router();

// Self-only avatar endpoints: the id always comes from the auth token, never
// the URL, so one user can never read or write another's avatar.
router.post('/avatar', authenticateToken, avatarUploadRateLimit, avatarUpload, uploadAvatar);
router.get('/avatar', authenticateToken, getAvatar);
router.delete('/avatar', authenticateToken, deleteAvatar);

// Tight limiter: password re-auth below makes this endpoint a brute-force
// oracle, so cap attempts like the auth endpoints do (5 / 15 min).
const deleteAccountLimiter = createApiLimiter({ max: 5 });

// DELETE /api/account — permanently delete the authenticated user's account.
router.delete(
  '/',
  authenticateToken,
  deleteAccountLimiter,
  [body('password').isString().notEmpty().withMessage('Current password is required')],
  deleteAccount
);

export default router;
