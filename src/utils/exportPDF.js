import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function grade(score) {
  if (score >= 90) return { label: 'Outstanding',       color: '#059669' }; // Emerald
  if (score >= 75) return { label: 'Excellent',         color: '#10b981' }; // Emerald light
  if (score >= 60) return { label: 'Good',              color: '#3b82f6' }; // Blue
  if (score >= 45) return { label: 'Satisfactory',      color: '#f59e0b' }; // Amber
  return               { label: 'Needs Improvement', color: '#ef4444' }; // Red
}

const icons = {
  content: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  comm: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
  conf: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  check: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  alert: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  star: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
};

function scoreSVG_large(score, color) {
  const R = 60, SW = 10, S = 150;
  const circ = parseFloat((2 * Math.PI * R).toFixed(2));
  const dash  = score > 0 ? parseFloat(((score / 100) * circ).toFixed(2)) : 0;
  return `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
  <defs>
    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}" />
      <stop offset="100%" stop-color="${color}bb" />
    </linearGradient>
  </defs>
  <circle cx="${S/2}" cy="${S/2}" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="${SW}"/>
  ${dash > 0 ? `
  <circle cx="${S/2}" cy="${S/2}" r="${R}" fill="none"
    stroke="url(#scoreGrad)" stroke-width="${SW}" stroke-linecap="round"
    stroke-dasharray="${dash} ${circ}"
    transform="rotate(-90 ${S/2} ${S/2})"/>` : ''}
  <text x="${S/2}" y="${S/2 - 2}" text-anchor="middle"
        fill="#0f172a" font-size="36" font-weight="900"
        font-family="-apple-system,sans-serif">${score}</text>
  <text x="${S/2}" y="${S/2 + 20}" text-anchor="middle"
        fill="#64748b" font-size="12" font-weight="700"
        font-family="-apple-system,sans-serif">SCORE</text>
</svg>`;
}

function metricBar(label, score, color, iconStr) {
  return `
  <div style="margin-bottom: 24px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="background:${color}15; color:${color}; width:30px; height:30px; border-radius:8px; display: flex; align-items: center; justify-content: center;">
          ${iconStr}
        </div>
        <span style="color:#334155; font-size:14px; font-weight:700;">${label}</span>
      </div>
      <span style="color:#0f172a; font-size:16px; font-weight:800;">${score}%</span>
    </div>
    <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
      <div style="width:${score}%; height:100%; background:${color}; border-radius:4px;"></div>
    </div>
  </div>`;
}

function bulletList(items, type) {
  const isStrength = type === 'strength';
  const icon = isStrength ? icons.check : icons.alert;
  const bgColor = isStrength ? '#05966910' : '#d9770610';
  
  return items.map(t => `
<div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px; background:${bgColor}; padding:12px; border-radius:8px;">
  <div style="margin-top: 2px; flex-shrink: 0;">${icon}</div>
  <span style="color:#334155; font-size:13px; line-height:1.5; font-weight:500;">${t}</span>
</div>`).join('');
}

function qaCard(q, idx) {
  return `
<div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
    <span style="color:#b45309; font-size:13px; font-weight:800; text-transform:uppercase; tracking:0.05em;">Question ${idx + 1}</span>
    ${q.score !== undefined ? `
    <span style="font-size:12px; font-weight:800; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px;">Score: ${q.score}/100</span>
    ` : ''}
  </div>
  <p style="color:#0f172a; font-size:13.5px; font-weight:700; margin:0 0 10px 0; line-height:1.5;">${q.question}</p>
  <div style="margin-bottom:12px;">
    <p style="color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase; margin:0 0 4px 0; tracking:0.02em;">Candidate Answer</p>
    <p style="color:#334155; font-size:13px; margin:0; line-height:1.5;">${q.answer}</p>
  </div>
  ${q.suggestedAnswer ? `
  <div style="background:#fef3c7; border-left:3px solid #d97706; padding:12px; border-radius:0 8px 8px 0;">
    <p style="color:#78350f; font-size:11px; font-weight:700; text-transform:uppercase; margin:0 0 4px 0; tracking:0.02em;">Suggested Better Formulation</p>
    <p style="color:#92400e; font-size:12.5px; margin:0; line-height:1.5; font-weight:500;">${q.suggestedAnswer}</p>
  </div>` : ''}
</div>`;
}

// ─── Main Template ────────────────────────────────────────────────────────────
function buildHTML(fb, userName) {
  const score   = fb.finalScore || 0;
  const { label: gl, color: gc } = grade(score);

  const isResume = fb.type === 'Resume';
  const domain   = isResume ? 'AI Personalised' : (fb.domain || 'Technical');
  const type     = isResume ? 'Resume-Based' : (fb.type || 'Interview');
  const mode     = isResume ? 'Resume' : (type.charAt(0).toUpperCase() + type.slice(1));
  const dateStr  = new Date(fb.completedAt || Date.now())
    .toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' });

  const bd   = fb.scoreBreakdown || {};
  const cVal = Math.round(bd.content        ?? 0);
  const mVal = Math.round(bd.communication  ?? 0);
  const nVal = Math.round(bd.confidence     ?? 0);
  const str  = (fb.strengths    || []).filter(Boolean);
  const imp  = (fb.improvements || []).filter(Boolean);
  const qa   = (fb.qa || []).filter(q => q.question && q.answer);

  // Group Q&As into chunks of maximum 3 questions per page
  const qaChunks = [];
  for (let i = 0; i < qa.length; i += 3) {
    qaChunks.push(qa.slice(i, i + 3));
  }
  const totalPages = 1 + qaChunks.length;

  // Generate pages dynamically
  const qaPagesHtml = qaChunks.map((chunk, chunkIdx) => {
    const pageNum = chunkIdx + 2;
    return `
    <!-- PAGE ${pageNum}: DETAILED Q&A REVIEW -->
    <div class="page" id="page-${pageNum}">
      <div>
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 30px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <div style="background: #b45309; width: 10px; height: 20px; border-radius: 3px;"></div>
              <h1 style="color: #0f172a; font-size: 24px; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase;">AI InterviewPrep</h1>
            </div>
            <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; tracking: 0.05em;">Detailed Q&A Evaluation</p>
          </div>
          <div style="text-align: right;">
            <p style="color: #0f172a; font-size: 14px; font-weight: 800; margin-bottom: 4px;">${userName}</p>
            <p style="color: #64748b; font-size: 12px; font-weight: 500;">Questions ${chunkIdx * 3 + 1} - ${chunkIdx * 3 + chunk.length}</p>
          </div>
        </div>

        <!-- QUESTIONS AND SUGGESTED ANSWERS -->
        <div>
          ${chunk.map((q, i) => qaCard(q, chunkIdx * 3 + i)).join('')}
        </div>
      </div>

      <!-- PAGE FOOTER -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 11px; font-weight: 600;">
        <div>Detailed Performance Breakdown</div>
        <div>AI InterviewPrep Assessment Report</div>
        <div>Page ${pageNum} of ${totalPages}</div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#f8fafc;}
  *{box-sizing:border-box;}
  p,h1,h2,h3,span,div{margin:0;padding:0;}
  .page {
    width: 800px;
    height: 1130px;
    background: #ffffff;
    padding: 50px;
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }
</style>
</head><body>

  <!-- PAGE 1: ASSESSMENT SUMMARY -->
  <div class="page" id="page-1">
    <div>
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 30px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="background: #b45309; width: 10px; height: 20px; border-radius: 3px;"></div>
            <h1 style="color: #0f172a; font-size: 24px; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase;">AI InterviewPrep</h1>
          </div>
          <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; tracking: 0.05em;">Official Performance Assessment</p>
        </div>
        <div style="text-align: right;">
          <p style="color: #0f172a; font-size: 14px; font-weight: 800; margin-bottom: 4px;">${userName}</p>
          <p style="color: #64748b; font-size: 12px; font-weight: 500;">${domain} &middot; ${mode}</p>
        </div>
      </div>

      <!-- MAIN SCORE DISPLAY -->
      <div style="display: flex; gap: 40px; margin-bottom: 35px; align-items: stretch;">
        <!-- Left Circular Gauge -->
        <div style="flex: 1.2; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; display: flex; align-items: center; justify-content: center; gap: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
          ${scoreSVG_large(score, gc)}
          <div>
            <p style="color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; tracking: 0.05em; margin-bottom: 4px;">Overall Verdict</p>
            <p style="color: ${gc}; font-size: 20px; font-weight: 900; line-height: 1.2; margin-bottom: 6px;">${gl}</p>
            <p style="color: #475569; font-size: 12px; line-height: 1.4; font-weight: 500; max-width: 180px;">Based on Content, Communication and Confidence metrics.</p>
          </div>
        </div>

        <!-- Right Skill Metrics -->
        <div style="flex: 1.5; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.01); display: flex; flex-direction: column; justify-content: center;">
          ${metricBar('Content Quality', cVal, '#2563eb', icons.content)}
          ${metricBar('Communication Skills', mVal, '#059669', icons.comm)}
          ${metricBar('Confidence & Presence', nVal, '#db2777', icons.conf)}
        </div>
      </div>

      <!-- STRENGTHS & AREAS TO IMPROVE -->
      <div style="display: flex; gap: 24px; margin-bottom: 30px;">
        <!-- Left: Strengths -->
        <div style="flex: 1; display: flex; flex-direction: column;">
          <h3 style="color: #0f172a; font-size: 15px; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; tracking: 0.02em;">
            <span style="color:#059669; display:flex; align-items:center;">${icons.star}</span> Key Strengths
          </h3>
          <div style="flex: 1;">
            ${str.length ? bulletList(str, 'strength') : '<p style="color:#64748b; font-size:13px; font-style:italic;">No significant strengths recorded.</p>'}
          </div>
        </div>

        <!-- Right: Improvements -->
        <div style="flex: 1; display: flex; flex-direction: column;">
          <h3 style="color: #0f172a; font-size: 15px; font-weight: 800; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; tracking: 0.02em;">
            <span style="color:#d97706; display:flex; align-items:center;">${icons.star}</span> Areas to Develop
          </h3>
          <div style="flex: 1;">
            ${imp.length ? bulletList(imp, 'improve') : '<p style="color:#64748b; font-size:13px; font-style:italic;">No critical development areas recorded.</p>'}
          </div>
        </div>
      </div>
    </div>

    <!-- PAGE 1 FOOTER -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 11px; font-weight: 600;">
      <div>Report Generated on ${dateStr}</div>
      <div>Powered by AI InterviewPrep & NVIDIA NIM</div>
      <div>Page 1 of ${totalPages}</div>
    </div>
  </div>

  ${qaPagesHtml}

</body></html>`;
}

// ─── Export ───────────────────────────────────────────────────────────────────
export async function exportInterviewPDF(feedback, userName = 'Candidate') {
  // Pre-calculate total pages so we know exactly how many to render
  const qa = (feedback.qa || []).filter(q => q.question && q.answer);
  const qaChunks = [];
  for (let i = 0; i < qa.length; i += 3) {
    qaChunks.push(qa.slice(i, i + 3));
  }
  const totalPages = 1 + qaChunks.length; // page 1 = summary, rest = Q&A pages

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:800px;';
  document.body.appendChild(wrap);

  const iframe = document.createElement('iframe');
  // Height: each page is 1130px + 40px gap, so max height for many pages
  iframe.style.cssText = `width:800px;height:${totalPages * 1200}px;border:none;display:block;`;
  wrap.appendChild(iframe);
  iframe.srcdoc = buildHTML(feedback, userName);

  // Wait for iframe to fully render
  await new Promise(res => { iframe.onload = () => setTimeout(res, 1000); });

  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pdfW = 210;
    const pdfH = 297;

    for (let pageIdx = 1; pageIdx <= totalPages; pageIdx++) {
      const pageEl = iframe.contentDocument?.getElementById(`page-${pageIdx}`);
      if (!pageEl) {
        console.warn(`⚠️ page-${pageIdx} not found in PDF iframe`);
        continue;
      }

      if (pageIdx > 1) doc.addPage();

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        height: 1130,
        windowWidth: 800,
        windowHeight: 1130,
      });

      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
    }

    const safe = userName.replace(/\s+/g, '_');
    doc.save(`AI_Interview_Report_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}
