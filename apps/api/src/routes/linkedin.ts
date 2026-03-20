import { Router, type Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import {
  getLinkedInSettings,
  setLinkedInSettings,
  getLinkedInScoringRules,
  upsertLinkedInScoringRule,
  deleteLinkedInScoringRule,
  resetLinkedInScoringDefaults,
} from '../db/repository.js';

const router: RouterType = Router();

// GET /settings — get LinkedIn connection settings (masked)
router.get('/settings', (_req, res) => {
  res.json(getLinkedInSettings());
});

// PUT /settings — update LinkedIn settings
router.put('/settings', (req, res) => {
  const { clientId, clientSecret, redirectUri, accessToken, enabled } = req.body;
  const result = setLinkedInSettings({ clientId, clientSecret, redirectUri, accessToken, enabled });
  res.json(result);
});

// GET /scoring-rules — get all scoring rules
router.get('/scoring-rules', (_req, res) => {
  res.json(getLinkedInScoringRules());
});

// PUT /scoring-rules/:id — update a single rule
router.put('/scoring-rules/:id', (req, res) => {
  const { id } = req.params;
  const { category, signal, description, score, enabled } = req.body;
  if (!category || !signal || !description || score === undefined) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: category, signal, description, score' } });
    return;
  }
  const rule = upsertLinkedInScoringRule({ id, category, signal, description, score, enabled });
  res.json(rule);
});

// POST /scoring-rules — create a custom rule
router.post('/scoring-rules', (req, res) => {
  const { category, signal, description, score } = req.body;
  if (!category || !signal || !description || score === undefined) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: category, signal, description, score' } });
    return;
  }
  const id = `custom_${uuid().replace(/-/g, '').slice(0, 12)}`;
  const rule = upsertLinkedInScoringRule({ id, category, signal, description, score, enabled: 1, isDefault: 0 });
  res.status(201).json(rule);
});

// DELETE /scoring-rules/:id — delete custom rule (not defaults)
router.delete('/scoring-rules/:id', (req, res) => {
  const deleted = deleteLinkedInScoringRule(req.params.id);
  if (!deleted) {
    res.status(400).json({ error: { code: 'CANNOT_DELETE', message: 'Cannot delete default rules. Disable them instead.' } });
    return;
  }
  res.json({ success: true });
});

// POST /scoring-rules/reset — reset to defaults
router.post('/scoring-rules/reset', (_req, res) => {
  resetLinkedInScoringDefaults();
  res.json(getLinkedInScoringRules());
});

// POST /interpret-rule — parse natural language into a scoring rule
router.post('/interpret-rule', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'text field is required' } });
    return;
  }

  const result = interpretRule(text);
  res.json(result);
});

interface InterpretedRule {
  signal: string;
  description: string;
  score: number;
  category: string;
  confidence: number;
}

function interpretRule(text: string): InterpretedRule {
  const lower = text.toLowerCase();

  // Extract score from text
  let score = 0;
  const scoreMatch = lower.match(/(\-?\d+)\s*points?/i) || lower.match(/(add|give|award|plus)\s+(\d+)/i) || lower.match(/(deduct|subtract|remove|minus)\s+(\d+)/i);
  if (scoreMatch) {
    if (lower.match(/(deduct|subtract|remove|minus)/)) {
      const numMatch = lower.match(/(\d+)/);
      score = numMatch ? -parseInt(numMatch[1]) : 0;
    } else {
      const numMatch = lower.match(/(\d+)/);
      score = numMatch ? parseInt(numMatch[1]) : 0;
    }
  }
  // If still 0, try any bare number
  if (score === 0) {
    const anyNum = lower.match(/(\-?\d+)/);
    if (anyNum) score = parseInt(anyNum[1]);
  }

  // Detect signal and category via keyword matching
  const signalMap: { keywords: string[]; signal: string; category: string; desc: string }[] = [
    { keywords: ['like', 'reaction'], signal: 'like_reaction', category: 'engagement', desc: 'Like or Reaction on your post' },
    { keywords: ['comment'], signal: 'comment_post', category: 'engagement', desc: 'Comment on your post' },
    { keywords: ['share', 'reshare', 'repost'], signal: 'share_reshare', category: 'engagement', desc: 'Share/Reshare of your post' },
    { keywords: ['connection request', 'inbound connection'], signal: 'inbound_connection', category: 'engagement', desc: 'Inbound connection request' },
    { keywords: ['message', 'inmail', 'dm', 'direct message'], signal: 'direct_message', category: 'engagement', desc: 'Direct message or InMail reply' },
    { keywords: ['profile view', 'views my profile', 'viewed profile'], signal: 'profile_view', category: 'engagement', desc: 'Profile view by target prospect' },
    { keywords: ['follow'], signal: 'follow', category: 'engagement', desc: 'Follow your profile or company page' },
    { keywords: ['repeat', 'multiple engagement'], signal: 'repeat_engagement', category: 'engagement', desc: 'Multiple/repeat engagements' },
    { keywords: ['company size', 'smb', '50-500', 'small business', 'medium business'], signal: 'company_size_smb', category: 'fit', desc: 'Company size fits SMB target (50-500 employees)' },
    { keywords: ['industry', 'vertical', 'sector'], signal: 'target_industry', category: 'fit', desc: 'Industry is a target vertical' },
    { keywords: ['vp', 'director', 'cxo', 'ceo', 'cfo', 'cto', 'decision maker', 'senior', 'executive', 'title', 'role'], signal: 'senior_decision_maker', category: 'fit', desc: 'Role is senior decision-maker (CxO, VP, Director)' },
    { keywords: ['location', 'region', 'market', 'geography'], signal: 'target_location', category: 'fit', desc: 'Location in target market (supported region)' },
    { keywords: ['low value', 'student', 'intern', 'junior'], signal: 'low_value_role', category: 'negative', desc: 'Low-value role or student (not a decision-maker)' },
    { keywords: ['too large', 'over 1000', '>1000', 'enterprise', 'large company'], signal: 'company_too_large', category: 'negative', desc: 'Company too large or not SMB (>1000 employees)' },
    { keywords: ['non-target', 'unrelated', 'wrong industry'], signal: 'non_target_industry', category: 'negative', desc: 'Non-target industry (unrelated sector)' },
    { keywords: ['competitor', 'vendor'], signal: 'competitor_vendor', category: 'negative', desc: 'Competitor or vendor company (not a buyer)' },
    { keywords: ['stale', 'inactive', 'no engagement', 'decay', 'cold'], signal: 'stale_lead', category: 'decay', desc: 'No recent engagement (score decays over time)' },
  ];

  let bestMatch = signalMap[0];
  let bestScore = 0;
  for (const entry of signalMap) {
    let matchCount = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) matchCount++;
    }
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = entry;
    }
  }

  // Detect negative intent
  if (lower.match(/(deduct|subtract|remove|penalt|minus|negative|lose)/) && score > 0) {
    score = -score;
  }

  const confidence = bestScore > 0 ? Math.min(bestScore / 2, 1) : 0.2;

  return {
    signal: bestMatch.signal,
    description: bestMatch.desc,
    score,
    category: bestMatch.category,
    confidence,
  };
}

export default router;
