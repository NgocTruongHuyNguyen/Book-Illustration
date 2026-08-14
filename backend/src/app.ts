import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/authRoute.js';
import { projectsRouter } from './routes/project.js';
import { requireUser } from './routes/middleware/requireUser.js';
import path from 'node:path';
import { getDataDir } from './storage/config.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); 
app.use('/images', express.static(path.join(getDataDir(), 'images')));
app.use('/', authRouter)
app.use('/auth', authRouter);
app.use('/projects', requireUser, projectsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});