/* Improvement action plan (TAMA's render_action_plan_page, rebuilt 2026-11-22): sections D, E and F of the Course Report.
   Same saved data as TAMA: tables.actions with columns course_code, clo_id, gap (= recommendation), action, owner, due_date, status,
   offering, support, pct_achieved, comments. This offering = "Term Year" from Course setup; rows of other offerings are the
   "actions from the last offering". course_report[c].eval = {responses, rating, strengths, weaknesses, text};
   course_report[c].last_report = {plan, clo, recommendations, file} read from last offering's Course Report (Word).
   Every suggestion (rows, comments, text) is shown first and added only when the user chooses (suggest, then decide). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").trim()); return isNaN(x) ? null : x; };
  const f = (v, d = 2) => (v === null || v === undefined || isNaN(v) ? "-" : String(Math.round(v * 10 ** d) / 10 ** d));
  const same = (r, sel) => String(r.course_code) === String(sel);
  const COLS = ["course_code", "clo_id", "gap", "action", "owner", "due_date", "status", "offering", "support", "pct_achieved", "comments"];
  const STATUSES = ["Planned", "In progress", "Completed", "Deferred"];
  const crs = (sel) => T.plan.crStore(sel);
  const offering = (sel) => { const c = S.courseInfo(sel) || {}; return [T.s(c.term).trim(), T.s(c.year).trim()].filter(Boolean).join(" ") || "This offering"; };
  const cloRows = (sel) => { try { return T.cloParts.reportRows(sel); } catch (e) { return []; } };
  const label = (r, n = 45) => `${r.no} (${r.text.slice(0, n).trimEnd()}${r.text.length > n ? "..." : ""})`;
  const acts = (sel) => tbl("actions").filter((r) => same(r, sel));
  const isCur = (sel, r) => T.s(r.offering) === offering(sel);
  const newRow = (sel, o) => Object.assign(Object.fromEntries(COLS.map((c) => [c, ""])), { course_code: sel }, o);
  const grades = (sel) => { try { const v = T.markSheet(sel); return v && v.rows.length ? T.msParts.crGrades(sel, v) : null; } catch (e) { return null; } };

  /* ---------------------------------------------------------------- built-in suggestions (ported from TAMA) */
  function sugPlanRows(sel) {
    const d = crs(sel), rows = [], prev = (d.last_report || {}).clo || {}, cr = cloRows(sel);
    cr.forEach((r) => {
      const used = ((r.info || {}).used || r.meths || []).join(", ") || "assessment";
      if (r.actual === null || r.actual === undefined) rows.push({ clo_id: r.cid, gap: `Measure CLO ${r.no} in the next offering`, action: "Link an assessment with marks to this CLO in the Assessment plan", support: "Course coordinator" });
      else if (r.target !== null && r.target !== undefined && r.actual < r.target) rows.push({ clo_id: r.cid, gap: `Raise achievement of CLO ${label(r)} (${f(r.actual)}% against ${f(r.target)}%)`, action: `Add practice with feedback targeting this outcome and review the ${used} items mapped to it`, support: "Teaching staff" });
      else if (r.target !== null && r.target !== undefined && r.actual - r.target < 5) rows.push({ clo_id: r.cid, gap: `Secure CLO ${r.no}, which only just met the target (${f(r.actual)}%)`, action: "Add a mid-semester check of this outcome and give students feedback before the final assessment", support: "Teaching staff" });
      const pv = num(prev[r.no]);
      if (r.actual !== null && r.actual !== undefined && pv !== null && r.actual < pv - 5) rows.push({ clo_id: r.cid, gap: `Find out why CLO ${r.no} dropped from ${f(pv)}% last offering to ${f(r.actual)}%`, action: "Compare this offering's teaching, assessment items and student cohort with the last offering", support: "Course coordinator" });
    });
    Object.entries(d.topics || {}).forEach(([t, v]) => { if (v && v.not_covered) rows.push({ clo_id: "", gap: `Cover the topic '${t}' in the next offering`, action: "Schedule it early in the timetable, with a back-up date, and include it in an assessment", support: "Department scheduling" }); });
    const res = tbl("ia_results").filter((r) => same(r, sel));
    if (res.length) { const neg = res.filter((r) => num(r.discrimination) !== null && num(r.discrimination) < 0).length, bad = res.filter((r) => /revise|review/i.test(T.s(r.suggestion))).length;
      if (neg || bad) rows.push({ clo_id: "", gap: "Improve the quality of the exam questions", action: `Revise the ${Math.max(neg, bad)} question(s) flagged by the item analysis (negative discrimination, out-of-range difficulty or a wrong option chosen more than the key) before reusing them`, support: "Assessment / exam committee" }); }
    const ev = d.eval || {};
    if (T.s(ev.weaknesses).trim()) rows.push({ clo_id: "", gap: `Respond to students' suggestions: ${T.s(ev.weaknesses).trim().replace(/\.$/, "")}`, action: "Discuss the suggestions with the teaching team and adjust the course activities and schedule", support: "Teaching staff" });
    const g = grades(sel);
    if (g && (g.status_pct.Withdrawn || 0) >= 10) rows.push({ clo_id: "", gap: `Reduce withdrawals (${f(g.status_pct.Withdrawn, 1)}% this offering)`, action: "Follow up early absences and check the workload with students", support: "Academic advising" });
    acts(sel).filter((r) => !isCur(sel, r)).forEach((r) => { const p = num(r.pct_achieved); if (["Planned", "In progress", "Deferred"].includes(T.s(r.status)) || (p !== null && p < 100)) rows.push({ clo_id: T.s(r.clo_id), gap: `Complete the action carried over from the last offering: ${T.s(r.action)}`, action: "Finish it this offering and record the result", support: "Course coordinator" }); });
    if (cr.length) { const cnt = { 1: 0, 2: 0, 3: 0 }; cr.forEach((r) => cnt[r.g]++); const main = [1, 2, 3].reduce((a, b) => (cnt[b] > cnt[a] ? b : a), 1);
      if (cnt[main] / cr.length >= 0.4) rows.push({ 1: { clo_id: "", gap: "Deepen understanding in a knowledge-based course", action: "Use more active learning (flipped classroom, quizzes with feedback) and higher-order questions", support: "Teaching staff" },
        2: { clo_id: "", gap: "Strengthen applied skills in a skills-based course", action: "Increase case-based, simulation or project work with structured feedback and rubrics", support: "Teaching staff" },
        3: { clo_id: "", gap: "Make values outcomes visible and assessable", action: "Use reflective writing, debates and role-play with clear rubrics for the values CLOs", support: "Teaching staff" } }[main]); }
    rows.push({ clo_id: "", gap: "Benchmark the course results", action: "Compare CLO achievement, grade distribution and assessment methods with the last offering and with the same or a similar course at another institution (external benchmarking partner)", support: "Program quality committee" });
    const have = new Set(acts(sel).filter((r) => isCur(sel, r)).map((r) => T.s(r.gap).toLowerCase()));
    return rows.filter((r) => !have.has(r.gap.toLowerCase())).map((r) => Object.assign({ owner: "" }, r));
  }
  function evidenceActions(sel) {
    const out = [], mine = (n) => tbl(n).filter((r) => same(r, sel));
    const ex = [...new Set([...mine("plans"), ...mine("questions")].map((r) => T.s(r.assessment)).filter(Boolean))];
    if (ex.length) out.push([`Prepared an exam blueprint linking each question to the learning outcomes (${ex.slice(0, 4).join(", ")})`, "Exam content is now aligned with the course learning outcomes."]);
    const ia = [...new Set(mine("ia_tests").map((r) => T.s(r.assessment)))];
    if (ia.length) out.push([`Carried out item analysis of ${ia.slice(0, 4).join(", ")} and reviewed the flagged questions`, "Question quality was checked (difficulty and discrimination); weak items were identified for revision."]);
    if (mine("slos").some((r) => T.s(r.assessment_methods).trim()) || mine("clo_plan").some((r) => T.s(r.assessment_methods).trim())) out.push(["Mapped every learning outcome to its assessment methods (assessment plan)", "Each CLO is now measured by named assessments."]);
    if (mine("marks").length || (S.data.mark_sheets || {})[String(sel)]) out.push(["Measured CLO achievement directly from the students' marks", "CLO achievement is reported against a pre-set target (KPI)."]);
    if (mine("slos").some((r) => T.s(r.clo_id).trim())) out.push(["Linked the lecture learning outcomes (SLOs) to the CLOs", "Teaching of each lecture is aligned with the CLOs."]);
    return out;
  }
  function sugPrevRows(sel) {
    const have = new Set(acts(sel).map((r) => T.s(r.action).trim().toLowerCase())), rows = [];
    ((crs(sel).last_report || {}).plan || []).forEach((p) => { const a = T.s(p.action).split(/\s+/).length >= 5 ? T.s(p.action) : (T.s(p.gap) || T.s(p.action)); if (a.trim() && !have.has(a.trim().toLowerCase())) rows.push({ action: a.trim(), status: "", pct_achieved: "", comments: "From the last Course Report. Confirm the % achieved and add what was done." }); });
    evidenceActions(sel).forEach(([a, c]) => { if (!have.has(a.toLowerCase())) rows.push({ action: a, status: "Completed", pct_achieved: "100", comments: c }); });
    return rows;
  }
  const pctFromStatus = (s) => ({ Completed: 100, "In progress": 50, Planned: 0, Deferred: 0 })[T.s(s).trim()];
  function followup(sel, r) {
    const c = cloRows(sel).find((x) => x.cid === T.s(r.clo_id).trim());
    let base = ({ Completed: "Done as planned.", "In progress": "Started; still being carried out.", Planned: "Not started yet; carried over to this offering.", Deferred: "Deferred; to be reviewed in the next offering." })[T.s(r.status).trim()] || "";
    if (c && c.actual !== null && c.actual !== undefined && c.target !== null) base += ` CLO ${c.no} is now at ${f(c.actual)}% against a target of ${f(c.target)}% ${c.actual >= c.target ? "(met)." : "(still below the target)."}`;
    const p = pctFromStatus(r.status); if (!T.s(r.pct_achieved).trim() && p !== undefined) base += ` About ${p}% achieved.`;
    return base.trim() || "Add what was done and its effect on this offering's results.";
  }
  function sugEval(sel) {
    const e = crs(sel).eval || {}, resp = T.s(e.responses).trim(), rate = T.s(e.rating).trim(), good = T.s(e.strengths).trim(), bad = T.s(e.weaknesses).trim();
    const g = grades(sel), cr = cloRows(sel), have = cr.filter((r) => r.actual !== null && r.actual !== undefined && r.target !== null), unmet = have.filter((r) => r.actual < r.target), out = [];
    if (resp) out.push(`${resp} students answered the course evaluation survey${g ? ` (out of ${g.started} enrolled).` : "."}`);
    if (rate) out.push(`The overall rating of the course was ${rate}.`);
    if (good) out.push(`Students valued: ${good.replace(/\.$/, "")}.`);
    if (bad) out.push(`Students suggested improving: ${bad.replace(/\.$/, "")}.`);
    const v = T.markSheet(sel);
    if (g && g.graded && v) {
      const n = g.graded, c = g.counts, top = ((c["A+"] + c.A) / n) * 100, gg = top + ((c["B+"] + c.B) / n) * 100, st = T.sug.statsOf(T.sug.gradedRows(v).map((r) => r.final)), mp = st && v.final_max ? (st.mean / v.final_max) * 100 : 0;
      out.push(`Overall, student performance in the course was ${mp >= 85 ? "very high" : mp >= 75 ? "good" : "moderate"}: ${f(gg, 1)}% of the students who completed it achieved a B grade or higher (${f(top, 1)}% A or A+), with a mean final mark of ${f(st.mean, 1)} out of ${f(v.final_max, 0)}${g.status.Fail ? `, and ${g.status.Fail} student(s) failed.` : ", and no student failed."}`);
      const pa = T.sug.perAssess(v), ks = Object.keys(pa);
      if (ks.length >= 2) { const best = ks.reduce((a, b) => (pa[b] > pa[a] ? b : a)), worst = ks.reduce((a, b) => (pa[b] < pa[a] ? b : a)); out.push(`Students performed best in ${best} and found ${worst} more challenging, which suggests where additional guidance or feedback may help.`); }
      if (g.status.Withdrawn) out.push(`${g.status.Withdrawn} student(s) withdrew; their reasons should be explored, as withdrawal may reflect workload or engagement issues.`);
    }
    if (have.length) out.push(!unmet.length ? "All measured learning outcomes reached their targets, indicating that students achieved the intended learning." : `${have.length - unmet.length} of ${have.length} measured learning outcomes reached their targets; students were less successful in ${unmet.map((r) => `CLO ${r.no}`).join(", ")}, which is addressed in the improvement plan.`);
    if (!resp && !rate && !good && !bad) out.push("These statements are based on the students' results; the course evaluation survey results should be added when they are available.");
    else if (bad) out.push("The course team will address the students' suggestions through the course improvement plan below.");
    return out.join(" ") || "There is no survey information or mark sheet for this course yet.";
  }

  /* ---------------------------------------------------------------- sections */
  const cloOpts = (sel, cur) => `<option value="">—</option>${cloRows(sel).map((r) => `<option value="${esc(r.cid)}" ${r.cid === cur ? "selected" : ""}>${esc(r.no)} ${esc(r.cid)}</option>`).join("")}`;
  const stOpts = (cur, blank) => `${blank ? `<option value="" ${cur ? "" : "selected"}>—</option>` : ""}${STATUSES.map((s) => `<option ${s === cur ? "selected" : ""}>${s}</option>`).join("")}`;
  const ta = (attrs, v) => `<textarea class="cell ${T.s(v).trim() ? "filled" : ""}" rows="1" ${attrs}>${esc(v)}</textarea>`;
  function bindCells(el, list, redraw) {
    $$("[data-apr]", el).forEach((x) => {
      const r = list[+x.dataset.apr], k = x.dataset.k;
      if (x.tagName === "TEXTAREA") { T.autoGrow(x); x.oninput = () => { r[k] = x.value; T.autoGrow(x); x.classList.toggle("filled", !!x.value.trim()); S.saveSoon(); }; x.onchange = () => { r[k] = x.value.trim(); S.save(); }; }
      else x.onchange = () => { r[k] = k === "pct_achieved" ? (num(x.value) === null ? "" : String(Math.max(0, Math.min(100, num(x.value))))) : x.value; S.save(); if (x.dataset.redraw) redraw(); };
    });
    $$("[data-apx]", el).forEach((b) => b.onclick = () => { const r = list[+b.dataset.apx], i = tbl("actions").indexOf(r); if (i >= 0) tbl("actions").splice(i, 1); S.save(); redraw(); });
  }

  T.sections.apStatus = function () {
    const sel = T.current(), el = $("#sec-apst"); if (!el) return;
    const cr = cloRows(sel), below = cr.filter((r) => r.actual !== null && r.actual !== undefined && r.target !== null && r.actual < r.target), measured = cr.some((r) => r.actual !== null && r.actual !== undefined);
    el.innerHTML = `<div class="sec-head" id="h-apst"><div><h2>This offering: ${esc(T.termLabel((S.courseInfo(sel) || {}).term))} ${esc((S.courseInfo(sel) || {}).year || "")}</h2><p class="sub">The CLO results come from <a href="#clo-achievement">CLO achievement</a> (For the course report). The plan below is section F of the Course Report; last offering's actions are section D; the student evaluation is section E.</p></div></div>
      ${below.length ? `<div class="alert-box"><span class="alert-ic">⚠</span><span><b>CLOs below the target this offering:</b> ${below.map((r) => `${esc(r.no)} ${esc(r.cid)} (${f(r.actual)}% against ${f(r.target)}%)`).join("; ")}. Give each one an action in the improvement plan.</span></div>`
        : measured ? `<p class="ok-text">✓ All measured CLOs met their target this offering.</p>` : `<p class="note">No CLO results yet. They appear when CLO achievement has results.</p>`}`;
  };

  T.sections.apPlan = function () {
    const sel = T.current(), el = $("#sec-applan"); if (!el) return;
    const cur = offering(sel), list = acts(sel).filter((r) => isCur(sel, r));
    el.innerHTML = `<div class="sec-head" id="h-applan"><div><h2>Course improvement plan (${esc(cur)})</h2><p class="sub">Section F of the Course Report: recommendation, action and needed support. Next offering, these rows become the actions from the last offering, where you record how far each was achieved.</p></div>
        <button class="btn" id="ap-xlsx">⬇ Excel</button></div>
      <div class="bp-wrap" style="overflow-x:auto"><table class="tbl ap-tbl" style="min-width:860px"><thead><tr><th style="width:90px">CLO</th><th>Recommendation</th><th>Action</th><th>Needed support</th><th style="width:110px">Responsible</th><th style="width:90px">Due date</th><th style="width:110px">Status</th><th style="width:34px"></th></tr></thead><tbody>
        ${list.map((r, i) => `<tr><td><select class="cell" data-apr="${i}" data-k="clo_id">${cloOpts(sel, T.s(r.clo_id))}</select></td>
          <td>${ta(`data-apr="${i}" data-k="gap" data-ref="apg:${i}"`, r.gap)}</td><td>${ta(`data-apr="${i}" data-k="action" data-ref="apa:${i}"`, r.action)}</td><td>${ta(`data-apr="${i}" data-k="support" data-ref="aps:${i}"`, r.support)}</td>
          <td>${ta(`data-apr="${i}" data-k="owner" data-ref="apo:${i}"`, r.owner)}</td><td>${ta(`data-apr="${i}" data-k="due_date" data-ref="apd:${i}"`, r.due_date)}</td>
          <td><select class="cell" data-apr="${i}" data-k="status">${stOpts(T.s(r.status) || "Planned")}</select></td><td class="ctr"><button class="x-btn" data-apx="${i}" title="Delete this row">×</button></td></tr>`).join("")}
        <tr><td colspan="8"><button class="btn sm" id="ap-add">+ Add a row</button></td></tr></tbody></table></div>
      ${T.sug.rowsHtml("applan", { fields: [["gap", "Recommendation"], ["action", "Action"], ["support", "Needed support"], ["owner", "Responsible"]], wide: ["gap", "action"], dataLabel: "Suggest actions from the results", aiLabel: "Suggest actions with AI", addLabel: "Add to the plan" })}`;
    const redraw = () => T.refresh("apPlan");
    bindCells(el, list, redraw);
    $("#ap-add", el).onclick = () => { tbl("actions").push(newRow(sel, { offering: cur, status: "Planned" })); S.save(); redraw(); };
    $("#ap-xlsx", el).onclick = () => excel(sel);
    const okC = new Set(cloRows(sel).map((r) => r.cid));
    T.sug.bindRows(el, "applan", { redraw, empty: "No new suggestion: every CLO below the target already has an action.",
      local: () => sugPlanRows(sel),
      add: (r) => tbl("actions").push(newRow(sel, { offering: cur, status: "Planned", clo_id: okC.has(T.s(r.clo_id)) ? T.s(r.clo_id) : "", gap: T.s(r.gap).trim(), action: T.s(r.action).trim(), support: T.s(r.support).trim(), owner: T.s(r.owner).trim() })),
      ai: async () => {
        const got = await T.aiJson(`COURSE DATA\n${T.sug.context(sel)}\n\nCURRENT PLAN ROWS\n${JSON.stringify(list.map((r) => ({ clo_id: r.clo_id, recommendation: r.gap, action: r.action, support: r.support })))}\n\nTASK\nPropose 3 to 6 NEW rows for the Course Improvement Plan of the next offering (do not repeat the current rows), based on the CLOs below or close to the target, the grades, the topics not covered, the student survey, the last Course Report (its plan and CLO results, if given) and the nature of the course (its main learning domain and subject). Include at least one benchmarking option (internal: previous offerings; external: the same or a similar course at another institution). Return a JSON list of objects with keys: clo_id (one of the CLO IDs in the data, or empty), recommendation, action, support (the needed support, e.g. who helps or what resource), owner (role, e.g. Course coordinator).`);
        return (Array.isArray(got) ? got : []).filter((r) => r && (r.recommendation || r.action)).map((r) => ({ clo_id: T.s(r.clo_id), gap: T.s(r.recommendation), action: T.s(r.action), support: T.s(r.support), owner: T.s(r.owner) }));
      } });
  };

  T.sections.apPrev = function () {
    const sel = T.current(), el = $("#sec-apprev"); if (!el) return;
    const list = acts(sel).filter((r) => !isCur(sel, r)), lr = crs(sel).last_report;
    el.innerHTML = `<div class="sec-head" id="h-apprev"><div><h2>Improvement actions from the last offering</h2><p class="sub">Section D of the Course Report: the actions planned in earlier offerings, how far each was achieved, and comments.</p></div></div>
      <details class="sum-box" ${lr ? "" : "open"}><summary>Use the last Course Report of this course${lr ? ` (imported: ${esc(lr.file || "")})` : ""}</summary>
        <p class="note">Upload last offering's Course Report (Word, TP-154). Its improvement plan (section F) is added below as the actions from the last offering, and its CLO results are used to compare this offering with the last one in the suggestions.</p>
        <div class="row-btns"><label class="btn">Choose the Word file<input type="file" id="ap-lr" accept=".docx" hidden></label>${lr ? `<button class="btn" id="ap-lr-x">Forget the imported report</button>` : ""}</div>
        ${lr ? `<p class="note">Found ${(lr.plan || []).length} improvement-plan row(s) and ${Object.keys(lr.clo || {}).length} CLO result(s)${Object.keys(lr.clo || {}).length ? `: ${Object.entries(lr.clo).map(([k, v]) => `${esc(k)} ${f(v)}%`).join(", ")}` : ""}.</p>` : ""}</details>
      <div class="bp-wrap" style="overflow-x:auto"><table class="tbl ap-tbl" style="min-width:820px"><thead><tr><th style="width:95px">Offering</th><th style="width:90px">CLO</th><th>Action</th><th style="width:130px">Status</th><th style="width:100px">% achieved</th><th>Comments</th><th style="width:34px"></th></tr></thead><tbody>
        ${list.map((r, i) => `<tr><td>${ta(`data-apr="${i}" data-k="offering" data-ref="apvo:${i}"`, r.offering)}</td><td><select class="cell" data-apr="${i}" data-k="clo_id">${cloOpts(sel, T.s(r.clo_id))}</select></td>
          <td>${ta(`data-apr="${i}" data-k="action" data-ref="apva:${i}"`, r.action)}</td><td><select class="cell" data-apr="${i}" data-k="status">${stOpts(T.s(r.status), true)}</select></td>
          <td><input class="cell num-in" inputmode="decimal" data-apr="${i}" data-k="pct_achieved" data-ref="apvp:${i}" value="${esc(r.pct_achieved)}"></td>
          <td>${ta(`data-apr="${i}" data-k="comments" data-ref="apvc:${i}"`, r.comments)}</td><td class="ctr"><button class="x-btn" data-apx="${i}" title="Delete this row">×</button></td></tr>`).join("")}
        <tr><td colspan="7"><button class="btn sm" id="ap-add2">+ Add a row</button></td></tr></tbody></table></div>
      ${T.sug.rowsHtml("apprev", { fields: [["action", "Action"], ["status", "Status"], ["pct_achieved", "% achieved"], ["comments", "Comments"]], wide: ["action", "comments"], dataLabel: "Suggest actions that were carried out", aiLabel: "Suggest actions with AI", addLabel: "Add this action" })}
      ${list.length ? T.sug.html("apcom", { dataLabel: "Suggest the comments from my data", aiLabel: "Suggest the comments with AI" }) : ""}`;
    const redraw = () => T.refresh("apPrev");
    bindCells(el, list, redraw);
    $("#ap-add2", el).onclick = () => { tbl("actions").push(newRow(sel, { offering: "Last offering" })); S.save(); redraw(); };
    const okC = new Set(cloRows(sel).map((r) => r.cid));
    T.sug.bindRows(el, "apprev", { redraw, empty: "No new suggestion: the suggested actions are already in the table.",
      local: () => sugPrevRows(sel),
      add: (r) => tbl("actions").push(newRow(sel, { offering: "Last offering", clo_id: okC.has(T.s(r.clo_id)) ? T.s(r.clo_id) : "", action: T.s(r.action).trim(), status: STATUSES.includes(T.s(r.status).trim()) ? T.s(r.status).trim() : "", pct_achieved: num(r.pct_achieved) === null ? "" : String(num(r.pct_achieved)), comments: T.s(r.comments).trim() })),
      ai: async () => {
        const got = await T.aiJson(`COURSE DATA\n${T.sug.context(sel)}\n\nCURRENT ROWS\n${JSON.stringify(list.map((r) => ({ action: r.action, status: r.status })))}\n\nTASK\nSuggest 3 to 5 improvement actions that were most likely carried out since the last offering, based on the last Course Report plan (if given) and on the evidence in the data (for example blueprints, item analysis, assessment mapping). Do not repeat the current rows. Return a JSON list of objects with keys: action, clo_id (or empty), status (Completed, In progress, Planned or Deferred), pct_achieved (0-100), comments (what to confirm).`);
        return (Array.isArray(got) ? got : []).filter((r) => r && T.s(r.action).trim()).map((r) => ({ action: T.s(r.action), clo_id: T.s(r.clo_id), status: T.s(r.status), pct_achieved: T.s(r.pct_achieved), comments: T.s(r.comments) }));
      } });
    T.sug.bind(el, "apcom", { redraw,
      items: () => list.map((r, i) => ({ id: String(i), label: T.s(r.action).slice(0, 90), current: T.s(r.comments) })),
      local: (id) => followup(sel, list[+id]),
      apply: (id, t) => { const r = list[+id]; r.comments = t; const p = pctFromStatus(r.status); if (!T.s(r.pct_achieved).trim() && p !== undefined) r.pct_achieved = String(p); },
      ai: async (items) => {
        const got = await T.aiJson(`COURSE DATA\n${T.sug.context(sel)}\n\nACTIONS FROM THE LAST OFFERING\n${JSON.stringify(list.map((r, n) => ({ n, action: r.action, clo_id: r.clo_id, status: r.status, pct_achieved: r.pct_achieved, current_comment: r.comments })))}\n\nTASK\nFor each action write the 'Comments' for section D of the Course Report (20-50 words): what was done and its effect on this offering's results, using the CLO results where the action is linked to a CLO. Where a comment exists, improve it and keep its facts. Return a JSON object {n: comment} using the numbers n as keys.`);
        return got && typeof got === "object" ? Object.fromEntries(Object.entries(got).map(([k, v]) => [String(k), T.s(v)])) : {};
      } });
    const fi = $("#ap-lr", el);
    fi.onchange = async () => {
      const file = fi.files[0]; if (!file) return;
      try {
        const got = await parseReport(await file.arrayBuffer()); got.file = file.name; crs(sel).last_report = got;
        const have = new Set(acts(sel).map((r) => T.s(r.action).toLowerCase())), act = (p) => (p.action.split(/\s+/).length >= 5 ? p.action : (p.gap || p.action));
        const add = got.plan.filter((p) => act(p) && !have.has(act(p).toLowerCase()));
        add.forEach((p) => tbl("actions").push(newRow(sel, { offering: "Last offering", gap: p.gap, action: act(p), support: p.support })));
        S.save(); T.toast(`Read ${file.name}: ${add.length} action(s) added, ${Object.keys(got.clo).length} CLO result(s) kept for the comparison.`); redraw();
      } catch (e) { T.toast(`The file could not be read (${e.message || e}).`, "warn"); }
    };
    const fx = $("#ap-lr-x", el); if (fx) fx.onclick = () => { delete crs(sel).last_report; S.save(); redraw(); };
  };

  /** The improvement plan, CLO actual levels and recommendations of a filled Course Report (TP-154), as TAMA's parse_course_report. */
  async function parseReport(buf) {
    await T.importer.lib("jszip");
    const zip = await JSZip.loadAsync(buf), x = zip.file("word/document.xml"); if (!x) throw new Error("this is not a Word (.docx) file");
    const doc = new DOMParser().parseFromString(await x.async("string"), "application/xml"), W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const kids = (n, tag) => [...n.childNodes].filter((c) => c.localName === tag);
    const tables = [...doc.getElementsByTagNameNS(W, "tbl")].filter((t) => !(t.parentNode && t.parentNode.closest && t.parentNode.closest("tbl")))
      .map((t) => kids(t, "tr").map((tr) => kids(tr, "tc").map((tc) => [...tc.getElementsByTagNameNS(W, "p")].map((p) => [...p.getElementsByTagNameNS(W, "t")].map((q) => q.textContent).join("")).join("\n").trim())));
    const out = { plan: [], clo: {}, recommendations: "" };
    tables.forEach((rows, i) => {
      const head = rows.slice(0, 2).map((r) => r.join(" ")).join(" ").toLowerCase();
      if (head.includes("needed support")) {
        rows.forEach((r) => { if (!r.some(Boolean) || r.some((c) => c.toLowerCase().includes("needed support"))) return; const gap = (r[0] || "").replace(/^\s*\d+\s*[.)-]\s*/, ""); if (gap || r[1]) out.plan.push({ gap, action: r[1] || "", support: r[2] || "" }); });
      } else if (head.includes("actual") && (head.includes("clos") || head.includes("learning outcomes"))) {
        rows.forEach((r) => { if (r.length >= 6 && /^\d\.\d+$/.test(r[0])) { const v = num(r[5]); if (v !== null) out.clo[r[0]] = v; } });
        const nx = tables[i + 1]; if (nx && nx.length === 1 && nx[0].length === 1) out.recommendations = nx[0][0];
      }
    });
    return out;
  }

  T.sections.apEval = function () {
    const sel = T.current(), el = $("#sec-apev"); if (!el) return;
    const d = crs(sel), ev = (d.eval = d.eval && typeof d.eval === "object" ? d.eval : {});
    const fld = (k, l, ph, area) => `<label class="fld ${T.s(ev[k]).trim() ? "filled" : ""}" for="ap-ev-${k}"><span class="lbl">${l}</span>${area ? `<textarea id="ap-ev-${k}" data-ev="${k}" rows="2" placeholder="${esc(ph)}">${esc(ev[k] || "")}</textarea>` : `<input type="text" id="ap-ev-${k}" data-ev="${k}" value="${esc(ev[k] || "")}" placeholder="${esc(ph)}">`}</label>`;
    el.innerHTML = `<div class="sec-head" id="h-apev"><div><h2>Overall student evaluation and comments</h2><p class="sub">Section E of the Course Report. Enter the main results of the course evaluation survey if you have them; the suggestion also uses the grades and CLO results, so it works without the survey too.</p></div></div>
      <div class="grid g2">${fld("responses", "Number of students who answered the survey", "e.g. 22")}${fld("rating", "Overall rating", "e.g. 4.3 out of 5, or 86%")}</div>
      ${fld("strengths", "What students liked most", "", true)}${fld("weaknesses", "What students suggested improving", "", true)}
      ${fld("text", "Text for the report (section E)", "", true)}
      ${T.sug.html("apev")}`;
    $$("[data-ev]", el).forEach((x) => { if (x.tagName === "TEXTAREA") T.autoGrow(x); x.oninput = () => { ev[x.dataset.ev] = x.value; if (x.tagName === "TEXTAREA") T.autoGrow(x); T.markFilled(x); S.saveSoon(); }; });
    T.sug.bind(el, "apev", { redraw: () => T.refresh("apEval"),
      items: () => [{ id: "text", label: "", current: ev.text || "" }],
      local: () => sugEval(sel), apply: (id, t) => { ev.text = t; },
      ai: () => T.sug.askText(sel, T.sug.TASKS.text, ev.text) });
  };

  async function excel(sel) {
    await T.importer.lib("xlsx");
    const wb = XLSX.utils.book_new(), cur = offering(sel), L = { clo_id: "CLO", gap: "Recommendation", action: "Action", support: "Needed support", owner: "Responsible", due_date: "Due date", status: "Status", offering: "Offering", pct_achieved: "% achieved", comments: "Comments" };
    const sheet = (rows, cols) => XLSX.utils.json_to_sheet(rows.length ? rows.map((r) => Object.fromEntries(cols.map((c) => [L[c], T.s(r[c])]))) : [Object.fromEntries(cols.map((c) => [L[c], ""]))]);
    XLSX.utils.book_append_sheet(wb, sheet(acts(sel).filter((r) => isCur(sel, r)), ["clo_id", "gap", "action", "support", "owner", "due_date", "status"]), "Improvement plan");
    XLSX.utils.book_append_sheet(wb, sheet(acts(sel).filter((r) => !isCur(sel, r)), ["offering", "clo_id", "action", "status", "pct_achieved", "comments"]), "Last offering actions");
    XLSX.writeFile(wb, `improvement_action_plan_${T.baseCode(sel)}.xlsx`.replace(/[^\w.-]+/g, "_"));
  }

  T.renderActionPlanPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">🛠️</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "Add a course in Course setup first."}</p><div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = ["apst", "applan", "apprev", "apev"].map((k) => `<section class="card" id="sec-${k}"></section>`).join("");
    T.refresh("apStatus", "apPlan", "apPrev", "apEval");
  };
  T.apParts = { offering, sugPlanRows, sugPrevRows, sugEval, parseReport, COLS, STATUSES };
})();
