// pages.js - every page of the site. each one returns a big string of html
// (yes its a lot of string adding, it works)

var PAGES = {};
var PAGE_TITLES = {
  newgame: "New Game", dashboard: "National Dashboard", cabinet: "Cabinet and Ministries", parliament: "Parliament", bill: "Bill",
  law: "Constitution and Law", economy: "Economy", treasury: "Treasury and Budget", population: "Population and Society",
  services: "Public Services", elections: "Elections and Parties", regions: "Regions", foreign: "Foreign Affairs",
  defence: "Defence and Security", news: "Media and News", article: "Article", event: "Event Record", stats: "National Statistics",
  chart: "Indicator", why: "Why did this change?", archive: "Historical Archive", settings: "Settings and Save Games",
  glossary: "Glossary", help: "How to play", identity: "National Identity"
};

var draft = null; // the bill being previewed

// all the main numbers, so the dashboard / stats / charts can share them
var INDICATORS = [
  { key: "gdp", name: "GDP", fmt: function (v) { return money(game, v); }, why: "gdp" },
  { key: "growth", name: "Real growth", fmt: function (v) { return pct(v); }, why: "gdp" },
  { key: "infl", name: "Inflation", fmt: function (v) { return pct(v); }, why: "infl" },
  { key: "u", name: "Unemployment", fmt: function (v) { return pct(v); }, why: "u" },
  { key: "debtRatio", name: "Debt/GDP", fmt: function (v) { return pct(v, 0); }, why: "spending" },
  { key: "bal", name: "Budget balance", fmt: function (v) { return money(game, v); }, why: "spending" },
  { key: "rev", name: "Revenue", fmt: function (v) { return money(game, v); }, why: "revenue" },
  { key: "approval", name: "Approval", fmt: function (v) { return pct(v, 1); }, why: "approval" },
  { key: "pop", name: "Population", fmt: function (v) { return v.toFixed(3) + "m"; } },
  { key: "disp", name: "Disposable income", fmt: function (v) { return game.country.symbol + " " + v.toFixed(2) + "k"; }, why: "disp" },
  { key: "healthCap", name: "Health capacity", fmt: function (v) { return v.toFixed(2) + "m"; }, why: "health" },
  { key: "healthAccess", name: "Health access", fmt: function (v) { return pct(v); }, why: "health" },
  { key: "wait", name: "Waiting time", fmt: function (v) { return v.toFixed(1) + " wks"; }, why: "health" },
  { key: "rate", name: "Policy rate", fmt: function (v) { return pct(v, 2); }, why: "infl" },
  { key: "exch", name: "Exchange rate", fmt: function (v) { return v.toFixed(1); } },
  { key: "poverty", name: "Poverty rate", fmt: function (v) { return pct(v); }, why: "disp" },
  { key: "gini", name: "Gini", fmt: function (v) { return (v * 100).toFixed(1); }, why: "disp" },
  { key: "readiness", name: "Readiness", fmt: function (v) { return v.toFixed(0) + "/100"; } },
  { key: "crime", name: "Recorded crime", fmt: function (v) { return v.toFixed(1) + " per 1000"; } },
  { key: "di", name: "Democracy index", fmt: function (v) { return Math.round(v) + "/100"; } },
  { key: "legitimacy", name: "Legitimacy", fmt: function (v) { return Math.round(v) + "/100"; } },
  { key: "unrest", name: "Unrest", fmt: function (v) { return Math.round(v) + "/100"; } },
  { key: "loyalty", name: "Army loyalty", fmt: function (v) { return Math.round(v) + "/100"; } },
  { key: "corruption", name: "Corruption", fmt: function (v) { return Math.round(v) + "/100"; } }
];
function indicator(key) { for (var i = 0; i < INDICATORS.length; i++) if (INDICATORS[i].key == key) return INDICATORS[i]; }

function title(t) { return "<h1>" + t + "</h1><div class='pagedate'>" + (game ? esc(game.country.name) + " &middot; " + weekDate(game) + " &middot; Week " + game.week : "") + "</div>"; }
function tip(name) { return "<span class='tip' title='" + esc(GLOSSARY[name] || "") + "'>" + name + "</span>"; }
function chg(now, before, fmtDiff, goodUp) {
  if (before === undefined || before === null) return "<td class='num'>-</td>";
  var d = now - before;
  var txt = fmtDiff(d);
  // if it rounds to zero, dont show an arrow
  if (parseFloat(txt.replace(/[^0-9.]/g, "")) == 0) return "<td class='num'>no change</td>";
  var cls = (d > 0) == goodUp ? "good" : "bad";
  var arrow = d > 0 ? "&#9650;" : "&#9660;";
  return "<td class='num " + cls + "'>" + arrow + " " + txt + "</td>";
}
function diffFmt(ind) {
  if (["growth", "infl", "u", "debtRatio", "healthAccess", "poverty", "rate"].indexOf(ind.key) >= 0) return function (d) { return (d * 100).toFixed(2) + " pts"; };
  if (ind.key == "approval") return function (d) { return (d * 100).toFixed(1) + " pts"; };
  return function (d) { return ind.fmt(d); };
}
var GOOD_UP = { gdp: 1, growth: 1, infl: 0, u: 0, debtRatio: 0, bal: 1, rev: 1, approval: 1, pop: 1, disp: 1, healthCap: 1, healthAccess: 1, wait: 0, rate: 0, exch: 1, poverty: 0, gini: 0, readiness: 1, crime: 0, di: 1, legitimacy: 1, unrest: 0, loyalty: 1, corruption: 0 };

// hash -> number between 0 and 1, so candidate lists dont use up the game's random numbers
function hashRand(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

// ======================================================================
// NEW GAME
// ======================================================================
// ======================================================================
// DASHBOARD
// ======================================================================
PAGES.dashboard = function () {
  var g = game;
  var h = title("National Dashboard");
  if (g.gameOver) {
    h += "<div class='gameover'><b>" + (g.gameOver.retired ? "YOU HAVE RETIRED FROM OFFICE" : "YOUR RULE IS OVER") + "</b><br>" + esc(g.gameOver.reason) + "<br>You governed for " + (g.gameOver.week - 1) + " weeks. ";
    h += "Look back over your time in office in the <a href='#archive'>Historical Archive</a> or <a href='#newgame'>start a new game</a>.</div>";
  }
  if (g.week <= 12 && TUTORIAL[g.week]) h += "<div class='tutorial'><b>Advisor (week " + g.week + " of 12):</b> " + TUTORIAL[g.week] + "</div>";
  if (g.stoppedFor && g.stoppedFor.length) {
    h += "<div class='notice'>Fast-forward stopped because of urgent events.</div>";
    g.stoppedFor = null;
  }
  // urgent this week
  var urgent = g.events.filter(function (e) { return e.week == g.week && e.urgent; });
  for (var i = 0; i < urgent.length; i++) h += "<div class='alert'><b>URGENT:</b> <a href='#event/" + urgent[i].id + "'>" + esc(urgent[i].title) + "</a></div>";
  if (g.war) h += "<div class='alert'><b>AT WAR</b> with " + esc(countryOf(g, g.war.enemy).name) + " for " + g.war.weeks + " weeks. Front line: " + Math.round(g.war.front) + ". <a href='#defence'>War room &raquo;</a>" + (g.war.enemyOffer ? " <b>They have offered peace terms.</b>" : "") + "</div>";
  if (g.politics.unrest > 55) h += "<div class='alert'><b>Unrest is dangerous</b> (" + Math.round(g.politics.unrest) + "/100). " + (g.constitution.assembly != "free" ? "With protest restricted, anger can turn into riots or revolution." : "Expect strikes and protests.") + "</div>";
  if (g.defence.loyalty < 45) h += "<div class='alert'><b>The army is restless</b> (loyalty " + Math.round(g.defence.loyalty) + "/100). Raise defence pay or risk a coup.</div>";
  // pending decisions
  var pend = [];
  for (var i = 0; i < g.bills.length; i++) if (g.bills[i].stage == "AMENDMENT WINDOW") pend.push("Bill <a href='#bill/" + g.bills[i].id + "'>" + esc(g.bills[i].title) + "</a> is open for amendments (final vote next week)");
  for (var i = 0; i < g.offers.length; i++) if (g.offers[i].status == "open") pend.push("<a href='#foreign'>Treaty offer from " + esc(countryById(g.offers[i].from).name) + "</a>");
  if (pend.length) h += "<div class='notice'><b>Pending decisions:</b><br>&bull; " + pend.join("<br>&bull; ") + "</div>";

  h += "<h2>Key indicators</h2>";
  h += "<table class='data full'><tr><th>Indicator</th><th class='num'>Now</th><th class='num'>vs last week</th><th class='num'>vs last month</th><th class='num'>vs last year</th><th class='num'>vs start of term</th><th></th></tr>";
  var now = g.history[g.history.length - 1];
  var termStart = null;
  for (var i = 0; i < g.history.length; i++) if (g.history[i].w >= g.politics.termStart) { termStart = g.history[i]; break; }
  var keys = ["gdp", "growth", "infl", "u", "debtRatio", "bal", "pop", "approval", "disp", "healthAccess", "wait", "legitimacy", "unrest", "loyalty", "corruption"];
  for (var i = 0; i < keys.length; i++) {
    var ind = indicator(keys[i]);
    var f = diffFmt(ind), up = GOOD_UP[ind.key];
    var w1 = histAgo(g, 1), w4 = histAgo(g, 4), w52 = histAgo(g, 52);
    h += "<tr><td>" + tip(ind.name) + "</td><td class='num'><a href='#chart/" + ind.key + "'>" + ind.fmt(now[ind.key]) + "</a></td>";
    h += chg(now[ind.key], w1 ? w1[ind.key] : null, f, up) + chg(now[ind.key], w4 ? w4[ind.key] : null, f, up) + chg(now[ind.key], w52 ? w52[ind.key] : null, f, up) + chg(now[ind.key], termStart ? termStart[ind.key] : null, f, up);
    h += "<td>" + (ind.why ? "<a href='#why/" + ind.why + "/4'>why?</a>" : "") + "</td></tr>";
  }
  if (g.constitution.legislature != "none") h += "<tr><td>" + tip("Majority") + "</td><td class='num'><a href='#parliament'>" + govSeats(g) + " seats</a></td><td colspan=5>" + g.constitution.majority + " needed for a majority. Government: " + govParties(g).map(function (p) { return esc(p.name); }).join(", ") + (decreeMode(g) ? " <b>(you rule by decree)</b>" : "") + "</td></tr>";
  h += "</table>";

  h += "<table width='100%'><tr><td valign=top width='50%'>";
  h += "<h2>Approval and GDP (last 52 weeks)</h2><canvas class='chart' id='c_dash' width=420 height=170></canvas>";
  h += "<div class='small'><span style='color:#17345B'>&#9632;&#9632;</span> Approval % &nbsp; <span style='color:#C8102E'>- - -</span> Real GDP growth %</div>";
  afterRender.push(function () {
    var hs = g.history.slice(-52);
    drawChart("c_dash", hs.map(function (x) { return x.w; }), [
      { label: "Approval", color: "#17345B", values: hs.map(function (x) { return x.approval * 100; }) },
      { label: "Growth", color: "#C8102E", dash: true, values: hs.map(function (x) { return x.growth * 100; }) }]);
  });
  h += "</td><td valign=top>";
  h += "<h2>Latest news</h2>";
  var news = g.news.slice(-6).reverse();
  for (var i = 0; i < news.length; i++) h += "<div class='article'><span class='outletname'>" + outletName(news[i].outlet) + "</span><br><a href='#article/" + news[i].id + "'>" + esc(news[i].headline) + "</a></div>";
  h += "<p><a href='#news'>More news &raquo;</a></p></td></tr></table>";

  h += "<h2>What happened this week</h2>";
  var evs = g.events.filter(function (e) { return e.week == g.week; });
  if (!evs.length) h += "<p class='small'>A quiet week.</p>";
  h += "<ul>";
  for (var i = 0; i < evs.length; i++) h += "<li><a href='#event/" + evs[i].id + "'>" + esc(evs[i].title) + "</a> <span class='small'>(" + evs[i].id + ")</span></li>";
  h += "</ul>";
  h += "<p class='small'>Tip: press <b>N</b> to advance a week. Every number above links to its history; \"why?\" opens the cause breakdown.</p>";
  return h;
};

function countryById(id) { for (var i = 0; i < game.foreign.length; i++) if (game.foreign[i].id == id) return game.foreign[i]; }

// ======================================================================
// CABINET
// ======================================================================
PAGES.cabinet = function (arg) {
  var g = game;
  var h = title("Cabinet and Ministries");
  h += "<p>The " + esc(g.constitution.title) + " appoints and dismisses ministers. Competence affects how fast a ministry can deliver (hiring staff, negotiating, readiness). Dismissing a coalition partner's minister annoys that party.</p>";
  h += "<table class='data full'><tr><th>Ministry</th><th>Minister</th><th>Party</th><th class='num'>Competence</th><th class='num'>Approval</th><th class='num'>Budget</th><th>Since</th><th></th></tr>";
  for (var i = 0; i < g.cabinet.length; i++) {
    var m = g.cabinet[i];
    var line = null;
    for (var j = 0; j < SPENDING_LINES.length; j++) if (SPENDING_LINES[j].ministry == m.ministry) line = (line || 0) + g.budget.lines[SPENDING_LINES[j].id];
    if (m.mergedInto) {
      h += "<tr class='small'><td>" + esc(ministryName(m.ministry)) + "</td><td colspan=6><i>Merged into " + esc(ministryName(m.mergedInto)) + "</i>" + (line ? " (budget " + money(g, line) + ")" : "") + "</td><td><a href='javascript:doSplit(\"" + m.ministry + "\")'>Split off</a></td></tr>";
      continue;
    }
    h += "<tr><td>" + esc(ministryName(m.ministry)) + (m.load ? " <span class='small'>(+" + m.load + " merged)</span>" : "") + "</td><td>" + esc(m.name) + "</td><td>" + esc(findParty(g, m.party).name) + "</td><td class='num'>" + Math.round(m.competence * 100) + "</td><td class='num'>" + pct(clamp(m.approval, 0, 1), 0) + "</td><td class='num'>" + (line ? money(g, line) : "-") + "</td><td>" + weekDate(g, m.since) + "</td>";
    h += "<td class='small'><a href='#cabinet/" + m.ministry + "'>Replace</a> | <a href='javascript:doRename(\"" + m.ministry + "\")'>Rename</a> | <a href='javascript:doMerge(\"" + m.ministry + "\")'>Merge</a></td></tr>";
  }
  h += "</table><p class='small'>Merging a ministry saves some admin money, but one minister doing two jobs is less effective. Renaming is free.</p>";
  if (arg) {
    var m = minister(g, arg);
    h += "<h2>Replace the Minister for " + ministryName(arg) + "</h2>";
    h += "<p>Current: <b>" + esc(m.name) + "</b> (" + esc(findParty(g, m.party).name) + ", competence " + Math.round(m.competence * 100) + ").</p>";
    h += "<table class='data'><tr><th>Candidate</th><th>Party</th><th class='num'>Competence</th><th>Effect</th><th></th></tr>";
    var cands = candidates(g, arg);
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var note = c.party != m.party && !findParty(g, m.party).player ? "<span class='bad'>" + esc(findParty(g, m.party).name) + " loses a ministry (patience -20)</span>" : "";
      h += "<tr><td>" + esc(c.name) + "</td><td>" + esc(findParty(g, c.party).name) + "</td><td class='num'>" + Math.round(c.competence * 100) + "</td><td>" + note + "</td>";
      h += "<td><button onclick='appoint(\"" + arg + "\"," + i + ")'>Appoint</button></td></tr>";
    }
    h += "</table><p class='small'>Changing a minister costs a little approval this week (the public dislikes reshuffles).</p>";
  }
  return h;
};

function doRename(id) {
  var n = prompt("New name for the " + ministryName(id) + ":", ministryName(id));
  if (!n || !n.trim()) return;
  renameMinistry(game, id, n.trim().slice(0, 60));
  autosave(); route();
}
function doMerge(id) {
  var g = game, opts = [];
  for (var i = 0; i < g.cabinet.length; i++) if (g.cabinet[i].ministry != id && !g.cabinet[i].mergedInto) opts.push((opts.length + 1) + ". " + ministryName(g.cabinet[i].ministry));
  var n = prompt("Merge the " + ministryName(id) + " into which ministry? Type the number:\n" + opts.join("\n"));
  if (!n) return;
  var pickName = opts[parseInt(n) - 1];
  if (!pickName) { alert("Not a valid number."); return; }
  var into = null;
  for (var i = 0; i < g.cabinet.length; i++) if (ministryName(g.cabinet[i].ministry) == pickName.replace(/^\d+\. /, "")) into = g.cabinet[i].ministry;
  var mine = cabinetEntry(g, id);
  for (var i = 0; i < g.cabinet.length; i++) if (g.cabinet[i].mergedInto == id) { alert("Split off the ministries merged into this one first."); return; }
  if (!mergeMinistry(g, id, into)) { alert("Can't merge those."); return; }
  autosave(); route();
}
function doSplit(id) {
  var g = game;
  var c = candidates(g, id)[0];
  if (!confirm("Make the " + ministryName(id) + " a separate ministry again, with " + c.name + " as minister?")) return;
  splitMinistry(g, id, c.name);
  autosave(); route();
}

function candidates(g, ministry) {
  var out = [], gp = govParties(g);
  for (var i = 0; i < 4; i++) {
    var r = hashRand(g.rng.seed + ":" + g.week + ":" + ministry + ":" + i);
    var r2 = hashRand("b" + g.rng.seed + ":" + g.week + ":" + ministry + ":" + i);
    var r3 = hashRand("c" + g.rng.seed + ":" + ministry + ":" + i + ":" + g.week);
    out.push({ name: FIRST_NAMES[Math.floor(r * FIRST_NAMES.length)] + " " + LAST_NAMES[Math.floor(r2 * LAST_NAMES.length)], party: gp[i % gp.length].id, competence: 0.25 + r3 * 0.65 });
  }
  return out;
}

function appoint(ministry, idx) {
  var g = game;
  var c = candidates(g, ministry)[idx];
  var m = minister(g, ministry);
  if (!confirm("Dismiss " + m.name + " and appoint " + c.name + " as Minister for " + ministryName(ministry) + "?")) return;
  var oldParty = findParty(g, m.party);
  if (c.party != m.party && !oldParty.player) oldParty.patience -= 20;
  m.name = c.name; m.party = c.party; m.competence = c.competence; m.approval = 0.5; m.since = g.week;
  g.politics.mood -= 0.005;
  g.commandLog.push({ week: g.week, cmd: "appoint", ministry: ministry, name: c.name });
  addEvent(g, "appointment", 1, c.name + " appointed Minister for " + ministryName(ministry), { minister: c.name, ministry: ministryName(ministry) }, "Cabinet reshuffle by the " + g.constitution.title + ".", 0);
  autosave();
  go("cabinet");
}

// ======================================================================
// PARLIAMENT + BILLS
// ======================================================================
function seatBar(g, seats) {
  var h = "<div class='seatbar'>", tot = 0;
  for (var i = 0; i < g.parties.length; i++) tot += (seats ? seats[i] : g.parties[i].seats) || 0;
  tot = tot || 1;
  for (var i = 0; i < g.parties.length; i++) {
    var p = g.parties[i], s = seats ? seats[i] : p.seats;
    if (!s) continue;
    h += "<div style='background:" + p.color + ";width:" + (s / tot * 100) + "%' title='" + esc(p.name) + ": " + s + "'>" + s + "</div>";
  }
  return h + "</div>";
}

PAGES.parliament = function () {
  var g = game;
  var h = title("Parliament");
  var con = g.constitution;
  if (con.legislature == "none") return h + "<p>There is no legislature. The " + esc(con.title) + " makes all laws by decree. You can still <a href='#treasury'>change taxes and spending</a> or <a href='#law/composer'>issue a policy decree</a>; they take effect the following week.</p>" + "<h2>Decrees</h2>" + billTable(g, g.bills.slice().reverse());
  h += "<div class='notice'>" + (con.legislature == "appointed" ? "The members are <b>appointed by the government</b>. " : "") + (decreeMode(g) ? "The legislature approves whatever the government sends it: laws pass by decree." : (con.legPower == "advisory" ? "The legislature is <b>advisory</b>: if it votes a bill down you can override it." : "Laws need a majority vote.")) + "</div>";
  h += "<p>" + g.constitution.seats + " seats. A majority needs <b>" + g.constitution.majority + "</b>. The government has <b>" + govSeats(g) + "</b>" + (govSeats(g) < g.constitution.majority ? " <span class='bad'>(MINORITY)</span>" : "") + ".</p>";
  h += seatBar(g);
  h += "<table class='data full'><tr><th>Party</th><th>Leader</th><th class='num'>Seats</th><th>Side</th><th class='num'>Economic position</th><th class='num'>Social position</th><th class='num'>Poll</th><th class='num'>Coalition patience</th></tr>";
  for (var i = 0; i < g.parties.length; i++) {
    var p = g.parties[i];
    h += "<tr><td><span style='color:" + p.color + "'>&#9632;</span> " + esc(p.name) + (p.player ? " <b>(your party)</b>" : "") + "</td><td>" + esc(p.leader) + "</td><td class='num'>" + p.seats + "</td><td>" + (p.banned ? "<span class='bad'>Banned</span>" : (p.inGov ? "Government" : "Opposition")) + "</td>";
    h += "<td class='num'>" + p.econ + " <span class='small'>(" + (p.econ < 40 ? "left" : p.econ > 60 ? "right" : "centre") + ")</span></td><td class='num'>" + p.social + "</td><td class='num'>" + pct(p.poll) + "</td>";
    h += "<td class='num'>" + (p.inGov && !p.player ? Math.round(p.patience) + "/80" : "-") + "</td></tr>";
  }
  h += "</table>";
  if (g.upper) {
    h += "<h2>Upper chamber (" + g.upper.total + " seats, " + ({ regional: "represents the regions", elected: "elected nationally", appointed: "appointed" }[con.upperHouse]) + ")</h2>" + seatBar(g, g.upper.seats);
    h += "<table class='data'><tr><th>Party</th><th class='num'>Seats</th></tr>";
    for (var i = 0; i < g.parties.length; i++) if (g.upper.seats[i]) h += "<tr><td>" + esc(g.parties[i].name) + "</td><td class='num'>" + g.upper.seats[i] + "</td></tr>";
    h += "</table><p class='small'>" + (con.upperHouse == "appointed" ? "Appointed members always back the government." : "Bills must also pass here.") + "</p>";
  }
  h += "<p class='small'>Positions are 0-100. Economic: 0 = far left, 100 = free market. Social: 0 = traditional, 100 = liberal. Coalition partners quit when their patience hits 0.</p>";
  if (g.politics.lastConfidence) {
    var c = g.politics.lastConfidence;
    h += "<h2>Confidence</h2><p>Last confidence vote (" + weekDate(g, c.week) + "): " + c.forGov + " for the government, " + c.against + " against. " + (c.lost ? "<b class='bad'>Government lost.</b>" : "Government survived.") + "</p>";
  } else if (g.constitution.confidenceRule) h += "<h2>Confidence</h2><p>The government holds the confidence of parliament.</p>";

  h += "<h2>Bills</h2>";
  h += "<p><a href='#treasury'>Draft a Finance Bill (taxes and spending)</a> | <a href='#law/composer'>Draft a policy bill</a> | <a href='#law/amend'>Propose a constitutional amendment</a></p>";
  h += billTable(g, g.bills.slice().reverse());
  h += "<h2>Division records (votes)</h2><table class='data full'><tr><th>Date</th><th>Bill</th><th>Stage</th><th class='num'>For</th><th class='num'>Against</th><th class='num'>Abstain</th></tr>";
  var n = 0;
  for (var i = g.bills.length - 1; i >= 0; i--) for (var j = g.bills[i].votes.length - 1; j >= 0; j--) {
    var v = g.bills[i].votes[j];
    h += "<tr><td>" + weekDate(g, v.week) + "</td><td><a href='#bill/" + g.bills[i].id + "'>" + esc(g.bills[i].title) + "</a></td><td>" + v.stage + "</td><td class='num'>" + v.yes + "</td><td class='num'>" + v.no + "</td><td class='num'>" + v.abstain + "</td></tr>";
    n++;
  }
  if (!n) h += "<tr><td colspan=6>No votes yet.</td></tr>";
  return h + "</table>";
};

function billTable(g, bills) {
  var h = "<table class='data full'><tr><th>ID</th><th>Title</th><th>Type</th><th>Submitted</th><th>Stage</th><th class='num'>Annual budget effect</th></tr>";
  for (var i = 0; i < bills.length; i++) {
    var b = bills[i];
    h += "<tr><td>" + b.id + "</td><td><a href='#bill/" + b.id + "'>" + esc(b.title) + "</a></td><td>" + b.type + "</td><td>" + weekDate(g, b.submitted) + "</td><td>" + b.stage + "</td><td class='num'>" + (b.cost ? money(g, b.cost.balance) : "-") + "</td></tr>";
  }
  if (!bills.length) h += "<tr><td colspan=6>No bills yet.</td></tr>";
  return h + "</table>";
}

PAGES.bill = function (id) {
  var g = game, b = findBill(g, id);
  if (!b) return title("Bill not found");
  var h = title(esc(b.title) + " <span class='small'>(" + b.id + ")</span>");
  var stages = ["DRAFT", "LEGAL REVIEW", "FISCAL REVIEW", "COMMITTEE", "FIRST VOTE", "AMENDMENT WINDOW", "FINAL VOTE", "EXECUTIVE ASSENT", "IMPLEMENTATION"];
  h += "<p>Stage: <b>" + b.stage + "</b>. Responsible ministry: " + ministryName(b.ministry) + ". Submitted " + weekDate(g, b.submitted) + ".</p>";
  h += "<p class='small'>" + stages.join(" &rarr; ") + "</p>";
  if (b.meta) {
    h += "<h2>Policy details</h2><table class='data'>";
    for (var k in b.meta) h += "<tr><th>" + esc(niceKey(k)) + "</th><td>" + esc(b.meta[k]) + "</td></tr>";
    h += "</table>";
  }
  h += "<h2>Changes in this bill</h2><table class='data'><tr><th>Item</th><th class='num'>Now</th><th class='num'>Proposed</th></tr>";
  for (var i = 0; i < b.changes.length; i++) {
    var c = b.changes[i];
    h += "<tr><td>" + esc(c.name) + "</td><td class='num'>" + fmtVal(c.from, c) + " " + (c.unit || "") + "</td><td class='num'>" + fmtVal(c.to, c) + " " + (c.unit || "") + "</td></tr>";
  }
  h += "</table>";
  if (b.cost) h += "<p>Estimated annual effect at today's tax bases: revenue " + money(g, b.cost.revenue) + ", spending " + money(g, b.cost.spending) + ", <b>balance " + money(g, b.cost.balance) + "</b>." + (b.cost.oneOff ? " One-off debt change " + money(g, b.cost.oneOff) + "." : "") + "</p>";
  if (b.checks) h += "<h2>Checks at submission</h2>" + checksHtml(b.checks);
  if (b.stage == "AMENDMENT WINDOW") {
    h += "<h2>Amend this bill</h2><p>You can change the proposed values before the final vote next week.</p><table class='data'>";
    for (var i = 0; i < b.changes.length; i++) {
      var c = b.changes[i];
      if (typeof c.to == "number" && c.kind != "amend") h += "<tr><td>" + esc(c.name) + "</td><td><input type='number' step='any' id='am_" + i + "' value='" + roundNice(c.to) + "'> " + (c.unit || "") + "</td></tr>";
      else h += "<tr><td>" + esc(c.name) + "</td><td>" + fmtVal(c.to, c) + " <span class='small'>(withdraw and resubmit to change this)</span></td></tr>";
    }
    h += "</table><button onclick='doAmend(\"" + b.id + "\")'>Submit amendment</button> <button onclick='doWithdraw(\"" + b.id + "\")'>Withdraw bill</button>";
  } else if (b.stage == "COMMITTEE") {
    h += "<p><button onclick='doWithdraw(\"" + b.id + "\")'>Withdraw bill</button></p>";
  }
  if (b.decree) h += "<div class='notice'>This was made law by the " + esc(g.constitution.title) + " without a vote.</div>";
  if (b.canOverride && b.stage == "REJECTED") h += "<div class='alert'>The legislature voted this down, but it is only advisory. You can sign it anyway. That costs <b>5 legitimacy</b> and some public goodwill.<br><button onclick='doOverride(\"" + b.id + "\")'>Override the legislature</button></div>";
  h += "<h2>Record</h2><table class='data full'><tr><th>Week</th><th>Stage</th><th>Note</th></tr>";
  for (var i = 0; i < b.log.length; i++) h += "<tr><td>" + weekDate(g, b.log[i].week) + "</td><td>" + b.log[i].stage + "</td><td>" + esc(b.log[i].note) + "</td></tr>";
  h += "</table>";
  for (var i = 0; i < b.votes.length; i++) {
    var v = b.votes[i];
    h += "<h3>" + v.stage + " (" + weekDate(g, v.week) + "): " + v.yes + " for, " + v.no + " against, " + v.abstain + " abstain</h3><table class='data'><tr><th>Party</th><th class='num'>For</th><th class='num'>Against</th><th class='num'>Abstain</th></tr>";
    for (var j = 0; j < v.parties.length; j++) h += "<tr><td>" + esc(v.parties[j].name) + "</td><td class='num'>" + v.parties[j].yes + "</td><td class='num'>" + v.parties[j].no + "</td><td class='num'>" + v.parties[j].abstain + "</td></tr>";
    h += "</table>";
  }
  var evs = g.events.filter(function (e) { return e.bill == b.id; });
  if (evs.length) {
    h += "<h2>Related events</h2><ul>";
    for (var i = 0; i < evs.length; i++) h += "<li><a href='#event/" + evs[i].id + "'>" + esc(evs[i].title) + "</a></li>";
    h += "</ul>";
  }
  return h;
};

function fmtVal(v, c) {
  if (c && c.kind == "amend") {
    for (var i = 0; i < CONST_FIELDS.length; i++) if (CONST_FIELDS[i].id == c.id && CONST_FIELDS[i].options)
      for (var j = 0; j < CONST_FIELDS[i].options.length; j++) if (String(CONST_FIELDS[i].options[j][0]) == String(v)) return esc(CONST_FIELDS[i].options[j][1]);
  }
  if (typeof v == "boolean") return v ? "yes" : "no";
  if (v && v.join) return v.map(function (x) { return "<span style='display:inline-block;width:12px;height:12px;border:1px solid #999;background:" + esc(x) + "'></span>"; }).join("");
  if (typeof v == "string" && v.indexOf("data:image/") == 0) return cleanFlagImg(v) ? "<img src='" + v + "' width=45 height=30>" : "(picture)";
  if (c && c.kind == "identity" && v === "") return "(none)";
  return typeof v == "number" ? roundNice(v) : esc(v);
}
function roundNice(v) { return Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100; }

function checksHtml(checks) {
  var h = "";
  for (var i = 0; i < checks.length; i++) {
    var c = checks[i];
    var cls = !c.ok ? "fail" : (c.warn ? "warn" : "ok");
    h += "<div class='check " + cls + "'><b>" + c.name + "</b> [" + (!c.ok ? "FAIL" : (c.warn ? "WARNING" : "OK")) + "] " + esc(c.msg) + "</div>";
  }
  return h;
}

function doAmend(id) {
  var b = findBill(game, id);
  var changes = copy(b.changes);
  for (var i = 0; i < changes.length; i++) if ($("am_" + i)) changes[i].to = parseFloat($("am_" + i).value);
  var r = amendBill(game, id, changes);
  if (!r.ok) alert("Amendment rejected:\n" + (r.msg || r.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.name + ": " + c.msg; }).join("\n")));
  autosave();
  route();
}
function doOverride(id) {
  if (!confirm("Sign this law over the legislature's objection?")) return;
  overrideBill(game, id);
  autosave();
  route();
}
function doWithdraw(id) {
  if (!confirm("Withdraw this bill? It will stay in the record as withdrawn.")) return;
  withdrawBill(game, id);
  autosave();
  route();
}

// ======================================================================
// CONSTITUTION AND LAW (+ policy composer + amendments)
// ======================================================================
PAGES.law = function (arg) {
  var g = game, c = g.constitution;
  var tab = arg || "constitution";
  var h = title("Constitution and Law");
  h += "<div class='tabs'><a href='#law/constitution'" + (tab == "constitution" ? " class='current'" : "") + ">Constitution</a> <a href='#law/laws'" + (tab == "laws" ? " class='current'" : "") + ">Laws and policies in force</a> <a href='#law/composer'" + (tab == "composer" ? " class='current'" : "") + ">Policy composer</a> <a href='#law/amend'" + (tab == "amend" ? " class='current'" : "") + ">Amend the constitution</a></div>";
  if (tab == "constitution") {
    h += constSummaryHtml(g);
    h += "<table class='data full'>";
    h += "<tr><th>System of government</th><td>" + esc(c.govType) + "</td></tr>";
    h += "<tr><th>Democracy index</th><td><a href='#chart/di'>" + Math.round(g.politics.di) + "/100</a> (" + diLabel(g.politics.di) + ")</td></tr>";
    h += "<tr><th>Legislature</th><td>" + (c.legislature == "none" ? "None" : c.seats + " seats" + (c.chambers == 2 ? " + upper chamber of " + c.upperSeats : "") + ", majority " + c.majority) + "</td></tr>";
    h += "<tr><th>Electoral system</th><td>" + (electionsHeld(g) ? electionSystemName(c.electionSystem) : "No elections") + "</td></tr>";
    h += "<tr><th>Amendment procedure</th><td>" + esc(c.amendmentText) + "</td></tr>";
    var group = "";
    for (var i = 0; i < CONST_FIELDS.length; i++) {
      var f = CONST_FIELDS[i];
      if (f.group != group) { group = f.group; h += "<tr><th colspan=2 class='grouphead'>" + group + "</th></tr>"; }
      var v = f.id == "leaderTitle" ? c.title : c[f.id];
      h += "<tr><td>" + f.name + "</td><td>" + fmtVal(v, { kind: "amend", id: f.id }) + "</td></tr>";
    }
    h += "<tr><th colspan=2 class='grouphead'>Regions</th></tr><tr><td>Regions</td><td>" + g.regions.length + ": " + g.regions.map(function (r) { return esc(r.name); }).join(", ") + "</td></tr>";
    h += "</table><p><a href='#law/amend'>Amend the constitution &raquo;</a></p>";
  }
  if (tab == "laws") {
    h += "<h2>Policies in force</h2><table class='data full'><tr><th>Policy</th><th>Ministry</th><th class='num'>Setting</th><th>Since</th></tr>";
    for (var i = 0; i < POLICIES.length; i++) {
      var p = POLICIES[i], st = g.policies[p.id];
      if (!st.active) continue;
      h += "<tr><td>" + p.name + "</td><td>" + ministryName(p.ministry) + "</td><td class='num'>" + st.value + " " + p.unit + "</td><td>" + (st.since ? weekDate(g, st.since) : "before game start") + "</td></tr>";
    }
    h += "</table><p class='small'>State ownership: energy utilities " + (g.flags.energyPublic ? "<b>public</b>" : "private") + ", rail " + (g.flags.railPrivate ? "<b>private</b>" : "public") + ".</p>";
    h += "<h2>Laws passed during the game</h2><table class='data full'><tr><th>Date</th><th>Law</th></tr>";
    for (var i = g.laws.length - 1; i >= 0; i--) h += "<tr><td>" + weekDate(g, g.laws[i].week) + "</td><td><a href='#bill/" + g.laws[i].bill + "'>" + esc(g.laws[i].title) + "</a></td></tr>";
    if (!g.laws.length) h += "<tr><td colspan=2>None yet.</td></tr>";
    h += "</table>";
  }
  if (tab == "composer") h += composerHtml(g);
  if (tab == "amend") h += amendHtml(g) + "<div id='preview'></div>";
  return h;
};

function electionSystemName(s) { return { dhondt: "Proportional representation by region (D'Hondt)", fptp: "Single-member districts, first past the post", national: "National list proportional representation, 5% threshold", mixed: "Mixed: half districts, half national list" }[s]; }

function composerHtml(g) {
  var h = "<p>Build a policy from the approved effect library. Every field is required. The bill goes through the five checks (legal, fiscal, admin, economic, political) before it can be sent to parliament.</p>";
  h += "<table class='data'>";
  h += "<tr><th>1. Policy</th><td><select id='pc_policy' onchange='composerChanged()'>";
  for (var i = 0; i < POLICIES.length; i++) h += "<option value='" + POLICIES[i].id + "'>" + POLICIES[i].name + "</option>";
  h += "</select></td></tr>";
  h += "<tr><th>Title</th><td><input type='text' id='pc_title' size=40></td></tr>";
  h += "<tr><th>2. Area / ministry</th><td id='pc_ministry'></td></tr>";
  h += "<tr><th>3. Legal instrument</th><td><select id='pc_instr'><option>Bill</option><option>Regulation</option><option>Budget line</option><option>Administrative programme</option></select></td></tr>";
  h += "<tr><th>4. Objective</th><td><input type='text' id='pc_obj' size=50 placeholder='e.g. cut hospital waiting times'></td></tr>";
  h += "<tr><th>5. Target population / sector</th><td><input type='text' id='pc_target' size=40></td></tr>";
  h += "<tr><th>6. Parameter</th><td><span id='pc_param'></span> <input type='number' step='any' id='pc_value'> <span id='pc_range' class='small'></span></td></tr>";
  h += "<tr><th>7. Start</th><td>When passed (about 3 weeks: first vote, final vote, then in force)</td></tr>";
  h += "<tr><th>8. Funding source</th><td><select id='pc_fund'><option>Borrowing</option><option>Existing tax revenue</option><option>Savings elsewhere</option><option>Self-funding</option></select></td></tr>";
  h += "<tr><th>9. Delivery method</th><td><input type='text' id='pc_delivery' size=40 placeholder='e.g. through regional health boards'></td></tr>";
  h += "<tr><th>10. Review date and success measure</th><td><input type='text' id='pc_review' size=40 placeholder='e.g. review in 1 year: waiting time under 6 weeks'></td></tr>";
  h += "</table>";
  h += "<div id='pc_desc' class='box small'></div>";
  h += "<button onclick='composerPreview()'>Preview and check &raquo;</button>";
  h += "<div id='preview'></div>";
  afterRender.push(composerChanged);
  return h;
}

function policyDef(id) { for (var i = 0; i < POLICIES.length; i++) if (POLICIES[i].id == id) return POLICIES[i]; }

function composerChanged() {
  var p = policyDef($("pc_policy").value);
  var st = game.policies[p.id];
  $("pc_title").value = p.name + " Bill";
  $("pc_ministry").innerHTML = ministryName(p.ministry);
  $("pc_instr").value = p.instrument;
  $("pc_param").innerHTML = p.param + " (" + p.unit + ")";
  $("pc_value").value = st.active ? st.value : p.def;
  $("pc_range").innerHTML = "Allowed: " + p.min + " to " + p.max + ". Currently: " + (st.active ? st.value + " " + p.unit : "not in force");
  $("pc_desc").innerHTML = "<b>" + p.name + ":</b> " + p.desc + "<br>Likely supporters: " + p.supporters + ". Likely opponents: " + p.opponents + ".";
}

function composerPreview() {
  var g = game;
  var p = policyDef($("pc_policy").value);
  var st = g.policies[p.id];
  var val = parseFloat($("pc_value").value);
  var fields = { objective: $("pc_obj").value, target: $("pc_target").value, delivery: $("pc_delivery").value, review: $("pc_review").value };
  for (var k in fields) if (!fields[k].trim()) { alert("Please fill in all the fields (" + niceKey(k) + " is empty)."); return; }
  var from = st.active ? st.value : 0;
  if (val == from && !(p.id == "rentcap" && !st.active)) { alert("That's the same as the current setting."); return; }
  draft = {
    title: $("pc_title").value || p.name, type: "policy", ministry: p.ministry,
    changes: [{ kind: "policy", id: p.id, name: p.name + " - " + p.param, from: from, to: val, min: p.min, max: p.max, unit: p.unit }],
    meta: { instrument: $("pc_instr").value, objective: fields.objective, target: fields.target, funding: $("pc_fund").value, delivery: fields.delivery, review: fields.review }
  };
  showPreview();
}

// shared preview for all bill types
function showPreview() {
  var g = game;
  var bill = { id: "(draft)", title: draft.title, type: draft.type, ministry: draft.ministry, changes: draft.changes, lean: billLean(g, draft.changes) };
  var checks = validateBill(g, bill);
  var h = "<h2>Preview: " + esc(draft.title) + "</h2>";
  h += "<table class='data'><tr><th>Item</th><th class='num'>Now</th><th class='num'>Proposed</th></tr>";
  for (var i = 0; i < draft.changes.length; i++) h += "<tr><td>" + esc(draft.changes[i].name) + "</td><td class='num'>" + fmtVal(draft.changes[i].from, draft.changes[i]) + " " + (draft.changes[i].unit || "") + "</td><td class='num'>" + fmtVal(draft.changes[i].to, draft.changes[i]) + " " + (draft.changes[i].unit || "") + "</td></tr>";
  h += "</table>";
  h += "<p>Static costing (today's tax bases, before people and firms react): revenue <b>" + money(g, bill.cost.revenue) + "</b>/yr, spending <b>" + money(g, bill.cost.spending) + "</b>/yr, balance <b>" + money(g, bill.cost.balance) + "</b>/yr." + (bill.cost.oneOff ? " One-off debt change: " + money(g, bill.cost.oneOff) + "." : "") + "</p>";
  h += checksHtml(checks);
  var ok = checks.every(function (c) { return c.ok; });
  h += ok ? "<p><button class='big' onclick='submitDraft()'>Send to parliament</button> <span class='small'>First vote next week, final vote the week after, in force the week after that.</span></p>"
    : "<p class='bad'>This bill can't be submitted until the failed check is fixed.</p>";
  $("preview").innerHTML = h;
}

function submitDraft() {
  var r = submitBill(game, draft.title, draft.type, draft.changes, draft.ministry);
  if (!r.ok) { alert("Bill could not be submitted."); return; }
  if (draft.meta) r.bill.meta = draft.meta;
  draft = null;
  autosave();
  go("bill/" + r.bill.id);
}

// ======================================================================
// ECONOMY
// ======================================================================
PAGES.economy = function () {
  var g = game, f = g.flows, e = g.econ, now = g.history[g.history.length - 1];
  var h = title("Economy");
  h += "<p>All money figures are annual rates in " + esc(g.country.currency) + " (" + g.country.symbol + "), billions. <a href='#why/gdp/12'>Why did GDP change?</a></p>";
  h += "<table width='100%'><tr><td valign=top>";
  h += "<h2>GDP by expenditure</h2><table class='data'>";
  var rows = [["Household consumption", f.C], ["Government consumption and investment", f.G], ["Private investment", f.I], ["Exports", f.X], ["Imports", -f.M]];
  for (var i = 0; i < rows.length; i++) h += "<tr><td>" + rows[i][0] + "</td><td class='num'>" + money(g, rows[i][1]) + "</td><td class='num'>" + pct(rows[i][1] / f.Y) + "</td></tr>";
  h += "<tr class='total'><td>" + tip("GDP") + "</td><td class='num'>" + money(g, f.Y) + "</td><td class='num'>100%</td></tr></table>";
  h += "</td><td valign=top>";
  h += "<h2>Headline numbers</h2><table class='data'>";
  h += "<tr><td>" + tip("Real growth") + "</td><td class='num'>" + pct(now.growth) + "</td></tr>";
  h += "<tr><td>GDP per person</td><td class='num'>" + g.country.symbol + " " + (f.Y / totalPop(g)).toFixed(1) + "k</td></tr>";
  h += "<tr><td>GNI (approx, GDP less net payments abroad)</td><td class='num'>" + money(g, f.Y * 0.985) + "</td></tr>";
  h += "<tr><td>" + tip("Inflation") + " (CPI " + e.cpi.toFixed(1) + ")</td><td class='num'>" + pct(now.infl) + "</td></tr>";
  h += "<tr><td>" + tip("Policy rate") + "</td><td class='num'>" + pct(e.policyRate, 2) + "</td></tr>";
  h += "<tr><td>Commercial lending rate</td><td class='num'>" + pct(e.policyRate + 0.025 + sumShock(g, "credit") * 0.2, 2) + "</td></tr>";
  h += "<tr><td>" + tip("Exchange rate") + "</td><td class='num'>" + e.exch.toFixed(1) + "</td></tr>";
  h += "<tr><td>Business confidence</td><td class='num'>" + (e.confidence * 100).toFixed(0) + "</td></tr>";
  h += "<tr><td>" + tip("Current account") + "</td><td class='num'>" + money(g, f.X - f.M) + "</td></tr>";
  h += "</table></td></tr></table>";

  h += "<h2>GDP by production (sectors)</h2><table class='data full'><tr><th>Sector</th><th class='num'>Gross value added</th><th class='num'>Share</th><th class='num'>Jobs (thousands)</th><th class='num'>Avg wage (k)</th><th class='num'>Output index</th></tr>";
  var gva = 0;
  for (var i = 0; i < f.sectors.length; i++) {
    var s = f.sectors[i]; gva += s.gva;
    h += "<tr><td>" + s.name + "</td><td class='num'>" + money(g, s.gva) + "</td><td class='num'>" + pct(s.gva / f.Y) + "</td><td class='num'>" + Math.round(s.jobs * 1000) + "</td><td class='num'>" + s.wage.toFixed(1) + "</td><td class='num'>" + (s.mod * 100).toFixed(0) + "</td></tr>";
  }
  h += "<tr><td>+ product taxes (VAT, excise, tariffs, carbon)</td><td class='num'>" + money(g, f.productTaxes) + "</td><td colspan=4></td></tr>";
  h += "<tr><td>- subsidies</td><td class='num'>" + money(g, -f.subsidies) + "</td><td colspan=4></td></tr>";
  h += "<tr class='total'><td>GDP by production</td><td class='num'>" + money(g, f.gdpProduction) + "</td><td colspan=4>Difference from expenditure measure: " + pct((f.gdpProduction - f.Y) / f.Y, 3) + " (must be under 0.5%)</td></tr></table>";

  h += "<h2>Jobs and wages</h2><table class='data'>";
  h += "<tr><td>" + tip("Labour force") + "</td><td class='num'>" + (e.labourForce * 1000).toFixed(0) + "k</td></tr>";
  h += "<tr><td>Employed</td><td class='num'>" + (e.employed * 1000).toFixed(0) + "k</td></tr>";
  h += "<tr><td>Unemployed</td><td class='num'>" + ((e.labourForce - e.employed) * 1000).toFixed(0) + "k</td></tr>";
  h += "<tr><td>" + tip("Unemployment") + "</td><td class='num'>" + pct(now.u) + "</td></tr>";
  h += "<tr><td>Participation rate (working age)</td><td class='num'>" + pct(e.labourForce / (totalPop(g) * (1 - g.pop.old - g.pop.young))) + "</td></tr>";
  h += "<tr><td>Average wage</td><td class='num'>" + g.country.symbol + " " + e.wage.toFixed(1) + "k / yr</td></tr>";
  h += "<tr><td>Output per worker (real)</td><td class='num'>" + e.prod.toFixed(1) + "k</td></tr>";
  h += "<tr><td>Minimum wage</td><td class='num'>" + (g.policies.minwage.active ? g.policies.minwage.value + "% of median" : "none") + "</td></tr>";
  h += "</table>";

  h += "<h2>Regional comparison</h2>" + regionTable(g);

  h += "<h2>Charts</h2>";
  h += "<table><tr><td><b>Real GDP (bn)</b><br><canvas class='chart' id='c_gdp' width=330 height=150></canvas></td>";
  h += "<td><b>Inflation and policy rate (%)</b><br><canvas class='chart' id='c_inf' width=330 height=150></canvas></td></tr>";
  h += "<tr><td><b>Unemployment (%)</b><br><canvas class='chart' id='c_u' width=330 height=150></canvas></td>";
  h += "<td><b>Exports and imports (bn)</b><br><canvas class='chart' id='c_trade' width=330 height=150></canvas></td></tr></table>";
  h += legendHtml([{ label: "Inflation / Exports", color: "#C8102E" }, { label: "Policy rate / Imports", color: "#17345B", dash: true }]);
  afterRender.push(function () {
    var hs = g.history.slice(-156), xs = hs.map(function (x) { return x.w; });
    drawChart("c_gdp", xs, [{ color: "#17345B", values: hs.map(function (x) { return x.realGdp; }) }]);
    drawChart("c_inf", xs, [{ color: "#C8102E", values: hs.map(function (x) { return x.infl * 100; }) }, { color: "#17345B", dash: true, values: hs.map(function (x) { return x.rate * 100; }) }]);
    drawChart("c_u", xs, [{ color: "#17345B", values: hs.map(function (x) { return x.u * 100; }) }]);
    drawChart("c_trade", xs, [{ color: "#C8102E", values: hs.map(function (x) { return x.why ? x.why.gdp["Exports"] : null; }) }, { color: "#17345B", dash: true, values: hs.map(function (x) { return x.why ? -x.why.gdp["Imports"] : null; }) }]);
  });
  // simple forecast
  var gr = now.growth, inf = now.infl;
  h += "<h2>Treasury forecast (next 4 quarters)</h2><p class='small'>Simple projection from current trends. A model estimate, not a promise.</p><table class='data'><tr><th>Quarter</th><th class='num'>Growth (low - high)</th><th class='num'>Inflation (low - high)</th></tr>";
  for (var q = 1; q <= 4; q++) {
    var spread = 0.004 * q;
    var gq = gr + (g.econ.growth0 - gr) * 0.2 * q, iq = inf + (0.02 - inf) * 0.15 * q;
    h += "<tr><td>Q+" + q + "</td><td class='num'>" + pct(gq - spread) + " - " + pct(gq + spread) + "</td><td class='num'>" + pct(iq - spread * 0.7) + " - " + pct(iq + spread * 0.7) + "</td></tr>";
  }
  h += "</table>";
  return h;
};

function regionTable(g) {
  var u = 1 - g.econ.employed / g.econ.labourForce;
  var totW = 0; for (var i = 0; i < g.regions.length; i++) totW += g.regions[i].pop * g.regions[i].income;
  var h = "<table class='data full'><tr><th>Region</th><th class='num'>Population</th><th class='num'>Income index</th><th class='num'>GDP</th><th class='num'>Unemployment</th><th class='num'>Gov. approval</th><th class='num'>Seats</th></tr>";
  for (var i = 0; i < g.regions.length; i++) {
    var r = g.regions[i];
    var a = 0, w = 0;
    for (var j = 0; j < g.cohorts.length; j++) { var c = g.cohorts[j]; if (c.region == i && c.age > 0) { var cw = cohortPop(g, c); a += c.approval * cw; w += cw; } }
    h += "<tr><td>" + esc(r.name) + "</td><td class='num'>" + r.pop.toFixed(2) + "m</td><td class='num'>" + r.income.toFixed(2) + "</td><td class='num'>" + money(g, g.flows.Y * r.pop * r.income / totW) + "</td><td class='num'>" + pct(u * r.unemp) + "</td><td class='num'>" + pct(a / w, 0) + "</td><td class='num'>" + r.seats + "</td></tr>";
  }
  return h + "</table>";
}

// ======================================================================
// TREASURY
// ======================================================================
PAGES.treasury = function (arg) {
  var g = game, f = g.flows;
  var h = title("Treasury and Budget");
  h += "<div class='tabs'><a href='#treasury'" + (!arg ? " class='current'" : "") + ">Accounts</a> <a href='#treasury/bill'" + (arg == "bill" ? " class='current'" : "") + ">Draft a Finance Bill</a> <a href='#treasury/debt'" + (arg == "debt" ? " class='current'" : "") + ">Debt</a></div>";
  if (!arg) {
    h += "<p>Annual rates at this week's levels. <a href='#why/revenue/12'>Why did revenue change?</a> | <a href='#why/spending/12'>Why did spending change?</a></p>";
    h += "<table width='100%'><tr><td valign=top width='50%'><h2>Revenue</h2><table class='data full'>";
    for (var k in f.revenue) h += "<tr><td>" + k + "</td><td class='num'>" + money(g, f.revenue[k]) + "</td><td class='num'>" + pct(f.revenue[k] / f.Y) + "</td></tr>";
    h += "<tr class='total'><td>Total revenue</td><td class='num'>" + money(g, f.revTotal) + "</td><td class='num'>" + pct(f.revTotal / f.Y) + "</td></tr></table>";
    h += "</td><td valign=top><h2>Spending</h2><table class='data full'>";
    for (var k in f.spending) {
      var over = k == "Unemployment and family benefits" && f.welfareActual > g.budget.lines.welfare * 1.02 ? " <span class='bad' title='Spending above the appropriation because more people are claiming'>(overspend " + money(g, f.welfareActual - g.budget.lines.welfare) + ")</span>" : "";
      h += "<tr><td>" + k + over + "</td><td class='num'>" + money(g, f.spending[k]) + "</td><td class='num'>" + pct(f.spending[k] / f.Y) + "</td></tr>";
    }
    h += "<tr class='total'><td>Total spending</td><td class='num'>" + money(g, f.spendTotal) + "</td><td class='num'>" + pct(f.spendTotal / f.Y) + "</td></tr></table></td></tr></table>";
    h += "<table class='data'><tr class='total'><td>" + tip("Budget balance") + " (revenue - spending)</td><td class='num " + (f.balance < 0 ? "bad" : "good") + "'>" + money(g, f.balance) + " (" + pct(f.balance / f.Y) + " of GDP)</td></tr>";
    h += "<tr><td>" + tip("Primary balance") + "</td><td class='num'>" + money(g, f.primary) + "</td></tr>";
    h += "<tr><td>Gross debt</td><td class='num'>" + money(g, totalDebt(g)) + " (" + pct(totalDebt(g) / f.Y, 0) + " of GDP)</td></tr></table>";
    h += "<h2>Monthly cash flow (last 12 months)</h2><table class='data full'><tr><th>Month ending</th><th class='num'>Revenue</th><th class='num'>Spending</th><th class='num'>Balance</th><th class='num'>Debt</th></tr>";
    var ms = g.accounts.months.slice(-12).reverse();
    for (var i = 0; i < ms.length; i++) h += "<tr><td>" + weekDate(g, ms[i].week) + "</td><td class='num'>" + money(g, ms[i].revenue) + "</td><td class='num'>" + money(g, ms[i].spending) + "</td><td class='num'>" + money(g, ms[i].balance) + "</td><td class='num'>" + money(g, ms[i].debt) + "</td></tr>";
    if (!ms.length) h += "<tr><td colspan=5>The first monthly accounts are published in week 5.</td></tr>";
    h += "</table>";
    h += "<h2>Finance bills</h2>" + billTable(g, g.bills.filter(function (b) { return b.type == "finance"; }).reverse());
  }
  if (arg == "bill") {
    h += "<p>Change any tax rate or spending line, then preview. Values are annual. Spending lines rise automatically with average pay each week (the \"baseline budget\"); the numbers here are today's levels.</p>";
    h += "<table width='100%'><tr><td valign=top><h2>Taxes</h2><table class='data'><tr><th>Tax</th><th class='num'>Now</th><th>New</th><th>Range</th></tr>";
    for (var k in TAX_INFO) h += "<tr><td>" + TAX_INFO[k].name + "</td><td class='num'>" + g.taxes[k] + "</td><td><input type='number' step='any' id='tx_" + k + "' value='" + g.taxes[k] + "'> " + TAX_INFO[k].unit + "</td><td class='small'>" + TAX_INFO[k].min + "-" + TAX_INFO[k].max + "</td></tr>";
    h += "</table></td><td valign=top><h2>Spending (bn per year)</h2><table class='data'><tr><th>Line</th><th class='num'>Now</th><th>New</th></tr>";
    for (var i = 0; i < SPENDING_LINES.length; i++) {
      var L = SPENDING_LINES[i];
      h += "<tr><td>" + L.name + "</td><td class='num'>" + g.budget.lines[L.id].toFixed(2) + "</td><td><input type='number' step='0.1' id='sp_" + L.id + "' value='" + g.budget.lines[L.id].toFixed(2) + "'></td></tr>";
    }
    h += "</table></td></tr></table>";
    h += "<p>Bill title: <input type='text' id='fb_title' value='Finance Bill " + weekYear(g) + "' size=30> <button onclick='financePreview()'>Preview and check &raquo;</button></p>";
    h += "<div id='preview'></div>";
  }
  if (arg == "debt") {
    h += "<h2>Debt instruments</h2><table class='data full'><tr><th>Instrument</th><th class='num'>Outstanding</th><th class='num'>Average rate</th><th class='num'>Annual interest</th><th class='num'>Refinanced per year</th></tr>";
    for (var i = 0; i < g.debt.instruments.length; i++) {
      var d = g.debt.instruments[i];
      h += "<tr><td>" + d.name + "</td><td class='num'>" + money(g, d.amount) + "</td><td class='num'>" + pct(d.rate, 2) + "</td><td class='num'>" + money(g, d.amount * d.rate) + "</td><td class='num'>" + money(g, d.amount / d.years) + "</td></tr>";
    }
    h += "<tr class='total'><td>Total</td><td class='num'>" + money(g, totalDebt(g)) + "</td><td></td><td class='num'>" + money(g, f.interest) + "</td><td></td></tr></table>";
    h += "<p>Market risk premium on our debt: <b>" + pct(g.debt.riskPremium, 2) + "</b>. Markets charge more when debt is over 90% of GDP or the deficit is over 3%. New borrowing goes into short-term bills and is gradually moved into bonds.</p>";
    h += "<canvas class='chart' id='c_debt' width=600 height=170></canvas><div class='small'>Debt as % of GDP</div>";
    afterRender.push(function () { var hs = g.history.slice(-260); drawChart("c_debt", hs.map(function (x) { return x.w; }), [{ color: "#17345B", values: hs.map(function (x) { return x.debtRatio * 100; }) }]); });
  }
  return h;
};

function financePreview() {
  var g = game, ch = [];
  for (var k in TAX_INFO) {
    var v = parseFloat($("tx_" + k).value);
    if (v != g.taxes[k]) ch.push({ kind: "tax", id: k, name: TAX_INFO[k].name, from: g.taxes[k], to: v, min: TAX_INFO[k].min, max: TAX_INFO[k].max, unit: TAX_INFO[k].unit });
  }
  for (var i = 0; i < SPENDING_LINES.length; i++) {
    var L = SPENDING_LINES[i];
    var v = parseFloat($("sp_" + L.id).value);
    if (Math.abs(v - g.budget.lines[L.id]) > 0.005) ch.push({ kind: "spend", id: L.id, name: L.name, from: g.budget.lines[L.id], to: v, min: 0, max: g.flows.Y * 0.5, unit: "bn" });
  }
  if (!ch.length) { alert("You haven't changed anything."); return; }
  draft = { title: $("fb_title").value || "Finance Bill", type: "finance", ministry: "finance", changes: ch };
  showPreview();
}

// ======================================================================
// POPULATION
// ======================================================================
PAGES.population = function (arg) {
  var g = game, f = g.flows, now = g.history[g.history.length - 1];
  var h = title("Population and Society");
  var P = totalPop(g);
  h += "<h2>Population</h2><table class='data'>";
  h += "<tr><td>" + tip("Population") + "</td><td class='num'>" + P.toFixed(3) + "m</td></tr>";
  h += "<tr><td>Age 0-17 / 18-64 / 65+</td><td class='num'>" + pct(g.pop.young) + " / " + pct(1 - g.pop.young - g.pop.old) + " / " + pct(g.pop.old) + "</td></tr>";
  h += "<tr><td>Births per year</td><td class='num'>" + Math.round(g.pop.births * 52 * 1000) + "k</td></tr>";
  h += "<tr><td>Deaths per year</td><td class='num'>" + Math.round(g.pop.deaths * 52 * 1000) + "k</td></tr>";
  h += "<tr><td>Immigration per year</td><td class='num'>" + Math.round(g.pop.immig * 52 * 1000) + "k</td></tr>";
  h += "<tr><td>Emigration per year</td><td class='num'>" + Math.round(g.pop.emig * 52 * 1000) + "k</td></tr>";
  h += "<tr><td>Life expectancy (estimate)</td><td class='num'>" + (79 + (g.services.health.access - g.services.health.access0) * 20 - (g.template == "B" ? 4 : 0)).toFixed(1) + " years</td></tr>";
  h += "<tr><td>Households (estimate)</td><td class='num'>" + (P / 2.3).toFixed(2) + "m</td></tr>";
  h += "</table>";
  h += "<h2>Income distribution (per adult per year)</h2><table class='data full'><tr><th>Income group</th><th class='num'>Wages</th><th class='num'>Capital income</th><th class='num'>Benefits and pensions</th><th class='num'>Income tax</th><th class='num'>Social insurance</th><th class='num'>Disposable income</th><th class='num'>vs a year ago (real)</th></tr>";
  var A = adults(g) * 0.2;
  var old = histAgo(g, 52);
  for (var i = 0; i < 5; i++) {
    var q = f.q[i];
    var realChange = old ? (q.disp / A / g.econ.price) / (old.qdisp[i] / (old.cpi / 100)) - 1 : null;
    h += "<tr><td>" + ["Poorest 20%", "Second 20%", "Middle 20%", "Fourth 20%", "Richest 20%"][i] + "</td><td class='num'>" + (q.wage / A).toFixed(1) + "k</td><td class='num'>" + (q.cap / A).toFixed(1) + "k</td><td class='num'>" + (q.transfers / A).toFixed(1) + "k</td><td class='num'>-" + (q.incomeTax / A).toFixed(1) + "k</td><td class='num'>-" + (q.payroll / A).toFixed(1) + "k</td><td class='num'><b>" + (q.disp / A).toFixed(1) + "k</b></td><td class='num'>" + (realChange === null ? "-" : pct(realChange)) + "</td></tr>";
  }
  h += "</table>";
  h += "<table class='data'><tr><td>" + tip("Poverty rate") + "</td><td class='num'><a href='#chart/poverty'>" + pct(now.poverty) + "</a></td></tr><tr><td>" + tip("Gini") + "</td><td class='num'><a href='#chart/gini'>" + (now.gini * 100).toFixed(1) + "</a></td></tr>";
  h += "<tr><td>Housing affordability (rent as % of median income)</td><td class='num'>" + (28 + (g.policies.rentcap.active ? -(10 - g.policies.rentcap.value) * 0.5 : 0) + (g.budget.lines.housing / g.budget.lines0.housing < 1 ? 3 : 0)).toFixed(1) + "%</td></tr>";
  h += "<tr><td>School access</td><td class='num'>" + pct(g.services.education.access) + "</td></tr><tr><td>Health access</td><td class='num'>" + pct(g.services.health.access) + "</td></tr></table>";

  // cohorts
  var r = parseInt(arg) || 0;
  h += "<h2>Demographic cohorts - approval of the government</h2><p>Region: ";
  for (var i = 0; i < g.regions.length; i++) h += (i == r ? "<b>" + esc(g.regions[i].name) + "</b>" : "<a href='#population/" + i + "'>" + esc(g.regions[i].name) + "</a>") + " | ";
  h += "</p><table class='data full'><tr><th>Age</th><th class='num'>Poorest 20%</th><th class='num'>Second</th><th class='num'>Middle</th><th class='num'>Fourth</th><th class='num'>Richest 20%</th></tr>";
  for (var a = 1; a < 3; a++) {
    h += "<tr><td>" + AGE_NAMES[a] + "</td>";
    for (var q = 0; q < 5; q++) {
      var c = cohortFor(g, r, a, q);
      var biggest = "", bv = 0;
      for (var k in c.factors) if (k != "Ideology" && Math.abs(c.factors[k]) > Math.abs(bv)) { bv = c.factors[k]; biggest = k; }
      h += "<td class='num' title='Biggest factor: " + biggest + " (" + (bv * 100).toFixed(1) + " pts)'>" + pct(c.approval, 0) + " <span class='small'>" + (Math.abs(bv) > 0.01 ? (bv > 0 ? "+" : "-") + biggest.toLowerCase() : "") + "</span></td>";
    }
    h += "</tr>";
  }
  h += "</table><p class='small'>Under-18s are counted in the population but don't vote. Hover a cell to see its biggest reason. " + g.cohorts.length + " cohorts in total (" + g.regions.length + " regions x 3 age bands x 5 income groups).</p>";
  return h;
};

function cohortFor(g, r, a, q) { for (var i = 0; i < g.cohorts.length; i++) { var c = g.cohorts[i]; if (c.region == r && c.age == a && c.q == q) return c; } }

// ======================================================================
// PUBLIC SERVICES
// ======================================================================
PAGES.services = function (arg) {
  var g = game;
  var id = arg || "health";
  var h = title("Public Services");
  h += "<div class='tabs'>";
  for (var i = 0; i < SERVICES.length; i++) h += "<a href='#services/" + SERVICES[i].id + "'" + (SERVICES[i].id == id ? " class='current'" : "") + ">" + SERVICES[i].name + "</a> ";
  h += "</div>";
  var def = null; for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id == id) def = SERVICES[i];
  var s = g.services[id];
  var min = minister(g, id == "police" ? "interior" : id);
  h += "<p>Capacity depends on <b>staff</b> (who take time to recruit) and <b>equipment and buildings</b>. Building a hospital without staff doesn't create capacity. Minister: " + esc(min.name) + " (competence " + Math.round(min.competence * 100) + ").</p>";
  h += "<table class='data'>";
  h += "<tr><td>Funding (annual)</td><td class='num'>" + money(g, g.budget.lines[def.line]) + (id == "health" && g.flows.programmes.staff ? " + staffing programme " + money(g, g.flows.programmes.staff) : "") + "</td></tr>";
  h += "<tr><td>Staff</td><td class='num'>" + Math.round(s.staff * 1000).toLocaleString() + "</td></tr>";
  h += "<tr><td>Staff the budget can pay for</td><td class='num'>" + Math.round(s.staffTarget * 1000).toLocaleString() + (s.staffTarget > s.staff * 1.005 ? " <span class='small'>(recruiting)</span>" : (s.staffTarget < s.staff * 0.995 ? " <span class='small bad'>(redundancies)</span>" : "")) + "</td></tr>";
  h += "<tr><td>Equipment and buildings index</td><td class='num'>" + (s.equip * 100).toFixed(1) + "</td></tr>";
  h += "<tr><td>Capacity (" + def.unit + ", millions/yr)</td><td class='num'>" + s.capacity.toFixed(3) + "</td></tr>";
  h += "<tr><td>Demand</td><td class='num'>" + s.demand.toFixed(3) + "</td></tr>";
  h += "<tr><td>Access (share of demand served)</td><td class='num " + (s.access < 0.9 ? "bad" : "") + "'>" + pct(s.access) + "</td></tr>";
  h += "<tr><td>Quality index</td><td class='num'>" + s.quality.toFixed(0) + "/100</td></tr>";
  h += "<tr><td>Backlog (millions)</td><td class='num'>" + s.backlog.toFixed(3) + "</td></tr>";
  if (id == "health") h += "<tr><td>" + tip("Waiting time") + "</td><td class='num'><a href='#chart/wait'>" + s.wait.toFixed(1) + " weeks</a></td></tr>";
  if (id == "police") h += "<tr><td>Recorded crime</td><td class='num'><a href='#chart/crime'>" + g.crime.toFixed(1) + " per 1000</a></td></tr>";
  if (id == "transport") h += "<tr><td>Rail operations</td><td class='num'>" + (g.flags.railPrivate ? "Private" : "Public") + "</td></tr>";
  h += "</table>";
  if (id == "health") {
    h += "<p><a href='#why/health/12'>Why did health capacity change?</a> | <a href='#law/composer'>Start a hospital staffing programme</a> | <a href='#treasury/bill'>Change the health budget</a></p>";
    h += "<canvas class='chart' id='c_h' width=600 height=170></canvas>" + legendHtml([{ label: "Capacity", color: "#17345B" }, { label: "Demand", color: "#C8102E", dash: true }]);
    afterRender.push(function () { var hs = g.history.slice(-156); drawChart("c_h", hs.map(function (x) { return x.w; }), [{ color: "#17345B", values: hs.map(function (x) { return x.healthCap; }) }, { color: "#C8102E", dash: true, values: hs.map(function (x) { return x.healthDemand; }) }]); });
  }
  h += "<h2>All services</h2><table class='data full'><tr><th>Service</th><th class='num'>Funding</th><th class='num'>Staff</th><th class='num'>Access</th><th class='num'>Quality</th></tr>";
  for (var i = 0; i < SERVICES.length; i++) { var d = SERVICES[i], x = g.services[d.id]; h += "<tr><td><a href='#services/" + d.id + "'>" + d.name + "</a></td><td class='num'>" + money(g, g.budget.lines[d.line]) + "</td><td class='num'>" + Math.round(x.staff * 1000).toLocaleString() + "</td><td class='num'>" + pct(x.access) + "</td><td class='num'>" + x.quality.toFixed(0) + "</td></tr>"; }
  h += "<tr><td>Courts and prisons</td><td class='num'>" + money(g, g.budget.lines.justice) + "</td><td colspan=3 class='small'>Case backlog grows when crime rises faster than the courts budget.</td></tr>";
  h += "<tr><td>Housing and local government</td><td class='num'>" + money(g, g.budget.lines.housing) + "</td><td colspan=3 class='small'>Affects construction and housing affordability.</td></tr>";
  h += "<tr><td>Pensions and benefits</td><td class='num'>" + money(g, g.budget.lines.pensions + g.flows.welfareActual) + "</td><td colspan=3 class='small'>See Population for who receives them.</td></tr>";
  return h + "</table>";
};

// ======================================================================
// ELECTIONS
// ======================================================================
PAGES.elections = function (arg) {
  var g = game;
  var h = title("Elections and Parties");
  var due = g.politics.snapElection || g.politics.nextElection;
  if (!electionsHeld(g)) h += "<div class='notice'>The constitution does not hold elections. Polls below are what people <i>would</i> vote. To bring elections back, <a href='#law/amend'>amend the constitution</a>.</div>";
  else if (g.constitution.elections == "restricted") h += "<div class='notice'>Elections are tilted toward the government. You'll probably win, but each one costs legitimacy and annoys democracies abroad.</div>";
  if (electionsHeld(g)) h += "<p>Next " + (g.politics.snapElection ? "<b>snap</b> " : "") + "general election: <b>" + weekDate(g, due) + "</b> (" + (due - g.week) + " weeks). System: " + electionSystemName(g.constitution.electionSystem) + ".</p>";
  h += "<h2>Opinion polls</h2>" + seatBar(g, g.parties.map(function (p) { return Math.round(p.poll * g.constitution.seats); })) + "<p class='small'>Bar shows what a uniform proportional result would look like.</p>";
  h += "<table class='data'><tr><th>Party</th><th class='num'>Poll</th><th class='num'>Seats now</th><th>Leader</th><th class='num'>Members</th></tr>";
  for (var i = 0; i < g.parties.length; i++) { var p = g.parties[i]; h += "<tr><td><span style='color:" + p.color + "'>&#9632;</span> " + esc(p.name) + "</td><td class='num'>" + pct(p.poll) + "</td><td class='num'>" + p.seats + "</td><td>" + esc(p.leader) + "</td><td class='num'>" + p.members.toLocaleString() + "</td></tr>"; }
  h += "</table>";
  h += "<canvas class='chart' id='c_polls' width=600 height=180></canvas>";
  h += "<div class='small'>" + g.parties.map(function (p, i) { return "<span style='color:" + p.color + "'>&#9632;&#9632;</span> " + esc(p.name); }).join(" &nbsp; ") + "</div>";
  afterRender.push(function () {
    var hs = g.history.slice(-104);
    drawChart("c_polls", hs.map(function (x) { return x.w; }), g.parties.map(function (p, i) { return { color: p.color, values: hs.map(function (x) { return x.polls[i] * 100; }) }; }), { zero: true });
  });
  h += "<h2>Past elections</h2>";
  if (!g.politics.elections.length) h += "<p>No elections yet in this game.</p>";
  for (var e = g.politics.elections.length - 1; e >= 0; e--) {
    var el = g.politics.elections[e];
    h += "<h3>" + el.date + ": " + esc(el.text) + "</h3>";
    h += "<p class='small'>Turnout " + pct(el.turnout) + ". Government approval on polling day " + pct(el.approval, 0) + "." + (el.runoff ? " Presidential run-off: you " + pct(el.runoff.player) + " vs " + esc(el.runoff.opponent) + " " + pct(1 - el.runoff.player) + "." : "") + "</p>";
    h += "<table class='data'><tr><th>Party</th><th class='num'>Vote</th><th class='num'>Seats</th><th class='num'>Change</th></tr>";
    for (var i = 0; i < el.parties.length; i++) h += "<tr><td>" + esc(el.parties[i]) + "</td><td class='num'>" + pct(el.shares[i]) + "</td><td class='num'>" + el.seats[i] + "</td><td class='num'>" + (el.seats[i] - el.oldSeats[i] >= 0 ? "+" : "") + (el.seats[i] - el.oldSeats[i]) + "</td></tr>";
    h += "</table>";
    h += "<b>Constituency / regional results</b><table class='data'><tr><th>Region</th>" + el.parties.map(function (p) { return "<th class='num'>" + esc(p) + "</th>"; }).join("") + "</tr>";
    for (var r = 0; r < el.regions.length; r++) {
      h += "<tr><td>" + esc(el.regions[r].region) + "</td>";
      for (var i = 0; i < el.parties.length; i++) h += "<td class='num'>" + pct(el.regions[r].shares[i], 0) + (el.regions[r].seats ? " (" + el.regions[r].seats[i] + ")" : "") + "</td>";
      h += "</tr>";
    }
    h += "</table><p><b>Why this result?</b> Main drivers of government approval: " + el.drivers.map(function (d) { return d[0] + " (" + (d[1] >= 0 ? "+" : "") + (d[1] * 100).toFixed(1) + " pts)"; }).join(", ") + ".</p>";
  }
  return h;
};

// ======================================================================
// REGIONS
// ======================================================================
PAGES.regions = function () {
  var g = game;
  var h = title("Regions") + regionTable(g);
  h += "<h2>Latest regional polling</h2><table class='data full'><tr><th>Region</th>" + g.parties.map(function (p) { return "<th class='num'>" + esc(p.name) + "</th>"; }).join("") + "</tr>";
  for (var r = 0; r < g.regions.length; r++) {
    var sh = nationalShares(g, r);
    h += "<tr><td>" + esc(g.regions[r].name) + "</td>" + sh.map(function (s) { return "<td class='num'>" + pct(s, 0) + "</td>"; }).join("") + "</tr>";
  }
  h += "</table>";
  var evs = g.events.filter(function (e) { return e.region !== null; }).slice(-10).reverse();
  h += "<h2>Recent regional events</h2><ul>";
  for (var i = 0; i < evs.length; i++) h += "<li>" + evs[i].date + ": <a href='#event/" + evs[i].id + "'>" + esc(evs[i].title) + "</a></li>";
  if (!evs.length) h += "<li>None.</li>";
  return h + "</ul>";
};

// ======================================================================
// FOREIGN AFFAIRS
// ======================================================================
var lastOffer = null;
PAGES.foreign = function () {
  var g = game;
  var h = title("Foreign Affairs");
  h += "<p>12 foreign states. Each has its own interests and decides for itself. Better relations and offers that match their interests are more likely to be accepted. Minister: " + esc(minister(g, "foreign").name) + ".</p>";
  // map (very simple)
  h += "<div class='box'><b>World map</b> <span class='small'>(not to scale - circle size = GDP, colour = relations)</span><br><svg width='100%' height='150' viewBox='0 0 600 150' role='img' aria-label='Map of foreign states'>";
  h += "<rect x='270' y='60' width='60' height='30' fill='#17345B'/><text x='300' y='79' fill='#fff' font-size='10' text-anchor='middle'>US</text>";
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    var ang = i / g.foreign.length * Math.PI * 2;
    var x = 300 + Math.cos(ang) * 250, y = 75 + Math.sin(ang) * 60;
    var col = f.relation > 60 ? "#2E8B57" : (f.relation > 35 ? "#C8A400" : "#C8102E");
    h += "<a href='#foreign'><circle cx='" + x + "' cy='" + y + "' r='" + (4 + Math.sqrt(f.gdp) / 6) + "' fill='" + col + "' opacity='0.8'/><text x='" + x + "' y='" + (y + 3) + "' font-size='9' text-anchor='middle'>" + f.name + "</text></a>";
  }
  h += "</svg></div>";
  h += "<table class='data full'><tr><th>Country</th><th>Government</th><th>Leader</th><th class='num'>Population</th><th class='num'>GDP</th><th class='num'>Military</th><th class='num'>Trade share</th><th>Interest</th><th class='num'>Relations</th><th>Treaties</th></tr>";
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    h += "<tr><td><b>" + f.name + "</b>" + (f.sanctioned ? " <span class='bad'>[SANCTIONED]</span>" : "") + "</td><td>" + f.gov + "</td><td>" + esc(f.leader) + "</td><td class='num'>" + f.pop + "m</td><td class='num'>" + Math.round(f.gdp) + "bn</td><td class='num'>" + f.military + "</td><td class='num'>" + pct(f.trade, 0) + "</td><td>" + f.interest + "</td>";
    h += "<td class='num'>" + Math.round(f.relation) + " <span class='bar' style='width:" + Math.round(f.relation / 2) + "px'></span></td><td class='small'>" + (f.treaties.map(treatyName).join(", ") || "-") + "</td></tr>";
  }
  h += "</table>";
  // inbox
  var open = g.offers.filter(function (o) { return o.status == "open"; });
  h += "<h2>Negotiation inbox</h2>";
  if (!open.length) h += "<p class='small'>No offers waiting.</p>";
  for (var i = 0; i < open.length; i++) {
    var o = open[i], f = countryById(o.from);
    h += "<div class='box'><b>" + f.name + "</b> proposes a <b>" + treatyName(o.treaty) + "</b> (received " + weekDate(g, o.week) + "). " + treatyDesc(o.treaty) + "<br><button onclick='answerOffer(\"" + o.id + "\",true)'>Accept</button> <button onclick='answerOffer(\"" + o.id + "\",false)'>Decline</button></div>";
  }
  h += "<h2>Make an offer</h2><table class='data'><tr><th>Country</th><td><select id='fo_c'>";
  for (var i = 0; i < g.foreign.length; i++) h += "<option value='" + g.foreign[i].id + "'>" + g.foreign[i].name + "</option>";
  h += "</select></td></tr><tr><th>Treaty / action</th><td><select id='fo_t'>";
  for (var i = 0; i < TREATIES.length; i++) h += "<option value='" + TREATIES[i].id + "'>" + TREATIES[i].name + " - " + TREATIES[i].desc + "</option>";
  h += "</select></td></tr></table><button onclick='sendOffer()'>Send offer</button>";
  if (lastOffer) {
    var r = lastOffer.r;
    h += "<div class='" + (r.result == "accept" ? "notice" : "alert") + "'><b>" + countryById(lastOffer.c).name + " " + (r.result == "accept" ? "ACCEPTS" : (r.result == "counter" ? "MAKES A COUNTER-OFFER" : "REJECTS")) + "</b>: " + r.reasons.join(" ");
    if (r.result == "counter") h += "<br><button onclick='acceptCounter()'>Accept counter-offer (pay " + r.counter + "bn aid)</button>";
    h += "</div>";
  }
  return h;
};

function treatyDesc(id) { for (var i = 0; i < TREATIES.length; i++) if (TREATIES[i].id == id) return TREATIES[i].desc; return ""; }

function sendOffer() {
  var c = $("fo_c").value, t = $("fo_t").value;
  if (t == "sanctions" && !confirm("Impose sanctions on " + countryById(c).name + "? This cuts trade with them and hurts relations badly.")) return;
  var r = evaluateOffer(game, c, t);
  lastOffer = { c: c, t: t, r: r };
  game.commandLog.push({ week: game.week, cmd: "offer", country: c, treaty: t, result: r.result });
  if (r.result == "accept") makeTreaty(game, c, t, 0);
  else if (r.result == "reject") countryById(c).relation -= 2;
  autosave();
  route();
}
function acceptCounter() {
  makeTreaty(game, lastOffer.c, lastOffer.t, lastOffer.r.counter);
  lastOffer = null;
  autosave();
  route();
}
function answerOffer(id, yes) {
  var o = null;
  for (var i = 0; i < game.offers.length; i++) if (game.offers[i].id == id) o = game.offers[i];
  o.status = yes ? "accepted" : "declined";
  if (yes) makeTreaty(game, o.from, o.treaty, 0); else countryById(o.from).relation -= 3;
  game.commandLog.push({ week: game.week, cmd: "answerOffer", offer: id, accepted: yes });
  autosave();
  route();
}

// ======================================================================
// DEFENCE
// ======================================================================
PAGES.defence = function () {
  var g = game, d = g.defence;
  var h = title("Defence and Security");
  h += "<table class='data'><tr><td>" + tip("Army loyalty") + "</td><td class='num'><a href='#chart/loyalty'>" + Math.round(d.loyalty) + "/100</a></td></tr><tr><td>Military strength (ours)</td><td class='num'>" + Math.round(ourStrength(g)) + "</td></tr></table>";
  h += "<table class='data'><tr><td>" + tip("Readiness") + "</td><td class='num'><a href='#chart/readiness'>" + d.readiness.toFixed(0) + "/100</a></td></tr>";
  h += "<tr><td>Defence budget</td><td class='num'>" + money(g, g.budget.lines.defence) + " (" + pct(g.budget.lines.defence / g.flows.Y) + " of GDP)</td></tr>";
  h += "<tr><td>Conscription</td><td class='num'>" + (g.policies.conscription.active ? g.policies.conscription.value + " months" : "none") + "</td></tr>";
  h += "<tr><td>Minister</td><td>" + esc(minister(g, "defence").name) + " (competence " + Math.round(minister(g, "defence").competence * 100) + ")</td></tr></table>";
  h += "<h2>Service branches</h2><table class='data full'><tr><th>Branch</th><th class='num'>Personnel</th><th class='num'>Equipment condition</th></tr>";
  for (var i = 0; i < d.branches.length; i++) h += "<tr><td>" + d.branches[i].name + "</td><td class='num'>" + Math.round(d.branches[i].personnel * 1000 * (1 + (g.policies.conscription.active ? g.policies.conscription.value * 0.03 : 0))).toLocaleString() + "</td><td class='num'>" + d.branches[i].equipment.toFixed(0) + "/100</td></tr>";
  h += "</table><p class='small'>Readiness follows funding, training, conscription and the minister's competence. Equipment wears out if procurement and maintenance are underfunded. Change the budget on the <a href='#treasury/bill'>Treasury</a> page.</p>";
  h += "<h2>Security situation</h2><table class='data full'><tr><th>Country</th><th class='num'>Military strength</th><th class='num'>Relations</th><th>Assessment</th></tr>";
  for (var i = 0; i < g.foreign.length; i++) {
    var f = g.foreign[i];
    var threat = f.military > 45 && f.relation < 35 ? "<span class='bad'>Possible threat</span>" : (f.treaties.indexOf("defence") >= 0 ? "<span class='good'>Ally</span>" : (f.treaties.indexOf("nonaggression") >= 0 ? "Non-aggression pact" : "-"));
    h += "<tr><td>" + f.name + "</td><td class='num'>" + f.military + "</td><td class='num'>" + Math.round(f.relation) + "</td><td>" + threat + "</td></tr>";
  }
  h += "</table>";
  h += "<h2>Intelligence, borders and cyber</h2><p>Border security and intelligence are funded from the Police and Defence lines. Recorded crime: " + g.crime.toFixed(1) + " per 1000. ";
  h += "Cyber readiness: " + Math.round(40 + (minister(g, "digital").competence - 0.5) * 40 + (d.readiness - 55) * 0.3) + "/100.</p>";
  h += warRoomHtml(g);
  return h;
};

// ======================================================================
// NEWS
// ======================================================================
PAGES.news = function (arg) {
  var g = game;
  var filt = {};
  if (arg) arg.split("&").forEach(function (kv) { var p = kv.split("="); filt[p[0]] = p[1]; });
  var h = title("Media and News");
  h += "<p>Outlet: <a href='#news'>All</a>";
  for (var i = 0; i < OUTLETS.length; i++) h += " | " + (filt.outlet == OUTLETS[i].id ? "<b>" + OUTLETS[i].name + "</b>" : "<a href='#news/outlet=" + OUTLETS[i].id + "'>" + OUTLETS[i].name + "</a>");
  h += "<br>Topic: ";
  var topics = { economy: ["gdp", "inflation", "jobs", "rate", "world", "creditShock", "energyShock"], politics: ["billPass", "billFail", "lawInForce", "poll", "election", "coalition", "confidence", "campaign", "scandal", "appointment", "referendum"], society: ["protest", "strike", "waiting", "healthEmergency", "disaster", "census", "pensions"], world: ["treaty", "offer", "border"] };
  for (var k in topics) h += (filt.topic == k ? "<b>" + k + "</b>" : "<a href='#news/topic=" + k + "'>" + k + "</a>") + " | ";
  h += " Region: ";
  for (var i = 0; i < g.regions.length; i++) h += "<a href='#news/region=" + i + "'>" + esc(g.regions[i].name) + "</a> | ";
  h += "</p>";
  var arts = g.news.filter(function (a) {
    if (filt.outlet && a.outlet != filt.outlet) return false;
    if (filt.topic && topics[filt.topic].indexOf(a.type) < 0) return false;
    if (filt.region !== undefined && String(a.region) != filt.region) return false;
    return true;
  }).reverse().slice(0, 40);
  if (!arts.length) h += "<p>No stories match.</p>";
  for (var i = 0; i < arts.length; i++) {
    var a = arts[i];
    h += "<div class='article'><span class='outletname'>" + outletName(a.outlet) + " &middot; " + a.date + "</span><br><span class='hl'><a href='#article/" + a.id + "'>" + esc(a.headline) + "</a></span><br><span class='small'>" + esc(a.body.slice(0, 160)) + "...</span></div>";
  }
  h += "<h2>The outlets</h2><table class='data full'><tr><th>Outlet</th><th>Type</th><th class='num'>Leaning</th><th>Reliability</th><th class='num'>Sensationalism</th></tr>";
  for (var i = 0; i < OUTLETS.length; i++) { var o = OUTLETS[i]; h += "<tr><td>" + o.name + "</td><td>" + o.type + "</td><td class='num'>" + (o.lean < 40 ? "Left" : o.lean > 60 ? "Right" : "Centre") + " (" + o.lean + ")</td><td>" + o.reliability + "</td><td class='num'>" + Math.round(o.sensational * 100) + "%</td></tr>"; }
  h += "</table><p class='small'>Articles are written from structured event records. Outlets can spin the same facts differently but cannot change them. Every article links to its source event.</p>";
  return h;
};

PAGES.article = function (id) {
  var g = game, a = null;
  for (var i = 0; i < g.news.length; i++) if (g.news[i].id == id) a = g.news[i];
  if (!a) return title("Article not found") + "<p>It may have been archived. <a href='#news'>Back to news</a></p>";
  var o = null; for (var i = 0; i < OUTLETS.length; i++) if (OUTLETS[i].id == a.outlet) o = OUTLETS[i];
  var h = "<div class='outletname'>" + o.name + " &middot; " + o.type + " &middot; " + a.date + "</div>";
  h += "<h1>" + esc(a.headline) + "</h1>";
  h += "<p style='font-family:Georgia,serif;font-size:14px;line-height:1.5'>" + esc(a.body) + "</p>";
  h += "<div class='box small'>Editorial tone: " + a.tone + ". Outlet reliability: " + a.reliability + ". Source event: <a href='#event/" + a.event + "'>" + a.event + "</a>. Written by the deterministic template writer (no AI used).</div>";
  h += "<p><a href='#news'>&laquo; Back to news</a></p>";
  return h;
};

PAGES.event = function (id) {
  var g = game, ev = null;
  for (var i = 0; i < g.events.length; i++) if (g.events[i].id == id) ev = g.events[i];
  if (!ev) return title("Event not found");
  var h = title("Event record " + ev.id);
  h += "<table class='data'><tr><th>Event</th><td>" + esc(ev.title) + "</td></tr><tr><th>Type</th><td>" + ev.type + "</td></tr><tr><th>Severity</th><td>" + ["", "Low", "Medium", "High"][ev.severity] + (ev.urgent ? " - URGENT" : "") + "</td></tr>";
  h += "<tr><th>Date</th><td>" + ev.date + " (week " + ev.week + ")</td></tr>";
  if (ev.region !== null) h += "<tr><th>Location</th><td>" + esc(g.regions[ev.region].name) + "</td></tr>";
  h += "<tr><th>Cause</th><td>" + esc(ev.cause) + "</td></tr>";
  if (ev.bill) h += "<tr><th>Triggered by</th><td><a href='#bill/" + ev.bill + "'>Bill " + ev.bill + "</a></td></tr>";
  h += "<tr><th>For the government</th><td>" + (ev.valence > 0 ? "Good news" : ev.valence < 0 ? "Bad news" : "Neutral") + "</td></tr>";
  h += "</table><h2>Verified facts</h2><table class='data'>";
  for (var k in ev.facts) h += "<tr><th>" + niceKey(k) + "</th><td>" + esc(ev.facts[k]) + "</td></tr>";
  h += "</table><h2>Coverage</h2><ul>";
  var arts = g.news.filter(function (a) { return a.event == ev.id; });
  for (var i = 0; i < arts.length; i++) h += "<li>" + outletName(arts[i].outlet) + ": <a href='#article/" + arts[i].id + "'>" + esc(arts[i].headline) + "</a> (" + arts[i].tone + ")</li>";
  if (!arts.length) h += "<li>Not covered by any outlet.</li>";
  return h + "</ul>";
};

// ======================================================================
// STATISTICS, CHARTS, WHY
// ======================================================================
PAGES.stats = function () {
  var g = game, now = g.history[g.history.length - 1];
  var h = title("National Statistics Office");
  h += "<table class='data full'><tr><th>Indicator</th><th class='num'>Now</th><th class='num'>Last month</th><th class='num'>Last quarter</th><th class='num'>Last year</th><th class='num'>Start of game</th><th></th></tr>";
  for (var i = 0; i < INDICATORS.length; i++) {
    var ind = INDICATORS[i];
    var cells = [4, 13, 52].map(function (n) { var x = histAgo(g, n); return "<td class='num'>" + (x ? ind.fmt(x[ind.key]) : "-") + "</td>"; }).join("");
    h += "<tr><td>" + tip(ind.name) + "</td><td class='num'><b>" + ind.fmt(now[ind.key]) + "</b></td>" + cells + "<td class='num'>" + ind.fmt(g.history[0][ind.key]) + "</td><td><a href='#chart/" + ind.key + "'>graph</a>" + (ind.why ? " | <a href='#why/" + ind.why + "/13'>why</a>" : "") + "</td></tr>";
  }
  h += "</table>";
  h += "<h2>Quarterly national accounts</h2><table class='data full'><tr><th>Quarter</th><th class='num'>Consumption</th><th class='num'>Government</th><th class='num'>Investment</th><th class='num'>Exports</th><th class='num'>Imports</th><th class='num'>GDP (expenditure)</th><th class='num'>GDP (production)</th><th class='num'>Diff.</th></tr>";
  var qs = g.accounts.quarters.slice().reverse();
  for (var i = 0; i < qs.length; i++) { var q = qs[i]; h += "<tr><td>" + q.date + "</td><td class='num'>" + q.C.toFixed(1) + "</td><td class='num'>" + q.G.toFixed(1) + "</td><td class='num'>" + q.I.toFixed(1) + "</td><td class='num'>" + q.X.toFixed(1) + "</td><td class='num'>" + q.M.toFixed(1) + "</td><td class='num'>" + q.Y.toFixed(1) + "</td><td class='num'>" + q.production.toFixed(1) + "</td><td class='num'>" + pct((q.production - q.Y) / q.Y, 3) + "</td></tr>"; }
  if (!qs.length) h += "<tr><td colspan=9>First quarterly accounts in week 14.</td></tr>";
  h += "</table><p class='small'>Annual rates, billions. The two GDP measures must agree within 0.5% or the turn is rejected.</p>";
  h += "<h2>Historical baseline (before you took office)</h2><table class='data'><tr><th>Year</th><th class='num'>GDP</th><th class='num'>Growth</th><th class='num'>Inflation</th><th class='num'>Unemployment</th><th class='num'>Debt/GDP</th><th class='num'>Balance/GDP</th></tr>";
  for (var i = 0; i < g.baseline.length; i++) { var b = g.baseline[i]; h += "<tr><td>" + b.year + "</td><td class='num'>" + money(g, b.gdp) + "</td><td class='num'>" + pct(b.growth) + "</td><td class='num'>" + pct(b.infl) + "</td><td class='num'>" + pct(b.unemp) + "</td><td class='num'>" + pct(b.debtRatio, 0) + "</td><td class='num'>" + pct(b.balance) + "</td></tr>"; }
  return h + "</table>";
};

PAGES.chart = function (key) {
  var g = game, ind = indicator(key) || INDICATORS[0];
  var h = title(ind.name);
  h += "<p>" + esc(GLOSSARY[ind.name] || "") + "</p>";
  var range = 156;
  h += "<canvas class='chart' id='c_big' width=700 height=260></canvas>";
  afterRender.push(function () { var hs = g.history.slice(-range); drawChart("c_big", hs.map(function (x) { return x.w; }), [{ color: "#17345B", values: hs.map(function (x) { return x[ind.key]; }) }], { fmt: function (v) { return ind.fmt(v).replace(g.country.symbol + " ", ""); } }); });
  var now = g.history[g.history.length - 1];
  h += "<table class='data'><tr><th>Now</th><td class='num'>" + ind.fmt(now[ind.key]) + "</td></tr>";
  [1, 4, 13, 52].forEach(function (n) { var x = histAgo(g, n); if (x) h += "<tr><th>" + n + " week" + (n > 1 ? "s" : "") + " ago</th><td class='num'>" + ind.fmt(x[ind.key]) + "</td></tr>"; });
  h += "</table>";
  if (ind.why) h += "<p>Why did it change? <a href='#why/" + ind.why + "/1'>last week</a> | <a href='#why/" + ind.why + "/4'>last 4 weeks</a> | <a href='#why/" + ind.why + "/12'>last 12 weeks</a> | <a href='#why/" + ind.why + "/52'>last year</a></p>";
  h += "<p><a href='#stats'>All statistics</a></p>";
  return h;
};

var WHY_NAMES = { revenue: "Government revenue", spending: "Government spending", disp: "Average disposable income (per adult, k)", health: "Health capacity", approval: "Government approval", infl: "Inflation", u: "Unemployment", gdp: "GDP" };

PAGES.why = function (arg) {
  var g = game;
  var parts = arg.split("/"), key = parts[0], n = parseInt(parts[1]) || 4;
  var rep = whyReport(g, key, n);
  var h = title("Why did this change? " + (WHY_NAMES[key] || key));
  h += "<p>Comparing <b>" + weekDate(g, rep.from) + "</b> with <b>" + weekDate(g, rep.to) + "</b>. Period: <a href='#why/" + key + "/1'>1 week</a> | <a href='#why/" + key + "/4'>4 weeks</a> | <a href='#why/" + key + "/12'>12 weeks</a> | <a href='#why/" + key + "/52'>52 weeks</a></p>";
  // the headline number
  var then = histAgo(g, n) || g.history[0], now = g.history[g.history.length - 1];
  var headKey = { revenue: "rev", spending: "bal", disp: "disp", health: "healthCap", approval: "approval", infl: "infl", u: "u", gdp: "gdp" }[key];
  var ind = indicator(headKey);
  if (ind) h += "<table class='data'><tr><th>" + ind.name + " before</th><td class='num'>" + ind.fmt(then[headKey]) + "</td><th>after</th><td class='num'><b>" + ind.fmt(now[headKey]) + "</b></td></tr></table>";
  if (key == "spending") h += "<p class='small'>The budget balance is revenue minus spending. Spending items are shown below; see also <a href='#why/revenue/" + n + "'>revenue</a>.</p>";
  h += "<h2>Direct causes</h2><table class='data full'><tr><th>Component</th><th class='num'>Before</th><th class='num'>After</th><th class='num'>Change</th><th>Effect</th></tr>";
  var isFactor = key == "approval" || key == "infl";
  for (var i = 0; i < rep.rows.length; i++) {
    var r = rep.rows[i];
    var f = isFactor ? function (v) { return (v * 100).toFixed(2) + (key == "approval" ? " pts" : "%"); } : function (v) { return Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(1); };
    var w = Math.min(120, Math.abs(r.change) / (Math.abs(rep.rows[0].change) || 1) * 120);
    h += "<tr><td>" + esc(r.name) + "</td><td class='num'>" + f(r.before) + "</td><td class='num'>" + f(r.after) + "</td><td class='num'>" + (r.change >= 0 ? "+" : "") + f(r.change) + "</td><td><span class='bar' style='width:" + w + "px;background:" + (r.change >= 0 ? "#2E8B57" : "#C8102E") + "'></span> " + (r.change >= 0 ? "up" : "down") + "</td></tr>";
  }
  h += "</table>";
  if (key == "approval") h += "<p class='small'>Approval components are pressures on each group's opinion (in percentage points). Opinion moves about 8% of the way toward where these pressures point each week, so changes show up gradually.</p>";
  if (key == "infl") h += "<p class='small'>Inflation moves toward expected inflation + demand pressure + energy prices + one-off price changes (like VAT). The policy rate is set by the central bank in response.</p>";
  if (key == "health") h += "<p class='small'>Capacity = staff x treatments per staff member x equipment index. Staff can only be recruited at about 0.2-0.6% a week.</p>";
  h += "<h2>Relevant government actions</h2><ul>";
  for (var i = 0; i < rep.actions.length; i++) h += "<li>" + weekDate(g, rep.actions[i].week) + ": " + (rep.actions[i].bill ? "<a href='#bill/" + rep.actions[i].bill + "'>" + esc(rep.actions[i].title) + "</a> came into force" : esc(rep.actions[i].title)) + "</li>";
  if (!rep.actions.length) h += "<li>None in this period.</li>";
  h += "</ul><h2>Relevant outside events</h2><ul>";
  for (var i = 0; i < rep.events.length; i++) h += "<li>" + rep.events[i].date + ": <a href='#event/" + rep.events[i].id + "'>" + esc(rep.events[i].title) + "</a></li>";
  if (!rep.events.length) h += "<li>None in this period.</li>";
  h += "</ul><p class='small'>Uncertainty: these are model estimates. Indirect effects (for example tax changes affecting spending, which affects jobs) show up in the components above over time.</p>";
  return h;
};

// ======================================================================
// ARCHIVE
// ======================================================================
PAGES.archive = function (arg) {
  var g = game;
  var q = "", type = "";
  if (arg) arg.split("&").forEach(function (kv) { var p = kv.split("="); if (p[0] == "q") q = decodeURIComponent(p[1] || ""); if (p[0] == "type") type = p[1]; });
  var h = title("Historical Archive");
  h += "<p>Search: <input type='text' id='ar_q' value='" + esc(q) + "'> Type: <select id='ar_t'><option value=''>all</option>";
  var types = {}; for (var i = 0; i < g.events.length; i++) types[g.events[i].type] = 1;
  for (var t in types) h += "<option" + (t == type ? " selected" : "") + ">" + t + "</option>";
  h += "</select> <button onclick='go(\"archive/q=\"+encodeURIComponent($(\"ar_q\").value)+\"&type=\"+$(\"ar_t\").value)'>Search</button></p>";
  var evs = g.events.filter(function (e) { return (!type || e.type == type) && (!q || e.title.toLowerCase().indexOf(q.toLowerCase()) >= 0); }).reverse().slice(0, 150);
  h += "<h2>Events (" + evs.length + " shown)</h2><table class='data full'><tr><th>ID</th><th>Date</th><th>Type</th><th>Event</th></tr>";
  for (var i = 0; i < evs.length; i++) h += "<tr><td>" + evs[i].id + "</td><td>" + evs[i].date + "</td><td>" + evs[i].type + "</td><td><a href='#event/" + evs[i].id + "'>" + esc(evs[i].title) + "</a></td></tr>";
  h += "</table>";
  h += "<h2>All bills</h2>" + billTable(g, g.bills.slice().reverse());
  h += "<h2>Elections</h2><ul>";
  for (var i = 0; i < g.politics.elections.length; i++) h += "<li>" + g.politics.elections[i].date + ": " + esc(g.politics.elections[i].text) + " (<a href='#elections'>details</a>)</li>";
  if (!g.politics.elections.length) h += "<li>None yet.</li>";
  h += "</ul><h2>Treaties</h2><ul>";
  var tr = g.events.filter(function (e) { return e.type == "treaty"; });
  for (var i = 0; i < tr.length; i++) h += "<li>" + tr[i].date + ": " + esc(tr[i].title) + "</li>";
  if (!tr.length) h += "<li>None yet.</li>";
  h += "</ul><h2>Player action log</h2><table class='data full'><tr><th>Week</th><th>Action</th></tr>";
  for (var i = g.commandLog.length - 1; i >= 0; i--) { var c = g.commandLog[i]; h += "<tr><td>" + weekDate(g, c.week) + "</td><td>" + esc(c.cmd == "submitBill" ? "Submitted bill " + c.bill + ": " + c.title : (c.cmd == "savepoint" ? "Savepoint: " + c.name : (c.cmd == "offer" ? "Offered " + treatyName(c.treaty) + " to " + countryById(c.country).name + " (" + c.result + ")" : commandText(c)))) + "</td></tr>"; }
  if (!g.commandLog.length) h += "<tr><td colspan=2>Nothing yet.</td></tr>";
  return h + "</table>";
};

// ======================================================================
// SETTINGS + SAVES
// ======================================================================
PAGES.settings = function () {
  var h = title("Settings and Save Games");
  if (game) {
    h += "<h2>Save slots</h2><table class='data full'><tr><th>Slot</th><th>Name</th><th>Country</th><th>Week</th><th>Saved</th><th></th></tr>";
    for (var n = 1; n <= 10; n++) {
      var raw = null; try { raw = localStorage.getItem("ngs_slot_" + n); } catch (e) { }
      var s = raw ? JSON.parse(raw) : null;
      h += "<tr><td>" + n + "</td><td>" + (s ? esc(s.name) : "<i>empty</i>") + "</td><td>" + (s ? esc(s.country) : "") + "</td><td>" + (s ? s.week : "") + "</td><td class='small'>" + (s ? esc(s.saved.slice(0, 24)) : "") + "</td><td>";
      h += "<button onclick='saveSlot(" + n + ", prompt(\"Name for this save (e.g. before the budget):\", \"Week " + game.week + "\"))'>Save here</button> ";
      if (s) h += "<button onclick='if(confirm(\"Load this save? Unsaved progress will be lost (the autosave is kept).\"))loadSlot(\"ngs_slot_" + n + "\")'>Load</button> <button onclick='deleteSlot(" + n + ")'>Delete</button>";
      h += "</td></tr>";
    }
    h += "</table><p class='small'>The game also autosaves after every turn. Saves live in this browser only - use Export to keep a copy.</p>";
    h += "<h2>Export / import</h2><p><button onclick='exportSave()'>Export current game to a file</button> &nbsp; Import: <input type='file' accept='.json' onchange='importSave(this)'></p>";
    h += "<h2>Reproduce the last turn</h2><p>Re-runs the last week from the saved state, commands and random seed, and checks the result is identical. <button onclick='replayCheck()'>Run replay check</button></p>";
    h += "<h2>Game information</h2><table class='data'><tr><th>Simulation version</th><td>" + game.version + "</td></tr><tr><th>Content version</th><td>" + game.contentVersion + "</td></tr><tr><th>Template</th><td>" + game.template + "</td></tr><tr><th>Difficulty</th><td>" + game.difficulty + "</td></tr><tr><th>Random seed</th><td>" + game.rng.seed + "</td></tr><tr><th>Random draws so far</th><td>" + game.rng.draws + "</td></tr><tr><th>Actions logged</th><td>" + game.commandLog.length + "</td></tr><tr><th>Save size</th><td>" + Math.round(JSON.stringify(game).length / 1024) + " KB</td></tr></table>";
  } else {
    h += "<p>No game running.</p>";
    var raw = localStorage.getItem("ngs_autosave");
    if (raw) h += "<p><button onclick='loadSlot(\"ngs_autosave\")'>Load autosave</button></p>";
    for (var n = 1; n <= 10; n++) { var r = localStorage.getItem("ngs_slot_" + n); if (r) { var s = JSON.parse(r); h += "<p><button onclick='loadSlot(\"ngs_slot_" + n + "\")'>Load slot " + n + "</button> " + esc(s.name) + " - " + esc(s.country) + ", week " + s.week + "</p>"; } }
    h += "<p>Import: <input type='file' accept='.json' onchange='importSave(this)'></p>";
  }
  h += "<h2>New game</h2><p><a href='#newgame'>Start a new game</a> (your current game stays in the autosave until you start).</p>";
  return h;
};

PAGES.glossary = function () {
  var h = title("Glossary") + "<table class='data full'>";
  for (var k in GLOSSARY) h += "<tr><th>" + k + "</th><td>" + GLOSSARY[k] + "</td></tr>";
  return h + "</table>";
};

PAGES.help = function () {
  var h = title("How to play");
  h += "<ol><li><b>Read the dashboard.</b> It shows the main numbers and how they changed. Click any number for its history.</li>";
  h += "<li><b>Change taxes and spending</b> on the <a href='#treasury/bill'>Treasury</a> page. You get a preview with the cost and five checks: legal, fiscal, admin, economic and political.</li>";
  h += "<li><b>Send bills to parliament.</b> First vote next week, then a one-week amendment window, then the final vote. Laws come into force the week after.</li>";
  h += "<li><b>Make policies</b> with the <a href='#law/composer'>policy composer</a>: minimum wage, rent controls, hospital staffing, nationalisation, conscription and more.</li>";
  h += "<li><b>Advance time</b> one week at a time (or press N), or 4/13 weeks at once. Fast-forward stops for urgent events.</li>";
  h += "<li><b>Read the results</b>: news, reports, polls. Use <i>why?</i> links to see the causes behind a change.</li>";
  h += "<li><b>Win elections.</b> Keep your coalition partners happy (Parliament page) and voters on side (Population page shows approval by group).</li></ol>";
  h += "<h2>Your kind of state</h2><p>On the New Game page you can build any kind of country: a parliamentary democracy, a one-party state, an absolute monarchy, a military junta or your own mix. The <a href='#law'>constitution</a> decides how laws are made. In a democracy bills need votes and you must win elections. If you rule by decree, laws pass straight away, but you have to watch <b>legitimacy</b>, <b>unrest</b> and <b>army loyalty</b>. Let unrest boil over and you get riots or a revolution. Let the army go unpaid and you may face a coup. You can change the constitution during the game on the <a href='#law/amend'>amendment</a> page.</p>";
  h += "<h2>War</h2><p>The <a href='#defence'>Defence</a> page shows the war room. Weak neighbours with bad relations can attack you, and you can declare war yourself. Strength comes from the defence budget, readiness, equipment, conscription, the minister and allies. Offer peace when the front line favours you.</p>";
  h += "<h2>The rules</h2><p>Simulation rules decide what happens. Text only explains it. The same save, decisions and random seed always produce the same result (try the replay check in Settings). Every turn is checked: GDP measured two ways must match, revenue minus spending must equal the balance, debt and population must add up. If not, the turn is thrown away.</p>";
  h += "<h2>Keyboard</h2><p>Tab moves between links and buttons. N advances one week.</p>";
  return h;
};
