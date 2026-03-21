import { Router, type Router as RouterType } from 'express';
import { db } from '../db/database.js';

const router: RouterType = Router();

interface StageCount {
  stage: string;
  count: number;
}

interface SourceCount {
  source: string;
  count: number;
}

interface ScoreBucket {
  bucket: string;
  count: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface InteractionTypeCount {
  type: string;
  count: number;
}

// GET /api/stats — full statistics dashboard data
router.get('/', async (req, res, next) => {
  try {
    const { source, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    // Build optional WHERE clause for filters
    const conditions: string[] = [];
    const params: any[] = [];
    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }
    if (dateFrom) {
      conditions.push('createdAt >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('createdAt <= ?');
      params.push(dateTo + ' 23:59:59');
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 1. Total leads
    const totalRow = db.prepare(`SELECT COUNT(*) as total FROM leads ${whereClause}`).get(...params) as any;
    const totalLeads: number = totalRow?.total ?? 0;

    // 2. Leads by stage (funnel)
    const stageRows = db.prepare(
      `SELECT stage, COUNT(*) as count FROM leads ${whereClause} GROUP BY stage ORDER BY
        CASE stage
          WHEN 'New' THEN 1
          WHEN 'Contacted' THEN 2
          WHEN 'Qualified' THEN 3
          WHEN 'Disqualified' THEN 4
          WHEN 'Converted' THEN 5
        END`
    ).all(...params) as StageCount[];

    // 3. Conversion rates
    const stageMap: Record<string, number> = {};
    for (const row of stageRows) stageMap[row.stage] = row.count;
    const conversionRates = {
      newToContacted: totalLeads > 0 ? ((stageMap['Contacted'] ?? 0) + (stageMap['Qualified'] ?? 0) + (stageMap['Converted'] ?? 0)) / totalLeads * 100 : 0,
      contactedToQualified: (stageMap['Contacted'] ?? 0) + (stageMap['Qualified'] ?? 0) + (stageMap['Converted'] ?? 0) > 0
        ? ((stageMap['Qualified'] ?? 0) + (stageMap['Converted'] ?? 0)) / ((stageMap['Contacted'] ?? 0) + (stageMap['Qualified'] ?? 0) + (stageMap['Converted'] ?? 0)) * 100 : 0,
      qualifiedToConverted: (stageMap['Qualified'] ?? 0) + (stageMap['Converted'] ?? 0) > 0
        ? (stageMap['Converted'] ?? 0) / ((stageMap['Qualified'] ?? 0) + (stageMap['Converted'] ?? 0)) * 100 : 0,
      overallConversion: totalLeads > 0 ? (stageMap['Converted'] ?? 0) / totalLeads * 100 : 0,
      disqualificationRate: totalLeads > 0 ? (stageMap['Disqualified'] ?? 0) / totalLeads * 100 : 0,
    };

    // 4. Leads by source
    const sourceRows = db.prepare(
      `SELECT source, COUNT(*) as count FROM leads ${whereClause} GROUP BY source ORDER BY count DESC`
    ).all(...params) as SourceCount[];

    // 5. Score distribution (buckets of 10)
    const scoreBuckets = db.prepare(
      `SELECT
        CASE
          WHEN score >= 90 THEN '90-100'
          WHEN score >= 80 THEN '80-89'
          WHEN score >= 70 THEN '70-79'
          WHEN score >= 60 THEN '60-69'
          WHEN score >= 50 THEN '50-59'
          WHEN score >= 40 THEN '40-49'
          WHEN score >= 30 THEN '30-39'
          WHEN score >= 20 THEN '20-29'
          WHEN score >= 10 THEN '10-19'
          ELSE '0-9'
        END as bucket,
        COUNT(*) as count
      FROM leads ${whereClause}
      GROUP BY bucket
      ORDER BY MIN(score)`
    ).all(...params) as ScoreBucket[];

    // 6. Average score
    const avgScoreRow = db.prepare(
      `SELECT AVG(score) as avg, MAX(score) as max, MIN(score) as min FROM leads ${whereClause}`
    ).get(...params) as any;

    // 7. Leads over time (by day)
    const dailyLeads = db.prepare(
      `SELECT DATE(createdAt) as date, COUNT(*) as count FROM leads ${whereClause} GROUP BY DATE(createdAt) ORDER BY date`
    ).all(...params) as DailyCount[];

    // 8. Time to close (for converted leads: days from createdAt to last stage change)
    const convertedLeads = db.prepare(
      `SELECT l.id, l.createdAt,
        (SELECT MAX(i.timestamp) FROM interactions i WHERE i.leadId = l.id AND i.type = 'system' AND i.content LIKE '%Converted%') as convertedAt
      FROM leads l
      ${whereClause ? whereClause + ' AND' : 'WHERE'} l.stage = 'Converted'`
    ).all(...params) as any[];

    const closingDays: number[] = [];
    for (const lead of convertedLeads) {
      const created = new Date(lead.createdAt).getTime();
      const converted = lead.convertedAt ? new Date(lead.convertedAt).getTime() : Date.now();
      const days = Math.max(0, Math.round((converted - created) / (1000 * 60 * 60 * 24)));
      closingDays.push(days);
    }
    const avgTimeToClose = closingDays.length > 0
      ? Math.round(closingDays.reduce((a, b) => a + b, 0) / closingDays.length)
      : 0;
    const minTimeToClose = closingDays.length > 0 ? Math.min(...closingDays) : 0;
    const maxTimeToClose = closingDays.length > 0 ? Math.max(...closingDays) : 0;

    // 9. Interaction stats
    const interactionStats = db.prepare(
      `SELECT i.type, COUNT(*) as count
      FROM interactions i
      ${whereClause ? `JOIN leads l ON l.id = i.leadId ${whereClause} AND` : 'WHERE'} 1=1
      GROUP BY i.type ORDER BY count DESC`
    ).all(...(whereClause ? params : [])) as InteractionTypeCount[];

    const totalInteractions = interactionStats.reduce((sum, r) => sum + r.count, 0);

    // 10. Average interactions per lead
    const avgInterRow = db.prepare(
      `SELECT AVG(cnt) as avg FROM (
        SELECT COUNT(*) as cnt FROM interactions i
        JOIN leads l ON l.id = i.leadId
        ${whereClause ? whereClause : ''}
        GROUP BY i.leadId
      )`
    ).get(...params) as any;

    // 11. Opportunities pipeline value
    const oppStats = db.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as totalValue, AVG(value) as avgValue
      FROM opportunities`
    ).get() as any;

    // 12. Top leads by score
    const topLeads = db.prepare(
      `SELECT contactName, companyName, score, stage, source FROM leads ${whereClause} ORDER BY score DESC LIMIT 5`
    ).all(...params) as any[];

    res.json({
      totalLeads,
      stages: stageRows,
      conversionRates,
      sources: sourceRows,
      scoreBuckets,
      scoreStats: {
        avg: Math.round(avgScoreRow?.avg ?? 0),
        max: avgScoreRow?.max ?? 0,
        min: avgScoreRow?.min ?? 0,
      },
      dailyLeads,
      timeToClose: {
        avg: avgTimeToClose,
        min: minTimeToClose,
        max: maxTimeToClose,
        data: closingDays,
      },
      interactions: {
        total: totalInteractions,
        byType: interactionStats,
        avgPerLead: Math.round((avgInterRow?.avg ?? 0) * 10) / 10,
      },
      opportunities: {
        count: oppStats?.count ?? 0,
        totalValue: Math.round(oppStats?.totalValue ?? 0),
        avgValue: Math.round(oppStats?.avgValue ?? 0),
      },
      topLeads,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
