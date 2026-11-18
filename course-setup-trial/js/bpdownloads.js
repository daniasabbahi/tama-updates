/* Blueprint for written exams: tab 3 (downloads of one exam, the list of saved exams) and renaming / deleting an exam.
   Ported from TAMA (exam_downloads, exam_excel, exam_report_html, exam_status, render_exam_rename, _exam_apply). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const TYPES = ["MCQ", "Short Essay", "Long Essay"], TYPE_KEY = { MCQ: "mcq", "Short Essay": "short", "Long Essay": "long" };
  const TYPE_COLOR = { MCQ: "#14365d", "Short Essay": "#1b998b", "Long Essay": "#6d5acd" };
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : []);
  const mineOf = (n, sel, exam) => tbl(n).filter((r) => String(r.course_code) === String(sel) && (exam === undefined || T.s(r.assessment) === exam));
  const num = (v) => { const x = parseFloat(String(v === undefined || v === null ? "" : v).replace(",", ".")); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const split = (t) => T.s(t).replace(/;/g, ",").split(",").map((x) => x.trim()).filter(Boolean);
  const dl = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  const safeName = (sel, exam) => `${T.baseCode(sel)}_${exam}`.replace(/[^\w؀-ۿ-]+/g, "_");

  /** Every exam name of the course (exams, blueprint plans, questions), as TAMA's exam_names. */
  function examNames(sel) { const out = []; ["exams", "plans", "questions"].forEach((n) => mineOf(n, sel).forEach((r) => { const a = T.s(r.assessment); if (a && !out.includes(a)) out.push(a); })); return out; }
  /** The saved blueprint plans of one exam, by basis. */
  function blocks(sel, exam) {
    const pl = mineOf("plans", sel, exam), out = [];
    [...new Set(pl.map((r) => r.basis))].forEach((b) => out.push([b, pl.filter((r) => r.basis === b).map((r) => { const o = { ...r }; Object.values(TYPE_KEY).forEach((k) => ["weight", "minutes", "questions"].forEach((s) => { o[`${k}_${s}`] = num(o[`${k}_${s}`]) || 0; })); return o; })]));
    return out;
  }
  /** Planned = outcomes with that question type ticked for this exam (the table at the top of the page). */
  function planned(sel, exam, basis) {
    const all = P().planRows(sel, basis), tp = T.bpTypesOf(sel, exam, basis);
    return [all.length, Object.fromEntries(TYPES.map((t) => [t, all.filter((r) => tp(r.id).has(t)).length]))];
  }
  const P = () => T.plan;
  function typeSummary(g, sel, exam, basis) {
    const tot = Object.values(TYPE_KEY).reduce((a, k) => a + g.reduce((b, r) => b + r[k + "_minutes"], 0), 0);
    const [nAll, pl] = planned(sel, exam, basis);
    return [TYPES.map((t) => { const k = TYPE_KEY[t], mn = g.reduce((a, r) => a + r[k + "_minutes"], 0), nq = g.reduce((a, r) => a + r[k + "_questions"], 0);
      return { Basis: basis, Type: t, Questions: nq, Minutes: Math.round(mn * 10) / 10, "Share of exam time (%)": tot ? Math.round(mn / tot * 1000) / 10 : 0, "Average minutes per question": nq ? Math.round(mn / nq * 100) / 100 : 0,
        [`${basis} planned`]: pl[t], [`${basis} covered in this exam`]: g.filter((r) => r[k + "_questions"] > 0).length }; }), nAll];
  }
  function groupTable(g, col, label) {
    const order = [], acc = {};
    g.forEach((r) => { const v = T.s(r[col]); if (!(v in acc)) { order.push(v); acc[v] = { [label]: v, MCQ: 0, "Short Essay": 0, "Long Essay": 0 }; } TYPES.forEach((t) => { acc[v][t] += r[TYPE_KEY[t] + "_questions"]; }); });
    return order.map((v) => ({ ...acc[v], Total: TYPES.reduce((a, t) => a + acc[v][t], 0) }));
  }
  function scorePcts(sel, exam) {
    const q = mineOf("questions", sel, exam), m = mineOf("marks", sel, exam); if (!q.length || !m.length) return [];
    const mx = Object.fromEntries(q.map((x) => [T.s(x.question_id), num(x.max_marks)])), st = {};
    m.forEach((r) => { const M = mx[T.s(r.question_id)], a = num(r.marks_awarded); if (M === null || M === undefined || a === null) return; const s = (st[r.student_id] = st[r.student_id] || [0, 0]); s[0] += Math.max(Math.min(a, M), 0); s[1] += M; });
    return Object.values(st).filter((s) => s[1] > 0).map((s) => s[0] / s[1] * 100);
  }
  function reportDate(sel) { const v = T.s((S.courseInfo(sel) || {}).report_date).trim(); const d = v ? new Date(v) : new Date(); return isNaN(d) ? v : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

  /* ---------------------------------------------------------------- the exam report (HTML, same layout as TAMA) */
  const REPORT_CSS = `*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1f2933;background:#eef2f7;line-height:1.45}.page{max-width:1000px;margin:0 auto;padding:24px 18px 40px}
.hero{background:linear-gradient(135deg,#14365d,#1f5f8b 60%,#1b998b);color:#fff;border-radius:18px;padding:26px 30px;box-shadow:0 8px 24px rgba(20,54,93,.25)}.hero small{letter-spacing:.14em;text-transform:uppercase;opacity:.8;font-size:11px}.hero h1{margin:6px 0 2px;font-size:28px}.hero .code{opacity:.9;font-size:15px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:18px}.meta div{background:rgba(255,255,255,.14);border-radius:10px;padding:9px 12px;font-size:13px}.meta b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.75;font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}.card{background:#fff;border-radius:14px;padding:14px 16px;border:1px solid #dbe3ee;box-shadow:0 2px 8px rgba(20,54,93,.06)}.card .n{font-size:28px;font-weight:700;color:#14365d}.card .l{font-size:12px;color:#6b7785;text-transform:uppercase;letter-spacing:.06em}
section{background:#fff;border-radius:16px;border:1px solid #dbe3ee;padding:20px 22px;margin:16px 0;box-shadow:0 2px 8px rgba(20,54,93,.05)}section h2{margin:0 0 4px;font-size:18px;color:#14365d}section p.sub{margin:0 0 12px;color:#6b7785;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}th{background:#14365d;color:#fff;text-align:left;padding:8px 10px;font-weight:600}th:first-child{border-radius:8px 0 0 0}th:last-child{border-radius:0 8px 0 0}td{padding:8px 10px;border-bottom:1px solid #dbe3ee;vertical-align:top}tr:nth-child(even) td{background:#f4f7fb}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;background:#14365d;margin-right:3px;white-space:nowrap}.b-K{background:#2b6cb0}.b-S{background:#2f9e6f}.b-V{background:#b7791f}.b-MCQ{background:#14365d}.b-Short{background:#1b998b}.b-Long{background:#6d5acd}
.bar{background:#e6ecf4;border-radius:999px;height:10px;overflow:hidden;min-width:90px}.fill{height:100%;border-radius:999px}.row{display:grid;grid-template-columns:170px 1fr 70px;gap:10px;align-items:center;margin:7px 0;font-size:13px}.row .v{text-align:right;font-weight:700;color:#14365d}
.note{background:#fff8e6;border:1px solid #f3dca4;border-radius:10px;padding:9px 12px;font-size:13px;color:#7a5b10;margin:8px 0}h3{margin:18px 0 4px;font-size:15px;color:#14365d}footer{text-align:center;color:#6b7785;font-size:12px;margin-top:22px}
@media print{body{background:#fff}.page{padding:0}section,.hero,.card{box-shadow:none;break-inside:avoid}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}th,.fill,.badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
  const bar = (pct, color) => `<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(100, pct || 0)).toFixed(1)}%;background:${color || "#1b998b"}"></div></div>`;
  const domBadge = (d) => { d = T.s(d); return d ? `<span class="badge b-${"KSV".includes(d[0]) ? d[0] : "K"}">${esc(d)}</span>` : ""; };
  const table = (h, rows) => (rows.length ? `<table><tr>${h.map((x) => `<th>${esc(x)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>` : '<p class="sub">Nothing entered yet.</p>');
  const donut = (items) => { const tot = items.reduce((a, x) => a + x[1], 0); if (tot <= 0) return ""; const r = 56, C = 2 * Math.PI * r; let off = 0, segs = "";
    items.forEach(([, v, col]) => { const L = v / tot * C; segs += `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${col}" stroke-width="26" stroke-dasharray="${L.toFixed(2)} ${(C - L).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 80 80)"/>`; off += L; });
    return `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><svg viewBox="0 0 160 160" width="170" height="170">${segs}<text x="80" y="78" text-anchor="middle" font-size="20" font-weight="700" fill="#14365d">${g2(tot)}</text><text x="80" y="94" text-anchor="middle" font-size="9" fill="#6b7785">total</text></svg><div>${items.map(([l, v, c]) => `<div style="font-size:12px;margin:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c};margin-right:6px"></span>${esc(l)}: <b>${g2(v)}</b> (${Math.round(v / tot * 100)}%)</div>`).join("")}</div></div>`; };
  const stackRows = (rows, label) => { const mx = Math.max(0, ...rows.map((r) => r.Total)); return rows.map((r) => `<div class="row" style="grid-template-columns:200px 1fr 60px"><div><b>${esc(r[label])}</b></div><div class="bar" style="display:flex;height:14px">${TYPES.filter((t) => r[t] > 0 && mx).map((t) => `<div style="width:${(r[t] / mx * 100).toFixed(1)}%;background:${TYPE_COLOR[t]};height:100%" title="${esc(t)}: ${g2(r[t])}"></div>`).join("")}</div><div class="v">${g2(r.Total)}</div></div>`).join("")
    + `<div style="font-size:12px;margin-top:4px">${TYPES.map((t) => `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${TYPE_COLOR[t]};margin:0 5px 0 12px"></span>${esc(t)}`).join("")}</div>`; };
  const hist = (vals) => { const bins = Array(10).fill(0); vals.forEach((v) => { bins[Math.min(Math.floor(v / 10), 9)]++; }); const mx = Math.max(...bins) || 1;
    return `<svg viewBox="0 0 360 132" width="100%" style="max-width:520px">${bins.map((n, i) => { const h = n / mx * 90; return `<rect x="${10 + i * 34}" y="${(110 - h).toFixed(1)}" width="28" height="${h.toFixed(1)}" rx="3" fill="#1f5f8b"/><text x="${24 + i * 34}" y="${(106 - h).toFixed(1)}" text-anchor="middle" font-size="9" fill="#14365d">${n || ""}</text><text x="${24 + i * 34}" y="124" text-anchor="middle" font-size="8" fill="#6b7785">${i * 10}-${i * 10 + 10}</text>`; }).join("")}</svg>`; };

  function reportHtml(sel, exam) {
    const c = S.courseInfo(sel) || {}, ex = mineOf("exams", sel, exam)[0], dur = ex ? num(ex.duration_min) : null, rev = ex ? num(ex.revision_min) || 0 : 0, actual = dur !== null ? dur - rev : null;
    const parts = [], meta = [["Course", `${T.baseCode(sel)} ${T.s(c.course_name)}`], ["Department", c.department], ["Course director", c.course_director], ["Term / year", `${T.s(c.term)} ${T.s(c.year)}`],
      ["Exam duration", dur !== null ? `${g2(dur)} min` : "-"], ["Revision / extra time", dur !== null ? `${g2(rev)} min` : "-"], ["Report date", reportDate(sel)]];
    parts.push(`<div class="hero"><small>Exam report</small><h1>${esc(exam)}</h1><div class="code">${esc(T.baseCode(sel))}</div><div class="meta">${meta.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v) || "-"}</div>`).join("")}</div></div>`);
    const bl = blocks(sel, exam);
    bl.forEach(([basis, g]) => {
      const [Sm, nAll] = typeSummary(g, sel, exam, basis), nq = Sm.reduce((a, x) => a + x.Questions, 0), tm = Sm.reduce((a, x) => a + x.Minutes, 0);
      const incl = g.filter((r) => Object.values(TYPE_KEY).reduce((a, k) => a + r[k + "_questions"], 0) > 0).length;
      const cards = [[nq, "Questions"], [g2(tm), "Minutes of questions"], [actual !== null ? g2(actual) : "-", "Actual exam time (min)"], [`${incl} / ${nAll}`, `${basis} included in this exam`], [nq ? (tm / nq).toFixed(1) : "-", "Avg minutes per question"]];
      parts.push(`<section><h2>Blueprint built on ${esc(basis)}</h2><p class="sub">Key statistics of this exam.</p><div class="cards">${cards.map(([n, l]) => `<div class="card"><div class="n">${n}</div><div class="l">${esc(l)}</div></div>`).join("")}</div>`);
      if (actual) { const diff = Math.round((tm - actual) * 10) / 10, col = diff > 0 ? "#d1495b" : diff < 0 ? "#2f9e6f" : "#8a94a3";
        const txt = diff > 0 ? `${g2(diff)} minutes MORE than the exam time` : diff < 0 ? `${g2(Math.abs(diff))} minutes LESS than the exam time` : "equal to the exam time";
        parts.push(`<h3>Time of the questions compared with the exam time</h3><div class="row" style="grid-template-columns:170px 1fr 120px"><div><b>Questions: ${g2(tm)} min</b></div>${bar(Math.min(tm / actual * 100, 100), col)}<div class="v">${Math.round(tm / actual * 100)}%</div></div><div class="note" style="border-color:${col}">Total time of the questions is ${txt} (${g2(actual)} min).</div>`); }
      parts.push("<h3>Learning outcomes covered by each type of assessment</h3>");
      parts.push(table(["Type", `${basis} planned`, `${basis} covered here`, `Coverage of all ${nAll} ${basis}`, "Questions", "Minutes", "Share of time"], Sm.map((x) => [`<span class="badge b-${{ MCQ: "MCQ", "Short Essay": "Short", "Long Essay": "Long" }[x.Type]}">${esc(x.Type)}</span>`, String(x[`${basis} planned`]), `<b>${x[`${basis} covered in this exam`]}</b>`, bar(nAll ? x[`${basis} covered in this exam`] / nAll * 100 : 0, TYPE_COLOR[x.Type]), String(x.Questions), g2(x.Minutes), `${g2(x["Share of exam time (%)"])}%`])));
      parts.push(`<div style="display:flex;gap:30px;flex-wrap:wrap;margin-top:12px"><div><h3>Share of exam time</h3>${donut(Sm.map((x) => [x.Type, x.Minutes, TYPE_COLOR[x.Type]]))}</div><div><h3>Questions by type</h3>${donut(Sm.map((x) => [x.Type, x.Questions, TYPE_COLOR[x.Type]]))}</div></div>`);
      const dom = groupTable(g, "domain", "Domain").filter((r) => r.Total > 0); if (dom.length) parts.push("<h3>Questions by domain</h3>" + stackRows(dom, "Domain"));
      if (g.some((r) => T.s(r.lecture).trim())) { const lec = groupTable(g, "lecture", "Lecture / module").filter((r) => r.Total > 0); if (lec.length) parts.push("<h3>Questions by lecture / module</h3>" + stackRows(lec, "Lecture / module")); }
      const rows = g.map((r) => { const q3 = Object.values(TYPE_KEY).map((k) => r[k + "_questions"]); return q3.reduce((a, b) => a + b, 0) ? [esc(r.lecture) || "-", `<b>${esc(r.outcome_id)}</b>`, domBadge(r.domain), esc(r.statement), ...q3.map((x) => (x ? String(x) : "-")), String(q3.reduce((a, b) => a + b, 0))] : null; }).filter(Boolean);
      parts.push("<h3>Questions for each learning outcome</h3>" + table(["Lecture / module", "ID", "Domain", "Learning outcome", "MCQ", "Short Essay", "Long Essay", "Total"], rows) + "</section>");
    });
    if (!bl.length) parts.push(`<section><h2>Blueprint</h2><p class="sub">No blueprint plan has been saved for this exam yet. It saves itself in tab 1 (How many questions?) of the Blueprint for written exams page once the number of questions can be calculated.</p></section>`);
    const q = mineOf("questions", sel, exam);
    if (q.length) {
      const lv = {}; q.forEach((x) => { lv[x.cognitive_level] = (lv[x.cognitive_level] || 0) + 1; });
      const mk = q.reduce((a, x) => a + (num(x.max_marks) || 0), 0);
      parts.push(`<section><h2>Question paper</h2><p class="sub">${q.length} questions - ${g2(mk)} marks in total.</p>${table(["Cognitive level", "Questions", "Share"], Object.entries(lv).sort((a, b) => b[1] - a[1]).map(([n, v]) => [esc(n), String(v), bar(v / q.length * 100, "#1f5f8b")]))}
        <h3>Questions</h3>${table(["ID", "Topic", "Level", "Marks", "CLOs", "SLOs"], q.map((r) => [`<b>${esc(r.question_id)}</b>`, esc(r.topic), esc(r.cognitive_level), esc(r.max_marks), esc(r.clos), esc(r.slos)]))}</section>`);
    }
    const pc = scorePcts(sel, exam);
    if (pc.length) {
      const mean = pc.reduce((a, b) => a + b, 0) / pc.length, sorted = pc.slice().sort((a, b) => a - b), med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      const sd = Math.sqrt(pc.reduce((a, v) => a + (v - mean) ** 2, 0) / pc.length);
      const st = [["Students", String(pc.length)], ["Mean", `${f1(mean)}%`], ["Median", `${f1(med)}%`], ["Standard deviation", f1(sd)], ["Lowest", `${f1(sorted[0])}%`], ["Highest", `${f1(sorted[sorted.length - 1])}%`], ["Scored 60% or more", `${Math.round(pc.filter((v) => v >= 60).length / pc.length * 100)}%`]];
      parts.push(`<section><h2>Student results</h2><p class="sub">Overall score of each student in this exam.</p><div class="cards">${st.map(([k, v]) => `<div class="card"><div class="n" style="font-size:22px">${v}</div><div class="l">${esc(k)}</div></div>`).join("")}</div><h3>Distribution of scores (number of students per 10% band)</h3>${hist(pc)}</section>`);
    }
    const now = new Date();
    parts.push(`<footer>Generated by Academic Assessment Manager - ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toTimeString().slice(0, 5)}</footer>`);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Exam report - ${esc(exam)}</title><style>${REPORT_CSS}</style></head><body><div class="page">${parts.join("")}</div></body></html>`;
  }

  /* ---------------------------------------------------------------- the Excel file of one exam (sheets as TAMA) */
  async function examExcel(sel, exam) {
    await T.importer.lib("xlsx");
    const wb = XLSX.utils.book_new(), add = (name, rows, header) => { const ws = rows.length ? XLSX.utils.json_to_sheet(rows, header ? { header } : undefined) : XLSX.utils.aoa_to_sheet([header || []]); XLSX.utils.book_append_sheet(wb, ws, name); return ws; };
    const ex = mineOf("exams", sel, exam)[0], dur = ex ? num(ex.duration_min) : null, rev = ex ? num(ex.revision_min) : null;
    add("ExamInfo", [["Course code", T.baseCode(sel)], ["Assessment", exam], ["Exam duration (min)", dur], ["Revision / extra time (min)", rev], ["Actual exam time (min)", ex ? dur - (rev || 0) : null], ["Report date", reportDate(sel)]].map(([Item, Value]) => ({ Item, Value })));
    const bl = blocks(sel, exam);
    if (bl.length) {
      const summ = [], dom = [];
      bl.forEach(([basis, g]) => { summ.push(...typeSummary(g, sel, exam, basis)[0]); groupTable(g, "domain", "Domain").forEach((d) => dom.push({ Basis: basis, ...d })); });
      const ws = XLSX.utils.json_to_sheet(summ); XLSX.utils.sheet_add_json(ws, dom, { origin: summ.length + 3 }); XLSX.utils.book_append_sheet(wb, ws, "Summary");
      add("BlueprintPlan", mineOf("plans", sel, exam));
      const wrows = []; Object.entries(S.data.bp_raw || {}).forEach(([k, raw]) => { const [cc, aa, bb] = k.split("||"); if (cc === String(sel) && aa === exam) Object.entries(raw).forEach(([oid, d]) => wrows.push({ Basis: bb, Outcome: oid, ...Object.fromEntries(TYPES.map((t) => [`${t} weight`, d[t] === undefined ? null : d[t]])) })); });
      add("Weights", wrows, ["Basis", "Outcome", ...TYPES.map((t) => `${t} weight`)]);
      const mrows = []; bl.forEach(([basis]) => { const ms = (S.data.bp_minutes3 || {})[`${sel}||${exam}||${basis}`] || (S.data.bp_minutes2 || {})[basis] || {}; Object.entries(ms).forEach(([t, dd]) => Object.entries(dd || {}).forEach(([dm, v]) => mrows.push({ Basis: basis, Type: t, Domain: dm, "Minutes per question": v }))); });
      add("MinutesPerQuestion", mrows, ["Basis", "Type", "Domain", "Minutes per question"]);
      // which question types each outcome uses in this exam (new: the table at the top of the blueprint page)
      const trows = []; Object.entries(S.data.bp_types || {}).forEach(([k, m]) => { const [cc, aa, bb] = k.split("||"); if (cc === String(sel) && aa === exam) Object.entries(m).forEach(([oid, l]) => trows.push({ Basis: bb, Outcome: oid, ...Object.fromEntries(TYPES.map((t) => [t, l.includes(t) ? "Y" : ""])) })); });
      add("QuestionTypes", trows, ["Basis", "Outcome", ...TYPES]);
    }
    add("Questions", mineOf("questions", sel, exam).map(({ image, ...r }) => r));
    add("StudentMarks", mineOf("marks", sel, exam));
    add("CLOs", mineOf("clos", sel)); add("SLOs", mineOf("slos", sel)); add("CLOAssessmentPlan", mineOf("clo_plan", sel));
    XLSX.writeFile(wb, `exam_${safeName(sel, exam)}.xlsx`);
  }

  /* ---------------------------------------------------------------- tab 3 */
  T.bpDownloadsTab = function (sel, exam) {
    const has = blocks(sel, exam).length;
    const rows = examNames(sel).map((a) => ({ a, det: mineOf("exams", sel, a).length ? "Yes" : "No", plan: [...new Set(mineOf("plans", sel, a).map((r) => r.basis))].sort().join(", ") || "No",
      q: mineOf("questions", sel, a).length, st: new Set(mineOf("marks", sel, a).map((r) => r.student_id)).size }));
    return `<p class="note"><b>${esc(T.baseCode(sel))} - ${esc(exam)}</b>: everything saved for this exam is kept separately from your other exams.</p>
      ${has ? "" : `<p class="warn-text">This exam has no saved blueprint plan yet. It saves itself in tab 1 once the number of questions can be calculated; then the blueprint, charts and statistics are included. The Excel file still contains the exam details, questions and marks.</p>`}
      <div class="row-btns"><button class="btn sm" id="dl-xlsx">⬇ This exam (Excel)</button><button class="btn sm" id="dl-html">⬇ Exam report (HTML, with charts)</button><button class="btn sm" id="dl-pdf">Exam report: print / save as PDF</button></div>
      <p class="note">The report has the blueprint, its charts, the question paper summary and the students' results (once marks are entered). CLO achievement is added when that page is rebuilt.</p>
      <details class="sum-box" id="dl-prev-box"><summary>Preview the report</summary><iframe id="dl-prev" class="rep-prev" title="Exam report preview"></iframe></details>
      ${rows.length ? `<h4>All saved exams of this course</h4><table class="tbl sum-tbl"><thead><tr><th>Exam</th><th>Details saved</th><th>Blueprint plan saved</th><th class="num">Questions mapped</th><th class="num">Students with marks</th></tr></thead>
        <tbody>${rows.map((r) => `<tr class="${r.a === exam ? "b" : ""}"><td>${esc(r.a)}</td><td>${r.det}</td><td>${esc(r.plan)}</td><td class="num">${r.q}</td><td class="num">${r.st}</td></tr>`).join("")}</tbody></table>` : ""}`;
  };
  T.bpDownloadsWire = function (sel, exam, el) {
    $("#dl-xlsx", el).onclick = () => examExcel(sel, exam).catch((e) => T.toast("The Excel file could not be built: " + e.message));
    $("#dl-html", el).onclick = () => dl(new Blob([reportHtml(sel, exam)], { type: "text/html" }), `exam_report_${safeName(sel, exam)}.html`);
    $("#dl-pdf", el).onclick = () => { const w = window.open("", "_blank"); if (!w) { T.toast("The browser blocked the new window. Allow pop-ups for this site, or use ⬇ Exam report (HTML)."); return; } w.document.write(reportHtml(sel, exam)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* closed */ } }, 500); };
    const box = $("#dl-prev-box", el); box.ontoggle = () => { if (box.open) $("#dl-prev", el).srcdoc = reportHtml(sel, exam); };
  };

  /* ---------------------------------------------------------------- rename / join / delete an exam (TAMA's _exam_apply) */
  const sameName = (sel, name, but) => { const w = T.s(name).split(/\s+/).filter(Boolean).join(" ").toLowerCase(); return examNames(sel).find((e) => e !== but && e.split(/\s+/).filter(Boolean).join(" ").toLowerCase() === w) || null; };
  const KEYED = ["bp_raw", "bp_weights2", "bp_minutes3", "bp_types", "ia_source"];
  function parts(sel, name) {
    const out = [], L = { questions: "questions (question mapping)", plans: "blueprint plan", marks: "student marks", ia_map: "item analysis SLO links", ia_tests: "item analysis", ia_results: "item analysis results", slo_other: "results by SLO", course_assessments: "full grade (course assessments)" };
    Object.entries(S.data.tables).forEach(([t, rows]) => { if (t !== "exams" && Array.isArray(rows) && rows.some((r) => String(r.course_code) === String(sel) && T.s(r.assessment) === name)) out.push(L[t] || t); });
    KEYED.forEach((k) => { if (Object.keys(S.data[k] || {}).some((x) => { const p = x.split("||"); return p[0] === String(sel) && p[1] === name; })) out.push({ bp_minutes3: "blueprint minutes", bp_types: "question types", ia_source: "item analysis source" }[k] || "blueprint plan"); });
    return [...new Set(out)];
  }
  const deep = (v, o, n) => (typeof v === "string" ? (v === o ? n : v) : Array.isArray(v) ? v.map((x) => deep(x, o, n)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k === o ? n : k, deep(x, o, n)])) : v);
  function apply(sel, old, nw) {   // nw = null deletes the exam
    sel = String(sel);
    Object.entries(S.data.tables).forEach(([t, rows]) => {
      if (!Array.isArray(rows)) return; const m = (r) => String(r.course_code) === sel && T.s(r.assessment) === old; if (!rows.some(m)) return;
      const hasNew = nw !== null && rows.some((r) => String(r.course_code) === sel && T.s(r.assessment) === nw);
      if (nw === null || (t === "exams" && hasNew)) S.data.tables[t] = rows.filter((r) => !m(r)); else rows.forEach((r) => { if (m(r)) r.assessment = nw; });
    });
    KEYED.forEach((k) => { const d = S.data[k]; if (!d) return; Object.keys(d).forEach((x) => { const p = x.split("||"); if (p[0] !== sel || p[1] !== old) return; const v = d[x]; delete d[x]; if (nw !== null) { p[1] = nw; const nk = p.join("||"); if (!(nk in d)) d[nk] = v; } }); });
    if (nw !== null) {
      const cr = S.data.course_report; if (cr && cr[sel]) cr[sel] = deep(cr[sel], old, nw);
      // the ticks of the Assessment plan use the assessment names: they follow the new name too
      const ren = (t) => split(t).map((x) => (x.toUpperCase() === old.toUpperCase() ? nw : x)).filter((x, i, a) => a.findIndex((y) => y.toUpperCase() === x.toUpperCase()) === i).join(", ");
      tbl("slos").forEach((r) => { if (String(r.course_code) === sel) r.assessment_methods = ren(r.assessment_methods); });
      tbl("clo_plan").forEach((r) => { if (String(r.course_code) === sel) r.assessment_methods = ren(r.assessment_methods); });
      const mk = S.data.method_kinds; if (mk && mk[old.toUpperCase()] && !mk[nw.toUpperCase()]) mk[nw.toUpperCase()] = mk[old.toUpperCase()];
    }
    S.save();
  }
  T.bpRenameHtml = function (sel, exam) {
    if (!examNames(sel).includes(exam)) return "";
    const what = [...(mineOf("exams", sel, exam).length ? ["its exam details (duration and revision time)"] : []), ...parts(sel, exam)];
    return `<details class="sum-box" id="bp-ren-box"><summary>✏️ Rename this exam (or delete it)</summary>
      <div class="grid g3">${T.field({ id: "bp-ren", label: "New name for this exam", value: exam, help: "The questions, blueprint, marks, SLO links and reports move to the new name. The name in the Summative assessment table and the ticks of the Assessment plan follow too." })}</div>
      <p class="note" id="bp-ren-note" hidden></p><div class="row-btns"><button class="btn primary sm" id="bp-ren-go" hidden></button></div>
      <h4>Delete '${esc(exam)}'</h4><p class="note">${what.length ? "This also deletes: " + esc(what.join("; ")) + "." : "Only the name is saved; nothing else is linked to it."}</p>
      <label class="tick-line"><input type="checkbox" id="bp-del-ok"> Yes, delete '${esc(exam)}' and everything saved for it</label>
      <div class="row-btns"><button class="btn sm" id="bp-del-go" disabled>Delete '${esc(exam)}'</button></div></details>`;
  };
  T.bpRenameWire = function (sel, exam, el, setExam) {
    const inp = $("#bp-ren", el); if (!inp) return;
    const note = $("#bp-ren-note", el), go = $("#bp-ren-go", el);
    let target = null;
    inp.oninput = () => {
      const nw = T.s(inp.value).split(/\s+/).filter(Boolean).join(" "); T.markFilled(inp); target = null; note.hidden = go.hidden = true;
      if (!nw || nw === exam) return;
      const other = sameName(sel, nw, exam);
      if (other) { const both = parts(sel, exam).filter((x) => parts(sel, other).includes(x)); note.hidden = false;
        if (both.length) { note.textContent = `This course already has an exam called '${other}'. Both '${exam}' and '${other}' have their own ${both.join(", ")}, so they cannot be joined without losing something. Open the one you do not need and delete it below, then rename the other.`; return; }
        note.textContent = `This course already has an exam called '${other}'. Joining moves everything saved under '${exam}' into '${other}', so only one exam is left.`; target = other; go.textContent = `Join '${exam}' into '${other}'`; go.hidden = false; return; }
      target = nw; go.textContent = `Rename to '${nw}'`; go.hidden = false;
    };
    go.onclick = () => { if (!target) return; const joined = examNames(sel).includes(target); apply(sel, exam, target); setExam(target);
      T.toast(joined ? `'${exam}' was joined into '${target}'. All its data now belongs to '${target}'.` : `The exam '${exam}' is now called '${target}'. All its data moved with it.`); T.refresh("bpPlan", "bpExam", "bpTab"); };
    const ok = $("#bp-del-ok", el), del = $("#bp-del-go", el); ok.onchange = () => { del.disabled = !ok.checked; };
    del.onclick = () => { if (!ok.checked) return; apply(sel, exam, null); setExam(""); T.toast(`'${exam}' was deleted, with everything saved for it.`); T.refresh("bpPlan", "bpExam", "bpTab"); };
  };
  T.bpReportHtml = reportHtml;
})();
