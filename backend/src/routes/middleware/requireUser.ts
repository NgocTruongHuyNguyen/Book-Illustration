import type { Request, Response, NextFunction } from 'express';
import { normaliseEmail } from '../../services/normaliseEmail.js';
import { readUser } from '../../storage/userStorage.js';

declare global {
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.header('x-user-email');

  if (!header) {
    res.status(401).json({ error: 'Missing x-user-email header.' });
    return;
  }

  const email = normaliseEmail(header);
  const user = await readUser(email);

  if (!user) {
    res.status(401).json({ error: 'No user found for that email. Sign in first.' });
    return;
  }

  req.userEmail = email;
  next();
}