// charts.js - my own little line chart on a canvas (didnt want a library)

// series = [{label, color, values:[...]}], xs = week numbers
function drawChart(id, xs, series, opts) {
  var c = document.getElementById(id);
  if (!c) return;
  opts = opts || {};
  var ctx = c.getContext("2d");
  var W = c.width, H = c.height;
  var left = 52, right = 10, top = 10, bottom = 22;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  var min = Infinity, max = -Infinity;
  for (var s = 0; s < series.length; s++)
    for (var i = 0; i < series[s].values.length; i++) {
      var v = series[s].values[i];
      if (v == null || isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  if (opts.zero && min > 0) min = 0;
  if (min == max) { min -= 1; max += 1; }
  var pad = (max - min) * 0.08;
  min -= pad; max += pad;

  function X(i) { return left + (W - left - right) * (xs.length < 2 ? 0.5 : i / (xs.length - 1)); }
  function Y(v) { return top + (H - top - bottom) * (1 - (v - min) / (max - min)); }

  // grid
  ctx.strokeStyle = "#DDD";
  ctx.fillStyle = "#333";
  ctx.font = "10px Verdana";
  ctx.lineWidth = 1;
  for (var k = 0; k <= 4; k++) {
    var val = min + (max - min) * k / 4;
    var y = Y(val);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(W - right, y); ctx.stroke();
    ctx.fillText(opts.fmt ? opts.fmt(val) : val.toFixed(1), 2, y + 3);
  }
  // x labels
  var step = Math.max(1, Math.round(xs.length / 6));
  for (var i = 0; i < xs.length; i += step) ctx.fillText("w" + xs[i], X(i) - 8, H - 6);
  // axes
  ctx.strokeStyle = "#555";
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, H - bottom); ctx.lineTo(W - right, H - bottom); ctx.stroke();

  // lines
  for (var s = 0; s < series.length; s++) {
    ctx.strokeStyle = series[s].color || "#17345B";
    ctx.lineWidth = 2;
    if (series[s].dash) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < series[s].values.length; i++) {
      var v = series[s].values[i];
      if (v == null || isNaN(v)) continue;
      if (!started) { ctx.moveTo(X(i), Y(v)); started = true; } else ctx.lineTo(X(i), Y(v));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// tiny legend in html (so the colour isnt the only way to tell the lines apart)
function legendHtml(series) {
  var h = "<div class='small'>";
  for (var i = 0; i < series.length; i++) h += "<span style='color:" + series[i].color + "'>" + (series[i].dash ? "- - -" : "&#9632;&#9632;") + "</span> " + series[i].label + " &nbsp; ";
  return h + "</div>";
}
