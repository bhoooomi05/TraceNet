/* ═══════════════════════════════════════════════════
   TRACENET — SHARED SCRIPT (script.js)
   Used by both /index and /result
═══════════════════════════════════════════════════ */

/* ─── LOADER OVERLAY ─── */
function _ensureLoader() {
  if (document.getElementById('loader-overlay')) return;
  const el = document.createElement('div');
  el.id = 'loader-overlay';
  el.innerHTML = `
    <div class="loader-ring"><div class="loader-dot"></div></div>
    <div class="loader-text" id="loader-text">Processing...</div>
    <div class="loader-bar-wrap"><div class="loader-bar"></div></div>
  `;
  document.body.appendChild(el);
}

function showLoader(msg) {
  _ensureLoader();
  const el = document.getElementById('loader-overlay');
  const txt = document.getElementById('loader-text');
  if (txt) txt.textContent = msg || 'Processing...';
  el.classList.add('active');
}

function hideLoader() {
  const el = document.getElementById('loader-overlay');
  if (el) el.classList.remove('active');
}

/* ─── CURSOR ─── */
function initCursor() {
  const cur = document.getElementById('cursor');
  const dot = document.getElementById('cursor-dot');
  if (!cur || !dot) return;
  let cx = 0, cy = 0, tx = 0, ty = 0;
  document.addEventListener('mousemove', e => {
    tx = e.clientX; ty = e.clientY;
    dot.style.left = tx + 'px'; dot.style.top = ty + 'px';
  });
  (function animCursor() {
    cx += (tx - cx) * .12; cy += (ty - cy) * .12;
    cur.style.left = cx + 'px'; cur.style.top = cy + 'px';
    requestAnimationFrame(animCursor);
  })();
}

/* ─── THEME TOGGLE ─── */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('toggle-icon');
  const label = document.getElementById('toggle-label');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (label) label.textContent = isDark ? 'LIGHT' : 'DARK';
  localStorage.setItem('tracenet-theme', isDark ? 'light' : 'dark');
}

function applyStoredTheme() {
  const saved = localStorage.getItem('tracenet-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.getElementById('toggle-icon');
    const label = document.getElementById('toggle-label');
    if (icon) icon.textContent = saved === 'dark' ? '🌙' : '☀️';
    if (label) label.textContent = saved === 'dark' ? 'DARK' : 'LIGHT';
  }
}

/* ─── BG CANVAS — Network graph (same as home intro) ─── */
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 1000);
  cam.position.set(0, 0, 220);

  const nodeCount = 120, positions = [];
  for (let i = 0; i < nodeCount; i++) {
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), r = 60 + Math.random() * 100;
    positions.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)));
  }

  // Dark theme colors
  const DARK = { base: 0x3b82f6, fake: 0xf87171, det: 0x06b6d4, edge: 0x3b82f6, baseOp: .85, edgeOp: .25 };
  // Light theme colors — deeper/saturated so they show on white
  const LIGHT = { base: 0x1d4ed8, fake: 0xdc2626, det: 0x0891b2, edge: 0x1d4ed8, baseOp: .9, edgeOp: .35 };

  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';
  const C = () => isDark() ? DARK : LIGHT;

  const nodes = [], edges = [];
  positions.forEach((p, i) => {
    const g = new THREE.SphereGeometry(i === 0 ? 3.5 : 1.2 + Math.random(), 6, 6);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: C().base, transparent: true, opacity: C().baseOp }));
    m.position.copy(p); m.userData = { infected: false, detected: false, idx: i };
    scene.add(m); nodes.push(m);
  });
  const edgeMat = () => new THREE.LineBasicMaterial({ color: C().edge, transparent: true, opacity: C().edgeOp });
  for (let i = 0; i < nodeCount; i++) for (let j = i + 1; j < nodeCount; j++) {
    if (positions[i].distanceTo(positions[j]) < 55 && edges.length < 200) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([positions[i], positions[j]]), edgeMat());
      l.userData = { a: i, b: j, state: 'base' }; scene.add(l); edges.push(l);
    }
  }

  let infectedCount = 0;
  setTimeout(() => { nodes[0].material.color.setHex(C().fake); nodes[0].material.opacity = 1; nodes[0].userData.infected = true; infectedCount = 1; spread(); }, 800);

  function spread() {
    if (infectedCount >= nodeCount * .45) { setTimeout(() => detectAll(), 600); return; }
    setTimeout(() => {
      const infected = nodes.filter(n => n.userData.infected);
      const src = infected[Math.floor(Math.random() * infected.length)];
      edges.filter(e => e.userData.a === src.userData.idx || e.userData.b === src.userData.idx).forEach(edge => {
        const ti = edge.userData.a === src.userData.idx ? edge.userData.b : edge.userData.a;
        const t = nodes[ti];
        if (!t.userData.infected) {
          t.userData.infected = true; t.material.color.setHex(C().fake); t.material.opacity = 1;
          infectedCount++; edge.material.color.setHex(C().fake); edge.material.opacity = .6; edge.userData.state = 'fake';
        }
      });
      spread();
    }, 120);
  }

  function detectAll() {
    let di = 0;
    const int = setInterval(() => {
      if (di >= nodes.length) { clearInterval(int); setTimeout(() => resetNetwork(), 3000); return; }
      nodes[di].material.color.setHex(C().det); nodes[di].material.opacity = 1; nodes[di].userData.detected = true;
      edges.filter(e => e.userData.a === di || e.userData.b === di).forEach(e => { e.material.color.setHex(C().det); e.material.opacity = .5; e.userData.state = 'det'; });
      di++;
    }, 18);
  }

  function resetNetwork() {
    nodes.forEach(n => { n.userData.infected = false; n.userData.detected = false; n.material.color.setHex(C().base); n.material.opacity = C().baseOp; n.scale.setScalar(1); });
    edges.forEach(e => { e.material.color.setHex(C().edge); e.material.opacity = C().edgeOp; e.userData.state = 'base'; });
    infectedCount = 0;
    setTimeout(() => { nodes[0].material.color.setHex(C().fake); nodes[0].material.opacity = 1; nodes[0].userData.infected = true; infectedCount = 1; spread(); }, 1200);
  }

  // Re-tint all nodes/edges when theme toggles
  const origToggle = window.toggleTheme;
  window.toggleTheme = function() {
    origToggle && origToggle();
    setTimeout(() => {
      nodes.forEach(n => {
        if (n.userData.infected) { n.material.color.setHex(C().fake); }
        else if (n.userData.detected) { n.material.color.setHex(C().det); }
        else { n.material.color.setHex(C().base); n.material.opacity = C().baseOp; }
      });
      edges.forEach(e => {
        if (e.userData.state === 'fake') { e.material.color.setHex(C().fake); }
        else if (e.userData.state === 'det') { e.material.color.setHex(C().det); }
        else { e.material.color.setHex(C().edge); e.material.opacity = C().edgeOp; }
      });
    }, 50);
  };

  window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
  let t = 0;
  (function loop() {
    requestAnimationFrame(loop); t += .005;
    scene.rotation.y += .003; scene.rotation.x = Math.sin(t * .3) * .08;
    nodes.forEach((n, i) => { if (n.userData.infected && !n.userData.detected) { n.material.opacity = .85 + .15 * Math.sin(t * 4 + i); n.scale.setScalar(1 + .15 * Math.sin(t * 3 + i)); } });
    renderer.render(scene, cam);
  })();
}

/* ─── SCROLL REVEAL ─── */
function initScrollReveal() {
  const obs = new IntersectionObserver(es => {
    es.forEach((e, i) => {
      if (e.isIntersecting) { setTimeout(() => e.target.classList.add('up'), i * 60); obs.unobserve(e.target); }
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ═══════════════════════════════════════════════════
   KEYWORD DICTIONARIES
═══════════════════════════════════════════════════ */
const fakeKeywords = [
  'leaked', 'secret', 'confirmed', '100%', 'miracle', 'cure', 'government',
  'conspiracy', 'elite', 'banned', 'shocking', 'scientists admit', 'never told',
  'hidden', 'deep state', "they don't want", 'alternative', 'natural remedy',
  'exposed', 'cover-up', 'bombshell', 'urgent', 'truth revealed', 'wake up',
  'mainstream media', 'big pharma', 'suppressed', 'they lied', 'must share',
  'going viral', 'breaking:', 'hoax', 'staged', 'crisis actor', 'illuminati'
];

const realKeywords = [
  'according to', 'study found', 'researchers', 'published', 'peer-reviewed',
  'evidence suggests', 'reported', 'statistics', 'analysis', 'data shows',
  'officials said', 'confirmed by', 'experts say', 'sources indicate',
  'journal', 'university', 'government report', 'cited', 'reviewed',
  'findings', 'trial', 'methodology', 'sample size', 'margin of error'
];

const neutralKeywords = [
  'suggests', 'may', 'could', 'might', 'possible', 'potential', 'emerging',
  'preliminary', 'developing story', 'unclear', 'unconfirmed'
];

/* SOURCE DATABASE */
const sourceDatabase = [
  { domain: 'reuters.com', credibility: 94, bias: 'Center', type: 'Wire Service', verified: true },
  { domain: 'apnews.com', credibility: 95, bias: 'Center', type: 'Wire Service', verified: true },
  { domain: 'bbc.com', credibility: 91, bias: 'Center-Left', type: 'Public Broadcaster', verified: true },
  { domain: 'nytimes.com', credibility: 88, bias: 'Center-Left', type: 'Newspaper', verified: true },
  { domain: 'theguardian.com', credibility: 85, bias: 'Left-Center', type: 'Newspaper', verified: true },
  { domain: 'wsj.com', credibility: 87, bias: 'Center-Right', type: 'Newspaper', verified: true },
  { domain: 'foxnews.com', credibility: 56, bias: 'Right', type: 'Cable News', verified: true },
  { domain: 'cnn.com', credibility: 72, bias: 'Left-Center', type: 'Cable News', verified: true },
  { domain: 'naturalnews.com', credibility: 8, bias: 'Conspiracy', type: 'Pseudoscience', verified: false },
  { domain: 'infowars.com', credibility: 5, bias: 'Far-Right', type: 'Conspiracy', verified: false },
  { domain: 'breitbart.com', credibility: 22, bias: 'Far-Right', type: 'Opinion', verified: false },
  { domain: 'dailycaller.com', credibility: 40, bias: 'Right', type: 'News/Opinion', verified: false },
  { domain: 'huffpost.com', credibility: 68, bias: 'Left', type: 'News/Opinion', verified: true },
  { domain: 'vice.com', credibility: 71, bias: 'Left-Center', type: 'Digital Media', verified: true },
  { domain: 'buzzfeed.com', credibility: 60, bias: 'Left-Center', type: 'Digital Media', verified: true },
  { domain: 'snopes.com', credibility: 88, bias: 'Center', type: 'Fact Checker', verified: true },
  { domain: 'factcheck.org', credibility: 90, bias: 'Center', type: 'Fact Checker', verified: true },
  { domain: 'politifact.com', credibility: 87, bias: 'Center', type: 'Fact Checker', verified: true },
  { domain: 'who.int', credibility: 96, bias: 'Center', type: 'Health Authority', verified: true },
  { domain: 'cdc.gov', credibility: 94, bias: 'Center', type: 'Gov. Health Agency', verified: true },
  { domain: 'nature.com', credibility: 97, bias: 'Center', type: 'Scientific Journal', verified: true },
  { domain: 'science.org', credibility: 96, bias: 'Center', type: 'Scientific Journal', verified: true },
];

/* ═══════════════════════════════════════════════════
   CORE ANALYSIS ENGINE
═══════════════════════════════════════════════════ */
function analyzeText(text) {
  const lower = text.toLowerCase();

  // Keyword scoring
  const fakeMatches = fakeKeywords.filter(k => lower.includes(k));
  const realMatches = realKeywords.filter(k => lower.includes(k));
  const neutralMatches = neutralKeywords.filter(k => lower.includes(k));
  const fakeScore = fakeMatches.length;
  const realScore = realMatches.length;

  // Base prediction
  const isFake = fakeScore > realScore || text.length < 40;

  // Confidence calculation
  const rawDiff = Math.abs(fakeScore - realScore);
  const conf = Math.min(97, 58 + rawDiff * 9 + Math.floor(Math.random() * 10));

  // Credibility score
  const credScore = isFake
    ? Math.max(3, Math.min(30, 28 - fakeScore * 4 + realScore * 2 + Math.floor(Math.random() * 8)))
    : Math.max(50, Math.min(98, 55 + realScore * 6 - fakeScore * 3 + Math.floor(Math.random() * 12)));

  // Linguistic features
  const wordCount = text.trim().split(/\s+/).length;
  const sentenceCount = (text.match(/[.!?]/g) || []).length || 1;
  const avgWordsPerSentence = Math.round(wordCount / sentenceCount);
  const exclamationCount = (text.match(/!/g) || []).length;
  const capsWordCount = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const hasNumbers = /\d/.test(text);
  const hasUrl = /https?:\/\/|www\./i.test(text);

  // Sentiment score (simple)
  const positiveWords = ['great','amazing','wonderful','excellent','best','top','proven','success'];
  const negativeWords = ['terrible','worst','dangerous','deadly','failed','corrupt','evil','toxic'];
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  const sentimentScore = posCount - negCount;

  // Source detection from text
  let detectedSource = null;
  for (const src of sourceDatabase) {
    if (lower.includes(src.domain) || lower.includes(src.domain.split('.')[0])) {
      detectedSource = src;
      break;
    }
  }

  // Risk factors
  const riskFactors = [];
  if (exclamationCount >= 2) riskFactors.push({ label: 'Excessive exclamation', severity: 'high' });
  if (capsWordCount >= 3) riskFactors.push({ label: 'All-caps words', severity: 'high' });
  if (text.length < 100) riskFactors.push({ label: 'Very short — lacks context', severity: 'medium' });
  if (fakeScore >= 3) riskFactors.push({ label: `${fakeScore} sensationalist markers`, severity: 'high' });
  if (!hasNumbers) riskFactors.push({ label: 'No verifiable statistics', severity: 'medium' });
  if (avgWordsPerSentence > 30) riskFactors.push({ label: 'Complex sentence structure', severity: 'low' });
  if (questionCount >= 2) riskFactors.push({ label: 'Leading questions used', severity: 'medium' });

  // Credibility signals
  const credSignals = [];
  if (realScore >= 2) credSignals.push({ label: `${realScore} credible language markers`, strength: 'strong' });
  if (hasNumbers) credSignals.push({ label: 'Contains specific data/stats', strength: 'strong' });
  if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) credSignals.push({ label: 'Clear sentence structure', strength: 'moderate' });
  if (detectedSource && detectedSource.credibility > 80) credSignals.push({ label: `High-credibility source: ${detectedSource.domain}`, strength: 'strong' });
  if (neutralMatches.length > 0) credSignals.push({ label: 'Measured, hedged language', strength: 'moderate' });

  // Model scores (simulated ensemble)
  const baseIsFake = isFake ? 1 : 0;
  const models = {
    gbm: Math.min(99, Math.max(1, (baseIsFake ? 60 : 30) + fakeScore * 8 - realScore * 5 + Math.floor(Math.random() * 15))),
    pac: Math.min(99, Math.max(1, (baseIsFake ? 55 : 35) + fakeScore * 7 - realScore * 6 + Math.floor(Math.random() * 18))),
    lr:  Math.min(99, Math.max(1, (baseIsFake ? 52 : 32) + fakeScore * 6 - realScore * 4 + Math.floor(Math.random() * 14))),
    nb:  Math.min(99, Math.max(1, (baseIsFake ? 58 : 28) + fakeScore * 9 - realScore * 7 + Math.floor(Math.random() * 16))),
  };
  if (!isFake) {
    Object.keys(models).forEach(k => { models[k] = 100 - models[k]; });
  }

  // Timeline (simulated spread pattern)
  const timelineHours = [1, 2, 4, 6, 12, 24, 48, 72];
  const baseShares = isFake ? 800 : 200;
  const spreadMultiplier = isFake ? 3.5 : 1.4;
  const timeline = timelineHours.map((h, i) => ({
    hour: h,
    shares: Math.round(baseShares * Math.pow(spreadMultiplier, i * 0.4) * (0.85 + Math.random() * 0.3)),
    flags: isFake ? Math.round(h * 15 * (1 + Math.random() * 0.5)) : Math.round(h * 2 * (1 + Math.random() * 0.5))
  }));

  // Feature importance
  const featureImportance = [
    { name: 'Sensationalism Score', value: Math.min(100, fakeScore * 18 + Math.random() * 10), isFakeIndicator: true },
    { name: 'Source Credibility', value: detectedSource ? detectedSource.credibility : Math.round(40 + Math.random() * 30), isFakeIndicator: false },
    { name: 'Linguistic Authenticity', value: isFake ? Math.round(15 + Math.random() * 20) : Math.round(60 + Math.random() * 25), isFakeIndicator: false },
    { name: 'Factual Density', value: Math.min(100, realScore * 20 + Math.random() * 10), isFakeIndicator: false },
    { name: 'Emotional Manipulation', value: Math.min(100, (exclamationCount * 15 + capsWordCount * 12 + fakeScore * 10)), isFakeIndicator: true },
    { name: 'Verifiability Index', value: hasNumbers ? Math.round(55 + realScore * 8 + Math.random() * 15) : Math.round(20 + Math.random() * 20), isFakeIndicator: false },
  ];

  return {
    isFake, conf, credScore,
    fakeMatches, realMatches, neutralMatches,
    wordCount, sentenceCount, avgWordsPerSentence,
    exclamationCount, capsWordCount, questionCount, hasNumbers, hasUrl,
    sentimentScore, detectedSource, riskFactors, credSignals,
    models, timeline, featureImportance,
    text
  };
}

/* ═══════════════════════════════════════════════════
   BUILD JSON PAYLOAD
═══════════════════════════════════════════════════ */
function buildPayload(r) {
  const fakePct = r.isFake ? r.conf : 100 - r.conf;
  return {
    tracenet_version: '2.4.1',
    timestamp: new Date().toISOString(),
    verdict: r.isFake ? 'FAKE' : 'REAL',
    confidence_pct: r.conf,
    credibility_score: r.credScore,
    fake_probability_pct: fakePct,
    real_probability_pct: 100 - fakePct,
    input_text: r.text.length > 500 ? r.text.slice(0, 500) + '...' : r.text,
    input_stats: {
      word_count: r.wordCount,
      sentence_count: r.sentenceCount,
      avg_words_per_sentence: r.avgWordsPerSentence,
      exclamation_count: r.exclamationCount,
      caps_word_count: r.capsWordCount,
      question_count: r.questionCount,
      has_numbers: r.hasNumbers,
      has_url: r.hasUrl,
      sentiment_delta: r.sentimentScore
    },
    detected_signals: {
      fake_keywords: r.fakeMatches,
      real_keywords: r.realMatches,
      neutral_keywords: r.neutralMatches
    },
    source: r.detectedSource ? {
      domain: r.detectedSource.domain,
      credibility: r.detectedSource.credibility,
      bias: r.detectedSource.bias,
      type: r.detectedSource.type,
      verified: r.detectedSource.verified
    } : null,
    ensemble_models: {
      GBM: r.models.gbm,
      PAC: r.models.pac,
      LR: r.models.lr,
      NB: r.models.nb
    },
    feature_importance: r.featureImportance.map(f => ({
      name: f.name,
      value: Math.round(f.value),
      fake_indicator: f.isFakeIndicator
    })),
    risk_factors: r.riskFactors,
    credibility_signals: r.credSignals,
    spread_timeline: r.timeline
  };
}

function downloadResultJson(text) {
  const r = analyzeText(text);
  const payload = buildPayload(r);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'result.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/* ═══════════════════════════════════════════════════
   INDEX PAGE — runDemo
═══════════════════════════════════════════════════ */
function runDemo() {
  const input = document.getElementById('demo-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    input.style.borderColor = 'var(--red)';
    input.placeholder = 'Please enter some text to analyze...';
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
    return;
  }
  const btn = document.getElementById('analyze-btn');
  const proc = document.getElementById('demo-processing');
  btn.disabled = true;
  proc && proc.classList.add('active');
  for (let i = 0; i < 8; i++) { const l = document.getElementById(`pl-${i}`); if (l) l.classList.remove('show','done'); }
  let li = 0;
  const intv = setInterval(() => {
    if (li > 0) { const prev = document.getElementById(`pl-${li-1}`); if (prev) prev.classList.add('done'); }
    if (li >= 8) {
      clearInterval(intv);
      downloadResultJson(text);
      setTimeout(() => { btn.disabled = false; proc && proc.classList.remove('active'); }, 800);
      return;
    }
    const el = document.getElementById(`pl-${li}`);
    if (el) el.classList.add('show');
    li++;
  }, 300);
}

/* ═══════════════════════════════════════════════════
   RESULT PAGE — Full Analysis Display
═══════════════════════════════════════════════════ */
function runFullAnalysis() {
  const text = localStorage.getItem('newsInput');
  if (!text) {
    document.getElementById('result-content').innerHTML = `
      <div style="text-align:center;padding:4rem 2rem">
        <p style="font-family:'Orbitron',monospace;color:var(--red);font-size:1.2rem;letter-spacing:.1em">NO INPUT DETECTED</p>
        <p style="color:var(--muted);margin-top:1rem;font-family:'Share Tech Mono',monospace;font-size:.8rem">Please go back and enter text to analyze.</p>
        <a href="/index" class="back-btn" style="display:inline-block;margin-top:2rem">← BACK TO HOME</a>
      </div>`;
    return;
  }

  const result = analyzeText(text);
  renderAnalysis(result);
}

function renderAnalysis(r) {
  // Set header verdict
  const verdictEl = document.getElementById('result-verdict');
  const verdictBadge = document.getElementById('verdict-badge');
  if (verdictEl) {
    verdictEl.textContent = r.isFake ? 'FAKE' : 'REAL';
    verdictEl.className = 'result-big-verdict ' + (r.isFake ? 'fake' : 'real');
  }
  if (verdictBadge) {
    verdictBadge.textContent = r.isFake ? '⚠ MISINFORMATION DETECTED' : '✓ APPEARS CREDIBLE';
    verdictBadge.className = 'verdict-badge ' + (r.isFake ? 'fake' : 'real');
  }

  // Input preview
  const inputPreview = document.getElementById('input-preview');
  if (inputPreview) {
    inputPreview.textContent = r.text.length > 300 ? r.text.substring(0, 300) + '...' : r.text;
  }

  // Confidence & credibility
  animateValue('conf-display', 0, r.conf, 1200, '%');
  animateValue('cred-display', 0, r.credScore, 1400, '/100');

  setTimeout(() => {
    const confBar = document.getElementById('conf-bar-fill');
    const credBar = document.getElementById('cred-bar-fill');
    if (confBar) { confBar.className = 'bar-fill ' + (r.isFake ? 'fake' : 'real'); confBar.style.width = r.conf + '%'; }
    if (credBar) { credBar.className = 'bar-fill ' + (r.isFake ? 'fake' : 'real'); credBar.style.width = r.credScore + '%'; }
  }, 300);

  // Explanation
  const expEl = document.getElementById('explanation-text');
  if (expEl) {
    expEl.innerHTML = r.isFake
      ? `Analysis detected <strong style="color:var(--red)">${r.fakeMatches.length} misinformation pattern${r.fakeMatches.length !== 1 ? 's' : ''}</strong> in this text. Key signals include sensationalist framing, unverified claim structure, and linguistic features correlated with fabricated content. ${r.exclamationCount >= 2 ? 'Excessive use of exclamation marks signals emotional manipulation. ' : ''}${r.capsWordCount >= 2 ? 'All-caps words indicate attention-grabbing tactics common in fake news. ' : ''}Credibility score: <strong>${r.credScore}/100</strong>.`
      : `Analysis found <strong style="color:var(--green)">${r.realMatches.length} credibility indicator${r.realMatches.length !== 1 ? 's' : ''}</strong> consistent with factual reporting. The text uses measured language, ${r.hasNumbers ? 'references specific data points, ' : ''}and lacks typical emotional manipulation patterns. ${r.detectedSource ? `Source domain detected: <strong>${r.detectedSource.domain}</strong> (credibility: ${r.detectedSource.credibility}/100). ` : ''}Credibility score: <strong>${r.credScore}/100</strong>.`;
  }

  // Feature tags
  const tagsEl = document.getElementById('feature-tags-display');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    r.fakeMatches.forEach(k => {
      const t = document.createElement('span'); t.className = 'ftag neg'; t.textContent = k; tagsEl.appendChild(t);
    });
    r.realMatches.forEach(k => {
      const t = document.createElement('span'); t.className = 'ftag pos'; t.textContent = k; tagsEl.appendChild(t);
    });
    r.neutralMatches.forEach(k => {
      const t = document.createElement('span'); t.className = 'ftag neu'; t.textContent = k; tagsEl.appendChild(t);
    });
    if (!tagsEl.children.length) {
      const t = document.createElement('span'); t.className = 'ftag neu'; t.textContent = 'no strong markers detected'; tagsEl.appendChild(t);
    }
  }

  // Linguistic metrics
  setMetric('metric-words', r.wordCount);
  setMetric('metric-sentences', r.sentenceCount);
  setMetric('metric-avg-words', r.avgWordsPerSentence + ' words/sent');
  setMetric('metric-exclamations', r.exclamationCount);
  setMetric('metric-caps', r.capsWordCount);
  setMetric('metric-sentiment', r.sentimentScore > 0 ? '+' + r.sentimentScore : r.sentimentScore);

  // Risk factors
  const riskEl = document.getElementById('risk-factors');
  if (riskEl) {
    riskEl.innerHTML = r.riskFactors.length ? r.riskFactors.map(f =>
      `<div class="risk-item severity-${f.severity}"><span class="risk-icon">${f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟡' : '🟢'}</span><span>${f.label}</span></div>`
    ).join('') : `<div class="risk-item severity-low"><span class="risk-icon">🟢</span><span>No significant risk factors detected</span></div>`;
  }

  // Credibility signals
  const sigEl = document.getElementById('cred-signals');
  if (sigEl) {
    sigEl.innerHTML = r.credSignals.length ? r.credSignals.map(s =>
      `<div class="cred-signal-item strength-${s.strength}"><span class="cred-icon">✓</span><span>${s.label}</span></div>`
    ).join('') : `<div class="cred-signal-item strength-low"><span class="cred-icon">–</span><span>No strong credibility signals found</span></div>`;
  }

  // Model scores
  renderModelScores(r.models, r.isFake);

  // Source analysis
  renderSourceAnalysis(r.detectedSource, r.text);

  // JSON output
  renderJsonOutput(r);

  // Draw charts
  setTimeout(() => {
    drawVerdictSplitChart(r);
    drawConfidenceChart(r);
    drawFeatureChart(r.featureImportance);
    drawTimelineChart(r.timeline, r.isFake);
    drawModelRadar(r.models);
    drawSourceComparisonChart(r.detectedSource);
    drawKeywordHeatmap(r.fakeMatches, r.realMatches, r.neutralMatches);
  }, 400);
}

/* ─── MODEL SCORE BARS ─── */
function renderModelScores(models, isFake) {
  const el = document.getElementById('model-scores');
  if (!el) return;
  const modelInfo = [
    { key: 'gbm', name: 'Gradient Boosting', abbr: 'GBM' },
    { key: 'pac', name: 'Passive Aggressive', abbr: 'PAC' },
    { key: 'lr',  name: 'Logistic Regression', abbr: 'LR' },
    { key: 'nb',  name: 'Naive Bayes', abbr: 'NB' },
  ];
  el.innerHTML = modelInfo.map(m => `
    <div class="model-row">
      <div class="model-name"><span class="model-abbr">${m.abbr}</span>${m.name}</div>
      <div class="model-bar-wrap">
        <div class="model-bar-track">
          <div class="model-bar-fill ${isFake ? 'fake' : 'real'}" style="width:0" data-target="${models[m.key]}"></div>
        </div>
        <span class="model-pct">${models[m.key]}%</span>
      </div>
    </div>
  `).join('');
  setTimeout(() => {
    el.querySelectorAll('.model-bar-fill').forEach(b => {
      b.style.transition = 'width 1s ease';
      b.style.width = b.dataset.target + '%';
    });
  }, 200);
}

/* ─── SOURCE ANALYSIS ─── */
function renderSourceAnalysis(src, text) {
  const el = document.getElementById('source-analysis');
  if (!el) return;

  if (src) {
    const credColor = src.credibility >= 80 ? 'var(--green)' : src.credibility >= 50 ? 'var(--amber)' : 'var(--red)';
    el.innerHTML = `
      <div class="source-card detected">
        <div class="source-header">
          <div class="source-domain-badge">${src.domain}</div>
          <div class="source-verified">${src.verified ? '✓ INDEXED SOURCE' : '⚠ UNVERIFIED'}</div>
        </div>
        <div class="source-metrics-grid">
          <div class="source-metric"><div class="sm-label">CREDIBILITY</div><div class="sm-val" style="color:${credColor}">${src.credibility}/100</div></div>
          <div class="source-metric"><div class="sm-label">POLITICAL BIAS</div><div class="sm-val">${src.bias}</div></div>
          <div class="source-metric"><div class="sm-label">OUTLET TYPE</div><div class="sm-val">${src.type}</div></div>
          <div class="source-metric"><div class="sm-label">DB STATUS</div><div class="sm-val" style="color:${src.verified ? 'var(--green)' : 'var(--red)'}">${src.verified ? 'VERIFIED' : 'FLAGGED'}</div></div>
        </div>
        <div class="source-cred-bar-wrap">
          <div class="confidence-label"><span>SOURCE CREDIBILITY RATING</span><span>${src.credibility}%</span></div>
          <div class="confidence-bar"><div class="confidence-fill ${src.credibility >= 70 ? 'real' : 'fake'}" style="width:${src.credibility}%;transition:width 1.2s ease"></div></div>
        </div>
      </div>`;
  } else {
    // Cross-reference against known sources in text
    const mentionedSources = sourceDatabase.filter(s =>
      text.toLowerCase().includes(s.domain.split('.')[0])
    ).slice(0, 3);

    el.innerHTML = `
      <div class="source-card undetected">
        <div class="source-undetected-msg">
          <span style="font-size:1.5rem">🔍</span>
          <div>
            <div style="font-family:'Orbitron',monospace;font-size:.85rem;letter-spacing:.1em;color:var(--muted);margin-bottom:.4rem">NO DIRECT SOURCE DETECTED</div>
            <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--muted);line-height:1.6">Source URL or domain not found in text. Analysis based purely on linguistic patterns and content structure.</div>
          </div>
        </div>
        ${mentionedSources.length ? `
        <div style="margin-top:1.5rem">
          <div style="font-family:'Share Tech Mono',monospace;font-size:.65rem;letter-spacing:.15em;color:var(--cyan);margin-bottom:.8rem">POSSIBLE RELATED SOURCES IN DATABASE</div>
          ${mentionedSources.map(s => `
            <div class="source-mini-row">
              <span class="source-mini-domain">${s.domain}</span>
              <span class="source-mini-type">${s.type}</span>
              <span class="source-mini-cred" style="color:${s.credibility >= 80 ? 'var(--green)' : s.credibility >= 50 ? 'var(--amber)' : 'var(--red)'}">${s.credibility}/100</span>
            </div>`).join('')}
        </div>` : ''}
        <div class="source-db-stats">
          <span>📊 ${sourceDatabase.length} sources in TraceNet DB</span>
          <span>✓ ${sourceDatabase.filter(s => s.verified).length} verified outlets</span>
          <span>⚠ ${sourceDatabase.filter(s => !s.verified).length} flagged domains</span>
        </div>
      </div>`;
  }
}

/* ═══════════════════════════════════════════════════
   CANVAS CHARTS
═══════════════════════════════════════════════════ */

/* FAKE vs REAL split bar chart */
function drawVerdictSplitChart(r) {
  const canvas = document.getElementById('verdict-split-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio > 1 ? 2 : 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;

  const fakePct = r.isFake ? r.conf : 100 - r.conf;
  const realPct = 100 - fakePct;
  const padX = 12, padY = 28, barH = 28;
  const barW = w - padX * 2;
  const fakeW = (fakePct / 100) * barW;
  const realW = barW - fakeW;

  // Labels top
  ctx.font = 'bold 11px Orbitron, monospace';
  ctx.fillStyle = '#f87171'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('FAKE ' + fakePct + '%', padX, padY - 4);
  ctx.fillStyle = '#34d399'; ctx.textAlign = 'right';
  ctx.fillText('REAL ' + realPct + '%', padX + barW, padY - 4);

  // Background track
  ctx.fillStyle = 'rgba(100,116,139,0.15)';
  ctx.beginPath(); ctx.roundRect(padX, padY, barW, barH, 6); ctx.fill();

  // Animate fill
  let prog = 0;
  const target = fakePct / 100;
  (function anim() {
    prog = Math.min(prog + 0.025, target);
    ctx.clearRect(padX, padY, barW, barH + 30);

    // BG
    ctx.fillStyle = 'rgba(100,116,139,0.15)';
    ctx.beginPath(); ctx.roundRect(padX, padY, barW, barH, 6); ctx.fill();

    const curFakeW = prog * barW;
    const curRealW = barW - curFakeW;

    // Fake segment (left)
    if (curFakeW > 6) {
      const gF = ctx.createLinearGradient(padX, 0, padX + curFakeW, 0);
      gF.addColorStop(0, '#dc2626'); gF.addColorStop(1, '#f87171');
      ctx.fillStyle = gF;
      ctx.beginPath(); ctx.roundRect(padX, padY, curFakeW, barH, [6, 0, 0, 6]); ctx.fill();
    }

    // Real segment (right)
    if (curRealW > 6) {
      const gR = ctx.createLinearGradient(padX + curFakeW, 0, padX + barW, 0);
      gR.addColorStop(0, '#34d399'); gR.addColorStop(1, '#06b6d4');
      ctx.fillStyle = gR;
      ctx.beginPath(); ctx.roundRect(padX + curFakeW, padY, curRealW, barH, [0, 6, 6, 0]); ctx.fill();
    }

    // Divider line
    if (curFakeW > 2 && curRealW > 2) {
      ctx.strokeStyle = '#0a1628'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(padX + curFakeW, padY); ctx.lineTo(padX + curFakeW, padY + barH); ctx.stroke();
    }

    // Percentage labels inside bar
    ctx.font = 'bold 12px Orbitron, monospace'; ctx.textBaseline = 'middle';
    if (curFakeW > 50) {
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.fillText(Math.round(prog * 100) + '%', padX + 10, padY + barH / 2);
    }
    if (curRealW > 50) {
      ctx.fillStyle = '#0a1628'; ctx.textAlign = 'right';
      ctx.fillText(Math.round((1 - prog) * 100) + '%', padX + barW - 10, padY + barH / 2);
    }

    if (prog < target) requestAnimationFrame(anim);
  })();
}

/* Donut confidence chart */
function drawConfidenceChart(r) {
  const canvas = document.getElementById('confidence-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth * (devicePixelRatio > 1 ? 2 : 1);
  const H = canvas.height = canvas.offsetHeight * (devicePixelRatio > 1 ? 2 : 1);
  ctx.scale(devicePixelRatio > 1 ? 2 : 1, devicePixelRatio > 1 ? 2 : 1);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) * 0.38;
  const lineW = radius * 0.22;
  const fakeColor = '#f87171', realColor = '#34d399', bgColor = 'rgba(100,116,139,0.15)';
  const mainColor = r.isFake ? fakeColor : realColor;

  let progress = 0;
  const target = r.conf / 100;

  function draw(p) {
    ctx.clearRect(0, 0, w, h);
    // BG ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = bgColor; ctx.lineWidth = lineW; ctx.stroke();
    // Progress arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.strokeStyle = mainColor; ctx.lineWidth = lineW;
    ctx.lineCap = 'round'; ctx.stroke();
    // Center text
    ctx.fillStyle = mainColor;
    ctx.font = `bold ${Math.round(radius * 0.55)}px Orbitron, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(p * 100) + '%', cx, cy - radius * 0.12);
    ctx.fillStyle = '#64748b';
    ctx.font = `${Math.round(radius * 0.2)}px Share Tech Mono, monospace`;
    ctx.fillText('CONFIDENCE', cx, cy + radius * 0.25);
  }

  (function animate() {
    progress = Math.min(progress + 0.018, target);
    draw(progress);
    if (progress < target) requestAnimationFrame(animate);
  })();
}

/* Feature importance horizontal bar chart */
function drawFeatureChart(features) {
  const canvas = document.getElementById('feature-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio > 1 ? 2 : 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  const barH = 22, gap = 16, padL = 155, padR = 24, padT = 14;

  features.forEach((f, i) => {
    const y = padT + i * (barH + gap);
    const maxW = w - padL - padR;
    const barW = (f.value / 100) * maxW;
    const color = f.isFakeIndicator ? '#f87171' : '#34d399';
    const bgColor = f.isFakeIndicator ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)';

    // Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Share Tech Mono, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(f.name, padL - 10, y + barH / 2);

    // BG bar
    ctx.fillStyle = bgColor;
    roundRect(ctx, padL, y, maxW, barH, 4);

    // Fill bar (animated via requestAnimationFrame)
    ctx.fillStyle = color;
    roundRect(ctx, padL, y, barW, barH, 4);

    // Value label
    ctx.fillStyle = color;
    ctx.font = 'bold 11px Share Tech Mono, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(f.value + '%', padL + barW + 6, y + barH / 2);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/* Timeline spread chart */
function drawTimelineChart(timeline, isFake) {
  const canvas = document.getElementById('timeline-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio > 1 ? 2 : 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  const padL = 52, padR = 20, padT = 20, padB = 40;
  const chartW = w - padL - padR, chartH = h - padT - padB;

  const maxShares = Math.max(...timeline.map(d => d.shares));
  const maxFlags = Math.max(...timeline.map(d => d.flags));
  const maxVal = Math.max(maxShares, maxFlags) * 1.1;

  const shareColor = isFake ? '#f87171' : '#34d399';
  const flagColor = '#fbbf24';

  function xPos(i) { return padL + (i / (timeline.length - 1)) * chartW; }
  function yPos(v) { return padT + chartH - (v / maxVal) * chartH; }

  // Grid lines
  ctx.strokeStyle = 'rgba(100,116,139,0.15)'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = padT + (g / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '10px Share Tech Mono, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round((maxVal * (4 - g) / 4) / 1000) + 'K', padL - 6, y);
  }

  // Shares area fill
  ctx.beginPath();
  ctx.moveTo(xPos(0), padT + chartH);
  timeline.forEach((d, i) => ctx.lineTo(xPos(i), yPos(d.shares)));
  ctx.lineTo(xPos(timeline.length - 1), padT + chartH);
  ctx.closePath();
  const aGrad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  aGrad.addColorStop(0, shareColor + '40'); aGrad.addColorStop(1, shareColor + '05');
  ctx.fillStyle = aGrad; ctx.fill();

  // Shares line
  ctx.beginPath();
  timeline.forEach((d, i) => i === 0 ? ctx.moveTo(xPos(i), yPos(d.shares)) : ctx.lineTo(xPos(i), yPos(d.shares)));
  ctx.strokeStyle = shareColor; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

  // Flags line
  ctx.beginPath();
  timeline.forEach((d, i) => i === 0 ? ctx.moveTo(xPos(i), yPos(d.flags)) : ctx.lineTo(xPos(i), yPos(d.flags)));
  ctx.strokeStyle = flagColor; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.stroke();
  ctx.setLineDash([]);

  // Dots
  timeline.forEach((d, i) => {
    ctx.beginPath(); ctx.arc(xPos(i), yPos(d.shares), 4, 0, Math.PI * 2);
    ctx.fillStyle = shareColor; ctx.fill();
    ctx.beginPath(); ctx.arc(xPos(i), yPos(d.flags), 3, 0, Math.PI * 2);
    ctx.fillStyle = flagColor; ctx.fill();
  });

  // X labels
  ctx.fillStyle = '#475569'; ctx.font = '10px Share Tech Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  timeline.forEach((d, i) => ctx.fillText(`${d.hour}h`, xPos(i), padT + chartH + 8));

  // Legend
  ctx.fillStyle = shareColor; ctx.font = '10px Share Tech Mono, monospace'; ctx.textAlign = 'left';
  ctx.fillRect(padL, 4, 12, 3); ctx.fillText(isFake ? 'Spread' : 'Engagement', padL + 16, 0);
  ctx.fillStyle = flagColor;
  ctx.fillRect(padL + 100, 4, 12, 3); ctx.fillText('Flags/Reports', padL + 116, 0);
}

/* Radar chart for model scores */
function drawModelRadar(models) {
  const canvas = document.getElementById('radar-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio > 1 ? 2 : 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.36;
  const labels = ['GBM', 'PAC', 'LR', 'NB'];
  const values = [models.gbm / 100, models.pac / 100, models.lr / 100, models.nb / 100];
  const n = labels.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2;

  // Grid rings
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = startAngle + i * angleStep;
      const rr = (ring / 5) * r;
      const x = cx + rr * Math.cos(angle);
      const y = cy + rr * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(100,116,139,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.strokeStyle = 'rgba(100,116,139,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Data polygon
  ctx.beginPath();
  values.forEach((v, i) => {
    const angle = startAngle + i * angleStep;
    const x = cx + v * r * Math.cos(angle);
    const y = cy + v * r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  const radarGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  radarGrad.addColorStop(0, 'rgba(59,130,246,0.3)');
  radarGrad.addColorStop(1, 'rgba(167,139,250,0.1)');
  ctx.fillStyle = radarGrad; ctx.fill();
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.stroke();

  // Points & labels
  values.forEach((v, i) => {
    const angle = startAngle + i * angleStep;
    const x = cx + v * r * Math.cos(angle);
    const y = cy + v * r * Math.sin(angle);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#06b6d4'; ctx.fill();
    // Label
    const lx = cx + (r + 20) * Math.cos(angle);
    const ly = cy + (r + 20) * Math.sin(angle);
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 11px Share Tech Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], lx, ly);
    // Pct
    ctx.fillStyle = '#3b82f6'; ctx.font = '10px Share Tech Mono, monospace';
    ctx.fillText(Math.round(v * 100) + '%', x, y - 10);
  });
}

/* Source credibility comparison bar chart */
function drawSourceComparisonChart(detectedSource) {
  const canvas = document.getElementById('source-comparison-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio > 1 ? 2 : 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  const padL = 140, padR = 60, padT = 20, padB = 20;
  const chartW = w - padL - padR;
  const barH = Math.max(8, Math.floor((h - padT - padB) / sourceDatabase.length) - 3);
  sourceDatabase.forEach((src, i) => {
    const y = padT + i * (barH + 3);
    const barW = (src.credibility / 100) * chartW;
    const isDetected = detectedSource && detectedSource.domain === src.domain;
    const color = src.credibility >= 80 ? '#34d399' : src.credibility >= 50 ? '#fbbf24' : '#f87171';
    ctx.fillStyle = isDetected ? '#06b6d4' : '#94a3b8';
    ctx.font = (isDetected ? 'bold ' : '') + '10px Share Tech Mono, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(src.domain, padL - 8, y + barH / 2);
    ctx.fillStyle = 'rgba(100,116,139,0.1)';
    roundRect(ctx, padL, y, chartW, barH, 3);
    ctx.globalAlpha = isDetected ? 1 : 0.6;
    ctx.fillStyle = color;
    roundRect(ctx, padL, y, barW, barH, 3);
    ctx.globalAlpha = 1;
    if (isDetected) { ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1.5; ctx.strokeRect(padL - 1, y - 1, chartW + 2, barH + 2); }
    ctx.fillStyle = color;
    ctx.font = 'bold 10px Share Tech Mono, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(src.credibility, padL + barW + 5, y + barH / 2);
  });
  ctx.font = '10px Share Tech Mono, monospace'; ctx.textBaseline = 'top';
  [['#34d399','>=80 Credible'],['#fbbf24','50-79 Mixed'],['#f87171','<50 Low']].forEach(([c,l],i) => {
    ctx.fillStyle = c; ctx.fillRect(padL + i * 120, 2, 10, 8);
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'left'; ctx.fillText(l, padL + i * 120 + 14, 1);
  });
  if (detectedSource) {
    ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1; ctx.strokeRect(padL + 370, 1, 10, 8);
    ctx.fillStyle = '#06b6d4'; ctx.fillText('Detected Source', padL + 384, 1);
  }
}

/* Keyword heatmap */
function drawKeywordHeatmap(fakeMatches, realMatches, neutralMatches) {
  const el = document.getElementById('keyword-heatmap');
  if (!el) return;
  el.innerHTML = '';
  const all = [
    ...fakeMatches.map(k => [k, 'neg']),
    ...realMatches.map(k => [k, 'pos']),
    ...neutralMatches.map(k => [k, 'neu'])
  ];
  if (!all.length) { el.innerHTML = '<span class="kw-none">No keyword signals detected in this text.</span>'; return; }
  const maxCount = Math.max(fakeMatches.length, realMatches.length, 1);
  all.forEach(([k, type], idx) => {
    const intensity = (0.25 + 0.65 * ((idx % maxCount + 1) / maxCount)).toFixed(2);
    const cell = document.createElement('span');
    cell.className = 'kw-cell ' + type;
    cell.style.setProperty('--kw-alpha', intensity);
    cell.textContent = k;
    cell.title = type === 'neg' ? 'Misinformation signal' : type === 'pos' ? 'Credibility signal' : 'Neutral/hedging';
    el.appendChild(cell);
  });
}

/* ─── JSON OUTPUT ─── */
function renderJsonOutput(r) {
  const el = document.getElementById('json-output');
  if (!el) return;
  const payload = {
    tracenet_version: '2.4.1',
    timestamp: new Date().toISOString(),
    verdict: r.isFake ? 'FAKE' : 'REAL',
    confidence_pct: r.conf,
    credibility_score: r.credScore,
    fake_probability_pct: r.isFake ? r.conf : 100 - r.conf,
    real_probability_pct: r.isFake ? 100 - r.conf : r.conf,
    input_summary: {
      word_count: r.wordCount,
      sentence_count: r.sentenceCount,
      avg_words_per_sentence: r.avgWordsPerSentence,
      exclamation_count: r.exclamationCount,
      caps_word_count: r.capsWordCount,
      question_count: r.questionCount,
      has_numbers: r.hasNumbers,
      has_url: r.hasUrl,
      sentiment_delta: r.sentimentScore
    },
    detected_signals: {
      fake_keywords: r.fakeMatches,
      real_keywords: r.realMatches,
      neutral_keywords: r.neutralMatches
    },
    source: r.detectedSource ? {
      domain: r.detectedSource.domain,
      credibility: r.detectedSource.credibility,
      bias: r.detectedSource.bias,
      type: r.detectedSource.type,
      verified: r.detectedSource.verified
    } : null,
    ensemble_models: {
      GBM: r.models.gbm,
      PAC: r.models.pac,
      LR: r.models.lr,
      NB: r.models.nb
    },
    feature_importance: r.featureImportance.map(f => ({ name: f.name, value: f.value, fake_indicator: f.isFakeIndicator })),
    risk_factors: r.riskFactors,
    credibility_signals: r.credSignals,
    spread_timeline: r.timeline
  };
  window._traceJsonPayload = payload;
  el.innerHTML = syntaxHighlight(JSON.stringify(payload, null, 2));
}

function syntaxHighlight(json) {
  return json
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/("[^"]+")\s*:/g, '<span class="json-key">$1</span>:')
    .replace(/: ("[^"]*")/g, ': <span class="json-str">$1</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="json-num">$1</span>')
    .replace(/: (true)/g, ': <span class="json-bool-true">$1</span>')
    .replace(/: (false)/g, ': <span class="json-bool-false">$1</span>')
    .replace(/: (null)/g, ': <span class="json-null">$1</span>');
}

function copyJson() {
  if (!window._traceJsonPayload) return;
  navigator.clipboard.writeText(JSON.stringify(window._traceJsonPayload, null, 2)).then(() => {
    const btn = document.getElementById('json-copy-btn');
    if (btn) { btn.textContent = '\u2713 COPIED'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = '\u{1F4CB} COPY JSON'; btn.classList.remove('copied'); }, 2000); }
  });
}

/* ─── HELPERS ─── */
function animateValue(id, start, end, duration, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  const startTime = performance.now();
  function update(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (end - start) * eased) + suffix;
    if (p < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function setMetric(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─── CHALLENGE LOGIC (index only) ─── */
let userAnswer = null;
function userChose(answer) {
  userAnswer = answer;
  document.getElementById('choice-row').style.display = 'none';
  const a = document.getElementById('ml-analysis'); a.classList.add('active'); runMLSteps();
}
function runMLSteps() {
  let current = 0;
  function activateStep(i) {
    if (i >= 5) { showChallengeResult(); return; }
    const step = document.getElementById(`step-${i}`), fill = document.getElementById(`fill-${i}`), icon = document.getElementById(`icon-${i}`);
    step.classList.add('active'); icon.textContent = '↻';
    setTimeout(() => { fill.style.width = '100%'; }, 50);
    setTimeout(() => { step.classList.remove('active'); step.classList.add('done'); icon.textContent = '✓'; current++; activateStep(current); }, 2000);
  }
  activateStep(0);
}
function showChallengeResult() {
  const rc = document.getElementById('challenge-result'); rc.classList.add('show');
  setTimeout(() => { document.getElementById('conf-bar').style.width = '87%'; }, 400);
  const msg = document.getElementById('user-verdict-msg');
  if (userAnswer === 'fake') { msg.textContent = '✓ Good instinct — you correctly identified this as likely misinformation. TraceNet agrees with 87% confidence.'; msg.style.color = 'var(--green)'; }
  else { msg.textContent = '✗ This headline appeared credible — but TraceNet detected key misinformation patterns with 87% confidence. Easy to miss!'; msg.style.color = 'var(--amber)'; }

  // Run actual analysis on the challenge headline text
  const headlineText = (document.querySelector('.headline-text') ? document.querySelector('.headline-text').textContent : '') +
    ' ' + (document.querySelector('.headline-body') ? document.querySelector('.headline-body').textContent : '');
  const r = analyzeText(headlineText);

  // Mini model breakdown bars
  const barsEl = document.getElementById('challenge-model-bars');
  if (barsEl) {
    const modelInfo = [['GBM','gbm'],['PAC','pac'],['LR','lr'],['NB','nb']];
    barsEl.innerHTML = modelInfo.map(([abbr, key]) =>
      `<div class="ch-model-row"><span class="ch-model-label">${abbr}</span><div class="ch-model-track"><div class="ch-model-fill" data-w="${r.models[key]}"></div></div><span class="ch-model-pct">${r.models[key]}%</span></div>`
    ).join('');
    setTimeout(() => barsEl.querySelectorAll('.ch-model-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }), 200);
  }

  // Keyword signal heatmap
  const hmEl = document.getElementById('challenge-keyword-heatmap');
  if (hmEl) {
    const all = [
      ...r.fakeMatches.map(k => [k, 'neg']),
      ...r.realMatches.map(k => [k, 'pos']),
      ...r.neutralMatches.map(k => [k, 'neu'])
    ];
    hmEl.innerHTML = all.length
      ? all.map(([k, t]) => `<span class="ch-kw-tag ${t}">${k}</span>`).join('')
      : '<span style="font-family:Share Tech Mono,monospace;font-size:.65rem;color:var(--muted)">no strong signals</span>';
  }

  document.getElementById('pipeline').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showNameInput() { document.getElementById('name-wrap').classList.add('show'); }
function submitName() {
  const name = document.getElementById('name-in').value.trim(); if (!name) return;
  document.getElementById('name-wrap').innerHTML = `<p style="font-family:'Share Tech Mono',monospace;font-size:.85rem;color:var(--cyan);letter-spacing:.12em;text-align:center">Welcome, ${name}. The network is ready.</p>`;
}
