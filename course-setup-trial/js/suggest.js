/* "Suggest, then decide": a box under every recommendation / comment field. Two buttons:
   ✨ Suggest from my data (built-in rules, no AI needed) and 🤖 Suggest with AI (the user's own linked AI tool).
   The suggestion is shown first in an editable box and nothing is saved until the user chooses:
   Use this (replaces their text), Add to the end of my text, or Ignore. Only course-level numbers are sent to the AI,
   never student names or IDs. The pending suggestions live in this browser tab only (not in the data file). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $$ = T.$$;
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").trim()); return isNaN(x) ? null : x; };
  const f = (v, d = 2) => (v === null || v === undefined || isNaN(v) ? "-" : String(Math.round(v * 10 ** d) / 10 ** d));
  const tbl = (n) => (S.data.tables && S.data.tables[n]) || [];
  const mine = (n, sel) => tbl(n).filter((r) => String(r.course_code) === String(sel));
  const pending = {};   // key -> { src: "ai" | "data", items: [{ id, label, current, text }] }

  /* ---------------------------------------------------------------- course data for the AI (numbers only, no student names) */
  function context(sel) {
    const ci = S.courseInfo(sel) || {}, L = [];
    L.push(`Course: ${S.courseLabel(sel, true)}; program ${T.s(ci.program) || "-"}; level ${T.s(ci.level) || "-"}.`);
    const d = T.plan.crStore(sel);
    try {
      const rows = T.cloParts.reportRows(sel);
      if (rows.length) {
        L.push(`CLO results (actual level rule: ${d.rule === "avg" ? "average student mark on the CLO" : "% of students reaching the score threshold"}):`);
        rows.forEach((r) => { const i = r.info || {};
          L.push(`CLO ${r.no} (${r.cid}, ${{ 1: "Knowledge", 2: "Skills", 3: "Values" }[r.g]}): ${r.text} | methods: ${r.meths.join(", ") || "none"} | target ${f(r.target)}% | actual ${r.actual === null || r.actual === undefined ? "not measured" : f(r.actual) + "%"}`
            + (r.info ? ` | average mark ${f(i.avg, 1)}%, threshold ${f(i.thr, 0)}%, ${i.n} students` : "")); });
        if ((d.exclude || []).length) L.push(`Left out of the actual levels: ${d.exclude.join(", ")}.`);
      }
    } catch (e) { /* CLO page not loaded */ }
    try {
      const v = T.markSheet(sel);
      if (v && v.rows.length) {
        const g = T.msParts.crGrades(sel, v), gr = gradedRows(v), s = statsOf(gr.map((r) => r.final));
        L.push(`Student grades: started ${g.started}, completed ${g.completed}; grades ${Object.entries(g.counts).map(([k, n]) => `${k} ${n}`).join(", ")}; ` +
          Object.entries(g.status).map(([k, n]) => `${k} ${n}`).join(", ") + ".");
        if (s) L.push(`Final mark out of ${f(v.final_max, 0)}: mean ${f(s.mean, 1)}, median ${f(s.median, 1)}, SD ${f(s.sd, 1)}, lowest ${f(s.min, 1)}, highest ${f(s.max, 1)}; pass mark ${f(v.pass_mark, 1)}.`);
        const pa = perAssess(v); if (Object.keys(pa).length) L.push("Mean % per assessment: " + Object.entries(pa).map(([a, m]) => `${a} ${f(m, 1)}%`).join(", ") + ".");
        const gm = ["M", "F"].map((k) => [k, gr.filter((r) => r.gender === k).map((r) => r.final)]).filter(([, a]) => a.length);
        if (gm.length === 2) L.push("By gender: " + gm.map(([k, a]) => `${k === "M" ? "male" : "female"} ${a.length} students, mean ${f(a.reduce((x, y) => x + y, 0) / a.length, 1)}`).join("; ") + ".");
      }
    } catch (e) { /* mark sheet not loaded */ }
    mine("ia_tests", sel).forEach((t) => {
      const res = mine("ia_results", sel).filter((r) => T.s(r.assessment) === T.s(t.assessment)), lv = {};
      res.forEach((r) => { const k = T.s(r.difficulty_level) || "?"; lv[k] = (lv[k] || 0) + 1; });
      const neg = res.filter((r) => num(r.discrimination) !== null && num(r.discrimination) < 0).length;
      L.push(`Item analysis of ${T.s(t.assessment)}: ${T.s(t.students)} students, mean ${T.s(t.mean)} of ${T.s(t.total_points)}, KR-20 ${T.s(t.kr20)}; questions by difficulty ${JSON.stringify(lv)}; ${neg} with negative discrimination.`);
    });
    const lr = d.last_report || {};
    if (lr.clo) L.push("Last offering's CLO actual levels: " + Object.entries(lr.clo).map(([k, x]) => `${k}: ${f(num(x))}%`).join(", "));
    if (lr.recommendations) L.push("Last Course Report's recommendations: " + T.s(lr.recommendations).slice(0, 1200));
    const tps = Object.entries(d.topics || {}).filter(([, x]) => x && x.not_covered).map(([t, x]) => `${t} (reason: ${T.s(x.reason) || "not given"})`);
    L.push("Topics not covered: " + (tps.length ? tps.join("; ") : "none"));
    mine("actions", sel).forEach((r) => L.push(`Action (${T.s(r.offering)}): ${T.s(r.action)} [CLO ${T.s(r.clo_id) || "-"}; status ${T.s(r.status)}; achieved ${T.s(r.pct_achieved) || "?"}%; ${T.s(r.comments)}]`));
    const ev = d.eval || {};
    if (["responses", "rating", "strengths", "weaknesses"].some((k) => T.s(ev[k]).trim())) L.push(`Student survey: ${T.s(ev.responses)} responses, rating ${T.s(ev.rating)}; liked: ${T.s(ev.strengths)}; suggested improving: ${T.s(ev.weaknesses)}.`);
    return L.join("\n");
  }
  const gradedRows = (v) => v.rows.filter((r) => r.status !== "W" && r.status !== "DN" && T.s(r.letter).toUpperCase() !== "DN" && r.final !== null);
  const statsOf = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length, m = s.reduce((x, y) => x + y, 0) / n;
    return { mean: m, median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, sd: Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / n), min: s[0], max: s[n - 1] }; };
  function perAssess(v) {
    const gr = gradedRows(v), out = {};
    (v.cols || []).forEach((c) => { if (!(c.max > 0)) return; const a = gr.map((r) => num((r.marks || {})[c.key])).filter((x) => x !== null); if (a.length) out[c.label] = (a.reduce((x, y) => x + y, 0) / a.length / c.max) * 100; });
    return out;
  }

  /* ---------------------------------------------------------------- built-in drafts ("Suggest from my data"), ported from TAMA */
  function gradeComment(sel) {
    const v = T.markSheet(sel);
    if (!v || !v.rows.length) return "No marks are saved for this course yet, so the grades cannot be described.";
    const g = T.msParts.crGrades(sel, v), s = g.status, gr = gradedRows(v), st = statsOf(gr.map((r) => r.final)), out = [];
    out.push(`Of the ${g.started} students who started the course, ${g.completed} completed it` + (s.Withdrawn ? ` and ${s.Withdrawn} withdrew (${f(g.status_pct.Withdrawn, 1)}%).` : " and none withdrew."));
    const n = g.graded, c = g.counts;
    if (n && st) {
      const top = c["A+"] + c.A, mid = c["B+"] + c.B, low = ["C+", "C", "D+", "D"].reduce((a, k) => a + (c[k] || 0), 0);
      out.push(`${f((top / n) * 100, 1)}% of the students who completed the course got an A or A+, ${f((mid / n) * 100, 1)}% got a B or B+` + (low ? ` and ${f((low / n) * 100, 1)}% got a C or D grade.` : ", and no student got a C or D grade."));
      out.push(`The mean final mark was ${f(st.mean, 1)} out of ${f(v.final_max, 0)} (lowest ${f(st.min, 1)}, highest ${f(st.max, 1)}).`);
      out.push(s.Fail ? `${s.Fail} student(s) failed the course.` : "No student failed the course.");
      const sdPct = v.final_max > 0 ? (st.sd / v.final_max) * 100 : st.sd;
      out.push(sdPct >= 10 ? "The marks are spread widely, so students reached quite different levels of performance." : "The marks are close together, so most students performed at a similar level.");
    }
    const pa = perAssess(v), ks = Object.keys(pa);
    if (ks.length >= 2) { const best = ks.reduce((a, b) => (pa[b] > pa[a] ? b : a)), worst = ks.reduce((a, b) => (pa[b] < pa[a] ? b : a));
      out.push(`Students did best in ${best} (mean ${f(pa[best], 1)}% of its marks) and least well in ${worst} (mean ${f(pa[worst], 1)}%).`); }
    if ((g.status_pct.Withdrawn || 0) >= 10) out.push("The withdrawal rate is high enough to be worth following up, for example by checking attendance and workload with the students concerned.");
    if (s["Denied Entry"]) out.push(`${s["Denied Entry"]} student(s) were denied entry to the final assessment.`);
    return out.join(" ");
  }
  const cloLabel = (r, n = 60) => `${r.no} (${r.text.slice(0, n).trimEnd()}${r.text.length > n ? "..." : ""})`;
  function cloComment(sel, r) {
    const d = T.plan.crStore(sel);
    if (r.actual === null || r.actual === undefined) return "No result yet: no assessment linked to this CLO has marks. Tick an assessment for it on the Assessment plan page (or type the methods in the table) so it can be measured.";
    const i = r.info || {}, t = r.target !== null && r.target !== undefined ? r.target : 80, gap = r.actual - t;
    const used = (i.used || []).join(", ") || r.meths.join(", ") || "the linked assessments";
    const what = (d.rule || "kpi") === "kpi" ? `${f(r.actual)}% of the students reached the ${f(i.thr === undefined ? 60 : i.thr, 0)}% score threshold` : `the average student mark was ${f(r.actual)}%`;
    let txt;
    if (gap >= 5) txt = `Target met: ${what}, against a target of ${f(t)}% (exceeding it by ${f(gap)} points). The ${used} results show students achieved this outcome well, so the current teaching and assessment approach can continue.`;
    else if (gap >= 0) txt = `Target met, but only just: ${what}, against a target of ${f(t)}% (+${f(gap)} points). Keep monitoring this outcome in the next offering.`;
    else {
      txt = `Target not met: ${what}, against a target of ${f(t)}% (${f(-gap)} points short). `;
      if ((d.rule || "kpi") === "kpi" && i.avg !== undefined && i.avg !== null)
        txt += i.avg >= (i.thr === undefined ? 60 : i.thr) ? `The average mark on this outcome was ${f(i.avg, 1)}%, so many students were close to the threshold; focused practice before the assessment could close the gap. `
          : `The average mark on this outcome was only ${f(i.avg, 1)}%, so many students were well below the threshold. `;
      txt += `Review how this outcome is taught and practised, and check that the ${used} items measure it clearly.`;
    }
    const pv = num(((d.last_report || {}).clo || {})[r.no]);
    if (pv !== null) { const ch = r.actual - pv; txt += ` Last offering it was ${f(pv)}%, so it ${ch > 0.5 ? "improved" : ch < -0.5 ? "dropped" : "stayed about the same"}${Math.abs(ch) > 0.5 ? ` by ${f(Math.abs(ch))} points.` : "."}`; }
    return txt;
  }
  function recommendations(sel) {
    const rows = T.cloParts.reportRows(sel);
    if (!rows.length) return "This course has no CLOs yet. Add them in Course setup.";
    const has = (r) => r.actual !== null && r.actual !== undefined, tg = (r) => (r.target !== null && r.target !== undefined ? r.target : 80);
    const have = rows.filter(has), met = have.filter((r) => r.actual >= tg(r)), unmet = have.filter((r) => r.actual < tg(r)), none = rows.filter((r) => !has(r));
    if (!have.length) return "None of the CLOs can be measured yet: no assessment linked to them has marks. Enter the student marks (and the item analysis) and link each assessment to its CLOs on the Assessment plan page, then ask for a suggestion again.";
    const tset = [...new Set(rows.map((r) => r.target).filter((x) => x !== null && x !== undefined))];
    const out = [`${met.length} of the ${rows.length} Course Learning Outcomes met or exceeded ${tset.length === 1 ? `the target of ${f(tset[0])}%` : "their targets"}` + (met.length ? ` (${met.map((r) => r.no).join(", ")}).` : ".")];
    if (unmet.length) {
      out.push(`${unmet.length} fell short: ` + unmet.map((r) => `${cloLabel(r, 45)} at ${f(r.actual)}%`).join("; ") + ".");
      const doms = new Set(unmet.map((r) => r.g));
      if (doms.size === 1 && doms.has(2)) out.push("All the outcomes below the target are skills outcomes, which suggests students need more applied practice.");
      if (doms.size === 1 && doms.has(3)) out.push("All the outcomes below the target are values outcomes, which suggests more structured reflection and feedback on these behaviours.");
      out.push("Recommendations: (1) review the assessment items mapped to these CLOs to check they measure them clearly; (2) add more practice (case studies, exercises or role-play) targeting these outcomes, with feedback before the graded assessment; (3) set a mid-semester checkpoint to follow their achievement in the next offering.");
    } else if (have.length) out.push("Keep the current teaching strategies and assessments. For outcomes reached by all students, consider whether the threshold or the assessment is demanding enough.");
    if (none.length) out.push(`${none.map((r) => r.no).join(", ")} could not be measured: link an assessment with marks to ${none.length === 1 ? "it" : "them"} so the next report includes a result.`);
    const ex = [...(T.plan.crStore(sel).exclude || [])].sort();
    if (ex.length) out.push(`Note: ${ex.join(", ")} ${ex.length === 1 ? "was" : "were"} not included in the calculation of the actual levels.`);
    return out.join(" ");
  }

  /* ---------------------------------------------------------------- the box */
  const aiTitle = () => (T.aiReady() ? "Your own linked AI tool reads the course numbers on this page and writes a suggestion" : "Link your own AI tool first: Ask the assistant (bottom right) > Link my AI tool");
  function html(key, o) {
    o = o || {};
    const p = pending[key];
    return `<div class="sug-box" data-sugbox="${esc(key)}">
      <div class="row-btns sug-btns"><button class="btn xs" data-sugrun="data">✨ ${esc(o.dataLabel || "Suggest from my data")}</button>
        <button class="btn xs" data-sugrun="ai" ${T.aiReady() ? "" : "disabled"} title="${esc(aiTitle())}">🤖 ${esc(o.aiLabel || "Suggest with AI")}</button>
        ${T.aiReady() ? "" : `<span class="note">To get AI suggestions, link your own AI tool under Ask the assistant (bottom right).</span>`}</div>
      <p class="warn-text" data-sugmsg hidden></p>
      ${p && p.items.length ? `<div class="sug-panel"><div class="sug-head"><b>${p.src === "ai" ? "🤖 Suggested by your AI tool" : "✨ Suggested from your data"}</b>
          <span class="note">Read it and change the wording if you like. Nothing is saved until you choose Use, Add or Ignore.</span>
          <span class="sug-all">${p.items.length > 1 ? `<button class="btn xs" data-sugall="use">Use all</button>` : ""}<button class="btn xs" data-sugall="ignore">Ignore${p.items.length > 1 ? " all" : ""}</button></span></div>
        ${p.items.map((it, i) => `<div class="sug-item">${it.label ? `<div class="sug-lbl">${esc(it.label)}</div>` : ""}
          ${T.s(it.current).trim() ? `<details class="sug-cur"><summary>Your current text</summary><div>${esc(it.current)}</div></details>` : ""}
          <textarea class="sug-ta" rows="3" data-sugi="${i}" aria-label="Suggested text (you can edit it)">${esc(it.text)}</textarea>
          <div class="row-btns"><button class="btn primary xs" data-sugdo="use" data-sugi="${i}">${T.s(it.current).trim() ? "Use this instead of my text" : "Use this"}</button>
            ${T.s(it.current).trim() ? `<button class="btn xs" data-sugdo="add" data-sugi="${i}">Add to the end of my text</button>` : ""}
            <button class="btn xs" data-sugdo="ignore" data-sugi="${i}">Ignore</button></div></div>`).join("")}</div>` : ""}</div>`;
  }
  /** cfg: { items: () => [{id, label, current}], local: (id) => text, ai: async (items) => ({id: text}) | text (one item), apply: (id, text), redraw: () => void } */
  function bind(root, key, cfg) {
    const box = $$(`[data-sugbox="${CSS.escape(key)}"]`, root)[0]; if (!box) return;
    const msg = box.querySelector("[data-sugmsg]"), done = () => cfg.redraw();
    const finish = (i, mode) => {
      const p = pending[key], it = p.items[i]; if (!it) return;
      if (mode !== "ignore") { const t = T.s(it.text).trim(), cur = T.s(it.current).trim(); cfg.apply(it.id, mode === "add" && cur ? `${cur}\n\n${t}` : t); S.save(); }
      p.items.splice(i, 1); if (!p.items.length) delete pending[key];
      if (mode !== "ignore") T.toast(mode === "add" ? "Added to the end of your text." : "Suggestion used. You can still edit the text.");
      done();
    };
    $$("[data-sugrun]", box).forEach((b) => b.onclick = async () => {
      const items = cfg.items();
      if (!items.length) { T.toast(cfg.empty || "There is nothing to suggest for yet.", "warn"); return; }
      if (b.dataset.sugrun === "data") { pending[key] = { src: "data", items: items.map((it) => ({ ...it, text: cfg.local(it.id) })) }; done(); return; }
      const old = b.textContent; b.disabled = true; b.textContent = "🤖 Asking your AI tool... (up to a minute)"; msg.hidden = true;
      try {
        const got = await cfg.ai(items);
        const map = typeof got === "string" ? { [items[0].id]: got } : got || {};
        const list = items.filter((it) => T.s(map[it.id]).trim()).map((it) => ({ ...it, text: T.s(map[it.id]).trim() }));
        if (!list.length) throw new Error("the AI answer had no usable text. Try again.");
        pending[key] = { src: "ai", items: list }; done();
      } catch (e) { b.disabled = false; b.textContent = old; msg.hidden = false; msg.textContent = "Your AI tool could not answer: " + e.message; }
    });
    $$(".sug-ta", box).forEach((ta) => { T.autoGrow(ta); ta.oninput = () => { pending[key].items[+ta.dataset.sugi].text = ta.value; T.autoGrow(ta); }; });
    $$("[data-sugdo]", box).forEach((b) => b.onclick = () => finish(+b.dataset.sugi, b.dataset.sugdo));
    $$("[data-sugall]", box).forEach((b) => b.onclick = () => {
      const p = pending[key]; if (!p) return;
      if (b.dataset.sugall === "use") { p.items.forEach((it) => cfg.apply(it.id, T.s(it.text).trim())); S.save(); T.toast(`${p.items.length} suggestions used. You can still edit them.`); }
      delete pending[key]; done();
    });
  }
  /** One AI text for one field: the course data, the task and the user's current draft (kept and improved if there is one). */
  const askText = (sel, task, current) => T.aiAsk(`COURSE DATA\n${context(sel)}\n\nTASK\n${task}` + (T.s(current).trim() ? `\n\nThe coordinator's current draft (improve it, keep its facts):\n${current}` : ""));
  const TASKS = {
    grade_comment: "Write the 'Comment on Student Grades' (section A2): describe the grade distribution and completion, and the particular factors that may have affected the results. 80-150 words.",
    text: "Write 'Overall Student Evaluation and Comments' (section E): summarise the students' views from the survey data if given, and add appropriate statements about student performance based on the grades and CLO results (if there is no survey data, say that survey results should be added). 80-160 words.",
    recommendations: "Write the 'Recommendations' (section B2) based on the CLO results: which CLOs met the target, which did not and possible reasons, and specific, practical recommendations for teaching and assessment. 120-220 words.",
  };

  /* ---------------------------------------------------------------- the same, for whole table rows (e.g. improvement-plan rows) */
  const rowPending = {};
  function rowsHtml(key, o) {
    o = o || {};
    const p = rowPending[key];
    return `<div class="sug-box" data-sugrows="${esc(key)}">
      <div class="row-btns sug-btns"><button class="btn xs" data-sugrun="data">✨ ${esc(o.dataLabel || "Suggest rows from my data")}</button>
        <button class="btn xs" data-sugrun="ai" ${T.aiReady() ? "" : "disabled"} title="${esc(aiTitle())}">🤖 ${esc(o.aiLabel || "Suggest rows with AI")}</button>
        ${T.aiReady() ? "" : `<span class="note">To get AI suggestions, link your own AI tool under Ask the assistant (bottom right).</span>`}</div>
      <p class="warn-text" data-sugmsg hidden></p>
      ${p && p.rows.length ? `<div class="sug-panel"><div class="sug-head"><b>${p.src === "ai" ? "🤖 Suggested by your AI tool" : "✨ Suggested from your data"}</b>
          <span class="note">Change the wording if you like, then add the rows you want. Nothing is added until you choose.</span>
          <span class="sug-all">${p.rows.length > 1 ? `<button class="btn xs" data-sugall="use">Add all</button>` : ""}<button class="btn xs" data-sugall="ignore">Ignore${p.rows.length > 1 ? " all" : ""}</button></span></div>
        ${p.rows.map((r, i) => `<div class="sug-item"><div class="sug-rgrid">${o.fields.map(([k, l]) => `<label class="sug-rf ${o.wide && o.wide.includes(k) ? "w" : ""}"><span>${esc(l)}</span><textarea class="sug-ta" rows="2" data-sugi="${i}" data-sugk="${esc(k)}">${esc(r[k] || "")}</textarea></label>`).join("")}</div>
          <div class="row-btns"><button class="btn primary xs" data-sugdo="use" data-sugi="${i}">${esc(o.addLabel || "Add this row")}</button><button class="btn xs" data-sugdo="ignore" data-sugi="${i}">Ignore</button></div></div>`).join("")}</div>` : ""}</div>`;
  }
  /** cfg: { local: () => rows, ai: async () => rows, add: (row) => void, redraw, empty } */
  function bindRows(root, key, cfg) {
    const box = $$(`[data-sugrows="${CSS.escape(key)}"]`, root)[0]; if (!box) return;
    const msg = box.querySelector("[data-sugmsg]");
    $$("[data-sugrun]", box).forEach((b) => b.onclick = async () => {
      if (b.dataset.sugrun === "data") { const rows = cfg.local(); if (!rows.length) { T.toast(cfg.empty || "No new suggestion from your data.", "warn"); return; } rowPending[key] = { src: "data", rows }; cfg.redraw(); return; }
      const old = b.textContent; b.disabled = true; b.textContent = "🤖 Asking your AI tool... (up to a minute)"; msg.hidden = true;
      try { const rows = (await cfg.ai()) || []; if (!rows.length) throw new Error("the AI answer had no usable rows. Try again."); rowPending[key] = { src: "ai", rows }; cfg.redraw(); }
      catch (e) { b.disabled = false; b.textContent = old; msg.hidden = false; msg.textContent = "Your AI tool could not answer: " + e.message; }
    });
    $$(".sug-ta", box).forEach((ta) => { T.autoGrow(ta); ta.oninput = () => { rowPending[key].rows[+ta.dataset.sugi][ta.dataset.sugk] = ta.value; T.autoGrow(ta); }; });
    $$("[data-sugdo]", box).forEach((b) => b.onclick = () => {
      const p = rowPending[key], i = +b.dataset.sugi; if (!p || !p.rows[i]) return;
      if (b.dataset.sugdo === "use") { cfg.add(p.rows[i]); S.save(); T.toast("Row added. You can still edit it in the table."); }
      p.rows.splice(i, 1); if (!p.rows.length) delete rowPending[key]; cfg.redraw();
    });
    $$("[data-sugall]", box).forEach((b) => b.onclick = () => {
      const p = rowPending[key]; if (!p) return;
      if (b.dataset.sugall === "use") { p.rows.forEach((r) => cfg.add(r)); S.save(); T.toast(`${p.rows.length} rows added. You can still edit them.`); }
      delete rowPending[key]; cfg.redraw();
    });
  }

  T.sug = { html, bind, rowsHtml, bindRows, context, askText, TASKS, gradeComment, cloComment, recommendations, pending, gradedRows, statsOf, perAssess };
})();
