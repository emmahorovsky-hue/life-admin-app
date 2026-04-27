import express from 'express';
import { getCategories } from '../controllers/categoryController';

const router = express.Router();

// GET /api/categories (public endpoint, no auth required)
router.get('/', getCategories);

export default router;
