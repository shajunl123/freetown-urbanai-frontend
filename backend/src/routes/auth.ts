import { Router } from 'express';
import { loginWithPassword, revokeToken } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const session = loginWithPassword(email, password);
  if (!session) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.json(session);
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', requireAuth, (req, res) => {
  if (req.authToken) revokeToken(req.authToken);
  res.json({ ok: true });
});

export default router;
