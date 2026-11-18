/* Blueprint for written exams (TAMA's "Exam blueprint" page).
   Same saved data as TAMA: tables.exams, tables.plans, bp_raw, bp_minutes2, bp_minutes3 (keys "course||exam||basis").
   New (Dania 2026-11-19): bp_types["course||exam||basis"][outcome id] = ["MCQ", "Short Essay", "Long Essay"] - the question types
   each test-based assessment uses for each outcome, ticked in the table at the top of the page. They replace the old
   MCQ / Short Essay / Long Essay columns of the Assessment plan as the "planned" types of the blueprint builder. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const P = () => T.plan;
  const TYPES = ["MCQ", "Short Essay", "Long Essay"];
  const SHORT = { MCQ: "MCQ", "Short Essay": "SE", "Long Essay": "LE" };
  const TYPE_KEY = { MCQ: "mcq", "Short Essay": "short", "Long Essay": "long" };
  const TEST = "Test-based assessment";
  const DEFAULT_MINUTES = {
    SLOs: { MCQ: { K: 1, "S:Cog.": 2, "S:IT-N": null, "S:Psych": null, V: null }, "Short Essay": { K: null, "S:Cog.": null, "S:IT-N": null, "S:Psych": null, V: null }, "Long Essay": { K: null, "S:Cog.": null, "S:IT-N": null, "S:Psych": null, V: null } },
    CLOs: { MCQ: { K: 1, S: null, V: null }, "Short Essay": { K: null, S: null, V: null }, "Long Essay": { K: null, S: null, V: null } },
  };
  /** MCQ minutes that are fixed and cannot be changed (Dania 2026-11-19): K = 1 minute, S:Cog. = 2 minutes. */
  const FIXED_MCQ = { SLOs: { K: 1, "S:Cog.": 2 }, CLOs: { K: 1 } };
  const PLAN_COLS = ["course_code", "assessment", "basis", "lecture", "outcome_id", "statement", "domain", "mcq_weight", "short_weight", "long_weight",
    "mcq_minutes", "short_minutes", "long_minutes", "mcq_questions", "short_questions", "long_questions"];

  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const obj = (k) => (S.data[k] && typeof S.data[k] === "object" && !Array.isArray(S.data[k]) ? S.data[k] : (S.data[k] = {}));
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").replace(/^\+/, "").trim()); return isNaN(x) ? null : x; };
  const g2 = (n) => { if (n === null || n === undefined || isNaN(n)) return ""; return String(Math.round(n * 100) / 100); };
  const same = (a, b) => T.s(a).trim().toUpperCase() === T.s(b).trim().toUpperCase();
  const natKey = (s) => T.s(s).split(/(\d+)/).map((p, i) => (i % 2 ? p.padStart(8, "0") : p.toLowerCase())).join("");
  const key = (sel, exam, basis) => `${sel}||${exam}||${basis}`;

  /** The test-based assessments of the course (Summative table), in their order. */
  const testExams = (sel) => P().methods(sel).filter((m) => P().kindOf(sel, m) === TEST);
  /** Exams saved for the course anywhere (exams, blueprint plans, questions), as TAMA's exam_names. */
  function savedExams(sel) {
    const out = [];
    ["exams", "plans", "questions"].forEach((n) => tbl(n).forEach((r) => { if (String(r.course_code) === String(sel)) { const a = T.s(r.assessment).trim(); if (a && !out.includes(a)) out.push(a); } }));
    return out;
  }
  const basisOf = () => (S.ui.bpBasis === "CLOs" ? "CLOs" : "SLOs");
  const examOf = (sel) => T.s((S.ui.bpExam || {})[sel]).trim();
  const setExam = (sel, v) => { S.ui.bpExam = S.ui.bpExam || {}; S.ui.bpExam[sel] = v; S.saveUi(); };

  /** The question types ticked for one exam: {outcome id: Set of types}. Only outcomes ticked for this exam in the
      Assessment plan can have types (Dania 2026-11-19): a type saved earlier for an outcome that is no longer ticked there is ignored. */
  function typesOf(sel, exam, basis) {
    const raw = obj("bp_raw")[key(sel, exam, basis)] || {}, rows = P().planRows(sel, basis);
    const ok = new Set(rows.filter((r) => P().ticked(r, exam)).map((r) => r.id));
    return (id) => new Set(ok.has(id) ? TYPES.filter((t) => (num((raw[id] || {})[t]) || 0) > 0) : []);
  }
  T.bpTypesOf = (sel, exam, basis) => typesOf(sel, exam, basis);
  function setWeight(sel, exam, basis, id, t, v) {
    const k = key(sel, exam, basis), all = obj("bp_raw"), m = (all[k] = all[k] || {});
    m[id] = m[id] || {}; TYPES.forEach((tt) => { if (!(tt in m[id])) m[id][tt] = null; });
    m[id][t] = v;
    const bt = obj("bp_types"), tm = (bt[k] = bt[k] || {}), list = TYPES.filter((tt) => (num(m[id][tt]) || 0) > 0);
    if (list.length) tm[id] = list; else delete tm[id];
    if (!Object.keys(tm).length) delete bt[k];
    S.save();
  }

  /* ================================================================ 1. the plan of the written exams (top table) */
  T.sections.bpPlan = function () {
    const sel = T.current(), el = $("#sec-bpplan"); if (!el) return;
    const basis = basisOf(), rows = P().planRows(sel, basis), ex = testExams(sel), exam = examOf(sel);
    let body;
    if (!rows.length) body = `<div class="info-box"><span>This course has no ${basis} yet. Add them in ${basis === "SLOs" ? "Lectures & SLOs" : "Course setup"}.</span><a class="btn sm" href="#${basis === "SLOs" ? "lectures-slos" : "course-setup"}">Go there</a></div>`;
    else if (!ex.length) body = `<div class="info-box"><span>No test-based assessment yet. In the <b>Summative assessment</b> table of the Assessment plan, choose <b>Test-based assessment / اختبارات</b> as the method of the quizzes and exams, and they appear here.</span><a class="btn sm" href="#assessment-plan">Go to Assessment plan</a></div>`;
    else if (!exam || !ex.includes(exam)) body = `<div class="info-box"><span>Choose the test in <b>Test blueprint</b> above, and its ${basis} appear here.</span></div>`;
    else {
      const info = basis === "SLOs" ? [["week", "Date / Week", 62], ["lecture", "Lecture / module", 110], ["id", "ID", 52], ["statement", "Learning outcome", 0], ["domain", "Domain", 64], ["clo", "Linked CLO", 62]]
        : [["id", "ID", 52], ["statement", "Learning outcome", 0], ["domain", "Domain", 64]];
      const raw = obj("bp_raw")[key(sel, exam, basis)] || {}, nPlan = rows.filter((r) => P().ticked(r, exam)).length;
      const wOf = (id, t) => { const v = num((raw[id] || {})[t]); return v === null ? null : Math.min(Math.max(v, 0), 3); };
      const over = [];
      const trs = rows.map((r, i) => {
        const inPlan = P().ticked(r, exam), tot = TYPES.reduce((a, t) => a + (wOf(r.id, t) || 0), 0), bad = inPlan && tot > 3;
        if (bad) over.push(`${r.id} (${g2(tot)})`);
        return `<tr class="${inPlan ? "" : "locked"} ${bad ? "over" : ""}"><td class="ro muted">${i + 1}</td>${info.map(([k]) => `<td class="ro words ${k === "statement" || k === "lecture" ? "wrap" : ""} ${k === "id" ? "b" : ""}">${esc(k === "clo" && !r.clo ? "(None)" : r[k])}</td>`).join("")}
          ${TYPES.map((t, ti) => { const v = wOf(r.id, t); return inPlan ? `<td class="ctr bx g0 inplan ${ti === 0 ? "first" : ""}"><input type="text" inputmode="numeric" class="wcell" data-wb="${i}" data-wt="${ti}" data-ref="bw:${esc(r.id)}:${ti}" value="${v === null ? "" : esc(g2(v))}" aria-label="${esc(r.id)}: ${esc(exam)} ${t} weight" title="${esc(exam)}: ${t} weight (0 to 3)"></td>`
            : `<td class="ctr bx g0 off ${ti === 0 ? "first" : ""}"><span class="lock" title="Not planned for ${esc(exam)} in the Assessment plan">—</span></td>`; }).join("")}
          <td class="ctr b wtot ${inPlan ? (bad ? "bad" : "") : "off"}">${inPlan ? g2(tot) + (bad ? " ⚠" : "") : ""}</td></tr>`;
      }).join("");
      body = `<div class="def-box bp-how"><b>How to fill this table</b><ul>
          <li>Only the ${basis} ticked for <b>${esc(exam)}</b> in the Assessment plan (shaded) have boxes. The others are locked (—). To include another ${basis === "SLOs" ? "SLO" : "CLO"} in this test, tick it for ${esc(exam)} in the <a href="#assessment-plan">Assessment plan</a> page first; its boxes then open here.</li>
          <li>In each box write how important this outcome is for that type of question: <b>3</b> = most important, <b>2</b> = moderate, <b>1</b> = least important. Leave it <b>empty</b> (or 0) if this type is not used for the outcome.</li>
          <li>An outcome can be assessed by MCQ and essays together, but its weights must add up to <b>3 at most</b> (see <b>Total</b>). A total above 3 turns orange and the blueprint is not calculated until it is fixed.</li>
          <li>Each weighted outcome gets at least one question of that type; the number of questions is shown in "How many questions?" below. Every weight saves itself.</li></ul></div>
        ${nPlan ? "" : `<p class="warn-text">No ${basis} is ticked for ${esc(exam)} in the Assessment plan yet, so every box is locked. Tick the outcomes this test assesses in the <a href="#assessment-plan">Assessment plan</a> first.</p>`}
        <div class="bp-wrap"><table class="tbl bp-tbl one"><colgroup><col style="width:26px">${info.map(([k, , w]) => `<col data-k="${k}"${w ? ` style="width:${w}px"` : ""}>`).join("")}${TYPES.map(() => `<col style="width:96px">`).join("")}<col style="width:90px"></colgroup>
        <thead><tr><th rowspan="2">#</th>${info.map(([, l]) => `<th rowspan="2" class="words">${l}</th>`).join("")}<th colspan="3" class="bx-h g0" title="${esc(exam)}">${esc(exam)}: weight (0 to 3)</th><th rowspan="2" class="ctr wtot-h">Total weight<br>(max 3)</th></tr>
          <tr>${TYPES.map((t) => `<th class="bx-t g0">${t === "MCQ" ? "MCQ" : t.replace(" Essay", " essay")}</th>`).join("")}</tr></thead>
        <tbody>${trs}</tbody></table></div>
        ${over.length ? `<p class="warn-text">The total weight of an outcome cannot be more than 3: ${esc(over.join(", "))}. Lower its MCQ, Short essay or Long essay weight so the total is 3 or less.</p>` : ""}`;
    }
    el.innerHTML = `<div class="sec-head" id="h-bpplan"><div><h2>Question types and weights${exam && ex.includes(exam) ? ` of ${esc(exam)}` : ""}</h2><p class="sub">Copied from the plan to measure learning outcomes, for the test chosen in Test blueprint above.</p></div></div>${body}`;
    $$("[data-wb]", el).forEach((i) => i.onchange = () => {
      const r = rows[+i.dataset.wb], t = TYPES[+i.dataset.wt], v = num(i.value);
      const w = v === null ? null : Math.round(Math.min(Math.max(v, 0), 3));
      if (v !== null && (v < 0 || v > 3 || w !== v)) T.toast("A weight is a whole number from 0 to 3. It was set to " + w + ".");
      setWeight(sel, exam, basis, r.id, t, w); T.refresh("bpPlan", "bpTab");
    });
  };

  /* ================================================================ 2. the exam: name, duration, revision time */
  const NEW = "__new__";   // kept so old links in the code still work; the list no longer offers a new name
  T.sections.bpExam = function () {
    const sel = T.current(), el = $("#sec-bpexam"); if (!el) return;
    const ex = testExams(sel), basis = basisOf();
    let exam = examOf(sel);
    if (exam && !ex.includes(exam)) { const m = ex.find((x) => same(x, exam)); exam = m || ""; setExam(sel, exam); }
    const older = savedExams(sel).filter((x) => !ex.some((y) => same(x, y)));
    let row = exam ? tbl("exams").find((r) => String(r.course_code) === String(sel) && T.s(r.assessment) === exam) : null;
    // autosave: a chosen test starts as a 60-minute exam, so the builder works at once (unless a draft is being typed)
    if (exam && !row && !(S.ui.bpDraft || {})[`${sel}||${exam}`]) { saveExam(sel, exam, 60, 0); row = tbl("exams").find((r) => String(r.course_code) === String(sel) && T.s(r.assessment) === exam); }
    const dur = row ? num(row.duration_min) : (S.ui.bpDraft || {})[`${sel}||${exam}`]?.dur ?? 60, rev = row ? num(row.revision_min) || 0 : (S.ui.bpDraft || {})[`${sel}||${exam}`]?.rev ?? 0;
    const actual = Math.max((dur || 0) - (rev || 0), 0);
    let mins = "";
    if (exam) {
      const domains = [...new Set(P().planRows(sel, basis).map((r) => T.s(r.domain).trim()).filter(Boolean))];
      const ms = minutesState(sel, exam, basis, domains), doms = domains.length ? domains : Object.keys(ms.MCQ || {});
      const need = TYPES.map((t) => [t, new Set(P().planRows(sel, basis).filter((r) => typesOf(sel, exam, basis)(r.id).has(t)).map((r) => T.s(r.domain).trim()))]);
      mins = `<h4 class="bp-mh">Minutes needed to answer one question, by domain</h4>
        <p class="note">MCQ for K (1 minute) and S:Cog. (2 minutes) are fixed. Enter the minutes for the other boxes of each domain that this exam uses (they start empty). An outcome is left out of the calculation until its domain has a value. Your entries save themselves at once.</p>
        <div class="grid g3 bp-mins">${TYPES.map((t, ti) => `<div><h4 class="bp-th" style="color:${PAL[t][1]}">${t === "MCQ" ? "MCQ" : t.replace(" Essay", " essay")}</h4><table class="tbl bp-min"><colgroup><col><col style="width:46%"></colgroup><thead><tr><th>Domain</th><th>Minutes per question</th></tr></thead><tbody>
          ${Object.keys(ms[t]).filter((d) => doms.includes(d) || ms[t][d] !== null).map((d) => { const v = num(ms[t][d]), miss = v === null && need[ti][1].has(d); const fx = t === "MCQ" && FIXED_MCQ[basis] && d in FIXED_MCQ[basis];
            if (fx) return `<tr><td class="ro">${esc(d)}</td><td class="ro fixed-min" title="Fixed: always ${FIXED_MCQ[basis][d]} minute(s) for an MCQ of this domain">${g2(FIXED_MCQ[basis][d])} <span class="muted">(fixed)</span></td></tr>`;
            return `<tr><td class="ro">${esc(d)}</td><td><input type="text" inputmode="decimal" class="cell ${v !== null ? "filled" : ""} ${miss ? "need" : ""}" data-mt="${t}" data-md="${esc(d)}" data-ref="m:${t}:${esc(d)}" value="${v === null ? "" : esc(g2(v))}" ${miss ? `title="Needed: an outcome of this domain has ${t} ticked"` : ""}></td></tr>`; }).join("")}</tbody></table></div>`).join("")}</div>`;
    }
    el.innerHTML = `<div class="sec-head" id="h-bpexam"><div><h2>Test blueprint</h2><p class="sub">Choose the test you want to build the blueprint for. Each test-based assessment is a separate exam with its own duration, minutes per question, question types, weights and questions. Everything saves itself.</p></div></div>
      <div class="grid g3 bp-exam">
        <label class="fld ${exam ? "filled" : ""}" for="bp-exam"><span class="lbl">Test <i class="hint" title="The test-based assessments (quizzes, midterm, final ...) of the Summative assessment table in the Assessment plan.">?</i></span>
          <select id="bp-exam" data-ref="bp-exam"><option value="" ${exam ? "" : "selected"}>${ex.length ? "Choose a test" : "Add the test-based assessments in the Summative table first"}</option>
          ${ex.map((o) => `<option value="${esc(o)}" ${o === exam ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
        <div class="fld"><span class="lbl">Develop the blueprint based on</span>
          <div class="seg">${["CLOs", "SLOs"].map((b) => `<button class="${basis === b ? "on" : ""}" data-bpb="${b}">${b}</button>`).join("")}</div></div>
      </div>
      ${ex.length ? "" : `<div class="info-box"><span>The list shows the <b>test-based</b> assessments of the Summative table. Choose <b>Test-based assessment / اختبارات</b> as their method in the Assessment plan.</span><a class="btn sm" href="#assessment-plan">Go to Assessment plan</a></div>`}
      ${older.length ? `<p class="note">Saved earlier but not a test-based assessment in the Summative table: ${older.map((x) => `<b>${esc(x)}</b>`).join(", ")}. To work on it here, add it to the Summative table with the method Test-based assessment (same name).</p>` : ""}
      ${exam ? `<div class="grid g3 bp-exam">
        <label class="fld filled" for="bp-dur"><span class="lbl">Exam duration (minutes)</span><input type="text" inputmode="decimal" id="bp-dur" data-ref="bp-dur" value="${esc(g2(dur))}"></label>
        <label class="fld ${rev ? "filled" : ""}" for="bp-rev"><span class="lbl">Revision / extra time (minutes, if any)</span><input type="text" inputmode="decimal" id="bp-rev" data-ref="bp-rev" value="${esc(g2(rev))}"></label>
        <div class="kcard a bp-actual"><div class="lab">Actual exam time</div><div class="big">${g2(actual)} <small>minutes</small></div></div>
      </div>${!row ? `<p class="note">The exam is saved as soon as it has a duration above 0.</p>` : ""}${mins}${T.bpRenameHtml(sel, exam)}` : ""}`;
    $("#bp-exam", el).onchange = (e) => { setExam(sel, e.target.value); T.refresh("bpExam", "bpPlan", "bpTab"); };
    $$("[data-bpb]", el).forEach((b) => b.onclick = () => { S.ui.bpBasis = b.dataset.bpb; S.saveUi(); T.refresh("bpExam", "bpPlan", "bpTab"); });
    const save = () => {
      const d = num($("#bp-dur", el).value), r = num($("#bp-rev", el).value) || 0;
      if (d !== null && d > 0) saveExam(sel, exam, d, Math.max(r, 0));
      else { S.ui.bpDraft = S.ui.bpDraft || {}; S.ui.bpDraft[`${sel}||${exam}`] = { dur: d, rev: r }; S.saveUi(); }
      T.refresh("bpExam", "bpTab");
    };
    ["#bp-dur", "#bp-rev"].forEach((id) => { const i = $(id, el); if (i) i.onchange = save; });
    const k = key(sel, exam, basis);
    $$("[data-mt]", el).forEach((i) => i.onchange = () => {
      const m = obj("bp_minutes3")[k]; if (!m) return; const v = num(i.value);
      m[i.dataset.mt][i.dataset.md] = v !== null && v > 0 ? Math.max(0.5, Math.round(v * 2) / 2) : null;
      S.save(); T.refresh("bpExam", "bpTab");
    });
    if (exam) T.bpRenameWire(sel, exam, el, (v) => setExam(sel, v));
  };
  function saveExam(sel, exam, dur, rev) {
    const t = tbl("exams"); let r = t.find((x) => String(x.course_code) === String(sel) && T.s(x.assessment) === exam);
    if (!r) { r = { course_code: sel, assessment: exam, duration_min: dur, revision_min: rev }; t.push(r); }
    else { r.duration_min = dur; r.revision_min = rev; }
    S.save();
  }
  const examTimes = (sel, exam) => {
    const r = tbl("exams").find((x) => String(x.course_code) === String(sel) && T.s(x.assessment) === exam);
    const d = r ? num(r.duration_min) || 0 : 0, v = r ? num(r.revision_min) || 0 : 0;
    return { dur: d, rev: v, actual: Math.max(d - v, 0), saved: !!r };
  };

  /* ================================================================ 3. tabs: how many questions / question mapping / downloads */
  const TABS = [["build", "1. How many questions?"], ["map", "2. Exam builder"]];   // downloads are now under Exam builder > Reports
  T.sections.bpTab = function () {
    const sel = T.current(), el = $("#sec-bptab"); if (!el) return;
    if (S.ui.bpTab === "dl") { S.ui.bpTab = "map"; S.ui.ebTab = "reports"; }
    const tab = TABS.some(([k]) => k === S.ui.bpTab) ? S.ui.bpTab : "build";
    const exam = examOf(sel);
    let body;
    if (!exam || exam === NEW) body = `<div class="info-box"><span>Choose an assessment in <b>Test blueprint</b> above first.</span></div>`;
    else if (tab === "build") body = builder(sel, exam);
    else if (tab === "map") body = T.bpMapTab(sel, exam);
    el.innerHTML = `<div class="tabs" id="h-bptab">${TABS.map(([k, l]) => `<button class="${k === tab ? "on" : ""}" data-bptab="${k}">${l}</button>`).join("")}</div>${body}`;
    $$("[data-bptab]", el).forEach((b) => b.onclick = () => { S.ui.bpTab = b.dataset.bptab; S.saveUi(); T.refresh("bpTab"); });
    if (tab === "build" && exam && exam !== NEW) wireBuilder(sel, exam, el);
    if (tab === "map" && exam && exam !== NEW) T.bpMapWire(sel, exam, el);
  };

  /* ---------------------------------------------------------------- the blueprint builder (TAMA's calculation, unchanged) */
  function minutesState(sel, exam, basis, domains) {
    const all = obj("bp_minutes3"), k = key(sel, exam, basis);
    if (!all[k]) { const base = obj("bp_minutes2")[basis] || DEFAULT_MINUTES[basis]; all[k] = JSON.parse(JSON.stringify(base)); }
    const m = all[k];
    TYPES.forEach((t) => { m[t] = m[t] || {}; domains.forEach((d) => { if (!(d in m[t])) m[t][d] = t === "MCQ" && DEFAULT_MINUTES[basis].MCQ[d] !== undefined ? DEFAULT_MINUTES[basis].MCQ[d] : null; }); });
    Object.entries(FIXED_MCQ[basis] || {}).forEach(([d, v]) => { m.MCQ[d] = v; });   // fixed (Dania 2026-11-19)
    return m;
  }
  const minOf = (ms, t, d) => { const v = num(ms[t] ? ms[t][d] : null); return v !== null && v > 0 ? v : null; };
  function largestRemainder(values, total) {
    const floors = values.map(Math.floor); let left = Math.trunc(total) - floors.reduce((a, b) => a + b, 0);
    const order = values.map((v, i) => i).sort((a, b) => (values[b] - floors[b]) - (values[a] - floors[a]));
    const out = floors.slice(); order.slice(0, Math.max(left, 0)).forEach((i) => { out[i] += 1; }); return out;
  }

  function compute(sel, exam) {
    const basis = basisOf(), src = P().planRows(sel, basis), tp = typesOf(sel, exam, basis);
    const { actual } = examTimes(sel, exam);
    const rows = src.map((r) => { const s = tp(r.id); return { ...r, has: Object.fromEntries(TYPES.map((t) => [t, s.has(t)])) }; });
    const wr = rows.filter((r) => TYPES.some((t) => r.has[t]));
    const domains = [...new Set(rows.map((r) => T.s(r.domain).trim()).filter(Boolean))];
    const ms = minutesState(sel, exam, basis, domains);
    const raw = obj("bp_raw")[key(sel, exam, basis)] || {};
    wr.forEach((r) => {
      r.w = {}; r.eff = {}; r.min = {}; r.valid = {}; r.weff = {};
      TYPES.forEach((t) => {
        const v = num((raw[r.id] || {})[t]); r.w[t] = v === null ? null : Math.min(Math.max(v, 0), 3);
        r.eff[t] = r.has[t] ? (r.w[t] || 0) : 0; r.min[t] = minOf(ms, t, T.s(r.domain).trim());
        r.valid[t] = r.eff[t] > 0 && r.min[t] !== null; r.weff[t] = r.valid[t] ? r.eff[t] : 0;
      });
      r.total = TYPES.reduce((a, t) => a + r.eff[t], 0);
    });
    const need = [];
    TYPES.forEach((t) => [...new Set(rows.filter((r) => r.has[t]).map((r) => T.s(r.domain).trim()).filter(Boolean))].sort().forEach((d) => { if (minOf(ms, t, d) === null) need.push(`${t} - ${d}`); }));
    const over = wr.filter((r) => r.total > 3).map((r) => r.id);
    const totalW = wr.reduce((a, r) => a + TYPES.reduce((b, t) => b + r.weff[t], 0), 0);
    const out = { basis, rows, wr, ms, domains, need, over, totalW, actual, calc: null };
    if (over.length || actual <= 0 || totalW === 0) return out;
    // ---- the number of questions (as TAMA / the Excel blueprint)
    TYPES.forEach((t) => {
      wr.forEach((r) => { r["time_" + t] = actual * r.weff[t] / totalW; r["exact_" + t] = r.valid[t] ? r["time_" + t] / r.min[t] : 0; });
      const tot = Math.floor(wr.reduce((a, r) => a + r["exact_" + t], 0) + 0.5);
      const n = largestRemainder(wr.map((r) => r["exact_" + t]), tot); wr.forEach((r, i) => { r["n_" + t] = n[i]; });
    });
    const forced = [];
    TYPES.forEach((t) => wr.forEach((r) => { if (r.valid[t] && r["n_" + t] < 1) { forced.push(`${r.id} (${t})`); r["n_" + t] = 1; } }));
    // ---- fit the questions to the exam time
    const pairs = []; TYPES.forEach((t) => wr.forEach((r, i) => { if (r.valid[t]) pairs.push([i, t]); }));
    const pk = (p) => p[0] + "|" + p[1];
    const nn = {}, mm = {}, ee = {}, ww = {}; pairs.forEach((p) => { const r = wr[p[0]]; nn[pk(p)] = r["n_" + p[1]]; mm[pk(p)] = r.min[p[1]]; ee[pk(p)] = r["exact_" + p[1]]; ww[pk(p)] = r.weff[p[1]]; });
    const start = { ...nn };
    let totT = pairs.reduce((a, p) => a + nn[pk(p)] * mm[pk(p)], 0);
    const best = (list, f) => list.reduce((b, p) => { if (!b) return p; const x = f(p), y = f(b); return (x[0] > y[0] || (x[0] === y[0] && x[1] > y[1])) ? p : b; }, null);
    while (totT > actual + 1e-9) { const cand = pairs.filter((p) => nn[pk(p)] > 1); if (!cand.length) break; const p = best(cand, (q) => [nn[pk(q)] - ee[pk(q)], mm[pk(q)]]); nn[pk(p)] -= 1; totT -= mm[pk(p)]; }
    let spare = actual - totT;
    while (spare > 5 + 1e-9) { const cand = pairs.filter((p) => mm[pk(p)] <= spare + 1e-9); if (!cand.length) break; const p = best(cand, (q) => [ee[pk(q)] - nn[pk(q)], ww[pk(q)]]); nn[pk(p)] += 1; spare -= mm[pk(p)]; }
    pairs.forEach((p) => { wr[p[0]]["n_" + p[1]] = nn[pk(p)]; });
    const adj = pairs.filter((p) => nn[pk(p)] !== start[pk(p)]).map((p) => `${wr[p[0]].id} (${p[1]}) ${nn[pk(p)] > start[pk(p)] ? "+" : "-"}${Math.abs(nn[pk(p)] - start[pk(p)])}`);
    wr.forEach((r) => { TYPES.forEach((t) => { r["mins_" + t] = r["n_" + t] * (r.min[t] || 0); }); r.nTot = TYPES.reduce((a, t) => a + r["n_" + t], 0); r.minTot = Math.round(TYPES.reduce((a, t) => a + r["mins_" + t], 0) * 100) / 100; });
    const nIn = wr.filter((r) => TYPES.some((t) => r.valid[t])).length;
    const totN = Object.fromEntries(TYPES.map((t) => [t, wr.reduce((a, r) => a + r["n_" + t], 0)]));
    const totalMin = Math.round(wr.reduce((a, r) => a + r.minTot, 0) * 100) / 100;
    out.calc = { forced, adj, nIn, totN, totalMin, diff: Math.round((totalMin - actual) * 100) / 100 };
    return out;
  }

  /** Save the blueprint plan of this exam to tables.plans (TAMA's columns), and the exam row if it is missing. */
  function savePlan(sel, exam, R) {
    const plan = R.wr.map((r) => { const o = { course_code: sel, assessment: exam, basis: R.basis, lecture: R.basis === "SLOs" ? r.lecture : "", outcome_id: r.id, statement: r.statement, domain: r.domain };
      TYPES.forEach((t) => { const k = TYPE_KEY[t]; o[k + "_weight"] = Math.trunc(r.weff[t]); o[k + "_minutes"] = Math.round(r["mins_" + t] * 100) / 100; o[k + "_questions"] = r["n_" + t]; }); return o; });
    const pl = tbl("plans"), mineOf = (x) => String(x.course_code) === String(sel) && T.s(x.assessment) === exam && x.basis === R.basis;
    const old = pl.filter(mineOf);
    const sig = (list) => JSON.stringify(list.map((x) => PLAN_COLS.map((c) => T.s(x[c]))));
    if (sig(old) === sig(plan)) return;
    S.data.tables.plans = [...pl.filter((x) => !mineOf(x)), ...plan];
    S.save();
  }

  const PAL = { MCQ: ["#e0efff", "#1e40af", "#a9cdf7", "#1e3a8a"], "Short Essay": ["#fef3c7", "#92400e", "#fcd34d", "#78350f"], "Long Essay": ["#ede9fe", "#5b21b6", "#c4b5fd", "#4c1d95"] };
  function builder(sel, exam) {
    const R = compute(sel, exam), { basis, rows, wr, ms, need, over, calc, actual } = R;
    if (!rows.length) return `<div class="info-box"><span>This course has no ${basis} yet.</span></div>`;
    if (!wr.length) return `${live(R)}<p class="warn-text">None of the ${basis} has a weight for <b>${esc(exam)}</b> in the table above yet, so there is nothing to put in this written exam yet.</p>`;
    const info = [...(basis === "SLOs" ? [["lecture", "Lecture / module", 96]] : []), ["id", "ID", 52], ["statement", "Learning outcome", 0], ["domain", "Domain", 64]];
    let msgs = "";
    if (need.length) msgs += `<p class="warn-text">The minutes needed to answer one question were not completed for: ${esc(need.join("; "))}. The questions of these types cannot be counted until the minutes are entered (in "Minutes needed to answer one question" in Test blueprint above).</p>`;
    const miss = []; TYPES.forEach((t) => wr.forEach((r) => { if (r.eff[t] > 0 && r.min[t] === null) miss.push(`${r.id} (${t}, domain ${r.domain})`); }));
    if (miss.length) msgs += `<p class="warn-text">These question types are NOT counted yet because the minutes per question are empty for their domain: ${esc(miss.join("; "))}.</p>`;
    let res = "";
    if (over.length) res = `<p class="warn-text">The total importance weight of an outcome cannot be more than 3. Your numbers are kept and shown in orange in the table above; lower the MCQ, Short essay or Long essay weights of: ${esc(over.join(", "))}. The blueprint cannot be calculated or saved until every total is 3 or less.</p>`;
    else if (actual <= 0) res = `<p class="warn-text">Enter an exam duration that is greater than the revision time in Test blueprint above.</p>`;
    else if (R.totalW === 0) res = `<div class="info-box"><span>Enter the weights (0 to 3) in the table above to see how many questions are needed. The blueprint plan saves itself once the numbers can be calculated.</span></div>`;
    else res = results(sel, exam, R);
    return `${live(R)}${msgs}${overview(R, exam)}${res}`;
  }

  function live(R) {
    const c = R.calc;
    if (R.over.length) return `<div class="bp-live"><span class="pill warn">Fix weights</span> <span>Total weight above 3: ${esc(R.over.join(", "))}</span></div>`;
    if (!c) return `<div class="bp-live"><span class="lab">Live summary</span> <span>Set the weights to see how many questions are needed.</span></div>`;
    const col = { MCQ: "#14365d", "Short Essay": "#1b998b", "Long Essay": "#6d5acd" };
    const total = TYPES.reduce((a, t) => a + c.totN[t], 0);
    return `<div class="bp-live"><div><div class="big">${total}</div><div class="lab">questions · ${c.nIn} ${R.basis} · ${g2(R.actual)} minutes</div></div>
      ${TYPES.map((t) => { const n = R.wr.filter((r) => r["n_" + t] > 0).length, sh = R.actual ? R.wr.reduce((a, r) => a + r["mins_" + t], 0) / R.actual * 100 : 0;
        return `<div class="lv"><div class="lv-h"><b style="color:${col[t]}">${t}</b><span><b>${n}</b> ${R.basis}</span></div><div class="kbar"><i style="width:${Math.min(sh, 100)}%;background:${col[t]}"></i></div><span class="pct">${Math.round(sh)}% of exam time</span></div>`; }).join("")}
      <span class="pill ok">All totals are 3 or less</span></div>`;
  }

  function overview(R, exam) {
    const unit = R.basis, incl = R.wr.filter((r) => TYPES.some((t) => r.eff[t] > 0)).length;
    const rows = TYPES.map((t) => [t, R.rows.filter((r) => r.has[t]).length, R.wr.filter((r) => r.eff[t] > 0).length]);
    return `<h4>${esc(exam)}: ${unit} included in this exam (${incl} of ${R.rows.length}) and covered by each question type</h4>
      <table class="tbl sum-tbl bp-ov"><colgroup><col><col style="width:24%"><col style="width:28%"></colgroup><thead><tr><th>Question type</th><th class="num">${unit} planned</th><th class="num">${unit} covered in this exam</th></tr></thead>
      <tbody>${rows.map(([t, p, c]) => `<tr><td>${t}</td><td class="num">${p}</td><td class="num cov">${c}</td></tr>`).join("")}
      <tr class="total"><td>Included in this exam (any type)</td><td class="num">${R.wr.length}</td><td class="num cov">${incl}</td></tr></tbody></table>
      <p class="note">Planned and covered = with a weight above 0 for that type in the table above.</p>`;
  }

  function results(sel, exam, R) {
    const c = R.calc, { wr, basis, actual } = R;
    if (TYPES.reduce((a, t) => a + c.totN[t], 0) > 0) savePlan(sel, exam, R);
    let notes = `<p class="ok-line">✓ Blueprint plan saved automatically. It appears in the exam report and the Excel export.</p>`;
    if (c.forced.length) notes += `<div class="info-box"><span>Every outcome with a weight gets at least one question of that type. One question was added for: ${esc(c.forced.join(", "))}.</span></div>`;
    if (c.adj.length) notes += `<div class="info-box"><span>The number of questions was adjusted to fit the exam time (every weighted outcome and type keeps at least one question, and up to 5 spare minutes are accepted): ${esc(c.adj.slice(0, 15).join(", "))}${c.adj.length > 15 ? " ..." : ""}.</span></div>`;
    let tcls = "";
    if (c.diff > 0) { notes += `<p class="warn-text"><b>Not enough time:</b> with the minimum of one question for every weighted outcome and question type, the questions need ${g2(c.totalMin)} minutes, which is MORE than the exam time (${g2(actual)} minutes) by ${g2(c.diff)} minutes. Give fewer outcomes a weight, shorten the minutes per question, or increase the exam duration.</p>`; tcls = "t-bad"; }
    else if (c.diff < 0) { notes += Math.abs(c.diff) <= 5 ? `<div class="ok-box">The total time of the questions (${g2(c.totalMin)} minutes) leaves ${g2(Math.abs(c.diff))} spare minutes of the exam time (${g2(actual)} minutes). This is acceptable (up to 5 minutes).</div>`
      : `<p class="warn-text">The questions use ${g2(c.totalMin)} of ${g2(actual)} minutes, so ${g2(Math.abs(c.diff))} minutes are unused, because no further question of a weighted type fits in the remaining time.</p>`; tcls = "t-ok"; }
    const metrics = `<div class="kcards four">${[["MCQ needed", c.totN.MCQ], ["Short Essay needed", c.totN["Short Essay"]], ["Long Essay needed", c.totN["Long Essay"]], ["Outcomes in this exam", c.nIn]].map(([l, v]) => `<div class="kcard"><div class="lab">${l}</div><div class="big">${v}</div></div>`).join("")}</div>`;
    const info = [...(basis === "SLOs" ? [["lecture", "Lecture / module", 96]] : []), ["id", "ID", 52], ["statement", "Learning outcome", 0], ["domain", "Domain", 64]];
    const outTbl = `<h4>Number of questions needed for each learning outcome</h4>
      <div class="bp-wrap"><table class="tbl bp-out"><colgroup><col style="width:26px">${info.map(([, , w]) => `<col${w ? ` style="width:${w}px"` : ""}>`).join("")}${TYPES.map(() => `<col style="width:62px">`).join("")}<col style="width:56px"><col style="width:70px"></colgroup>
      <thead><tr><th>#</th>${info.map(([, l]) => `<th class="words">${l}</th>`).join("")}${TYPES.map((t) => `<th class="num">${t}</th>`).join("")}<th class="num">Total</th><th class="num">Total minutes</th></tr></thead>
      <tbody>${wr.map((r, i) => `<tr><td class="ro muted">${i + 1}</td>${info.map(([k]) => `<td class="ro words ${k === "statement" || k === "lecture" ? "wrap" : ""} ${k === "id" ? "b" : ""}">${esc(r[k])}</td>`).join("")}${TYPES.map((t) => `<td class="num">${r["n_" + t]}</td>`).join("")}<td class="num b">${r.nTot}</td><td class="num">${r.minTot.toFixed(2)}</td></tr>`).join("")}
      <tr class="total"><td></td>${info.map(([k]) => `<td>${k === "statement" ? "TOTAL" : ""}</td>`).join("")}${TYPES.map((t) => `<td class="num">${c.totN[t]}</td>`).join("")}<td class="num">${TYPES.reduce((a, t) => a + c.totN[t], 0)}</td><td class="num ${tcls}">${c.totalMin.toFixed(2)}</td></tr></tbody></table></div>`;
    const tRows = TYPES.map((t) => { const mins = wr.reduce((a, r) => a + r["mins_" + t], 0), nq = c.totN[t]; return { t, w: wr.reduce((a, r) => a + r.weff[t], 0), sh: mins / actual * 100, mins, nq, avg: nq ? mins / nq : 0 }; });
    const typeTbl = `<h4>Weight of each type of question in the exam</h4>
      <table class="tbl sum-tbl bp-type"><thead><tr><th>Type</th><th class="num">Total weight</th><th class="num">Share of exam time (%)</th><th class="num">Minutes</th><th class="num">Questions needed</th><th class="num">Average minutes per question</th></tr></thead>
      <tbody>${tRows.map((x) => `<tr><td>${x.t}</td><td class="num">${g2(x.w)}</td><td class="num">${x.sh.toFixed(2)}</td><td class="num">${g2(x.mins)}</td><td class="num">${x.nq}</td><td class="num">${g2(x.avg)}</td></tr>`).join("")}
      <tr class="total"><td>Total</td><td></td><td class="num">${g2(tRows.reduce((a, x) => a + x.sh, 0))}</td><td class="num">${g2(tRows.reduce((a, x) => a + x.mins, 0))}</td><td class="num">${tRows.reduce((a, x) => a + x.nq, 0)}</td><td></td></tr></tbody></table>`;
    const detCols = [...(basis === "SLOs" ? ["Lecture / module"] : []), "ID", "Domain", ...TYPES.flatMap((t) => [`${t} weight`, `${t} minutes`, `${t} per question (min)`, `${t} exact`, `${t} needed`])];
    const det = `<details class="sum-box"><summary>Calculation details</summary><div class="bp-wrap"><table class="tbl sum-tbl bp-det"><thead><tr>${detCols.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
      ${wr.map((r) => `<tr>${basis === "SLOs" ? `<td>${esc(r.lecture)}</td>` : ""}<td>${esc(r.id)}</td><td>${esc(r.domain)}</td>${TYPES.map((t) => `<td class="num">${g2(r.weff[t])}</td><td class="num">${g2(r["time_" + t])}</td><td class="num">${g2(r.min[t])}</td><td class="num">${g2(r["exact_" + t])}</td><td class="num">${r["n_" + t]}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
    return `${metrics}${notes}${outTbl}${typeTbl}${det}<div class="row-btns"><button class="btn sm" id="bp-csv">Download this blueprint (CSV)</button></div>`;
  }

  function wireBuilder(sel, exam, el) {
    const basis = basisOf(), k = key(sel, exam, basis);
    const csv = $("#bp-csv", el);
    if (csv) csv.onclick = () => {
      const R = compute(sel, exam), basis2 = R.basis, q = (v) => `"${T.s(v).replace(/"/g, '""')}"`;
      const head = [...(basis2 === "SLOs" ? ["Lecture / module"] : []), "ID", "Learning outcome", "Domain", ...TYPES, "Total", "Total minutes"];
      const lines = [head, ...R.wr.map((r) => [...(basis2 === "SLOs" ? [r.lecture] : []), r.id, r.statement, r.domain, ...TYPES.map((t) => r["n_" + t]), r.nTot, r.minTot.toFixed(2)]),
        [...(basis2 === "SLOs" ? [""] : []), "", "TOTAL", "", ...TYPES.map((t) => R.calc.totN[t]), TYPES.reduce((a, t) => a + R.calc.totN[t], 0), R.calc.totalMin.toFixed(2)]];
      const blob = new Blob(["﻿" + lines.map((l) => l.map(q).join(",")).join("\r\n")], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `blueprint_${T.baseCode(sel).replace(/\s+/g, "_")}_${exam.replace(/[^\w-]+/g, "_")}_${basis2}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
  }

  /* ================================================================ the page */
  T.renderBlueprintPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "The blueprint fills in as soon as you have saved at least one course in Course setup."}</p>
        <div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = `<section class="card" id="sec-bpexam"></section><section class="card" id="sec-bpplan"></section><section class="card" id="sec-bptab"></section>`;
    T.refresh("bpExam", "bpPlan", "bpTab");
  };
})();
