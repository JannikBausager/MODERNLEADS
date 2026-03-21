import { api } from '../api.js';
import {
  Chart, BarController, LineController, DoughnutController, PieController,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
  BarController, LineController, DoughnutController, PieController,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler,
);

const STAGE_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Contacted: '#f59e0b',
  Qualified: '#10b981',
  Disqualified: '#ef4444',
  Converted: '#8b5cf6',
};

const SOURCE_COLORS: Record<string, string> = {
  email: '#3b82f6',
  form: '#10b981',
  chatbot: '#f59e0b',
  manual: '#8b5cf6',
};

let charts: Chart[] = [];
let currentFilters: { source?: string; dateFrom?: string; dateTo?: string } = {};

function destroyCharts(): void {
  for (const c of charts) c.destroy();
  charts = [];
}

export function renderStatistics(container: HTMLElement): void {
  destroyCharts();
  container.innerHTML = `
    <div class="stats-page">
      <div class="stats-header">
        <div>
          <h1>Statistics</h1>
          <p class="stats-subtitle">Lead analytics and conversion insights</p>
        </div>
        <div class="stats-filters" id="stats-filters">
          <select class="form-input form-input-sm" id="filter-source">
            <option value="">All Sources</option>
            <option value="email">Email</option>
            <option value="form">Form</option>
            <option value="chatbot">Chatbot</option>
            <option value="manual">Manual</option>
          </select>
          <input type="date" class="form-input form-input-sm" id="filter-from" title="From date" />
          <input type="date" class="form-input form-input-sm" id="filter-to" title="To date" />
          <button class="btn btn-sm btn-primary" id="filter-apply">Apply</button>
          <button class="btn btn-sm btn-secondary" id="filter-reset">Reset</button>
        </div>
      </div>

      <div class="stats-kpi-row" id="stats-kpis"></div>

      <div class="stats-grid">
        <div class="stats-card stats-card-wide">
          <h3>Pipeline Funnel</h3>
          <canvas id="chart-funnel"></canvas>
        </div>
        <div class="stats-card">
          <h3>Conversion Rates</h3>
          <canvas id="chart-conversion"></canvas>
        </div>
        <div class="stats-card">
          <h3>Lead Sources</h3>
          <canvas id="chart-sources"></canvas>
        </div>
        <div class="stats-card">
          <h3>Score Distribution</h3>
          <canvas id="chart-scores"></canvas>
        </div>
        <div class="stats-card stats-card-wide">
          <h3>Leads Over Time</h3>
          <canvas id="chart-trend"></canvas>
        </div>
        <div class="stats-card">
          <h3>Time to Close</h3>
          <div id="time-to-close-info"></div>
          <canvas id="chart-time-close"></canvas>
        </div>
        <div class="stats-card">
          <h3>Interactions by Type</h3>
          <canvas id="chart-interactions"></canvas>
        </div>
      </div>

      <div class="stats-card stats-card-table">
        <h3>Top Leads by Score</h3>
        <div id="top-leads-table"></div>
      </div>
    </div>
  `;

  bindFilters(container);
  loadStats(container);
}

function bindFilters(container: HTMLElement): void {
  const sourceEl = container.querySelector('#filter-source') as HTMLSelectElement;
  const fromEl = container.querySelector('#filter-from') as HTMLInputElement;
  const toEl = container.querySelector('#filter-to') as HTMLInputElement;

  // Restore current filter values
  if (currentFilters.source) sourceEl.value = currentFilters.source;
  if (currentFilters.dateFrom) fromEl.value = currentFilters.dateFrom;
  if (currentFilters.dateTo) toEl.value = currentFilters.dateTo;

  container.querySelector('#filter-apply')?.addEventListener('click', () => {
    currentFilters = {
      source: sourceEl.value || undefined,
      dateFrom: fromEl.value || undefined,
      dateTo: toEl.value || undefined,
    };
    destroyCharts();
    loadStats(container);
  });

  container.querySelector('#filter-reset')?.addEventListener('click', () => {
    currentFilters = {};
    sourceEl.value = '';
    fromEl.value = '';
    toEl.value = '';
    destroyCharts();
    loadStats(container);
  });
}

async function loadStats(container: HTMLElement): Promise<void> {
  const kpis = container.querySelector('#stats-kpis') as HTMLElement;
  kpis.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const data = await api.stats.get(currentFilters);
    renderKPIs(kpis, data);
    renderFunnelChart(container, data);
    renderConversionChart(container, data);
    renderSourcesChart(container, data);
    renderScoreChart(container, data);
    renderTrendChart(container, data);
    renderTimeToCloseChart(container, data);
    renderInteractionsChart(container, data);
    renderTopLeadsTable(container, data);
  } catch (err: any) {
    kpis.innerHTML = `<div class="warning-banner">⚠️ Failed to load statistics: ${err.message || 'Unknown error'}</div>`;
  }
}

function renderKPIs(el: HTMLElement, data: any): void {
  const cr = data.conversionRates;
  el.innerHTML = `
    <div class="kpi-card">
      <span class="kpi-value">${data.totalLeads}</span>
      <span class="kpi-label">Total Leads</span>
    </div>
    <div class="kpi-card kpi-green">
      <span class="kpi-value">${cr.overallConversion.toFixed(1)}%</span>
      <span class="kpi-label">Conversion Rate</span>
    </div>
    <div class="kpi-card kpi-blue">
      <span class="kpi-value">${data.scoreStats.avg}</span>
      <span class="kpi-label">Avg Score</span>
    </div>
    <div class="kpi-card kpi-purple">
      <span class="kpi-value">${data.timeToClose.avg}d</span>
      <span class="kpi-label">Avg Time to Close</span>
    </div>
    <div class="kpi-card kpi-amber">
      <span class="kpi-value">${data.interactions.avgPerLead}</span>
      <span class="kpi-label">Avg Interactions / Lead</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-value">$${formatValue(data.opportunities.totalValue)}</span>
      <span class="kpi-label">Pipeline Value</span>
    </div>
  `;
}

function renderFunnelChart(container: HTMLElement, data: any): void {
  const canvas = container.querySelector('#chart-funnel') as HTMLCanvasElement;
  if (!canvas) return;
  const stages = data.stages as { stage: string; count: number }[];
  charts.push(new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stages.map(s => s.stage),
      datasets: [{
        label: 'Leads',
        data: stages.map(s => s.count),
        backgroundColor: stages.map(s => STAGE_COLORS[s.stage] || '#6b7280'),
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } },
      },
    },
  }));
}

function renderConversionChart(container: HTMLElement, data: any): void {
  const canvas = container.querySelector('#chart-conversion') as HTMLCanvasElement;
  if (!canvas) return;
  const cr = data.conversionRates;
  charts.push(new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Converted', 'Disqualified', 'In Progress'],
      datasets: [{
        data: [
          cr.overallConversion,
          cr.disqualificationRate,
          Math.max(0, 100 - cr.overallConversion - cr.disqualificationRate),
        ],
        backgroundColor: ['#10b981', '#ef4444', '#e5e7eb'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${(ctx.raw as number).toFixed(1)}%`,
          },
        },
      },
    },
  }));
}

function renderSourcesChart(container: HTMLElement, data: any): void {
  const canvas = container.querySelector('#chart-sources') as HTMLCanvasElement;
  if (!canvas) return;
  const sources = data.sources as { source: string; count: number }[];
  charts.push(new Chart(canvas, {
    type: 'pie',
    data: {
      labels: sources.map(s => capitalize(s.source)),
      datasets: [{
        data: sources.map(s => s.count),
        backgroundColor: sources.map(s => SOURCE_COLORS[s.source] || '#6b7280'),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
      },
    },
  }));
}

function renderScoreChart(container: HTMLElement, data: any): void {
  const canvas = container.querySelector('#chart-scores') as HTMLCanvasElement;
  if (!canvas) return;
  const buckets = data.scoreBuckets as { bucket: string; count: number }[];
  charts.push(new Chart(canvas, {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.bucket),
      datasets: [{
        label: 'Leads',
        data: buckets.map(b => b.count),
        backgroundColor: buckets.map(b => {
          const low = parseInt(b.bucket);
          if (low >= 70) return '#10b981';
          if (low >= 40) return '#f59e0b';
          return '#ef4444';
        }),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } },
      },
    },
  }));
}

function renderTrendChart(container: HTMLElement, data: any): void {
  const canvas = container.querySelector('#chart-trend') as HTMLCanvasElement;
  if (!canvas) return;
  const daily = data.dailyLeads as { date: string; count: number }[];
  charts.push(new Chart(canvas, {
    type: 'line',
    data: {
      labels: daily.map(d => formatDate(d.date)),
      datasets: [{
        label: 'Leads Created',
        data: daily.map(d => d.count),
        borderColor: '#00564a',
        backgroundColor: 'rgba(0, 86, 74, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#00564a',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } },
      },
    },
  }));
}

function renderTimeToCloseChart(container: HTMLElement, data: any): void {
  const infoEl = container.querySelector('#time-to-close-info') as HTMLElement;
  const tc = data.timeToClose;
  if (tc.data.length === 0) {
    infoEl.innerHTML = '<p style="color:#64748b;font-size:.85rem">No converted leads yet.</p>';
    return;
  }

  infoEl.innerHTML = `
    <div class="ttc-stats">
      <span class="ttc-stat"><strong>${tc.avg}</strong> days avg</span>
      <span class="ttc-stat"><strong>${tc.min}</strong> days min</span>
      <span class="ttc-stat"><strong>${tc.max}</strong> days max</span>
    </div>
  `;

  const canvas = container.querySelector('#chart-time-close') as HTMLCanvasElement;
  if (!canvas) return;

  // Build histogram buckets for time-to-close
  const bucketSize = Math.max(1, Math.ceil(tc.max / 5));
  const buckets: { label: string; count: number }[] = [];
  for (let i = 0; i <= tc.max; i += bucketSize) {
    const end = Math.min(i + bucketSize - 1, tc.max);
    const count = tc.data.filter((d: number) => d >= i && d <= end).length;
    buckets.push({ label: `${i}-${end}d`, count });
  }

  charts.push(new Chart(canvas, {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: [{
        label: 'Leads',
        data: buckets.map(b => b.count),
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } },
      },
    },
  }));
}

function renderInteractionsChart(container: HTMLElement, data: any): void {
  const canvas = container.querySelector('#chart-interactions') as HTMLCanvasElement;
  if (!canvas) return;
  const types = data.interactions.byType as { type: string; count: number }[];
  if (types.length === 0) return;

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  charts.push(new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: types.map(t => capitalize(t.type)),
      datasets: [{
        data: types.map(t => t.count),
        backgroundColor: types.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
      },
    },
  }));
}

function renderTopLeadsTable(container: HTMLElement, data: any): void {
  const el = container.querySelector('#top-leads-table') as HTMLElement;
  const leads = data.topLeads as any[];
  if (leads.length === 0) {
    el.innerHTML = '<p style="color:#64748b;">No leads found.</p>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Contact</th>
          <th>Company</th>
          <th>Score</th>
          <th>Stage</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${leads.map(l => `
          <tr>
            <td>${esc(l.contactName)}</td>
            <td>${esc(l.companyName)}</td>
            <td><span class="score-badge score-${scoreLevel(l.score)}">${l.score}</span></td>
            <td><span class="stage-badge stage-${l.stage.toLowerCase()}">${l.stage}</span></td>
            <td>${capitalize(l.source || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function scoreLevel(score: number): string {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
