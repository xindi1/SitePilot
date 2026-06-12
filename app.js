const STORAGE_KEY = 'sitepilot-commercial-v1-opportunities';
const LEGACY_KEY = 'mls-electric-field-engine-v2-2-records';
let activeFilter = 'All';
let lastResult = null;
let lastProposal = null;

const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

function switchView(viewName) {
  views.forEach(view => view.classList.toggle('active', view.id === `view-${viewName}`));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  if (viewName === 'pipeline') renderSaved();
  if (viewName === 'dashboard') renderDashboard();
}

navButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

function getFieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function money(n) { return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function getRecords() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function setRecords(records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }

function scoreAssessment() {
  const timeline = getFieldValue('timeline');
  const complexity = getFieldValue('complexity');
  const revenueBand = getFieldValue('revenueBand');
  const access = getFieldValue('access');
  const constraints = getFieldValue('constraints');

  let score = 52;
  if (timeline === 'Ready now') score += 20;
  if (timeline === '30 days') score += 12;
  if (timeline === '90 days') score += 4;
  if (timeline === 'Researching') score -= 8;

  if (complexity === 'Low') score += 12;
  if (complexity === 'Moderate') score += 4;
  if (complexity === 'High') score -= 12;

  if (revenueBand === '$25k+') score += 14;
  if (revenueBand === '$5k–$25k') score += 10;
  if (revenueBand === '$1k–$5k') score += 4;
  if (revenueBand === '<$1,000') score -= 4;

  if (access === 'Easy') score += 8;
  if (access === 'Moderate') score += 2;
  if (access === 'Difficult') score -= 10;

  if (constraints === 'None') score += 8;
  if (constraints === 'Some') score -= 4;
  if (constraints === 'Major') score -= 18;

  score = clamp(score, 0, 100);
  let tier = 'C-Tier Opportunity';
  let priority = 'Track';
  let confidence = 'Medium';
  if (score >= 82) { tier = 'A-Tier Opportunity'; priority = 'Priority'; confidence = 'High'; }
  else if (score >= 65) { tier = 'B-Tier Opportunity'; priority = 'Qualified'; confidence = 'Medium'; }
  else if (score < 45) { tier = 'Needs Review'; priority = 'Review'; confidence = 'Low'; }

  let recommendation = 'Continue discovery and confirm scope before scheduling an estimate.';
  if (constraints === 'Major') recommendation = 'Flag for manager review before quoting or committing field resources.';
  else if (complexity === 'High') recommendation = 'Schedule a senior field review or estimator visit.';
  else if (score >= 82) recommendation = 'Schedule estimate within 48 hours and prepare office handoff.';
  else if (score >= 65) recommendation = 'Move to qualified pipeline and assign next follow-up.';

  return { score, tier, priority, confidence, recommendation };
}

function buildRecord(result) {
  const estimatedRevenue = Number(getFieldValue('estimatedRevenue') || 0);
  return {
    id: Date.now(),
    customerName: getFieldValue('customerName') || 'Unnamed opportunity',
    companyName: getFieldValue('companyName'),
    propertyType: getFieldValue('propertyType'),
    opportunityType: getFieldValue('opportunityType'),
    source: getFieldValue('source'),
    timeline: getFieldValue('timeline'),
    complexity: getFieldValue('complexity'),
    revenueBand: getFieldValue('revenueBand'),
    access: getFieldValue('access'),
    constraints: getFieldValue('constraints'),
    notes: getFieldValue('notes'),
    status: result.score >= 65 ? 'Qualified' : 'New',
    score: result.score,
    tier: result.tier,
    priority: result.priority,
    confidence: result.confidence,
    recommendation: result.recommendation,
    estimatedRevenue,
    createdAt: new Date().toLocaleString()
  };
}

function renderAssessmentResult(result) {
  const output = document.getElementById('summaryOutput');
  output.innerHTML = `
    <div class="score-card"><span>Site Readiness Score™</span><strong>${result.score}/100</strong></div>
    <div class="result-item"><span class="result-label">Priority</span><span class="result-value">${result.tier}</span></div>
    <div class="result-item"><span class="result-label">Confidence</span><span class="result-value">${result.confidence}</span></div>
    <div class="result-item"><span class="result-label">Recommended action</span><span class="result-value">${result.recommendation}</span></div>
    <div class="result-item"><span class="result-label">Opportunity</span><span class="result-value">${getFieldValue('customerName') || 'Not entered'} · ${getFieldValue('opportunityType')}</span></div>
  `;
}

function saveRecord(result) {
  const records = getRecords();
  records.unshift(buildRecord(result));
  setRecords(records);
  renderSaved();
  renderDashboard();
  renderTopMetrics();
}

function updateStatus(id, status) {
  const records = getRecords().map(r => r.id === id ? { ...r, status } : r);
  setRecords(records);
  renderSaved(); renderDashboard(); renderTopMetrics();
}

function loadRecord(id) {
  const record = getRecords().find(item => item.id === id);
  if (!record) return;
  const ids = ['customerName','companyName','propertyType','opportunityType','source','timeline','complexity','revenueBand','access','constraints','notes','estimatedRevenue'];
  ids.forEach(id => { const el = document.getElementById(id); if (el && record[id] !== undefined) el.value = record[id]; });
  lastResult = { score: record.score, tier: record.tier, priority: record.priority, confidence: record.confidence, recommendation: record.recommendation };
  renderAssessmentResult(lastResult);
  switchView('handoff');
}

function deleteRecord(id) {
  setRecords(getRecords().filter(item => item.id !== id));
  renderSaved(); renderDashboard(); renderTopMetrics();
}

function renderSaved() {
  const savedList = document.getElementById('savedList');
  let records = getRecords();
  if (activeFilter !== 'All') records = records.filter(r => r.status === activeFilter);
  if (!records.length) { savedList.innerHTML = '<div class="empty-state">No matching opportunities yet.</div>'; return; }

  savedList.innerHTML = records.map(record => `
    <div class="saved-card">
      <div class="saved-title">${record.customerName}</div>
      <div class="saved-meta">${record.opportunityType} · ${record.status} · ${record.score}/100<br>${record.revenueBand} · ${record.createdAt}</div>
      <label class="mini-label">Pipeline status</label>
      <select class="status-select" data-status="${record.id}">
        ${['New','Qualified','Estimate Scheduled','Proposal Sent','Won','Lost'].map(s => `<option ${record.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <div class="inline-actions"><button type="button" data-load="${record.id}">Load</button><button type="button" data-delete="${record.id}">Delete</button></div>
    </div>
  `).join('');
  savedList.querySelectorAll('[data-load]').forEach(btn => btn.addEventListener('click', () => loadRecord(Number(btn.dataset.load))));
  savedList.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteRecord(Number(btn.dataset.delete))));
  savedList.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', () => updateStatus(Number(sel.dataset.status), sel.value)));
}

function renderDashboard() {
  const records = getRecords();
  const total = records.length;
  const qualified = records.filter(r => ['Qualified','Estimate Scheduled','Proposal Sent','Won'].includes(r.status)).length;
  const won = records.filter(r => r.status === 'Won').length;
  const avg = total ? Math.round(records.reduce((a, r) => a + Number(r.score || 0), 0) / total) : 0;
  const value = records.reduce((a, r) => a + Number(r.estimatedRevenue || 0), 0);
  const wonValue = records.filter(r => r.status === 'Won').reduce((a, r) => a + Number(r.estimatedRevenue || 0), 0);
  document.getElementById('dashboardOutput').innerHTML = [
    ['Total opportunities', total], ['Qualified pipeline', qualified], ['Average readiness', total ? `${avg}/100` : '—'],
    ['Pipeline value', money(value)], ['Won value', money(wonValue)], ['Win count', won]
  ].map(([label, value]) => `<div class="dash-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderTopMetrics() {
  const records = getRecords();
  const value = records.reduce((a, r) => a + Number(r.estimatedRevenue || 0), 0);
  const avg = records.length ? Math.round(records.reduce((a, r) => a + Number(r.score || 0), 0) / records.length) : null;
  document.getElementById('topMetrics').innerHTML = `
    <div><strong>${records.length}</strong><span>Pipeline</span></div>
    <div><strong>${money(value)}</strong><span>Value</span></div>
    <div><strong>${avg === null ? '—' : avg}</strong><span>Avg score</span></div>`;
}

function calculateProposal() {
  const revenue = Number(getFieldValue('estimatedRevenue') || 0);
  const cost = Number(getFieldValue('estimatedCost') || 0);
  const probability = clamp(Number(getFieldValue('winProbability') || 0), 0, 100);
  const margin = revenue - cost;
  const marginPct = revenue ? Math.round((margin / revenue) * 100) : 0;
  const expectedValue = revenue * (probability / 100);
  lastProposal = { revenue, cost, margin, marginPct, probability, expectedValue };
  const output = document.getElementById('proposalOutput');
  output.classList.remove('hidden');
  output.innerHTML = `
    <div class="result-item"><span class="result-label">Estimated margin</span><span class="result-value">${money(margin)} · ${marginPct}%</span></div>
    <div class="result-item"><span class="result-label">Proposal probability</span><span class="result-value">${probability}%</span></div>
    <div class="result-item"><span class="result-label">Expected value</span><span class="result-value">${money(expectedValue)}</span></div>`;
  renderTopMetrics();
}

function copyHandoff() {
  const summaryText = [
    'SitePilot Field Handoff',
    `Customer / Site: ${getFieldValue('customerName') || 'Not entered'}`,
    `Company / Account: ${getFieldValue('companyName') || 'Not entered'}`,
    `Opportunity Type: ${getFieldValue('opportunityType')}`,
    `Property Type: ${getFieldValue('propertyType')}`,
    `Readiness: ${lastResult ? `${lastResult.score}/100 - ${lastResult.tier}` : 'Not assessed'}`,
    `Recommendation: ${lastResult ? lastResult.recommendation : 'Run assessment'}`,
    `Notes: ${getFieldValue('notes') || 'None'}`
  ].join('\n');
  navigator.clipboard.writeText(summaryText).then(() => {
    const btn = document.getElementById('copySummaryBtn'); const original = btn.textContent;
    btn.textContent = 'Copied'; setTimeout(() => btn.textContent = original, 1200);
  }).catch(() => alert('Copy failed on this device/browser.'));
}

function migrateLegacy() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
  if (!legacy.length) return;
  const migrated = legacy.map(item => ({
    id: item.id || Date.now(), customerName: item.site || 'Imported opportunity', companyName: '', propertyType: item.propertyType || 'Residential',
    opportunityType: item.projectInterest || 'Electrical', source: 'Imported', timeline: item.timeline || 'Researching', complexity: 'Moderate',
    revenueBand: '$1k–$5k', access: 'Moderate', constraints: item.readiness === 'Needs review' ? 'Some' : 'None', notes: 'Imported from MLS Electric Field Engine.',
    status: item.readiness === 'Priority' ? 'Qualified' : 'New', score: item.score || 50, tier: item.readiness || 'Imported', priority: item.readiness || 'Track', confidence: 'Medium', recommendation: item.recommendation || '', estimatedRevenue: 0, createdAt: item.createdAt || new Date().toLocaleString()
  }));
  setRecords(migrated);
}

document.getElementById('runBtn').addEventListener('click', () => { lastResult = scoreAssessment(); renderAssessmentResult(lastResult); saveRecord(lastResult); switchView('handoff'); });
document.getElementById('calcProposalBtn').addEventListener('click', calculateProposal);
document.getElementById('copySummaryBtn').addEventListener('click', copyHandoff);
document.getElementById('clearSavedBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); renderSaved(); renderDashboard(); renderTopMetrics(); });
document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => { activeFilter = btn.dataset.filter; document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn)); renderSaved(); }));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
migrateLegacy(); renderSaved(); renderDashboard(); renderTopMetrics(); switchView('intake');
