/* More SVG charts for the Course mark sheet and CLO achievement pages (no chart library):
   grouped vertical bars, a histogram with a pass-mark line, and a "Download picture" button on every chart card.
   Styles are written on the SVG itself so the downloaded PNG looks the same as the page. */
(function () {
  const T = window.TAMA, C = (T.charts = T.charts || {}), esc = T.esc;
  const f2 = (v) => String(Math.round(v * 100) / 100);
  const FONT = 'font-family="Inter, Arial, sans-serif"';
  const niceMax = (m) => { if (!(m > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(m))); for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= m) return k * p; return 10 * p; };
  const lines = (s, w) => { const out = []; let cur = ""; T.s(s).split(/\s+/).forEach((x) => { if ((cur + " " + x).trim().length > w && cur) { out.push(cur); cur = x; } else cur = (cur + " " + x).trim(); }); if (cur) out.push(cur); return out.slice(0, 3); };
  C.legend = (items) => `<div class="ch-legend">${items.map(([l, c, dash]) => `<span><i style="background:${dash ? "none" : c};${dash ? `border-top:2px dashed ${c};height:0;margin-top:6px` : ""}"></i>${esc(l)}</span>`).join("")}</div>`;
  const card = (o, svg, legend) => `<div class="chart-card ch2">${o.title ? `<div class="chart-title">${esc(o.title)}${o.sub ? ` <span>${esc(o.sub)}</span>` : ""}</div>` : ""}${legend || ""}
    <div class="ch-scroll">${svg}</div>${o.xTitle ? `<div class="axis-title">${esc(o.xTitle)}</div>` : ""}
    <div class="ch-foot"><button class="btn xs" data-png="${esc((o.file || o.title || "chart").replace(/[^\w؀-ۿ -]+/g, "").trim() || "chart")}">Download picture</button></div></div>`;

  /** Grouped vertical bars. o: {title, cats, series: [{name, color, values}], max, yTitle, ref: {value, label, color}, fmt, file} */
  C.groupBars = function (o) {
    const n = o.cats.length, k = o.series.length; if (!n || !k) return "";
    const fmt = o.fmt || f2, gw0 = Math.max(56, k * 24 + 20), L = 50, B = 58, Tp = 22;
    const W = Math.max(460, L + 14 + n * gw0), H = 290, ph = H - B - Tp, pw = W - L - 14;
    const vals = o.series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined && !isNaN(v));
    const raw = Math.max(1, ...vals, o.ref ? o.ref.value : 0) * 1.12, max = o.max || (o.intAxis ? Math.max(5, Math.ceil(raw / 5) * 5) : niceMax(raw));
    const y = (v) => Tp + ph - (Math.min(v, max) / max) * ph;
    let g = `<rect width="${W}" height="${H}" fill="#fff"/>`;
    for (let i = 0; i <= 5; i++) { const v = (max * i) / 5, yy = y(v).toFixed(1); g += `<line x1="${L}" x2="${W - 14}" y1="${yy}" y2="${yy}" stroke="#ece6dc"/><text x="${L - 7}" y="${+yy + 4}" text-anchor="end" font-size="11" fill="#5b6675">${f2(v)}</text>`; }
    if (o.yTitle) g += `<text transform="translate(13 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="#5b6675">${esc(o.yTitle)}</text>`;
    const gw = pw / n, bw = Math.min(28, (gw - 12) / k);
    o.cats.forEach((c, i) => {
      const x0 = L + i * gw + (gw - bw * k) / 2;
      o.series.forEach((s, j) => {
        const v = s.values[i]; if (v === null || v === undefined || isNaN(v)) return;
        const x = x0 + j * bw, yy = y(Math.max(v, 0)), h = Tp + ph - yy;
        g += `<rect x="${(x + 1).toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="2.5" fill="${(s.colors && s.colors[i]) || s.color}"><title>${esc(c)} · ${esc(s.name)}: ${fmt(v)}</title></rect>`;
        if (!o.noLabels && (v > 0 || o.zeroLabels)) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${(yy - 4).toFixed(1)}" text-anchor="middle" font-size="${bw < 18 ? 9 : 10.5}" fill="#14365d" font-weight="600">${fmt(v)}</text>`;
      });
      lines(c, Math.max(6, Math.floor(gw / 7))).forEach((ln, li) => { g += `<text x="${(L + i * gw + gw / 2).toFixed(1)}" y="${Tp + ph + 16 + li * 13}" text-anchor="middle" font-size="11.5" fill="#14365d">${esc(ln)}</text>`; });
    });
    g += `<line x1="${L}" x2="${W - 14}" y1="${Tp + ph}" y2="${Tp + ph}" stroke="#b9b1a3"/>`;
    if (o.ref) { const yy = y(o.ref.value).toFixed(1), col = o.ref.color || "#c2410c"; g += `<line x1="${L}" x2="${W - 14}" y1="${yy}" y2="${yy}" stroke="${col}" stroke-width="2" stroke-dasharray="6 4"/><text x="${W - 16}" y="${yy - 5}" text-anchor="end" font-size="11" fill="${col}" font-weight="600">${esc(o.ref.label || "")}</text>`; }
    const legend = k > 1 || o.ref ? C.legend([...(k > 1 ? o.series.map((s) => [s.name, s.color]) : []), ...(o.ref && o.ref.label ? [[o.ref.label, o.ref.color || "#c2410c", true]] : [])]) : "";
    return card(o, `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" ${FONT} role="img" aria-label="${esc(o.title || "")}">${g}</svg>`, legend);
  };

  /** Histogram of marks with a dashed pass-mark line. o: {title, values, max, bins, pass, xTitle, file} */
  C.hist = function (o) {
    const bins = o.bins || 10, mx = o.max > 0 ? o.max : Math.max(1, ...o.values), step = mx / bins, cnt = Array(bins).fill(0);
    o.values.forEach((v) => { cnt[Math.min(bins - 1, Math.max(0, Math.floor(v / step)))]++; });
    const L = 46, B = 46, Tp = 22, W = 560, H = 270, ph = H - B - Tp, pw = W - L - 14, top = Math.max(5, Math.ceil(Math.max(1, ...cnt) * 1.15 / 5) * 5), bw = pw / bins;
    const y = (v) => Tp + ph - (v / top) * ph;
    let g = `<rect width="${W}" height="${H}" fill="#fff"/>`;
    const tk = 5; for (let i = 0; i <= tk; i++) { const v = (top * i) / tk, yy = y(v).toFixed(1); g += `<line x1="${L}" x2="${W - 14}" y1="${yy}" y2="${yy}" stroke="#ece6dc"/><text x="${L - 7}" y="${+yy + 4}" text-anchor="end" font-size="11" fill="#5b6675">${f2(v)}</text>`; }
    g += `<text transform="translate(13 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="#5b6675">Students</text>`;
    cnt.forEach((c, i) => { const x = L + i * bw, yy = y(c); const lo = f2(i * step), hi = f2((i + 1) * step);
      g += `<rect x="${(x + 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(Tp + ph - yy).toFixed(1)}" rx="3" fill="${o.pass !== undefined && (i + 1) * step <= o.pass + 1e-9 ? "#e8a26a" : "#14365d"}"><title>${lo} to ${hi}: ${c} student(s)</title></rect>`;
      if (c) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${(yy - 4).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#14365d" font-weight="600">${c}</text>`;
      g += `<text x="${x.toFixed(1)}" y="${Tp + ph + 15}" text-anchor="middle" font-size="10.5" fill="#5b6675">${lo}</text>`; });
    g += `<text x="${W - 14}" y="${Tp + ph + 15}" text-anchor="middle" font-size="10.5" fill="#5b6675">${f2(mx)}</text><line x1="${L}" x2="${W - 14}" y1="${Tp + ph}" y2="${Tp + ph}" stroke="#b9b1a3"/>`;
    if (o.pass !== undefined && o.pass > 0) { const x = (L + (o.pass / mx) * pw).toFixed(1); g += `<line x1="${x}" x2="${x}" y1="${Tp - 6}" y2="${Tp + ph}" stroke="#c2410c" stroke-width="2" stroke-dasharray="6 4"/><text x="${+x + 5}" y="${Tp + 4}" font-size="11" fill="#c2410c" font-weight="600">Pass mark ${f2(o.pass)}</text>`; }
    return card(o, `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" ${FONT} role="img" aria-label="${esc(o.title || "")}">${g}</svg>`, o.pass !== undefined ? C.legend([["Below the pass mark", "#e8a26a"], ["Pass mark or above", "#14365d"]]) : "");
  };

  /** "Download picture": the SVG of the card as a PNG (2x). */
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-png]"); if (!b) return;
    const svg = b.closest(".chart-card").querySelector("svg"); if (!svg) return;
    const vb = svg.viewBox.baseVal, w = vb.width, h = vb.height, img = new Image();
    const src = new XMLSerializer().serializeToString(svg).replace("<svg", svg.getAttribute("xmlns") ? "<svg" : '<svg xmlns="http://www.w3.org/2000/svg"');
    img.onload = () => { const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${b.dataset.png}.png`; a.click(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
  });
})();
