/**
 * TraceNet — Global Information Mobility Interface
 * map_component.js
 */

/* ═══════════════════════════════════════════
   COUNTRY DATA — ISO codes, names, coordinates, connections
═══════════════════════════════════════════ */
const COUNTRY_DATA = {
  USA: { name: "United States", region: "Americas", lat: 38, lng: -97,
    neighbors: ["CAN","MEX","GBR","DEU","JPN","AUS"],
    verified: [
      "Senate passes bipartisan climate resilience infrastructure bill",
      "Federal Reserve holds rates steady amid strong labor market data",
      "CDC issues updated respiratory illness prevention guidelines"
    ],
    suspicious: [
      "Secret government vaccine microchip program allegedly exposed by whistleblower",
      "CIA reportedly orchestrating global food shortage to control populations"
    ],
    intensity: 0.91
  },
  CAN: { name: "Canada", region: "Americas", lat: 60, lng: -96,
    neighbors: ["USA","GBR","FRA","DEU"],
    verified: [
      "Ottawa announces $4.2B investment in northern infrastructure",
      "Bank of Canada signals cautious rate path for remainder of year"
    ],
    suspicious: [
      "Foreign operatives allegedly infiltrating Canadian university research labs"
    ],
    intensity: 0.65
  },
  MEX: { name: "Mexico", region: "Americas", lat: 24, lng: -102,
    neighbors: ["USA","GTM","BRA","ESP"],
    verified: [
      "Mexico City invests in expanding metro system to reduce congestion",
      "Agricultural exports reach record high amid favorable trade agreements"
    ],
    suspicious: [
      "Cartels allegedly funding major political campaigns via crypto laundering"
    ],
    intensity: 0.72
  },
  BRA: { name: "Brazil", region: "Americas", lat: -14, lng: -51,
    neighbors: ["ARG","COL","MEX","PRT"],
    verified: [
      "Amazon deforestation rate drops 40% following new enforcement policies",
      "Brazil's tech sector sees record foreign direct investment in Q2"
    ],
    suspicious: [
      "5G towers in Amazon allegedly linked to illegal surveillance operations"
    ],
    intensity: 0.78
  },
  ARG: { name: "Argentina", region: "Americas", lat: -38, lng: -63,
    neighbors: ["BRA","CHL","ESP"],
    verified: [
      "Argentina secures IMF restructuring deal stabilizing peso exchange rate",
      "Buenos Aires inaugurates solar energy grid serving 200,000 homes"
    ],
    suspicious: [
      "Foreign hedge funds allegedly coordinating economic destabilization campaign"
    ],
    intensity: 0.61
  },
  GBR: { name: "United Kingdom", region: "Europe", lat: 55, lng: -3,
    neighbors: ["IRL","FRA","DEU","USA","AUS"],
    verified: [
      "Parliament approves £12B digital infrastructure modernization package",
      "NHS announces AI-assisted diagnostics rollout across 200 hospitals",
      "UK inflation falls to 18-month low following Bank of England measures"
    ],
    suspicious: [
      "MI6 allegedly planting misinformation in allied nation media networks",
      "Royal family reportedly using shell companies to fund offshore surveillance"
    ],
    intensity: 0.84
  },
  FRA: { name: "France", region: "Europe", lat: 46, lng: 2,
    neighbors: ["DEU","ESP","ITA","GBR","BEL"],
    verified: [
      "French National Assembly approves landmark AI transparency legislation",
      "Paris climate summit yields binding commitments from 47 nations",
      "Eurozone economic expansion led by French manufacturing sector"
    ],
    suspicious: [
      "Élysée Palace allegedly running covert influence ops across Francophone Africa"
    ],
    intensity: 0.76
  },
  DEU: { name: "Germany", region: "Europe", lat: 51, lng: 10,
    neighbors: ["FRA","POL","AUT","NLD","GBR"],
    verified: [
      "Bundestag passes sweeping industrial transition package for green economy",
      "Deutsche Bundesbank reports stable growth with controlled inflation",
      "Germany accelerates hydrogen infrastructure amid energy independence push"
    ],
    suspicious: [
      "BND allegedly sharing private citizen data with foreign intelligence agencies"
    ],
    intensity: 0.81
  },
  ITA: { name: "Italy", region: "Europe", lat: 42, lng: 12,
    neighbors: ["FRA","AUT","CHE","GRC"],
    verified: [
      "Rome's ancient aqueduct network successfully restored after 40-year effort",
      "Italian tech startups attract €3.2B in venture capital funding"
    ],
    suspicious: [
      "Organized crime networks allegedly infiltrating EU agricultural subsidies"
    ],
    intensity: 0.66
  },
  ESP: { name: "Spain", region: "Europe", lat: 40, lng: -4,
    neighbors: ["FRA","PRT","MAR","MEX","BRA"],
    verified: [
      "Spain becomes Europe's largest solar energy exporter",
      "Barcelona unveils pedestrian-first urban mobility master plan"
    ],
    suspicious: [
      "Separatist movements allegedly funded by foreign state actors via NGOs"
    ],
    intensity: 0.69
  },
  RUS: { name: "Russia", region: "Europe/Asia", lat: 61, lng: 105,
    neighbors: ["CHN","UKR","KAZ","FIN","USA"],
    verified: [
      "Kremlin announces economic diversification plan reducing oil dependency",
      "Trans-Siberian rail modernization project enters final construction phase"
    ],
    suspicious: [
      "Troll farm network allegedly flooding EU social media with election content",
      "State media reportedly fabricating crisis footage for global distribution",
      "FSB allegedly deploying deepfake technology against opposition leaders"
    ],
    intensity: 0.95
  },
  CHN: { name: "China", region: "Asia", lat: 35, lng: 105,
    neighbors: ["RUS","IND","JPN","KOR","VNM","AUS"],
    verified: [
      "Beijing announces carbon neutrality roadmap with sector-specific targets",
      "PBOC launches expanded digital yuan pilot in 12 major cities",
      "China's renewable energy capacity surpasses coal for first time"
    ],
    suspicious: [
      "PLA cyber unit allegedly infiltrating supply chain firmware globally",
      "State-linked firms reportedly funding disinformation campaigns in Southeast Asia",
      "TikTok algorithm allegedly used for geopolitical sentiment manipulation"
    ],
    intensity: 0.93
  },
  IND: { name: "India", region: "Asia", lat: 20, lng: 77,
    neighbors: ["PAK","CHN","BGD","LKA","AUS"],
    verified: [
      "Unified Payments Interface crosses 15 billion monthly transactions milestone",
      "India launches world's largest rural broadband connectivity program",
      "New Delhi signs digital trade agreements with 22 nations"
    ],
    suspicious: [
      "Social media platforms allegedly amplifying sectarian tensions via algorithm bias",
      "Foreign-funded NGOs reportedly coordinating anti-infrastructure protests"
    ],
    intensity: 0.88
  },
  JPN: { name: "Japan", region: "Asia", lat: 36, lng: 138,
    neighbors: ["CHN","KOR","RUS","USA","AUS"],
    verified: [
      "Tokyo announces 2030 hydrogen economy transition roadmap",
      "Japan's robotics exports reach $48B as automation demand surges",
      "Bank of Japan exits negative interest rate policy amid wage growth"
    ],
    suspicious: [
      "North Korean operatives allegedly targeting Japanese defense contractors via LinkedIn"
    ],
    intensity: 0.79
  },
  KOR: { name: "South Korea", region: "Asia", lat: 37, lng: 128,
    neighbors: ["JPN","CHN","PRK"],
    verified: [
      "Seoul's semiconductor industry secures $200B expansion investment plan",
      "K-culture economic impact reaches record $12B in annual exports"
    ],
    suspicious: [
      "North Korea allegedly deploying AI-generated propaganda targeting Korean diaspora"
    ],
    intensity: 0.74
  },
  AUS: { name: "Australia", region: "Oceania", lat: -25, lng: 133,
    neighbors: ["NZL","IDN","IND","JPN","CHN"],
    verified: [
      "Canberra announces $30B critical minerals development strategy",
      "Great Barrier Reef restoration program reports first coral recovery milestone",
      "Australia-Pacific digital connectivity cable network inaugurated"
    ],
    suspicious: [
      "Foreign state actors allegedly manipulating Australian media ownership structures"
    ],
    intensity: 0.71
  },
  ZAF: { name: "South Africa", region: "Africa", lat: -29, lng: 25,
    neighbors: ["MOZ","ZWE","BWA","NAM","NGA"],
    verified: [
      "Cape Town completes largest urban desalination plant on continent",
      "Johannesburg tech corridor attracts African continental startup hub status"
    ],
    suspicious: [
      "External actors allegedly interfering with Eskom infrastructure via cyberattacks"
    ],
    intensity: 0.63
  },
  NGA: { name: "Nigeria", region: "Africa", lat: 9, lng: 8,
    neighbors: ["GHA","CMR","BEN","NER","ZAF"],
    verified: [
      "Lagos inaugurates Africa's first fully elevated metro rail system",
      "Nigeria's digital banking sector surpasses 80 million active users"
    ],
    suspicious: [
      "Cryptocurrency scam networks allegedly operating with political protection in Lagos"
    ],
    intensity: 0.68
  },
  EGY: { name: "Egypt", region: "Africa/Middle East", lat: 26, lng: 30,
    neighbors: ["LBY","SDN","ISR","SAU"],
    verified: [
      "Suez Canal expansion increases annual shipping capacity by 30%",
      "Cairo's new administrative capital energy grid runs on 100% solar"
    ],
    suspicious: [
      "State media allegedly censoring protests and embedding disinformation in broadcasts"
    ],
    intensity: 0.70
  },
  SAU: { name: "Saudi Arabia", region: "Middle East", lat: 24, lng: 45,
    neighbors: ["UAE","IRQ","JOR","EGY","IRN"],
    verified: [
      "NEOM project Phase 1 completion ahead of revised 2026 schedule",
      "Saudi Aramco announces $50B diversification into petrochemicals and AI"
    ],
    suspicious: [
      "MBS-linked accounts allegedly running coordinated Twitter manipulation networks"
    ],
    intensity: 0.75
  },
  IRN: { name: "Iran", region: "Middle East", lat: 32, lng: 53,
    neighbors: ["IRQ","SAU","AFG","PAK","TUR"],
    verified: [
      "Tehran nuclear talks resume under new multilateral framework",
      "Iran's non-oil exports reach $60B amid regional trade diversification"
    ],
    suspicious: [
      "IRGC cyber units allegedly targeting financial infrastructure in Gulf states",
      "State broadcaster reportedly fabricating protest footage for domestic news"
    ],
    intensity: 0.86
  },
  TUR: { name: "Turkey", region: "Europe/Asia", lat: 39, lng: 35,
    neighbors: ["GRC","BGR","IRN","SYR","RUS"],
    verified: [
      "Ankara mediates historic Black Sea grain corridor renewal agreement",
      "Istanbul completes third Bosphorus tunnel, cutting cross-city travel by 40%"
    ],
    suspicious: [
      "Turkish social media bots allegedly amplifying migrant crisis narratives in EU"
    ],
    intensity: 0.72
  },
  PAK: { name: "Pakistan", region: "Asia", lat: 30, lng: 69,
    neighbors: ["IND","AFG","IRN","CHN"],
    verified: [
      "CPEC Phase 2 infrastructure projects create 180,000 new jobs",
      "Karachi digital financial district attracts first global fintech partners"
    ],
    suspicious: [
      "Inter-services intelligence allegedly amplifying anti-India narratives via fake accounts"
    ],
    intensity: 0.77
  },
  IDN: { name: "Indonesia", region: "Asia", lat: -5, lng: 120,
    neighbors: ["MYS","TLS","AUS","PHL","CHN"],
    verified: [
      "Jakarta's new capital Nusantara achieves first government operations milestone",
      "Indonesia secures $20B green transition financing from ASEAN partners"
    ],
    suspicious: [
      "Foreign fishing fleets allegedly coordinating with media to misrepresent territorial disputes"
    ],
    intensity: 0.66
  },
  BRA_OBS: { name: "Brazil", region: "Americas", lat: -10, lng: -52 },
  ISR: { name: "Israel", region: "Middle East", lat: 31, lng: 35,
    neighbors: ["EGY","JOR","LBN","USA"],
    verified: [
      "Jerusalem tech sector records second-highest global startup density",
      "Israel-Jordan water sharing agreement extended with expanded capacity"
    ],
    suspicious: [
      "Unit 8200 alumni allegedly founding surveillance firms supplying authoritarian regimes"
    ],
    intensity: 0.83
  },
  NLD: { name: "Netherlands", region: "Europe", lat: 52, lng: 5,
    neighbors: ["DEU","BEL","GBR","FRA"],
    verified: [
      "Rotterdam port fully electrifies ground cargo operations",
      "Dutch semiconductor sector lobbying for coordinated EU chip sovereignty strategy"
    ],
    suspicious: [
      "Amsterdam-based media networks allegedly used as laundering front for foreign influence ops"
    ],
    intensity: 0.67
  },
  SWE: { name: "Sweden", region: "Europe", lat: 62, lng: 15,
    neighbors: ["NOR","FIN","DNK","DEU"],
    verified: [
      "Stockholm achieves carbon neutral city status six years ahead of target",
      "SSAB delivers world's first fossil-free steel to Volvo production line"
    ],
    suspicious: [
      "Russian operatives allegedly targeting Swedish military networks with spear-phishing"
    ],
    intensity: 0.60
  },
  CHE: { name: "Switzerland", region: "Europe", lat: 47, lng: 8,
    neighbors: ["DEU","FRA","ITA","AUT"],
    verified: [
      "Geneva hosts landmark AI governance framework negotiations",
      "Swiss National Bank publishes green finance transition stress test results"
    ],
    suspicious: [
      "Dark web intelligence: oligarch assets allegedly cycling through Swiss accounts"
    ],
    intensity: 0.62
  },
  UKR: { name: "Ukraine", region: "Europe", lat: 49, lng: 32,
    neighbors: ["RUS","POL","ROU","HUN","BLR"],
    verified: [
      "Kyiv reconstruction bonds oversubscribed 3x in international markets",
      "Ukraine's drone manufacturing sector emerges as exportable defense technology"
    ],
    suspicious: [
      "Russian propaganda network allegedly fabricating civilian harm footage at scale",
      "Deepfake audio of Ukrainian officials circulating in Eastern European media"
    ],
    intensity: 0.94
  },
  POL: { name: "Poland", region: "Europe", lat: 52, lng: 20,
    neighbors: ["DEU","CZE","UKR","BLR","RUS"],
    verified: [
      "Warsaw becomes EU's fastest-growing tech talent hub for second year",
      "Poland accelerates nuclear energy program amid energy security concerns"
    ],
    suspicious: [
      "Domestic media polarization allegedly coordinated with external interference campaign"
    ],
    intensity: 0.69
  },
  KEN: { name: "Kenya", region: "Africa", lat: 1, lng: 38,
    neighbors: ["ETH","TZA","UGA","SOM"],
    verified: [
      "Nairobi becomes Sub-Saharan Africa's largest fintech innovation hub",
      "Kenya's geothermal energy program now powers 60% of national grid"
    ],
    suspicious: [
      "Chinese-linked infrastructure loans allegedly tied to covert data sharing agreements"
    ],
    intensity: 0.64
  },
  MEX_FOCAL: { name: "Mexico", region: "Americas" },
  ARG_FOCAL: { name: "Argentina", region: "Americas" }
};

/* ═══════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════ */
const state = {
  theme: 'dark',
  mode: 'suspicious',  // 'verified' | 'suspicious'
  activeCountry: null,
  connectedCountries: [],
  particles: [],
  edges: [],
  nodes: {},
  animFrame: null,
  mouseX: 0,
  mouseY: 0,
  hoverCountry: null,
  totalNodes: 0,
  totalEdges: 0
};

/* ═══════════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════════ */
let canvas, ctx, svgMap, tooltip, panelContent, panelEmpty;

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
function init() {
  canvas    = document.getElementById('network-canvas');
  ctx       = canvas.getContext('2d');
  svgMap    = document.getElementById('world-map');
  tooltip   = document.getElementById('tooltip');
  panelContent = document.getElementById('panel-content');
  panelEmpty   = document.getElementById('panel-empty');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
 

  bindCountryEvents();
  bindControls();
  bindMouseParallax();
  startAnimation();

  // Hide loading
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 1400);

  updateStats(0, 0);
}

function resizeCanvas() {
  const mapArea = document.getElementById('map-area');
  canvas.width  = mapArea.offsetWidth;
  canvas.height = mapArea.offsetHeight;
}
const NAME_TO_ISO = {
  "united states": "USA", "united states of america": "USA", "us": "USA",
  "canada": "CAN",
  "mexico": "MEX",
  "brazil": "BRA",
  "argentina": "ARG",
  "united kingdom": "GBR", "great britain": "GBR", "england": "GBR", "uk": "GBR",
  "france": "FRA",
  "germany": "DEU",
  "italy": "ITA",
  "spain": "ESP",
  "russia": "RUS", "russian federation": "RUS",
  "china": "CHN",
  "india": "IND",
  "japan": "JPN",
  "south korea": "KOR", "korea": "KOR",
  "australia": "AUS",
  "south africa": "ZAF",
  "nigeria": "NGA",
  "egypt": "EGY",
  "saudi arabia": "SAU",
  "iran": "IRN",
  "turkey": "TUR", "türkiye": "TUR",
  "pakistan": "PAK",
  "indonesia": "IDN",
  "israel": "ISR",
  "netherlands": "NLD", "holland": "NLD",
  "sweden": "SWE",
  "switzerland": "CHE",
  "ukraine": "UKR",
  "poland": "POL",
  "kenya": "KEN"
};
function getCountryId(el) {
  if (!el) return null;

  // THE FIX: Only look at the exact path hovered, and its immediate <g> folder.
  // Do NOT climb up to the <svg> wrapper or <body> (which causes the Oman bug)
  const nodesToCheck = [el];
  if (el.parentNode && el.parentNode.tagName && el.parentNode.tagName.toLowerCase() === 'g') {
    nodesToCheck.push(el.parentNode);
  }

  let fallbackId = null;
  let fallbackName = null;

  for (let current of nodesToCheck) {
    const rawId = current.id;
    const rawName = current.getAttribute('name') || current.getAttribute('title');
    // Strip out the word 'country' so it doesn't mess up our matching
    const classString = (current.getAttribute('class') || '').replace(/country/gi, '').trim();

    const attributesToCheck = [rawId, rawName, classString];

    for (let raw of attributesToCheck) {
      if (!raw || typeof raw !== 'string') continue;
      
      const cleanFull = raw.trim();
      if (!cleanFull) continue;

      if (!fallbackId && rawId) fallbackId = rawId.toUpperCase();
      if (!fallbackName && rawName) fallbackName = rawName;
      if (!fallbackName && classString) fallbackName = classString;

      const lowerFull = cleanFull.toLowerCase();
      const upperFull = cleanFull.toUpperCase();

      // 1. Check exact matches first
      if (COUNTRY_DATA[upperFull]) return upperFull;
      if (NAME_TO_ISO[lowerFull]) return NAME_TO_ISO[lowerFull];
      if (COUNTRY_DATA[cleanFull]) return cleanFull;
      
      // 2. Check individual words
      const parts = cleanFull.split(/\s+|-|_/); 
      for (let part of parts) {
        const cleanPart = part.trim();
        if (!cleanPart) continue;
        
        const lowerPart = cleanPart.toLowerCase();
        const upperPart = cleanPart.toUpperCase();

        if (COUNTRY_DATA[upperPart]) return upperPart;
        if (NAME_TO_ISO[lowerPart]) return NAME_TO_ISO[lowerPart];
        if (COUNTRY_DATA[cleanPart]) return cleanPart;
      }
    }
  }

  // Generate dynamic data for missing countries
  if (fallbackId || fallbackName) {
    // Safety check to prevent generic SVG tags from becoming countries
    if (fallbackName && (fallbackName.toLowerCase() === 'map' || fallbackName.toLowerCase() === 'world')) return null;

    const finalId = fallbackId || (fallbackName ? fallbackName.substring(0, 3).toUpperCase() : null);
    
    if (finalId && !COUNTRY_DATA[finalId]) {
      COUNTRY_DATA[finalId] = {
        name: fallbackName || finalId,
        region: "Global Territory",
        intensity: 0.4,
        neighbors: ["USA", "GBR", "CHN"], 
        verified: ["Monitoring standard data channels...", "Local infrastructure operating nominally."],
        suspicious: ["Low-level anomalous background noise detected."]
      };
    }
    return finalId;
  }

  return null;
}

/* ═══════════════════════════════════════════
   COUNTRY INTERACTION
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   COUNTRY INTERACTION
═══════════════════════════════════════════ */
function bindCountryEvents() {
  const allElements = svgMap.querySelectorAll('path, g');
  
  // --- THE MAINLAND FIX ---
  // The SVG put the official 'id' on tiny islands (like Hawaii) instead of the mainland.
  // This automatically finds the biggest landmass for each country and moves the node there.
  const countryElements = {};
  
  allElements.forEach(el => {
    const id = getCountryId(el);
    if (id) {
      if (!countryElements[id]) countryElements[id] = [];
      countryElements[id].push(el);
    }
  });

  Object.keys(countryElements).forEach(id => {
    const pieces = countryElements[id];
    if (pieces.length > 1) {
      let largestPiece = null;
      let maxArea = -1;
      
      pieces.forEach(p => {
        // Safely rename the old island ID so the map stops spawning nodes in the ocean
        if (p.id === id) p.id = id + '_island'; 
        
        // Find the actual mainland by calculating the largest pixel area
        if (p.getBBox) {
          try {
            const box = p.getBBox();
            const area = box.width * box.height;
            if (area > maxArea) {
              maxArea = area;
              largestPiece = p;
            }
          } catch(e) {} // Catch errors for hidden elements
        }
      });
      
      // Give the official ID to the mainland so the node spawns exactly in the center
      if (largestPiece) largestPiece.id = id;
    }
  });

  // Bind the mouse events
  allElements.forEach(el => {
    el.addEventListener('mouseenter', onCountryHover);
    el.addEventListener('mouseleave', onCountryLeave);
    el.addEventListener('click',      onCountryClick);
  });
}

function onCountryHover(e) {
  const id = getCountryId(e.target);
  if (!id) return;
  state.hoverCountry = id;
  showTooltip(e, id);
}

function onCountryLeave(e) {
  state.hoverCountry = null;
  hideTooltip();
}

function onCountryClick(e) {
  e.stopPropagation();
  const id = getCountryId(e.target);

  if (!id || !COUNTRY_DATA[id]) {
    // IF IT FAILS, THIS WILL TELL YOU WHY IN THE CONSOLE
    console.warn("❌ MAP CLICK FAILED. No matching country found.");
    console.warn("You clicked on:", e.target);
    console.warn("Parent element is:", e.target.parentNode);
    return;
  }
  
  clearConnections();
  setActiveCountry(id);
  buildNetwork(id);
  updatePanel(id);
}
/* ═══════════════════════════════════════════
   TOOLTIP
═══════════════════════════════════════════ */
function showTooltip(e, id) {
  const data = COUNTRY_DATA[id];
  if (!data) return;

  const isVerified = state.mode === 'verified';
  const headlines = isVerified ? data.verified : data.suspicious;
  const headline  = headlines ? headlines[0] : 'Monitoring...';

  document.getElementById('tt-name').textContent = data.name || id;
  document.getElementById('tt-headline').textContent = headline;
  const ttMode = document.getElementById('tt-mode');
  ttMode.className = 'tooltip-indicator' + (isVerified ? '' : ' suspect');
  const ttDot = ttMode.querySelector('.tip-dot');
  const ttSpan = ttMode.querySelector('span');
  if (ttDot && ttSpan) {
    ttSpan.textContent = isVerified ? 'VERIFIED SIGNAL' : 'SUSPICIOUS SIGNAL';
  }

  moveTooltip(e);
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

function moveTooltip(e) {
  let x = e.clientX + 16;
  let y = e.clientY - 10;
  const tw = tooltip.offsetWidth || 200;
  if (x + tw > window.innerWidth - 10) x = e.clientX - tw - 16;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

document.addEventListener('mousemove', e => {
  if (state.hoverCountry) moveTooltip(e);
});

/* ═══════════════════════════════════════════
   NETWORK BUILDING
═══════════════════════════════════════════ */
function setActiveCountry(id) {
  // Remove previous active
  svgMap.querySelectorAll('.country.active').forEach(el => {
    el.classList.remove('active', 'suspect-mode');
  });
  svgMap.querySelectorAll('.country.connected').forEach(el => {
    el.classList.remove('connected', 'suspect-mode');
  });

  state.activeCountry = id;
  const el = svgMap.getElementById(id) || document.getElementById(id);
  if (el) {
    el.classList.add('active');
    if (state.mode === 'suspicious') el.classList.add('suspect-mode');
  }
}

function buildNetwork(originId) {
  const data = COUNTRY_DATA[originId];
  if (!data || !data.neighbors) return;

  // Pick 2-4 neighbors (prefer nearby + 1 global)
  const neighbors = data.neighbors.slice();
  shuffle(neighbors);
  const count = 2 + Math.floor(Math.random() * 3);
  const chosen = neighbors.slice(0, count);

  state.connectedCountries = chosen;
  state.nodes = {};
  state.edges = [];
  state.totalNodes = chosen.length;
  state.totalEdges = chosen.length;

  // Get SVG positions
  const originPos = getCountryCenter(originId);
  if (!originPos) return;

  state.nodes[originId] = { ...originPos, id: originId, radius: 8, pulse: 0, born: performance.now() };

  chosen.forEach((cid, i) => {
    const pos = getCountryCenter(cid);
    if (!pos) return;

    // Highlight connected country
    const el = document.getElementById(cid);
    if (el) {
      el.classList.add('connected');
      if (state.mode === 'suspicious') el.classList.add('suspect-mode');
    }

    state.nodes[cid] = { ...pos, id: cid, radius: 5, pulse: 0, born: performance.now() + i * 200 };

    state.edges.push({
      from: originId,
      to: cid,
      fromPos: originPos,
      toPos: pos,
      progress: 0,
      delay: i * 300,
      born: performance.now(),
      particles: []
    });
  });

  updateStats(state.totalNodes, state.totalEdges);
}

function getCountryCenter(id) {
  // Try SVG element bounding box first
  const el = svgMap.getElementById(id) || document.getElementById(id);
  if (!el) return fallbackLatLng(id);

  try {
    const svgEl = document.getElementById('world-map');
    const bbox  = el.getBBox();
    const cx    = bbox.x + bbox.width / 2;
    const cy    = bbox.y + bbox.height / 2;
    const pt    = svgEl.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm  = svgEl.getScreenCTM();
    if (!ctm) return fallbackLatLng(id);
    const screen = pt.matrixTransform(ctm);
    const rect   = canvas.getBoundingClientRect();
    return { x: screen.x - rect.left, y: screen.y - rect.top };
  } catch (err) {
    return fallbackLatLng(id);
  }
}

function fallbackLatLng(id) {
  const data = COUNTRY_DATA[id];
  if (!data || data.lat === undefined) return null;
  // Equirectangular projection
  const mapW = canvas.width;
  const mapH = canvas.height;
  const x = (data.lng + 180) / 360 * mapW;
  const y = (90 - data.lat)  / 180 * mapH;
  return { x, y };
}

function clearConnections() {
  state.nodes = {};
  state.edges = [];
  state.particles = [];
  state.connectedCountries = [];
}

/* ═══════════════════════════════════════════
   ANIMATION LOOP
═══════════════════════════════════════════ */
function startAnimation() {
  function loop() {
    state.animFrame = requestAnimationFrame(loop);
    render();
  }
  loop();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = performance.now();
  const isVerified = state.mode === 'verified';

  // Draw edges
  state.edges.forEach(edge => {
    const age = now - edge.born - edge.delay;
    if (age < 0) return;

    edge.progress = Math.min(1, age / 900);
    drawEdge(edge, edge.progress, isVerified, now);

    // Spawn particles when edge is mostly drawn
    if (edge.progress > 0.6) {
      spawnParticle(edge, isVerified);
    }
  });

  // Update and draw particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.t += isVerified ? 0.006 : (0.005 + Math.random() * 0.003);
    if (p.t > 1.05) { state.particles.splice(i, 1); continue; }

    // Quadratic Bézier interpolation
    const pos = bezierPoint(p.from, p.ctrl, p.to, Math.min(p.t, 1));

    // Drift for suspicious mode
    if (!isVerified) {
      pos.x += (Math.random() - 0.5) * 1.5;
      pos.y += (Math.random() - 0.5) * 1.5;
    }

    const alpha = Math.sin(p.t * Math.PI) * 0.9;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = isVerified
      ? `rgba(0, 229, 255, ${alpha})`
      : `rgba(255, 128, 96, ${alpha})`;

    if (isVerified) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur  = 8;
    } else {
      ctx.shadowColor = '#ff8060';
      ctx.shadowBlur  = 6;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Draw nodes
  Object.values(state.nodes).forEach(node => {
    const age = now - node.born;
    if (age < 0) return;
    const appear = Math.min(1, age / 400);
    drawNode(node, appear, isVerified, now);
  });
}

function drawEdge(edge, progress, isVerified, now) {
  const { fromPos, toPos } = edge;
  const ctrl = getBezierControl(fromPos, toPos, isVerified, now);

  ctx.beginPath();
  ctx.moveTo(fromPos.x, fromPos.y);

  // Compute partial bezier endpoint
  const endT  = progress;
  const mid   = bezierPoint(fromPos, ctrl, toPos, endT);

  // Use quadratic curve to midpoint approximation
  ctx.quadraticCurveTo(
    fromPos.x + (ctrl.x - fromPos.x) * endT,
    fromPos.y + (ctrl.y - fromPos.y) * endT,
    mid.x, mid.y
  );

  const baseAlpha = 0.5 * progress;

  if (isVerified) {
    ctx.strokeStyle = `rgba(0, 200, 255, ${baseAlpha})`;
    ctx.lineWidth   = 1.2;
    ctx.shadowColor = '#00c8ff';
    ctx.shadowBlur  = 4;
  } else {
    // Slight instability: shift color slightly
    const flicker = 0.85 + Math.sin(now * 0.003 + edge.delay) * 0.15;
    ctx.strokeStyle = `rgba(255, ${80 + Math.floor(flicker * 30)}, 60, ${baseAlpha * flicker})`;
    ctx.lineWidth   = 1.0 + Math.sin(now * 0.005) * 0.3;
    ctx.shadowColor = '#ff5040';
    ctx.shadowBlur  = 5;
  }

  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawNode(node, appear, isVerified, now) {
  const pulse = 0.8 + Math.sin(now * 0.003 + node.x) * 0.2;
  const r     = node.radius * appear;

  // Glow
  const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3);
  if (isVerified) {
    grad.addColorStop(0, `rgba(0, 200, 255, ${0.4 * pulse * appear})`);
    grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
  } else {
    grad.addColorStop(0, `rgba(255, 80, 60, ${0.35 * pulse * appear})`);
    grad.addColorStop(1, 'rgba(255, 80, 60, 0)');
  }
  ctx.beginPath();
  ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Core
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.fillStyle = isVerified ? '#00c8ff' : '#ff5040';
  ctx.shadowColor = isVerified ? '#00c8ff' : '#ff5040';
  ctx.shadowBlur  = 12 * appear;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ring
  ctx.beginPath();
  ctx.arc(node.x, node.y, r * (1.6 + pulse * 0.4), 0, Math.PI * 2);
  ctx.strokeStyle = isVerified
    ? `rgba(0, 200, 255, ${0.3 * appear})`
    : `rgba(255, 80, 60, ${0.25 * appear})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function getBezierControl(from, to, isVerified, now) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  const offset = len * 0.3;

  // Perpendicular
  let cx = mx - (dy / len) * offset;
  let cy = my + (dx / len) * offset;

  if (!isVerified) {
    // Subtle instability — mild drift over time
    cx += Math.sin(now * 0.0008) * 12;
    cy += Math.cos(now * 0.0007) * 10;
  }

  return { x: cx, y: cy };
}

function bezierPoint(from, ctrl, to, t) {
  const u = 1 - t;
  return {
    x: u*u*from.x + 2*u*t*ctrl.x + t*t*to.x,
    y: u*u*from.y + 2*u*t*ctrl.y + t*t*to.y
  };
}

function spawnParticle(edge, isVerified) {
  if (state.particles.length > 200) return;
  if (Math.random() > 0.06) return;

  const ctrl = getBezierControl(edge.fromPos, edge.toPos, isVerified, performance.now());

  state.particles.push({
    from: edge.fromPos,
    ctrl,
    to:   edge.toPos,
    t:    0,
    r:    1 + Math.random() * 1.5
  });
}

/* ═══════════════════════════════════════════
   PANEL UPDATE
═══════════════════════════════════════════ */
function updatePanel(id) {
  const data = COUNTRY_DATA[id];
  if (!data) return;

  panelEmpty.style.display   = 'none';
  panelContent.style.display = 'flex';
  panelContent.classList.add('active');

  const isVerified = state.mode === 'verified';
  const suspectClass = isVerified ? '' : ' suspect-mode';

  // Header
  document.getElementById('pc-code').textContent    = id;
  document.getElementById('pc-name').textContent    = data.name || id;
  document.getElementById('pc-region').textContent  = data.region || '—';

  const header = document.getElementById('pc-header');
  header.className = 'panel-country-header' + suspectClass;

  const pct   = Math.round((data.intensity || 0.5) * 100);
  const iBar  = document.getElementById('pc-intensity-fill');
  const iVal  = document.getElementById('pc-intensity-val');
  iBar.style.width  = pct + '%';
  iBar.className    = 'intensity-fill' + suspectClass;
  iVal.textContent  = pct + '%';
  iVal.className    = 'intensity-value' + suspectClass;

  // Verified News
  const verifiedList = document.getElementById('pc-verified-list');
  verifiedList.innerHTML = '';
  (data.verified || []).forEach(h => {
    verifiedList.appendChild(makeNewsItem(h, false));
  });

  // Suspicious News
  const suspectList = document.getElementById('pc-suspect-list');
  suspectList.innerHTML = '';
  (data.suspicious || []).forEach(h => {
    suspectList.appendChild(makeNewsItem(h, true));
  });

  // Connected
  const connList = document.getElementById('pc-conn-list');
  connList.innerHTML = '';
  state.connectedCountries.forEach(cid => {
    const cd = COUNTRY_DATA[cid];
    if (!cd) return;
    const item = document.createElement('div');
    item.className = 'connected-country';
    item.innerHTML = `
      <div class="cc-indicator${isVerified ? '' : ' suspect'}"></div>
      <div class="cc-name">${cd.name || cid}</div>
      <div class="cc-code">${cid}</div>
      <div class="cc-strength${isVerified ? '' : ' suspect'}">${Math.round(50 + Math.random()*50)}%</div>
    `;
    item.addEventListener('click', () => {
      clearConnections();
      setActiveCountry(cid);
      buildNetwork(cid);
      updatePanel(cid);
    });
    connList.appendChild(item);
  });

  // Fade in
  panelContent.querySelectorAll('.news-item, .connected-country').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(8px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    }, i * 60);
  });
}

function makeNewsItem(headline, isSuspect) {
  const isVerified = state.mode === 'verified';
  const item = document.createElement('div');
  item.className = `news-item${isSuspect ? ' suspect' : ''}`;

  const sources = isSuspect
    ? ['Unverified Feed','Anonymous Source','Unknown Origin','Signal Intercept']
    : ['Reuters','AP News','BBC','Al Jazeera','AFP'];
  const tags = isSuspect
    ? ['AI-GENERATED','UNVERIFIED','MANIPULATED','DEEPFAKE']
    : ['VERIFIED','CONFIRMED','SOURCED','VALIDATED'];

  const src = sources[Math.floor(Math.random() * sources.length)];
  const tag = tags[Math.floor(Math.random() * tags.length)];
  const minsAgo = Math.floor(Math.random() * 120) + 5;

  item.innerHTML = `
    <div class="news-headline">${headline}</div>
    <div class="news-meta">
      <span class="news-source${isSuspect ? ' suspect' : ''}">${src}</span>
      <span>${minsAgo}m ago</span>
      <span class="news-tag${isSuspect ? ' suspect' : ''}">${tag}</span>
    </div>
  `;
  return item;
}

function updateStats(nodes, edges) {
  const el1 = document.getElementById('stat-nodes');
  const el2 = document.getElementById('stat-edges');
  if (el1) el1.textContent = nodes;
  if (el2) el2.textContent = edges;
}

/* ═══════════════════════════════════════════
   OCEAN THEME SWITCHER
═══════════════════════════════════════════ */
function updateOcean(theme) {
  const base = document.getElementById('ocean-base');
  const grad = document.getElementById('ocean-grad');
  const glow = document.getElementById('ocean-glow');
  if (!base || !grad) return;
  if (theme === 'light') {
    base.setAttribute('fill', '#8ab8d4');
    grad.setAttribute('fill', 'url(#oceanGradLight)');
    if (glow) glow.setAttribute('fill', 'rgba(180,220,255,0.25)');
  } else {
    base.setAttribute('fill', '#030b18');
    grad.setAttribute('fill', 'url(#oceanGradDark)');
    if (glow) glow.setAttribute('fill', 'rgba(0,40,80,0.18)');
  }
}

/* ═══════════════════════════════════════════
   CONTROLS — MODE TOGGLE, THEME TOGGLE
═══════════════════════════════════════════ */
function bindControls() {
  // Mode toggle
  const modeToggle = document.getElementById('mode-toggle');
  modeToggle.addEventListener('click', () => {
    state.mode = state.mode === 'verified' ? 'suspicious' : 'verified';
    const isV  = state.mode === 'verified';
    const track = document.getElementById('mode-track');
    const label = document.getElementById('mode-name');
    track.className = 'mode-toggle-track' + (isV ? ' verified' : '');
    label.className = 'mode-name' + (isV ? ' verified' : '');
    label.textContent = isV ? 'VERIFIED' : 'SUSPICIOUS';

    // Refresh active connections
    if (state.activeCountry) {
      clearConnections();
      setActiveCountry(state.activeCountry);
      buildNetwork(state.activeCountry);
      updatePanel(state.activeCountry);
    }
  });

  // Theme toggle
  document.getElementById('theme-btn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    document.getElementById('theme-btn').textContent = state.theme === 'dark' ? '☀' : '◑';
    updateOcean(state.theme);
  });

  // Click away to deselect
  document.getElementById('map-area').addEventListener('click', (e) => {
    if (e.target.id === 'map-area' || e.target.id === 'network-canvas' || e.target.id === 'map-container' || e.target.id === 'map-wrapper') {
      clearConnections();
      if (state.activeCountry) {
        const el = document.getElementById(state.activeCountry);
        if (el) el.classList.remove('active', 'suspect-mode');
        state.activeCountry = null;
      }
      panelContent.classList.remove('active');
      panelContent.style.display = 'none';
      panelEmpty.style.display   = '';
      updateStats(0, 0);
    }
  });
}

/* ═══════════════════════════════════════════
   PARALLAX
═══════════════════════════════════════════ */
function bindMouseParallax() {
  const wrapper = document.getElementById('map-wrapper');
  document.getElementById('map-area').addEventListener('mousemove', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx   = (e.clientX - rect.left)  / rect.width  - 0.5;
    const ny   = (e.clientY - rect.top)   / rect.height - 0.5;
    wrapper.style.transform = `rotateX(${8 - ny * 4}deg) rotateY(${nx * 3}deg) scale(0.94)`;
  });
  document.getElementById('map-area').addEventListener('mouseleave', () => {
    wrapper.style.transform = 'rotateX(8deg) rotateY(0deg) scale(0.94)';
  });
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ═══════════════════════════════════════════
   HUD CLOCK
═══════════════════════════════════════════ */
function startClock() {
  const el = document.getElementById('hud-time');
  if (!el) return;
  setInterval(() => {
    const now = new Date();
    el.textContent = now.toUTCString().replace('GMT','UTC').slice(0,-4);
  }, 1000);
}

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  init();
  startClock();
});
