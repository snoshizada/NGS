// builder.js - the nation builder (new game page), the national identity page,
// the constitution amendment builder and the flag upload stuff.
// ngState holds everything on the new game form so it survives redrawing the page

var ngState = null;

// some ready-made constitutions to start from. you can still change every box after
var CONST_PRESETS = [
  { name: "Parliamentary democracy", c: { executive: "pm", headOfState: "president_indirect", legislature: "elected", legPower: "full", elections: "free", partySystem: "multi", judiciary: "independent", press: "free", assembly: "free", emergency: "limited", economy: "mixed", confidenceRule: true, termLimit: 0 } },
  { name: "Constitutional monarchy", c: { executive: "pm", headOfState: "monarch_const", legislature: "elected", legPower: "full", elections: "free", partySystem: "multi", judiciary: "independent", press: "free", assembly: "free", emergency: "limited", confidenceRule: true, termLimit: 0 } },
  { name: "Presidential republic", c: { executive: "president", headOfState: "same", legislature: "elected", legPower: "full", elections: "free", partySystem: "multi", judiciary: "independent", press: "free", assembly: "free", termLimit: 2, chambers: 2, upperHouse: "regional" } },
  { name: "Semi-presidential", c: { executive: "pm", headOfState: "president_elected", legislature: "elected", legPower: "full", elections: "free", partySystem: "multi", judiciary: "independent", press: "free", assembly: "free", confidenceRule: true } },
  { name: "Federal republic", c: { executive: "pm", headOfState: "president_indirect", legislature: "elected", legPower: "full", elections: "free", partySystem: "multi", territory: "federal", chambers: 2, upperHouse: "regional", judiciary: "independent", press: "free", assembly: "free" } },
  { name: "Electoral autocracy", c: { executive: "president", headOfState: "same", legislature: "elected", legPower: "advisory", elections: "restricted", partySystem: "multi", judiciary: "partial", press: "restricted", assembly: "restricted", emergency: "broad", termLimit: 0 } },
  { name: "One-party state", c: { executive: "partyleader", headOfState: "same", legislature: "elected", legPower: "rubber", elections: "free", partySystem: "single", judiciary: "controlled", press: "state", assembly: "banned", economy: "planned", religion: "secular", termLimit: 0 } },
  { name: "Absolute monarchy", c: { executive: "monarch", headOfState: "monarch_abs", legislature: "appointed", legPower: "advisory", elections: "none", partySystem: "multi", judiciary: "controlled", press: "restricted", assembly: "restricted", religion: "state", emergency: "broad", termLimit: 0 } },
  { name: "Theocratic monarchy", c: { executive: "monarch", headOfState: "monarch_abs", legislature: "appointed", legPower: "rubber", elections: "none", judiciary: "controlled", press: "state", assembly: "banned", religion: "state", economy: "market", emergency: "broad" } },
  { name: "Military junta", c: { executive: "junta", headOfState: "same", legislature: "none", elections: "none", judiciary: "controlled", press: "state", assembly: "banned", emergency: "broad", termLimit: 0 } }
];

function ngDefaults(key) {
  var T = copy(TEMPLATES[key]);
  var pop = sum(T.regions.map(function (r) { return r.pop; }));
  return {
    template: key,
    name: T.name, capital: T.capital, currency: T.currency, symbol: T.currencySymbol, languages: T.languages, motto: "",
    leader: "", party: T.parties[0].name,
    flag: T.flag.slice(), flagVertical: false, flagImg: null,
    regions: T.regions.map(function (r) { return { name: r.name, pop: r.pop, income: r.income }; }),
    gdpPerCap: Math.round(T.gdp / pop * 10) / 10, debt: Math.round(T.debtRatio * 100), unemp: Math.round(T.unemployment * 1000) / 10,
    infl: Math.round(T.inflation * 1000) / 10, old: Math.round(T.oldShare * 100), young: Math.round(T.youngShare * 100),
    con: copy(T.constitution),
    parties: T.parties.map(function (p) { return { name: p.name, econ: p.econ, social: p.social, color: p.color, seats: p.seats, inGov: !!p.inGov }; }),
    difficulty: "standard", seed: 1000 + Math.floor(Math.random() * 90000)
  };
}

// fake game object so we can use democracyIndex() etc on the form
function ngFakeGame() {
  var c = normalizeConstitution(copy(ngState.con), ngState.regions.length);
  return { constitution: c, policies: {} };
}

PAGES.newgame = function () {
  if (!ngState) ngState = ngDefaults("A");
  var S = ngState;
  var h = "<div id='newgame'>" + title("Found a nation");
  h += "<p>Welcome to <b>Nationstate</b>, a turn-based simulator where you govern a country one week at a time. ";
  h += "Start from one of the ready-made countries, or build your own: its name, flag, land, people, parties and the whole constitution. ";
  h += "Every choice changes how the game plays. A democracy has to win elections, a dictatorship has to keep the army and the streets on its side.</p>";
  var auto = null;
  try { auto = JSON.parse(localStorage.getItem("ngs_autosave") || "null"); } catch (e) { auto = null; }
  if (auto && auto.game && auto.game.version == GAME_VERSION) h += "<div class='notice'>You have a game in progress. <a href='javascript:loadSlot(\"ngs_autosave\")'>Continue it</a> or start a new one below.</div>";
  else if (auto) h += "<div class='notice'>Your last game was made with an older version (" + esc(auto.game ? auto.game.version : "?") + ") and can't be continued in this one. Start a new nation below.</div>";

  // ---- 1. starting point
  h += "<h2>1. Starting point</h2><p class='small'>Picking one fills in everything below with that country's numbers. Then change whatever you like.</p>";
  for (var k in TEMPLATES) {
    var T = TEMPLATES[k];
    h += "<div class='template'><label><input type='radio' name='tpl' value='" + k + "'" + (S.template == k ? " checked" : "") + " onclick='ngPickTemplate(\"" + k + "\")'> <b>" + T.name + "</b> &mdash; " + T.title + "</label>";
    h += "<div class='small'>Population " + sum(T.regions.map(function (r) { return r.pop; })).toFixed(1) + "m, GDP " + T.currencySymbol + " " + T.gdp + "bn, unemployment " + pct(T.unemployment) + ", debt " + pct(T.debtRatio, 0) + " of GDP, " + T.regions.length + " regions.</div></div>";
  }

  // ---- 2. identity
  h += "<h2>2. Name and identity</h2><table class='data'>";
  h += ngText("Country name", "name", 34) + ngText("Capital city", "capital", 20) + ngText("Currency name", "currency", 14) + ngText("Currency symbol", "symbol", 4);
  h += ngText("Language(s)", "languages", 24) + ngText("National motto", "motto", 40) + ngText("Your name (blank = random)", "leader", 22) + ngText("Your party / movement", "party", 28);
  h += "</table>";

  // ---- 3. flag
  h += "<h2>3. Flag</h2><table class='data'><tr><td valign=top style='width:170px;text-align:center'><div id='ng_flagprev'>" + flagHtml({ flagImg: S.flagImg, flag: S.flag, flagVertical: S.flagVertical }, 150, 100) + "</div></td><td valign=top>";
  h += "<b>Upload a flag picture:</b> <input type='file' id='ng_flagfile' accept='image/png,image/jpeg,image/gif,image/webp' onchange='flagUpload(this, ngFlagLoaded)'><br><span class='small'>PNG works best. It gets shrunk to 150x100 so saves stay small.</span>";
  if (S.flagImg) h += "<br><button onclick='ngState.flagImg=null;ngRedraw()'>Remove picture, use stripes</button>";
  h += "<p><b>Or design stripes:</b> ";
  for (var i = 0; i < S.flag.length; i++) h += "<input type='color' id='ng_fc" + i + "' value='" + esc(S.flag[i]) + "' onchange='ngRead();ngFlagPreview()'> ";
  if (S.flag.length < 5) h += "<button onclick='ngRead();ngState.flag.push(\"#FFFFFF\");ngRedraw()'>+ stripe</button> ";
  if (S.flag.length > 1) h += "<button onclick='ngRead();ngState.flag.pop();ngRedraw()'>- stripe</button> ";
  h += "<br><label><input type='checkbox' id='ng_fvert'" + (S.flagVertical ? " checked" : "") + " onchange='ngRead();ngFlagPreview()'> Vertical stripes</label></p>";
  h += "</td></tr></table>";

  // ---- 4. land and people
  h += "<h2>4. Land and people</h2>";
  h += "<table class='data'><tr><th>Region / province</th><th>Population (millions)</th><th>Income (1 = national average)</th><th></th></tr>";
  for (var i = 0; i < S.regions.length; i++) {
    var r = S.regions[i];
    h += "<tr><td><input type='text' id='ng_rn" + i + "' value='" + esc(r.name) + "' size=22 maxlength=40></td><td><input type='number' id='ng_rp" + i + "' value='" + r.pop + "' step='0.1' min='0.05' style='width:80px'></td>";
    h += "<td><input type='number' id='ng_ri" + i + "' value='" + r.income + "' step='0.05' min='0.3' max='3' style='width:70px'></td>";
    h += "<td>" + (S.regions.length > 2 ? "<a href='javascript:ngDelRegion(" + i + ")'>remove</a>" : "") + "</td></tr>";
  }
  h += "</table>";
  if (S.regions.length < 10) h += "<p><button onclick='ngAddRegion()'>+ Add a region</button> <span class='small'>(2 to 10 regions)</span></p>";
  h += "<table class='data'>";
  h += ngNum("GDP per person (thousands)", "gdpPerCap", 1, 200, 0.5) + ngNum("Government debt (% of GDP)", "debt", 0, 300, 1);
  h += ngNum("Unemployment (%)", "unemp", 1, 40, 0.5) + ngNum("Inflation (%)", "infl", -2, 30, 0.1);
  h += ngNum("Over 65s (% of people)", "old", 3, 40, 1) + ngNum("Under 18s (% of people)", "young", 10, 50, 1);
  h += "</table>";

  // ---- 5. constitution
  h += "<h2>5. Constitution</h2><p>Quick start: ";
  for (var i = 0; i < CONST_PRESETS.length; i++) h += "<button onclick='ngPreset(" + i + ")'>" + CONST_PRESETS[i].name + "</button> ";
  h += "</p><p class='small'>These just fill in the boxes. Mix and match to make your own kind of state, like a federal theocracy with a planned economy or an elected monarchy.</p>";
  h += constBuilderHtml(S.con, "ng_c_", "ngRead();ngConstSummary()");
  h += "<div id='ng_constsum'>" + constSummaryHtml(ngFakeGame()) + "</div>";

  // ---- 6. parties
  h += "<h2>6. Political parties</h2><p class='small'>The first party is yours. Economic: 0 = far left, 100 = far right. Social: 0 = traditional, 100 = liberal. Seats are shared out again to fit the legislature.</p>";
  h += "<table class='data'><tr><th>Party</th><th>Economic</th><th>Social</th><th>Colour</th><th>Seats now</th><th>In government</th><th></th></tr>";
  for (var i = 0; i < S.parties.length; i++) {
    var p = S.parties[i];
    h += "<tr><td><input type='text' id='ng_pn" + i + "' value='" + esc(i == 0 ? S.party : p.name) + "' size=24 maxlength=50" + (i == 0 ? " disabled title='Change it in section 2'" : "") + "></td>";
    h += "<td><input type='number' id='ng_pe" + i + "' value='" + p.econ + "' min=0 max=100 style='width:55px'></td><td><input type='number' id='ng_ps" + i + "' value='" + p.social + "' min=0 max=100 style='width:55px'></td>";
    h += "<td><input type='color' id='ng_pc" + i + "' value='" + esc(p.color) + "'></td><td><input type='number' id='ng_pseat" + i + "' value='" + p.seats + "' min=1 style='width:60px'></td>";
    h += "<td>" + (i == 0 ? "yes (you)" : "<input type='checkbox' id='ng_pg" + i + "'" + (p.inGov ? " checked" : "") + ">") + "</td>";
    h += "<td>" + (i > 0 && S.parties.length > 2 ? "<a href='javascript:ngDelParty(" + i + ")'>remove</a>" : "") + "</td></tr>";
  }
  h += "</table>";
  if (S.parties.length < 10) h += "<p><button onclick='ngAddParty()'>+ Add a party</button></p>";
  var seatSum = sum(S.parties.map(function (p) { return parseInt(p.seats) || 0; }));
  if (seatSum != S.con.seats) h += "<p class='small'>Party seats add up to " + seatSum + " but the legislature has " + esc(S.con.seats) + ". They'll be scaled to fit.</p>";

  // ---- 7. go
  h += "<h2>7. Last bits</h2><table class='data'>";
  h += "<tr><th>Difficulty</th><td><select id='ng_diff'>" + ["story|Story - more money, more forgiving", "standard|Standard", "hard|Hard - weaker finances, less trust", "sandbox|Sandbox - you can't be removed"].map(function (o) { var a = o.split("|"); return "<option value='" + a[0] + "'" + (S.difficulty == a[0] ? " selected" : "") + ">" + a[1] + "</option>"; }).join("") + "</select></td></tr>";
  h += "<tr><th>Random seed</th><td><input type='number' id='ng_seed' value='" + esc(S.seed) + "' style='width:90px'> <span class='small'>Same seed + same decisions = same game</span></td></tr>";
  h += "</table>";
  h += "<p><button class='big' onclick='startNewGame()'>Take office &raquo;</button> <button onclick='ngState=ngDefaults(ngState.template);ngRedraw()'>Reset form</button></p>";
  h += "<p class='small'>Or <a href='#settings'>load a saved game</a>. Need help? Read <a href='#help'>How to play</a>.</p></div>";
  return h;
};

function ngText(label, key, size) {
  return "<tr><th>" + label + "</th><td><input type='text' id='ng_" + key + "' value='" + esc(ngState[key] || "") + "' size=" + size + " maxlength=60></td></tr>";
}
function ngNum(label, key, min, max, step) {
  return "<tr><th>" + label + "</th><td><input type='number' id='ng_" + key + "' value='" + esc(ngState[key]) + "' min=" + min + " max=" + max + " step=" + step + " style='width:80px'></td></tr>";
}

// the big constitution form. prefix lets the same form be used on the amendment page
function constBuilderHtml(con, prefix, onchange) {
  var h = "<table class='data full'>", group = "";
  for (var i = 0; i < CONST_FIELDS.length; i++) {
    var f = CONST_FIELDS[i];
    if (f.group != group) { group = f.group; h += "<tr><th colspan=2 class='grouphead'>" + group + "</th></tr>"; }
    var v = con[f.id];
    h += "<tr><td style='width:45%'>" + f.name + "</td><td>";
    if (f.type == "text") h += "<input type='text' id='" + prefix + f.id + "' value='" + esc(v || "") + "' size=26 maxlength=40 onchange='" + onchange + "'>";
    else if (f.type == "number") h += "<input type='number' id='" + prefix + f.id + "' value='" + esc(v) + "' min=" + f.min + " max=" + f.max + " style='width:70px' onchange='" + onchange + "'>";
    else {
      h += "<select id='" + prefix + f.id + "' onchange='" + onchange + "'>";
      for (var j = 0; j < f.options.length; j++) h += "<option value='" + f.options[j][0] + "'" + (String(v) == String(f.options[j][0]) ? " selected" : "") + ">" + f.options[j][1] + "</option>";
      h += "</select>";
    }
    h += "</td></tr>";
  }
  return h + "</table>";
}
function readConstForm(prefix, into) {
  for (var i = 0; i < CONST_FIELDS.length; i++) {
    var el = $(prefix + CONST_FIELDS[i].id);
    if (el) into[CONST_FIELDS[i].id] = el.value;
  }
  return into;
}

// what kind of state is this? shown under the builder
function constSummaryHtml(fg) {
  var c = fg.constitution, di = democracyIndex(fg);
  var h = "<div class='notice'><b>Your state:</b> " + esc(c.govType) + ". You will be the <b>" + esc(c.title) + "</b>.<br>";
  h += "Democracy index: <b>" + Math.round(di) + "/100</b> (" + diLabel(di) + "). ";
  h += "Laws are made " + (decreeMode(fg) ? "<b>by decree</b>" : (c.legPower == "advisory" ? "by the legislature, but you can <b>override</b> it" : "by a <b>vote in the legislature</b>")) + ". ";
  h += "Changing the constitution: " + esc(c.amendmentText) + ".<br>";
  var notes = [];
  if (c.elections == "none") notes.push("No elections: you can't be voted out, but watch legitimacy, unrest and the army.");
  else if (c.elections == "restricted") notes.push("Rigged elections are easier to win but cost legitimacy, and democracies abroad will dislike you.");
  else notes.push("Free elections every " + c.termYears + " years" + (c.termLimit ? ", maximum " + c.termLimit + " term(s)" : "") + ".");
  if (c.executive == "junta") notes.push("A junta depends on the army. Keep defence spending and pay up.");
  if (c.confidenceRule) notes.push("Lose a confidence vote and your government falls.");
  if (c.economy == "planned") notes.push("Planned economy: the state invests and earns profits, but productivity grows slower.");
  if (c.territory == "federal") notes.push("Federal: regions must agree to constitutional changes and services are slower to change.");
  if (c.press == "state") notes.push("State media only prints good news... and the public knows it.");
  h += "<span class='small'>" + notes.join(" ") + "</span></div>";
  return h;
}
function diLabel(di) { return di >= 80 ? "full democracy" : (di >= 60 ? "flawed democracy" : (di >= 35 ? "hybrid regime" : "authoritarian")); }

function ngRead() {
  var S = ngState;
  if (!$("ng_name")) return;
  var keys = ["name", "capital", "currency", "symbol", "languages", "motto", "leader", "party"];
  for (var i = 0; i < keys.length; i++) S[keys[i]] = $("ng_" + keys[i]).value;
  var nums = ["gdpPerCap", "debt", "unemp", "infl", "old", "young"];
  for (var i = 0; i < nums.length; i++) S[nums[i]] = parseFloat($("ng_" + nums[i]).value);
  for (var i = 0; i < S.flag.length; i++) if ($("ng_fc" + i)) S.flag[i] = $("ng_fc" + i).value;
  S.flagVertical = $("ng_fvert").checked;
  for (var i = 0; i < S.regions.length; i++) S.regions[i] = { name: $("ng_rn" + i).value, pop: parseFloat($("ng_rp" + i).value), income: parseFloat($("ng_ri" + i).value) };
  readConstForm("ng_c_", S.con);
  for (var i = 0; i < S.parties.length; i++) {
    var p = S.parties[i];
    if (i > 0) p.name = $("ng_pn" + i).value;
    p.econ = parseFloat($("ng_pe" + i).value); p.social = parseFloat($("ng_ps" + i).value);
    p.color = $("ng_pc" + i).value; p.seats = parseInt($("ng_pseat" + i).value) || 1;
    p.inGov = i == 0 || $("ng_pg" + i).checked;
  }
  S.difficulty = $("ng_diff").value; S.seed = $("ng_seed").value;
}
function ngRedraw() { var y = window.scrollY; route(); window.scrollTo(0, y); }
function ngPickTemplate(k) { if (!confirm("Fill the form with " + TEMPLATES[k].name + "'s numbers? Your changes below will be replaced.")) { ngRedraw(); return; } ngState = ngDefaults(k); ngRedraw(); }
function ngAddRegion() { ngRead(); ngState.regions.push({ name: "New Province", pop: 1, income: 1 }); ngRedraw(); }
function ngDelRegion(i) { ngRead(); ngState.regions.splice(i, 1); ngRedraw(); }
function ngAddParty() { ngRead(); var n = ngState.parties.length; ngState.parties.push({ name: "New Party " + n, econ: 50, social: 50, color: "#888888", seats: 5, inGov: false }); ngRedraw(); }
function ngDelParty(i) { ngRead(); ngState.parties.splice(i, 1); ngRedraw(); }
function ngPreset(i) { ngRead(); var p = CONST_PRESETS[i].c; for (var k in p) ngState.con[k] = p[k]; ngRedraw(); }
function ngConstSummary() { $("ng_constsum").innerHTML = constSummaryHtml(ngFakeGame()); }
function ngFlagPreview() { $("ng_flagprev").innerHTML = flagHtml({ flagImg: ngState.flagImg, flag: ngState.flag, flagVertical: ngState.flagVertical }, 150, 100); }
function ngFlagLoaded(url) { ngRead(); ngState.flagImg = url; ngRedraw(); }

// read an image file, shrink it to fit 150x100 and give back a png data url
function flagUpload(input, done) {
  var file = input.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { alert("Please pick a PNG, JPG, GIF or WEBP picture."); return; }
  if (file.size > 8 * 1024 * 1024) { alert("That picture is too big (over 8 MB)."); return; }
  var reader = new FileReader();
  reader.onload = function () {
    var img = new Image();
    img.onload = function () {
      var w = 150, hh = 100;
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = hh;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, hh);
      // stretch to fill, flags are usually 3:2 anyway
      ctx.drawImage(img, 0, 0, w, hh);
      var url = cv.toDataURL("image/png");
      if (!cleanFlagImg(url)) { alert("Sorry, couldn't use that picture."); return; }
      done(url);
    };
    img.onerror = function () { alert("That file doesn't look like a picture."); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function startNewGame() {
  ngRead();
  var S = ngState, key = S.template, D = ngDefaults(key);
  var opts = {
    name: S.name.trim(), capital: S.capital.trim(), currency: S.currency.trim(), symbol: S.symbol.trim(), languages: S.languages.trim(), motto: S.motto.trim(),
    leaderName: S.leader.trim(), partyName: S.party.trim(), difficulty: S.difficulty, seed: S.seed,
    flag: S.flag.slice(), flagVertical: S.flagVertical, flagImg: S.flagImg, constitution: copy(S.con)
  };
  for (var k in opts) if (opts[k] === "") delete opts[k];
  // only send the numbers that were changed, so an untouched template plays exactly like before
  var cu = {};
  if (JSON.stringify(S.regions) != JSON.stringify(D.regions)) cu.regions = S.regions;
  if (S.gdpPerCap != D.gdpPerCap) cu.gdpPerCap = S.gdpPerCap;
  if (S.debt != D.debt) cu.debtRatio = S.debt / 100;
  if (S.unemp != D.unemp) cu.unemployment = S.unemp / 100;
  if (S.infl != D.infl) cu.inflation = S.infl / 100;
  if (S.old != D.old) cu.oldShare = S.old / 100;
  if (S.young != D.young) cu.youngShare = S.young / 100;
  opts.custom = cu;
  var pp = S.parties.map(function (p, i) { return { name: i == 0 ? S.party : p.name, econ: p.econ, social: p.social, color: p.color, seats: p.seats, inGov: p.inGov }; });
  var dp = D.parties.map(function (p, i) { return { name: i == 0 ? D.party : p.name, econ: p.econ, social: p.social, color: p.color, seats: p.seats, inGov: p.inGov }; });
  if (JSON.stringify(pp) != JSON.stringify(dp)) opts.parties = pp;
  try {
    game = newGame(key, opts);
  } catch (e) {
    alert("Couldn't start with those settings: " + e.message);
    return;
  }
  ngState = null;
  autosave();
  go("dashboard");
}

// ======================================================================
// NATIONAL IDENTITY (rename the country, new flag... goes through a bill)
// ======================================================================
var idFlagImg = null;
PAGES.identity = function () {
  var g = game, C = g.country;
  var h = title("National Identity");
  h += "<table class='data'><tr><td style='width:170px;text-align:center'>" + flagHtml(C, 150, 100) + "</td><td>";
  h += "<b>" + esc(C.name) + "</b><br>Capital: " + esc(C.capital) + "<br>Currency: " + esc(C.currency) + " (" + esc(C.symbol) + ")<br>Language(s): " + esc(C.languages || "-");
  h += "<br>Motto: " + (C.motto ? "<i>&ldquo;" + esc(C.motto) + "&rdquo;</i>" : "none") + "<br>Form of state: " + esc(g.constitution.govType) + "<br>Title of the leader: " + esc(g.constitution.title) + "</td></tr></table>";
  h += "<h2>Change national symbols</h2><p>Changing the name, flag or motto is a law like any other. " + (decreeMode(g) ? "You can do it by decree." : "It needs a majority in the legislature.") + " A new flag or name costs a little money (new signs, passports...) and some people won't like it.</p>";
  h += "<table class='data'>";
  h += "<tr><th>Country name</th><td><input type='text' id='id_name' value='" + esc(C.name) + "' size=34 maxlength=60></td></tr>";
  h += "<tr><th>Capital</th><td><input type='text' id='id_capital' value='" + esc(C.capital) + "' size=20 maxlength=60></td></tr>";
  h += "<tr><th>Currency name</th><td><input type='text' id='id_currency' value='" + esc(C.currency) + "' size=14 maxlength=60></td></tr>";
  h += "<tr><th>Currency symbol</th><td><input type='text' id='id_symbol' value='" + esc(C.symbol) + "' size=4 maxlength=6></td></tr>";
  h += "<tr><th>Language(s)</th><td><input type='text' id='id_languages' value='" + esc(C.languages || "") + "' size=24 maxlength=60></td></tr>";
  h += "<tr><th>Motto</th><td><input type='text' id='id_motto' value='" + esc(C.motto || "") + "' size=40 maxlength=60></td></tr>";
  h += "<tr><th>Your title</th><td><input type='text' id='id_title' value='" + esc(g.constitution.leaderTitle || "") + "' size=26 maxlength=40> <span class='small'>blank = " + esc(defaultTitle(g.constitution)) + "</span></td></tr>";
  h += "<tr><th>New flag picture</th><td><input type='file' accept='image/png,image/jpeg,image/gif,image/webp' onchange='flagUpload(this, function (u) { idFlagImg = u; $(\"id_flagprev\").innerHTML = flagHtml({ flagImg: u }, 75, 50); })'> <span id='id_flagprev'>" + (idFlagImg ? flagHtml({ flagImg: idFlagImg }, 75, 50) : "") + "</span></td></tr>";
  h += "<tr><th>Or new stripes</th><td>";
  var f = C.flag || ["#FFFFFF"];
  for (var i = 0; i < 5; i++) h += "<input type='color' id='id_fc" + i + "' value='" + esc(f[i] || "#FFFFFF") + "'> ";
  h += "<select id='id_fcount'>" + [1, 2, 3, 4, 5].map(function (n) { return "<option" + (n == f.length ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select> stripes <label><input type='checkbox' id='id_fchange'> use these stripes</label></td></tr>";
  h += "</table><p><button onclick='identityPreview()'>Preview bill</button></p><div id='preview'></div>";
  return h;
};

function identityPreview() {
  var g = game, C = g.country, ch = [];
  var fields = [["name", "Country name"], ["capital", "Capital"], ["currency", "Currency name"], ["symbol", "Currency symbol"], ["languages", "Languages"], ["motto", "Motto"]];
  for (var i = 0; i < fields.length; i++) {
    var v = $("id_" + fields[i][0]).value.trim();
    if (v != (C[fields[i][0]] || "") && (v || fields[i][0] == "motto")) ch.push({ kind: "identity", id: fields[i][0], name: fields[i][1], from: C[fields[i][0]] || "", to: v });
  }
  var t = $("id_title").value.trim();
  if (t != (g.constitution.leaderTitle || "")) ch.push({ kind: "identity", id: "leaderTitle", name: "Title of the leader", from: g.constitution.leaderTitle || "", to: t });
  if (idFlagImg) ch.push({ kind: "identity", id: "flagImg", name: "Flag (new picture)", from: C.flagImg ? "picture" : "stripes", to: idFlagImg });
  else if ($("id_fchange").checked) {
    var n = parseInt($("id_fcount").value), cols = [];
    for (var i = 0; i < n; i++) cols.push($("id_fc" + i).value);
    ch.push({ kind: "identity", id: "flag", name: "Flag (stripes)", from: (C.flag || []).join(" "), to: cols });
    if (C.flagImg) ch.push({ kind: "identity", id: "flagImg", name: "Remove flag picture", from: "picture", to: "" });
  }
  if (!ch.length) { $("preview").innerHTML = "<p>Nothing has changed.</p>"; return; }
  draft = { title: "National Symbols Bill", type: "identity", ministry: "interior", changes: ch };
  showPreview();
}

// ======================================================================
// CONSTITUTION AMENDMENT BUILDER (used on the law page)
// ======================================================================
function amendHtml(g) {
  var h = "<p>Change any part of the constitution. Route: <b>" + esc(g.constitution.amendmentText) + "</b>.</p>";
  h += "<p class='small'>Big changes have big effects: cutting democracy lowers legitimacy and angers democracies abroad, going the other way can let your opponents win. Changes take effect the week after the amendment passes.</p>";
  h += "<p>Quick fill: ";
  for (var i = 0; i < CONST_PRESETS.length; i++) h += "<button onclick='amendPresetFill(" + i + ")'>" + CONST_PRESETS[i].name + "</button> ";
  h += "</p>";
  h += constBuilderHtml(g.constitution, "am_", "amendSummary()");
  h += "<div id='am_sum'></div><p><button onclick='amendPreview()'>Preview amendment</button></p>";
  return h;
}
function amendPresetFill(i) {
  var p = CONST_PRESETS[i].c;
  for (var k in p) { var el = $("am_" + k); if (el) el.value = String(p[k]); }
  amendSummary();
}
function amendChanges(g) {
  var now = readConstForm("am_", {}), ch = [];
  for (var i = 0; i < CONST_FIELDS.length; i++) {
    var f = CONST_FIELDS[i], from = g.constitution[f.id], to = now[f.id];
    if (f.type == "number" || typeof from == "number") to = parseFloat(to);
    if (typeof from == "boolean") to = to === "true";
    if (f.type == "text") { to = String(to).trim(); from = from || ""; }
    if (String(to) != String(from)) ch.push({ kind: "amend", id: f.id, name: f.name, from: from, to: to, min: f.min, max: f.max });
  }
  return ch;
}
function amendSummary() {
  var g = game, ch = amendChanges(g);
  if (!ch.length) { $("am_sum").innerHTML = ""; return; }
  var fg = { constitution: normalizeConstitution(readConstForm("am_", copy(g.constitution)), g.regions.length), policies: g.policies };
  $("am_sum").innerHTML = "<p><b>" + ch.length + " change(s).</b> Democracy index " + Math.round(g.politics.di) + " &rarr; " + Math.round(democracyIndex(fg)) + "</p>" + constSummaryHtml(fg);
}
function amendPreview() {
  var g = game, ch = amendChanges(g);
  if (!ch.length) { $("preview").innerHTML = "<p>Nothing has changed.</p>"; return; }
  draft = { title: "Constitutional Amendment (" + ch.map(function (c) { return c.name.split(" (")[0]; }).slice(0, 2).join(", ") + (ch.length > 2 ? "..." : "") + ")", type: "amend", ministry: "justice", changes: ch };
  showPreview();
}

// ======================================================================
// WAR ROOM (bottom of the defence page)
// ======================================================================
function warRoomHtml(g) {
  var h = "";
  var w = g.war;
  if (w) {
    var f = countryOf(g, w.enemy);
    h += "<h2>War with " + esc(f.name) + "</h2>";
    h += "<p>" + (w.attacker == "us" ? "We declared war" : esc(f.name) + " attacked us") + " on " + weekDate(g, w.start) + " (" + w.weeks + " weeks ago). Fighting is near " + esc(g.regions[w.region].name) + ".</p>";
    // front bar: -100 = they win, +100 = we win
    var pos = (w.front + 100) / 2;
    h += "<div class='frontbar'><div class='frontus' style='width:" + pos + "%'>" + esc(g.country.name) + "</div><div class='frontthem'>" + esc(f.name) + "</div></div>";
    h += "<p class='small'>Front line " + Math.round(w.front) + " (100 = total victory, -100 = total defeat). Below 0 the fighting is on our soil.</p>";
    h += "<table class='data'><tr><th>Our soldiers killed</th><td class='num'>" + Math.round(w.ourCas * 1000).toLocaleString() + "</td></tr>";
    h += "<tr><th>Enemy soldiers killed</th><td class='num'>" + Math.round(w.theirCas * 1000).toLocaleString() + "</td></tr>";
    h += "<tr><th>Civilians killed</th><td class='num'>" + Math.round(w.civCas * 1000).toLocaleString() + "</td></tr>";
    h += "<tr><th>Refugees fled abroad</th><td class='num'>" + Math.round(w.displaced * 1000).toLocaleString() + "</td></tr>";
    h += "<tr><th>Cost so far</th><td class='num'>" + money(g, w.cost) + " (" + money(g, w.annualCost || 0) + "/yr)</td></tr>";
    h += "<tr><th>Their military / ours</th><td class='num'>" + f.military + " / " + Math.round(ourStrength(g)) + (allyStrength(g, w.enemy) ? " + allies " + Math.round(allyStrength(g, w.enemy)) : "") + "</td></tr></table>";
    if (w.enemyOffer) {
      var ot = { white: "peace with no conditions", reparations_pay: "peace if we pay them " + money(g, w.enemyOffer.amount) }[w.enemyOffer.terms];
      h += "<div class='notice'><b>" + esc(f.name) + " offers " + ot + ".</b> <button onclick='doPeace(\"enemyOffer\")'>Accept</button> <button onclick='game.war.enemyOffer=null;autosave();route()'>Refuse</button></div>";
    }
    h += "<h3>Offer peace</h3><table class='data'><tr><th>Terms</th><th>Will they accept?</th><th></th></tr>";
    var terms = [["white", "Peace with no conditions"], ["reparations_receive", "They pay us reparations"], ["territory", "They give us a border province"], ["reparations_pay", "We pay them to stop"]];
    for (var i = 0; i < terms.length; i++) {
      var a = peaceAcceptable(g, terms[i][0]);
      h += "<tr><td>" + terms[i][1] + (a.amount ? " (" + money(g, a.amount) + ")" : "") + "</td><td>" + (a.ok ? "<span class='good'>Probably</span>" : "<span class='bad'>No</span>") + " <span class='small'>" + esc(a.why) + "</span></td>";
      h += "<td><button onclick='doPeace(\"" + terms[i][0] + "\")'" + (a.ok ? "" : " disabled") + ">Offer</button></td></tr>";
    }
    h += "</table><p class='small'>To fight better: raise the defence budget, bring in conscription, appoint a competent defence minister, or sign defence treaties (allies join in).</p>";
  } else {
    h += "<h2>War</h2><p>We are at peace. Neighbours with strong armies and bad relations may attack if our forces are weak.</p>";
    h += "<p>Declare war on: <select id='war_c'>";
    for (var i = 0; i < g.foreign.length; i++) h += "<option value='" + g.foreign[i].id + "'>" + esc(g.foreign[i].name) + " (military " + g.foreign[i].military + ", relations " + Math.round(g.foreign[i].relation) + ")</option>";
    h += "</select> <button onclick='warPreview()'>Prepare declaration</button></p>";
    h += "<p class='small'>A declaration of war is a law. " + (decreeMode(g) ? "You can issue it by decree." : "The legislature has to vote for it.") + " War costs money, lives and trade. Win and you gain a province; lose and you lose land and pay reparations.</p><div id='preview'></div>";
  }
  if (g.wars && g.wars.length) {
    h += "<h3>Past wars</h3><table class='data full'><tr><th>Enemy</th><th>From</th><th>To</th><th>Outcome</th><th class='num'>Our dead</th><th class='num'>Civilian dead</th><th class='num'>Cost</th></tr>";
    for (var i = g.wars.length - 1; i >= 0; i--) {
      var r = g.wars[i];
      h += "<tr><td>" + esc(r.enemy) + "</td><td>" + weekDate(g, r.start) + "</td><td>" + weekDate(g, r.end) + "</td><td>" + r.outcome + " (" + r.terms + ")</td><td class='num'>" + Math.round(r.ourCas * 1000).toLocaleString() + "</td><td class='num'>" + Math.round(r.civCas * 1000).toLocaleString() + "</td><td class='num'>" + money(g, r.cost) + "</td></tr>";
    }
    h += "</table>";
  }
  return h;
}
function warPreview() {
  var id = $("war_c").value, f = countryOf(game, id);
  draft = { title: "Declaration of War on " + f.name, type: "war", ministry: "defence", changes: [{ kind: "war", id: id, name: "State of war with " + f.name, from: "peace", to: "war" }] };
  showPreview();
}
function doPeace(terms) {
  var r = makePeace(game, terms);
  if (!r.ok) alert("They refused: " + (r.why || ""));
  autosave();
  route();
}
