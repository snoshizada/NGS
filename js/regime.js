// regime.js - constitutions, stability (coups, revolutions), wars, ministries, national identity
// added in version 0.2. still no html in here (tests run it in node)

// ======================================================================
// CONSTITUTION
// ======================================================================

// fills in the numbers that come from the other choices (majority etc) and the description
function normalizeConstitution(c, nRegions) {
  // values from <select>s come in as strings, fix them
  var nums = ["chambers", "seats", "termYears", "termLimit", "amendThreshold", "fiscalRule", "votingAge"];
  for (var i = 0; i < nums.length; i++) c[nums[i]] = parseFloat(c[nums[i]]);
  var bools = ["confidenceRule", "referendum", "centralBankIndependent"];
  for (var i = 0; i < bools.length; i++) c[bools[i]] = c[bools[i]] === true || c[bools[i]] === "true";
  c.seats = Math.round(clamp(c.seats || 100, 30, 650));
  c.termYears = Math.round(clamp(c.termYears || 4, 2, 7));
  c.termLimit = Math.round(clamp(c.termLimit || 0, 0, 5));
  c.votingAge = Math.round(clamp(c.votingAge || 18, 16, 21));
  c.fiscalRule = clamp(c.fiscalRule || 0, 0, 6);
  c.majority = Math.floor(c.seats / 2) + 1;
  c.supermajority = Math.ceil(c.seats * c.amendThreshold);
  c.upperSeats = c.chambers == 2 ? (nRegions || 4) * 10 : 0;
  if (c.legislature == "none") c.chambers = 1;
  // a prime minister needs a legislature to choose them
  if (c.executive == "pm" && c.legislature == "none") c.executive = "partyleader";
  if (c.executive != "pm") c.confidenceRule = false;
  if (c.headOfState == "monarch_abs" && c.executive != "monarch") c.headOfState = "monarch_const";
  c.title = c.leaderTitle && String(c.leaderTitle).trim() ? String(c.leaderTitle).trim() : defaultTitle(c);
  c.govType = describeGov(c);
  c.amendmentText = amendmentText(c);
  // the old field names are still used in a few places
  c.leaderTitleShown = c.title;
  return c;
}

function defaultTitle(c) {
  if (c.executive == "pm") return "Prime Minister";
  if (c.executive == "president") return c.elections == "none" ? "President for Life" : "President";
  if (c.executive == "monarch") return "Monarch";
  if (c.executive == "partyleader") return "General Secretary";
  return "Chairman of the Military Council";
}

function describeGov(c) {
  var t = "";
  if (c.executive == "junta") t = "Military junta";
  else if (c.executive == "partyleader" && c.partySystem == "single") t = "One-party state";
  else if (c.executive == "monarch") t = c.legislature == "elected" && c.legPower == "full" ? "Constitutional monarchy with a ruling monarch" : "Absolute monarchy";
  else if (c.executive == "partyleader") t = "Party-led republic";
  else if (c.executive == "president") t = c.headOfState == "monarch_const" ? "Presidential monarchy" : "Presidential republic";
  else if (c.executive == "pm") t = c.headOfState == "monarch_const" ? "Parliamentary constitutional monarchy" : (c.headOfState == "president_elected" ? "Semi-presidential republic" : "Parliamentary republic");
  if (c.elections == "restricted") t = "Electoral autocracy (" + t.toLowerCase() + ")";
  if (c.elections == "none" && (c.executive == "pm" || c.executive == "president")) t = "Authoritarian " + t.toLowerCase();
  if (c.territory == "federal") t += ", federal";
  if (c.economy == "planned") t += ", planned economy";
  return t;
}

function amendmentText(c) {
  var route = amendRouteFor(c);
  if (route == "decree") return "By decree of the " + c.title;
  var s = Math.round(c.amendThreshold * 100) + "% of the legislature (" + Math.ceil(c.seats * c.amendThreshold) + " of " + c.seats + ")";
  if (c.chambers == 2 && c.upperHouse != "appointed") s += " and of the upper chamber";
  if (c.referendum) s += ", then a national referendum";
  if (c.territory == "federal") s += ", then a majority of regional governments";
  return s;
}

// does the government make laws on its own?
function decreeMode(g) {
  var c = g.constitution;
  return c.legislature == "none" || c.legislature == "appointed" || c.legPower == "rubber" || c.partySystem == "single";
}
function amendRouteFor(c) {
  if (c.legislature == "none" || c.legislature == "appointed" || c.legPower == "rubber" || c.partySystem == "single") return "decree";
  if (c.executive == "junta" || (c.executive == "monarch" && c.headOfState == "monarch_abs")) return "decree";
  if (c.emergency == "broad" && c.judiciary != "independent") return "decree";
  return "legislature";
}

function electionsHeld(g) {
  var c = g.constitution;
  if (c.elections == "none") return false;
  return c.legislature == "elected" || c.executive == "president";
}

// 0-100, like the real-world democracy rankings (made up weights)
function democracyIndex(g) {
  var c = g.constitution, d = 0;
  d += { free: 25, restricted: 8, none: 0 }[c.elections];
  d += c.partySystem == "multi" ? 12 : 0;
  d += c.legislature == "elected" ? { full: 15, advisory: 6, rubber: 1 }[c.legPower] : 0;
  d += { independent: 14, partial: 7, controlled: 0 }[c.judiciary];
  d += { free: 14, restricted: 6, state: 0 }[c.press];
  d += { free: 10, restricted: 5, banned: 0 }[c.assembly];
  d += c.executive == "pm" || c.executive == "president" ? 6 : 0;
  d += c.termLimit > 0 || c.executive == "pm" ? 2 : 0;
  d += { none: 2, limited: 2, broad: 0 }[c.emergency];
  if (g.policies && g.policies.surveillance && g.policies.surveillance.active) d -= g.policies.surveillance.value * 0.1;
  return clamp(d, 0, 100);
}

// how much a group of people likes the constitution (compared with the start of the game)
function constFit(g, c) {
  var k = g.constitution, x = 0;
  var social = idealSocial(g, c);
  var di = democracyIndex(g);
  x += 0.0012 * di * (social / 55);
  if (k.religion == "state") x += social < 45 ? 0.04 : -0.03;
  if (k.religion == "secular") x += social < 45 ? -0.02 : 0.01;
  if (k.economy == "planned") x += (c.q <= 1 ? 0.03 : (c.q >= 3 ? -0.07 : -0.01)) - 0.02;
  if (k.economy == "market") x += c.q <= 1 ? -0.02 : (c.q >= 3 ? 0.03 : 0);
  var periphery = g.regions[c.region].income < 1;
  if (k.territory == "federal") x += periphery ? 0.015 : -0.005;
  if (k.territory == "unitary") x += periphery ? -0.01 : 0.005;
  if (k.assembly == "banned") x -= 0.03;
  if (k.votingAge <= 16 && c.age == 1) x += 0.005;
  if (k.headOfState == "monarch_const" || k.headOfState == "monarch_abs") x += social < 45 ? 0.015 : -0.01;
  return x;
}

// called after an amendment is applied. old = the constitution before
function constitutionTransition(g, old) {
  var c = normalizeConstitution(g.constitution, g.regions.length);
  var diOld = g.politics.di === undefined ? democracyIndex(g) : g.politics.di;
  var diNew = democracyIndex(g);
  var d = diNew - diOld;
  g.politics.di = diNew;
  g.politics.legitimacy = clamp(g.politics.legitimacy + d * 0.3, 0, 100);
  g.politics.unrest = clamp(g.politics.unrest + Math.max(0, -d) * 0.3, 0, 100);
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    f.relation = clamp(f.relation + (f.democratic ? d * 0.25 : -d * 0.1), 0, 100);
  }
  // seats changed: share them out again keeping the same proportions
  if (c.seats != old.seats) {
    rescaleSeats(g, c.seats);
    regionSeats(g);
  }
  if (c.chambers == 2 && old.chambers != 2) computeUpper(g);
  if (c.chambers != 2) g.upper = null;
  // banning / allowing parties
  if (c.partySystem == "single" && old.partySystem != "single") {
    for (var i = 0; i < g.parties.length; i++) {
      var p = g.parties[i];
      if (!p.player) { p.banned = true; p.seats = 0; p.inGov = false; }
      else { p.seats = c.seats; p.inGov = true; }
    }
    if (g.upper) computeUpper(g);
    g.politics.unrest = clamp(g.politics.unrest + 15, 0, 100);
    addEvent(g, "regime", 3, "Opposition parties banned - " + playerParty(g).name + " is now the only legal party", { parties: g.parties.length - 1 }, "Constitutional change.", -1, true);
  }
  if (c.partySystem == "multi" && old.partySystem == "single") {
    for (var i = 0; i < g.parties.length; i++) g.parties[i].banned = false;
    if (electionsHeld(g)) {
      g.politics.snapElection = g.week + 8;
      addEvent(g, "regime", 3, "Parties legalised - free elections called for " + weekDate(g, g.week + 8), { date: weekDate(g, g.week + 8) }, "Constitutional change.", 0, true);
    }
  }
  if (c.legislature == "appointed" && old.legislature != "appointed") {
    // the government picks the members: our party gets 70%
    rescaleSeats(g, c.seats);
    var mine = playerParty(g), rest = c.seats - Math.round(c.seats * 0.7), others = g.parties.filter(function (p) { return !p.player && !p.banned; });
    var tot = sum(others.map(function (p) { return p.seats; })) || 1;
    var given = 0;
    for (var i = 0; i < others.length; i++) { others[i].seats = Math.floor(rest * others[i].seats / tot); given += others[i].seats; }
    mine.seats = c.seats - given;
  }
  // elections switched off / on
  if (!electionsHeld(g)) { g.politics.nextElection = 0; g.politics.snapElection = 0; }
  else if (!g.politics.nextElection) {
    g.politics.nextElection = g.week + 26;
    g.politics.termStart = g.week;
    addEvent(g, "regime", 2, "Elections restored - polling day " + weekDate(g, g.week + 26), {}, "Constitutional change.", 1);
  }
  if (electionsHeld(g) && c.termYears != old.termYears && !g.politics.snapElection) {
    g.politics.nextElection = Math.max(g.week + 4, g.politics.termStart + 52 * c.termYears);
  }
  if (c.economy != old.economy) {
    g.econ.confidence -= 0.08;
    g.politics.mood -= 0.02;
    addEvent(g, "regime", 3, "Economy moves to a " + c.economy + " system", { from: old.economy, to: c.economy }, "Constitutional change. Businesses are uncertain.", -1, true);
  }
  if (c.executive != old.executive) {
    if (c.executive == "junta") g.defence.loyalty = clamp(g.defence.loyalty + 20, 0, 100);
    g.politics.termsServed = 1;
  }
  if (c.chambers == 2 && !g.upper) computeUpper(g);
  // supporters of the government in the legislature
  if (c.executive != "pm" && c.partySystem == "multi") {
    var me = playerParty(g);
    for (var i = 0; i < g.parties.length; i++) g.parties[i].inGov = g.parties[i].player || (!g.parties[i].banned && Math.abs(g.parties[i].econ - me.econ) < 10 && g.parties[i].inGov);
  }
}

// keep proportions when the number of seats changes (largest remainder)
function rescaleSeats(g, total) {
  var live = g.parties.filter(function (p) { return !p.banned; });
  var old = sum(live.map(function (p) { return p.seats; })) || live.length;
  var given = 0, rem = [];
  for (var i = 0; i < live.length; i++) {
    var exact = (old ? live[i].seats / old : 1 / live.length) * total;
    live[i].seats = Math.floor(exact); given += live[i].seats;
    rem.push([exact - live[i].seats, i]);
  }
  rem.sort(function (a, b) { return b[0] - a[0]; });
  for (var k = 0; given < total; k++, given++) live[rem[k % rem.length][1]].seats++;
}

// seats per region by population
function regionSeats(g) {
  var total = g.constitution.seats, P = totalPop(g), given = 0, rem = [];
  for (var i = 0; i < g.regions.length; i++) {
    var exact = g.regions[i].pop / P * total;
    g.regions[i].seats = Math.floor(exact); given += g.regions[i].seats;
    rem.push([exact - g.regions[i].seats, i]);
  }
  rem.sort(function (a, b) { return b[0] - a[0]; });
  for (var k = 0; given < total; k++, given++) g.regions[rem[k % rem.length][1]].seats++;
}

// upper chamber
function computeUpper(g) {
  var c = g.constitution;
  if (c.chambers != 2) { g.upper = null; return; }
  var n = g.parties.length;
  var seats = g.parties.map(function () { return 0; });
  if (c.upperHouse == "appointed" || c.partySystem == "single") {
    seats[g.parties.indexOf(playerParty(g))] = c.upperSeats;
  } else if (c.upperHouse == "regional") {
    var per = Math.round(c.upperSeats / g.regions.length);
    for (var r = 0; r < g.regions.length; r++) {
      var sh = nationalShares(g, r);
      var rs = dhondt(sh, per, 0);
      for (var i = 0; i < n; i++) seats[i] += rs[i];
    }
  } else {
    seats = dhondt(nationalShares(g), c.upperSeats, 0.03);
  }
  g.upper = { seats: seats, total: sum(seats) };
}

// ======================================================================
// STABILITY: legitimacy, unrest, military loyalty, corruption
// ======================================================================
function regimeWeekly(g) {
  var c = g.constitution, P = g.politics;
  var di = democracyIndex(g);
  P.di = di;
  var a = P.approval;
  // corruption
  var ac = g.policies.anticorruption && g.policies.anticorruption.active ? g.policies.anticorruption.value / (g.econ.gdp * 0.001) * 3 : 0;
  var corrTarget = 15 + (100 - di) * 0.35 + { independent: 0, partial: 4, controlled: 10 }[c.judiciary] + (c.press == "free" ? 0 : 5) - ac + (g.template == "B" ? 10 : (g.template == "C" ? 8 : 0));
  P.corruption += (clamp(corrTarget, 2, 95) - P.corruption) * 0.01;
  g.compliance = clamp(g.compliance0 - (P.corruption - P.corruption0) * 0.002, 0.5, 0.99);
  // legitimacy
  var warBoost = g.war ? (g.war.front > 0 ? 5 : -5) : 0;
  var legTarget = 30 + di * 0.3 + (a - 0.4) * 60 + (c.headOfState == "monarch_const" ? 5 : 0) + warBoost - (P.corruption - 30) * 0.15;
  P.legitimacy += (clamp(legTarget, 0, 100) - P.legitimacy) * 0.02;
  // military loyalty
  var d = g.defence;
  var realDef = g.budget.lines.defence / (g.econ.wage / g.econ.wage0);
  var minComp = minister(g, "defence").competence;
  var loyTarget = 55 + 40 * (realDef / d.base - 1) + (c.executive == "junta" ? 25 : 0) + (c.executive == "monarch" ? 5 : 0) + (minComp - 0.5) * 20 - (g.war && g.war.front < -30 ? 15 : 0) + (P.legitimacy - 50) * 0.2;
  d.loyalty += (clamp(loyTarget, 0, 100) - d.loyalty) * 0.02;
  // unrest: builds up when people are unhappy and have no normal way to complain
  var vent = { free: 0.7, restricted: 1.0, banned: 1.3 }[c.assembly] * (c.elections == "free" ? 0.8 : 1.15);
  var unrestTarget = clamp((0.42 - a) * 220, 0, 100) * vent - (P.legitimacy - 50) * 0.3 + (c.press == "state" ? 5 : 0);
  P.unrest += (clamp(unrestTarget, 0, 100) - P.unrest) * 0.03;

  if (g.calm) return;
  // riots (where protests are not allowed the anger comes out like this)
  if (P.unrest > 50 && c.assembly != "free" && (P.riotCooldown || 0) <= 0 && chance(g, 0.03)) {
    var r = Math.floor(rand(g) * g.regions.length);
    P.riotCooldown = 10;
    g.politics.mood -= 0.01;
    g.econ.confidence -= 0.02;
    addEvent(g, "riot", 3, "Riots break out in " + g.regions[r].name, { region: g.regions[r].name, unrest: Math.round(P.unrest) },
      "Unrest is at " + Math.round(P.unrest) + "/100 and peaceful protest is " + c.assembly + ".", -1, true, null, r);
  }
  if (P.riotCooldown > 0) P.riotCooldown--;
  // coup: a disloyal army in a weak regime
  if (d.loyalty < 40) {
    var p = (40 - d.loyalty) / 40 * 0.008 * (di < 50 ? 1 : 0.2) * (P.legitimacy < 30 ? 2 : 1);
    if (chance(g, p)) {
      addEvent(g, "coup", 3, "MILITARY COUP: the armed forces seize power", { loyalty: Math.round(d.loyalty), legitimacy: Math.round(P.legitimacy) },
        "Military loyalty fell to " + Math.round(d.loyalty) + "/100. Officers were unpaid and the government had lost legitimacy.", -1, true);
      endRule(g, "The army overthrew you in a coup. Military loyalty had fallen to " + Math.round(d.loyalty) + "/100.");
    }
  }
  // revolution
  if (P.unrest > 70 && P.approval < 0.3) {
    var pr = 0.006 * (P.unrest - 70) / 30 * (c.assembly == "free" ? 0.3 : 1) * (d.loyalty > 70 ? 0.4 : 1);
    if (chance(g, pr)) {
      addEvent(g, "revolution", 3, "REVOLUTION: crowds storm the capital", { unrest: Math.round(P.unrest), approval: pct(P.approval, 0) },
        "Unrest reached " + Math.round(P.unrest) + "/100 with approval at " + pct(P.approval, 0) + ".", -1, true);
      endRule(g, "A popular revolution forced you from power. Unrest had reached " + Math.round(P.unrest) + "/100.");
    }
  }
}

function endRule(g, reason) {
  if (g.difficulty == "sandbox") {
    // in sandbox you survive but it hurts
    g.politics.legitimacy = 40; g.politics.unrest = 30; g.defence.loyalty = 60; g.politics.mood -= 0.05;
    return;
  }
  if (!g.gameOver) g.gameOver = { week: g.week, reason: reason };
}

// ======================================================================
// WAR (abstract - no tactics, just strength, supply, readiness and luck)
// ======================================================================
function ourStrength(g) {
  var d = g.defence;
  var realDef = g.budget.lines.defence / (g.econ.wage / g.econ.wage0);
  var eq = 0; for (var i = 0; i < d.branches.length; i++) eq += d.branches[i].equipment; eq /= d.branches.length;
  var conscript = g.policies.conscription.active ? 1 + g.policies.conscription.value * 0.02 : 1;
  var comp = minister(g, "defence").competence;
  return 40 * Math.sqrt(Math.max(0.01, realDef) / 5) * (d.readiness / 55) * (eq / 65) * conscript * (0.8 + 0.4 * comp);
}

function allyStrength(g, enemyId) {
  var s = 0;
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    if (f.id != enemyId && f.treaties.indexOf("defence") >= 0) s += f.military * 0.3;
  }
  return s;
}

function startWar(g, enemyId, weAttacked) {
  var f = countryOf(g, enemyId);
  // the region nearest the enemy (just the smallest-income one, it's a game)
  var border = 0;
  for (var i = 1; i < g.regions.length; i++) if (g.regions[i].income < g.regions[border].income) border = i;
  var tradeHit = f.trade * 0.8 + 0.02;
  g.war = { enemy: enemyId, attacker: weAttacked ? "us" : "them", start: g.week, front: 0, weeks: 0, ourCas: 0, theirCas: 0, civCas: 0, displaced: 0, region: border, tradeHit: tradeHit, cost: 0, log: [] };
  g.econ.tradeFactor -= tradeHit;
  g.econ.confidence -= 0.05;
  f.relation = 0;
  f.atWar = true;
  addEvent(g, "war", 3, weAttacked ? g.country.name + " declares war on " + f.name : f.name + " attacks " + g.country.name + "!",
    { enemy: f.name, theirMilitary: f.military, ourMilitary: Math.round(ourStrength(g)) },
    weAttacked ? "The government declared war." : f.name + " saw our weak defences (readiness " + Math.round(g.defence.readiness) + ") and attacked across the border.", weAttacked ? 0 : -1, true, null, border);
}

function warWeekly(g) {
  var w = g.war;
  if (!w) return;
  var f = countryOf(g, w.enemy);
  w.weeks++;
  var us = (ourStrength(g) + allyStrength(g, w.enemy)) * (0.85 + rand(g) * 0.3);
  if (w.front < 0) us *= 1.2;              // defending home ground
  if (w.weeks > 26) us *= 0.92;            // supply lines get stretched
  us *= 0.95 + minister(g, "digital").competence * 0.1; // intelligence and cyber
  var them = f.military * (0.85 + rand(g) * 0.3) * (w.front > 0 ? 1.2 : 1);
  var delta = (us - them) / (us + them) * 12;
  w.front = clamp(w.front + delta, -100, 100);
  var intensity = 1 + Math.abs(delta) / 6;
  var ourLoss = them / (us + them) * 0.25 * intensity; // thousands of soldiers
  w.ourCas += ourLoss;
  w.theirCas += us / (us + them) * 0.25 * intensity;
  for (var i = 0; i < g.defence.branches.length; i++) {
    var b = g.defence.branches[i];
    b.personnel = Math.max(0.5, b.personnel - ourLoss / 1000 * (i == 0 ? 0.7 : 0.1));
    b.equipment = Math.max(5, b.equipment - 0.3 * intensity * them / (us + them));
  }
  // civilians suffer when the fighting is on our side of the border
  var civDead = 0, fled = 0;
  var reg = g.regions[w.region];
  if (w.front < 0) {
    civDead = 0.02 * Math.abs(w.front) / 50 / 1000; // millions
    fled = reg.pop * 0.001 * Math.abs(w.front) / 100;
    g.econ.publicCapital -= 0.0005 * intensity;
  }
  var soldiersDead = ourLoss / 1000;
  reg.pop -= civDead + fled;
  // spread soldier deaths over all regions
  var P = totalPop(g);
  for (var i = 0; i < g.regions.length; i++) g.regions[i].pop -= soldiersDead * g.regions[i].pop / P;
  g.pop.deaths += civDead + soldiersDead;
  g.pop.emig += fled;
  w.civCas += civDead * 1000;
  w.displaced += fled * 1000;
  w.annualCost = g.econ.gdp * (0.025 + 0.01 * intensity);
  w.cost += w.annualCost / 52;
  g.econ.confidence -= 0.002;
  if (w.weeks % 4 == 0) addEvent(g, "warReport", 2, "War with " + f.name + ": front " + (w.front >= 0 ? "advances" : "falls back") + " (" + Math.round(w.front) + ")",
    { front: Math.round(w.front), ourCasualties: Math.round(w.ourCas * 1000), civilianDeaths: Math.round(w.civCas * 1000), displaced: Math.round(w.displaced * 1000), cost: money(g, w.cost) },
    "Weekly war reports. Our strength " + Math.round(us) + " vs theirs " + Math.round(them) + ".", w.front > 0 ? 1 : -1, false, null, w.region);
  if (w.front >= 100) endWar(g, "victory");
  else if (w.front <= -100) endWar(g, "defeat");
  else if (w.weeks % 6 == 0 && w.front < -40 && !w.enemyOffer) w.enemyOffer = { terms: "reparations_pay", amount: Math.round(g.econ.gdp * 0.02 * 10) / 10 };
  else if (w.weeks % 6 == 0 && w.front > 40 && !w.enemyOffer) w.enemyOffer = { terms: "white" };
}

// how the war changes how people feel
function warMood(g) {
  var w = g.war;
  if (!w) return g.politics.warAfter || 0;
  var rally = (w.attacker == "them" ? 0.05 : 0.02) * Math.max(0, 1 - w.weeks / 12);
  var weariness = 0.0015 * w.ourCas + 0.0006 * w.weeks;
  return rally - weariness + w.front / 100 * 0.04;
}

// player asks for peace. terms: white, reparations_receive, reparations_pay, territory
function peaceAcceptable(g, terms) {
  var w = g.war, f = countryOf(g, w.enemy);
  var amount = 0, ok = false, why = "";
  if (terms == "white") { ok = (w.front > -20 && w.weeks >= 6) || w.front > 30; why = ok ? "Both sides are tired of fighting." : "They think they can still win (front " + Math.round(w.front) + ")."; }
  if (terms == "reparations_receive") { amount = Math.round(f.gdp * 0.01 * 10) / 10; ok = w.front > 50; why = ok ? "They are losing badly and will pay." : "They won't pay unless they are losing badly (front above 50)."; }
  if (terms == "reparations_pay") { amount = Math.round(g.econ.gdp * 0.02 * 10) / 10; ok = w.front > -70; why = ok ? "They accept payment to stop." : "They want total victory."; }
  if (terms == "territory") { ok = w.front > 80; why = ok ? "They give up a border province." : "They will only give up land if completely beaten (front above 80)."; }
  return { ok: ok, amount: amount, why: why };
}

function makePeace(g, terms) {
  var w = g.war, f = countryOf(g, w.enemy);
  var res = peaceAcceptable(g, terms);
  if (terms == "enemyOffer" && w.enemyOffer) { terms = w.enemyOffer.terms; res = { ok: true, amount: w.enemyOffer.amount || 0 }; }
  if (!res.ok) { g.commandLog.push({ week: g.week, cmd: "peace", terms: terms, result: "rejected" }); return res; }
  if (terms == "reparations_receive") g.debtAdjust = (g.debtAdjust || 0) - res.amount;
  if (terms == "reparations_pay") g.debtAdjust = (g.debtAdjust || 0) + res.amount;
  if (terms == "territory") annexRegion(g, f);
  g.commandLog.push({ week: g.week, cmd: "peace", terms: terms, result: "accepted" });
  finishWar(g, "peace", terms, res.amount);
  return res;
}

function endWar(g, how) {
  var f = countryOf(g, g.war.enemy);
  if (how == "victory") {
    annexRegion(g, f);
    finishWar(g, "victory", "territory", 0);
  } else {
    // defeat: we lose part of the border region and pay
    var reg = g.regions[g.war.region];
    var lost = reg.pop * 0.15;
    reg.pop -= lost; reg.income *= 0.9;
    g.pop.emig += lost;
    var pay = Math.round(g.econ.gdp * 0.04 * 10) / 10;
    g.debtAdjust = (g.debtAdjust || 0) + pay;
    g.defence.loyalty -= 15;
    g.politics.mood -= 0.06;
    finishWar(g, "defeat", "reparations_pay", pay);
  }
}

function finishWar(g, how, terms, amount) {
  var w = g.war, f = countryOf(g, w.enemy);
  g.econ.tradeFactor += w.tradeHit;
  f.atWar = false;
  f.relation = how == "peace" ? 20 : 10;
  f.military = Math.max(5, Math.round(f.military * (1 - w.theirCas / 200)));
  g.wars = g.wars || [];
  var rec = { enemy: f.name, start: w.start, end: g.week, outcome: how, terms: terms, amount: amount, ourCas: w.ourCas, theirCas: w.theirCas, civCas: w.civCas, displaced: w.displaced, cost: w.cost };
  g.wars.push(rec);
  g.politics.warAfter = how == "victory" ? 0.04 : (how == "defeat" ? -0.06 : 0);
  var termText = { white: "no land or money changes hands", reparations_receive: f.name + " pays us " + amount + "bn", reparations_pay: "we pay " + f.name + " " + amount + "bn", territory: "we gain a border province" }[terms];
  addEvent(g, "peace", 3, how == "victory" ? "Victory! War with " + f.name + " ends" : (how == "defeat" ? "Defeat: " + g.country.name + " forced to accept " + f.name + "'s terms" : "Peace treaty signed with " + f.name),
    { terms: termText, ourCasualties: Math.round(w.ourCas * 1000), civilianDeaths: Math.round(w.civCas * 1000), cost: money(g, w.cost), weeks: w.weeks },
    "The war lasted " + w.weeks + " weeks.", how == "defeat" ? -1 : 1, true);
  g.war = null;
}

// new region from a peace deal
function annexRegion(g, f) {
  var pop = Math.max(0.05, f.pop * 0.03);
  var r = { name: f.name + " Borderlands", pop: pop, income: 0.7, unemp: 1.3, seats: 0, protestCooldown: 0, annexed: true };
  g.regions.push(r);
  g.pop.immig += pop; // counted as people joining the country (keeps the population sums right)
  f.pop = Math.max(1, f.pop - pop);
  var ri = g.regions.length - 1;
  for (var a = 0; a < 3; a++) for (var q = 0; q < 5; q++) {
    var c = { region: ri, age: a, q: q, approval: 0.25, factors: {} };
    c.fit0 = constFit(g, c);
    g.cohorts.push(c);
  }
  regionSeats(g);
}

function countryOf(g, id) { for (var i = 0; i < g.foreign.length; i++) if (g.foreign[i].id == id) return g.foreign[i]; }

// a foreign state might attack if it hates us and we look weak
function maybeAttacked(g) {
  if (g.war || g.calm) return;
  var mine = ourStrength(g) + 1;
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    if (f.relation < 12 && f.military > mine * 1.3 && f.treaties.indexOf("nonaggression") < 0 && chance(g, 0.01)) { startWar(g, f.id, false); return; }
  }
}

// ======================================================================
// MINISTRIES - rename, merge, split
// ======================================================================
function renameMinistry(g, id, name) {
  g.ministryNames = g.ministryNames || {};
  var old = ministryName(id);
  g.ministryNames[id] = name;
  g.commandLog.push({ week: g.week, cmd: "renameMinistry", ministry: id, name: name });
  addEvent(g, "ministry", 1, old + " renamed " + name, { from: old, to: name }, "Decision of the " + g.constitution.title + ".", 0);
}

function mergeMinistry(g, id, into) {
  var m = cabinetEntry(g, id);
  if (!m || m.mergedInto || id == into) return false;
  var target = cabinetEntry(g, into);
  if (target.mergedInto) return false;
  m.mergedInto = into;
  target.load = (target.load || 0) + 1;
  target.competence *= 0.9; // one minister doing two jobs
  g.budget.lines.admin = Math.max(0, g.budget.lines.admin - g.econ.gdp * 0.0002); // fewer civil servants at the top
  g.commandLog.push({ week: g.week, cmd: "mergeMinistry", ministry: id, into: into });
  addEvent(g, "ministry", 1, ministryName(id) + " merged into " + ministryName(into), { saving: money(g, g.econ.gdp * 0.0002) }, "Machinery of government change.", 0);
  return true;
}

function splitMinistry(g, id, name) {
  var m = cabinetEntry(g, id);
  if (!m || !m.mergedInto) return;
  var target = cabinetEntry(g, m.mergedInto);
  target.load = Math.max(0, (target.load || 1) - 1);
  target.competence = Math.min(0.95, target.competence / 0.9);
  m.mergedInto = null;
  m.name = name; m.party = playerParty(g).id; m.competence = 0.5; m.since = g.week;
  g.budget.lines.admin += g.econ.gdp * 0.0002;
  g.commandLog.push({ week: g.week, cmd: "splitMinistry", ministry: id });
  addEvent(g, "ministry", 1, ministryName(id) + " becomes a separate ministry again", { minister: name }, "Machinery of government change.", 0);
}

function cabinetEntry(g, id) { for (var i = 0; i < g.cabinet.length; i++) if (g.cabinet[i].ministry == id) return g.cabinet[i]; }

// ======================================================================
// FLAGS (shared by the game and the pages)
// ======================================================================
function cleanFlagImg(s) {
  // only accept real image data urls (a save file could have anything in it)
  if (typeof s == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+\/=]+$/.test(s) && s.length < 400000) return s;
  return "";
}
function cleanFlag(f) {
  if (!f || !f.length) return null;
  var out = [];
  for (var i = 0; i < f.length && i < 5; i++) if (/^#([0-9a-f]{3}){1,2}$/i.test(f[i])) out.push(f[i]);
  return out.length >= 1 ? out : null;
}

function flagHtml(country, w, h) {
  w = w || 45; h = h || 30;
  if (cleanFlagImg(country.flagImg)) return "<img src='" + country.flagImg + "' width=" + w + " height=" + h + " alt='Flag' style='border:1px solid #fff;vertical-align:middle;object-fit:cover'>";
  var f = cleanFlag(country.flag) || ["#17345B", "#FFFFFF", "#C8102E"];
  var s = "<span style='display:inline-flex;" + (country.flagVertical ? "flex-direction:row" : "flex-direction:column") + ";width:" + w + "px;height:" + h + "px;border:1px solid #fff;vertical-align:middle'>";
  for (var i = 0; i < f.length; i++) s += "<span style='flex:1;background:" + f[i] + "'></span>";
  return s + "</span>";
}

// sets up seats for the kind of legislature at the start of a game
function setupLegislature(g) {
  var c = g.constitution, me = playerParty(g);
  me.inGov = true;
  if (c.partySystem == "single") {
    for (var i = 0; i < g.parties.length; i++) {
      var p = g.parties[i];
      if (!p.player) { p.banned = true; p.seats = 0; p.inGov = false; } else p.seats = c.seats;
    }
  } else if (c.legislature == "appointed") {
    var others = g.parties.filter(function (p) { return !p.player; });
    var rest = c.seats - Math.round(c.seats * 0.7), tot = sum(others.map(function (p) { return p.seats; })) || 1, given = 0;
    for (var i = 0; i < others.length; i++) { others[i].seats = Math.floor(rest * others[i].seats / tot); given += others[i].seats; }
    me.seats = c.seats - given;
  }
  computeUpper(g);
}

// advisory legislature voted it down: push it through anyway
function overrideBill(g, id) {
  var b = findBill(g, id);
  if (!b || !b.canOverride || b.stage != "REJECTED") return false;
  b.canOverride = false;
  b.stage = "EXECUTIVE ASSENT";
  b.decree = true;
  b.effective = g.week + 1;
  b.log.push({ week: g.week, stage: "EXECUTIVE ASSENT", note: "The " + g.constitution.title + " overrode the legislature." });
  g.politics.legitimacy = clamp(g.politics.legitimacy - 5, 0, 100);
  g.politics.mood -= 0.01;
  g.commandLog.push({ week: g.week, cmd: "override", bill: id });
  addEvent(g, "override", 2, g.constitution.title + " overrides the legislature on " + b.title, { bill: id }, "The legislature is only advisory under the constitution.", -1, false, id);
  return true;
}
