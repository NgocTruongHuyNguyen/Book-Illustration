import { Router } from 'express';
import { signIn } from '../services/authService.js';

export const authRouter = Router();

authRouter.post('/signin', async (req, res) => {
  const { email, name } = req.body ?? {};

  if (typeof email !== 'string' || !email.includes('@') || email.trim() === '') {
    res.status(400).json({ error: 'A valid email is required.' });
    return;
  }
  if (typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'A name is required.' });
    return;
  }

  try {
    const user = await signIn(email, name);
    res.status(200).json({ user });
  } catch (err) {
    console.error('signin failed', err);
    res.status(500).json({ error: 'Something went wrong signing in.' });
  }
});