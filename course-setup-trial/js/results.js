/* Exam results page (TAMA's "Item analysis" page; menu name "Exam results").
   Part 1: item analysis of the MCQ questions of one test, as in TAMA (app.py _ia_guided / _render_ia_body):
   report format (Condensed Test Report PDF, Question Mark PDF, or values typed by hand), test analysis, general notes,
   flagged items with suggestions, link of each question to an SLO (from the Exam builder, or by hand), results by SLO
   (Achieved KPI = mean difficulty x 100 against the SLO's Target KPI), all saved exams, Excel download.
   Saved exactly where TAMA keeps it: tables.ia_tests, tables.ia_results, tables.ia_map, ia_source, ui_settings.ia_kinds.
   Extra columns kept on ia_results for the question bank: key, question_text, distractors (JSON of the % choosing each option),
   upper27, lower27. TAMA keeps unknown columns as they are. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const obj = (k) => (S.data[k] && typeof S.data[k] === "object" && !Array.isArray(S.data[k]) ? S.data[k] : (S.data[k] = {}));
  const num = (v) => { if (v === null || v === undefined || v === "" || typeof v === "boolean") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").replace("%", "").trim()); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const f2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : (Math.round(n * 100) / 100).toFixed(2));
  const r1 = (n) => Math.round(n * 10) / 10;
  const natKey = (s) => T.s(s).split(/(\d+)/).map((p, i) => (i % 2 ? p.padStart(8, "0") : p.toLowerCase())).join("");
  const natSort = (a, f = (x) => x) => a.sort((x, y) => (natKey(f(x)) < natKey(f(y)) ? -1 : natKey(f(x)) > natKey(f(y)) ? 1 : 0));
  const sameC = (r, sel) => String(r.course_code) === String(sel);
  const mine = (t, sel, exam) => tbl(t).filter((r) => sameC(r, sel) && (exam === undefined || T.s(r.assessment).trim() === exam));
  const EK = (sel, exam) => `${sel}||${exam}`;
  const split = (v) => T.s(v).split(/[,;/\n]+/).map((x) => x.trim()).filter(Boolean);
  const qNo = (x) => { const m = T.s(x).match(/\d+/); return m ? String(parseInt(m[0], 10)) : T.s(x).trim().toUpperCase(); };   // TAMA's _qn

  /* ---------------------------------------------------------------- TAMA's thresholds and rules (app.py, unchanged) */
  const FMT_QM = "Question Mark", FMT_CTR = "Condensed Test Report", FMT_MAN = "Enter values manually";
  const FORMATS = [[FMT_CTR, "Condensed Test Report (PDF)", "From the correcting machine"], [FMT_QM, "Question Mark (PDF)", "Online exam"], [FMT_MAN, "Type the values", "Or paste them from Excel"]];
  const EASY_ABOVE = 0.8, DIFFICULT_BELOW = 0.3, LOW_DISC = 0.2, GOOD_DISC = 0.3, VERY_EASY = 0.9;
  const ONE01 = new Set(["MCQ", "TRUE/FALSE", "T/F", "TF", "MATCHING", "SBA", "EMQ", "", "NAN", "NONE"]);
  const K_MCQ = "MCQ (correct or not correct: 0/1 marks)", K_PART = "Questions with partial marks (essay, short answer, OSCE ...)";
  const levelOf = (p) => (p === null ? "—" : p < DIFFICULT_BELOW ? "Difficult" : p > EASY_ABOVE ? "Easy" : "Acceptable");
  function flagsOf(it) {
    const f = [];
    if (it.p !== null && it.p < DIFFICULT_BELOW) f.push("Difficulty < 0.30");
    if (it.d !== null) { if (it.d < 0) f.push("Negative discrimination"); else if (it.d < LOW_DISC) f.push("Discrimination < 0.20"); }
    if (it.dk) f.push("Distractor chosen more than key");
    return f;
  }
  function suggestOf(it, f) {
    if (!f.length) return "";
    if (f.includes("Distractor chosen more than key") || f.includes("Negative discrimination")) return "Review key";
    if (f.length === 1 && f[0] === "Discrimination < 0.20" && it.p !== null && it.p >= VERY_EASY) return "Keep";
    if (f.length === 1 && f[0] === "Difficulty < 0.30" && it.d !== null && it.d >= GOOD_DISC) return "Keep";
    return "Revise";
  }
  const REASONS = {
    "Review key": "Check the answer key and wording; consider removing the item from scoring if the key is wrong.",
    Revise: "Rewrite the stem or distractors before re-use.",
    Keep: "Acceptable as is (very easy core item, or hard item that still discriminates well).",
  };
  function analyse(items) {
    items.forEach((it) => { it.level = levelOf(it.p); it.flags = flagsOf(it); it.auto = suggestOf(it, it.flags); it.sug = it.sugSet ? it.sugSet : it.auto; });
    return items;
  }

  /* ---------------------------------------------------------------- the course's tests */
  function examsOf(sel) {
    const out = [];
    const add = (a) => { a = T.s(a).trim(); if (a && !out.some((x) => x.toUpperCase() === a.toUpperCase())) out.push(a); };
    (T.plan ? T.plan.methods(sel) : []).forEach(add);
    ["exams", "plans", "questions", "ia_tests", "course_assessments"].forEach((t) => tbl(t).filter((r) => sameC(r, sel)).forEach((r) => add(r.assessment)));
    return out;
  }
  const examOf = (sel) => { const e = T.s((S.ui.irExam || {})[sel]).trim(); return examsOf(sel).includes(e) ? e : ""; };
  const setExam = (sel, v) => { S.ui.irExam = S.ui.irExam || {}; S.ui.irExam[sel] = v; S.saveUi(); };
  function kindsOf(sel, exam) {
    const all = obj("ui_settings").ia_kinds = obj("ui_settings").ia_kinds || {}, k = EK(sel, exam);
    if (!Array.isArray(all[k])) {
      const t = new Set(mine("questions", sel, exam).map((q) => T.s(q.question_type).toUpperCase().replace(/ /g, "")));
      const has01 = !t.size || [...t].some((x) => ONE01.has(x)), part = [...t].some((x) => !ONE01.has(x));
      all[k] = [...(has01 ? ["mcq"] : []), ...(part ? ["partial"] : [])];
      S.save();
    }
    return all[k];
  }

  /* ---------------------------------------------------------------- SLO / CLO links (TAMA's ia_outcomes and the Linked SLO column) */
  function basisOf(sel, exam) {
    const pl = mine("plans", sel, exam).filter((r) => (num(r.mcq_weight) || 0) > 0);
    const bases = [...new Set(pl.map((r) => T.s(r.basis)))];
    const basis = bases.includes("SLOs") || !bases.length ? "SLOs" : bases[0];
    const ids = []; pl.filter((r) => T.s(r.basis) === basis).forEach((r) => { const o = T.s(r.outcome_id); if (!ids.includes(o)) ids.push(o); });
    return { basis, unit: basis.slice(0, -1), weighted: natSort(ids) };
  }
  function offered(sel, unit) {
    const rows = unit === "CLO" ? tbl("clos").filter((r) => sameC(r, sel)).map((r) => [T.s(r.clo_id).trim(), T.s(r.clo_text), num(r.target_pct)])
      : tbl("slos").filter((r) => sameC(r, sel)).map((r) => [T.s(r.slo_id).trim(), T.s(r.slo_text), num(r.target_kpi)]);
    const out = {}; natSort(rows.filter((r) => r[0]), (r) => r[0]).forEach(([id, t, tg]) => { out[id] = { text: t, target: tg === null ? 70 : tg }; });
    return out;
  }
  function targets(sel) {
    const t = {};
    tbl("clos").filter((r) => sameC(r, sel)).forEach((r) => { t[T.s(r.clo_id)] = num(r.target_pct) === null ? 70 : num(r.target_pct); });
    tbl("slos").filter((r) => sameC(r, sel)).forEach((r) => { t[T.s(r.slo_id)] = num(r.target_kpi) === null ? 70 : num(r.target_kpi); });
    return t;
  }
  function sourceOf(sel, exam) {
    const all = obj("ia_source"), k = EK(sel, exam);
    if (all[k] === "here" || all[k] === "outside") return all[k];
    const hand = mine("ia_results", sel, exam).filter((r) => T.s(r.outcome_id).trim()).length;
    return mine("questions", sel, exam).length && !hand ? "here" : "outside";
  }
  /** Links taken from the Exam builder (question number -> first SLO/CLO it is mapped to). */
  function builderLinks(sel, exam, unit, ids) {
    const canon = {}; Object.keys(ids).forEach((k) => { canon[k.toUpperCase()] = k; });
    const link = {}, multi = [];
    mine("questions", sel, exam).forEach((q) => {
      const got = split(unit === "SLO" ? q.slos : q.clos).map((i) => canon[i.toUpperCase()]).filter(Boolean);
      if (got.length) { link[qNo(q.question_id)] = got[0]; if (got.length > 1) multi.push(`${T.s(q.question_id)} (${got.join(", ")})`); }
    });
    return { link, multi };
  }
  function handLinks(sel, exam) {
    const out = {};
    mine("ia_results", sel, exam).forEach((r) => { if (T.s(r.outcome_id).trim()) out[T.s(r.question)] = T.s(r.outcome_id).trim(); });
    mine("ia_map", sel, exam).forEach((r) => { if (T.s(r.outcome_id).trim()) out[T.s(r.question)] = T.s(r.outcome_id).trim(); });
    return out;
  }

  /* ---------------------------------------------------------------- saved item analysis <-> items */
  const testRow = (sel, exam) => { const r = mine("ia_tests", sel, exam); return r.length ? r[r.length - 1] : null; };
  function savedItems(sel, exam) {
    const items = mine("ia_results", sel, exam).map((r) => {
      let opts = null; try { opts = r.distractors ? (typeof r.distractors === "string" ? JSON.parse(r.distractors) : r.distractors) : null; } catch (e) { opts = null; }
      return { Q: T.s(r.question), key: T.s(r.key), text: T.s(r.question_text), p: num(r.difficulty), d: num(r.discrimination),
        dk: T.s(r.distractor_over_key) === "Yes", opts, up: num(r.upper27), low: num(r.lower27), sugSet: T.s(r.suggestion), link: T.s(r.outcome_id).trim() };
    });
    return natSort(items, (x) => x.Q);
  }
  function save(sel, exam, items, meta) {
    analyse(items);
    const src = sourceOf(sel, exam);
    const { unit } = basisOf(sel, exam), ids = offered(sel, unit);
    const bl = src === "here" ? builderLinks(sel, exam, unit, ids).link : null;
    const rows = items.filter((it) => it.p !== null || it.d !== null || it.key || it.dk || (src === "outside" && it.link)).map((it) => {
      const lk = bl ? bl[qNo(it.Q)] || "" : (it.link && ids[it.link] ? it.link : "");
      const row = { course_code: sel, assessment: exam, question: it.Q, outcome_id: lk || null, difficulty: it.p, discrimination: it.d,
        difficulty_level: levelOf(it.p), suggestion: it.sug || "", distractor_over_key: it.dk ? "Yes" : "" };
      if (it.key) row.key = it.key;
      if (it.text) row.question_text = it.text;
      if (it.opts && Object.keys(it.opts).length) row.distractors = JSON.stringify(it.opts);
      if (it.up !== null && it.up !== undefined) row.upper27 = it.up;
      if (it.low !== null && it.low !== undefined) row.lower27 = it.low;
      return row;
    });
    S.setT("ia_results", tbl("ia_results").filter((r) => !(sameC(r, sel) && T.s(r.assessment).trim() === exam)).concat(rows));
    if (src === "outside") {
      const mp = rows.filter((r) => r.outcome_id).map((r) => ({ course_code: sel, assessment: exam, question: r.question, outcome_id: r.outcome_id }));
      S.setT("ia_map", tbl("ia_map").filter((r) => !(sameC(r, sel) && T.s(r.assessment).trim() === exam)).concat(mp));
    }
    const old = testRow(sel, exam) || {}, now = new Date(), p2 = (x) => String(x).padStart(2, "0");
    const t = Object.assign({}, old, { course_code: sel, assessment: exam, report: T.s(old.report) || "Entered manually", format: T.s(old.format) || FMT_MAN }, meta || {},
      { saved_at: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}` });
    S.setT("ia_tests", tbl("ia_tests").filter((r) => !(sameC(r, sel) && T.s(r.assessment).trim() === exam)).concat(rows.length || meta ? [t] : []));
    S.save();
  }

  /* ---------------------------------------------------------------- reading the PDF reports */
  async function pdfLines(file) {
    await T.importer.lib("pdf"); if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const tc = await (await pdf.getPage(i)).getTextContent(), rows = [];
      tc.items.forEach((it) => {
        if (!T.s(it.str).trim()) return;
        const x = it.transform[4], y = it.transform[5];
        let r = rows.find((q) => Math.abs(q.y - y) < 2.5); if (!r) { r = { y, its: [] }; rows.push(r); }
        r.its.push({ x, s: it.str });
      });
      rows.sort((a, b) => b.y - a.y).forEach((r) => out.push(r.its.sort((a, b) => a.x - b.x).map((q) => q.s).join(" ").replace(/\s+/g, " ").trim()));
    }
    return out;
  }
  /** TAMA's parse_condensed: the same regular expressions on the report text. */
  function parseCondensed(lines) {
    const text = lines.join("\n");
    if (!text.includes("Condensed Test Report") && !text.includes("Point")) throw new Error("This file does not look like a Condensed Test Report.");
    const grab = (re) => { const m = text.match(re); return m ? parseFloat(m[1]) : null; };
    const summary = { students: grab(/Total Students:\s*([\d.]+)/), total_points: grab(/Total Possible Points:\s*([\d.]+)/), mean: grab(/Mean Score:\s*([\d.]+)/),
      median: grab(/Median Score:\s*([\d.]+)/), sd: grab(/Standard Deviation:\s*([\d.]+)/), max: grab(/Maximum Score:\s*([\d.]+)/), min: grab(/Minimum Score:\s*([\d.]+)/),
      kr20: grab(/\(KR20\):\s*([\d.]+)/), unit: "points" };
    const re = /^\s*(\d+)\s+(\S+)\s+([A-E])\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*([A-E]*)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(-?[\d.]+|-)\s*$/gm;
    const seen = new Set(), items = []; let m;
    while ((m = re.exec(text))) {
      const Q = String(parseInt(m[1], 10)); if (seen.has(Q)) continue; seen.add(Q);
      const opts = {}; "ABCDE".split("").forEach((c, i) => { opts[c] = parseFloat(m[4 + i]); });
      const key = m[3];
      items.push({ Q, key, opts, p: Math.round(parseFloat(m[10]) / 100 * 1000) / 1000, up: parseFloat(m[11]), low: parseFloat(m[12]),
        d: m[13] === "-" ? null : parseFloat(m[13]), dk: Object.keys(opts).some((c) => c !== key && opts[c] > opts[key]), text: "", sugSet: "", link: "" });
    }
    if (!items.length) throw new Error("No question rows were found. Is this a Condensed Test Report?");
    if (items.every((it) => !it.opts.E)) items.forEach((it) => { delete it.opts.E; });
    return { summary, items: natSort(items, (x) => x.Q), disc: "Point biserial" };
  }

  /* ---------------------------------------------------------------- the page */
  const fmtOf = (sel, exam) => { const t = testRow(sel, exam), u = (S.ui.irFmt || {})[EK(sel, exam)]; return u || (t && FORMATS.some((f) => f[0] === T.s(t.format)) ? T.s(t.format) : FMT_CTR); };
  const setFmt = (sel, exam, v) => { S.ui.irFmt = S.ui.irFmt || {}; S.ui.irFmt[EK(sel, exam)] = v; S.saveUi(); };
  const LEVEL_CLASS = { Difficult: "lv-d", Acceptable: "lv-a", Easy: "lv-e" };
  function kpiClass(a, t) { if (a === null || t === null) return ""; a = r1(a); t = r1(t); return a < t ? "kpi-below" : a === t ? "kpi-on" : "kpi-above"; }

  T.sections.irTest = function () {
    const sel = T.current(), el = $("#sec-irtest"); if (!el) return;
    const ex = examsOf(sel), exam = examOf(sel), kinds = exam ? kindsOf(sel, exam) : [];
    el.innerHTML = `<div class="sec-head" id="h-irtest"><div><h2>Choose the test</h2><p class="sub">Choose the test, then the type of its questions. The steps for that type follow below. Everything saves itself.</p></div></div>
      <div class="grid g3">
        <label class="fld ${exam ? "filled" : ""}" for="ir-exam"><span class="lbl">Step 1: Test / exam <i class="hint" title="Every assessment of this course: the Summative table of the Assessment plan, the blueprints and the saved item analyses.">?</i></span>
          <select id="ir-exam"><option value="" ${exam ? "" : "selected"}>${ex.length ? "Choose a test" : "Add the assessments in the Assessment plan first"}</option>
          ${ex.map((o) => `<option value="${esc(o)}" ${o === exam ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>
      </div>
      ${ex.length ? "" : `<div class="info-box"><span>This course has no assessments yet. Add them in the <b>Summative assessment</b> table of the Assessment plan.</span><a class="btn sm" href="#assessment-plan">Go to Assessment plan</a></div>`}
      ${exam ? `<div class="fld"><span class="lbl">Step 2: What type of questions does this test have? (tick one or both)</span>
          <div class="row-btns ir-kinds"><label class="tick-line"><input type="checkbox" data-irk="mcq" ${kinds.includes("mcq") ? "checked" : ""}> ${esc(K_MCQ)}</label>
          <label class="tick-line"><input type="checkbox" data-irk="partial" ${kinds.includes("partial") ? "checked" : ""}> ${esc(K_PART)}</label></div></div>
        ${kinds.length ? (kinds.length === 2 ? `<p class="note">This test has both types: fill in both parts below. Both results go to CLO achievement.</p>` : "") : `<p class="warn-text">Tick the type of questions of this test to see the next step.</p>`}` : `<p class="note">Choose the test in <b>Step 1</b>. <b>Step 2</b> then asks the type of its questions: MCQ (the item analysis report), or questions with partial marks such as essay or OSCE (the KPI calculation).</p>`}`;
    $("#ir-exam", el).onchange = (e) => { setExam(sel, e.target.value); T.refresh("irTest", "irMcq", "irPart", "irMarks"); };
    $$("[data-irk]", el).forEach((c) => c.onchange = () => {
      const now = $$("[data-irk]", el).filter((x) => x.checked).map((x) => x.dataset.irk);
      obj("ui_settings").ia_kinds[EK(sel, exam)] = ["mcq", "partial"].filter((x) => now.includes(x)); S.save(); T.refresh("irTest", "irMcq", "irPart", "irMarks");
    });
  };

  /* working copy of the items of one test (typed values are kept here until they are saved) */
  const work = {};
  function itemsOf(sel, exam) {
    const k = EK(sel, exam), fmt = fmtOf(sel, exam);
    if (!work[k]) work[k] = savedItems(sel, exam);
    let items = work[k];
    if (fmt === FMT_MAN) {
      S.ui.irNq = S.ui.irNq || {};
      const nq = Math.max(1, Math.min(500, num(S.ui.irNq[k]) || (items.length ? items.length : 20)));
      const have = new Set(items.map((i) => i.Q)); let n = 1;
      while (items.length < nq) { while (have.has(String(n))) n++; items.push({ Q: String(n), key: "", text: "", p: null, d: null, dk: false, opts: null, up: null, low: null, sugSet: "", link: "" }); have.add(String(n)); }
      if (items.length > nq) items = work[k] = items.slice(0, nq);
    }
    return analyse(items);
  }

  T.sections.irMcq = function () {
    const sel = T.current(), el = $("#sec-irmcq"); if (!el) return;
    const exam = examOf(sel), on = exam && kindsOf(sel, exam).includes("mcq");
    el.hidden = !on;
    const slo = $("#sec-irslo"); if (slo) slo.hidden = !on;
    if (!on) { el.innerHTML = ""; if (slo) slo.innerHTML = ""; return; }
    const k = EK(sel, exam), fmt = fmtOf(sel, exam), t = testRow(sel, exam), src = sourceOf(sel, exam);
    if (obj("ia_source")[k] !== src) { obj("ia_source")[k] = src; S.save(); }   // kept once chosen, as in TAMA
    const bq = mine("questions", sel, exam), items = itemsOf(sel, exam), n = items.length;
    const { basis, unit, weighted } = basisOf(sel, exam), ids = offered(sel, unit);
    const bl = builderLinks(sel, exam, unit, ids);
    const hand = handLinks(sel, exam);
    items.forEach((it) => { it.lk = src === "here" ? bl.link[qNo(it.Q)] || "" : (it.link || hand[it.Q] || ""); if (it.lk && !ids[it.lk]) it.lk = ""; });
    const hasData = items.some((it) => it.p !== null || it.d !== null);
    const sum = t || {};
    const u = T.s(sum.unit) === "%" ? "%" : "";
    const v = (x, un = "") => (num(x) === null ? "n/a" : g2(num(x)) + un);

    // --- format, upload
    const fmtHtml = `<div class="fld"><span class="lbl">Report format</span><div class="seg ir-fmt">${FORMATS.map(([f, l, s]) => `<button class="${fmt === f ? "on" : ""}" data-irf="${esc(f)}" title="${esc(s)}">${esc(l)}</button>`).join("")}</div></div>`;
    let srcBox;
    if (fmt === FMT_MAN) srcBox = `<div class="grid g3"><label class="fld filled" for="ir-nq"><span class="lbl">Number of questions</span><input type="number" id="ir-nq" min="1" max="500" value="${n}"></label></div>
      <p class="note">Type the key, difficulty, discrimination and "Distractor &gt; key" of each question in the table below, or paste them from Excel (Ctrl+V into the first cell). Difficulty can be 0 to 1 or a percentage.</p>`;
    else if (fmt === FMT_QM) srcBox = `<div class="info-box"><span>Reading <b>Question Mark</b> reports is being checked against a real report before it is switched on, so the values are read exactly as in TAMA. Until then, choose <b>Type the values</b>.</span></div>`;
    else srcBox = `<div class="row-btns"><label class="btn ${hasData ? "" : "primary"}"><input type="file" id="ir-pdf" accept="application/pdf,.pdf" hidden>${hasData ? "Upload another report (PDF)" : "Upload the item analysis report (PDF)"}</label>
        ${t && T.s(t.report) && T.s(t.format) !== FMT_MAN ? `<span class="note">Saved: <b>${esc(t.report)}</b>, ${esc(t.saved_at)}</span>` : ""}</div><p class="warn-text" id="ir-pdf-err" hidden></p>`;

    // --- source of the SLO links
    const srcHtml = `<div class="fld"><span class="lbl">Was this test made in this app? <i class="hint" title="Yes: each question takes its ${unit} from the Exam builder. No: you link each question to its ${unit} by hand in the table below.">?</i></span>
      <div class="seg">${[["here", "Yes, it was made here (Exam builder)"], ["outside", "No, it was made outside the app"]].map(([x, l]) => `<button class="${src === x ? "on" : ""}" data-irs="${x}">${l}</button>`).join("")}</div></div>
      ${src === "here" && !bq.length ? `<p class="warn-text">${esc(exam)} has no questions in the Exam builder yet, so no ${unit} links can be taken from it. Add the questions in Blueprint and Exam builder first, or choose <b>No</b> to link them by hand here.</p>` : ""}`;

    let body = "";
    if (!hasData && fmt !== FMT_MAN) body = `<p class="note">Waiting for the report of ${esc(exam)}.</p>`;
    else {
      const cnt = (l) => items.filter((it) => it.level === l).length;
      const flagged = items.filter((it) => it.flags.length);
      const fc = (f) => items.filter((it) => it.flags.some(f)).length;
      const card = (l, val, sub) => `<div class="kcard"><div class="lab">${l}</div><div class="big">${val}</div>${sub ? `<div class="pct">${sub}</div>` : ""}</div>`;
      const testA = fmt === FMT_MAN ? "" : `<h3 class="qm-h">Test analysis</h3><div class="kcards six">${card("Students", v(sum.students))}${card("Total points", v(sum.total_points))}
          ${card("Mean score", v(sum.mean, u), u !== "%" && num(sum.mean) && num(sum.total_points) ? `${(num(sum.mean) / num(sum.total_points) * 100).toFixed(1)}% of total` : "")}${card("Median", v(sum.median, u))}${card("SD", v(sum.sd))}${card("Max / Min", `${v(sum.max, u)} / ${v(sum.min, u)}`)}</div>
          <p class="note">${u === "%" ? "Question Mark reports scores as percentages and does not include the median or SD." : num(sum.kr20) !== null ? `Reliability (KR-20): ${g2(num(sum.kr20))}` : ""}</p>`;
      const pc = (k2) => (n ? `${Math.round(k2 / n * 100)}% of ${n}` : "");
      const sug = (s) => flagged.filter((it) => it.sug === s).length;
      const only = !!(S.ui.irOnly || {})[k] && flagged.length;
      const shown = only ? flagged : items;
      const man = fmt === FMT_MAN, here = src === "here";
      const opts = Object.keys(ids);
      const optHtml = (cur) => `<option value="" ${cur ? "" : "selected"}>—</option>${opts.map((o) => `<option value="${esc(o)}" ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}`;
      const hasText = items.some((it) => it.text), hasOpts = items.some((it) => it.opts);
      const rows = shown.map((it) => { const i = items.indexOf(it);
        const dTxt = it.d !== null && it.d < 0 ? `<b class="neg">${f2(it.d)}</b>` : f2(it.d);
        return `<tr class="${LEVEL_CLASS[it.level] || ""}"><td class="ro"><b>${esc(it.Q)}</b></td>${hasText ? `<td class="ro small">${esc(it.text)}</td>` : ""}
          ${man ? `<td><input class="cell" data-irc="key" data-ref="irc:key:${i}" data-i="${i}" value="${esc(it.key)}"></td><td><input class="cell num-in" inputmode="decimal" data-irc="p" data-ref="irc:p:${i}" data-i="${i}" value="${esc(f2(it.p))}"></td>
            <td><input class="cell num-in" inputmode="decimal" data-irc="d" data-ref="irc:d:${i}" data-i="${i}" value="${esc(f2(it.d))}"></td>
            <td class="ctr"><select class="cell" data-irc="dk" data-ref="irc:dk:${i}" data-i="${i}"><option value="" ${it.dk ? "" : "selected"}></option><option value="Yes" ${it.dk ? "selected" : ""}>Yes</option></select></td>`
          : `<td class="ro">${esc(it.key)}</td><td class="ro num">${f2(it.p)}</td><td class="ro num">${dTxt}</td><td class="ro ctr">${it.dk ? "Yes" : ""}</td>`}
          ${hasOpts ? `<td class="ro small">${it.opts ? Object.entries(it.opts).map(([o, x]) => (o === it.key ? `<b>${esc(o)}: ${g2(x)}</b>` : `${esc(o)}: ${g2(x)}`)).join(" · ") : ""}</td>` : ""}
          ${opts.length ? `<td>${here ? `<span class="ro">${esc(it.lk || "—")}</span>` : `<select class="cell" data-irl="${i}">${optHtml(it.lk)}</select>`}</td><td class="ro small">${esc(it.lk ? ids[it.lk].text : "")}</td>` : ""}
          <td class="ro small">${esc(it.flags.join("; "))}</td>
          <td><select class="cell" data-irg="${i}"><option value="" ${it.sug ? "" : "selected"}></option>${["Keep", "Revise", "Review key"].map((s) => `<option ${it.sug === s ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`; }).join("");
      const linked = items.filter((it) => it.lk).length;
      const linkNote = !opts.length ? `<p class="note">${esc(T.baseCode(sel))} has no ${basis} yet. Add them in ${unit === "CLO" ? "Course setup" : "Lectures &amp; SLOs"} first to link the questions.</p>`
        : `<p class="note">${basis !== "SLOs" ? "This exam's blueprint is built on CLOs, so the CLOs are offered. " : ""}All ${opts.length} ${basis} of the course are offered in the Linked ${unit} list. ${weighted.length ? `Planned for ${esc(exam)} in its blueprint (MCQ weight): ${weighted.map(esc).join(", ")}.` : `${esc(exam)} has no saved blueprint with MCQ weights.`}</p>
          ${here ? `<div class="info-box"><span>This test was made in this app, so the <b>Linked ${unit}</b> column comes from the Exam builder (${items.filter((it) => bl.link[qNo(it.Q)]).length} of ${n} questions linked). To change a link, change it in the Exam builder, or choose <b>No</b> above to link the questions by hand.</span></div>
            ${items.filter((it) => !bl.link[qNo(it.Q)]).length ? `<p class="note">Not mapped in the Exam builder: question(s) ${items.filter((it) => !bl.link[qNo(it.Q)]).slice(0, 40).map((it) => esc(it.Q)).join(", ")}.</p>` : ""}
            ${bl.multi.length ? `<p class="note">Mapped to more than one ${unit} in the Exam builder, so the first is used here: ${bl.multi.slice(0, 20).map(esc).join("; ")}.</p>` : ""}` : ""}`;
      body = `${testA}
        <h3 class="qm-h">General notes</h3><div class="kcards">${card("Easy items (p &gt; 0.80)", cnt("Easy"), pc(cnt("Easy")))}${card("Acceptable items (0.30 – 0.80)", cnt("Acceptable"), pc(cnt("Acceptable")))}${card("Difficult items (p &lt; 0.30)", cnt("Difficult"), pc(cnt("Difficult")))}</div>
        <h3 class="qm-h">Flagged items</h3><div class="kcards">${card("Difficulty &lt; 0.30", fc((f) => f === "Difficulty < 0.30"))}${card("Negative or low discrimination (&lt; 0.20)", fc((f) => f.toLowerCase().includes("discrimination")))}${card("Distractor chosen more than key", fc((f) => f === "Distractor chosen more than key"))}</div>
        <p class="note">Discrimination measure used: ${esc(T.s(sum.disc_name) || (fmt === FMT_QM ? "Item-total correlation" : fmt === FMT_CTR ? "Point biserial" : "as typed"))}. ${flagged.length ? ["Keep", "Revise", "Review key"].map((s) => `<b>${s}</b>: ${sug(s)}`).join(" · ") : '<span class="ok-text">No items were flagged.</span>'}</p>
        <h3 class="qm-h" id="h-irq">Questions: link to ${unit} and review</h3>${linkNote}
        <div class="row-btns"><label class="tick-line"><input type="checkbox" id="ir-only" ${only ? "checked" : ""} ${flagged.length ? "" : "disabled"}> Show flagged questions only (${flagged.length} of ${n})</label></div>
        <div class="ir-legend"><span class="lv-d">Difficult (p &lt; 0.30)</span><span class="lv-a">Acceptable (0.30 – 0.80)</span><span class="lv-e">Easy (p &gt; 0.80)</span><span><b class="neg">Negative discrimination in bold orange</b></span></div>
        <div class="bp-wrap"><table class="tbl ir-tbl"><thead><tr><th style="width:44px">Q</th>${hasText ? "<th>Question</th>" : ""}<th style="width:58px">Key</th><th class="num" style="width:82px">Difficulty (p)</th><th class="num" style="width:112px">Discrimination</th><th style="width:78px">Distractor &gt; key</th>
          ${hasOpts ? "<th>Students choosing each option (%)</th>" : ""}${opts.length ? `<th style="width:100px">Linked ${unit}</th><th>${unit} statement</th>` : ""}<th>Flag reasons</th><th style="width:118px">Suggestion</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="note">${opts.length ? `${linked} of ${n} questions linked to an ${unit}. ` : ""}The suggestion is made automatically for flagged questions; change it if you disagree.</p>
        <details class="sum-box"><summary>How suggestions are made</summary><ul class="ir-how">
          <li><b>Review key</b>: a distractor was chosen more than the key, or discrimination is negative. ${REASONS["Review key"]}</li>
          <li><b>Revise</b>: difficulty &lt; 0.30 or discrimination &lt; 0.20. ${REASONS.Revise}</li>
          <li><b>Keep</b>: only low discrimination on a very easy item (p ≥ 0.90), or only low difficulty on an item that still discriminates well (≥ 0.30).</li></ul></details>
        <div class="row-btns">${hasData ? `<span class="ok-text">✓ Saved automatically${t ? `, last saved ${esc(t.saved_at)}` : ""}. The CLO achievement page uses it.</span>` : `<span class="note">Nothing to save yet: no question has a difficulty or discrimination value.</span>`}</div>
        <div class="row-btns"><button class="btn sm" id="ir-xlsx" ${hasData ? "" : "disabled"}>Download item analysis (Excel)</button>
          ${t ? `<details class="sum-box ir-del"><summary>Delete the item analysis of ${esc(exam)}</summary><p class="note">This deletes the saved item analysis of this test (${mine("ia_results", sel, exam).length} questions) and its ${unit} links. The test and its questions stay.</p>
            <label class="tick-line"><input type="checkbox" id="ir-del-ok"> Yes, delete it</label><div class="row-btns"><button class="btn sm" id="ir-del">Delete</button></div></details>` : ""}</div>`;
    }
    el.innerHTML = `<div class="sec-head" id="h-irmcq"><div><h2>MCQ questions: item analysis</h2><p class="sub">Step 3 for ${esc(exam)}: upload the item analysis report or type the values. The difficulty factor (p) and discrimination of each question are checked, flagged and linked to the ${basis}.</p></div></div>
      ${srcHtml}${fmtHtml}${srcBox}${body}`;
    wireMcq(sel, exam, el, items);
    T.sections.irSlo(sel, exam, items, { unit, basis, ids, weighted });
  };

  function wireMcq(sel, exam, el, items) {
    const k = EK(sel, exam), redo = () => T.refresh("irMcq");
    $$("[data-irs]", el).forEach((b) => b.onclick = () => {
      if (b.dataset.irs === "outside" && sourceOf(sel, exam) === "here") {   // keep the links that were shown, so they can be changed one by one
        const { unit } = basisOf(sel, exam), ids = offered(sel, unit), bl = builderLinks(sel, exam, unit, ids).link;
        (work[k] || []).forEach((it) => { if (!it.link && bl[qNo(it.Q)]) it.link = bl[qNo(it.Q)]; });
      }
      obj("ia_source")[k] = b.dataset.irs; if (work[k] && work[k].some((it) => it.p !== null || it.d !== null)) save(sel, exam, work[k]); else S.save(); redo();
    });
    $$("[data-irf]", el).forEach((b) => b.onclick = () => { setFmt(sel, exam, b.dataset.irf); redo(); });
    const nq = $("#ir-nq", el); if (nq) nq.onchange = () => { S.ui.irNq = S.ui.irNq || {}; S.ui.irNq[k] = Math.max(1, Math.min(500, num(nq.value) || 1)); S.saveUi(); redo(); };
    const pdf = $("#ir-pdf", el);
    if (pdf) pdf.onchange = async () => {
      const f = pdf.files[0]; if (!f) return; const err = $("#ir-pdf-err", el);
      try {
        T.toast("Reading the report…");
        const r = parseCondensed(await pdfLines(f));
        const keep = {}; (work[k] || savedItems(sel, exam)).forEach((it) => { keep[it.Q] = it; });
        r.items.forEach((it) => { const o = keep[it.Q]; if (o) { it.link = o.link; } });
        work[k] = r.items;
        save(sel, exam, r.items, Object.assign({ report: f.name, format: FMT_CTR, disc_name: r.disc }, r.summary));
        T.toast(`Read ${r.items.length} questions from ${f.name}`); redo();
      } catch (e) { err.hidden = false; err.textContent = `${e.message || e} If it is a Question Mark report, change the format above.`; }
    };
    const only = $("#ir-only", el); if (only) only.onchange = () => { S.ui.irOnly = S.ui.irOnly || {}; S.ui.irOnly[k] = only.checked; S.saveUi(); redo(); };
    const commit = () => { save(sel, exam, work[k]); };
    $$("[data-irl]", el).forEach((s) => s.onchange = () => { work[k][+s.dataset.irl].link = s.value; commit(); redo(); });
    $$("[data-irg]", el).forEach((s) => s.onchange = () => { const it = work[k][+s.dataset.irg]; it.sugSet = s.value === it.auto ? "" : s.value; it.sug = s.value; commit(); redo(); });
    const setCell = (it, c, val) => {
      if (c === "key") it.key = T.s(val).trim().toUpperCase();
      else if (c === "dk") it.dk = /^(yes|y|true|1|✓)$/i.test(T.s(val).trim());
      else { let x = num(val); if (c === "p" && x !== null && x > 1) x = x / 100; it[c] = x; }
    };
    const bad = () => work[k].filter((it) => (it.p !== null && (it.p < 0 || it.p > 1)) || (it.d !== null && Math.abs(it.d) > 1)).map((it) => it.Q);
    const after = () => {
      work[k].forEach((it) => { const f = flagsOf(it); if (!f.length) it.sugSet = ""; });
      const b = bad();
      if (b.length) { T.toast(`Difficulty must be 0 to 1 (or 0 to 100%) and discrimination -1 to 1. Check question(s): ${b.join(", ")}`); return; }
      commit(); redo();
    };
    const COLS = ["key", "p", "d", "dk"];
    $$("[data-irc]", el).forEach((f) => {
      f.onchange = () => { setCell(work[k][+f.dataset.i], f.dataset.irc, f.value); after(); };
      f.addEventListener("paste", (e) => {
        const txt = (e.clipboardData || window.clipboardData).getData("text");
        if (!txt || (!txt.includes("\t") && !/\n./.test(txt.replace(/\r?\n$/, "")))) return;
        e.preventDefault();
        const lines = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
        const i0 = +f.dataset.i, c0 = COLS.indexOf(f.dataset.irc);
        const need = i0 + lines.length;
        if (need > work[k].length) { S.ui.irNq = S.ui.irNq || {}; S.ui.irNq[k] = Math.min(500, need); S.saveUi(); itemsOf(sel, exam); }
        lines.forEach((cells, r) => cells.forEach((v, c) => { const it = work[k][i0 + r], col = COLS[c0 + c]; if (it && col) setCell(it, col, v); }));
        after();
      });
    });
    const xl = $("#ir-xlsx", el); if (xl) xl.onclick = () => excel(sel, exam, items);
    const del = $("#ir-del", el);
    if (del) del.onclick = () => {
      if (!$("#ir-del-ok", el).checked) { T.toast("Tick “Yes, delete it” first."); return; }
      ["ia_results", "ia_tests", "ia_map"].forEach((t) => S.setT(t, tbl(t).filter((r) => !(sameC(r, sel) && T.s(r.assessment).trim() === exam))));
      delete work[k]; S.save(); T.toast(`Deleted the item analysis of ${exam}`); redo();
    };
  }

  /* ---------------------------------------------------------------- results by SLO (one exam) and every saved exam */
  function byOutcome(sel, exam, items, ids) {
    const g = {};
    items.filter((it) => it.lk).forEach((it) => { (g[it.lk] = g[it.lk] || []).push(it); });
    const mean = (a) => { const v = a.filter((x) => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
    return natSort(Object.keys(g)).map((o) => {
      const its = g[o], p = mean(its.map((it) => it.p)), d = mean(its.map((it) => it.d)), tg = ids[o] ? ids[o].target : 70;
      const pR = p === null ? null : Math.round(p * 100) / 100, act = pR === null ? null : r1(pR * 100);
      return { id: o, text: ids[o] ? ids[o].text : "", q: its.length, target: tg, actual: act, level: act === null || !tg ? null : r1(act * 100 / tg), p: pR, d: d === null ? null : Math.round(d * 100) / 100, flagged: its.filter((it) => it.flags.length).length };
    });
  }
  T.sections.irSlo = function (sel, exam, items, o) {
    const el = $("#sec-irslo"); if (!el || !items) return;
    const { unit, basis, ids, weighted } = o;
    const res = byOutcome(sel, exam, items, ids);
    const all = Object.keys(ids), missing = all.filter((x) => !res.some((r) => r.id === x)), planned = missing.filter((x) => weighted.includes(x));
    const table = res.length ? `<div class="bp-wrap"><table class="tbl ir-kpi"><thead><tr><th style="width:70px">${unit}</th><th>Statement</th><th class="num" style="width:76px">Questions</th><th class="num" style="width:92px">Pre-set KPI (Target %)</th><th class="num" style="width:96px">Achieved KPI (Actual %)</th><th class="num" style="width:96px">Achievement level %</th><th class="num" style="width:86px">Mean difficulty (p)</th><th class="num" style="width:104px">Mean discrimination</th><th class="num" style="width:70px">Flagged</th></tr></thead>
        <tbody>${res.map((r) => { const c = kpiClass(r.actual, r.target); return `<tr><td class="ro"><b>${esc(r.id)}</b></td><td class="ro small">${esc(r.text)}</td><td class="ro num">${r.q}</td><td class="ro num">${f2(r.target)}</td><td class="ro num ${c}">${f2(r.actual)}</td><td class="ro num ${c}">${f2(r.level)}</td><td class="ro num">${f2(r.p)}</td><td class="ro num">${f2(r.d)}</td><td class="ro num">${r.flagged}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="note">This exam only. <b>Achieved KPI</b> = mean difficulty factor (p) of the questions linked to the ${unit} × 100. <b>Target</b> = the ${unit}'s Target KPI (${unit === "SLO" ? "Lectures &amp; SLOs page" : "Course setup"}, 70 if not set). <b>Achievement level</b> = Actual ÷ Target × 100.</p>
      <div class="ir-legend"><span class="kpi-below">Below the target</span><span class="kpi-on">Exactly the target</span><span class="kpi-above">Above the target</span></div>
      ${missing.length ? `<p class="warn-text"><b>${missing.length} of ${all.length} ${basis} of ${esc(T.baseCode(sel))} were not assessed in ${esc(exam)}</b> (no question linked): ${missing.map(esc).join(", ")}.${planned.length ? ` Of these, ${planned.map(esc).join(", ")} had an MCQ weight in the blueprint of ${esc(exam)}, so check whether a question should be linked to them.` : ""}</p>`
        : all.length ? `<p class="ok-text">All ${all.length} ${basis} of ${esc(T.baseCode(sel))} were assessed in ${esc(exam)}.</p>` : ""}`
      : `<p class="note">Link the questions to their ${basis} in the table above, and the results by ${unit} appear here.</p>`;
    // every saved item analysis of the course, one column per exam
    const sv = mine("ia_results", sel).filter((r) => T.s(r.outcome_id).trim() && num(r.difficulty) !== null);
    let pivot = "";
    if (sv.length) {
      const exs = [], cell = {}, tg = targets(sel);
      sv.forEach((r) => { const a = T.s(r.assessment).trim(), oid = T.s(r.outcome_id).trim(); if (!exs.includes(a)) exs.push(a); ((cell[oid] = cell[oid] || {})[a] = cell[oid][a] || []).push(num(r.difficulty)); });
      const oids = natSort(Object.keys(cell));
      pivot = `<details class="sum-box"><summary>Achieved KPI of each saved exam of ${esc(T.baseCode(sel))} (${exs.length} exam(s))</summary>
        <div class="bp-wrap"><table class="tbl ir-kpi"><thead><tr><th style="width:90px">SLO / CLO</th><th class="num">Pre-set KPI (Target %)</th>${exs.map((a) => `<th class="num">${esc(a)}</th>`).join("")}</tr></thead>
        <tbody>${oids.map((oid) => { const t = tg[oid] === undefined ? 70 : tg[oid]; return `<tr><td class="ro"><b>${esc(oid)}</b></td><td class="ro num">${f2(t)}</td>${exs.map((a) => { const v = cell[oid][a]; if (!v) return `<td class="ro num"></td>`; const m = r1(v.reduce((s, x) => s + x, 0) / v.length * 100); return `<td class="ro num ${kpiClass(m, t)}">${f2(m)}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div>
        <p class="note">Each exam is measured on its own: Achieved KPI (%) = mean difficulty factor × 100 of that exam's questions linked to the SLO. Only saved item analyses are shown.</p></details>`;
    }
    el.innerHTML = `<div class="sec-head" id="h-irslo"><div><h2>Results by ${unit}: ${esc(exam)}</h2><p class="sub">How well each ${unit} was achieved in this test, from the difficulty factor of its questions.</p></div></div>${table}${pivot}`;
  };

  /* ---------------------------------------------------------------- Excel (the same sheets as TAMA's to_excel) */
  async function excel(sel, exam, items) {
    await T.importer.lib("xlsx");
    const t = testRow(sel, exam) || {}, unit = T.s(t.unit) || "points";
    const { unit: U } = basisOf(sel, exam), ids = offered(sel, U);
    const stat = [["Course", T.baseCode(sel)], ["Test / exam", exam], ["Report", T.s(t.report)], ["Format", T.s(t.format)], ["Students", num(t.students)], ["Total points", num(t.total_points)],
      [`Mean (${unit})`, num(t.mean)], ["Median", num(t.median)], ["SD", num(t.sd)], [`Max (${unit})`, num(t.max)], [`Min (${unit})`, num(t.min)], ["KR-20", num(t.kr20)], ["Discrimination measure", T.s(t.disc_name)]]
      .map(([a, b]) => ({ Statistic: a, Value: b }));
    const row = (it) => Object.assign({ Q: it.Q, Key: it.key }, it.text ? { Question: it.text } : {}, it.opts ? Object.fromEntries(Object.entries(it.opts).map(([o, x]) => [`% ${o}`, x])) : {},
      { "Difficulty (p)": it.p, "Upper 27% correct": it.up, "Lower 27% correct": it.low, Discrimination: it.d, "Distractor > key": it.dk, "Difficulty level": it.level, [`Linked ${U}`]: it.lk || "", Suggestion: it.sug, "Flag reasons": it.flags.join("; ") });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stat), "Test analysis");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.filter((it) => it.flags.length).map(row)), "Flagged items");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.map(row)), "All items");
    const res = byOutcome(sel, exam, items, ids);
    if (res.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res.map((r) => ({ [U]: r.id, Statement: r.text, Questions: r.q, "Pre-set KPI (Target %)": r.target, "Achieved KPI (Actual %)": r.actual, "Achievement level %": r.level, "Mean difficulty (p)": r.p, "Mean discrimination": r.d, Flagged: r.flagged }))), "By SLO");
    const nm = T.s(t.report).replace(/\.[^.]+$/, "") || `${T.baseCode(sel)}_${exam}`;
    XLSX.writeFile(wb, `item_analysis_${nm.replace(/[^\w-]+/g, "_")}.xlsx`);
  }

  T.renderResultsPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "The exam results fill in as soon as you have saved at least one course in Course setup."}</p>
        <div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = `<section class="card" id="sec-irtest"></section><section class="card" id="sec-irmcq"></section><section class="card" id="sec-irslo"></section><section class="card" id="sec-irpart"></section>`;
    T.refresh("irTest", "irMcq", "irPart", "irMarks");
  };
  T.irParts = { parseCondensed, analyse, flagsOf, suggestOf, levelOf, byOutcome, savedItems, examsOf };
})();
