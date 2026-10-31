// main.js - starts the game, page switching, turns and saving

var game = null;      // the whole game state lives here
var afterRender = []; // functions to run after a page is drawn (charts)
var lastSaved = null;

// stop people putting html in their country name
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function $(id) { return document.getElementById(id); }

// ---------- page switching ----------
function route() {
  var hash = location.hash.replace("#", "") || "dashboard";
  var parts = hash.split("/");
  var page = parts[0];
  var arg = parts.slice(1).join("/");
  if (!game && page != "settings" && page != "help" && page != "glossary") page = "newgame";
  if (!PAGES[page]) page = "dashboard";
  afterRender = [];
  var html = "";
  try {
    html = PAGES[page](decodeURIComponent(arg));
  } catch (err) {
    console.log(err);
    html = "<h1>Error</h1><p>Sorry, this page broke: " + esc(err.message) + "</p>";
  }
  $("main").innerHTML = html;
  for (var i = 0; i < afterRender.length; i++) afterRender[i]();
  // highlight the menu
  var links = document.querySelectorAll("#nav a");
  for (var i = 0; i < links.length; i++) links[i].className = links[i].getAttribute("href") == "#" + page ? "current" : "";
  $("crumb").innerHTML = "Home &raquo; " + esc(PAGE_TITLES[page] || page);
  drawShell();
  window.scrollTo(0, 0);
}

function go(where) {
  if (location.hash == "#" + where) route();
  else location.hash = where;
}

// header + right column
function drawShell() {
  if (!game) {
    $("countryname").innerHTML = "Nationstate";
    $("subline").innerHTML = "Nation Governance Simulator";
    $("datebox").innerHTML = "";
    $("flag").innerHTML = "";
    $("side").innerHTML = "<div class='side'><h4>WELCOME</h4><p>Start a new game or load a saved one.</p></div>";
    $("adv1").disabled = $("adv4").disabled = $("adv13").disabled = true;
    return;
  }
  var g = game;
  $("flag").innerHTML = flagHtml(g.country, 45, 30);
  $("countryname").innerHTML = esc(g.country.name);
  $("subline").innerHTML = (g.country.motto ? "<i>" + esc(g.country.motto) + "</i> | " : "") + esc(g.constitution.govType) + " | " + esc(g.constitution.title) + ": " + esc(g.leaderName) + " (" + esc(playerParty(g).name) + ")";
  $("datebox").innerHTML = "<b>Week " + g.week + "</b> - " + weekDate(g) + " (week " + weekOfYear(g) + " of " + weekYear(g) + ")";
  $("adv1").disabled = $("adv4").disabled = $("adv13").disabled = !!g.gameOver && g.difficulty != "sandbox";
  $("savestatus").innerHTML = lastSaved ? "Autosaved week " + lastSaved : "Not saved";

  var h = g.history[g.history.length - 1];
  var s = "<div class='side'>";
  s += "<h4>NATIONAL INDICATORS</h4><table>";
  s += sideRow("GDP", money(g, h.gdp), "chart/gdp");
  s += sideRow("Real growth", pct(h.growth), "chart/growth");
  s += sideRow("Inflation", pct(h.infl), "chart/infl");
  s += sideRow("Unemployment", pct(h.u), "chart/u");
  s += sideRow("Debt/GDP", pct(h.debtRatio, 0), "chart/debtRatio");
  s += sideRow("Budget balance", money(g, h.bal), "chart/bal");
  s += "</table>";
  s += "<h4>GOVERNMENT</h4><table>";
  s += sideRow("Approval", pct(h.approval, 0), "chart/approval");
  if (g.constitution.legislature != "none") s += sideRow("Majority", govSeats(g) + " / " + g.constitution.majority + " needed", "parliament");
  s += sideRow("Legitimacy", Math.round(g.politics.legitimacy) + "/100", "chart/legitimacy");
  s += sideRow("Unrest", Math.round(g.politics.unrest) + "/100", "chart/unrest");
  s += sideRow("Army loyalty", Math.round(g.defence.loyalty) + "/100", "chart/loyalty");
  s += sideRow("Democracy index", Math.round(g.politics.di) + "/100", "law");
  s += "</table>";
  if (g.war) s += "<div class='alert'><a href='#defence'>AT WAR with " + esc(countryOf(g, g.war.enemy).name) + "</a><br>Front: " + Math.round(g.war.front) + "</div>";
  s += "<h4>DEADLINES</h4><table>";
  var due = g.politics.snapElection || g.politics.nextElection;
  if (electionsHeld(g) && due) s += "<tr><td>Election</td><td>" + weekDate(g, due) + " (" + (due - g.week) + " wks)</td></tr>";
  else s += "<tr><td>Election</td><td>none held</td></tr>";
  var pending = g.bills.filter(function (b) { return b.stage == "COMMITTEE" || b.stage == "AMENDMENT WINDOW" || b.stage == "EXECUTIVE ASSENT"; });
  for (var i = 0; i < pending.length; i++) s += "<tr><td colspan=2><a href='#bill/" + pending[i].id + "'>" + esc(pending[i].title) + "</a>: " + nextStage(pending[i]) + "</td></tr>";
  if (!pending.length) s += "<tr><td colspan=2 class='small'>No bills in parliament.</td></tr>";
  s += "</table>";
  s += "<h4>HEADLINES</h4>";
  var news = g.news.slice(-5).reverse();
  for (var i = 0; i < news.length; i++) s += "<div style='margin-bottom:3px'><a href='#article/" + news[i].id + "'>" + esc(news[i].headline) + "</a> <span class='small'>" + outletName(news[i].outlet) + "</span></div>";
  s += "<h4>RISKS</h4>" + risksHtml(g);
  s += "</div>";
  $("side").innerHTML = s;
}

function sideRow(name, val, link) {
  return "<tr><td><span class='tip' title='" + esc(GLOSSARY[name] || "") + "'>" + name + "</span></td><td align=right><a href='#" + link + "'>" + val + "</a></td></tr>";
}

function nextStage(b) {
  if (b.stage == "COMMITTEE") return "first vote next week";
  if (b.stage == "AMENDMENT WINDOW") return "final vote next week";
  if (b.stage == "EXECUTIVE ASSENT") return "in force next week";
  return b.stage.toLowerCase();
}

function outletName(id) { for (var i = 0; i < OUTLETS.length; i++) if (OUTLETS[i].id == id) return OUTLETS[i].name; return id; }

function risksHtml(g) {
  var r = [];
  var h = g.history[g.history.length - 1];
  if (h.approval < 0.35) r.push("Government approval is low (" + pct(h.approval, 0) + ")");
  if (govSeats(g) < g.constitution.majority && !decreeMode(g) && g.constitution.legislature != "none") r.push("Government has no majority");
  if (g.politics.unrest > 50) r.push("High unrest (" + Math.round(g.politics.unrest) + ")");
  if (g.defence.loyalty < 45) r.push("Army loyalty low - coup risk");
  if (g.politics.legitimacy < 30) r.push("Regime legitimacy low");
  if (h.infl > 0.05) r.push("Inflation above 5%");
  if (h.u > g.econ.natU + 0.02) r.push("Unemployment rising");
  if (-h.bal / h.gdp > 0.05) r.push("Deficit above 5% of GDP");
  if (g.services.health.access < 0.85) r.push("Hospitals overloaded");
  if (g.defence.readiness < 40) r.push("Low military readiness");
  var gp = govParties(g);
  for (var i = 0; i < gp.length; i++) if (!gp[i].player && gp[i].patience < 25) r.push(esc(gp[i].name) + " may quit the coalition");
  for (var i = 0; i < g.shocks.length; i++) r.push("Ongoing: " + g.shocks[i].type + " shock (" + g.shocks[i].weeks + " wks)");
  if (!r.length) return "<div class='small'>None at the moment.</div>";
  return "<div class='bad'>&bull; " + r.join("<br>&bull; ") + "</div>";
}

// ---------- turns ----------
function advance(n) {
  if (!game) return;
  if (game.gameOver && game.difficulty != "sandbox") { go("dashboard"); return; }
  for (var i = 0; i < n; i++) {
    var before = JSON.stringify(game);
    var res = advanceWeek(game);
    if (!res.ok) {
      alert("The turn failed its accounting checks and was not committed:\n\n" + res.problems.join("\n"));
      break;
    }
    game = res.game;
    // keep the previous state so the turn can be replayed and checked (Settings page)
    try { localStorage.setItem("ngs_prev", before); } catch (e) { }
    autosave();
    // bulk advance stops for urgent stuff
    if (game.urgent.length && i < n - 1) {
      game.stoppedFor = game.urgent.slice();
      break;
    }
    if (game.gameOver) break;
  }
  go("dashboard");
}

// ---------- saving ----------
function autosave() {
  try {
    localStorage.setItem("ngs_autosave", JSON.stringify({ name: "Autosave", saved: new Date().toString(), week: game.week, country: game.country.name, game: game }));
    lastSaved = game.week;
  } catch (e) {
    $("savestatus").innerHTML = "<b>Autosave failed (storage full?)</b>";
  }
}

function saveSlot(n, name) {
  try {
    localStorage.setItem("ngs_slot_" + n, JSON.stringify({ name: name || ("Slot " + n), saved: new Date().toString(), week: game.week, country: game.country.name, game: game }));
    game.commandLog.push({ week: game.week, cmd: "savepoint", name: name });
    alert("Saved to slot " + n);
  } catch (e) {
    alert("Could not save - your browser storage might be full. Try Export instead.");
  }
  route();
}

function loadSlot(key) {
  var raw = localStorage.getItem(key);
  if (!raw) { alert("Nothing saved there"); return; }
  var s = JSON.parse(raw);
  if (s.game.version != GAME_VERSION) {
    if (!confirm("This save was made with version " + s.game.version + " (this is " + GAME_VERSION + "). It may not work properly. Load anyway?")) return;
  }
  game = s.game;
  lastSaved = game.week;
  go("dashboard");
}

function deleteSlot(n) {
  if (!confirm("Really delete the save in slot " + n + "? This can't be undone.")) return;
  localStorage.removeItem("ngs_slot_" + n);
  route();
}

function exportSave() {
  var blob = new Blob([JSON.stringify(game)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = game.country.name.replace(/[^a-z0-9]+/gi, "_") + "_week" + game.week + ".json";
  a.click();
}

function importSave(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var g = JSON.parse(reader.result);
      if (!g.econ || !g.history) throw new Error("not a Nationstate save");
      game = g;
      go("dashboard");
    } catch (e) { alert("Couldn't read that file: " + e.message); }
  };
  reader.readAsText(file);
}

// replay the last turn from the saved previous state and check we get the same answer
function replayCheck() {
  var prev = localStorage.getItem("ngs_prev");
  if (!prev) { alert("Advance at least one week first."); return; }
  var before = JSON.parse(prev);
  var res = advanceWeek(before);
  var same = JSON.stringify(res.game) == JSON.stringify(game);
  alert(same ? "Replay OK: re-running week " + before.week + " -> " + res.game.week + " from the saved state and seed gave exactly the same result."
    : "Replay gave a DIFFERENT result. (If you changed things after the turn, like submitting a bill or saving, that would explain it.)");
}

window.onhashchange = route;
window.onload = function () {
  // carry on from the autosave if there is one
  try {
    var raw = localStorage.getItem("ngs_autosave");
    if (raw) { game = JSON.parse(raw).game; lastSaved = game.week; }
  } catch (e) { game = null; }
  route();
};

// keyboard shortcut: N = next week (when not typing)
document.onkeydown = function (e) {
  if (e.target.tagName == "INPUT" || e.target.tagName == "SELECT" || e.target.tagName == "TEXTAREA") return;
  if (e.key == "n" || e.key == "N") advance(1);
};
