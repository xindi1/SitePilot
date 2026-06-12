const STORAGE_KEY = 'sitepilot-commercial-v1-2-opportunities';
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
let lastAssessment = null;
let lastSnapshot = null;

function switchView(viewName) {
  views.forEach(view => view.classList.toggle('active', view.id === `view-${viewName}`));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  if (viewName === 'pipeline' || viewName === 'dashboard') renderAll();
}
navButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
const val = id => (document.getElementById(id)?.value || '').trim();
const money = n => `$${Number(n || 0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
function records(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function setRecords(next){ localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }

function scoreAssessment() {
  let score = 50;
  const timeline = val('timeline'), complexity = val('siteComplexity'), revenue = val('revenuePotential'), access = val('access'), constraints = val('constraints');
  if (timeline === 'Ready now') score += 20; if (timeline === '30 days') score += 12; if (timeline === '90 days') score += 4; if (timeline === 'Researching') score -= 8;
  if (complexity === 'Low') score += 12; if (complexity === 'Moderate') score += 4; if (complexity === 'High') score -= 12;
  if (revenue === '$5k–$25k') score += 10; if (revenue === '$25k+') score += 15; if (revenue === '<$1,000') score -= 5;
  if (access === 'Easy') score += 10; if (access === 'Moderate') score += 4; if (access === 'Difficult') score -= 10;
  if (constraints === 'None') score += 10; if (constraints === 'Some') score -= 2; if (constraints === 'Major') score -= 18;
  score = Math.max(0, Math.min(100, score));
  let tier = 'B-Tier Opportunity';
  if (score >= 78) tier = 'A-Tier Opportunity'; else if (score < 55) tier = 'Needs Review';
  let action = 'Schedule standard estimate and collect missing details.';
  if (score >= 78) action = 'Schedule estimate within 48 hours and move to office handoff.';
  if (constraints === 'Major') action = 'Review constraints before quoting or scheduling production.';
  if (timeline === 'Researching') action = 'Nurture lead and follow up with education-oriented proposal.';
  return { score, tier, action, confidence: score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low' };
}

function buildSummary(result = lastAssessment) {
  if (!result) return '<div class="empty-state">Run an assessment to generate a handoff.</div>';
  return `
    <div class="result-item"><span class="result-label">Site Readiness Score™</span><span class="result-value">${result.score}/100</span></div>
    <div class="result-item"><span class="result-label">Priority</span><span class="result-value">${result.tier}</span></div>
    <div class="result-item"><span class="result-label">Confidence</span><span class="result-value">${result.confidence}</span></div>
    <div class="result-item"><span class="result-label">Recommended action</span><span class="result-value">${result.action}</span></div>
    <div class="result-item"><span class="result-label">Customer / Site</span><span class="result-value">${val('customerName') || 'Not entered'} · ${val('companyName') || 'No site entered'}</span></div>`;
}
function saveOpportunity(result) {
  const rev = Number(val('estimatedRevenue') || 0);
  const rec = { id: Date.now(), customerName: val('customerName') || 'Unnamed customer', companyName: val('companyName') || val('siteLocation') || 'Unnamed site', location: val('siteLocation'), opportunityType: val('opportunityType'), source: val('source'), score: result.score, tier: result.tier, recommendation: result.action, value: rev, status: result.score >= 78 ? 'Qualified' : 'New', createdAt: new Date().toLocaleString() };
  setRecords([rec, ...records()]); renderAll();
}
document.getElementById('runBtn').addEventListener('click', () => { lastAssessment = scoreAssessment(); document.getElementById('summaryOutput').innerHTML = buildSummary(lastAssessment); saveOpportunity(lastAssessment); switchView('handoff'); });

document.getElementById('calcSnapshotBtn').addEventListener('click', () => {
  const revenue = Number(val('estimatedRevenue') || 0), cost = Number(val('estimatedCost') || 0), prob = Math.max(0, Math.min(100, Number(val('winProbability') || 0)));
  const margin = revenue - cost, expected = revenue * (prob / 100);
  lastSnapshot = { revenue, cost, margin, prob, expected };
  const out = document.getElementById('snapshotOutput'); out.classList.remove('hidden'); out.innerHTML = `
    <div class="result-item"><span class="result-label">Estimated margin</span><span class="result-value">${money(margin)}</span></div>
    <div class="result-item"><span class="result-label">Win probability</span><span class="result-value">${prob}%</span></div>
    <div class="result-item"><span class="result-label">Expected value</span><span class="result-value">${money(expected)}</span></div>`;
  renderAll();
});

document.getElementById('copySummaryBtn').addEventListener('click', async () => {
  const txt = ['SitePilot Field Handoff', `Customer: ${val('customerName') || 'Not entered'}`, `Site: ${val('siteLocation') || val('companyName') || 'Not entered'}`, `Opportunity type: ${val('opportunityType')}`, lastAssessment ? `Site Readiness Score: ${lastAssessment.score}/100` : 'No score yet', lastAssessment ? `Priority: ${lastAssessment.tier}` : '', lastAssessment ? `Action: ${lastAssessment.action}` : ''].filter(Boolean).join('\n');
  try { await navigator.clipboard.writeText(txt); const b=document.getElementById('copySummaryBtn'); const o=b.textContent; b.textContent='Copied'; setTimeout(()=>b.textContent=o,1200); } catch { alert('Copy failed on this device/browser.'); }
});

document.getElementById('clearSavedBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); renderAll(); });
function setStatus(id, status){ const next = records().map(r => r.id === id ? {...r, status} : r); setRecords(next); renderAll(); }
function del(id){ setRecords(records().filter(r => r.id !== id)); renderAll(); }
function renderPipeline(){ const list = document.getElementById('savedList'), rs = records(); if(!rs.length){ list.innerHTML='<div class="empty-state">No saved opportunities yet.</div>'; return; } list.innerHTML = rs.map(r => `<div class="saved-card"><div class="saved-title">${r.customerName}</div><div class="saved-meta">${r.companyName}<br>${r.opportunityType} · ${r.tier} · ${r.score}/100 · ${money(r.value)}<br>${r.status} · ${r.createdAt}</div><div class="inline-actions"><button onclick="setStatus(${r.id},'Qualified')">Qualify</button><button onclick="setStatus(${r.id},'Won')">Won</button><button onclick="setStatus(${r.id},'Lost')">Lost</button><button onclick="del(${r.id})">Delete</button></div></div>`).join(''); }
function renderDashboard(){ const rs = records(); const total=rs.length, qualified=rs.filter(r=>['Qualified','Won'].includes(r.status)).length, won=rs.filter(r=>r.status==='Won'), avg=total ? Math.round(rs.reduce((s,r)=>s+r.score,0)/total) : null, pipelineValue=rs.filter(r=>r.status!=='Lost').reduce((s,r)=>s+(Number(r.value)||0),0), wonValue=won.reduce((s,r)=>s+(Number(r.value)||0),0); document.getElementById('topPipelineCount').textContent=total; document.getElementById('topPipelineValue').textContent=money(pipelineValue); document.getElementById('topAvgScore').textContent=avg ? `${avg}` : '—'; document.getElementById('dashTotal').textContent=total; document.getElementById('dashQualified').textContent=qualified; document.getElementById('dashAvg').textContent=avg ? `${avg}` : '—'; document.getElementById('dashPipelineValue').textContent=money(pipelineValue); document.getElementById('dashWonValue').textContent=money(wonValue); document.getElementById('dashWonCount').textContent=won.length; }
function renderAll(){ renderPipeline(); renderDashboard(); }
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
renderAll(); switchView('dashboard');


document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.goto)));
