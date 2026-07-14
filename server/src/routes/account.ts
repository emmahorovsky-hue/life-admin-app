import express from 'express';
import { uploadAvatar, getAvatar, deleteAvatar } from '../controllers/accountController';
import { authenticateToken } from '../middleware/auth';
import { avatarUpload, avatarUploadRateLimit } from '../middleware/avatarUpload';

const router = express.Router();

// Self-only avatar endpoints: the id always comes from the auth token, never
// the URL, so one user can never read or write another's avatar.
router.post('/avatar', authenticateToken, avatarUploadRateLimit, avatarUpload, uploadAvatar);
router.get('/avatar', authenticateToken, getAvatar);
router.delete('/avatar', authenticateToken, deleteAvatar);

export default router;
