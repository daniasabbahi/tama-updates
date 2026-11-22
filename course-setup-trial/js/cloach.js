/* CLO achievement (TAMA render_slo_clo_rollup + render_clo_report_section), rebuilt 2026-11-22.
   Method (item analysis / student marks / both) is kept in ui_settings.clo_method[course] with TAMA's own labels; assessments left out
   in clo_exclude[course]; results typed for assessments without an item analysis in tables.slo_other (course_code, assessment, slo_id,
   mean_difficulty 0 to 1); the course report part in course_report[course] (rule, exclude, methods, actual, clo_comments, recommendations). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const ui = () => (S.data.ui_settings = S.data.ui_settings || {});
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").trim()); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const r1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
  const mine = (n, sel) => tbl(n).filter((r) => String(r.course_code) === String(sel));
  const split = (v) => T.s(v).split(/[,;/\n]+/).map((x) => x.trim()).filter((x) => x && !["nan", "none"].includes(x.toLowerCase()));
  const lc = (s) => T.s(s).trim().toLowerCase();
  const natKey = (s) => T.s(s).split(/(\d+)/).map((p, i) => (i % 2 ? p.padStart(8, "0") : p.toLowerCase())).join("");
  const natSort = (a) => a.slice().sort((x, y) => (natKey(x) < natKey(y) ? -1 : natKey(x) > natKey(y) ? 1 : 0));
  const M_IA = "📊 Item analysis (difficulty factor)", M_MK = "📝 Student marks", M_CMP = "⚖️ Compare both methods";
  const METHODS = [[M_IA, "Item analysis (difficulty factor)"], [M_MK, "Student marks"], [M_CMP, "Compare both methods"]];
  const CA_NAME = /^\s*(ca|c\.a\.?|continuous\s+assessments?)\s*$/i;
  const COL_IA = "#5c8f6b", COL_MK = "#14365d", COL_TG = "#9aa3b2";
  const MP = () => T.marksParts;

  /* ---------------------------------------------------------------- results of each outcome in each assessment (0 to 1) */
  function sloResults(sel) {   // TAMA slo_results: mean difficulty from item analyses, typed results, partial-marks KPI
    const acc = {};
    mine("ia_results", sel).forEach((r) => { const o = T.s(r.outcome_id).trim(), d = num(r.difficulty); if (!o || o === "None" || d === null) return; const k = `${T.s(r.assessment)}||${o}`; (acc[k] = acc[k] || []).push(d); });
    const out = Object.entries(acc).map(([k, v]) => { const [a, o] = k.split("||"); return { assessment: a, slo_id: o, v: v.reduce((x, y) => x + y, 0) / v.length }; });
    mine("slo_other", sel).forEach((r) => { const v = num(r.mean_difficulty); if (v !== null && T.s(r.assessment).trim() && T.s(r.slo_id).trim()) out.push({ assessment: T.s(r.assessment), slo_id: T.s(r.slo_id), v, typed: true }); });
    (T.iaPartialResults ? T.iaPartialResults(sel) : []).forEach((r) => out.push({ assessment: r.assessment, slo_id: r.slo_id, v: r.mean_difficulty }));
    return out;
  }
  function ticks(sel, via) {   // {outcome: set of lower-case assessment names ticked in the Assessment plan}
    const o = {}; (via ? mine("slos", sel).map((r) => [r.slo_id, r.assessment_methods]) : mine("clo_plan", sel).map((r) => [r.clo_id, r.assessment_methods])).forEach(([i, m]) => { o[T.s(i)] = new Set(split(m).map(lc)); });
    return o;
  }
  function gradeResults(sel, ids, via) {   // TAMA grade_results: share of the marks students earned, per assessment and outcome
    const out = [], tk = ticks(sel, via), full = {}; MP().cas(sel).forEach((r) => { full[r.assessment] = num(r.full_grade); });
    const idset = new Set(ids);
    // an uploaded mark sheet (its columns linked to assessments)
    if (T.markSheetSource(sel) === "upload") { const rec = (S.data.mark_sheets || {})[String(sel)];
      if (rec && rec.max) { const cmap = rec.map || T.msParts.defaultMap(sel, rec), act = rec.rows.filter((r) => !r.withdrawn);
        Object.entries(rec.max).forEach(([col, mx]) => { const name = T.s(cmap[col]).trim(), vals = act.filter((r) => r.marks && r.marks[col] !== null && r.marks[col] !== undefined).map((r) => Math.min(Math.max(r.marks[col], 0), mx) / mx);
          if (!name || !vals.length) return; const sh = vals.reduce((a, b) => a + b, 0) / vals.length; ids.forEach((i) => { if ((tk[i] || new Set()).has(lc(name))) out.push({ assessment: name, slo_id: i, v: sh }); }); }); } }
    const ms = T.markSheetSource(sel) === "marks" ? T.markSheet(sel) : null, out0 = new Set(ms ? ms.rows.filter((r) => r.status === "W" || r.status === "DN").map((r) => r.key) : []);   // withdrawn / denied entry left out
    const marks = mine("marks", sel).filter((r) => num(r.marks_awarded) !== null && !out0.has(T.s(r.student_id)));
    // tests entered as one total per student
    const tot = {}; marks.filter((r) => T.s(r.question_id).toUpperCase() === "TOTAL").forEach((r) => { (tot[T.s(r.assessment)] = tot[T.s(r.assessment)] || []).push(num(r.marks_awarded)); });
    Object.entries(tot).forEach(([a, xs]) => { const mx = full[a]; if (!(mx > 0)) return; const sh = xs.reduce((s, x) => s + Math.min(Math.max(x, 0), mx) / mx, 0) / xs.length; ids.forEach((i) => { if ((tk[i] || new Set()).has(lc(a))) out.push({ assessment: a, slo_id: i, v: sh }); }); });
    // marks of each question, through the questions' links
    const qs = {}; mine("questions", sel).forEach((q) => { qs[`${T.s(q.assessment)}||${T.s(q.question_id)}`] = { mx: num(q.max_marks), ids: split(via ? q.slos : q.clos).filter((x) => idset.has(x)) }; });
    const per = {};
    marks.forEach((r) => { const q = qs[`${T.s(r.assessment)}||${T.s(r.question_id)}`]; if (!q || q.mx === null || !q.ids.length) return; const got = Math.min(Math.max(num(r.marks_awarded), 0), q.mx);
      q.ids.forEach((i) => { const k = `${T.s(r.assessment)}||${i}||${T.s(r.student_id)}`; per[k] = per[k] || [0, 0]; per[k][0] += got; per[k][1] += q.mx; }); });
    const agg = {}; Object.entries(per).forEach(([k, [g, m]]) => { if (!(m > 0)) return; const [a, i] = k.split("||"); (agg[`${a}||${i}`] = agg[`${a}||${i}`] || []).push(g / m); });
    Object.entries(agg).forEach(([k, v]) => { const [a, i] = k.split("||"); out.push({ assessment: a, slo_id: i, v: v.reduce((x, y) => x + y, 0) / v.length }); });
    return out;
  }
  function wide(rows, ids, order) {   // outcome -> assessment -> mean, plus the Average of the assessments
    const w = {}; ids.forEach((i) => { w[i] = {}; });
    const acc = {}; rows.forEach((r) => { if (!(r.slo_id in w) || !order.includes(r.assessment)) return; const k = `${r.slo_id}||${r.assessment}`; (acc[k] = acc[k] || []).push(r.v); });
    Object.entries(acc).forEach(([k, v]) => { const [i, a] = k.split("||"); w[i][a] = v.reduce((x, y) => x + y, 0) / v.length; });
    ids.forEach((i) => { const vs = order.map((a) => w[i][a]).filter((x) => x !== undefined); w[i].__avg = vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null; });
    return w;
  }
  function bases(sel) {
    const b = new Set(); mine("plans", sel).forEach((r) => { if (["CLOs", "SLOs"].includes(r.basis)) b.add(r.basis); });
    const q = mine("questions", sel); if (q.some((r) => T.s(r.slos).trim())) b.add("SLOs"); if (q.some((r) => r.map_basis === "CLOs")) b.add("CLOs");
    const cids = new Set(mine("clos", sel).map((r) => T.s(r.clo_id)));
    mine("ia_map", sel).forEach((r) => { const o = T.s(r.outcome_id); if (/^slo/i.test(o)) b.add("SLOs"); else if (/^clo/i.test(o) || cids.has(o)) b.add("CLOs"); });
    if (mine("clo_plan", sel).some((r) => T.s(r.assessment_methods).trim())) b.add("CLOs");
    if (mine("slos", sel).some((r) => T.s(r.assessment_methods).trim())) b.add("SLOs");
    return b;
  }

  /** Everything the page shows, worked out once per draw. */
  function compute(sel) {
    const mm = ui().clo_method = ui().clo_method || {}; let method = mm[String(sel)]; if (!METHODS.some((m) => m[0] === method)) method = M_IA;
    const bs = bases(sel), routeSaved = (S.ui.cloRoute || {})[sel], via = routeSaved ? routeSaved === "via" : !(bs.size === 1 && bs.has("CLOs"));
    const sl = mine("slos", sel), cl = mine("clos", sel), ids = (via ? sl.map((r) => T.s(r.slo_id)) : cl.map((r) => T.s(r.clo_id))).filter(Boolean), unit = via ? "SLO" : "CLO";
    const ca = MP().cas(sel), res0 = sloResults(sel), gr0 = gradeResults(sel, ids, via);
    const allA = [...new Set([...ca.map((r) => r.assessment), ...res0.map((r) => r.assessment), ...gr0.map((r) => r.assessment)].filter((a) => T.s(a).trim()))];
    const excl = new Set(((S.data.clo_exclude || {})[String(sel)] || []).filter((a) => allA.includes(a)));
    const idset = new Set(ids), res = res0.filter((r) => idset.has(r.slo_id) && !excl.has(r.assessment)), gr = gr0.filter((r) => !excl.has(r.assessment));
    const iaNames = [...new Set(mine("ia_results", sel).filter((r) => idset.has(T.s(r.outcome_id)) && !excl.has(T.s(r.assessment))).map((r) => T.s(r.assessment)))];
    const order = [...new Set([...ca.map((r) => r.assessment), ...res.map((r) => r.assessment), ...gr.map((r) => r.assessment)])].filter((a) => !excl.has(a));
    const grNames = new Set(gr.map((r) => r.assessment)), hand = res.filter((r) => !iaNames.includes(r.assessment) && !grNames.has(r.assessment));
    const W = wide(res, ids, order), Wg = wide(gr.concat(hand), ids, order);
    const meths = T.plan.methods(sel), types = (txt) => { const got = new Set(split(txt).map((x) => x.toUpperCase())); return meths.filter((m) => got.has(m.toUpperCase())).join(", "); };
    const sloTypes = Object.fromEntries(sl.map((r) => [T.s(r.slo_id), types(r.assessment_methods)])), cloTypes = Object.fromEntries(mine("clo_plan", sel).map((r) => [T.s(r.clo_id), types(r.assessment_methods)]));
    const rows = cl.map((c) => {
      const cid = T.s(c.clo_id), linked = sl.filter((s) => split(s.clo_id).includes(cid)).map((s) => T.s(s.slo_id));
      const actual = (w) => { let v; if (via) { const vs = linked.map((x) => (w[x] ? w[x].__avg : null)).filter((x) => x !== null && x !== undefined); v = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; } else v = w[cid] ? w[cid].__avg : null; return v === null || v === undefined ? null : r1(v * 100); };
      let target = num(c.target_pct); if (target === null) target = 70;
      const a = actual(W), ag = actual(Wg), lvl = (x) => (x !== null && target ? r1((x / target) * 100) : null);
      return { cid, text: T.s(c.clo_text), target, a, la: lvl(a), ag, lag: lvl(ag), types: cloTypes[cid] || meths.filter((m) => linked.some((x) => (sloTypes[x] || "").split(", ").includes(m))).join(", "),
        withR: via ? linked.filter((x) => W[x] && W[x].__avg !== null) : [], withoutR: via ? linked.filter((x) => !(W[x] && W[x].__avg !== null)) : [] };
    });
    return { method, via, bs, ids, unit, sl, cl, ca, allA, excl, res, gr, iaNames, order, W, Wg, rows, sloTypes, cloTypes };
  }

  /* ---------------------------------------------------------------- page sections */
  let C = null;   // the last computation
  const kpiCls = (a, t) => (a === null || t === null ? "" : r1(a) < r1(t) ? "kpi-below" : r1(a) === r1(t) ? "kpi-on" : "kpi-above");
  T.sections.cloMethod = function () {
    const sel = T.current(), el = $("#sec-clm"); if (!el) return;
    C = compute(sel); const { method, via, bs } = C;
    const linkedTxt = bs.size === 2 ? "linked to <b>both CLOs and SLOs</b>" : bs.has("SLOs") ? "linked to <b>SLOs</b> (and the SLOs are linked to CLOs)" : bs.has("CLOs") ? "linked directly to <b>CLOs</b>" : "";
    el.innerHTML = `<div class="sec-head" id="h-clm"><div><h2>How CLO achievement is measured</h2><p class="sub">Choose the method; the steps below show what is already done for ${esc(T.baseCode(sel))}.</p></div></div>
      <div class="fld"><span class="lbl">How do you want to measure CLO achievement? <i class="hint" title="Item analysis: from the difficulty factor (p) of the questions. Student marks: from the marks the students got. Compare: each CLO measured both ways, side by side.">?</i></span>
        <div class="seg">${METHODS.map(([v, l]) => `<button class="${method === v ? "on" : ""}" data-clmeth="${esc(v)}">${l}</button>`).join("")}</div></div>
      <div class="info-box"><span>${linkedTxt ? `The assessments of <b>${esc(T.baseCode(sel))}</b> are ${linkedTxt}.` : `No assessment of <b>${esc(T.baseCode(sel))}</b> is linked to CLOs or SLOs yet (Blueprint and Exam builder, Exam results, or the Assessment plan ticks).`}</span></div>
      <div class="fld"><span class="lbl">The route from the assessments to the CLOs</span><div class="seg"><button class="${via ? "on" : ""}" data-clroute="via">Via SLOs (assessments → SLOs → CLOs)</button><button class="${via ? "" : "on"}" data-clroute="direct">Directly (assessments → CLOs)</button></div></div>
      ${steps(sel)}`;
    $$("[data-clmeth]", el).forEach((b) => b.onclick = () => { ui().clo_method[String(sel)] = b.dataset.clmeth; S.save(); drawAll(); });
    $$("[data-clroute]", el).forEach((b) => b.onclick = () => { S.ui.cloRoute = S.ui.cloRoute || {}; S.ui.cloRoute[sel] = b.dataset.clroute; S.saveUi(); drawAll(); });
  };
  function steps(sel) {
    const { method, via } = C, unit = via ? "SLOs" : "CLOs";
    const q = mine("questions", sel).filter((r) => T.s(via ? r.slos : r.clos).trim()), qEx = [...new Set(q.map((r) => T.s(r.assessment)))];
    const ia = [...new Set([...mine("ia_tests", sel).map((r) => T.s(r.assessment)), ...Object.keys(ui().ia_partial || {}).filter((k) => k.startsWith(`${sel}||`)).map((k) => k.split("||")[1])])];
    const names = C.ca.map((r) => r.assessment), done = MP().marked(sel), miss = names.filter((a) => !done[a]), tk = Object.values(ticks(sel, via)).some((s) => s.size);
    const noIA = names.filter((a) => !ia.includes(a));
    const box = (title, list) => `<div class="cl-steps"><b>${title}</b>${list.map(([ok, t], i) => `<div class="cl-step ${ok ? "ok" : ""}"><span class="cl-tick">${ok ? "✓" : i + 1}</span><span><b>Step ${i + 1}.</b> ${t}</span></div>`).join("")}</div>`;
    let h = "";
    if (method !== M_MK) h += box("Route: item analysis (difficulty factor)", [
      [qEx.length > 0 || mine("ia_map", sel).length > 0, `Link each exam question to its ${unit.slice(0, -1)}: <a href="#exam-blueprint">Blueprint and Exam builder</a>, or by hand in the item analysis. ${qEx.length ? `Done for: ${qEx.map(esc).join(", ")}.` : "Not done yet."}`],
      [ia.length > 0, `Go to <a href="#exam-results">Exam results and item analysis</a>, choose the test, then its question type: MCQ (upload or type the item analysis report) and/or assessments and questions with partial marks. ${ia.length ? `Saved: ${ia.map(esc).join(", ")}.` : "None saved yet."}`],
      [!noIA.length, `Every assessment and its sub-categories need an item analysis. For assessments that are not MCQ (OSCE, project, presentation, assignment, essays ...), choose <b>Assessments and questions with partial marks</b> on the same page: it gives their difficulty factor. ${noIA.length ? `No item analysis yet: ${noIA.map(esc).join(", ")}.` : "Done for every assessment."}`],
      [ia.length > 0, "Read the result in the table below."]]);
    if (method !== M_IA) h += box("Route: student marks", [
      [names.length > 0, `List the assessments of the course and the full mark of each: <a href="#assessment-plan">Assessment plan</a>. ${names.length ? `${names.length} listed.` : "None listed yet."}`],
      [qEx.length > 0 || tk, `Link each assessment to its ${unit}: link the questions in the Exam builder (marks of each question), or tick the assessment for its ${unit} on the Assessment plan page (total marks).`],
      [Object.keys(done).length > 0 && !miss.length, `Enter the students' marks: <a href="#student-marks">Student marks</a> (each test), or upload the whole mark sheet on the <a href="#mark-sheet">Course mark sheet</a> page. ${Object.keys(done).length ? `Done: ${Object.keys(done).map(esc).join(", ")}.` : "None yet."}${miss.length && Object.keys(done).length ? ` Still missing: ${miss.map(esc).join(", ")}.` : ""}`],
      [Object.keys(done).length > 0, "Read the result in the table below."]]);
    return `<div class="cl-route">${h}</div>${method === M_CMP ? `<p class="note">Both routes are needed to compare: the table and chart below show each CLO measured both ways.</p>` : ""}`;
  }

  T.sections.cloResults = function () {
    const sel = T.current(), el = $("#sec-clres"); if (!el || !C) return;
    const { method, allA, excl, rows, order, gr, via, unit } = C;
    const typ = Object.fromEntries(C.ca.map((r) => [r.assessment, r.type || ""])), iaSaved = new Set(mine("ia_tests", sel).map((r) => T.s(r.assessment)));
    const showIA = method !== M_MK, showMK = method !== M_IA;
    const head = `<tr><th>CLO</th><th style="min-width:260px">Statement</th><th class="ctr">Target %</th>${showIA ? '<th class="ctr">Actual %<span class="mg-out">item difficulty</span></th><th class="ctr">Achievement %<span class="mg-out">item difficulty</span></th>' : ""}${showMK ? '<th class="ctr">Actual %<span class="mg-out">student grades</span></th><th class="ctr">Achievement %<span class="mg-out">student grades</span></th>' : ""}${method === M_CMP ? '<th class="ctr">Difference<span class="mg-out">marks − item analysis</span></th>' : ""}</tr>`;
    const body = rows.map((r) => `<tr><td><b>${esc(r.cid)}</b></td><td class="cl-txt">${esc(r.text)}</td><td class="ctr">${g2(r.target)}</td>
      ${showIA ? `<td class="ctr ${kpiCls(r.a, r.target)}">${g2(r.a)}</td><td class="ctr ${kpiCls(r.a, r.target)}">${g2(r.la)}</td>` : ""}
      ${showMK ? `<td class="ctr ${kpiCls(r.ag, r.target)}">${g2(r.ag)}</td><td class="ctr ${kpiCls(r.ag, r.target)}">${g2(r.lag)}</td>` : ""}
      ${method === M_CMP ? `<td class="ctr">${r.lag !== null && r.la !== null ? g2(r1(r.lag - r.la)) : ""}</td>` : ""}</tr>`).join("");
    const met = rows.filter((r) => { const x = showMK && !showIA ? r.ag : r.a; return x !== null && r1(x) >= r1(r.target); }).length, withR = rows.filter((r) => (showMK && !showIA ? r.ag : r.a) !== null).length;
    el.innerHTML = `<div class="sec-head" id="h-clres"><div><h2>CLO achievement of ${esc(T.baseCode(sel))}</h2><p class="sub">Target = the CLO's target in Course setup. Achievement = Actual ÷ Target × 100.</p></div></div>
      ${allA.length ? `<details class="sum-box" ${excl.size ? "open" : ""}><summary>Assessments used (${allA.length - excl.size} of ${allA.length} included)</summary>
        <div class="bp-wrap"><table class="tbl xs-tbl" style="max-width:640px"><thead><tr><th class="ctr" style="width:70px">Include</th><th>Assessment</th><th>Type</th><th class="ctr">Item analysis saved</th></tr></thead><tbody>
        ${allA.map((a) => `<tr><td class="ctr"><input type="checkbox" data-clinc="${esc(a)}" ${excl.has(a) ? "" : "checked"}></td><td><b>${esc(a)}</b></td><td>${esc(typ[a] || "")}</td><td class="ctr">${iaSaved.has(a) ? "Yes" : ""}</td></tr>`).join("")}</tbody></table></div>
        <p class="note">Untick an assessment to leave it out of the results. Your choice is saved for this course.</p></details>` : `<p class="note">No assessments yet. They come from the Assessment plan, Blueprint and Exam builder and Exam results.</p>`}
      ${rows.length ? `${withR ? `<div class="kcards ms-k"><div class="kcard"><div class="lab">CLOs</div><div class="big">${rows.length}</div></div><div class="kcard"><div class="lab">CLOs with a result</div><div class="big">${withR}</div></div><div class="kcard"><div class="lab">Reached the target</div><div class="big">${met}</div></div><div class="kcard"><div class="lab">Below the target</div><div class="big">${withR - met}</div></div></div>` : ""}
        <div class="bp-wrap" style="overflow-x:auto"><table class="tbl cl-tbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>
        <div class="ir-legend"><span class="kpi-below">Below the target</span> <span class="kpi-on">Exactly the target (100%)</span> <span class="kpi-above">Above the target</span></div>
        <p class="note">${showIA ? `<b>Item difficulty</b>: the mean difficulty factor (p) of the questions of the ${via ? "SLOs linked to the CLO" : "CLO"} from the item analyses; ` : ""}${showMK ? `<b>Student grades</b>: the average share of the marks each student earned on the questions of the ${via ? "SLOs linked to the CLO" : "CLO"} (Student marks), plus tests with a total mark or mark-sheet assessments that the Assessment plan ticks for the outcome (each assessment counts equally; withdrawn students are left out).` : ""}</p>
        ${showMK && !gr.length ? `<p class="warn-text">The student-marks results stay empty until student marks are added on the Student marks page.</p>` : ""}
        ${!order.length ? `<div class="alert-box"><span class="alert-ic">⚠</span><span>No results yet. Save an item analysis with its questions linked to the ${unit}s, enter student marks, or type results below.</span></div>` : ""}
        <div class="row-btns"><button class="btn sm" id="cl-xl">Download the CLO achievement (Excel)</button></div>`
        : `<p class="note">This course has no CLOs yet. Add them in Course setup.</p>`}`;
    $$("[data-clinc]", el).forEach((b) => b.onchange = () => { const all = (S.data.clo_exclude = S.data.clo_exclude || {}), cur = new Set(all[String(sel)] || []); if (b.checked) cur.delete(b.dataset.clinc); else cur.add(b.dataset.clinc); all[String(sel)] = [...cur]; S.save(); drawAll(); });
    const xl = $("#cl-xl", el); if (xl) xl.onclick = () => excel(sel);
  };

  T.sections.cloCharts = function () {
    const sel = T.current(), el = $("#sec-clch"); if (!el || !C) return;
    const { method, rows, via, unit, ids, W, Wg, order } = C, cats = rows.map((r) => r.cid);
    const has = (k) => rows.some((r) => r[k] !== null);
    let h = "";
    if (method === M_CMP && (has("la") || has("lag"))) h += T.charts.groupBars({ title: "Achievement of each CLO, both ways", sub: "(% of its target)", cats, series: [{ name: "Item analysis", color: COL_IA, values: rows.map((r) => r.la) }, { name: "Student marks", color: COL_MK, values: rows.map((r) => r.lag) }], yTitle: "Achievement %", max: Math.max(125, Math.ceil(Math.max(...rows.map((r) => Math.max(r.la || 0, r.lag || 0))) * 1.1 / 25) * 25), ref: { value: 100, label: "Target reached (100%)", color: "#c2410c" }, file: `clo_compare_${T.baseCode(sel)}` });
    const actualSeries = [{ name: "Target", color: COL_TG, values: rows.map((r) => r.target) }, ...(method !== M_MK && has("a") ? [{ name: "Actual (item difficulty)", color: COL_IA, values: rows.map((r) => r.a) }] : []), ...(method !== M_IA && has("ag") ? [{ name: "Actual (student grades)", color: COL_MK, values: rows.map((r) => r.ag) }] : [])];
    if (actualSeries.length > 1) h += T.charts.groupBars({ title: "Actual result of each CLO against its target", sub: "(%)", cats, series: actualSeries, max: 100, yTitle: "%", file: `clo_actual_${T.baseCode(sel)}` });
    // per outcome x assessment heat table
    const heat = (w, label) => { const used = order.filter((a) => ids.some((i) => w[i] && w[i][a] !== undefined)); if (!used.length) return "";
      return `<h3 class="qm-h">${esc(unit)} results in each assessment (%): ${label}</h3><div class="bp-wrap" style="overflow-x:auto"><table class="tbl xs-tbl cl-heat"><thead><tr><th>${unit}</th>${via ? "<th>CLO</th>" : ""}${used.map((a) => `<th class="ctr">${esc(a)}</th>`).join("")}<th class="ctr">Average</th></tr></thead><tbody>
        ${ids.map((i) => { const s = via ? C.sl.find((r) => T.s(r.slo_id) === i) : null; return `<tr><td><b>${esc(i)}</b></td>${via ? `<td>${esc(T.s(s && s.clo_id))}</td>` : ""}${used.map((a) => { const v = w[i] ? w[i][a] : undefined; return `<td class="ctr" style="${v === undefined ? "" : `background:${shade(v)};color:${v > 0.75 ? "#fff" : "#14365d"}`}">${v === undefined ? "" : g2(v * 100)}</td>`; }).join("")}<td class="ctr"><b>${w[i] && w[i].__avg !== null ? g2(w[i].__avg * 100) : ""}</b></td></tr>`; }).join("")}</tbody></table></div>`; };
    const hIA = method !== M_MK ? heat(W, "item difficulty") : "", hMK = method !== M_IA ? heat(Wg, "student grades") : "";
    el.innerHTML = `<div class="sec-head" id="h-clch"><div><h2>Charts</h2><p class="sub">Each chart can be downloaded as a picture for your report.</p></div></div>
      ${h ? `<div class="ms-charts">${h}</div>` : `<p class="note">The charts appear as soon as a CLO has a result.</p>`}
      ${hIA}${hMK}${hIA || hMK ? `<p class="note">Darker cells are higher results. Empty cells: the assessment does not measure that ${unit}, or has no result yet.</p>` : ""}`;
  };
  const shade = (v) => { const t = Math.max(0, Math.min(1, v)); const a = [233, 240, 250], b = [20, 54, 93]; return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(",")})`; };

  T.sections.cloDetails = function () {
    const sel = T.current(), el = $("#sec-cldet"); if (!el || !C) return;
    const { rows, via, unit, ids, ca, order, iaNames, gr } = C;
    const grN = new Set(gr.map((r) => r.assessment)), hand = order.filter((a) => !iaNames.includes(a) && !grN.has(a));
    const so = mine("slo_other", sel), val = (i, a) => { const r = so.find((x) => T.s(x.slo_id) === i && T.s(x.assessment) === a); return r ? num(r.mean_difficulty) : null; };
    const info = via ? Object.fromEntries(C.sl.map((r) => [T.s(r.slo_id), T.s(r.slo_text)])) : Object.fromEntries(C.cl.map((r) => [T.s(r.clo_id), T.s(r.clo_text)]));
    el.innerHTML = `<div class="sec-head" id="h-cldet"><div><h2>Details</h2></div></div>
      <details class="sum-box"><summary>How each CLO result was built</summary><div class="bp-wrap"><table class="tbl xs-tbl"><thead><tr><th>CLO</th><th>Assessment types</th>${via ? "<th>SLOs with results</th><th>SLOs without results</th>" : ""}</tr></thead><tbody>
        ${rows.map((r) => `<tr><td><b>${esc(r.cid)}</b></td><td>${esc(r.types)}</td>${via ? `<td>${esc(r.withR.join(", "))}</td><td>${esc(r.withoutR.join(", "))}</td>` : ""}</tr>`).join("")}</tbody></table></div></details>
      <details class="sum-box"><summary>Assessments and full marks (${ca.length})</summary>${ca.length ? `<div class="bp-wrap"><table class="tbl xs-tbl" style="max-width:560px"><thead><tr><th>Assessment</th><th>Type</th><th class="ctr">Full mark</th></tr></thead><tbody>${ca.map((r) => `<tr><td><b>${esc(r.assessment)}</b></td><td>${esc(r.type || "")}</td><td class="ctr">${r.full_grade === null || r.full_grade === undefined ? "-" : g2(r.full_grade)}</td></tr>`).join("")}</tbody></table></div><p class="note">${ca.length} assessments · total of full marks: ${g2(ca.reduce((a, r) => a + (num(r.full_grade) || 0), 0))}. Change them on the Assessment plan page.</p>` : `<p class="note">No assessments yet. Add them on the Assessment plan page.</p>`}</details>
      ${so.length ? `<details class="sum-box"><summary>Results typed by hand (from an older file)</summary><p class="note">Every assessment should now get its difficulty factor from the item analysis or from <b>Assessments and questions with partial marks</b> on the Exam results page. These values were typed by hand in an older file; they are used only for assessments without an item analysis or marks. Clear a box to remove it.</p>
        ${!ids.length || !hand.length ? `<p class="note">Nothing to enter: assessments with a saved item analysis or student marks are filled in automatically.</p>` : `<p class="note">Type the share of the marks the students earned on each ${unit}, from 0 to 1 (e.g. 0.75 = 75%). It saves itself.</p>
        <div class="bp-wrap" style="overflow-x:auto"><table class="tbl xs-tbl cl-hand" style="min-width:${380 + hand.length * 74}px"><thead><tr><th>${unit}</th><th class="cl-st">Statement</th>${hand.map((a) => `<th class="cl-vh" title="${esc(a)}"><span>${esc(a)}</span></th>`).join("")}</tr></thead><tbody>
        ${ids.map((i) => `<tr><td><b>${esc(i)}</b></td><td class="cl-txt">${esc(info[i] || "")}</td>${hand.map((a) => `<td><input class="cell num-in ${val(i, a) !== null ? "filled" : ""}" inputmode="decimal" data-clso="${esc(i)}" data-cla="${esc(a)}" data-ref="clso:${esc(i)}:${esc(a)}" value="${esc(g2(val(i, a)))}" placeholder="0 to 1"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`}</details>` : ""}`;
    $$("[data-clso]", el).forEach((f) => f.onchange = () => {
      let v = num(f.value); if (v !== null && v > 1 && v <= 100) v = v / 100; if (v !== null) v = Math.min(1, Math.max(0, v));
      const keep = tbl("slo_other").filter((r) => !(String(r.course_code) === String(sel) && T.s(r.slo_id) === f.dataset.clso && T.s(r.assessment) === f.dataset.cla));
      if (v !== null) keep.push({ course_code: sel, assessment: f.dataset.cla, slo_id: f.dataset.clso, mean_difficulty: v });
      S.setT("slo_other", keep); S.save(); drawAll();
    });
  };

  /* ---------------------------------------------------------------- for the course report (TAMA render_clo_report_section, cr_actual_levels) */
  const RULES = { kpi: "% of students who reached the CLO's score threshold (KPI method)", avg: "Average student mark on the CLO (average method)" };
  function crStore(sel) { const d = T.plan.crStore(sel); if (!Array.isArray(d.exclude)) d.exclude = assessNames(sel).filter((a) => CA_NAME.test(a)); return d; }
  function assessNames(sel) { const v = T.markSheet(sel); return [...new Set([...(v ? v.cols.map((c) => (v.source === "upload" ? T.s((v.rec.map || {})[c.key]) : c.key)) : []), ...MP().cas(sel).map((r) => r.assessment), ...(((S.data.extra_methods || {})[String(sel)]) || [])].filter((a) => T.s(a).trim()))]; }
  function cloMethods(sel, cid) {
    const typed = T.s(crStore(sel).methods[cid]); if (typed.trim()) return split(typed.replace(/;/g, ","));
    let got = mine("clo_plan", sel).filter((r) => T.s(r.clo_id) === cid).flatMap((r) => split(r.assessment_methods));
    if (!got.length) got = mine("slos", sel).filter((s) => split(s.clo_id).includes(cid)).flatMap((s) => split(s.assessment_methods));
    return [...new Set(got)];
  }
  const crExcluded = (sel) => new Set([...(crStore(sel).exclude || []), ...(((S.data.clo_exclude || {})[String(sel)]) || [])].map(lc));
  function actualLevels(sel) {
    const v = T.markSheet(sel), out = {}; if (!v || !v.rows.length) return out;
    const ex = crExcluded(sel), act = v.rows.filter((r) => r.status !== "W" && r.status !== "DN" && T.s(r.letter).toUpperCase() !== "DN");
    const nameOf = (c) => lc(v.source === "upload" ? (v.rec.map || {})[c.key] : c.key);
    mine("clos", sel).forEach((c) => {
      const cid = T.s(c.clo_id), ms = new Set(cloMethods(sel, cid).map(lc)), cols = v.cols.filter((k) => ms.has(nameOf(k)) && !ex.has(nameOf(k)) && k.max > 0); if (!cols.length) return;
      const shares = []; act.forEach((r) => { const got = cols.filter((k) => r.marks[k.key] !== null && r.marks[k.key] !== undefined); if (got.length) shares.push((got.reduce((a, k) => a + Math.min(Math.max(r.marks[k.key], 0), k.max), 0) / got.reduce((a, k) => a + k.max, 0)) * 100); });
      if (!shares.length) return; let thr = num(c.kpi_threshold); if (thr === null) thr = 60;
      out[cid] = { kpi: (shares.filter((s) => s >= thr).length / shares.length) * 100, avg: shares.reduce((a, b) => a + b, 0) / shares.length, n: shares.length, thr, used: cols.map((k) => k.label) };
    });
    return out;
  }
  function reportRows(sel) {
    const d = crStore(sel), lv = actualLevels(sel), ex = crExcluded(sel), cnt = { 1: 0, 2: 0, 3: 0 };
    return mine("clos", sel).map((c) => {
      const cid = T.s(c.clo_id), g = { K: 1, S: 2, V: 3 }[T.s(c.domain).trim().toUpperCase()[0]] || 2; cnt[g]++;
      const meths = cloMethods(sel, cid), info = lv[cid], calc = info ? info[d.rule || "kpi"] : null, typed = d.actual[cid], actual = num(typed) !== null ? num(typed) : calc;
      return { g, no: `${g}.${cnt[g]}`, cid, text: T.s(c.clo_text), plos: ["plo_1", "plo_2", "plo_3"].map((k) => T.s(c[k]).trim()).filter((p) => p && !["nan", "none"].includes(p.toLowerCase())).join(", "),
        meths, methText: meths.map((m) => m + (ex.has(lc(m)) ? "*" : "")).join(", "), target: num(c.target_pct), calc, actual, typed: num(typed) !== null, info, comment: T.s(d.clo_comments[cid]) };
    }).sort((a, b) => a.g - b.g || +a.no.split(".")[1] - +b.no.split(".")[1]);
  }
  T.sections.cloReport = function () {
    const sel = T.current(), el = $("#sec-clrep"); if (!el) return;
    const d = crStore(sel), rows = reportRows(sel), names = [...new Set([...assessNames(sel), ...(d.exclude || [])])];
    el.innerHTML = `<div class="sec-head" id="h-clrep"><div><h2>For the course report: CLO results</h2><p class="sub">Section B of the Course Report. The actual level is worked out from the <a href="#mark-sheet">Course mark sheet</a> with the rule you choose here. You can type another value.</p></div></div>
      <div class="fld"><span class="lbl">How is the actual level calculated?</span><div class="seg">${Object.entries(RULES).map(([k, l]) => `<button class="${(d.rule || "kpi") === k ? "on" : ""}" data-clrule="${k}">${l}</button>`).join("")}</div></div>
      ${names.length ? `<div class="fld"><span class="lbl">Leave these assessments out of the actual level <i class="hint" title="They are still listed in the Assessment methods column, marked with *. Continuous assessment (CA) is left out by default.">?</i></span><div class="cl-chips">${names.map((a) => `<label class="chip-tick"><input type="checkbox" data-clex="${esc(a)}" ${(d.exclude || []).includes(a) ? "checked" : ""}> ${esc(a)}</label>`).join("")}</div></div>` : ""}
      ${rows.length ? `<div class="bp-wrap" style="overflow-x:auto"><table class="tbl cl-rep" style="min-width:1100px"><thead><tr><th class="ctr">No.</th><th>CLO</th><th style="min-width:240px">Statement</th><th>PLOs</th><th style="min-width:170px">Assessment methods</th><th class="ctr">Target</th><th class="ctr">Calculated</th><th class="ctr" style="width:96px">Actual level</th><th style="min-width:240px">Comment</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="ctr">${r.no}</td><td><b>${esc(r.cid)}</b></td><td class="cl-txt">${esc(r.text)}</td><td>${esc(r.plos)}</td>
          <td><input class="cell" data-clmt="${esc(r.cid)}" data-ref="clmt:${esc(r.cid)}" value="${esc(r.methText)}" title="Taken from the Assessment plan ticks. Type other methods (separated by commas) to use them instead. Clear the cell to go back to the ticks."></td>
          <td class="ctr">${g2(r.target)}</td><td class="ctr">${r.calc === null ? "-" : g2(r.calc)}${r.info ? `<span class="mg-out">${r.info.n} students</span>` : ""}</td>
          <td><input class="cell num-in ${r.typed ? "filled" : ""}" inputmode="decimal" data-clact="${esc(r.cid)}" data-ref="clact:${esc(r.cid)}" value="${esc(g2(r.actual))}"></td>
          <td><textarea class="cell" rows="2" data-clcom="${esc(r.cid)}" data-ref="clcom:${esc(r.cid)}">${esc(r.comment)}</textarea></td></tr>`).join("")}</tbody></table></div>
        <p class="note">Assessment methods marked * are left out of the actual level. The actual level is the calculated value unless you type another one; clear it to go back.</p>
        ${T.sug.html("clcom", { dataLabel: "Suggest the comments from my data", aiLabel: "Suggest the comments with AI" })}` : `<p class="note">This course has no CLOs yet.</p>`}
      <label class="fld ${T.s(d.recommendations).trim() ? "filled" : ""}" for="cl-rec"><span class="lbl">Recommendations (section B2)</span><textarea id="cl-rec" rows="4">${esc(d.recommendations || "")}</textarea></label>
      ${T.sug.html("clrec")}`;
    $$("[data-clrule]", el).forEach((b) => b.onclick = () => { d.rule = b.dataset.clrule; S.save(); T.refresh("cloReport"); });
    $$("[data-clex]", el).forEach((b) => b.onchange = () => { const s = new Set(d.exclude || []); if (b.checked) s.add(b.dataset.clex); else s.delete(b.dataset.clex); d.exclude = [...s]; S.save(); T.refresh("cloReport"); });
    $$("[data-clmt]", el).forEach((f) => f.onchange = () => { const cid = f.dataset.clmt, nw = split(f.value.replace(/\*/g, "")).join(", "), ticksTxt = (() => { const t = d.methods[cid]; delete d.methods[cid]; const r = cloMethods(sel, cid).join(", "); if (t !== undefined) d.methods[cid] = t; return r; })();
      if (nw && nw !== ticksTxt) d.methods[cid] = nw; else delete d.methods[cid]; S.save(); T.refresh("cloReport"); });
    $$("[data-clact]", el).forEach((f) => f.onchange = () => { const cid = f.dataset.clact, r = rows.find((x) => x.cid === cid), a = num(f.value); if (a === null || (r.calc !== null && Math.round(a * 100) === Math.round(r.calc * 100))) delete d.actual[cid]; else d.actual[cid] = a; S.save(); T.refresh("cloReport"); });
    $$("[data-clcom]", el).forEach((f) => { T.autoGrow(f); f.oninput = () => { d.clo_comments[f.dataset.clcom] = f.value; T.autoGrow(f); S.save(); }; });
    const rec = $("#cl-rec", el); T.autoGrow(rec); rec.oninput = () => { d.recommendations = rec.value; T.autoGrow(rec); T.markFilled(rec); S.save(); };
    const redraw = () => T.refresh("cloReport");
    T.sug.bind(el, "clcom", { redraw, empty: "This course has no CLOs yet.",
      items: () => reportRows(sel).map((r) => ({ id: r.cid, label: `CLO ${r.no} (${r.cid})`, current: d.clo_comments[r.cid] || "" })),
      local: (cid) => T.sug.cloComment(sel, reportRows(sel).find((r) => r.cid === cid)),
      apply: (cid, t) => { d.clo_comments[cid] = t; },
      ai: (items) => T.aiJson(`COURSE DATA\n${T.sug.context(sel)}\n\nTASK\nFor each CLO write the 'Comment on Assessment Results' for section B of the Course Report (30-70 words each): say whether the target was met, possible reasons, and what to keep or change. Where the coordinator already wrote a comment, improve it and keep its facts.\nCurrent comments: ${JSON.stringify(Object.fromEntries(items.map((it) => [it.id, it.current])))}\nReturn a JSON object {CLO id: comment} using these CLO ids exactly: ${items.map((it) => it.id).join(", ")}.`) });
    T.sug.bind(el, "clrec", { redraw,
      items: () => [{ id: "rec", label: "", current: d.recommendations || "" }],
      local: () => T.sug.recommendations(sel),
      apply: (id, t) => { d.recommendations = t; },
      ai: () => T.sug.askText(sel, T.sug.TASKS.recommendations, d.recommendations) });
  };

  async function excel(sel) {
    await T.importer.lib("xlsx");
    const { rows, unit, ids, W, Wg, order, ca } = C, c = S.t("courses").find((r) => String(r.course_code) === String(sel)) || {};
    const wb = XLSX.utils.book_new(), add = (n, data) => XLSX.utils.book_append_sheet(wb, data.length ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([[]]), n);
    add("CLO achievement", rows.map((r) => ({ CLO: r.cid, Statement: r.text, "Pre-set KPI (Target %)": r.target, "Actual % (item difficulty)": r.a, "Achievement % (item difficulty)": r.la, "Actual % (student grades)": r.ag, "Achievement % (student grades)": r.lag, "Assessment types": r.types })));
    add("Course info", [["Course code", sel], ["Course name", c.course_name], ["Institution", c.institution], ["Faculty", c.faculty], ["Department", c.department], ["Program", c.program], ["Course director", c.course_director]].map(([Item, Value]) => ({ Item, Value: T.s(Value) })));
    add("Assessments", ca.map((r) => ({ Assessment: r.assessment, Type: r.type || "", "Full mark": r.full_grade ?? "" })));
    const t = (w) => ids.map((i) => Object.assign({ [unit]: i }, Object.fromEntries(order.map((a) => [a, w[i] && w[i][a] !== undefined ? +g2(w[i][a] * 100) : ""])), { Average: w[i] && w[i].__avg !== null ? +g2(w[i].__avg * 100) : "" }));
    add(`${unit} - item difficulty`, t(W)); add(`${unit} - student grades`, t(Wg));
    XLSX.writeFile(wb, `clo_achievement_${T.baseCode(sel)}.xlsx`.replace(/[^\w.-]+/g, "_"));
  }

  const drawAll = () => T.refresh("cloMethod", "cloResults", "cloCharts", "cloDetails", "cloReport");
  T.renderCloPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "CLO achievement fills in as soon as you have saved at least one course in Course setup."}</p>
        <div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = ["clm", "clres", "clch", "cldet", "clrep"].map((k) => `<section class="card" id="sec-${k}"></section>`).join("");
    drawAll();
  };
  T.cloParts = { sloResults, gradeResults, compute, actualLevels, reportRows, cloMethods };
})();
