import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function grade(score) {
  if (score >= 90) return { label: 'Excellent',        color: '#4ade80' };
  if (score >= 75) return { label: 'Very Good',         color: '#4ade80' };
  if (score >= 60) return { label: 'Good',              color: '#f59e0b' };
  if (score >= 40) return { label: 'Satisfactory',      color: '#f59e0b' };
  return               { label: 'Needs Work',        color: '#f87171' }; // Changed to match UI
}

const icons = {
  content: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  comm: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
  conf: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  check: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  alert: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  trend: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
};

function scoreSVG_large(score, color) {
  const R = 60, SW = 8, S = 140;
  const circ = parseFloat((2 * Math.PI * R).toFixed(2));
  const dash  = score > 0 ? parseFloat(((score / 100) * circ).toFixed(2)) : 0;
  return `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
  <circle cx="${S/2}" cy="${S/2}" r="${R}" fill="none" stroke="#1f1f1f" stroke-width="${SW}"/>
  ${dash > 0 ? `
  <circle cx="${S/2}" cy="${S/2}" r="${R}" fill="none"
    stroke="${color}" stroke-width="${SW}" stroke-linecap="round"
    stroke-dasharray="${dash} ${circ}"
    transform="rotate(-90 ${S/2} ${S/2})"/>` : ''}
  <text x="${S/2}" y="${S/2 - 2}" text-anchor="middle"
        fill="${color}" font-size="34" font-weight="800"
        font-family="Arial,sans-serif">${score}</text>
  <text x="${S/2}" y="${S/2 + 18}" text-anchor="middle"
        fill="#a1a1aa" font-size="11" font-weight="700"
        font-family="Arial,sans-serif">/ 100</text>
</svg>`;
}

function metricRow(label, score, color, iconStr, isLast=false) {
  return `
  <div style="display:table;width:100%;${isLast ? '' : 'margin-bottom:32px;'}">
    <div style="display:table-cell;vertical-align:middle;width:48px;">
      <div style="background:${color}1a;color:${color};width:34px;height:34px;border-radius:8px;position:relative;">
        <div style="position:absolute;top:9px;left:9px;">${iconStr}</div>
      </div>
    </div>
    <div style="display:table-cell;vertical-align:middle;color:#e4e4e7;font-size:14px;font-weight:700;">
      ${label}
    </div>
    <div style="display:table-cell;vertical-align:middle;text-align:right;color:#fff;font-size:22px;font-weight:800;">
      ${score}
    </div>
  </div>`;
}

function bulletList(items, color) {
  return items.map(t => `
<div style="display:table;width:100%;margin-bottom:14px;">
  <span style="display:table-cell;width:20px;vertical-align:top;color:${color};font-size:10px;padding-top:4px;">●</span>
  <span style="display:table-cell;color:#d1d5db;font-size:13px;line-height:1.6;font-weight:500;">${t}</span>
</div>`).join('');
}

function qaCard(q, idx) {
  return `
<div style="background:#131313;border:1px solid #262626;border-radius:12px;padding:22px;margin-bottom:16px;">
  <div style="display:table;width:100%;margin-bottom:12px;">
    <span style="display:table-cell;color:#f59e0b;font-size:13px;font-weight:800;">Q${idx + 1}</span>
  </div>
  <p style="color:#f4f4f5;font-size:14px;font-weight:700;margin:0 0 12px 0;line-height:1.6;">${q.question}</p>
  <p style="color:#a1a1aa;font-size:13px;margin:0 0 16px 0;line-height:1.6;">
    <span style="color:#71717a;font-weight:600;">Your Answer: </span> ${q.answer}
  </p>
  ${q.suggestedAnswer ? `
  <div style="background:#f59e0b1a;border:1px solid #f59e0b33;padding:16px;border-radius:8px;">
    <p style="color:#fcd34d;font-size:13px;margin:0;line-height:1.6;">
      <span style="font-weight:800;">Better Answer: </span> ${q.suggestedAnswer}
    </p>
  </div>` : ''}
</div>`;
}

// ─── Main Template ────────────────────────────────────────────────────────────
function buildHTML(fb, userName) {
  const score   = fb.finalScore || 0;
  const { label: gl, color: gc } = grade(score);

  const domain  = fb.domain || 'Technical';
  const type    = fb.type   || 'Interview';
  const mode    = type.charAt(0).toUpperCase() + type.slice(1);
  const dateStr = new Date(fb.completedAt || Date.now())
    .toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

  const bd   = fb.scoreBreakdown || {};
  const cVal = Math.round(bd.content        ?? 0);
  const mVal = Math.round(bd.communication  ?? 0);
  const nVal = Math.round(bd.confidence     ?? 0);
  const str  = (fb.strengths    || []).filter(Boolean);
  const imp  = (fb.improvements || []).filter(Boolean);
  const qa   = (fb.qa || []).filter(q => q.question && q.answer);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#09090b;}
  *{box-sizing:border-box;}
  p,h1,h2,h3,span,div{margin:0;padding:0;}
</style>
</head><body>
<div id="root" style="width:780px;background:#09090b;padding:32px 36px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f4f4f5;">

  <!-- REPORT HEADER -->
  <div style="margin-bottom:28px;display:table;width:100%;">
    <div style="display:table-cell;vertical-align:middle;">
      <h1 style="color:#fff;font-size:26px;font-weight:800;margin-bottom:6px;letter-spacing:-0.02em;">Performance Report</h1>
      <p style="color:#a1a1aa;font-size:14px;font-weight:500;">
        <span style="color:#fff;font-weight:700;">${userName}</span> &middot; ${domain} ${mode}
      </p>
    </div>
    <div style="display:table-cell;vertical-align:middle;text-align:right;">
      <div style="display:inline-block;background:#f59e0b;color:#000;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;">AI InterviewPrep</div>
      <p style="color:#71717a;font-size:12px;margin-top:8px;font-weight:500;">${dateStr}</p>
    </div>
  </div>

  <!-- MAIN TOP CARD -->
  <div style="background:#131313;border:1px solid #262626;border-radius:16px;padding:36px;display:table;width:100%;margin-bottom:24px;">
    <!-- LEFT SIDE: RING -->
    <div style="display:table-cell;vertical-align:middle;text-align:center;width:280px;border-right:1px solid #262626;">
       ${scoreSVG_large(score, gc)}
       <div style="margin-top:20px;">
         <p style="color:#fff;font-size:15px;font-weight:800;margin-bottom:6px;">Overall Score</p>
         <div style="display:inline-block;color:#a1a1aa;font-size:13px;font-weight:600;">
           <span style="display:inline-block;background:#3b82f6;color:#fff;width:18px;height:18px;border-radius:4px;vertical-align:middle;position:relative;margin-right:6px;">
             <div style="position:absolute;top:3px;left:3px;">${icons.trend}</div>
           </span>
           <span style="vertical-align:middle;">${gl}</span>
         </div>
       </div>
    </div>
    
    <!-- RIGHT SIDE: METRICS -->
    <div style="display:table-cell;vertical-align:middle;padding-left:48px;padding-right:16px;">
       ${metricRow('Content Quality', cVal, '#60a5fa', icons.content)}
       ${metricRow('Communication', mVal, '#4ade80', icons.comm)}
       ${metricRow('Confidence', nVal, '#f472b6', icons.conf, true)}
    </div>
  </div>

  <!-- STRENGTHS & IMPROVEMENTS -->
  <div style="display:table;width:100%;table-layout:fixed;margin-bottom:32px;">
    <div style="display:table-row;">
      <!-- LEFT -->
      <div style="display:table-cell;vertical-align:top;padding-right:12px;">
         <div style="background:#131313;border:1px solid #262626;border-radius:16px;padding:28px;">
           <div style="display:table;margin-bottom:24px;">
             <div style="display:table-cell;vertical-align:middle;padding-right:10px;">${icons.check}</div>
             <div style="display:table-cell;vertical-align:middle;color:#fff;font-size:16px;font-weight:800;">Strengths</div>
           </div>
           ${str.length ? bulletList(str, '#4ade80') : '<p style="color:#71717a;font-size:13px;">No data collected.</p>'}
         </div>
      </div>
      <!-- RIGHT -->
      <div style="display:table-cell;vertical-align:top;padding-left:12px;">
         <div style="background:#131313;border:1px solid #262626;border-radius:16px;padding:28px;">
           <div style="display:table;margin-bottom:24px;">
             <div style="display:table-cell;vertical-align:middle;padding-right:10px;">${icons.alert}</div>
             <div style="display:table-cell;vertical-align:middle;color:#fff;font-size:16px;font-weight:800;">Areas to Improve</div>
           </div>
           ${imp.length ? bulletList(imp, '#f59e0b') : '<p style="color:#71717a;font-size:13px;">No data collected.</p>'}
         </div>
      </div>
    </div>
  </div>

  <!-- Q&A (Optional, keeping it as value add) -->
  ${qa.length ? `
  <div style="margin-bottom:16px;">
    <p style="color:#fff;font-size:18px;font-weight:800;margin-bottom:16px;">Question & Answer Review</p>
    ${qa.slice(0, 5).map((q, i) => qaCard(q, i)).join('')}
  </div>` : ''}

</div>
</body></html>`;
}

// ─── Export ───────────────────────────────────────────────────────────────────
export async function exportInterviewPDF(feedback, userName = 'Candidate') {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:780px;';
  document.body.appendChild(wrap);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:780px;height:5000px;border:none;display:block;';
  wrap.appendChild(iframe);
  iframe.srcdoc = buildHTML(feedback, userName);

  await new Promise(res => { iframe.onload = () => setTimeout(res, 800); });

  try {
    const root = iframe.contentDocument?.getElementById('root');
    if (!root) throw new Error('root element not found in iframe');

    const canvas = await html2canvas(root, {
      scale:          2,
      useCORS:        true,
      allowTaint:     true,
      backgroundColor:'#09090b', // darker zinc-950 bg
      logging:        false,
      width:          780,
      windowWidth:    780,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdfW    = 210;
    const pdfH    = (canvas.height / canvas.width) * pdfW;
    const pageH   = 297;

    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    let remaining = pdfH, offset = 0;
    while (remaining > 0) {
      doc.addImage(imgData, 'PNG', 0, -offset, pdfW, pdfH);
      remaining -= pageH;
      offset    += pageH;
      if (remaining > 0) doc.addPage();
    }

    const safe = userName.replace(/\s+/g, '_');
    doc.save(`AI_Interview_Report_${safe}_${new Date().toISOString().slice(0,10)}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}
