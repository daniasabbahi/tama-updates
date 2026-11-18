/* "CLOs and their SLOs": SLOs by CLO domain, domain donuts, and the SLOs linked to each CLO (table left, graph right). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$;

  T.sections.slos = function () {
    const sel = T.current(), el = $("#sec-slos");
    const clos = T.closOf(sel);
    if (!clos.length) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    const slos = S.t("slos").filter((r) => String(r.course_code) === String(sel));
    const n = slos.length, ids = clos.map((c) => String(c.clo_id));
    const pct = (a) => (n ? Math.round((a / n) * 1000) / 10 : 0);
    const rows = clos.map((c) => {
      const mine = slos.filter((x) => T.s(x.clo_id) === String(c.clo_id));
      return { clo: c.clo_id, dom: c.domain, text: c.clo_text, n: mine.length, p: pct(mine.length), list: mine.map((x) => x.slo_id).join(", ") };
    });
    const unl = slos.filter((x) => !ids.includes(T.s(x.clo_id)));
    if (unl.length) rows.push({ clo: "(not linked to a CLO)", dom: "", text: "", n: unl.length, p: pct(unl.length), list: unl.map((x) => x.slo_id).join(", "), grey: true });

    const count = (arr, k) => { const o = {}; arr.forEach((r) => { const v = T.s(r[k]).trim(); o[v] = (o[v] || 0) + 1; }); return o; };
    const donuts = `<div class="grid g2 charts">${T.charts.donut(count(clos, "domain"), "CLOs by domain", Object.keys(T.CLO_DOMAINS))}${T.charts.donut(count(slos, "domain"), "SLOs by domain", T.SLO_DOMAINS)}</div>`;

    let body;
    if (!n) body = `<div class="info-box"><span>This course has no SLOs yet. Add them in the Lectures & SLOs page and this part fills in.</span></div>${donuts}`;
    else {
      const cdom = Object.fromEntries(clos.map((c) => [String(c.clo_id), T.s(c.domain).trim()]));
      const doms = [...Object.keys(T.CLO_DOMAINS), ...[...new Set(Object.values(cdom))].filter((d) => !(d in T.CLO_DOMAINS)).sort()];
      const drows = doms.map((d) => { const k = slos.filter((x) => cdom[T.s(x.clo_id)] === d).length;
        return [T.CLO_DOMAINS[d] || d || "(no domain)", Object.values(cdom).filter((v) => v === d).length, k, pct(k).toFixed(1)]; });
      if (unl.length) drows.push(["(SLOs not linked to a CLO)", 0, unl.length, pct(unl.length).toFixed(1)]);
      drows.push(["Total", clos.length, n, "100.0"]);
      const covered = rows.slice(0, clos.length).filter((r) => r.n).length;
      const missing = rows.slice(0, clos.length).filter((r) => !r.n).map((r) => r.clo);
      const msg = `${covered} of ${clos.length} CLOs (${Math.round((covered / clos.length) * 100)}%) are covered by at least one SLO.` + (missing.length ? ` Not covered yet: ${missing.join(", ")}.` : "");
      body = `<h4>SLOs by CLO domain</h4>
        <table class="tbl sum-tbl"><colgroup><col><col style="width:18%"><col style="width:18%"><col style="width:22%"></colgroup>
        <thead><tr><th>CLO domain</th><th>Number of CLOs</th><th>Number of SLOs</th><th>% of the course's SLOs</th></tr></thead>
        <tbody>${drows.map((r) => `<tr class="${r[0] === "Total" ? "total" : ""}"><td>${esc(r[0])}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td></tr>`).join("")}</tbody></table>
        <p class="note">Each SLO is counted under the domain of the CLO it is linked to (not the SLO's own domain, which the SLO chart below shows).</p>
        ${donuts}
        <div class="grid g-tg">
          <div><h4>SLOs linked to each CLO</h4>
            <table class="tbl link-tbl"><colgroup><col style="width:74px"><col style="width:72px"><col><col style="width:15%"><col style="width:76px"><col style="width:64px"><col style="width:72px"></colgroup>
            <thead><tr><th>CLO</th><th>Domain</th><th>CLO statement</th><th>SLOs</th><th>SLOs (n, %)</th><th>Number of SLOs</th><th>% of the course's SLOs</th></tr></thead>
            <tbody>${rows.map((r) => `<tr><td>${esc(r.clo)}</td><td>${esc(r.dom)}</td><td class="wrap">${esc(r.text)}</td><td class="wrap">${esc(r.list)}</td><td class="num">${r.n} (${r.p.toFixed(1)}%)</td><td class="num">${r.n}</td><td class="num">${r.p.toFixed(1)}</td></tr>`).join("")}
              <tr class="total"><td>Total</td><td></td><td></td><td></td><td class="num">${n} (100.0%)</td><td class="num">${n}</td><td class="num">100.0</td></tr></tbody></table>
            <p class="${missing.length ? "warn-text" : "ok-text"}">${esc(msg)}</p>
            <p class="note">% of the course's SLOs = the CLO's SLOs divided by all SLOs of this course. Links are set in the Lectures & SLOs page.</p></div>
          <div class="chart-card"><div class="chart-title">Graph: SLOs linked to each CLO (n, %)</div>
            ${T.charts.bars(rows.map((r) => ({ label: r.clo, value: r.n, text: `${r.n} (${r.p.toFixed(1)}%)`, tip: r.list || "-", grey: r.grey })), "Number of SLOs")}</div>
        </div>`;
    }
    el.innerHTML = `<div class="sec-head" id="h-slos"><div><h2>CLOs and their SLOs</h2><p class="sub">How the SLOs of the Lectures & SLOs page spread over this course's CLOs.</p></div><span class="count">${n} SLO${n === 1 ? "" : "s"}</span></div>${body}`;
  };
})();
