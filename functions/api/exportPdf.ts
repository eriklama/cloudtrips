import { requireUser } from '../_lib/auth';
import type { Env, AuthUser } from '../_lib/auth';
import { error, methodNotAllowed } from '../_lib/http';
import { findValidShareByToken, getShareTokenFromRequest } from '../_lib/share';

/* =========================
 * TYPES
 * ========================= */

interface ActivityRow {
  id: string;
  type: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  cost: number;
  currency: string;
  distance: number;
  notes: string;
  sort_order: number;
}

interface TripRow {
  id: string;
  name: string;
  notes: string | null;
  country: string | null;
}

/* =========================
 * HELPERS
 * ========================= */

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(v: string): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(v: string): string {
  if (!v) return 'No date';
  const d = new Date(v);
  if (isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR'
  }).format(Number(amount) || 0);
}

function dayKey(v: string): string {
  if (!v) return 'undated';
  const d = new Date(v);
  if (isNaN(d.getTime())) return 'undated';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TYPE_META: Record<string, { icon: string; label: string }> = {
  plane:         { icon: '✈️', label: 'Plane' },
  car:           { icon: '🚗', label: 'Car' },
  hike:          { icon: '🥾', label: 'Hike' },
  city:          { icon: '🏙️', label: 'City' },
  accommodation: { icon: '🏨', label: 'Stay' },
  other:         { icon: '📍', label: 'Other' }
};

function getTypeMeta(type: string) {
  return TYPE_META[String(type || 'other').toLowerCase()] || TYPE_META.other;
}

/* =========================
 * HTML BUILDER
 * ========================= */

function buildHtml(trip: TripRow, activities: ActivityRow[], publicMode: boolean): string {
  const sorted = [...activities].sort((a, b) =>
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  // Date range subtitle
  const dated = sorted.filter(a => a.start_date);
  let subtitle = '';
  if (dated.length) {
    const first = dated[0].start_date;
    const last = dated[dated.length - 1].start_date;
    subtitle = first === last
      ? formatDate(first)
      : `${formatDate(first)} — ${formatDate(last)}`;
  }

  // Summary pills
  const totalKm = sorted.reduce((sum, a) => sum + (Number(a.distance) || 0), 0);
  const costsByCurrency: Record<string, number> = {};
  if (!publicMode) {
    sorted.forEach(a => {
      const c = a.currency || 'EUR';
      costsByCurrency[c] = (costsByCurrency[c] || 0) + (Number(a.cost) || 0);
    });
  }

  const summaryPills = [
    `<span class="summary-pill">${sorted.length} activities</span>`,
    ...(!publicMode ? Object.entries(costsByCurrency).map(([c, amt]) =>
      `<span class="summary-pill">${escapeHtml(formatCurrency(amt, c))}</span>`
    ) : []),
    ...(totalKm ? [`<span class="summary-pill">${totalKm} km</span>`] : [])
  ].join('');

  // Cost breakdown
  let costBreakdownHtml = '';
  if (!publicMode) {
    const byTypeCurrency: Record<string, { type: string; currency: string; amount: number }> = {};
    sorted.forEach(a => {
      const currency = a.currency || 'EUR';
      const type = a.type || 'other';
      const key = `${type}__${currency}`;
      if (!byTypeCurrency[key]) byTypeCurrency[key] = { type, currency, amount: 0 };
      byTypeCurrency[key].amount += Number(a.cost) || 0;
    });

    const typeEntries = Object.values(byTypeCurrency)
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    if (typeEntries.length) {
      const rows = typeEntries.map(({ type, currency, amount }) => {
        const meta = getTypeMeta(type);
        const currencyTotal = costsByCurrency[currency] || 0;
        const percent = currencyTotal > 0 ? Math.round((amount / currencyTotal) * 100) : 0;
        return `
          <div class="cost-breakdown-row">
            <div>${meta.icon} ${escapeHtml(meta.label)} <span style="color:#888;font-size:10px">${escapeHtml(currency)}</span></div>
            <div class="muted">${percent}%</div>
            <div class="right">${escapeHtml(formatCurrency(amount, currency))}</div>
          </div>`;
      }).join('');

      costBreakdownHtml = `
        <div class="cost-breakdown">
          <div class="cost-breakdown-title">Cost breakdown</div>
          ${rows}
        </div>`;
    }
  }

  // Group activities by day
  const groups: Record<string, ActivityRow[]> = {};
  const undated: ActivityRow[] = [];

  sorted.forEach(a => {
    const key = dayKey(a.start_date);
    if (key === 'undated') {
      undated.push(a);
    } else {
      (groups[key] ||= []).push(a);
    }
  });

  // Render day sections
  const renderActivity = (a: ActivityRow) => {
    const meta = getTypeMeta(a.type);
    const cost = Number(a.cost) || 0;
    const km = Number(a.distance) || 0;
    const currency = a.currency || 'EUR';

    return `
      <div class="row">
        <div class="time">${escapeHtml(formatTime(a.start_date))}${a.end_date ? `–${escapeHtml(formatTime(a.end_date))}` : ''}</div>
        <div class="icon">${meta.icon}</div>
        <div>
          <div class="activity-name">${escapeHtml(a.name || '—')}</div>
          ${a.location ? `<div class="activity-notes">${escapeHtml(a.location)}</div>` : ''}
          ${a.notes ? `<div class="activity-notes">${escapeHtml(a.notes)}</div>` : ''}
        </div>
        <div class="cost-col">
          ${!publicMode && cost ? `<div class="cost-amount">${escapeHtml(formatCurrency(cost, currency))}</div>` : ''}
          ${km ? `<div class="cost-km">${km} km</div>` : ''}
        </div>
      </div>`;
  };

  const daySections = Object.keys(groups).sort().map(day => {
    const list = groups[day];
    const dayCostsByCurrency: Record<string, number> = {};
    if (!publicMode) {
      list.forEach(a => {
        const c = a.currency || 'EUR';
        dayCostsByCurrency[c] = (dayCostsByCurrency[c] || 0) + (Number(a.cost) || 0);
      });
    }
    const dayKm = list.reduce((sum, a) => sum + (Number(a.distance) || 0), 0);
    const dayTotals = [
      ...(!publicMode ? Object.entries(dayCostsByCurrency).map(([c, amt]) => formatCurrency(amt, c)) : []),
      ...(dayKm ? [`${dayKm} km`] : [])
    ].join(' · ');

    return `
      <div class="day">
        <div class="day-header">
          <div class="day-header-left">${escapeHtml(formatDate(list[0].start_date))}</div>
          <div class="day-header-right">${list.length} activit${list.length === 1 ? 'y' : 'ies'}${dayTotals ? ' · ' + escapeHtml(dayTotals) : ''}</div>
        </div>
        ${list.map(renderActivity).join('')}
      </div>`;
  }).join('');

  const undatedSection = undated.length ? `
    <div class="day">
      <div class="undated-header">No date</div>
      ${undated.map(renderActivity).join('')}
    </div>` : '';

  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(trip.name || 'Trip')} — Itinerary</title>
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #111; font-size: 12px; line-height: 1.5; background: #fff; }
    .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { font-size: 22px; margin: 0 0 2px; }
    .subtitle { font-size: 11px; color: #555; }
    .print-date { font-size: 10px; color: #888; text-align: right; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .summary-pill { padding: 4px 10px; border: 1px solid #ddd; border-radius: 99px; font-size: 11px; color: #333; }
    .cost-breakdown { margin-bottom: 16px; border: 1px solid #eee; border-radius: 6px; overflow: hidden; }
    .cost-breakdown-title { background: #f5f5f5; padding: 4px 10px; font-weight: 600; font-size: 11px; border-bottom: 1px solid #eee; }
    .cost-breakdown-row { display: grid; grid-template-columns: 1fr 60px 100px; padding: 3px 10px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
    .cost-breakdown-row:last-child { border-bottom: none; }
    .cost-breakdown-row .right { text-align: right; }
    .cost-breakdown-row .muted { color: #888; text-align: right; }
    .day { margin-bottom: 16px; page-break-inside: avoid; }
    .day-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid #222; padding-bottom: 3px; margin-bottom: 6px; }
    .day-header-left { font-weight: 700; font-size: 13px; }
    .day-header-right { font-size: 10px; color: #555; }
    .row { display: grid; grid-template-columns: 65px 18px 1fr 100px; gap: 6px; padding: 4px 0; border-bottom: 1px solid #eee; align-items: start; }
    .row:last-of-type { border-bottom: none; }
    .time { font-variant-numeric: tabular-nums; color: #444; font-size: 11px; padding-top: 1px; }
    .icon { font-size: 13px; line-height: 1.4; }
    .activity-name { font-weight: 600; }
    .activity-notes { font-size: 10px; color: #666; margin-top: 1px; }
    .cost-col { text-align: right; font-size: 11px; }
    .cost-amount { font-weight: 600; }
    .cost-km { color: #777; }
    .day-totals { text-align: right; font-size: 11px; color: #444; margin-top: 4px; padding-top: 3px; border-top: 1px solid #ddd; }
    .undated-header { font-weight: 700; font-size: 12px; color: #888; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px dashed #ccc; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(trip.name || 'Trip')}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </div>
    <div class="print-date">Printed ${escapeHtml(printDate)}</div>
  </div>
  <div class="summary">${summaryPills}</div>
  ${costBreakdownHtml}
  <div id="content">
    ${daySections}
    ${undatedSection}
  </div>
</body>
</html>`;
}

/* =========================
 * HANDLER
 * ========================= */

export async function onRequestGet(context: { request: Request; env: Env & { BROWSERLESS_API_KEY: string; RATE_LIMIT_KV: KVNamespace } }) {
  const { request, env } = context;

  const params = new URL(request.url).searchParams;
  const tripId = params.get('id')?.trim();

  if (!tripId) return error('Trip ID is required.', 400);

  if (!env.BROWSERLESS_API_KEY) return error('PDF export is not configured.', 503);

  // Auth: owner or valid share token
  let publicMode = false;
  let authedUser: AuthUser | null = null;

  const shareToken = getShareTokenFromRequest(request);
  if (shareToken) {
    const share = await findValidShareByToken({ env, token: shareToken });
    if (!share) return error('Share link is invalid or has expired.', 401);
    publicMode = share.mode === 'public';
  } else {
    try {
      authedUser = await requireUser(context);
    } catch {
      return error('Unauthorized.', 401);
    }
  }

  // Per-user PDF quota check (authenticated users only, not share links)
  if (authedUser) {
    const userRow = await env.DB
      .prepare(`SELECT pdf_monthly_limit FROM users WHERE id = ? LIMIT 1`)
      .bind(authedUser.id)
      .first<{ pdf_monthly_limit: number }>();

    const limit = userRow?.pdf_monthly_limit ?? 5;

    // 0 = unlimited — skip check
    if (limit !== 0) {
      const now = new Date();
      const monthSuffix = `_${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const userMonthKey = `pdf_user_${authedUser.id}${monthSuffix}`;
      const userUsage = await env.RATE_LIMIT_KV.get(userMonthKey);
      const userCount = userUsage ? parseInt(userUsage, 10) : 0;

      if (userCount >= limit) {
        return error(`You have used all ${limit} PDF exports for this month. Contact support to upgrade.`, 429);
      }
    }
  }

  // Fetch trip + all activities from D1
  const trip = await env.DB
    .prepare(`SELECT id, name, notes, country FROM trips WHERE id = ? LIMIT 1`)
    .bind(tripId)
    .first<TripRow>();

  if (!trip) return error('Trip not found.', 404);

  const activitiesResult = await env.DB
    .prepare(`
      SELECT id, type, name, location, start_date, end_date, cost, currency, distance, notes, sort_order
      FROM activities
      WHERE trip_id = ?
      ORDER BY sort_order ASC, start_date ASC
    `)
    .bind(tripId)
    .all<ActivityRow>();

  const activities = activitiesResult.results || [];

  // Build HTML
  const html = buildHtml(trip, activities, publicMode);

  // Track usage in KV (global Browserless + per-user)
  try {
    const now = new Date();
    const monthSuffix = `_${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Global Browserless counter
    const globalKey = `browserless_usage${monthSuffix}`;
    const globalExisting = await env.RATE_LIMIT_KV.get(globalKey);
    const globalCount = globalExisting ? parseInt(globalExisting, 10) + 1 : 1;
    await env.RATE_LIMIT_KV.put(globalKey, String(globalCount), { expirationTtl: 60 * 60 * 24 * 40 });

    // Per-user counter
    if (authedUser) {
      const userKey = `pdf_user_${authedUser.id}${monthSuffix}`;
      const userExisting = await env.RATE_LIMIT_KV.get(userKey);
      const userCount = userExisting ? parseInt(userExisting, 10) + 1 : 1;
      await env.RATE_LIMIT_KV.put(userKey, String(userCount), { expirationTtl: 60 * 60 * 24 * 40 });
    }
  } catch (e) {
    console.warn('Usage tracking failed (non-fatal):', e);
  }

  // Call Browserless
  const browserlessUrl = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(env.BROWSERLESS_API_KEY)}`;

  let pdfResponse: Response;
  try {
    pdfResponse = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        options: {
          format: 'A4',
          margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
          printBackground: true
        }
      })
    });
  } catch (err) {
    console.error('Browserless fetch error:', err);
    return error('Failed to connect to PDF service.', 502);
  }

  if (!pdfResponse.ok) {
    const body = await pdfResponse.text().catch(() => '');
    console.error('Browserless error:', pdfResponse.status, body);
    return error('PDF generation failed.', 502);
  }

  const pdfBuffer = await pdfResponse.arrayBuffer();
  const filename = `${(trip.name || 'trip').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    }
  });
}

export function onRequest(context: { request: Request; env: Env & { BROWSERLESS_API_KEY: string; RATE_LIMIT_KV: KVNamespace } }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}