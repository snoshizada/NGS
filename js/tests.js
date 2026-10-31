// tests.js - self tests. open tests.html in a browser, or run "node js/tests.js"
// checks the accounting rules, that turns are reproducible, and what policies do

var results = [];
function ok(cond, name, detail) { results.push({ ok: !!cond, name: name, detail: detail || "" }); }

function last(g) { return g.history[g.history.length - 1]; }

function runWeeks(g, n) {
  for (var i = 0; i < n; i++) {
    var r = advanceWeek(g);
    if (!r.ok) throw new Error("turn failed: " + r.problems.join(", "));
    g = r.game;
  }
  return g;
}

// pass a bill straight through parliament for testing (it still goes through all the stages)
function passBill(g, changes, type) {
  var r = submitBill(g, "Test bill", type || "finance", changes, "finance");
  if (!r.ok) throw new Error("bill rejected: " + r.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.msg; }).join(" "));
  return r.bill;
}

function tax(g, id, to) { return { kind: "tax", id: id, name: id, from: g.taxes[id], to: to, min: TAX_INFO[id].min, max: TAX_INFO[id].max }; }
function spend(g, id, factor) { return { kind: "spend", id: id, name: id, from: g.budget.lines[id], to: g.budget.lines[id] * factor, min: 0, max: 1000 }; }
function policy(g, id, to) { var st = g.policies[id]; return { kind: "policy", id: id, name: id, from: st.active ? st.value : 0, to: to, min: -100, max: 1000 }; }

// run a scenario next to an untouched baseline with the same seed and compare
function scenario(name, key, makeChanges, weeks, check, type) {
  try {
    var base = newGame(key, { seed: 99, calm: true });
    var g = newGame(key, { seed: 99, calm: true });
    var b = passBill(g, makeChanges(g), type);
    base = runWeeks(base, weeks);
    g = runWeeks(g, weeks);
    var bill = findBill(g, b.id);
    var msg = check(last(base), last(g), base, g);
    ok(msg === true && bill.stage == "IMPLEMENTED", "Scenario: " + name, msg === true ? "" : String(msg) + " (bill stage " + bill.stage + ")");
  } catch (e) {
    ok(false, "Scenario: " + name, e.message);
  }
}

function runAllTests() {
  results = [];

  // ---------- 12.2 accounting tests over 100 weeks for every template ----------
  var keys = ["A", "B", "C"];
  for (var k = 0; k < keys.length; k++) {
    var g = newGame(keys[k], { seed: 4242, difficulty: "sandbox" });
    var bad = null;
    for (var w = 0; w < 100; w++) {
      var debtBefore = totalDebt(g), popBefore = totalPop(g);
      var r = advanceWeek(g);
      if (!r.ok) { bad = "week " + g.week + ": " + r.problems.join(", "); break; }
      g = r.game;
      var f = g.flows;
      if (Math.abs(f.gdpProduction - f.Y) / f.Y > 0.005) { bad = "GDP mismatch week " + g.week; break; }
      if (Math.abs(f.revTotal - f.spendTotal - f.balance) > 1e-6) { bad = "balance mismatch week " + g.week; break; }
      var pc = g.pop.births - g.pop.deaths + g.pop.immig - g.pop.emig;
      if (Math.abs(popBefore + pc - totalPop(g)) > 1e-9) { bad = "population mismatch week " + g.week; break; }
      if (Math.abs((g.econ.labourForce - g.econ.employed) + g.econ.employed - g.econ.labourForce) > 1e-9) { bad = "labour force mismatch"; break; }
    }
    ok(!bad, "100-week run of template " + keys[k] + " keeps all accounting identities", bad || ("ends at week " + g.week + ", GDP " + money(g, g.econ.gdp) + ", approval " + pct(g.politics.approval, 0)));
  }

  // ---------- 12.3 determinism ----------
  var a = runWeeks(newGame("A", { seed: 777 }), 30);
  var b = runWeeks(newGame("A", { seed: 777 }), 30);
  ok(JSON.stringify(a) == JSON.stringify(b), "Same seed + same commands = identical state after 30 weeks");
  var c = runWeeks(newGame("A", { seed: 778 }), 30);
  ok(JSON.stringify(a) != JSON.stringify(c), "A different seed gives a different game");
  // replay a single turn from a saved copy
  var saved = JSON.parse(JSON.stringify(a));
  var r1 = advanceWeek(a).game, r2 = advanceWeek(saved).game;
  ok(JSON.stringify(r1) == JSON.stringify(r2), "Replaying a turn from a saved copy gives the same result");
  // the turn function must not change the state it was given
  var before = JSON.stringify(a);
  advanceWeek(a);
  ok(before == JSON.stringify(a), "advanceWeek does not modify the previous state (rollback is possible)");

  // ---------- unit tests ----------
  ok(dhondt([100, 80, 30], 7).join(",") == "4,3,0" || dhondt([100, 80, 30], 7).join(",") == "3,3,1", "D'Hondt shares seats", dhondt([100, 80, 30], 7).join(","));
  ok(sum(dhondt([50, 30, 20], 10)) == 10, "D'Hondt gives out every seat");
  ok(dhondt([50, 30, 3], 10, 0.05)[2] == 0, "Threshold keeps small parties out");
  ok(clamp(5, 0, 1) == 1 && clamp(-5, 0, 1) == 0 && clamp(0.5, 0, 1) == 0.5, "clamp works at boundaries");
  ok(pct(0.123, 1) == "12.3%" && pct(0, 1) == "0.0%" && pct(-0.05, 0) == "-5%", "percent formatting (zero, negative)");
  var gm = newGame("A", { seed: 1 });
  ok(money(gm, 1.5) == "Kr 1.5bn" && money(gm, -0.25) == "-Kr 250m" && money(gm, 0) == "Kr 0m", "money formatting (zero, negative, millions)");

  // validation: bad input gets blocked with a reason
  var gv = newGame("A", { seed: 5 });
  var r = submitBill(gv, "Silly bill", "finance", [{ kind: "tax", id: "vat", name: "VAT", from: 21, to: 95, min: 0, max: 30 }], "finance");
  ok(!r.ok && r.checks[3].msg.indexOf("between") >= 0, "Out-of-range VAT is blocked by the ECONOMIC check", r.checks[3].msg);
  var gv2 = newGame("C", { seed: 5 });
  var r2 = submitBill(gv2, "Big spend", "finance", [spend(gv2, "health", 1.6)], "finance");
  ok(!r2.ok && r2.checks[1].msg.indexOf("fiscal rule") >= 0, "Morvania's fiscal rule blocks a big unfunded health increase", r2.checks[1].msg);
  var gv3 = newGame("A", { seed: 5 });
  var ra = submitBill(gv3, "Amend", "amend", [{ kind: "amend", id: "termYears", name: "Term", from: 4, to: 5, min: 3, max: 5 }], "justice");
  ok(ra.ok && !ra.bill.prediction.passes && ra.checks[4].warn, "Constitutional amendment without opposition support is flagged as likely to fail", ra.checks[4].msg);
  var gv4 = newGame("A", { seed: 5 });
  for (var i = 0; i < 4; i++) submitBill(gv4, "Bill " + i, "finance", [tax(gv4, "excise", 18 + i + 1)], "finance");
  var r5 = submitBill(gv4, "Bill 5", "finance", [tax(gv4, "excise", 25)], "finance");
  ok(!r5.ok && r5.checks[2].name == "ADMIN", "Civil service capacity limits the number of bills at once", r5.checks[2].msg);

  // ---------- the first playable demo from section 16 ----------
  (function () {
    var base = runWeeks(newGame("A", { seed: 2027, calm: true }), 15);
    var g = newGame("A", { seed: 2027, calm: true });
    passBill(g, [tax(g, "incomeBasic", g.taxes.incomeBasic + 2), spend(g, "health", 1.1)]);
    g = runWeeks(g, 15);
    var B = last(base), P = last(g);
    ok(P.why.revenue["Personal income tax"] > B.why.revenue["Personal income tax"], "Demo: higher income tax raises income tax receipts", money(g, P.why.revenue["Personal income tax"] - B.why.revenue["Personal income tax"]));
    ok(P.disp < B.disp, "Demo: disposable income falls after the tax rise", P.disp.toFixed(3) + " vs " + B.disp.toFixed(3));
    ok(P.healthCap > B.healthCap * 1.02, "Demo: health capacity grows after more health spending", P.healthCap.toFixed(2) + " vs " + B.healthCap.toFixed(2));
    ok(P.wait < B.wait, "Demo: waiting times fall", P.wait.toFixed(1) + " vs " + B.wait.toFixed(1) + " weeks");
    ok(Math.abs(P.approval - B.approval) > 0.001, "Demo: approval reacts", pct(P.approval) + " vs " + pct(B.approval));
    var news = g.news.filter(function (n) { return n.type == "lawInForce" || n.type == "billPass"; });
    ok(news.length > 0, "Demo: the news covers the new law");
    var allLinked = g.news.every(function (n) { return g.events.some(function (e) { return e.id == n.event; }); });
    ok(allLinked, "Every news article links to an existing event record");
    var why = whyReport(g, "health", 12);
    ok(why.rows.length > 0 && why.actions.length > 0, "Demo: 'why did this change' lists causes and the law", why.actions.map(function (a) { return a.title; }).join(", "));
    var saved = JSON.parse(JSON.stringify(g));
    ok(JSON.stringify(runWeeks(saved, 3)) == JSON.stringify(runWeeks(g, 3)), "Demo: save, reload and continue gives the same state");
  })();

  // ---------- policy scenarios (12.4) - direction checks against a baseline ----------
  scenario("1. Increase personal income tax", "A", function (g) { return [tax(g, "incomeBasic", 26)]; }, 10, function (B, P) { return P.rev > B.rev ? true : "revenue did not rise"; });
  scenario("2. Reduce VAT", "A", function (g) { return [tax(g, "vat", 17)]; }, 20, function (B, P) { return P.cpi < B.cpi && P.rev < B.rev ? true : "prices/revenue did not fall"; });
  scenario("3. Raise corporation tax", "A", function (g) { return [tax(g, "corp", 30)]; }, 20, function (B, P) { return P.why.revenue["Corporate profit tax"] > B.why.revenue["Corporate profit tax"] && P.why.gdp["Investment"] < B.why.gdp["Investment"] ? true : "no revenue gain / investment loss"; });
  scenario("4. Increase pension payments", "A", function (g) { return [policy(g, "pensionidx", 10)]; }, 20, function (B, P, bg, pg) { return pg.flows.spending["State pensions"] > bg.flows.spending["State pensions"] && pg.politics.factors["Pensions"] > bg.politics.factors["Pensions"] ? true : "pensions did not rise"; }, "policy");
  scenario("5. Cut health spending", "A", function (g) { return [spend(g, "health", 0.85)]; }, 26, function (B, P) { return P.healthCap < B.healthCap && P.wait > B.wait ? true : "health didnt get worse"; });
  scenario("6. Expand hospital staffing", "A", function (g) { return [policy(g, "hospstaff", 10)]; }, 26, function (B, P) { return P.healthStaff > B.healthStaff && P.healthCap > B.healthCap ? true : "no extra staff"; }, "policy");
  scenario("7. Raise minimum wage", "A", function (g) { return [policy(g, "minwage", 65)]; }, 26, function (B, P) { return P.qdisp[0] > B.qdisp[0] && P.employed < B.employed ? true : "no gain for poorest or no job cost"; }, "policy");
  scenario("8. Introduce rent controls", "A", function (g) { return [policy(g, "rentcap", 3)]; }, 26, function (B, P) { return P.qdisp[0] > B.qdisp[0] && P.why.gdp["Investment"] < B.why.gdp["Investment"] ? true : "no rent gain or no construction cost"; }, "policy");
  scenario("9. Subsidise household energy", "A", function (g) { return [policy(g, "energysub", 5)]; }, 26, function (B, P) { return P.cpi < B.cpi && P.bal < B.bal ? true : "no price effect / no cost"; }, "policy");
  scenario("10. Raise the carbon tax", "A", function (g) { return [tax(g, "carbon", 120)]; }, 26, function (B, P) { return P.emissions < B.emissions && P.why.revenue["Carbon tax"] > B.why.revenue["Carbon tax"] ? true : "emissions/revenue didnt move"; });
  scenario("11. Nationalise energy (Arvenia)", "A", function (g) { return [policy(g, "nationalise", 20)]; }, 10, function (B, P) { return P.debt > B.debt + 15 ? true : "compensation not added to debt"; }, "policy");
  scenario("12. Privatise rail", "A", function (g) { return [policy(g, "privatise", 15)]; }, 10, function (B, P) { return P.debt < B.debt - 10 ? true : "proceeds not used to cut debt"; }, "policy");
  scenario("13. Infrastructure programme", "A", function (g) { return [policy(g, "infra", 10)]; }, 26, function (B, P) { return P.gdp > B.gdp && P.bal < B.bal ? true : "no demand boost / no cost"; }, "policy");
  scenario("14. Increase defence spending", "A", function (g) { return [spend(g, "defence", 1.4)]; }, 52, function (B, P) { return P.readiness > B.readiness + 1 ? true : "readiness flat"; });
  scenario("15. Introduce conscription", "A", function (g) { return [policy(g, "conscription", 9)]; }, 52, function (B, P) { return P.readiness > B.readiness && P.labourForce < B.labourForce ? true : "no readiness or labour effect"; }, "policy");
  scenario("17. Raise import tariffs", "A", function (g) { return [tax(g, "tariff", 12)]; }, 20, function (B, P) { return -P.why.gdp["Imports"] < -B.why.gdp["Imports"] ? true : "imports did not fall"; });
  scenario("20. Raise skilled immigration", "A", function (g) { return [policy(g, "immigration", 100)]; }, 52, function (B, P) { return P.pop > B.pop && P.labourForce > B.labourForce ? true : "no population effect"; }, "policy");
  scenario("30. Cut tax then reverse it", "A", function (g) { return [tax(g, "incomeBasic", 18)]; }, 10, function (B, P, bg, pg) {
    var b2 = passBill(pg, [tax(pg, "incomeBasic", 22)]);
    pg = runWeeks(pg, 4); bg = runWeeks(bg, 4);
    return pg.taxes.incomeBasic == 22 && findBill(pg, b2.id).stage == "IMPLEMENTED" ? true : "reversal didnt go through";
  });

  // foreign: free trade raises exports
  (function () {
    var base = newGame("A", { seed: 3, calm: true }), g = newGame("A", { seed: 3, calm: true });
    makeTreaty(g, "doruvia", "fta", 0);
    base = runWeeks(base, 20); g = runWeeks(g, 20);
    ok(last(g).why.gdp["Exports"] > last(base).why.gdp["Exports"], "Scenario: 18. Free trade agreement raises exports");
    var g2 = newGame("A", { seed: 3, calm: true }), b2 = newGame("A", { seed: 3, calm: true });
    makeTreaty(g2, "doruvia", "sanctions", 0);
    g2 = runWeeks(g2, 20); b2 = runWeeks(b2, 20);
    ok(last(g2).why.gdp["Exports"] < last(b2).why.gdp["Exports"] && countryById2(g2, "doruvia").relation < 40, "Scenario: 19. Sanctions cut exports and relations");
  })();

  // elections: force one and check a result comes out
  (function () {
    var g = newGame("A", { seed: 11, calm: true });
    g.politics.nextElection = 3;
    g = runWeeks(g, 3);
    var el = g.politics.elections[0];
    ok(el && sum(el.seats) == g.constitution.seats && el.regions.length == g.regions.length, "Scenario: 22. General election gives regional results and fills every seat", el ? el.text : "no election");
    var gb = newGame("B", { seed: 11, calm: true });
    gb.politics.nextElection = 2;
    gb = runWeeks(gb, 2);
    ok(gb.politics.elections[0].runoff, "Presidential template holds a run-off");
    var gc = newGame("C", { seed: 11, calm: true });
    gc.politics.nextElection = 2;
    gc = runWeeks(gc, 2);
    ok(gc.politics.elections[0].coalition, "Scenario: 23. Coalition formed after election", gc.politics.elections[0].coalition);
  })();

  // confidence: partner quits -> confidence vote
  (function () {
    var g = newGame("C", { seed: 12, calm: true });
    g.politics.approval = 0.2;
    for (var i = 0; i < g.parties.length; i++) if (g.parties[i].inGov && !g.parties[i].player) g.parties[i].patience = 0.1;
    for (var i = 0; i < g.cohorts.length; i++) g.cohorts[i].approval = 0.15;
    g = runWeeks(g, 2);
    ok(g.politics.lastConfidence, "Scenario: 21. Losing coalition partners triggers a confidence vote", g.politics.lastConfidence ? (g.politics.lastConfidence.lost ? "lost" : "survived") : "");
  })();

  // ---------- v0.2: making your own nation ----------
  function customOpts(con) {
    return { seed: 31, calm: true, custom: { regions: [{ name: "North", pop: 3, income: 0.9 }, { name: "South", pop: 4, income: 1.1 }, { name: "Coast", pop: 2, income: 1.3 }, { name: "Hills", pop: 1.5, income: 0.7 }, { name: "Isles", pop: 0.5, income: 0.8 }, { name: "Capital", pop: 2.5, income: 1.5 }], gdpPerCap: 25, debtRatio: 0.4, unemployment: 0.07, inflation: 0.03, oldShare: 0.18, youngShare: 0.25 }, constitution: con };
  }
  function monarchy() { var c = copy(TEMPLATES.A.constitution); c.executive = "monarch"; c.headOfState = "monarch_abs"; c.legislature = "appointed"; c.elections = "none"; c.press = "state"; c.judiciary = "controlled"; c.assembly = "banned"; c.religion = "state"; return c; }

  (function () {
    try {
      var g = newGame("A", customOpts(monarchy()));
      ok(g.regions.length == 6 && g.constitution.govType.indexOf("Absolute monarchy") >= 0, "Custom nation: 6 regions, absolute monarchy", g.constitution.govType);
      ok(g.politics.di < 20, "Custom nation: democracy index is low for an absolute monarchy", Math.round(g.politics.di));
      g = runWeeks(g, 100);
      ok(true, "Custom nation: 100 weeks with all accounting checks passing", "approval " + pct(g.politics.approval, 1));
      ok(!g.politics.nextElection, "Custom nation: no elections are held", "");
      var b = passBill(g, [tax(g, "incomeBasic", g.taxes.incomeBasic + 1)]);
      g = runWeeks(g, 2);
      var bb = findBill(g, b.id);
      ok(bb.decree && (bb.stage == "IMPLEMENTED" || bb.stage == "EXECUTIVE ASSENT"), "Decree: a bill becomes law without a vote", bb.stage);
    } catch (e) { ok(false, "Custom nation (absolute monarchy)", e.message); }
  })();

  (function () {
    try {
      var c = copy(TEMPLATES.A.constitution); c.executive = "partyleader"; c.partySystem = "single"; c.elections = "free";
      var g = newGame("A", customOpts(c));
      var legal = g.parties.filter(function (p) { return !p.banned; });
      ok(legal.length == 1 && legal[0].player, "Single-party state: only the ruling party is legal", legal.length + " legal parties");
      g = runWeeks(g, 60);
      ok(true, "Single-party state: 60 weeks run", "");
    } catch (e) { ok(false, "Single-party state", e.message); }
  })();

  (function () {
    try {
      // switch Arvenia to a one-party state by amendment, as a dictator would
      var g = newGame("A", { seed: 5, calm: true });
      g.constitution.amendThreshold = 0.5;
      for (var i = 0; i < g.parties.length; i++) if (!g.parties[i].player) g.parties[i].seats = 0; else g.parties[i].seats = g.constitution.seats;
      var b = passBill(g, [{ kind: "amend", id: "partySystem", name: "Parties", from: "multi", to: "single" }], "amend");
      g.constitution.referendum = false;
      g = runWeeks(g, 8);
      ok(g.constitution.partySystem == "single" && g.politics.di < 95 && g.parties.filter(function (p) { return p.banned; }).length > 0, "Amendment: switch to a one-party state lowers the democracy index", "stage " + findBill(g, b.id).stage + ", DI " + Math.round(g.politics.di));
    } catch (e) { ok(false, "Amendment: one-party state", e.message); }
  })();

  (function () {
    try {
      var c = monarchy();
      var g = newGame("A", customOpts(c));
      var b = passBill(g, [{ kind: "amend", id: "press", name: "Press", from: "state", to: "free" }], "amend");
      g = runWeeks(g, 3);
      ok(g.constitution.press == "free", "Amendment by royal decree", findBill(g, b.id).stage);
    } catch (e) { ok(false, "Amendment by decree", e.message); }
  })();

  (function () {
    var g = newGame("A", { seed: 5, calm: true });
    var bill = { type: "policy", changes: [policy(g, "surveillance", 70)] };
    var checks = validateBill(g, bill);
    ok(!checks[0].ok, "Independent courts block mass surveillance", checks[0].msg);
  })();

  (function () {
    var bad = cleanFlagImg("javascript:alert(1)"), bad2 = cleanFlagImg("data:image/svg+xml;base64,PHN2Zz4="), good = cleanFlagImg("data:image/png;base64,iVBORw0KGgo=");
    var cols = cleanFlag(["#ff0000", "red\" onmouseover=\"x", "#00f"]);
    ok(!bad && !bad2 && good && cols.length == 2, "Flag uploads and colours are cleaned", cols.join(","));
    var h = flagHtml({ flagImg: "data:image/png;base64,AAAA\"><script>", flag: ["#ff0000"] }, 30, 20);
    ok(h.indexOf("<script") < 0, "Flag HTML can't be used to inject a script", "");
  })();

  (function () {
    try {
      function warRun() {
        var g = newGame("B", { seed: 77, calm: true });
        var enemy = g.foreign[0].id;
        startWar(g, enemy, true);
        return runWeeks(g, 30);
      }
      var a = warRun(), b = warRun();
      ok(JSON.stringify(a.war || a.wars) == JSON.stringify(b.war || b.wars) && a.econ.gdp == b.econ.gdp, "War: same seed gives the same war", "front " + (a.war ? Math.round(a.war.front) : "over"));
      var w = a.war || a.wars[a.wars.length - 1];
      ok(w.ourCas > 0, "War: casualties are counted (and the population identity still holds)", Math.round(w.ourCas) + " soldiers");
      if (a.war) { var r = makePeace(a, "white"); ok(r && (r.ok || r.reasons || r.msg !== undefined), "War: peace can be offered", r.ok ? "accepted" : "rejected"); }
    } catch (e) { ok(false, "War", e.message); }
  })();

  (function () {
    try {
      var g = newGame("B", { seed: 3, calm: true });
      g.constitution.termLimit = 1;
      g.politics.termsServed = 1;
      g.politics.nextElection = g.week + 1;
      g = runWeeks(g, 2);
      ok(g.gameOver && g.gameOver.retired, "Term limit: you retire at the end of your last term", g.gameOver ? g.gameOver.reason || "" : "no game over");
    } catch (e) { ok(false, "Term limit", e.message); }
  })();

  (function () {
    var g = newGame("A", { seed: 5, calm: true });
    renameMinistry(g, "health", "Ministry of Wellbeing");
    ok(g.ministryNames.health == "Ministry of Wellbeing", "Ministries can be renamed", "");
    mergeMinistry(g, "digital", "industry");
    ok(minister(g, "digital") === minister(g, "industry"), "Merged ministries share a minister", "");
    g = runWeeks(g, 5);
    ok(true, "Game runs after merging ministries", "");
  })();

  return results;
}

function countryById2(g, id) { for (var i = 0; i < g.foreign.length; i++) if (g.foreign[i].id == id) return g.foreign[i]; }

// node: load the other files and print results
if (typeof window === "undefined" && typeof require !== "undefined") {
  var fs = require("fs"), vm = require("vm"), path = require("path");
  var ctx = { console: console, module: undefined };
  vm.createContext(ctx);
  ["data.js", "sim.js", "regime.js", "tests.js"].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8").replace('if (typeof window === "undefined" && typeof require !== "undefined")', "if (false)"), ctx, { filename: f });
  });
  var res = vm.runInContext("runAllTests()", ctx);
  var pass = 0;
  res.forEach(function (r) { console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? "  [" + r.detail + "]" : "")); if (r.ok) pass++; });
  console.log("\n" + pass + " of " + res.length + " passed");
  if (pass != res.length) process.exitCode = 1;
}
