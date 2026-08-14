import express from 'express';
import { authRouter } from './routes/authRoute.js';
import { projectsRouter } from './routes/project.js';
import { requireUser } from './routes/middleware/requireUser.js';

export const app = express();

app.use(express.json({ limit: '5mb' })); 
app.use('/auth', authRouter);
app.use('/projects', requireUser, projectsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});