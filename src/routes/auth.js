import express from 'express';
const router = express.Router();
import { localAuth } from '../middleware/auth.js';
import authService from '../utils/authService.js';

router.post('/login', localAuth, async (req, res) => {
  try {
    if (req.user.status === 'غیرفعال') {
      return res.status(403).json({ message: 'Account is inactive' });
    }
    const result = await authService.login(req.user);
    res.json({ ...result, role: req.user.role, userId: req.user.id });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

export default router;