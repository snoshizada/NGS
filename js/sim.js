// sim.js - THE SIMULATION
// no html in this file!! so it can be run by tests.js in node as well as the browser
// rule from the plan: the simulation decides what happens, the text only explains it

// ---------- little helpers ----------

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function sum(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }

// random numbers (mulberry32). the state is saved in the game so turns can be replayed exactly
function rand(g) {
  g.rng.draws++;
  var t = g.rng.state = (g.rng.state + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function chance(g, p) { return rand(g) < p; }
// news has its own random numbers so which stories get written never changes the actual game
function randNews(g) {
  var t = g.newsRng = (g.newsRng + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pickNews(g, arr) { return arr[Math.floor(randNews(g) * arr.length)]; }
function pick(g, arr) { return arr[Math.floor(rand(g) * arr.length)]; }

// quintile stuff (poorest = 0, richest = 4)
var WAGE_SHARE = [0.05, 0.11, 0.17, 0.24, 0.43];
var CAPITAL_SHARE = [0.01, 0.03, 0.06, 0.15, 0.75];
var PENSION_SHARE = [0.30, 0.27, 0.20, 0.13, 0.10];
var WELFARE_SHARE = [0.45, 0.28, 0.15, 0.08, 0.04];
var ENERGY_SHARE = [0.17, 0.19, 0.20, 0.21, 0.23];
var FAMILY_SHARE = [0.30, 0.28, 0.22, 0.13, 0.07];
var MPC = [0.98, 0.95, 0.92, 0.88, 0.72]; // how much of extra income gets spent
var AGE_NAMES = ["0-17", "18-64", "65+"];

// week number -> date text
function weekDate(g, w) {
  if (w === undefined) w = g.week;
  var d = new Date(Date.UTC(g.startYear, 0, 4 + (w - 1) * 7));
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return d.getUTCDate() + " " + months[d.getUTCMonth()] + " " + d.getUTCFullYear();
}
function weekYear(g, w) { if (w === undefined) w = g.week; return g.startYear + Math.floor((w - 1) / 52); }
function weekOfYear(g, w) { if (w === undefined) w = g.week; return ((w - 1) % 52) + 1; }

function randomName(g) { return pick(g, FIRST_NAMES) + " " + pick(g, LAST_NAMES); }

function totalPop(g) { var s = 0; for (var i = 0; i < g.regions.length; i++) s += g.regions[i].pop; return s; }
function adults(g) { return totalPop(g) * (1 - g.pop.young); }
function govParties(g) { return g.parties.filter(function (p) { return p.inGov; }); }
function govSeats(g) { return sum(govParties(g).map(function (p) { return p.seats; })); }
function playerParty(g) { for (var i = 0; i < g.parties.length; i++) if (g.parties[i].player) return g.parties[i]; }
function findParty(g, id) { for (var i = 0; i < g.parties.length; i++) if (g.parties[i].id == id) return g.parties[i]; }

// ======================================================================
// NEW GAME
// ======================================================================
function newGame(key, opts) {
  opts = opts || {};
  var T = copy(TEMPLATES[key]);
  var seed = parseInt(opts.seed) || 20271;
  var diff = opts.difficulty || "standard";
  var g = {};
  g.version = GAME_VERSION;
  g.contentVersion = CONTENT_VERSION;
  g.template = key;
  g.difficulty = diff;
  g.rng = { seed: seed, state: seed, draws: 0 };
  g.newsRng = seed * 7 + 1;
  g.calm = !!opts.calm; // calm = no random world events (used by the tests)
  g.week = 1;
  g.startYear = 2027;
  g.gameOver = false;
  g.eventCounter = 0;

  g.country = {
    name: opts.name || T.name, capital: opts.capital || T.capital,
    currency: opts.currency || T.currency, symbol: T.currencySymbol,
    languages: T.languages, flag: opts.flag || T.flag
  };
  if (opts.partyName) {
    for (var i = 0; i < T.parties.length; i++) if (T.parties[i].player) T.parties[i].name = opts.partyName;
  }

  g.constitution = {
    govType: T.govType, leaderTitle: T.leaderTitle, electionSystem: T.electionSystem,
    termYears: T.termYears, seats: T.seats, majority: T.majority, confidenceRule: T.confidenceRule,
    amendmentText: T.amendment,
    supermajority: key == "B" ? Math.ceil(T.seats * 0.6) : Math.ceil(T.seats * 2 / 3),
    referendum: key != "B",
    centralBankIndependent: true,
    votingAge: 18,
    fiscalRule: key == "C" ? 3 : 0 // max deficit % of GDP written in the law (0 = none)
  };

  // regions
  g.regions = T.regions.map(function (r) { return { name: r.name, pop: r.pop, income: r.income, unemp: r.unemp, seats: r.seats, protestCooldown: 0 }; });
  g.pop = { old: T.oldShare, young: T.youngShare, births: 0, deaths: 0, immig: 0, emig: 0 };

  // difficulty changes starting conditions only (not rules)
  var debtRatio = T.debtRatio, trust = 0;
  if (diff == "story") { debtRatio *= 0.8; trust = 0.05; }
  if (diff == "hard") { debtRatio *= 1.15; trust = -0.04; }

  // ----- economy -----
  var P = totalPop(g);
  var L = P * (1 - g.pop.old - g.pop.young) * 0.78;
  var E = L * (1 - T.unemployment);
  g.econ = {
    gdp: T.gdp, realGdp: T.gdp, price: 1, cpi: 100,
    infl: T.inflation, inflExp: T.inflation, infl0: T.inflation, growth0: key == "C" ? 0.008 : 0.016,
    labourForce: L, employed: E, natU: T.unemployment, participation: 0.78,
    prod: T.gdp / E, // real output per worker (thousands)
    wage: 0.52 * T.gdp / E, // average wage (thousands per year)
    policyRate: T.policyRate, exch: 100, foreignPrice: 1, worldDemand: 1,
    confidence: 1, priceShock: 0, energyPrice: 1,
    importShare: key == "B" ? 0.2 : (key == "A" ? 0.32 : 0.28),
    inv0: 0.2 * T.gdp, realRate0: T.policyRate - T.inflation,
    emissions: T.gdp * 0.15, emissionsIntensity: 0.15,
    tradeFactor: 1, publicCapital: 1,
    L0: L, prod0: T.gdp / E, worldTrend: 1
  };
  g.taxes = copy(T.taxes);
  g.taxes0 = copy(T.taxes);
  g.compliance = key == "A" ? 0.95 : (key == "B" ? 0.84 : 0.82);
  if (diff == "hard") g.compliance -= 0.03;

  // ----- budget -----
  g.budget = { lines: copy(T.spending), lines0: copy(T.spending), emergency: 0, otherRevenue: 0 };

  // policies the country already has
  g.policies = {};
  for (var i = 0; i < POLICIES.length; i++) g.policies[POLICIES[i].id] = { active: false, value: POLICIES[i].def, since: 0, extra: 0 };
  g.policies.minwage = { active: true, value: key == "A" ? 50 : (key == "B" ? 42 : 45), since: 0, extra: 0 };
  g.policies.immigration = { active: true, value: key == "B" ? 40 : 20, since: 0, extra: 0 };
  g.policies0 = copy(g.policies);
  g.flags = { energyPublic: key == "C", railPrivate: false };

  // ----- debt (3 buckets: short, medium, long) -----
  var debt = debtRatio * T.gdp;
  g.debt = {
    instruments: [
      { name: "Short-term bills (2y)", years: 2, amount: debt * 0.3, rate: T.policyRate + 0.002 },
      { name: "Medium-term bonds (7y)", years: 7, amount: debt * 0.4, rate: T.policyRate + 0.008 },
      { name: "Long-term bonds (20y)", years: 20, amount: debt * 0.3, rate: T.policyRate + 0.014 }
    ],
    riskPremium: 0
  };
  var target0 = key == "A" ? -0.015 : (key == "B" ? -0.03 : -0.045);
  g.debt.riskPremium = riskPremium(g, debtRatio, target0);
  for (var i = 0; i < 3; i++) g.debt.instruments[i].rate += g.debt.riskPremium;

  // ----- public services -----
  g.crime0 = key == "A" ? 55 : (key == "B" ? 80 : 70); // recorded crimes per 1000 people
  g.crime = g.crime0;
  g.services = {};
  var access0 = key == "A" ? 0.97 : (key == "B" ? 0.9 : 0.86);
  for (var i = 0; i < SERVICES.length; i++) {
    var s = SERVICES[i];
    var budget = g.budget.lines[s.line];
    var staffCost = g.econ.wage * 1.1;
    var staff = budget * s.staffShare / staffCost * 1000; // thousands
    var demand = serviceDemand(g, s);
    g.services[s.id] = {
      staff: staff, nonStaff0: budget * (1 - s.staffShare), equip: 1,
      perStaff: demand * access0 / staff, demand: demand, capacity: demand * access0,
      access: access0, access0: access0, backlog: 0, wait: 6 * Math.pow(1 / access0, 4), quality: 100 * access0,
      extraStaff: 0
    };
  }

  // ----- defence -----
  g.defence = {
    branches: [
      { name: "Army", personnel: T.spending.defence * 3.2, equipment: 70 },
      { name: "Navy", personnel: T.spending.defence * 1.1, equipment: 65 },
      { name: "Air Force", personnel: T.spending.defence * 1.0, equipment: 68 },
      { name: "Support and logistics", personnel: T.spending.defence * 1.2, equipment: 60 }
    ],
    readiness: 55, base: T.spending.defence
  };

  // ----- politics -----
  g.parties = T.parties.map(function (p) {
    return { id: p.id, name: p.name, econ: p.econ, social: p.social, color: p.color, seats: p.seats, inGov: !!p.inGov, player: !!p.player,
      leader: "", bias: 0, poll: 0, patience: 70, members: Math.round(p.seats * 900) };
  });
  for (var i = 0; i < g.parties.length; i++) g.parties[i].leader = randomName(g);
  g.leaderName = opts.leaderName || playerParty(g).leader;
  playerParty(g).leader = g.leaderName;

  g.politics = {
    mood: 0, termStart: 1, nextElection: key == "A" ? 140 : (key == "B" ? 150 : 82),
    record: avgGovEcon(g), record0: 0, baseTrust: (key == "A" ? 0.46 : (key == "B" ? 0.48 : 0.34)) + trust,
    elections: [], snapElection: 0, lastConfidence: null
  };
  g.politics.record0 = g.politics.record;

  // cabinet
  g.cabinet = [];
  makeCabinet(g);

  // foreign
  g.foreign = FOREIGN.map(function (f) { return { id: f.id, name: f.name, gov: f.gov, pop: f.pop, gdp: f.gdp, military: f.military, trade: f.trade, interest: f.interest, relation: f.relation, treaties: [], sanctioned: false, leader: "" }; });
  for (var i = 0; i < g.foreign.length; i++) g.foreign[i].leader = randomName(g);

  // lists
  g.bills = [];
  g.billCounter = 0;
  g.events = [];
  g.news = [];
  g.history = [];
  g.commandLog = [];
  g.offers = [];
  g.shocks = [];
  g.laws = [];
  g.urgent = [];
  g.accounts = { months: [], quarters: [] };

  // ----- first calculation of the economy so everything is filled in -----
  var f = calcFlows(g, true);
  // set exports so GDP = C + G + I + X - M at the start
  g.econ.exportsBase = T.gdp - f.C - f.G - f.I + f.M;
  // set non-tax revenue so the starting deficit is believable
  var target = key == "A" ? -0.015 : (key == "B" ? -0.03 : -0.045);
  if (diff == "story") target += 0.01;
  if (diff == "hard") target -= 0.01;
  g.budget.otherRevenue = Math.max(0.01 * T.gdp, target * T.gdp - (f.revTotal - f.spendTotal));
  f = calcFlows(g, true);
  g.flows = f;

  // reference values for approval (start of the term)
  setRefs(g);
  // cohorts + approval + polls
  initCohorts(g);
  calibratePolls(g);

  // baseline history (5 years) - made up but consistent with the start numbers
  g.baseline = [];
  for (var y = 5; y >= 1; y--) {
    g.baseline.push({
      year: g.startYear - y,
      gdp: T.gdp / Math.pow(1 + g.econ.growth0 + g.econ.infl0, y),
      growth: g.econ.growth0 + (rand(g) - 0.5) * 0.01,
      infl: g.econ.infl0 + (rand(g) - 0.5) * 0.01,
      unemp: T.unemployment + (rand(g) - 0.5) * 0.01,
      debtRatio: debtRatio - y * (key == "C" ? -0.04 : 0.005),
      balance: target + (rand(g) - 0.5) * 0.01
    });
  }

  recordHistory(g);
  addEvent(g, "start", 1, "New government takes office in " + g.country.name,
    { leader: g.leaderName, party: playerParty(g).name, seats: govSeats(g), majority: g.constitution.majority },
    "Start of the game.", 1);
  makeNews(g);
  return g;
}

function makeCabinet(g) {
  var gp = govParties(g);
  var totalGov = govSeats(g);
  g.cabinet = [];
  // share out ministries roughly by seats, player party gets finance etc first
  var slots = [];
  for (var i = 0; i < gp.length; i++) {
    var n = Math.max(1, Math.round(15 * gp[i].seats / totalGov));
    for (var j = 0; j < n; j++) slots.push(gp[i].id);
  }
  // put player party first
  slots.sort(function (a, b) { return (findParty(g, b).player ? 1 : 0) - (findParty(g, a).player ? 1 : 0); });
  for (var i = 0; i < MINISTRIES.length; i++) {
    var party = slots[i] || playerParty(g).id;
    g.cabinet.push({ ministry: MINISTRIES[i].id, name: randomName(g), party: party, competence: 0.35 + rand(g) * 0.5, approval: 0.4 + rand(g) * 0.2, since: g.week });
  }
}

function minister(g, ministry) { for (var i = 0; i < g.cabinet.length; i++) if (g.cabinet[i].ministry == ministry) return g.cabinet[i]; }

function avgGovEcon(g) {
  var gp = govParties(g), s = 0, n = 0;
  for (var i = 0; i < gp.length; i++) { s += gp[i].econ * gp[i].seats; n += gp[i].seats; }
  return n ? s / n : 50;
}

function riskPremium(g, debtRatio, deficitRatio) {
  // markets worry above 90% debt and big deficits
  var rp = Math.max(0, debtRatio - 0.9) * 0.04 + Math.max(0, -deficitRatio - 0.03) * 0.15;
  if (g.template == "C") rp += 0.01; // bad history
  return clamp(rp, 0, 0.12);
}

function serviceDemand(g, s) {
  var P = totalPop(g);
  var d = P * (s.demandPerHead + g.pop.old * (s.oldDemand || 0) + g.pop.young * (s.youngDemand || 0));
  // health emergency shock
  for (var i = 0; g.shocks && i < g.shocks.length; i++) if (g.shocks[i].type == "health" && s.id == "health") d *= 1 + g.shocks[i].mag;
  return d;
}

// ======================================================================
// THE ECONOMY - works out all the money flows for this week (annual rates)
// ======================================================================
function calcFlows(g, initial) {
  var e = g.econ, t = g.taxes, b = g.budget.lines, pol = g.policies;
  var f = {};
  var Yprev = e.gdp;

  // ---- wages and incomes ----
  f.W = e.employed * e.wage; // wage bill (bn)
  f.K = 0.2 * Yprev;         // capital income to households
  f.profits = 0.22 * Yprev * (1 + 0.5 * (e.confidence - 1));

  // minimum wage moves income to the bottom quintiles
  var ws = WAGE_SHARE.slice();
  if (pol.minwage.active) {
    var mw = (pol.minwage.value - g.policies0.minwage.value) / 100;
    ws[0] *= 1 + mw * 0.8; ws[1] *= 1 + mw * 0.4;
    var tot = sum(ws); for (var i = 0; i < 5; i++) ws[i] /= tot;
  }

  // ---- transfers ----
  var welfareActual = b.welfare * (initial ? 1 : clamp((1 - e.employed / e.labourForce) / e.natU, 0.6, 2.5));
  f.welfareActual = welfareActual;
  var energySub = pol.energysub.active ? pol.energysub.value : 0;
  var freeSchool = pol.freeschool.active ? pol.freeschool.value : 0;
  f.transfers = b.pensions + welfareActual + energySub + freeSchool;

  // ---- income tax by quintile (rough effective rates, there are allowances) ----
  var rB = t.incomeBasic / 100, rH = t.incomeHigher / 100, rT = t.incomeTop / 100;
  var eff = [0.15 * rB, 0.6 * rB, 0.9 * rB, 0.75 * rB + 0.25 * rH, 0.35 * rB + 0.35 * rH + 0.3 * rT];
  for (var i = 0; i < 5; i++) eff[i] *= 0.62;
  // rich people avoid tax when rates go up (capped so it doesnt go crazy)
  var topResp = clamp(Math.pow((1 - rT) / (1 - g.taxes0.incomeTop / 100), 0.3), 0.85, 1.08);
  var highResp = clamp(Math.pow((1 - rH) / (1 - g.taxes0.incomeHigher / 100), 0.15), 0.9, 1.05);
  var payroll = t.payroll / 100;

  f.q = [];
  f.incomeTax = 0; f.payrollTax = 0;
  var D = 0;
  for (var i = 0; i < 5; i++) {
    var wage = f.W * ws[i], cap = f.K * CAPITAL_SHARE[i];
    var base = wage + cap;
    if (i == 4) base *= topResp;
    if (i == 3) base *= highResp;
    var itax = base * eff[i] * g.compliance;
    var ptax = wage * payroll * g.compliance;
    var tr = b.pensions * PENSION_SHARE[i] + welfareActual * WELFARE_SHARE[i] + energySub * ENERGY_SHARE[i] + freeSchool * FAMILY_SHARE[i];
    var rentGain = 0;
    if (pol.rentcap.active && i <= 2) rentGain = wage * (10 - pol.rentcap.value) * 0.002;
    var disp = wage + cap + tr - itax - ptax + rentGain;
    f.q.push({ wage: wage, cap: cap, transfers: tr, incomeTax: itax, payroll: ptax, rent: rentGain, disp: disp });
    f.incomeTax += itax; f.payrollTax += ptax;
    D += disp;
  }
  f.D = D;

  // ---- consumption ----
  var realRate = e.policyRate - e.inflExp;
  var rateEffect = 1 - 1.2 * (realRate - e.realRate0);
  f.C = 0;
  for (var i = 0; i < 5; i++) f.C += MPC[i] * f.q[i].disp;
  f.C *= rateEffect * (0.85 + 0.15 * e.confidence);

  // ---- government consumption + investment (non-transfer lines + programmes) ----
  f.G = 0;
  for (var i = 0; i < SPENDING_LINES.length; i++) if (!SPENDING_LINES[i].transfer) f.G += b[SPENDING_LINES[i].id];
  f.programmes = programmeCosts(g);
  f.G += f.programmes.staff + f.programmes.infra;
  f.G += g.budget.emergency;

  // ---- private investment ----
  var corpEffect = 1 - 0.9 * (t.corp - g.taxes0.corp) / 100;
  var creditShock = 1;
  for (var i = 0; g.shocks && i < g.shocks.length; i++) if (g.shocks[i].type == "credit") creditShock -= g.shocks[i].mag;
  var rentEffect = pol.rentcap.active ? 1 - (10 - pol.rentcap.value) * 0.004 : 1;
  var trend = (e.prod / e.prod0) * (e.labourForce / e.L0);
  f.I = e.inv0 * e.price * trend * (1 - 2.5 * (realRate - e.realRate0)) * corpEffect * creditShock * rentEffect * (0.6 + 0.4 * e.confidence);
  if (pol.emissions.active) f.I *= 1 - pol.emissions.value * 0.0008;

  // ---- trade ----
  var compet = Math.pow(e.foreignPrice / e.price, 0.6) * Math.pow(100 / e.exch, 0.6);
  f.X = (initial && !e.exportsBase ? 0 : e.exportsBase) * e.foreignPrice * e.worldDemand * e.worldTrend * e.tradeFactor * compet;
  var tariffEffect = 1 - 1.5 * (t.tariff - g.taxes0.tariff) / 100;
  f.M = e.importShare * (f.C + f.I) * tariffEffect * Math.pow(e.exch / 100, 0.4);

  // ---- GDP by expenditure ----
  f.Y = f.C + f.G + f.I + f.X - f.M;

  // ---- other revenue ----
  var vatRate = t.vat / 100;
  f.vat = f.C * 0.55 * vatRate / (1 + vatRate) * g.compliance;
  f.excise = f.C * 0.1 * t.excise / 100 * g.compliance;
  f.corpTax = f.profits * t.corp / 100 * clamp(Math.pow((1 - t.corp / 100) / (1 - g.taxes0.corp / 100), 0.4), 0.85, 1.1) * g.compliance;
  f.propertyTax = 3.5 * Yprev * t.property / 100 * g.compliance;
  f.tariffs = f.M * t.tariff / 100;
  f.carbonTax = e.emissions * t.carbon / 1000;
  f.otherRev = g.budget.otherRevenue * e.price;
  if (g.flags.energyPublic) f.otherRev += 0.004 * Yprev; // dividends from state energy co
  f.payrollTax *= 2; // employer side too (counted only once in disposable income)
  f.revenue = {
    "Personal income tax": f.incomeTax, "Social insurance contributions": f.payrollTax, "VAT": f.vat, "Corporate profit tax": f.corpTax,
    "Property tax": f.propertyTax, "Excise duties": f.excise, "Customs tariffs": f.tariffs, "Carbon tax": f.carbonTax, "Fees, fines and other": f.otherRev
  };
  f.revTotal = 0; for (var k in f.revenue) f.revTotal += f.revenue[k];

  // ---- spending ----
  f.interest = 0;
  for (var i = 0; i < g.debt.instruments.length; i++) f.interest += g.debt.instruments[i].amount * g.debt.instruments[i].rate;
  f.spending = {};
  for (var i = 0; i < SPENDING_LINES.length; i++) {
    var L = SPENDING_LINES[i];
    f.spending[L.name] = L.id == "welfare" ? welfareActual : b[L.id];
  }
  if (energySub) f.spending["Energy subsidy"] = energySub;
  if (freeSchool) f.spending["Free school meals and childcare"] = freeSchool;
  if (f.programmes.staff) f.spending["Hospital staffing programme"] = f.programmes.staff;
  if (f.programmes.infra) f.spending["National infrastructure programme"] = f.programmes.infra;
  if (g.budget.emergency) f.spending["Emergency spending"] = g.budget.emergency;
  f.spending["Debt interest"] = f.interest;
  f.spendTotal = 0; for (var k in f.spending) f.spendTotal += f.spending[k];
  f.balance = f.revTotal - f.spendTotal;
  f.primary = f.balance + f.interest;

  // ---- GDP by production (sectors) ----
  f.productTaxes = f.vat + f.excise + f.tariffs + f.carbonTax;
  f.subsidies = energySub;
  var gvaTotal = f.Y - f.productTaxes + f.subsidies;
  var mods = sectorMods(g), wsum = 0;
  for (var i = 0; i < SECTORS.length; i++) wsum += SECTORS[i].share * mods[i];
  f.sectors = [];
  var jsum = 0;
  for (var i = 0; i < SECTORS.length; i++) jsum += SECTORS[i].jobs * mods[i];
  for (var i = 0; i < SECTORS.length; i++) {
    var gva = gvaTotal * SECTORS[i].share * mods[i] / wsum;
    var jobs = e.employed * SECTORS[i].jobs * mods[i] / jsum;
    f.sectors.push({ name: SECTORS[i].name, gva: gva, jobs: jobs, wage: jobs > 0 ? gva * 0.52 / jobs : 0, mod: mods[i] });
  }
  f.gdpProduction = 0;
  for (var i = 0; i < f.sectors.length; i++) f.gdpProduction += f.sectors[i].gva;
  f.gdpProduction += f.productTaxes - f.subsidies;
  return f;
}

function sectorMods(g) {
  var m = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  var energyShock = 0;
  for (var i = 0; i < g.shocks.length; i++) if (g.shocks[i].type == "energy") energyShock += g.shocks[i].mag;
  for (var i = 0; i < SECTORS.length; i++) m[i] -= SECTORS[i].energy * energyShock * 0.15;
  var b = g.budget.lines, b0 = g.budget.lines0;
  m[3] *= 1 + 0.4 * ((b.transport + b.housing) / (b0.transport + b0.housing) - 1) + (g.policies.infra.active ? g.policies.infra.value * 0.01 : 0);
  if (g.policies.rentcap.active) m[3] *= 1 - (10 - g.policies.rentcap.value) * 0.005;
  m[8] *= 1 + 0.3 * ((b.health + b.education) / (b0.health + b0.education) - 1);
  if (g.policies.emissions.active) { m[1] *= 1 - g.policies.emissions.value * 0.002; m[2] *= 1 - g.policies.emissions.value * 0.0015; }
  m[2] *= 1 + (g.taxes.tariff - g.taxes0.tariff) * 0.004; // protection helps factories a bit
  for (var i = 0; i < m.length; i++) m[i] = clamp(m[i], 0.3, 2);
  return m;
}

function programmeCosts(g) {
  var c = { staff: 0, infra: 0 };
  var s = g.services.health;
  if (s && s.extraStaff > 0) c.staff = s.extraStaff * g.econ.wage * 1.1 / 1000;
  if (g.policies.infra.active) c.infra = g.policies.infra.value;
  return c;
}

// ======================================================================
// ADVANCE ONE WEEK - the turn pipeline from section 8.3 of the plan
// ======================================================================
function advanceWeek(g0) {
  // work on a copy, only commit if everything checks out (step 17)
  var g = copy(g0);
  g.turnLog = [];
  g.urgent = [];
  g.week++;
  var e = g.econ;
  var opening = { debt: totalDebt(g), pop: totalPop(g) };

  // 2-3. apply bills / laws whose date has arrived, bill stages move on
  processBills(g);
  applyScheduledLaws(g);

  // random world events (seeded)
  worldEvents(g);

  // 4. government programmes and services staffing
  runProgrammes(g);

  // 5. firms, sectors, employment
  var popFactor = totalPop(g) / opening.pop;
  var working = 1 - g.pop.old - g.pop.young;
  var participation = e.participation;
  if (g.policies.freeschool.active) participation += g.policies.freeschool.value * 0.0015;
  participation += (g.services.health.access - g.services.health.access0) * 0.03;
  var conscripts = g.policies.conscription.active ? totalPop(g) * 0.012 * g.policies.conscription.value / 12 : 0;
  e.labourForce = totalPop(g) * working * participation - conscripts;
  var payrollEffect = 1 - 0.35 * (g.taxes.payroll - g.taxes0.payroll) / 100;
  var mwEffect = 1;
  if (g.policies.minwage.active) mwEffect = 1 - Math.max(0, g.policies.minwage.value - g.policies0.minwage.value) * 0.0015;
  var labourDemand = (e.gdp / e.price) / e.prod * payrollEffect * mwEffect;
  var target = Math.min(labourDemand, e.labourForce * 0.985);
  e.employed += (target - e.employed) * 0.06;
  if (e.employed > e.labourForce * 0.985) e.employed = e.labourForce * 0.985;
  var u = 1 - e.employed / e.labourForce;

  // productivity grows slowly. education, infrastructure, emissions rules all matter a bit
  var prodGrowth = 0.012;
  prodGrowth += (g.services.education.access - g.services.education.access0) * 0.01;
  prodGrowth += (e.publicCapital - 1) * 0.02;
  if (g.flags.energyPublic) prodGrowth -= 0.001;
  if (g.policies.emissions.active) prodGrowth -= g.policies.emissions.value * 0.00004;
  e.prod *= 1 + prodGrowth / 52;
  // public capital: infrastructure spending vs depreciation
  var infraSpend = g.budget.lines.transport + (g.policies.infra.active ? g.policies.infra.value : 0);
  e.publicCapital += (infraSpend / g.budget.lines0.transport - 1) * 0.0004 - (e.publicCapital - 1) * 0.002;

  // wages: follow expected inflation + productivity + how tight the jobs market is
  var wageGrowth = e.inflExp + 0.012 + 0.5 * (e.natU - u);
  e.wage *= 1 + wageGrowth / 52;
  // the baseline budget goes up with average pay every week, so services dont slowly fall apart on their own
  // (the player's changes are on top of this)
  for (var k in g.budget.lines) g.budget.lines[k] *= 1 + wageGrowth / 52;

  // 6. households (in calcFlows) + population change
  updatePopulation(g, u);

  // 7. prices
  var potential = e.labourForce * (1 - e.natU) * e.prod;
  var gap = (e.gdp / e.price) / potential - 1;
  var energyShock = 0;
  for (var i = 0; i < g.shocks.length; i++) if (g.shocks[i].type == "energy") energyShock += g.shocks[i].mag;
  var publicEnergy = g.flags.energyPublic ? -0.002 : 0;
  var carbonEffect = (g.taxes.carbon - g.taxes0.carbon) * 0.00003;
  var inflTarget = e.inflExp + 0.35 * gap + energyShock * 0.05 + publicEnergy + carbonEffect;
  e.infl += (inflTarget - e.infl) * 0.1;
  e.inflExp += (0.02 - e.inflExp) * 0.003 + (e.infl - e.inflExp) * 0.01;
  // one-off price jumps (VAT changes etc) spread over 4 weeks
  var jump = e.priceShock * 0.25;
  e.priceShock -= jump;
  if (Math.abs(e.priceShock) < 1e-6) e.priceShock = 0;
  e.price *= Math.pow(1 + e.infl, 1 / 52) * (1 + jump);
  e.cpi = 100 * e.price;
  e.foreignPrice *= Math.pow(1.02, 1 / 52);
  e.worldTrend *= Math.pow(1.015, 1 / 52); // the rest of the world grows too

  // 8. banking, credit, interest rates, exchange rate
  var month = (g.week - 1) % 4 == 0;
  if (month) centralBank(g, gap);
  var debtRatio = totalDebt(g) / e.gdp;
  var bal = g.flows.balance / e.gdp;
  g.debt.riskPremium += (riskPremium(g, debtRatio, bal) - g.debt.riskPremium) * 0.05;
  var exchTarget = 100 + (e.policyRate - 0.03) * 300 - g.debt.riskPremium * 400 + (e.tradeFactor - 1) * 20;
  e.exch += (exchTarget - e.exch) * 0.02;
  e.confidence += (1 - e.confidence) * 0.03 - Math.max(0, u - e.natU - 0.02) * 0.02 - g.debt.riskPremium * 0.02;
  e.confidence = clamp(e.confidence, 0.6, 1.2);
  refinanceDebt(g);

  // carbon/emissions
  var intensityTarget = 0.15 * (1 - clamp(g.taxes.carbon / 400, 0, 0.4)) * (g.policies.emissions.active ? 1 - g.policies.emissions.value / 100 * 0.6 : 1);
  e.emissionsIntensity += (intensityTarget - e.emissionsIntensity) * 0.01;

  // 9. public services
  updateServices(g);

  // the big one: flows for this week
  var f = calcFlows(g, false);
  e.gdp = f.Y;
  e.realGdp = f.Y / e.price;
  e.emissions = e.realGdp * e.emissionsIntensity;

  // money moves: borrow the deficit
  var weekBalance = f.balance / 52;
  var adjustments = g.debtAdjust || 0; g.debtAdjust = 0;
  g.debt.instruments[0].amount += -weekBalance + adjustments; // new borrowing goes into short-term first
  g.flows = f;
  g.budget.emergency *= 0.9; if (g.budget.emergency < 0.01) g.budget.emergency = 0;

  // 10. foreign governments
  foreignAI(g);
  // 11. protests, strikes, security
  protests(g);
  defence(g);
  // 12. politics
  updateApproval(g);
  updatePolls(g);
  politicsWeekly(g);

  // 13. monthly / quarterly / annual accounting
  if (month) monthlyAccounts(g);
  if ((g.week - 1) % 13 == 0) quarterlyAccounts(g);
  if ((g.week - 1) % 52 == 0) annualAccounts(g);

  // 14-15. events + news
  dataReleases(g, month);
  recordHistory(g);
  makeNews(g);

  // 16. validation - if anything is broken the turn is thrown away
  var problems = validate(g, opening, -weekBalance + adjustments);
  if (problems.length) {
    return { ok: false, game: g0, problems: problems };
  }
  // tidy up old stuff so saves dont get massive
  if (g.news.length > 250) g.news = g.news.slice(g.news.length - 250);
  if (g.events.length > 600) g.events = g.events.slice(g.events.length - 600);
  // only keep the detailed "why" numbers for the last 160 weeks
  if (g.history.length > 160) delete g.history[g.history.length - 161].why;
  delete g.turnLog;
  return { ok: true, game: g, problems: [] };
}

function totalDebt(g) { var s = 0; for (var i = 0; i < g.debt.instruments.length; i++) s += g.debt.instruments[i].amount; return s; }

function refinanceDebt(g) {
  var e = g.econ;
  var term = { 2: 0.002, 7: 0.008, 20: 0.014 };
  for (var i = 0; i < g.debt.instruments.length; i++) {
    var d = g.debt.instruments[i];
    var market = Math.max(0, e.policyRate + term[d.years] + g.debt.riskPremium);
    var rolled = 1 / (d.years * 52); // share of this debt refinanced this week
    d.rate += (market - d.rate) * rolled;
  }
  // keep the mix sensible: move some short debt into longer bonds each week
  var s = g.debt.instruments[0], m = g.debt.instruments[1], l = g.debt.instruments[2];
  var tot = totalDebt(g);
  if (s.amount > tot * 0.32) {
    var move = (s.amount - tot * 0.3) * 0.05;
    var mMarket = Math.max(0, e.policyRate + 0.008 + g.debt.riskPremium), lMarket = Math.max(0, e.policyRate + 0.014 + g.debt.riskPremium);
    s.amount -= move;
    m.rate = (m.rate * m.amount + mMarket * move * 0.6) / (m.amount + move * 0.6); m.amount += move * 0.6;
    l.rate = (l.rate * l.amount + lMarket * move * 0.4) / (l.amount + move * 0.4); l.amount += move * 0.4;
  }
  if (s.amount < 0) { m.amount += s.amount; s.amount = 0; }
}

function centralBank(g, gap) {
  var e = g.econ;
  var target = 0.01 + e.infl + 0.5 * (e.infl - 0.02) + 0.5 * gap;
  target = clamp(target, 0, 0.2);
  var old = e.policyRate;
  var move = clamp(target - e.policyRate, -0.0025, 0.0025);
  if (Math.abs(move) >= 0.0025) {
    e.policyRate = Math.round((e.policyRate + move) * 10000) / 10000;
    addEvent(g, "rate", 2, "Central bank " + (move > 0 ? "raises" : "cuts") + " interest rate to " + pct(e.policyRate, 2),
      { old: pct(old, 2), now: pct(e.policyRate, 2), inflation: pct(e.infl, 1) },
      "Inflation is " + pct(e.infl, 1) + " against a 2% target and the output gap is " + pct(gap, 1) + ".", move > 0 ? -1 : 1);
  }
}

function updatePopulation(g, u) {
  var births = 0, deaths = 0, immig = 0, emig = 0;
  var P = totalPop(g);
  var immQuota = g.policies.immigration.active ? g.policies.immigration.value / 1000 : 0; // millions per year
  for (var i = 0; i < g.regions.length; i++) {
    var r = g.regions[i];
    var share = r.pop / P;
    var b = r.pop * (0.0105 - (g.pop.old - 0.2) * 0.02) / 52;
    var d = r.pop * (0.0095 + (g.pop.old - 0.2) * 0.03 - (g.services.health.access - g.services.health.access0) * 0.004) / 52;
    var im = (immQuota * share * (r.income > 1.1 ? 1.4 : 0.9)) / 52;
    var em = r.pop * Math.max(0, 0.002 + (u * r.unemp - g.econ.natU) * 0.05) / 52;
    r.pop += b - d + im - em;
    births += b; deaths += d; immig += im; emig += em;
  }
  g.pop.births = births; g.pop.deaths = deaths; g.pop.immig = immig; g.pop.emig = emig;
  // ageing (per year)
  g.pop.old += 0.0015 / 52;
  g.pop.young -= 0.001 / 52;
}

function runProgrammes(g) {
  // hospital staffing programme: adds to the staff target each week
  var hs = g.services.health;
  if (g.policies.hospstaff.active) hs.extraStaff += g.policies.hospstaff.value / 52;
  // privatised rail: lower transport cost but quality hit (handled in services)
}

function updateServices(g) {
  for (var i = 0; i < SERVICES.length; i++) {
    var def = SERVICES[i], s = g.services[def.id];
    var budget = g.budget.lines[def.line];
    var staffCost = g.econ.wage * 1.1;
    var target = budget * def.staffShare / staffCost * 1000 + (def.id == "health" ? s.extraStaff : 0);
    var min = minister(g, def.id == "police" ? "interior" : def.id);
    var comp = min ? min.competence : 0.5;
    // hiring takes time, firing is quicker. good ministers hire faster
    var maxHire = s.staff * (0.002 + 0.004 * comp);
    var maxFire = s.staff * 0.006;
    var diff = clamp(target - s.staff, -maxFire, maxHire);
    s.staff += diff;
    s.staffTarget = target;
    // equipment/buildings from the non-staff part of the budget
    var nonStaff = budget * (1 - def.staffShare) * (g.econ.price ? 1 / g.econ.price : 1);
    s.equip += (Math.pow(Math.max(0.05, nonStaff / s.nonStaff0), 0.3) - s.equip) * 0.02;
    var quality = 1;
    if (def.id == "transport") { quality *= g.econ.publicCapital; if (g.flags.railPrivate) quality *= 0.95; }
    s.capacity = s.staff * s.perStaff * s.equip * quality;
    s.demand = serviceDemand(g, def);
    s.access = Math.min(1, s.capacity / s.demand);
    // backlog: unmet demand piles up, some people give up or go private (2% a week)
    s.backlog = Math.max(0, s.backlog * 0.98 + (s.demand - s.capacity) / 52);
    s.wait = 6 * Math.pow(s.demand / s.capacity, 4) + s.backlog / Math.max(0.01, s.capacity) * 52 * 0.5;
    s.wait = clamp(s.wait, 0.5, 104);
    s.quality = clamp(100 * s.access - s.backlog / s.demand * 50, 0, 100);
  }
  // crime responds to police access and unemployment
  var u = 1 - g.econ.employed / g.econ.labourForce;
  var crimeTarget = g.crime0 * (1 + (u - g.econ.natU) * 3) * (g.services.police.access0 / g.services.police.access);
  crimeTarget = clamp(crimeTarget, g.crime0 * 0.5, g.crime0 * 2);
  g.crime += (crimeTarget - g.crime) * 0.02;
}

// ======================================================================
// POLITICS
// ======================================================================
function setRefs(g) {
  var f = g.flows || calcFlows(g, true);
  g.refs = {
    realD: f.q.map(function (q) { return q.disp / g.econ.price; }),
    realPension: g.budget.lines.pensions / g.econ.price / (totalPop(g) * g.pop.old),
    infl: g.econ.infl,
    u: 1 - g.econ.employed / g.econ.labourForce,
    health: g.services.health.access, wait: g.services.health.wait,
    edu: g.services.education.access, crime: g.crime, transport: g.services.transport.access,
    week: g.week
  };
}

function initCohorts(g) {
  g.cohorts = [];
  for (var r = 0; r < g.regions.length; r++)
    for (var a = 0; a < 3; a++)
      for (var q = 0; q < 5; q++)
        g.cohorts.push({ region: r, age: a, q: q, approval: 0.5, factors: {} });
  // set starting approval at the steady value
  updateApproval(g, true);
  var w = approvalWeights(g), tot = 0, avg = 0;
  for (var i = 0; i < g.cohorts.length; i++) { avg += g.cohorts[i].approval * w[i]; tot += w[i]; }
  var shift = g.politics.baseTrust - avg / tot;
  g.politics.baseTrust += shift; // move the base so total matches the template
  updateApproval(g, true);
}

function ageShare(g, a) { return a == 0 ? g.pop.young : (a == 2 ? g.pop.old : 1 - g.pop.old - g.pop.young); }
function cohortPop(g, c) { return g.regions[c.region].pop * ageShare(g, c.age) * 0.2; }
function approvalWeights(g) { return g.cohorts.map(function (c) { return c.age == 0 ? 0 : cohortPop(g, c); }); }

function idealEcon(g, c) { return 25 + 12.5 * c.q + (c.age == 2 ? 5 : 0) + (g.regions[c.region].income > 1.2 ? 5 : 0); }
function idealSocial(g, c) { return (c.age == 2 ? 35 : 55) + (c.region == 0 ? 8 : 0); }

function updateApproval(g, instant) {
  var f = g.flows, e = g.econ, R = g.refs;
  var u = 1 - e.employed / e.labourForce;
  var olds = totalPop(g) * g.pop.old;
  var realPension = g.budget.lines.pensions / e.price / olds;
  var hs = g.services.health, es = g.services.education;
  var yearsInOffice = (g.week - g.politics.termStart) / 52;
  var avgF = {}, wsum = 0;
  for (var i = 0; i < g.cohorts.length; i++) {
    var c = g.cohorts[i];
    var reg = g.regions[c.region];
    var F = {};
    F["Household income"] = c.age == 0 ? 0 : 2.0 * (f.q[c.q].disp / e.price / R.realD[c.q] - 1);
    F["Pensions"] = c.age == 2 ? 2.5 * (realPension / R.realPension - 1) : 0;
    F["Prices"] = -1.5 * (e.infl - R.infl) * (1.3 - 0.15 * c.q);
    F["Jobs"] = c.age == 1 ? -2.0 * (u * reg.unemp - R.u * reg.unemp) : -0.5 * (u - R.u);
    F["Health service"] = 1.2 * (hs.access - R.health) * (c.age == 2 ? 2 : 1) - 0.004 * (hs.wait - R.wait);
    F["Schools"] = c.age == 1 ? 0.8 * (es.access - R.edu) : 0.2 * (es.access - R.edu);
    F["Crime"] = -0.25 * (g.crime / R.crime - 1);
    F["Transport"] = 0.5 * (g.services.transport.access - R.transport);
    F["Ideology"] = -0.005 * (Math.abs(g.politics.record - idealEcon(g, c)) - Math.abs(g.politics.record0 - idealEcon(g, c))) - 0.004 * Math.abs(g.politics.record - idealEcon(g, c));
    F["Specific policies"] = policyCohortEffect(g, c);
    F["Events and scandals"] = g.politics.mood;
    F["Time in office"] = -0.02 * yearsInOffice;
    var S = g.politics.baseTrust;
    for (var k in F) S += F[k];
    S = clamp(S, 0.04, 0.96);
    if (instant) c.approval = S;
    else c.approval += (S - c.approval) * 0.08;
    c.factors = F;
    if (c.age > 0) {
      var w = cohortPop(g, c);
      for (var k in F) avgF[k] = (avgF[k] || 0) + F[k] * w;
      wsum += w;
    }
  }
  for (var k in avgF) avgF[k] /= wsum;
  g.politics.factors = avgF;
  g.politics.approval = overallApproval(g);
}

function overallApproval(g) {
  var w = approvalWeights(g), a = 0, t = 0;
  for (var i = 0; i < g.cohorts.length; i++) { a += g.cohorts[i].approval * w[i]; t += w[i]; }
  return a / t;
}

// how each group feels about particular policies
function policyCohortEffect(g, c) {
  var p = g.policies, x = 0;
  if (p.minwage.active) x += (p.minwage.value - g.policies0.minwage.value) * (c.q <= 1 ? 0.002 : (c.q == 4 ? -0.001 : 0));
  if (p.rentcap.active) x += (c.q <= 2 && c.age == 1 ? 0.03 : -0.01) * (c.region == 0 ? 1.5 : 1);
  if (p.conscription.active) x -= p.conscription.value * (c.age == 1 && c.q <= 2 ? 0.004 : 0.001);
  if (p.immigration.active) x -= (p.immigration.value - g.policies0.immigration.value) * (idealSocial(g, c) < 45 ? 0.0006 : 0.0001);
  if (p.emissions.active) x += p.emissions.value * (c.age == 1 && c.q >= 2 ? 0.0005 : -0.0002);
  if (p.nationalise.active) x += (c.q <= 1 ? 0.02 : (c.q == 4 ? -0.03 : 0));
  if (p.privatise.active) x += (c.q <= 2 ? -0.02 : 0.005);
  if (p.freeschool.active) x += c.age == 1 ? p.freeschool.value * 0.004 : 0;
  // tax rises: people notice the headline rate as well as the money
  x -= (g.taxes.vat - g.taxes0.vat) * 0.004;
  if (c.q == 4) x -= (g.taxes.incomeTop - g.taxes0.incomeTop) * 0.003;
  if (c.q >= 2) x -= (g.taxes.incomeBasic - g.taxes0.incomeBasic) * 0.003;
  return x;
}

// votes: each cohort likes parties that are close to it, and judges the government on approval
function partyShares(g, c) {
  var utils = [], mx = -1e9;
  for (var i = 0; i < g.parties.length; i++) {
    var p = g.parties[i];
    var uu = -Math.abs(p.econ - idealEcon(g, c)) / 10 - Math.abs(p.social - idealSocial(g, c)) / 15 + p.bias;
    uu += p.inGov ? 6 * (c.approval - 0.45) : -2 * (c.approval - 0.45);
    utils.push(uu); if (uu > mx) mx = uu;
  }
  var tot = 0, out = [];
  for (var i = 0; i < utils.length; i++) { out.push(Math.exp(utils[i] - mx)); tot += out[i]; }
  for (var i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function turnout(c) { return c.age == 0 ? 0 : 0.5 + 0.12 * c.age + 0.03 * c.q; }

function nationalShares(g, regionIndex) {
  var shares = g.parties.map(function () { return 0; }), tot = 0;
  for (var i = 0; i < g.cohorts.length; i++) {
    var c = g.cohorts[i];
    if (c.age == 0) continue;
    if (regionIndex !== undefined && c.region != regionIndex) continue;
    var w = cohortPop(g, c) * turnout(c);
    var s = partyShares(g, c);
    for (var j = 0; j < s.length; j++) shares[j] += s[j] * w;
    tot += w;
  }
  for (var j = 0; j < shares.length; j++) shares[j] /= tot;
  return shares;
}

function calibratePolls(g) {
  // fit party bias so the first poll matches the current seats (roughly)
  for (var it = 0; it < 40; it++) {
    var s = nationalShares(g);
    for (var i = 0; i < g.parties.length; i++) {
      var target = g.parties[i].seats / g.constitution.seats;
      g.parties[i].bias += Math.log(target / s[i]) * 0.8;
    }
  }
  updatePolls(g);
}

function updatePolls(g) {
  var s = nationalShares(g);
  for (var i = 0; i < g.parties.length; i++) g.parties[i].poll = s[i];
}

function politicsWeekly(g) {
  // mood fades back to normal
  g.politics.mood *= 0.95;
  // coalition partners get fed up if their poll drops or patience is low
  var gp = govParties(g);
  for (var i = 0; i < gp.length; i++) {
    var p = gp[i];
    if (p.player) continue;
    p.patience = Math.min(80, p.patience + 0.3);
    if (g.politics.approval < 0.3) p.patience -= 0.4;
    if (p.patience <= 0) {
      p.inGov = false;
      addEvent(g, "coalition", 3, p.name + " quits the government", { party: p.name, seats: p.seats, govSeats: govSeats(g), majority: g.constitution.majority },
        "Its patience with the government ran out after policy disagreements and falling support.", -1, true);
      // its ministers go, replaced by player party people
      for (var j = 0; j < g.cabinet.length; j++) if (g.cabinet[j].party == p.id) {
        g.cabinet[j].party = playerParty(g).id; g.cabinet[j].name = randomName(g); g.cabinet[j].competence = 0.3 + rand(g) * 0.4; g.cabinet[j].since = g.week;
      }
      g.politics.mood -= 0.03;
    }
  }
  // confidence vote if the government lost its majority
  if (g.constitution.confidenceRule && govSeats(g) < g.constitution.majority && !g.politics.snapElection) {
    var opp = g.constitution.seats - govSeats(g);
    // opposition only brings it down if they're united-ish and the government is unpopular
    var against = Math.round(opp * clamp(0.75 + (0.4 - g.politics.approval), 0.5, 1));
    var forGov = g.constitution.seats - against;
    var lost = against >= g.constitution.majority;
    g.politics.lastConfidence = { week: g.week, forGov: forGov, against: against, lost: lost };
    if (lost) {
      g.politics.snapElection = g.week + 6;
      addEvent(g, "confidence", 3, "Government loses confidence vote " + against + " to " + forGov,
        { against: against, forGov: forGov, election: weekDate(g, g.week + 6) },
        "The government no longer has a majority after a coalition partner left. A snap election is called.", -1, true);
    } else if (!g.politics.minorityNoted) {
      g.politics.minorityNoted = true;
      addEvent(g, "confidence", 2, "Minority government survives confidence vote", { against: against, forGov: forGov },
        "Not enough opposition members voted against the government.", 0, true);
    }
  }
  // elections
  var due = g.politics.snapElection ? g.politics.snapElection : g.politics.nextElection;
  if (g.week >= due) holdElection(g);
  else if (due - g.week == 4) addEvent(g, "campaign", 2, "Election campaign begins - polling day is " + weekDate(g, due), { date: weekDate(g, due) }, "Scheduled under the constitution.", 0);
}

// D'Hondt seat sharing
function dhondt(votes, seats, threshold) {
  var res = votes.map(function () { return 0; });
  var tot = sum(votes);
  for (var s = 0; s < seats; s++) {
    var best = -1, bi = 0;
    for (var i = 0; i < votes.length; i++) {
      if (threshold && votes[i] / tot < threshold) continue;
      var q = votes[i] / (res[i] + 1);
      if (q > best) { best = q; bi = i; }
    }
    res[bi]++;
  }
  return res;
}

function holdElection(g) {
  var sys = g.constitution.electionSystem;
  var seats = g.parties.map(function () { return 0; });
  var regionResults = [];
  var nat = nationalShares(g);
  var turnoutTot = 0, adultsTot = 0;
  for (var i = 0; i < g.cohorts.length; i++) if (g.cohorts[i].age > 0) { var w = cohortPop(g, g.cohorts[i]); turnoutTot += w * turnout(g.cohorts[i]); adultsTot += w; }
  if (sys == "national") {
    seats = dhondt(nat, g.constitution.seats, 0.05);
  }
  for (var r = 0; r < g.regions.length; r++) {
    var sh = nationalShares(g, r);
    var rs = g.parties.map(function () { return 0; });
    if (sys == "dhondt") {
      rs = dhondt(sh, g.regions[r].seats, 0);
    } else if (sys == "fptp") {
      for (var d = 0; d < g.regions[r].seats; d++) {
        var best = -1, bi = 0;
        for (var i = 0; i < sh.length; i++) {
          var local = sh[i] * Math.exp((rand(g) - 0.5) * 0.6);
          if (local > best) { best = local; bi = i; }
        }
        rs[bi]++;
      }
    }
    if (sys != "national") for (var i = 0; i < seats.length; i++) seats[i] += rs[i];
    regionResults.push({ region: g.regions[r].name, shares: sh, seats: sys == "national" ? null : rs });
  }
  var old = g.parties.map(function (p) { return p.seats; });
  for (var i = 0; i < g.parties.length; i++) g.parties[i].seats = seats[i];

  // explanation: biggest approval factors
  var fac = g.politics.factors, drivers = [];
  for (var k in fac) drivers.push([k, fac[k]]);
  drivers.sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });

  var result = { week: g.week, date: weekDate(g), system: sys, turnout: turnoutTot / adultsTot, shares: nat, seats: seats, oldSeats: old,
    parties: g.parties.map(function (p) { return p.name; }), regions: regionResults, drivers: drivers.slice(0, 5), approval: g.politics.approval };

  // ---- who governs now? ----
  var me = playerParty(g);
  var stayed = false, text = "";
  if (g.template == "B") {
    // presidential run-off: our candidate vs biggest other party
    var oppIdx = -1, best = -1;
    for (var i = 0; i < g.parties.length; i++) if (!g.parties[i].player && nat[i] > best) { best = nat[i]; oppIdx = i; }
    var myIdx = g.parties.indexOf(me);
    var mine = nat[myIdx] + 0.25 * (g.politics.approval - 0.45);
    var runoff = clamp(mine / (mine + nat[oppIdx]), 0.05, 0.95);
    result.runoff = { player: runoff, opponent: g.parties[oppIdx].name };
    stayed = runoff > 0.5;
    text = stayed ? "President " + g.leaderName + " re-elected with " + pct(runoff, 1) + " in the run-off" : g.parties[oppIdx].name + " candidate wins the presidency with " + pct(1 - runoff, 1);
    if (stayed) {
      // allies: parties close to us join the congress bloc
      for (var i = 0; i < g.parties.length; i++) g.parties[i].inGov = g.parties[i].player || Math.abs(g.parties[i].econ - me.econ) < 10;
    }
  } else {
    var coalition = formCoalition(g);
    stayed = coalition.indexOf(me) >= 0 && coalition[0] == me;
    for (var i = 0; i < g.parties.length; i++) g.parties[i].inGov = coalition.indexOf(g.parties[i]) >= 0;
    var names = coalition.map(function (p) { return p.name; }).join(", ");
    text = stayed ? g.leaderName + " stays in office leading " + names : "Government changes: " + coalition[0].name + " will lead (" + names + ")";
    result.coalition = names;
  }
  result.stayed = stayed;
  result.text = text;
  g.politics.elections.push(result);
  addEvent(g, "election", 3, text, { turnout: pct(result.turnout, 1), govSeats: govSeats(g), majority: g.constitution.majority, top: result.drivers[0] ? result.drivers[0][0] : "" },
    "General election held on " + result.date + ". Main driver: " + (result.drivers[0] ? result.drivers[0][0] : "none") + ".", stayed ? 1 : -1, true);

  if (!stayed && g.difficulty != "sandbox") {
    g.gameOver = { week: g.week, reason: "You lost the election. " + text };
  }
  // new term
  g.politics.termStart = g.week;
  g.politics.nextElection = g.week + 52 * g.constitution.termYears;
  g.politics.snapElection = 0;
  g.politics.minorityNoted = false;
  g.politics.record0 = g.politics.record;
  for (var i = 0; i < g.parties.length; i++) g.parties[i].patience = 70;
  if (stayed) makeCabinet(g);
  setRefs(g);
}

function formCoalition(g) {
  var sorted = g.parties.slice().sort(function (a, b) { return b.seats - a.seats; });
  var lead = sorted[0];
  var co = [lead], seats = lead.seats;
  var others = sorted.slice(1).sort(function (a, b) { return Math.abs(a.econ - lead.econ) + Math.abs(a.social - lead.social) * 0.5 - Math.abs(b.econ - lead.econ) - Math.abs(b.social - lead.social) * 0.5; });
  for (var i = 0; i < others.length && seats < g.constitution.majority; i++) {
    if (co.length >= 4) break;
    co.push(others[i]); seats += others[i].seats;
  }
  return co;
}

// ======================================================================
// BILLS AND LAWS
// ======================================================================

// a bill = list of changes. change types: tax, spend, policy, amend
function billLean(g, changes) {
  var lean = 0;
  for (var i = 0; i < changes.length; i++) {
    var c = changes[i];
    if (c.kind == "tax") lean += (c.to - c.from) > 0 ? -0.3 : 0.3;
    if (c.kind == "spend") lean += (c.to - c.from) > 0 ? -0.25 : 0.25;
    if (c.kind == "policy") {
      var L = { minwage: -0.6, rentcap: -0.7, energysub: -0.3, hospstaff: -0.4, infra: -0.3, pensionidx: -0.2, nationalise: -1, privatise: 1, conscription: 0.4, immigration: 0.3, freeschool: -0.5, emissions: -0.5 }[c.id] || 0;
      if (c.id == "pensionidx" && c.to < 0) L = 0.5;
      lean += L;
    }
  }
  return clamp(lean, -1, 1);
}

function predictVote(g, bill) {
  var res = { yes: 0, no: 0, abstain: 0, parties: [] };
  for (var i = 0; i < g.parties.length; i++) {
    var p = g.parties[i];
    var align = -bill.lean * (50 - p.econ) / 50; // >0 means the party agrees
    var y = 0;
    if (bill.type == "amend") align -= 0.2;
    if (p.inGov) {
      var rebels = clamp(-align * 0.5, 0, 0.4);
      if (!p.player && p.patience < 20 && align < 0) rebels = 1;
      y = Math.round(p.seats * (1 - rebels));
    } else {
      if (align > 0.2) y = Math.round(p.seats * Math.min(1, align * 1.5));
      if (bill.type == "amend" && align > 0.05) y = Math.round(p.seats * 0.5);
    }
    var ab = Math.round((p.seats - y) * (p.inGov ? 0.5 : 0.15));
    var n = p.seats - y - ab;
    res.yes += y; res.no += n; res.abstain += ab;
    res.parties.push({ name: p.name, yes: y, no: n, abstain: ab });
  }
  res.needed = bill.type == "amend" ? g.constitution.supermajority : res.yes + res.no > 0 ? Math.floor((res.yes + res.no) / 2) + 1 : 1;
  res.passes = bill.type == "amend" ? res.yes >= g.constitution.supermajority : res.yes > res.no;
  return res;
}

// static costing: change in revenue / spending per year at today's tax bases
function costBill(g, changes) {
  var g2 = copy(g);
  var before = calcFlows(g2, false);
  applyChanges(g2, changes, true);
  var after = calcFlows(g2, false);
  // the staffing programme builds up over the year, so count about half a year's recruits
  for (var i = 0; i < changes.length; i++) if (changes[i].kind == "policy" && changes[i].id == "hospstaff") after.spendTotal += (changes[i].to - changes[i].from) * 0.5 * g.econ.wage * 1.1 / 1000;
  after.balance = after.revTotal - after.spendTotal;
  return { revenue: after.revTotal - before.revTotal, spending: after.spendTotal - before.spendTotal, balance: after.balance - before.balance, newBalance: after.balance, oneOff: g2.debtAdjust || 0 };
}

// the 5 checks from section 6.3
function validateBill(g, bill) {
  var checks = [];
  // LEGAL
  var legal = { name: "LEGAL", ok: true, msg: "The legislature has authority. Procedure: " + (bill.type == "amend" ? "constitutional amendment (" + g.constitution.amendmentText + ")" : "ordinary bill, simple majority") + "." };
  if (g.gameOver) { legal.ok = false; legal.msg = "The government is no longer in office."; }
  for (var i = 0; i < bill.changes.length; i++) {
    var c = bill.changes[i];
    if (c.kind == "policy" && c.id == "privatise" && !g.flags.railPrivate && g.policies.nationalise.active && false) legal.ok = false;
    if (c.kind == "policy" && c.id == "nationalise" && g.flags.energyPublic && c.to > 0) { legal.ok = false; legal.msg = "Energy utilities are already in public ownership."; }
    if (c.kind == "policy" && c.id == "privatise" && g.flags.railPrivate && c.to > 0) { legal.ok = false; legal.msg = "Rail is already privatised."; }
  }
  checks.push(legal);
  // FISCAL
  var cost = costBill(g, bill.changes);
  bill.cost = cost;
  var newDef = -cost.newBalance / g.econ.gdp;
  var fiscal = { name: "FISCAL", ok: true, msg: "Annual effect on the budget balance: " + money(g, cost.balance) + ". Deficit would be " + pct(newDef, 1) + " of GDP." };
  if (cost.oneOff) fiscal.msg += " One-off debt change: " + money(g, cost.oneOff) + ".";
  if (g.constitution.fiscalRule && newDef > g.constitution.fiscalRule / 100 && cost.balance < 0) {
    fiscal.ok = false; fiscal.msg = "The fiscal rule limits the deficit to " + g.constitution.fiscalRule + "% of GDP. This bill would make it " + pct(newDef, 1) + ". Find " + money(g, (newDef - g.constitution.fiscalRule / 100) * g.econ.gdp) + " of savings or change the constitution.";
  } else if (newDef > 0.1 && cost.balance < 0) {
    fiscal.ok = false; fiscal.msg = "Deficit would be " + pct(newDef, 1) + " of GDP. Markets will not lend that much. Annual gap: " + money(g, -cost.newBalance) + ".";
  } else if (newDef > 0.05 && cost.balance < 0) fiscal.warn = true;
  checks.push(fiscal);
  // ADMIN
  var admin = { name: "ADMIN", ok: true, msg: "Ministries have capacity to deliver this." };
  var inProgress = g.bills.filter(function (b) { return b.stage != "IMPLEMENTED" && b.stage != "REJECTED" && b.stage != "WITHDRAWN"; }).length;
  if (inProgress >= 4) { admin.ok = false; admin.msg = "There are already " + inProgress + " bills going through parliament. The civil service can only handle 4 at once."; }
  for (var i = 0; i < bill.changes.length; i++) {
    var c = bill.changes[i];
    if (c.kind == "policy" && c.id == "hospstaff" && c.to > 12 && minister(g, "health").competence < 0.5) { admin.warn = true; admin.msg = "Health ministry can only recruit about 12,000 a year with the current minister. Extra recruits will arrive slowly."; }
    if (c.kind == "spend" && c.to < c.from * 0.8) { admin.warn = true; admin.msg = "Cutting " + c.name + " by more than 20% at once will mean redundancies and may cause strikes."; }
  }
  checks.push(admin);
  // ECONOMIC
  var econ = { name: "ECONOMIC", ok: true, msg: "All values are inside the model's supported ranges." };
  for (var i = 0; i < bill.changes.length; i++) {
    var c = bill.changes[i];
    if (isNaN(c.to)) { econ.ok = false; econ.msg = c.name + " is not a number."; }
    else if (c.min !== undefined && (c.to < c.min || c.to > c.max)) { econ.ok = false; econ.msg = c.name + " must be between " + c.min + " and " + c.max + "."; }
  }
  checks.push(econ);
  // POLITICAL
  var v = predictVote(g, bill);
  bill.prediction = v;
  var pol = { name: "POLITICAL", ok: true, msg: "Expected vote: " + v.yes + " for, " + v.no + " against, " + v.abstain + " abstain. " + (bill.type == "amend" ? "Needs " + g.constitution.supermajority + " of " + g.constitution.seats + " votes." : "Needs more votes for than against.") };
  if (!v.passes) { pol.warn = true; pol.msg += " LIKELY TO FAIL. Government parties have " + govSeats(g) + " seats."; }
  checks.push(pol);
  return checks;
}

function applyChanges(g, changes, preview) {
  for (var i = 0; i < changes.length; i++) {
    var c = changes[i];
    if (c.kind == "tax") {
      if (c.id == "vat" && !preview) g.econ.priceShock += ((1 + c.to / 100) / (1 + c.from / 100) - 1) * 0.6;
      if (c.id == "excise" && !preview) g.econ.priceShock += (c.to - c.from) / 100 * 0.06;
      g.taxes[c.id] = c.to;
    }
    if (c.kind == "spend") g.budget.lines[c.id] = c.to;
    if (c.kind == "policy") {
      var p = g.policies[c.id];
      p.value = c.to; p.since = g.week;
      p.active = c.to != 0 || c.id == "minwage" || c.id == "immigration";
      if (c.id == "rentcap") p.active = true;
      // energy subsidy cuts bills once (a one-off fall in the price level), it doesnt keep cutting inflation forever
      if (c.id == "energysub" && !preview) g.econ.priceShock -= (c.to - c.from) / g.flows.C;
      if (c.id == "pensionidx") { g.budget.lines.pensions *= 1 + c.to / 100; p.active = false; }
      if (c.id == "nationalise" && c.to > 0) { g.debtAdjust = (g.debtAdjust || 0) + c.to; g.flags.energyPublic = true; }
      if (c.id == "privatise" && c.to > 0) { g.debtAdjust = (g.debtAdjust || 0) - c.to; g.flags.railPrivate = true; g.budget.lines.transport *= 0.85; }
      if (c.id == "nationalise" || c.id == "privatise") p.active = c.to > 0;
    }
    if (c.kind == "amend") {
      if (c.id == "termYears") { g.constitution.termYears = c.to; g.politics.nextElection = g.politics.termStart + 52 * c.to; }
      if (c.id == "fiscalRule") g.constitution.fiscalRule = c.to;
      if (c.id == "electionSystem") g.constitution.electionSystem = c.to;
      if (c.id == "cbIndependent") g.constitution.centralBankIndependent = !!c.to;
    }
  }
}

// player submits a bill (command)
function submitBill(g, title, type, changes, ministry) {
  g.billCounter++;
  var bill = { id: "B-" + g.billCounter, title: title, type: type, ministry: ministry || "finance", changes: changes, lean: billLean(g, changes),
    stage: "DRAFT", log: [], votes: [], amendments: [], submitted: g.week, effective: null };
  var checks = validateBill(g, bill);
  bill.checks = checks;
  for (var i = 0; i < checks.length; i++) if (!checks[i].ok) return { ok: false, bill: bill, checks: checks };
  bill.log.push({ week: g.week, stage: "DRAFT", note: "Drafted by the " + ministryName(bill.ministry) + "." });
  bill.log.push({ week: g.week, stage: "LEGAL REVIEW", note: checks[0].msg });
  bill.log.push({ week: g.week, stage: "FISCAL REVIEW", note: checks[1].msg });
  bill.log.push({ week: g.week, stage: "COMMITTEE", note: "Sent to committee. " + checks[4].msg });
  bill.stage = "COMMITTEE";
  g.bills.push(bill);
  g.commandLog.push({ week: g.week, cmd: "submitBill", bill: bill.id, title: title });
  return { ok: true, bill: bill, checks: checks };
}

function amendBill(g, billId, changes) {
  var bill = findBill(g, billId);
  if (!bill || bill.stage != "AMENDMENT WINDOW") return { ok: false, msg: "Bill can only be amended during the amendment window." };
  var old = bill.changes;
  bill.changes = changes;
  bill.lean = billLean(g, changes);
  var checks = validateBill(g, bill);
  for (var i = 0; i < checks.length; i++) if (!checks[i].ok) { bill.changes = old; bill.lean = billLean(g, old); return { ok: false, checks: checks }; }
  bill.amendments.push({ week: g.week, from: old, to: changes });
  bill.log.push({ week: g.week, stage: "AMENDMENT WINDOW", note: "Amended by the government. " + checks[1].msg });
  g.commandLog.push({ week: g.week, cmd: "amendBill", bill: bill.id });
  return { ok: true, checks: checks };
}

function withdrawBill(g, billId) {
  var bill = findBill(g, billId);
  if (!bill) return;
  bill.stage = "WITHDRAWN";
  bill.log.push({ week: g.week, stage: "WITHDRAWN", note: "Withdrawn by the government." });
  g.commandLog.push({ week: g.week, cmd: "withdrawBill", bill: bill.id });
}

function findBill(g, id) { for (var i = 0; i < g.bills.length; i++) if (g.bills[i].id == id) return g.bills[i]; }
function ministryName(id) { for (var i = 0; i < MINISTRIES.length; i++) if (MINISTRIES[i].id == id) return MINISTRIES[i].name; return id; }

function processBills(g) {
  for (var i = 0; i < g.bills.length; i++) {
    var b = g.bills[i];
    if (b.submitted >= g.week) continue;
    if (b.stage == "COMMITTEE") {
      var v = predictVote(g, b);
      b.votes.push({ week: g.week, stage: "FIRST VOTE", yes: v.yes, no: v.no, abstain: v.abstain, parties: v.parties });
      if (!v.passes) {
        b.stage = "REJECTED";
        b.log.push({ week: g.week, stage: "FIRST VOTE", note: "Defeated " + v.yes + " to " + v.no + "." });
        addEvent(g, "billFail", 2, "Parliament rejects " + b.title, { yes: v.yes, no: v.no, bill: b.id }, "Not enough members voted for it.", -1, true);
        g.politics.mood -= 0.01;
      } else {
        b.stage = "AMENDMENT WINDOW";
        b.log.push({ week: g.week, stage: "FIRST VOTE", note: "Passed first vote " + v.yes + " to " + v.no + ". Amendment window open for one week." });
      }
    } else if (b.stage == "AMENDMENT WINDOW") {
      var v = predictVote(g, b);
      b.votes.push({ week: g.week, stage: "FINAL VOTE", yes: v.yes, no: v.no, abstain: v.abstain, parties: v.parties });
      if (!v.passes) {
        b.stage = "REJECTED";
        b.log.push({ week: g.week, stage: "FINAL VOTE", note: "Defeated " + v.yes + " to " + v.no + "." });
        addEvent(g, "billFail", 2, "Parliament rejects " + b.title + " at final vote", { yes: v.yes, no: v.no, bill: b.id }, "Not enough members voted for it.", -1, true);
        continue;
      }
      if (b.type == "amend" && g.constitution.referendum) {
        // referendum: people vote mostly on how they feel about the government
        var yes = clamp(0.35 + 0.4 * g.politics.approval + (rand(g) - 0.5) * 0.06, 0.05, 0.95);
        b.log.push({ week: g.week, stage: "REFERENDUM", note: "National referendum: " + pct(yes, 1) + " yes." });
        b.referendum = yes;
        if (yes < 0.5) {
          b.stage = "REJECTED";
          addEvent(g, "referendum", 3, "Voters reject constitutional change in referendum", { yes: pct(yes, 1), bill: b.id }, "The referendum result was below 50%.", -1, true);
          continue;
        }
        addEvent(g, "referendum", 3, "Referendum approves constitutional change", { yes: pct(yes, 1), bill: b.id }, "The referendum result was above 50%.", 1, true);
      }
      b.log.push({ week: g.week, stage: "FINAL VOTE", note: "Passed " + v.yes + " to " + v.no + "." });
      b.log.push({ week: g.week, stage: "EXECUTIVE ASSENT", note: "Signed into law." });
      b.stage = "EXECUTIVE ASSENT";
      b.effective = g.week + 1;
      // coalition partners who disagreed get annoyed
      for (var j = 0; j < g.parties.length; j++) {
        var p = g.parties[j];
        if (p.inGov && !p.player) { var al = -b.lean * (50 - p.econ) / 50; if (al < -0.15) p.patience -= 15 * Math.abs(al); }
      }
      // what the government stands for moves with what it passes
      g.politics.record = clamp(g.politics.record + b.lean * 4, 0, 100);
      addEvent(g, "billPass", 2, "Parliament passes " + b.title, { yes: v.yes, no: v.no, bill: b.id, effective: weekDate(g, b.effective) }, "Government majority held.", 1, false, b.id);
    }
  }
}

function applyScheduledLaws(g) {
  for (var i = 0; i < g.bills.length; i++) {
    var b = g.bills[i];
    if (b.stage == "EXECUTIVE ASSENT" && b.effective <= g.week) {
      applyChanges(g, b.changes, false);
      b.stage = "IMPLEMENTED";
      b.log.push({ week: g.week, stage: "IMPLEMENTATION", note: "Now in force." });
      g.laws.push({ week: g.week, bill: b.id, title: b.title });
      var desc = b.changes.map(function (c) { return c.name + ": " + c.from + " -> " + c.to + (c.unit ? " " + c.unit : ""); }).join("; ");
      addEvent(g, "lawInForce", 2, b.title + " comes into force", { changes: desc, bill: b.id }, "Passed by parliament on " + weekDate(g, b.effective - 1) + ".", 0, false, b.id);
      // spending cuts to services can cause strikes
      for (var j = 0; j < b.changes.length; j++) {
        var c = b.changes[j];
        if (c.kind == "spend" && c.to < c.from * 0.93 && ["health", "education", "police", "transport"].indexOf(c.id) >= 0) {
          g.shocks.push({ type: "strike", sector: c.id, weeks: 3, mag: 0.0015 });
          addEvent(g, "strike", 3, ministryName(c.id == "police" ? "interior" : c.id) + " staff strike over budget cut", { line: c.name, cut: money(g, c.from - c.to) },
            "Unions are protesting the cut to " + c.name + " in bill " + b.id + ".", -1, true, b.id);
          g.politics.mood -= 0.015;
        }
      }
    }
  }
}

// ======================================================================
// WORLD EVENTS, FOREIGN STATES, DEFENCE, PROTESTS
// ======================================================================
function worldEvents(g) {
  // existing shocks fade
  for (var i = g.shocks.length - 1; i >= 0; i--) {
    var s = g.shocks[i];
    s.weeks--;
    if (s.type == "strike") g.econ.gdp *= 1 - s.mag; // lost output while on strike (applied before flows)
    if (s.weeks <= 0) g.shocks.splice(i, 1);
  }
  if (g.calm) return;
  if (chance(g, 0.0025)) {
    var mag = 0.2 + rand(g) * 0.4;
    g.shocks.push({ type: "energy", weeks: 26, mag: mag });
    addEvent(g, "energyShock", 3, "Energy prices surge " + Math.round(mag * 100) + "% after supply disruption", { rise: Math.round(mag * 100) + "%" },
      "A pipeline outage abroad cut supplies to the region.", -1, true);
  }
  if (chance(g, 0.003)) {
    var r = Math.floor(rand(g) * g.regions.length);
    var dmg = g.econ.gdp * (0.002 + rand(g) * 0.006);
    g.budget.emergency += dmg * 2;
    g.econ.publicCapital -= 0.01;
    g.econ.gdp -= dmg;
    addEvent(g, "disaster", 3, "Severe floods hit " + g.regions[r].name, { region: g.regions[r].name, damage: money(g, dmg), emergency: money(g, dmg * 2) },
      "Heavy storms caused river flooding. Emergency spending has been released.", -1, true, null, r);
  }
  if (chance(g, 0.0015)) {
    g.shocks.push({ type: "health", weeks: 12, mag: 0.15 });
    addEvent(g, "healthEmergency", 3, "Public health emergency declared as outbreak spreads", { extraDemand: "15%" },
      "An infectious disease outbreak is raising demand on hospitals.", -1, true);
  }
  if (chance(g, 0.0015)) {
    g.shocks.push({ type: "credit", weeks: 26, mag: 0.1 });
    g.econ.confidence -= 0.06;
    addEvent(g, "creditShock", 3, "Banks tighten lending after losses on property loans", { cut: "10%" },
      "Bank capital fell after commercial property losses. Credit to business is restricted.", -1, true);
  }
  if (chance(g, 0.005)) {
    var up = rand(g) < 0.5;
    g.econ.worldDemand *= up ? 1.02 : 0.98;
    var who = pick(g, g.foreign);
    addEvent(g, "world", 1, (up ? "Boom in " : "Slowdown in ") + who.name + (up ? " lifts" : " hits") + " export orders", { country: who.name, change: up ? "+2%" : "-2%" },
      "World demand for our exports changed.", up ? 1 : -1);
  }
  if (chance(g, 0.004)) {
    var m = pick(g, g.cabinet);
    m.approval -= 0.15;
    g.politics.mood -= 0.02;
    addEvent(g, "scandal", 2, "Minister " + m.name + " caught up in expenses scandal", { minister: m.name, ministry: ministryName(m.ministry) },
      "Newspapers obtained receipts showing misuse of public funds. You can dismiss the minister from the Cabinet page.", -1, true);
  }
  // economy slowly drifts back
  g.econ.worldDemand += (1 - g.econ.worldDemand) * 0.002;
}

function foreignAI(g) {
  if ((g.week - 1) % 4 != 0) return;
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    // relations drift back toward their natural level
    var base = FOREIGN[i].relation;
    f.relation += (base - f.relation) * 0.02 + (rand(g) - 0.5) * 2;
    if (f.sanctioned) f.relation -= 1;
    f.relation = clamp(f.relation, 0, 100);
    f.gdp *= 1 + (0.02 + (rand(g) - 0.5) * 0.02) / 13;
  }
  // sometimes a foreign state makes an offer to us
  if (chance(g, 0.15)) {
    var f = pick(g, g.foreign);
    var kind = f.interest == "trade" ? "cooperation" : (f.interest == "security" ? "nonaggression" : (f.interest == "aid" ? "aid" : (f.interest == "environment" ? "climate" : "embassy")));
    if (f.treaties.indexOf(kind) < 0 && f.relation > 30) {
      g.offers.push({ id: "OF-" + g.week + "-" + f.id, from: f.id, treaty: kind, week: g.week, status: "open" });
      addEvent(g, "offer", 1, f.name + " proposes a " + treatyName(kind).toLowerCase(), { country: f.name, treaty: treatyName(kind) }, f.name + "'s government wants closer ties on " + f.interest + ".", 0);
    }
  }
}

function treatyName(id) { for (var i = 0; i < TREATIES.length; i++) if (TREATIES[i].id == id) return TREATIES[i].name; return id; }

// foreign AI decides about our offer. returns accept / reject / counter with reasons
function evaluateOffer(g, countryId, treaty) {
  var f = null;
  for (var i = 0; i < g.foreign.length; i++) if (g.foreign[i].id == countryId) f = g.foreign[i];
  var reasons = [];
  var score = f.relation / 100;
  reasons.push("Relations are " + Math.round(f.relation) + "/100.");
  var likes = { trade: ["fta", "cooperation", "lift"], security: ["nonaggression", "defence", "extradition"], aid: ["aid", "embassy", "cooperation"], resources: ["cooperation", "fta"], environment: ["climate", "aid"] }[f.interest];
  if (likes.indexOf(treaty) >= 0) { score += 0.25; reasons.push("It fits their strategic interest (" + f.interest + ")."); }
  if (treaty == "fta" && g.taxes.tariff > 10) { score -= 0.15; reasons.push("Our tariffs are high (" + g.taxes.tariff + "%)."); }
  if (treaty == "defence" && f.military > 70) { score -= 0.2; reasons.push("They don't want to be tied to a smaller military."); }
  if (treaty == "defence" && g.defence.readiness < 45) { score -= 0.1; reasons.push("Our forces have low readiness (" + Math.round(g.defence.readiness) + ")."); }
  if (f.gov == "One-party state" || f.gov == "Military government" || f.gov == "Hybrid regime") { if (treaty == "climate" || treaty == "extradition") { score -= 0.2; reasons.push("Their regime is suspicious of this kind of deal."); } }
  if (f.treaties.indexOf(treaty) >= 0) { score = -1; reasons.push("This treaty already exists."); }
  if (f.sanctioned && treaty != "lift") { score -= 0.4; reasons.push("We have sanctions on them."); }
  var min = minister(g, "foreign");
  score += (min.competence - 0.5) * 0.15;
  if (treaty == "sanctions" || treaty == "aid" || treaty == "lift") return { result: "accept", score: score, reasons: ["This is a decision for our government alone."] };
  var result = score >= 0.75 ? "accept" : (score >= 0.55 ? "counter" : "reject");
  var counter = null;
  if (result == "counter") { counter = Math.round((0.75 - score) * 20 * 10) / 10 + 0.2; reasons.push("They would accept with a development aid payment of " + counter + "bn."); }
  return { result: result, score: score, reasons: reasons, counter: counter };
}

function makeTreaty(g, countryId, treaty, aidPaid) {
  var f = null;
  for (var i = 0; i < g.foreign.length; i++) if (g.foreign[i].id == countryId) f = g.foreign[i];
  if (treaty == "sanctions") { f.sanctioned = true; f.relation -= 25; g.econ.tradeFactor -= f.trade * 0.6; }
  else if (treaty == "lift") { if (f.sanctioned) { f.sanctioned = false; g.econ.tradeFactor += f.trade * 0.6; f.relation += 10; } }
  else if (treaty == "aid") { g.budget.lines.foreign += 0.5; f.relation += 12; }
  else {
    f.treaties.push(treaty);
    f.relation += 8;
    if (treaty == "fta") g.econ.tradeFactor += f.trade * 0.5;
    if (treaty == "cooperation") g.econ.tradeFactor += f.trade * 0.15;
    if (treaty == "defence") g.budget.lines.defence += 0.2;
  }
  if (aidPaid) { g.debtAdjust = (g.debtAdjust || 0) + aidPaid; f.relation += 5; }
  f.relation = clamp(f.relation, 0, 100);
  g.commandLog.push({ week: g.week, cmd: "treaty", country: countryId, treaty: treaty, aid: aidPaid || 0 });
  addEvent(g, "treaty", 2, treaty == "sanctions" ? g.country.name + " imposes sanctions on " + f.name : (treaty == "lift" ? "Sanctions on " + f.name + " lifted" : g.country.name + " and " + f.name + " agree " + treatyName(treaty).toLowerCase()),
    { country: f.name, treaty: treatyName(treaty), aid: aidPaid ? money(g, aidPaid) : "none" }, "Agreed by both governments.", treaty == "sanctions" ? 0 : 1);
}

function defence(g) {
  var d = g.defence;
  var spendRatio = g.budget.lines.defence / d.base;
  var target = 55 * Math.pow(spendRatio, 0.8) + (g.policies.conscription.active ? g.policies.conscription.value * 1.2 : 0) + (minister(g, "defence").competence - 0.5) * 10;
  d.readiness += (clamp(target, 5, 100) - d.readiness) * 0.01;
  for (var i = 0; i < d.branches.length; i++) {
    var b = d.branches[i];
    b.equipment += (clamp(65 * spendRatio, 10, 100) - b.equipment) * 0.005;
  }
  // border incident with an unfriendly strong neighbour
  if (d.readiness < 45 && chance(g, 0.003)) {
    var rivals = g.foreign.filter(function (f) { return f.relation < 35 && f.military > 45; });
    if (rivals.length) {
      var r = pick(g, rivals);
      g.politics.mood -= 0.02;
      r.relation -= 5;
      addEvent(g, "border", 3, "Border incident with " + r.name + " raises tension", { country: r.name, readiness: Math.round(d.readiness) },
        r.name + " probed our border. Our readiness is low (" + Math.round(d.readiness) + "/100).", -1, true);
    }
  }
}

function protests(g) {
  for (var r = 0; r < g.regions.length; r++) {
    var reg = g.regions[r];
    if (reg.protestCooldown > 0) { reg.protestCooldown--; continue; }
    // find the unhappiest group in the region
    var worst = null;
    for (var i = 0; i < g.cohorts.length; i++) {
      var c = g.cohorts[i];
      if (c.region != r || c.age == 0) continue;
      if (!worst || c.approval < worst.approval) worst = c;
    }
    if (!worst || worst.approval > 0.22) continue;
    // whats the main cause?
    var cause = null, cv = 0;
    for (var k in worst.factors) if (k != "Ideology" && worst.factors[k] < cv) { cv = worst.factors[k]; cause = k; }
    if (!cause || cv > -0.04) continue;
    var size = Math.round(cohortPop(g, worst) * 1000 * (0.25 - worst.approval) * 0.4); // thousands of people
    if (size < 1) continue;
    reg.protestCooldown = 8;
    var group = "income group " + (worst.q + 1) + " (age " + AGE_NAMES[worst.age] + ")";
    g.politics.mood -= 0.004;
    addEvent(g, "protest", size > 20 ? 3 : 2, "Thousands protest in " + reg.name + " over " + cause.toLowerCase(),
      { region: reg.name, size: size + ",000", cause: cause, group: group, approval: pct(worst.approval, 0) },
      "Approval among " + group + " in " + reg.name + " fell to " + pct(worst.approval, 0) + ", mainly because of " + cause.toLowerCase() + ".", -1, size > 20, null, r);
  }
}

// ======================================================================
// ACCOUNTS + DATA RELEASES
// ======================================================================
function monthlyAccounts(g) {
  var f = g.flows;
  g.accounts.months.push({ week: g.week, revenue: f.revTotal / 13, spending: f.spendTotal / 13, balance: f.balance / 13, debt: totalDebt(g), cpi: g.econ.cpi });
  if (g.accounts.months.length > 120) g.accounts.months.shift();
}

function quarterlyAccounts(g) {
  var f = g.flows;
  g.accounts.quarters.push({ week: g.week, date: weekDate(g), C: f.C, G: f.G, I: f.I, X: f.X, M: f.M, Y: f.Y, production: f.gdpProduction,
    sectors: f.sectors.map(function (s) { return { name: s.name, gva: s.gva, jobs: s.jobs }; }) });
  if (g.accounts.quarters.length > 60) g.accounts.quarters.shift();
  var growth = realGrowth(g);
  addEvent(g, "gdp", growth < 0 ? 3 : 2, "Economy " + (growth >= 0 ? "grows " : "shrinks ") + pct(Math.abs(growth), 1) + " over the year", { growth: pct(growth, 1), gdp: money(g, f.Y) },
    "Quarterly national accounts.", growth > 0.01 ? 1 : (growth < 0 ? -1 : 0));
}

function annualAccounts(g) {
  // pensions are uprated by inflation every year (it's the law)
  // (the actual uprating happens a bit every week with average pay, see advanceWeek)
  var yearInfl = inflationRate(g);
  addEvent(g, "pensions", 1, "State pensions rise " + pct(yearInfl, 1) + " in annual uprating", { rise: pct(yearInfl, 1) }, "Pensions are linked to inflation by law.", 1);
  addEvent(g, "census", 1, "Population estimate: " + totalPop(g).toFixed(2) + " million", { pop: totalPop(g).toFixed(2) }, "Annual population estimate.", 0);
}

function dataReleases(g, month) {
  if (!month) return;
  var u = 1 - g.econ.employed / g.econ.labourForce;
  var last = histAgo(g, 4);
  var lastU = last ? last.u : u;
  if (Math.abs(u - lastU) > 0.002) addEvent(g, "jobs", Math.abs(u - lastU) > 0.005 ? 2 : 1, "Unemployment " + (u > lastU ? "rises" : "falls") + " to " + pct(u, 1),
    { now: pct(u, 1), before: pct(lastU, 1) }, "Monthly labour market statistics.", u > lastU ? -1 : 1);
  var inf = inflationRate(g);
  var lastI = last ? last.infl : inf;
  if (Math.abs(inf - lastI) > 0.002) addEvent(g, "inflation", inf > 0.05 ? 2 : 1, "Inflation " + (inf > lastI ? "rises" : "eases") + " to " + pct(inf, 1),
    { now: pct(inf, 1), before: pct(lastI, 1) }, "Monthly consumer price index.", inf > lastI ? -1 : 1);
  var hs = g.services.health;
  var lastW = last ? last.wait : hs.wait;
  if (Math.abs(hs.wait - lastW) > 0.5) addEvent(g, "waiting", Math.abs(hs.wait - lastW) > 2 ? 2 : 1, "Hospital waiting times " + (hs.wait > lastW ? "grow" : "fall") + " to " + hs.wait.toFixed(1) + " weeks",
    { now: hs.wait.toFixed(1), before: lastW.toFixed(1), staff: Math.round(hs.staff) + "k" }, "Health ministry monthly report. Capacity " + pct(hs.access, 1) + " of demand.", hs.wait > lastW ? -1 : 1);
  var a = g.politics.approval, la = last ? last.approval : a;
  if (Math.abs(a - la) > 0.015) addEvent(g, "poll", 1, "Poll: government approval " + (a > la ? "up" : "down") + " to " + pct(a, 0), { now: pct(a, 0), before: pct(la, 0) }, "Monthly opinion poll.", a > la ? 1 : -1);
}

// ======================================================================
// HISTORY + "WHY DID THIS CHANGE"
// ======================================================================
function recordHistory(g) {
  var f = g.flows, e = g.econ, hs = g.services.health;
  var A = adults(g);
  var dispAvg = f.D / A;
  var med = f.q[2].disp / (A * 0.2);
  var d1 = f.q[0].disp / (A * 0.2);
  // gini from quintile shares (lorenz curve)
  var cum = 0, area = 0;
  for (var i = 0; i < 5; i++) { var s = f.q[i].disp / f.D; area += (cum * 2 + s) * 0.2 / 2; cum += s; }
  var gini = 1 - 2 * area;
  if (g.poverty0 === undefined) { g.poverty0 = g.template == "A" ? 0.12 : (g.template == "B" ? 0.22 : 0.18); g.d1ratio0 = d1 / med; }
  var poverty = clamp(g.poverty0 - 0.8 * (d1 / med - g.d1ratio0), 0.02, 0.5);
  var h = {
    w: g.week, gdp: e.gdp, realGdp: e.realGdp, cpi: e.cpi, infl: 0, u: 1 - e.employed / e.labourForce,
    employed: e.employed, labourForce: e.labourForce,
    debt: totalDebt(g), debtRatio: totalDebt(g) / e.gdp, rev: f.revTotal, spend: f.spendTotal, bal: f.balance,
    approval: g.politics.approval, pop: totalPop(g), healthCap: hs.capacity, healthDemand: hs.demand, healthAccess: hs.access,
    healthStaff: hs.staff, wait: hs.wait, rate: e.policyRate, exch: e.exch, disp: dispAvg, gini: gini, poverty: poverty,
    readiness: g.defence.readiness, crime: g.crime, emissions: e.emissions,
    qdisp: f.q.map(function (q) { return q.disp / (A * 0.2); }),
    polls: g.parties.map(function (p) { return p.poll; }),
    why: {
      revenue: copy(f.revenue),
      spending: copy(f.spending),
      disp: { "Wages": sumq(f, "wage") / A, "Capital income": sumq(f, "cap") / A, "Benefits and pensions": sumq(f, "transfers") / A, "Income tax": -sumq(f, "incomeTax") / A, "Social insurance": -sumq(f, "payroll") / A, "Rent controls": sumq(f, "rent") / A },
      health: { "Staff (thousands)": hs.staff, "Treatments per staff member": hs.perStaff, "Equipment and buildings index": hs.equip, "Demand (millions)": hs.demand },
      approval: copy(g.politics.factors),
      infl: { "Expected inflation": e.inflExp, "Pending one-off price changes": e.priceShock, "Energy prices": sumShock(g, "energy") * 0.05, "Policy interest rate": e.policyRate },
      u: { "Labour force (m)": e.labourForce, "Employed (m)": e.employed, "Output per worker (k)": e.prod, "GDP (real, bn)": e.realGdp },
      gdp: { "Household consumption": f.C, "Government consumption": f.G, "Investment": f.I, "Exports": f.X, "Imports": -f.M }
    }
  };
  g.history.push(h);
  h.infl = inflationRate(g);
  h.growth = realGrowth(g);
}

function sumq(f, k) { var s = 0; for (var i = 0; i < 5; i++) s += f.q[i][k]; return s; }
function sumShock(g, t) { var s = 0; for (var i = 0; i < g.shocks.length; i++) if (g.shocks[i].type == t) s += g.shocks[i].mag; return s; }

// history n weeks ago (or null)
function histAgo(g, n) {
  var idx = g.history.length - 1 - n;
  if (idx < 0) return null;
  return g.history[idx];
}

// annual inflation from CPI 52 weeks ago (before the game started, use the baseline rate)
function inflationRate(g) {
  var h = histAgo(g, 52);
  if (h) return g.econ.cpi / h.cpi - 1;
  var n = g.history.length - 1; // weeks we have
  var first = g.history[0] ? g.history[0].cpi : 100;
  var cpiThen = first / Math.pow(1 + g.econ.infl0, (52 - n) / 52);
  return g.econ.cpi / cpiThen - 1;
}

function realGrowth(g) {
  var h = histAgo(g, 52);
  if (h) return g.econ.realGdp / h.realGdp - 1;
  var n = g.history.length - 1;
  var first = g.history[0] ? g.history[0].realGdp : g.econ.realGdp;
  var then = first / Math.pow(1 + g.econ.growth0, (52 - n) / 52);
  return g.econ.realGdp / then - 1;
}

// builds the "Why did this change?" report for a metric over the last n weeks
function whyReport(g, key, n) {
  var now = g.history[g.history.length - 1];
  var then = histAgo(g, n) || g.history[0];
  var rep = { key: key, from: then.w, to: now.w, rows: [], actions: [], events: [] };
  var a = then.why[key] || {}, b = now.why[key] || {};
  var keys = {};
  for (var k in a) keys[k] = 1;
  for (var k in b) keys[k] = 1;
  for (var k in keys) rep.rows.push({ name: k, before: a[k] || 0, after: b[k] || 0, change: (b[k] || 0) - (a[k] || 0) });
  rep.rows.sort(function (x, y) { return Math.abs(y.change) - Math.abs(x.change); });
  for (var i = 0; i < g.laws.length; i++) if (g.laws[i].week >= then.w) rep.actions.push(g.laws[i]);
  for (var i = 0; i < g.commandLog.length; i++) if (g.commandLog[i].week >= then.w && g.commandLog[i].cmd != "submitBill") rep.actions.push({ week: g.commandLog[i].week, title: commandText(g.commandLog[i]) });
  for (var i = 0; i < g.events.length; i++) {
    var ev = g.events[i];
    if (ev.week > then.w && ev.severity >= 2 && ["energyShock", "disaster", "healthEmergency", "creditShock", "world", "scandal", "strike", "protest", "rate", "coalition", "border"].indexOf(ev.type) >= 0) rep.events.push(ev);
  }
  return rep;
}

function commandText(c) {
  if (c.cmd == "appoint") return "Appointed " + c.name + " to " + ministryName(c.ministry);
  if (c.cmd == "treaty") return "Treaty: " + treatyName(c.treaty) + " with " + c.country;
  if (c.cmd == "amendBill") return "Amended bill " + c.bill;
  if (c.cmd == "withdrawBill") return "Withdrew bill " + c.bill;
  return c.cmd;
}

// ======================================================================
// EVENTS + NEWS
// ======================================================================
// valence: +1 good news for the government, -1 bad, 0 neutral
function addEvent(g, type, severity, title, facts, cause, valence, urgent, billId, region) {
  g.eventCounter++;
  var ev = { id: "EV-" + String(g.eventCounter).padStart(5, "0"), week: g.week, date: weekDate(g), type: type, severity: severity, title: title,
    facts: facts || {}, cause: cause || "", valence: valence || 0, urgent: !!urgent, bill: billId || null, region: region === undefined ? null : region };
  g.events.push(ev);
  if (urgent) g.urgent.push(ev.id);
  return ev;
}

function makeNews(g) {
  var evs = g.events.filter(function (e) { return e.week == g.week; });
  var govEcon = avgGovEcon(g);
  for (var i = 0; i < evs.length; i++) {
    var ev = evs[i];
    for (var j = 0; j < OUTLETS.length; j++) {
      var o = OUTLETS[j];
      // which outlets cover it? bigger events get more coverage, the tabloid loves scandal
      var p = 0.15 + 0.25 * ev.severity;
      if (o.id == "ledger" && ["gdp", "rate", "inflation", "creditShock", "treaty", "world"].indexOf(ev.type) >= 0) p += 0.4;
      if (o.id == "flash" && ["scandal", "protest", "strike", "disaster", "border"].indexOf(ev.type) >= 0) p += 0.5;
      if (o.id == "regional" && ev.region !== null) p += 0.5;
      if (o.id == "nbs") p += 0.15;
      if (randNews(g) >= p) continue;
      // tone: does the outlet like the government?
      var friendly = 1 - Math.abs(o.lean - govEcon) / 40; // 1 = friendly, negative = hostile
      var tone = ev.valence + friendly * 0.6 + (randNews(g) - 0.5) * o.sensational;
      g.news.push(writeArticle(g, ev, o, tone));
    }
  }
}

function writeArticle(g, ev, o, tone) {
  var head = ev.title;
  var spin = "";
  var gov = "the " + g.leaderName + " government";
  if (tone > 0.6) spin = pickNews(g, ["This is a welcome result for " + gov + ".", "Ministers will be pleased.", "Supporters say the government's plan is working."]);
  else if (tone < -0.4) spin = pickNews(g, ["Critics say this shows " + gov + " has lost its way.", "Opposition leaders called it 'a damning verdict'.", "Questions are growing about " + gov + "'s competence."]);
  else spin = pickNews(g, ["Analysts are divided on what it means.", "The government says it is monitoring the situation.", "Reaction has been mixed."]);
  if (o.sensational > 0.7) {
    head = head.toUpperCase();
    if (tone < -0.2) head += "!";
    if (ev.type == "scandal") head = "SHAME OF " + (ev.facts.minister || "MINISTER").toUpperCase() + ": " + head;
  }
  var factText = [];
  for (var k in ev.facts) factText.push(niceKey(k) + ": " + ev.facts[k]);
  var body = ev.title + ". " + ev.cause + (factText.length ? " Figures released: " + factText.join("; ") + "." : "") + " " + spin;
  if (o.id == "ledger") body += " Markets " + (ev.valence < 0 ? "reacted cautiously." : "took the news calmly.");
  if (o.id == "regional" && ev.region !== null) body += " The impact is being felt most in " + g.regions[ev.region].name + ".";
  return { id: "AR-" + ev.id.slice(3) + "-" + o.id, week: ev.week, date: ev.date, outlet: o.id, headline: head, body: body, event: ev.id, tone: tone > 0.6 ? "positive" : (tone < -0.4 ? "critical" : "neutral"), reliability: o.reliability, type: ev.type, region: ev.region };
}

function niceKey(k) { return k.replace(/([A-Z])/g, " $1").replace(/^./, function (s) { return s.toUpperCase(); }); }

// ======================================================================
// VALIDATION (section 12.2 accounting tests)
// ======================================================================
function validate(g, opening, borrowing) {
  var p = [];
  var f = g.flows;
  if (Math.abs(f.gdpProduction - f.Y) / f.Y > 0.005) p.push("GDP by production (" + f.gdpProduction.toFixed(2) + ") does not match GDP by expenditure (" + f.Y.toFixed(2) + ")");
  if (Math.abs((f.revTotal - f.spendTotal) - f.balance) > 1e-6) p.push("Budget balance does not equal revenue minus spending");
  var closing = totalDebt(g);
  if (Math.abs(opening.debt + borrowing - closing) > 1e-6) p.push("Debt identity broken: " + opening.debt + " + " + borrowing + " != " + closing);
  var popChange = g.pop.births - g.pop.deaths + g.pop.immig - g.pop.emig;
  if (Math.abs(opening.pop + popChange - totalPop(g)) > 1e-9) p.push("Population identity broken");
  var u = g.econ.labourForce - g.econ.employed;
  if (Math.abs(g.econ.employed + u - g.econ.labourForce) > 1e-9 || u < 0) p.push("Employment + unemployment != labour force");
  var check = [g.econ.gdp, g.econ.price, g.politics.approval, closing, g.econ.employed, g.services.health.capacity];
  for (var i = 0; i < check.length; i++) if (!isFinite(check[i]) || isNaN(check[i])) p.push("Invalid number in state (" + i + ")");
  if (g.econ.gdp <= 0) p.push("GDP went negative");
  return p;
}

// ======================================================================
// formatting (used by sim text and ui)
// ======================================================================
function pct(x, d) { if (d === undefined) d = 1; return (x * 100).toFixed(d) + "%"; }
function money(g, x) {
  var s = g && g.country ? g.country.symbol : "";
  var neg = x < 0; x = Math.abs(x);
  var txt = x >= 1 ? x.toFixed(1) + "bn" : (x * 1000).toFixed(0) + "m";
  return (neg ? "-" : "") + s + " " + txt;
}

// so node can load this file for the tests
if (typeof module !== "undefined") module.exports = {};
