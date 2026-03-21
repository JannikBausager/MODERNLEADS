import express, { type Request, type Response, type NextFunction } from 'express';
import type { Router as RouterType } from 'express';
import leadsRouter from './routes/leads.js';
import interactionsRouter from './routes/interactions.js';
import opportunitiesRouter from './routes/opportunities.js';
import agentRouter from './routes/agent.js';
import settingsRouter from './routes/settings.js';
import bcRouter from './routes/bc.js';
import authRouter from './routes/auth.js';
import linkedinRouter from './routes/linkedin.js';
import statsRouter from './routes/stats.js';

export const app: ReturnType<typeof express> = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/leads', leadsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/agent', agentRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/bc', bcRouter);
app.use('/api/auth', authRouter);
app.use('/api/linkedin', linkedinRouter);
app.use('/api/stats', statsRouter);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' },
  });
});
