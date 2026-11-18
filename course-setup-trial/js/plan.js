/* Assessment plan page: Summative assessment (grading breakdown), Formative assessment, the plan that ticks which
   assessment methods measure each CLO or SLO, the assessment columns of the course, and the summaries under it.
   Ported from TAMA's Assessment plan page; it reads and writes the same keys of app_data.json. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;

  /* ---------------------------------------------------------------- shared data helpers */
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const mine = (n, sel) => tbl(n).filter((r) => String(r.course_code) === String(sel));
  const clean = (v) => { const s = v === null || v === undefined ? "" : String(v); return ["nan", "none", "nat"].includes(s.trim().toLowerCase()) ? "" : s.trim(); };
  const split = (t) => T.s(t).replace(/;/g, ",").split(",").map((x) => x.trim()).filter((x) => x && !["nan", "none"].includes(x.toLowerCase()));
  const fmt = (n) => { if (n === null || n === undefined || isNaN(n)) return ""; const r = Math.round(n * 100) / 100; return String(r); };
  const numOf = (v) => { const x = parseFloat(String(v === undefined || v === null ? "" : v).replace("%", "").replace(",", ".").trim()); return isNaN(x) ? null : x; };
  const val = (v) => T.s(v).replace(/^\+/, "").trim();

  function crStore(sel) {   // the Course Report inputs of one course (same object the Lectures & SLOs page uses)
    const all = (S.data.course_report = S.data.course_report && typeof S.data.course_report === "object" ? S.data.course_report : {});
    const d = (all[String(sel)] = all[String(sel)] || {});
    d.rule = d.rule || "kpi";
    ["methods", "actual", "clo_comments", "topics", "eval"].forEach((k) => { if (!d[k] || typeof d[k] !== "object") d[k] = {}; });
    return d;
  }

  /* ---------------------------------------------------------------- assessment methods and their 4 types */
  const FIXED = ["MCQ", "Short Essay", "Long Essay"];
  const KINDS = ["Test-based assessment", "Performance-based assessment", "Indirect assessment", "Others"];
  const PERF = [   // offered under "Add a column" (English, Arabic)
    ["Workplace-based assessment", "التقويم العملي الميداني"], ["Case-based discussion", "اختبار مناقشة الحالات"],
    ["DOPS", "التقويم بالملاحظة المباشرة للمهارات"], ["Mini-CEX", "الاختبار السريري المصغر"], ["OSCE", "الاختبار السريري الموضوعي"],
    ["OSPE", "الاختبار العملي الموضوعي"], ["Communication", "التقويم بالتواصل"], ["Portfolio", "حقيبة أعمال الطالب"],
    ["Discussion and debate", "المناقشة والمناظرة"], ["Simulation and role-play", "المحاكاة ولعب الأدوار"], ["Presentations", "عروض تقديمية"]];
  const PERF_AR = Object.fromEntries(PERF);
  const KIND_WORDS = [
    ["Indirect assessment", /survey|feedback|questionnaire|focus group|interview|self[- ]?assess|self[- ]?report|course evaluation|student evaluation|teaching evaluation|exit survey|alumni|employer|satisfaction|استبيان|استطلاع/],
    ["Performance-based assessment", /presentation|simulation|role[- ]?play|discussion|debate|portfolio|communication|ospe|osce|mini[- ]?cex|minicex|dops|direct observation|case[- ]?based|\bcbd\b|\bcase\b|workplace|practical|clinical|\blab|laboratory|project|assignment|report|log ?book|seminar|poster|field|observation|skill|performance|\boral\b|viva|journal club|research|demonstration|procedur|bedside|\bward|rotation|logbook|essay writing task/],
    ["Test-based assessment", /mcq|multiple choice|essay|quiz|exam|\btest|written|true ?\/ ?false|\bt\/f\b|mid[- ]?term|\bfinal\b|short answer|\bsaq\b|\bemq\b|\bsba\b|matching|fill in|\bmeq\b/],
  ];
  const guessKind = (m) => { const t = T.s(m).trim().toLowerCase(); for (const [k, re] of KIND_WORDS) if (re.test(t)) return k; return "Others"; };
  const kinds = () => (S.data.method_kinds = S.data.method_kinds && typeof S.data.method_kinds === "object" ? S.data.method_kinds : {});
  const methodKind = (m) => { const k = kinds()[T.s(m).trim().toUpperCase()]; return KINDS.includes(k) ? k : guessKind(m); };
  const setKind = (m, k) => { if (k === guessKind(m)) delete kinds()[T.s(m).trim().toUpperCase()]; else kinds()[T.s(m).trim().toUpperCase()] = k; };
  const extrasAll = () => (S.data.extra_methods = S.data.extra_methods && typeof S.data.extra_methods === "object" ? S.data.extra_methods : {});
  const extras = (sel) => (extrasAll()[String(sel)] = Array.isArray(extrasAll()[String(sel)]) ? extrasAll()[String(sel)] : []);
  const colMethods = (sel) => [...FIXED, ...extras(sel)];   // the old fixed + added columns (used by the hidden column tools)
  /** The plan's columns: the names of the assessments in the Summative table (Dania 2026-11-19). */
  const methods = (sel) => { const out = []; gradingRows(sel).forEach((r) => { const a = T.s(r.Assessment).trim(); if (a && !out.some((x) => x.toUpperCase() === a.toUpperCase())) out.push(a); }); return out; };
  const SHOW_COL_TOOLS = false;   // "Add, rename or delete assessment columns": hidden on this page (Dania 2026-11-19), kept for use elsewhere
  const TEST = "Test-based assessment";
  /** All method names of all courses, grouped by type: the order the saved "MCQ, OSCE" texts are written in (as in TAMA). */
  function methodOrder() {
    const names = [...new Set([...FIXED, ...Object.values(extrasAll()).flat()])];
    return KINDS.flatMap((k) => names.filter((m) => methodKind(m) === k));
  }
  const TYPE_WORDS = [   // the course's list of assessments: a suggested type from the name (first match wins)
    ["Written exam", /exam|midterm|mid-term|final|quiz|test|mcq|saq|essay/], ["Practical / clinical", /osce|practical|clinical|lab\b|laborator|skill|simulation|case[- ]?based|spot/],
    ["Presentation / oral", /presentation|present|oral|viva|seminar|debate|discussion|defen[cs]e|poster|pitch/], ["Project", /project|community|field|capstone|proposal|plan\b|program/],
    ["Assignment / report", /assignment|report|paper|research|review|portfolio|reflect|journal|log\b|homework|worksheet|survey|critique|thesis/],
    ["Continuous assessment", /\bca\b|continuous|participation|attendance|professionalism|behaviou?r|engagement|activity|activities/]];
  const suggestType = (n) => { n = T.s(n).toLowerCase(); for (const [t, re] of TYPE_WORDS) if (re.test(n)) return t; return "Other"; };

  /** Saved method lists (SLOs and CLO plans) of one course; with fn, each list is replaced by fn(list). */
  function methodLists(sel, fn) {
    const found = [];
    ["slos", "clo_plan"].forEach((t) => tbl(t).forEach((r) => {
      if (String(r.course_code) !== String(sel)) return;
      const l = split(r.assessment_methods);
      if (fn) r.assessment_methods = fn(l).join(", ");
      found.push(...l);
    }));
    return found;
  }

  /* ---------------------------------------------------------------- the course's assessments (names and full marks) */
  function examNames(sel) {
    const out = [];
    ["exams", "plans", "questions"].forEach((t) => mine(t, sel).forEach((r) => { const a = clean(r.assessment); if (a && !out.includes(a)) out.push(a); }));
    return out;
  }
  function courseAssessments(sel) {
    const rows = mine("course_assessments", sel).filter((r) => clean(r.assessment)).map((r) => ({ assessment: clean(r.assessment), type: r.type, full_grade: numOf(r.full_grade) }));
    const have = new Set(rows.map((r) => r.assessment));
    const ia = Object.fromEntries(mine("ia_tests", sel).map((r) => [clean(r.assessment), numOf(r.total_points)]));
    const qm = {}; mine("questions", sel).forEach((q) => { const a = clean(q.assessment); qm[a] = (qm[a] || 0) + (numOf(q.max_marks) || 0); });
    const ex = examNames(sel);
    [...ex, ...Object.keys(ia), ...mine("slo_other", sel).map((r) => clean(r.assessment))].forEach((a) => {
      if (!a || have.has(a)) return;
      let full = ia[a]; if (full === null || full === undefined) full = qm[a] || null;
      rows.push({ assessment: a, type: ex.includes(a) || a in ia ? "Written exam" : suggestType(a), full_grade: full }); have.add(a);
    });
    extras(sel).forEach((a) => { if (!have.has(a)) { rows.push({ assessment: a, type: suggestType(a), full_grade: null }); have.add(a); } });
    return rows;
  }

  /* ---------------------------------------------------------------- Summative assessment (grading breakdown) */
  const GCOLS = ["Assessment", "Method", "Type", "Mark", "Weight", "Due date"];
  const METHOD_OPTS = [[TEST, "اختبارات"], ...PERF];   // the assessment method of each summative assessment (English – Arabic)
  const methodType = (m) => (!m ? "" : m === TEST ? "Test-based" : "Performance-based");
  const DR_KINDS = { "Test-based": "Test-based assessment", "Performance-based": "Performance-based assessment" };
  function drKind(name, given) {
    if (given in DR_KINDS) return given;
    if (!T.s(name).trim()) return "";
    const k = methodKind(name);
    return Object.keys(DR_KINDS).find((s) => DR_KINDS[s] === k) || "";
  }
  function gradingRows(sel) {
    const saved = crStore(sel).grading;
    if (Array.isArray(saved) && saved.length) return saved.map((r) => Object.fromEntries(GCOLS.map((c) => [c, clean(r[c])])));
    const ca = courseAssessments(sel);
    const tot = ca.reduce((s, r) => s + (r.full_grade || 0), 0);
    return ca.map((r) => ({ Assessment: r.assessment, Method: "", Type: "", Mark: r.full_grade !== null ? fmt(r.full_grade) : "", Weight: tot && r.full_grade !== null ? `${Math.round(r.full_grade / tot * 100)}%` : "", "Due date": "" }));
  }
  function gradingCalc(rows, total, mode) {   // Marks mode: weight = mark / total. Weight mode: mark = weight x total.
    const Tm = numOf(total);
    return rows.map((r) => {
      r = { ...r };
      if (Tm && Tm > 0) {
        if (mode === "Weight") { const w = numOf(r.Weight); r.Mark = w !== null ? fmt(w * Tm / 100) : ""; if (w !== null) r.Weight = `${fmt(w)}%`; }
        else { const m = numOf(r.Mark); r.Weight = m !== null ? `${fmt(m / Tm * 100)}%` : ""; }
      }
      return r;
    });
  }
  function subRename(sel, oldN, newN) {   // an assessment renamed here keeps its sub-categories (Exam results page)
    const ui = S.data.ui_settings || {}, rows = (ui.xm_sub_rows || {})[String(sel)];
    if (!Array.isArray(rows) || rows.some((r) => r.Assessment === newN) || !rows.some((r) => r.Assessment === oldN)) return;
    rows.forEach((r) => { if (r.Assessment === oldN) r.Assessment = newN; });
    const parts = ui.xm_parts || {}, ok = `${sel}||${oldN}`, nk = `${sel}||${newN}`;
    if (parts[ok] && !parts[nk]) { parts[nk] = parts[ok]; delete parts[ok]; }
  }
  /** Save the breakdown: the rows, the total and mode, each row's type, and the marks into the course's list of assessments. */
  function saveGrading(sel, rows, total, mode) {
    const d = crStore(sel);
    const keep = rows.filter((r) => r.Assessment);
    const ca = tbl("course_assessments");
    const before = new Set(mine("course_assessments", sel).map((r) => clean(r.assessment)));
    d.grading = keep;
    keep.forEach((r) => {
      if (r.Assessment && DR_KINDS[r.Type]) setKind(r.Assessment, DR_KINDS[r.Type]);
      const m = numOf(r.Mark);
      const hit = ca.filter((x) => String(x.course_code) === String(sel) && clean(x.assessment) === r.Assessment);
      if (hit.length) { if (m !== null) hit.forEach((x) => { x.full_grade = m; }); }
      else if (m !== null) ca.push({ course_code: sel, assessment: r.Assessment, type: suggestType(r.Assessment), full_grade: m });
    });
    // names this table added and then changed or removed come out of the course's assessment list again (unless they have marks)
    const added = new Set([...((S.ui.gradAdded || {})[sel] || []), ...mine("course_assessments", sel).map((r) => clean(r.assessment)).filter((a) => !before.has(a))]);
    const now = new Set(keep.map((r) => r.Assessment));
    const withMarks = new Set(mine("marks", sel).map((r) => clean(r.assessment)));
    const stray = [...added].filter((a) => !now.has(a) && !withMarks.has(a));
    if (stray.length) S.setT("course_assessments", ca.filter((x) => !(String(x.course_code) === String(sel) && stray.includes(clean(x.assessment)))));
    S.ui.gradAdded = S.ui.gradAdded || {}; S.ui.gradAdded[sel] = [...added].filter((a) => !stray.includes(a)); S.saveUi();
    d.grading_cfg = { ...(d.grading_cfg || {}), total, mode };
    S.save();
  }

  T.sections.summative = function () {
    const sel = T.current(), el = $("#sec-summ"); if (!el) return;
    const d = crStore(sel), cfg = d.grading_cfg || {};
    const saved = gradingRows(sel).map((r) => ({ ...r, Type: drKind(r.Assessment, r.Type) }));
    const tot0 = saved.reduce((s, r) => s + (numOf(r.Mark) || 0), 0);
    const total = T.s(cfg.total || (tot0 ? fmt(tot0) : "100")), mode = cfg.mode === "Weight" ? "Weight" : "Marks";
    const calc = mode === "Marks" ? "Weight" : "Mark";
    const rows = gradingCalc(saved, total, mode).map((r) => ({ ...r, Type: drKind(r.Assessment, r.Type) }));
    const Tm = numOf(total);
    const sm = rows.reduce((s, r) => s + (numOf(r.Mark) || 0), 0), sw = rows.reduce((s, r) => s + (numOf(r.Weight) || 0), 0);
    let check = "";
    if (rows.length && Tm) {
      check = `Total: <b>${fmt(sm)}</b> of ${fmt(Tm)} marks · <b>${fmt(sw)}%</b>`;
      if (mode === "Marks" && Math.abs(sm - Tm) > 0.01) check += ` <span class="warn-text inline">the marks should add up to ${fmt(Tm)} (${sm < Tm ? "add" : "remove"} ${fmt(Math.abs(Tm - sm))} marks)</span>`;
      else if (mode === "Weight" && Math.abs(sw - 100) > 0.01) check += ` <span class="warn-text inline">the weights should add up to 100% (${sw < 100 ? "add" : "remove"} ${fmt(Math.abs(100 - sw))}%)</span>`;
      else check += " ✅";
    }
    if (!Tm) check = `<span class="warn-text inline">Type the total course marks (e.g. 100) so the ${calc.toLowerCase()}s can be worked out.</span>`;
    const cell = (i, c, v, ph) => {
      if (c === calc) return `<td data-l="${c} (calculated)"><span class="calc">${esc(v) || "—"}</span></td>`;
      if (c === "Method") { const opts = [...METHOD_OPTS]; if (v && !opts.some(([m]) => m === v)) opts.push([v, ""]);
        return `<td data-l="Assessment method"><select class="cell ${v ? "filled" : ""}" data-gi="${i}" data-gc="Method" data-ref="g:${i}:Method" title="Choose the assessment method. Test-based = exams and quizzes (اختبارات)."><option value=""></option>${opts.map(([m, a]) => `<option value="${esc(m)}" ${m === v ? "selected" : ""}>${esc(a ? `${m} – ${a}` : m)}</option>`).join("")}</select></td>`; }
      if (c === "Type") return `<td data-l="Type"><select class="cell ${v ? "filled" : ""}" data-gi="${i}" data-gc="Type" data-ref="g:${i}:Type" title="Test-based (exams, quizzes) or Performance-based (presentations, projects, OSCE ...). The Exam blueprint lists the test-based ones."><option value=""></option>${Object.keys(DR_KINDS).map((k) => `<option ${k === v ? "selected" : ""}>${k}</option>`).join("")}</select></td>`;
      return `<td data-l="${c}"><textarea rows="1" class="cell ${T.s(v).trim() ? "filled" : ""}" data-gi="${i}" data-gc="${c}" data-ref="g:${i}:${c}" ${ph ? `placeholder="${esc(ph)}"` : ""} spellcheck="${c === "Assessment" ? "true" : "false"}">${esc(v)}</textarea></td>`;
    };
    const n = rows.length;
    el.innerHTML = `<div class="sec-head" id="h-summ"><div><h2>Summative assessment</h2><p class="sub">The grading breakdown of the course. The Syllabus and the Course Specification take it from here.</p></div></div>
      <div class="grid g-tot">
        ${T.field({ id: "g-total", label: "1. Total course marks", value: total, help: "The full mark of the whole course, e.g. 100" })}
        <div class="fld"><span class="lbl">2. What will you type in the table?</span>
          <div class="seg">${[["Marks", "✏️ The marks → the weights are calculated"], ["Weight", "✏️ The weights (%) → the marks are calculated"]].map(([v, l]) => `<button class="${mode === v ? "on" : ""}" data-gmode="${v}">${l}</button>`).join("")}</div></div>
      </div>
      <p class="note">Type each assessment with its ${mode === "Marks" ? "mark" : "weight (%)"} and due date. The ${calc.toLowerCase()} is worked out at once from the total course marks, and everything saves itself. To move an assessment, type its new place in <b>Order</b> (e.g. 1 puts it first). Type a new assessment in the empty last row.</p>
      <table class="tbl g-tbl"><colgroup><col style="width:58px"><col style="width:30%"><col><col style="width:162px"><col style="width:66px"><col style="width:80px"><col style="width:10%"><col style="width:42px"></colgroup>
      <thead><tr><th>Order</th><th>Assessment</th><th>Assessment method</th><th>Type</th><th>Mark${calc === "Mark" ? " (calc.)" : ""}</th><th>Weight${calc === "Weight" ? " (calc.)" : ""}</th><th>Due date</th><th title="Delete">🗑</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-i="${i}"><td data-l="Order"><input class="cell num-in filled" type="number" min="1" step="1" value="${i + 1}" data-gi="${i}" data-gc="Order" data-ref="g:${i}:Order" title="Type a number to move the assessment to that place, e.g. 1 puts it first"></td>
          ${GCOLS.map((c) => cell(i, c, r[c], c === "Due date" ? "e.g. Week 6" : "")).join("")}
          <td class="ctr"><button class="icon-btn" data-gdel="${i}" title="Delete this assessment" aria-label="Delete">🗑</button></td></tr>
          <tr class="confirm-row" data-gconfirm="${i}" hidden><td colspan="8"><span class="warn-text">Delete ${esc(r.Assessment || "this row")} from the breakdown?</span>
            <button class="btn sm" data-gyes="${i}">Yes, delete</button> <button class="btn sm ghost" data-gno="${i}">Cancel, keep it</button></td></tr>`).join("")}
        <tr data-i="${n}" class="new-row"><td data-l="Order"><input class="cell num-in" type="number" min="1" step="1" value="" data-gi="${n}" data-gc="Order" data-ref="g:${n}:Order" placeholder="${n + 1}"></td>
          ${GCOLS.map((c) => cell(n, c, c === calc ? "" : T.s(((S.ui.gradDraft || {})[sel] || {})[c]), c === "Assessment" ? "Type a new assessment" : c === "Due date" ? "e.g. Week 6" : "")).join("")}<td></td></tr>
        <tr class="total-row"><td>—</td><td><b>TOTAL</b></td><td>—</td><td>—</td><td><b>${fmt(sm)}</b></td><td><b>${fmt(sw)}%</b></td><td>—</td><td></td></tr></tbody></table>
      <p class="tot-line">${check}</p>`;

    const commit = (list) => { const out = gradingCalc(list.filter((r) => ["Order", ...GCOLS].some((c) => c !== calc && c !== "Type" && c !== "Order" && T.s(r[c]).trim())), total, mode); saveGrading(sel, out, total, mode); T.refresh("summative", "plan", "planSum"); };
    const tf = $("#g-total", el);
    tf.addEventListener("input", () => T.markFilled(tf));
    tf.addEventListener("change", () => { const t = val(tf.value); d.grading_cfg = { ...(d.grading_cfg || {}), total: t, mode }; const out = gradingCalc(rows, t, mode); saveGrading(sel, out, t, mode); T.refresh("summative"); });
    $$("[data-gmode]", el).forEach((b) => b.onclick = () => { if (b.dataset.gmode === mode) return; saveGrading(sel, gradingCalc(rows, total, b.dataset.gmode), total, b.dataset.gmode); T.refresh("summative"); });
    $$(".g-tbl .cell", el).forEach((f) => {
      const i = +f.dataset.gi, c = f.dataset.gc;
      if (f.tagName === "TEXTAREA") T.autoGrow(f);
      f.addEventListener("input", () => { f.classList.toggle("filled", !!T.s(f.value).trim()); if (f.tagName === "TEXTAREA") T.autoGrow(f); });
      if (f.tagName !== "SELECT") f.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.blur(); } });
      f.addEventListener("change", () => {
        const list = rows.map((r) => ({ ...r }));
        let v = val(f.value);
        if (c === "Assessment") v = T.cap1(v, "Assessment");
        if (i === n) {   // the empty last row: it becomes an assessment as soon as something is typed in it
          if (c === "Order") { if (!v) return; const o = parseInt(v, 10); if (isNaN(o)) { T.toast("Order needs a number, e.g. 1 puts the assessment first.", "warn"); return; } S.ui.gradNewAt = Math.max(1, o); S.saveUi(); T.toast(`Now type the assessment's name: it will go in place ${S.ui.gradNewAt}.`); return; }
          // what is typed in the new row is kept (in this browser) until it has a name, then it becomes an assessment
          const dr = (S.ui.gradDraft = S.ui.gradDraft || {}), nr = { Assessment: "", Method: "", Type: "", Mark: "", Weight: "", "Due date": "", ...(dr[sel] || {}) }; nr[c] = v; if (c === "Method") nr.Type = methodType(v);
          if (!nr.Assessment) { dr[sel] = nr; S.saveUi(); if (v) T.toast("Kept. Now type the assessment's name in this row.", "ok"); return; }
          delete dr[sel];
          const at = S.ui.gradNewAt ? Math.min(S.ui.gradNewAt - 1, list.length) : list.length; delete S.ui.gradNewAt; S.saveUi();
          list.splice(at, 0, nr); commit(list); return;
        }
        if (c === "Order") {
          let to = parseInt(v, 10); if (isNaN(to)) { T.toast("Order needs a number, e.g. 1 puts the assessment first.", "warn"); f.value = i + 1; return; }
          to = Math.max(1, Math.min(list.length, to)); const moved = list.splice(i, 1)[0]; list.splice(to - 1, 0, moved);
          T.toast("Assessments put in the new order."); commit(list); return;
        }
        if (c === "Assessment" && list[i].Assessment && v && v !== list[i].Assessment && !list.some((r, k) => k !== i && r.Assessment === list[i].Assessment)) {
          const old = list[i].Assessment;
          subRename(sel, old, v);
          methodLists(sel, (l) => l.map((x) => (x.toUpperCase() === old.toUpperCase() ? v : x)));   // its ticks in the plan follow the new name
        }
        list[i][c] = v;
        if (c === "Method") list[i].Type = methodType(v);
        commit(list);
      });
    });
    $$("[data-gdel]", el).forEach((b) => b.onclick = () => { $(`[data-gconfirm="${b.dataset.gdel}"]`, el).hidden = false; });
    $$("[data-gno]", el).forEach((b) => b.onclick = () => { $(`[data-gconfirm="${b.dataset.gno}"]`, el).hidden = true; });
    $$("[data-gyes]", el).forEach((b) => b.onclick = () => { const list = rows.map((r) => ({ ...r })); const gone = list.splice(+b.dataset.gyes, 1)[0]; commit(list); T.toast(`${gone.Assessment || "The row"} was deleted from the breakdown.`); });
  };

  /* ---------------------------------------------------------------- Formative assessment (no marks) */
  const FCOLS = [["Assessment", "Assessment", ""], ["Description", "Description / purpose", ""], ["Timing", "Timing", "e.g. Week 7, End of course"]];
  T.sections.formative = function () {
    const sel = T.current(), el = $("#sec-form"); if (!el) return;
    const d = crStore(sel);
    const rows = (Array.isArray(d.formative) ? d.formative : []).map((r) => Object.fromEntries(FCOLS.map(([c]) => [c, clean(r[c])])));
    const n = rows.length;
    const cell = (i, c, lab, v, ph) => `<td data-l="${lab}"><textarea rows="1" class="cell ${T.s(v).trim() ? "filled" : ""}" data-fi="${i}" data-fc="${c}" data-ref="f:${i}:${c}" ${ph ? `placeholder="${esc(ph)}"` : ""} spellcheck="true">${esc(v)}</textarea></td>`;
    el.innerHTML = `<div class="sec-head" id="h-form"><div><h2>Formative assessment (indirect assessment)</h2><p class="sub">Assessments without marks that give feedback on learning, e.g. surveys, student feedback, reflection, one-minute paper. Saved by itself.</p></div></div>
      <table class="tbl f-tbl"><colgroup><col style="width:26%"><col><col style="width:20%"><col style="width:56px"></colgroup>
      <thead><tr><th>Assessment</th><th>Description / purpose</th><th>Timing</th><th>Delete</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-i="${i}">${FCOLS.map(([c, lab, ph]) => cell(i, c, lab, r[c], ph)).join("")}<td class="ctr"><button class="icon-btn" data-fdel="${i}" title="Delete this row" aria-label="Delete">🗑</button></td></tr>
          <tr class="confirm-row" data-fconfirm="${i}" hidden><td colspan="4"><span class="warn-text">Delete ${esc(r.Assessment || "this row")}?</span>
            <button class="btn sm" data-fyes="${i}">Yes, delete</button> <button class="btn sm ghost" data-fno="${i}">Cancel, keep it</button></td></tr>`).join("")}
        <tr data-i="${n}" class="new-row">${FCOLS.map(([c, lab, ph]) => cell(n, c, lab, "", c === "Assessment" ? "Type a new formative assessment" : ph)).join("")}<td></td></tr></tbody></table>`;
    const commit = (list) => {
      d.formative = list.filter((r) => Object.values(r).some((x) => T.s(x).trim()));
      d.formative.forEach((r) => { if (r.Assessment) setKind(r.Assessment, "Indirect assessment"); });
      S.save(); T.refresh("formative", "planSum");
    };
    $$(".f-tbl .cell", el).forEach((f) => {
      const i = +f.dataset.fi, c = f.dataset.fc;
      T.autoGrow(f);
      f.addEventListener("input", () => {
        f.classList.toggle("filled", !!T.s(f.value).trim()); T.autoGrow(f);
        if (i < n) { rows[i][c] = f.value; d.formative = rows; S.saveSoon(); }
      });
      f.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.blur(); } });
      f.addEventListener("change", () => {
        const v = c === "Timing" ? val(f.value) : T.cap1(val(f.value), c);
        const list = rows.map((r) => ({ ...r }));
        if (i === n) { if (!v) return; const nr = { Assessment: "", Description: "", Timing: "" }; nr[c] = v; list.push(nr); }
        else list[i][c] = v;
        commit(list);
      });
    });
    $$("[data-fdel]", el).forEach((b) => b.onclick = () => { $(`[data-fconfirm="${b.dataset.fdel}"]`, el).hidden = false; });
    $$("[data-fno]", el).forEach((b) => b.onclick = () => { $(`[data-fconfirm="${b.dataset.fno}"]`, el).hidden = true; });
    $$("[data-fyes]", el).forEach((b) => b.onclick = () => { const list = rows.map((r) => ({ ...r })); list.splice(+b.dataset.fyes, 1); commit(list); T.toast("Row deleted."); });
  };

  /* ---------------------------------------------------------------- the plan: outcomes x assessment methods */
  const basisOf = () => (S.ui.planBasis === "SLOs" ? "SLOs" : "CLOs");
  function planRows(sel, basis) {
    if (basis === "CLOs") {
      const look = Object.fromEntries(mine("clo_plan", sel).map((p) => [String(p.clo_id), p.assessment_methods]));
      return T.closOf(sel).map((c) => ({ id: String(c.clo_id), statement: T.s(c.clo_text), domain: T.s(c.domain), methods: split(look[String(c.clo_id)]) }));
    }
    return mine("slos", sel).map((r) => ({ id: String(r.slo_id), statement: T.s(r.slo_text), domain: T.s(r.domain), lecture: T.s(r.topic), week: T.s(r.week), clo: T.s(r.clo_id), methods: split(r.assessment_methods) }));
  }
  const ticked = (r, m) => r.methods.some((x) => x.toUpperCase() === m.toUpperCase());
  /** Write one outcome's ticks back: the methods in TAMA's order, plus any saved name that is not a column (kept, never lost). */
  function saveTicks(sel, basis, id, on) {
    const ms = methods(sel), cols = ms.map((m) => m.toUpperCase());
    const text = (old) => [...ms.filter((m) => on.has(m.toUpperCase())), ...split(old).filter((x) => !cols.includes(x.toUpperCase()))].join(", ");   // other saved names are kept
    if (basis === "CLOs") {
      const cp = tbl("clo_plan");
      let row = cp.find((p) => String(p.course_code) === String(sel) && String(p.clo_id) === id);
      if (!row) { row = { course_code: sel, clo_id: id, assessment_methods: "" }; cp.push(row); }
      row.assessment_methods = text(row.assessment_methods);
    } else {
      const r = tbl("slos").find((x) => String(x.course_code) === String(sel) && String(x.slo_id) === id);
      if (r) r.assessment_methods = text(r.assessment_methods);
    }
    S.save();
  }

  /** Lay out the plan table: the learning outcome always keeps a readable width (at least 320px, words never split);
      up to 10 assessments sit next to it when the window has room, otherwise 10 are in view and the table drags sideways
      while the outcome columns stay in place. */
  let dragOn = null;
  window.addEventListener("mouseup", () => { if (dragOn) { dragOn.w.classList.remove("dragging"); dragOn = null; } });
  window.addEventListener("resize", () => { clearTimeout(fitPlan.t); fitPlan.t = setTimeout(() => { const el = $("#sec-plan"); if (el && T.page() === "assessment-plan") T.refresh("plan"); }, 200); });
  const COL_W = 40;   // Dania's rule (2026-11-19): up to 10 assessments always fit with NO dragging; more than 10 = 10 in view + drag sideways
  function fitPlan(el, n) {
    const wrap = $("#plan-wrap", el); if (!wrap) return;
    const t = $(".plan-tbl", wrap), cols = $$("col", t), nInfo = cols.length - n;
    if (window.innerWidth <= 760) { t.style.width = ""; wrap.classList.remove("scroll"); return; }   // phones: one card per outcome
    const W = wrap.clientWidth;
    const fixed = cols.slice(0, nInfo).map((c) => (c.dataset.k === "statement" ? null : parseFloat(c.style.width) || 0));
    const fixedSum = fixed.reduce((a, w) => a + (w || 0), 0);
    const drag = n > 10;
    const stmt = Math.max(140, W - 2 - fixedSum - Math.min(n, 10) * COL_W);   // the learning outcome takes all the room the 10 (or fewer) assessments leave
    const total = fixedSum + stmt + n * COL_W;
    cols.slice(0, nInfo).forEach((c, k) => { c.style.width = `${fixed[k] === null ? stmt : fixed[k]}px`; });
    cols.slice(nInfo).forEach((c) => { c.style.width = `${COL_W}px`; });
    t.style.width = drag ? `${total}px` : "100%";
    wrap.classList.toggle("scroll", drag);
    const hint = $("#plan-hint", el); if (hint) hint.hidden = !drag;
    $$(".stick", t).forEach((x) => { x.classList.remove("stick", "stick-last"); x.style.left = ""; });
    if (!drag) return;
    // the outcome columns (left) stay fixed while the assessments scroll
    let left = 0;
    cols.slice(0, nInfo).forEach((c, k) => {
      const cells = $$(`tr > :nth-child(${k + 1})`, t);
      const w = cells.length ? cells[0].getBoundingClientRect().width : 0;
      cells.forEach((x) => { x.classList.add("stick"); x.style.left = `${left}px`; if (k === nInfo - 1) x.classList.add("stick-last"); });
      left += w;
    });
    wrap.onmousedown = (e) => { if (e.target.closest("input,a,select,textarea")) return; dragOn = { w: wrap, x: e.pageX, s: wrap.scrollLeft }; wrap.classList.add("dragging"); };
    wrap.onmousemove = (e) => { if (dragOn && dragOn.w === wrap) { wrap.scrollLeft = dragOn.s - (e.pageX - dragOn.x); e.preventDefault(); } };
  }

  /** The type of an assessment of this course: the Type chosen in the Summative table first, else the saved / guessed type. */
  function kindOf(sel, m) {
    const r = gradingRows(sel).find((x) => T.s(x.Assessment).toUpperCase() === T.s(m).toUpperCase());
    return r && DR_KINDS[r.Type] ? DR_KINDS[r.Type] : methodKind(m);
  }

  T.sections.plan = function () {
    const sel = T.current(), el = $("#sec-plan"); if (!el) return;
    const basis = basisOf(), rows = planRows(sel, basis), ms = methods(sel);
    const where = basis === "SLOs" ? "Lectures & SLOs" : "Course setup";
    let body;
    if (rows.length && !ms.length) body = `<div class="info-box"><span>Add the assessments in the <b>Summative assessment</b> table above first. Each assessment becomes a column here to tick.</span></div>`;
    else if (!rows.length) body = `<div class="info-box"><span>This course has no ${basis} yet. Add them in ${basis === "SLOs" ? "Lectures & SLOs" : "Course setup"}.</span><a class="btn sm" href="#${basis === "SLOs" ? "lectures-slos" : "course-setup"}">Go to ${where}</a></div>`;
    else {
      const info = basis === "SLOs" ? [["week", "Date / Week", "50px"], ["lecture", "Lecture / module", "100px"], ["id", "ID", "48px"], ["statement", "Learning outcome", ""], ["domain", "Domain", "54px"], ["clo", "Linked CLO", "58px"]]
        : [["id", "ID", "52px"], ["statement", "Learning outcome", ""], ["domain", "Domain", "60px"]];
      // Dania 2026-11-19: names written vertically; up to 10 assessments all fit, more than 10 = 10 in view and drag sideways
      const view = "vertical";
      const mw = view === "vertical" ? 46 : 128;
      body = `<p class="note">The columns are the assessments of the Summative assessment table. Tick every assessment used to assess each outcome. Each tick saves itself. The ID, learning outcome${basis === "SLOs" ? ", domain, lecture and linked CLO" : " and domain"} are changed in the <a href="#${basis === "SLOs" ? "lectures-slos" : "course-setup"}">${where}</a> page.</p>
        <p class="note scroll-hint" id="plan-hint" hidden>The table has ${ms.length} assessments: drag it sideways (or use the scroll bar under it) to see them all. The outcome columns stay in place.</p>
        <div class="plan-wrap ${view}" id="plan-wrap"><table class="tbl plan-tbl ${view}"><colgroup><col style="width:26px">${info.map(([k, , w]) => `<col data-k="${k}"${w ? ` style="width:${w}"` : ""}>`).join("")}${ms.map(() => `<col style="width:40px">`).join("")}</colgroup>
        <thead><tr><th>#</th>${info.map(([, l]) => `<th class="words">${l}</th>`).join("")}${ms.map((m) => `<th class="mth" title="${esc(m)} (${esc(kindOf(sel, m))})"><span>${esc(m).replace(/\//g, "/<wbr>")}</span></th>`).join("")}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-i="${i}"><td class="ro muted">${i + 1}</td>${info.map(([k]) => `<td class="ro ${k === "statement" || k === "lecture" || k === "week" ? "wrap words" : ""} ${k === "id" ? "b" : ""} ${k === "clo" && !r.clo ? "no-clo-text" : ""}" data-l="${k === "statement" ? "" : esc(info.find((x) => x[0] === k)[1])}">${esc(k === "clo" && !r.clo ? "(None)" : r[k])}</td>`).join("")}
          ${ms.map((m) => `<td class="ctr tk" data-l="${esc(m)}"><input type="checkbox" class="ptick" data-pi="${i}" data-pm="${esc(m)}" data-ref="p:${i}:${esc(m)}" ${ticked(r, m) ? "checked" : ""} aria-label="${esc(r.id)} assessed by ${esc(m)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    const ex = extras(sel), cms = colMethods(sel);
    const have = new Set(cms.map((m) => m.toUpperCase()));
    const other = Object.values(extrasAll()).flat();
    const pick = [...new Set(S.fieldOptions("assessment_method", [...PERF.map(([m]) => m), ...other]))].filter((m) => !have.has(m.toUpperCase()));
    const openNow = !!S.ui.planColsOpen;
    el.innerHTML = `<div class="sec-head" id="h-plan"><div><h2>Plan to measure learning outcomes</h2><p class="sub">Which assessment methods measure each outcome, as in the course plan of the Excel sheet. You can build the plan on CLOs or on SLOs.</p></div></div>
      <div class="fld"><span class="lbl">Map the assessment methods to</span>
        <div class="seg">${["CLOs", "SLOs"].map((b) => `<button class="${basis === b ? "on" : ""}" data-basis="${b}">${b}</button>`).join("")}</div></div>
      ${body}
      ${SHOW_COL_TOOLS ? `<details class="add-clos" id="plan-cols" ${openNow ? "open" : ""}><summary><span class="plus">＋</span> Add, rename or delete assessment columns <span class="muted">· MCQ, Short Essay and Long Essay stay fixed</span></summary>
        <div class="grid g3 cols-grid">
          <div class="col-box"><h4>Add a column</h4>
            ${T.field({ id: "pc-new", label: "Name of the new assessment", placeholder: "Choose from the list, or type a new name", options: pick })}
            <p class="note">The column is added as soon as you choose or type a name (no button needed).</p></div>
          <div class="col-box"><h4>Rename a column</h4>
            ${ex.length ? `${T.select({ id: "pc-ren", label: "Column", placeholder: "Choose a column", value: "", options: ex })}
              ${T.field({ id: "pc-ren-to", label: "New name" })}<div class="row-btns"><button class="btn sm" id="pc-ren-go">Rename</button></div>` : `<p class="note">Add a column first.</p>`}</div>
          <div class="col-box"><h4>Delete a column</h4>
            ${ex.length ? `${T.select({ id: "pc-del", label: "Column", placeholder: "Choose a column", value: "", options: ex })}
              <label class="tick" id="pc-del-ok-l" hidden><input type="checkbox" id="pc-del-ok"> <span id="pc-del-ok-t"></span></label>
              <div class="row-btns"><button class="btn sm" id="pc-del-go">Delete column</button></div>` : `<p class="note">Nothing to delete. MCQ, Short Essay and Long Essay cannot be deleted.</p>`}</div>
        </div></details>` : ""}`;

    fitPlan(el, ms.length);
    $$("[data-basis]", el).forEach((b) => b.onclick = () => { S.ui.planBasis = b.dataset.basis; S.saveUi(); T.refresh("plan", "planSum"); });
    $$(".ptick", el).forEach((cb) => cb.onchange = () => {
      const r = rows[+cb.dataset.pi];
      const on = new Set(ms.filter((m) => ticked(r, m)).map((m) => m.toUpperCase()));
      if (cb.checked) on.add(cb.dataset.pm.toUpperCase()); else on.delete(cb.dataset.pm.toUpperCase());
      saveTicks(sel, basis, r.id, on);
      T.refresh("plan", "planSum");
    });
    if (!SHOW_COL_TOOLS) return;
    $("#plan-cols", el).addEventListener("toggle", (e) => { S.ui.planColsOpen = e.target.open; S.saveUi(); });
    const nameErr = (nm, old) => {
      if (!nm) return "Type a name first.";
      if (nm.includes(",")) return "The name cannot contain a comma.";
      if (cms.some((x) => x !== old && x.toUpperCase() === nm.toUpperCase())) return `There is already a column called ${nm}.`;
      return "";
    };
    const nf = $("#pc-new", el);
    const dl = nf.list; if (dl) dl.innerHTML = pick.map((m) => `<option value="${esc(m)}" label="${esc(PERF_AR[m] ? `${m} – ${PERF_AR[m]}` : m)}"></option>`).join("");   // English and Arabic names in the list
    nf.addEventListener("change", () => {
      let nm = T.cap1(val(nf.value), "Name of the new assessment"); if (!nm) return;
      nm = pick.find((x) => x.toUpperCase() === nm.toUpperCase()) || nm;   // "osce" typed = the listed OSCE
      const err = nameErr(nm); if (err) { T.toast(err, "warn"); return; }
      ex.push(nm); S.data.field_memory.assessment_method = [nm, ...(S.data.field_memory.assessment_method || []).filter((x) => x.toLowerCase() !== nm.toLowerCase())].slice(0, 30);
      S.save(); T.toast(`Column '${nm}' added.`); T.refresh("plan", "planSum");
    });
    const rg = $("#pc-ren-go", el);
    if (rg) rg.onclick = () => {
      const old = $("#pc-ren", el).value, nm = T.cap1(val($("#pc-ren-to", el).value), "New name");
      if (!old) { T.toast("Choose the column to rename.", "warn"); return; }
      const err = nameErr(nm, old); if (err) { T.toast(err, "warn"); return; }
      ex[ex.indexOf(old)] = nm;
      methodLists(sel, (l) => l.map((x) => (x.toUpperCase() === old.toUpperCase() ? nm : x)));
      S.data.field_memory.assessment_method = [nm, ...(S.data.field_memory.assessment_method || [])].slice(0, 30);
      S.save(); T.toast(`'${old}' renamed to '${nm}'. Its ticks were kept.`); T.refresh("plan", "planSum");
    };
    const ds = $("#pc-del", el);
    if (ds) {
      ds.onchange = () => {
        const m = ds.value, used = methodLists(sel).filter((x) => x.toUpperCase() === m.toUpperCase()).length;
        $("#pc-del-ok-l", el).hidden = !m; $("#pc-del-ok-t", el).textContent = `Yes, delete '${m}'` + (used ? ` and its ${used} tick(s)` : "");
      };
      $("#pc-del-go", el).onclick = () => {
        const m = ds.value;
        if (!m) { T.toast("Choose the column to delete.", "warn"); return; }
        if (!$("#pc-del-ok", el).checked) { T.toast(`Nothing was deleted. Tick “Yes, delete '${m}'” first.`, "warn"); return; }
        ex.splice(ex.indexOf(m), 1);
        methodLists(sel, (l) => l.filter((x) => x.toUpperCase() !== m.toUpperCase()));
        S.save(); T.toast(`Column '${m}' deleted.`); T.refresh("plan", "planSum");
      };
    }
  };

  /* ---------------------------------------------------------------- summaries under the plan */
  const smallTable = (cols, rows, cls) => `<table class="tbl sum-tbl ${cls || ""}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="wrap" data-l="${esc(c)}">${esc(r[c] === undefined ? "" : r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  T.sections.planSum = function () {
    const sel = T.current(), el = $("#sec-plsum"); if (!el) return;
    const basis = basisOf(), rows = planRows(sel, basis), ms = methods(sel), nOut = rows.length;
    if (!nOut) { el.innerHTML = `<div class="sec-head" id="h-plsum"><div><h2>Summaries</h2><p class="sub">They appear once the course has ${basis}.</p></div></div>`; return; }
    const cov = (list) => rows.filter((r) => list.some((m) => ticked(r, m))).length;
    const ticks = (list) => rows.reduce((s, r) => s + list.filter((m) => ticked(r, m)).length, 0);
    const kindRows = KINDS.map((k) => { const l = ms.filter((m) => kindOf(sel, m) === k); const c = cov(l);
      return { "Type of assessment": k, Methods: l.join(", ") || "-", "Number of methods": l.length, [`${basis} assessed`]: c, [`% of ${basis}`]: `${nOut ? Math.round(c / nOut * 100) : 0}%`, "Total ticks": ticks(l) }; });
    const all = cov(ms);
    kindRows.push({ "Type of assessment": "All types", Methods: "", "Number of methods": ms.length, [`${basis} assessed`]: all, [`% of ${basis}`]: `${Math.round(all / nOut * 100)}%`, "Total ticks": ticks(ms) });
    const none = rows.filter((r) => !ms.some((m) => ticked(r, m))).map((r) => r.id);

    // questions linked to the outcomes (from the Exam blueprint's question mapping)
    const qs = mine("questions", sel), link = basis === "CLOs" ? "clos" : "slos";
    let qHtml;
    if (!qs.length) qHtml = `<div class="info-box"><span>No questions have been added yet. Add them in Exam blueprint, tab 'Question mapping', and the summaries will appear here.</span></div>`;
    else {
      const cnt = {}, mk = {};
      qs.forEach((q) => split(q[link]).forEach((i) => { cnt[i] = (cnt[i] || 0) + 1; mk[i] = (mk[i] || 0) + (numOf(q.max_marks) || 0); }));
      const tq = rows.reduce((s, r) => s + (cnt[r.id] || 0), 0);
      const per = rows.map((r) => ({ ...(basis === "SLOs" ? { "Lecture / module": r.lecture } : {}), ID: r.id, Domain: r.domain, ...(basis === "SLOs" ? { "Linked CLO": r.clo } : {}),
        Questions: cnt[r.id] || 0, Marks: fmt(mk[r.id] || 0), "Share of questions (%)": tq ? fmt((cnt[r.id] || 0) / tq * 100) : "0" }));
      const doms = {}; rows.forEach((r) => { const d = (doms[r.domain] = doms[r.domain] || { Domain: r.domain, Outcomes: 0, Questions: 0, Marks: 0 }); d.Outcomes++; d.Questions += cnt[r.id] || 0; d.Marks += mk[r.id] || 0; });
      const domRows = Object.values(doms).map((d) => ({ ...d, Marks: fmt(d.Marks), "Share of questions (%)": tq ? fmt(d.Questions / tq * 100) : "0" }));
      qHtml = `${basis === "SLOs" && !qs.some((q) => split(q.slos).length) ? `<p class="note">None of the questions is mapped to SLOs yet. In Question mapping choose 'SLOs' for the questions you want to see here.</p>` : ""}
        <details class="sum-box"><summary>Summary of questions linked to each ${basis.slice(0, -1)}</summary>${smallTable(Object.keys(per[0]), per)}</details>
        <details class="sum-box"><summary>Summary of questions linked to the ${basis.slice(0, -1)} domains</summary>${smallTable(Object.keys(domRows[0] || { Domain: "" }), domRows)}</details>
        <p class="note">Click a title to open its table. A question mapped to more than one outcome is counted under each of them.</p>`;
    }
    // SLOs grouped by CLO, and CLOs x assessment types
    const clos = T.closOf(sel), slos = mine("slos", sel);
    const sloTypes = Object.fromEntries(planRows(sel, "SLOs").map((r) => [r.id, ms.filter((m) => ticked(r, m))]));
    const typesOf = (ids) => ms.map((m) => [m, ids.filter((i) => (sloTypes[i] || []).includes(m)).length]).filter(([, n]) => n).map(([m, n]) => `${m} (${n})`).join(", ") || "-";
    let sloClo = "";
    if (basis === "SLOs") {
      const rowsC = clos.map((c) => { const my = slos.filter((s) => String(s.clo_id) === String(c.clo_id)); const dc = {}; my.forEach((s) => { dc[s.domain] = (dc[s.domain] || 0) + 1; });
        return { CLO: c.clo_id, "CLO domain": c.domain, "Number of SLOs": my.length, SLOs: my.map((s) => s.slo_id).join(", "), "Lectures / modules": [...new Set(my.map((s) => T.s(s.topic)))].sort().join(", "),
          "SLO domains": Object.entries(dc).map(([d, n]) => `${d} (${n})`).join(", "), "Assessment types (SLOs)": typesOf(my.map((s) => String(s.slo_id))) }; });
      const ids = clos.map((c) => String(c.clo_id)), unl = slos.filter((s) => !ids.includes(String(s.clo_id)));
      if (unl.length) rowsC.push({ CLO: "(not linked)", "CLO domain": "", "Number of SLOs": unl.length, SLOs: unl.map((s) => s.slo_id).join(", "), "Lectures / modules": [...new Set(unl.map((s) => T.s(s.topic)))].sort().join(", "), "SLO domains": "", "Assessment types (SLOs)": typesOf(unl.map((s) => String(s.slo_id))) });
      sloClo = `<details class="sum-box"><summary>Summary of SLOs linked to CLOs</summary>${smallTable(Object.keys(rowsC[0] || { CLO: "" }), rowsC)}</details>`;
    }
    let cloTypes = "";
    if (clos.length) {
      const cloTick = Object.fromEntries(planRows(sel, "CLOs").map((r) => [r.id, r]));
      const cellOf = (cid, m) => {
        if (basis === "CLOs") return cloTick[cid] && ticked(cloTick[cid], m) ? "✓" : "";
        const my = slos.filter((s) => String(s.clo_id) === cid).map((s) => String(s.slo_id)), n = my.filter((i) => (sloTypes[i] || []).includes(m)).length;
        return n ? `${n} of ${my.length}` : "";
      };
      const rr = clos.map((c) => ({ CLO: c.clo_id, Domain: c.domain, "CLO statement": c.clo_text, ...Object.fromEntries(ms.map((m) => [m, cellOf(String(c.clo_id), m)])) }));
      cloTypes = `<details class="sum-box"><summary>Summary of CLOs and assessment types</summary><p class="note">${basis === "CLOs" ? "✓ = the CLO is assessed by this type in the plan above." : "Each cell shows how many of the CLO's SLOs are assessed by that type (e.g. 2 of 3)."} An empty row means the CLO is not assessed yet.</p>${smallTable(["CLO", "Domain", "CLO statement", ...ms], rr, "clo-types")}</details>`;
    }

    el.innerHTML = `<div class="sec-head" id="h-plsum"><div><h2>Summaries of the plan</h2><p class="sub">They follow the ticks above at once.</p></div>
        <button class="btn sm" id="plan-csv">Download plan (CSV)</button></div>
      ${none.length ? `<p class="warn-text">Not yet assessed by any method: ${esc(none.join(", "))}</p>` : `<div class="ok-box">Every learning outcome in this plan is assessed by at least one method.</div>`}
      <h4>How many outcomes each method assesses</h4>
      <div class="grid g2 sum-grid">
        <div><table class="tbl sum-tbl kind-tbl"><colgroup><col style="width:46%"><col><col style="width:22%"></colgroup><thead><tr><th>Type of assessment</th><th>Method</th><th>${basis} assessed</th></tr></thead>
          <tbody>${ms.map((m, i) => `<tr><td data-l="Type of assessment"><select class="cell filled" data-km="${i}" data-ref="k:${i}">${KINDS.map((k) => `<option ${k === kindOf(sel, m) ? "selected" : ""}>${k}</option>`).join("")}</select></td><td data-l="Method" class="wrap">${esc(m)}</td><td data-l="${basis} assessed" class="num">${cov([m])}</td></tr>`).join("")}</tbody></table>
          <p class="note">The type of each method is filled in from its name: MCQ and essays are test-based; presentations, simulation, portfolio, OSPE, OSCE, Mini-CEX, DOPS, case-based and workplace assessments are performance-based; surveys and feedback are indirect; anything else is 'Others'. If a type is wrong, choose another one. It saves itself.</p></div>
        <div>${smallTable(Object.keys(kindRows[0]), kindRows, "type-tbl")}
          <p class="note">${basis} assessed = how many of the ${nOut} ${basis} are assessed by at least one method of that type.</p></div>
      </div>
      <h4>Questions linked to the ${basis}</h4>
      ${qHtml}${sloClo}${cloTypes}`;

    $$("[data-km]", el).forEach((s) => s.onchange = () => {
      const m = ms[+s.dataset.km]; setKind(m, s.value);
      const g = crStore(sel).grading;   // the Type in the Summative table follows (Test-based / Performance-based, else empty)
      if (Array.isArray(g)) g.forEach((r) => { if (T.s(r.Assessment).toUpperCase() === m.toUpperCase()) r.Type = Object.keys(DR_KINDS).find((x) => DR_KINDS[x] === s.value) || ""; });
      S.save(); T.toast(`${ms[+s.dataset.km]} is now counted as ${s.value.toLowerCase()}.`); T.refresh("plan", "planSum", "summative"); });
    $("#plan-csv", el).onclick = () => {
      const info = basis === "SLOs" ? [["lecture", "lecture"], ["id", "outcome_id"], ["statement", "statement"], ["domain", "domain"], ["clo", "linked_clo"]] : [["id", "outcome_id"], ["statement", "statement"], ["domain", "domain"]];
      const q = (v) => `"${T.s(v).replace(/"/g, '""')}"`;
      const lines = [[...info.map(([, h]) => h), ...ms].map(q).join(","), ...rows.map((r) => [...info.map(([k]) => r[k]), ...ms.map((m) => (ticked(r, m) ? "Y" : "N"))].map(q).join(","))];
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `assessment_plan_${T.baseCode(sel).replace(/\s+/g, "_")}_${basis}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
  };

  /* ---------------------------------------------------------------- the page */
  T.renderPlanPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "The Assessment plan fills in as soon as you have saved at least one course in Course setup."}</p>
        <div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = `<section class="card" id="sec-summ"></section><section class="card" id="sec-form"></section><section class="card" id="sec-plan"></section><section class="card" id="sec-plsum"></section>`;
    T.refresh("summative", "formative", "plan", "planSum");
  };
  T.plan = { methods, methodKind, crStore };
})();
