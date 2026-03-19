import { Router, type Router as RouterType } from 'express';
import { listOpportunities } from '../db/repository.js';

const router: RouterType = Router();

// GET / — list all opportunities
router.get('/', (_req, res) => {
  const opportunities = listOpportunities();
  res.json(opportunities);
});

export default router;
