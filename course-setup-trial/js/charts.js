/* Two small charts drawn as SVG: a domain donut and a horizontal bar chart (no chart library needed). */
(function () {
  const T = window.TAMA;
  const C = (T.charts = {});
  const EXTRA = ["#8a8f98", "#5c8f6b", "#9b6bb3", "#c4623a"];

  /** Donut of outcomes per domain. Every domain in `domains` is listed, with 0 when no outcome has it. */
  C.donut = function (counts, title, domains) {
    const c = {};
    Object.entries(counts).forEach(([k, v]) => { if (v > 0) c[T.s(k).trim() || "(no domain)"] = v; });
    (domains || []).forEach((d) => { if (!(d in c)) c[d] = 0; });
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    if (!total) return `<div class="chart-empty">${T.esc(title)}: nothing to show yet.</div>`;
    const order = [...Object.keys(T.DOMAIN_COLOURS).filter((d) => d in c), ...Object.keys(c).filter((d) => !(d in T.DOMAIN_COLOURS)).sort()];
    const col = (d, i) => T.DOMAIN_COLOURS[d] || EXTRA[i % EXTRA.length];
    const R = 80, r = 48, cx = 120, cy = 120;
    let a0 = -Math.PI / 2, arcs = "", labels = "";
    order.forEach((d, i) => {
      const n = c[d]; if (!n) return;
      const a1 = a0 + (n / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      arcs += n === total
        ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${col(d, i)}" stroke-width="${R - r}"><title>${T.esc(d)}: ${n}</title></circle>`
        : `<path d="M${p(R, a0)} A${R},${R} 0 ${big} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${big} 0 ${p(r, a0)} Z" fill="${col(d, i)}" stroke="#fff" stroke-width="2"><title>${T.esc(d)}: ${n} (${Math.round(n / total * 100)}%)</title></path>`;
      const am = (a0 + a1) / 2;
      labels += `<text x="${cx + 101 * Math.cos(am)}" y="${cy + 101 * Math.sin(am) + 4}" text-anchor="middle" class="chart-lbl">${n} (${Math.round(n / total * 100)}%)</text>`;
      a0 = a1;
    });
    const legend = order.map((d, i) => `<li><span class="dot" style="background:${col(d, i)}"></span>${T.esc(d)}: ${c[d]} (${Math.round(c[d] / total * 100)}%)</li>`).join("");
    return `<div class="chart-card"><div class="chart-title">${T.esc(title)} <span>(total ${total})</span></div>
      <div class="donut-wrap"><svg viewBox="0 0 240 240" class="donut" role="img" aria-label="${T.esc(title)}">${arcs}${labels}
      <text x="${cx}" y="${cy + 6}" text-anchor="middle" class="donut-total">${total}</text></svg><ul class="legend">${legend}</ul></div></div>`;
  };

  /** Horizontal bars: rows = [{label, value, text, grey}] */
  C.bars = function (rows, axisTitle) {
    const max = Math.max(1, ...rows.map((r) => r.value)) * 1.25;
    const rowH = 34, left = 150, w = 520, h = rows.length * rowH + 34;
    let g = "";
    const ticks = []; for (let t = 0; t <= Math.floor(max); t += Math.max(1, Math.ceil(max / 6))) ticks.push(t);
    ticks.forEach((t) => { const x = left + (t / max) * (w - left - 10); g += `<line x1="${x}" x2="${x}" y1="4" y2="${h - 26}" class="gl"/><text x="${x}" y="${h - 12}" text-anchor="middle" class="axis">${t}</text>`; });
    rows.forEach((r, i) => {
      const y = 8 + i * rowH, bw = (r.value / max) * (w - left - 10);
      g += `<text x="${left - 8}" y="${y + 16}" text-anchor="end" class="axis">${T.esc(r.label)}</text>
        <rect x="${left}" y="${y + 4}" width="${Math.max(bw, 0)}" height="20" rx="3" fill="${r.grey ? "#8a8f98" : "#14365d"}"><title>${T.esc(r.label)}: ${T.esc(r.text)}${r.tip ? " · " + T.esc(r.tip) : ""}</title></rect>
        <text x="${left + bw + 6}" y="${y + 18}" class="chart-lbl">${T.esc(r.text)}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" class="bars" role="img" aria-label="${T.esc(axisTitle)}">${g}</svg><div class="axis-title">${T.esc(axisTitle)}</div>`;
  };
})();
