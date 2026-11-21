/* Students x questions marks grid (TAMA's data_editor of Exam results > Student marks and of the partial-marks step),
   and part 2 of the Exam results page: questions with partial marks (TAMA render_ia_partial / _iap_outcome_results).
   Marks are saved where TAMA keeps them: tables.marks (course_code, assessment, student_id, question_id, marks_awarded,
   student_name, paper_mark) and ui_settings.xm_roster["course||exam"] = [[id, name], ...].
   Partial-marks questions and KPI: ui_settings.ia_partial["course||exam"] = {questions: [[q, full mark, outcome]], kpi: {outcome: [x, y]}}. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const ui = () => (S.data.ui_settings = S.data.ui_settings || {});
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").trim()); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const r1 = (n) => Math.round(n * 10) / 10;
  const clean = (v) => { const s = T.s(v).trim(); return ["nan", "none"].includes(s.toLowerCase()) ? "" : s; };
  const sameC = (r, sel) => String(r.course_code) === String(sel);
  const EK = (sel, exam) => `${sel}||${exam}`;
  const split = (v) => T.s(v).split(/[,;/\n]+/).map((x) => x.trim()).filter(Boolean);
  const ONE01 = new Set(["MCQ", "TRUE/FALSE", "T/F", "TF", "MATCHING", "SBA", "EMQ", "", "NAN", "NONE"]);
  const marksOf = (sel, exam) => tbl("marks").filter((r) => sameC(r, sel) && T.s(r.assessment).trim() === exam);

  /* ---------------------------------------------------------------- reading and writing the marks */
  /** The grid rows of a test for these columns: the saved student list, else the students with marks, else another test's list. */
  T.marksRows = function (sel, exam, qids) {
    const ek = EK(sel, exam), cur = marksOf(sel, exam), names = {};
    cur.forEach((r) => { if (clean(r.student_name)) names[T.s(r.student_id)] = clean(r.student_name); });
    let roster = ((ui().xm_roster || {})[ek] || []).map((x) => [T.s(x[0]), T.s(x[1])]), from = "";
    if (!roster.length) roster = [...new Set(cur.map((r) => T.s(r.student_id)))].map((s) => [s, names[s] || ""]);
    if (!roster.length) for (const [k2, r2] of Object.entries(ui().xm_roster || {})) {
      if (k2.startsWith(`${sel}||`) && k2 !== ek && r2 && r2.length) { roster = r2.map((x) => [T.s(x[0]), T.s(x[1])]); from = k2.split("||")[1]; break; }
    }
    roster = roster.map(([s, n]) => [s, n || names[s] || ""]);
    const vals = {}; cur.forEach((r) => { if (qids.includes(T.s(r.question_id))) vals[`${T.s(r.student_id)}||${T.s(r.question_id)}`] = r; });
    const rows = roster.map(([s, n]) => { const v = {}, pm = {}; qids.forEach((q) => { const r = vals[`${s || n}||${q}`]; if (r) { v[q] = num(r.marks_awarded); if (num(r.paper_mark) !== null) pm[q] = num(r.paper_mark); } }); return { sid: s, nm: n, v, pm }; });
    return { rows, from };
  };
  /** Saves the grid: the marks of these columns are replaced; other marks of the test are kept unless `all` is set. */
  T.marksSave = function (sel, exam, qids, rows, all) {
    const out = [], roster = [];
    rows.forEach((r) => {
      const sid = clean(r.sid), nm = clean(r.nm); if (!sid && !nm) return;
      roster.push([sid, nm]);
      qids.forEach((q) => { const v = r.v[q]; if (v !== null && v !== undefined && !isNaN(v)) { const row = { course_code: sel, assessment: exam, student_id: sid || nm, question_id: q, marks_awarded: v, student_name: nm }; if (r.pm && r.pm[q] !== undefined && r.pm[q] !== null) row.paper_mark = r.pm[q]; out.push(row); } });
    });
    S.setT("marks", tbl("marks").filter((r) => !(sameC(r, sel) && T.s(r.assessment).trim() === exam && (all || qids.includes(T.s(r.question_id))))).concat(out));
    (ui().xm_roster = ui().xm_roster || {})[EK(sel, exam)] = roster;
    S.save();
  };

  /** TAMA's _xm_read_upload: find the header row, the Student ID / name columns and one column per question. */
  function readUpload(raw, cols) {
    raw = raw.filter((r) => r.some((c) => clean(c)));
    const norm = (v) => T.s(v).toLowerCase().replace(/[^a-z0-9]/g, "");
    let hdr = -1;
    for (let i = 0; i < Math.min(raw.length, 15); i++) if (raw[i].map(norm).some((c) => c.includes("id") || c.includes("name") || c.includes("computer"))) { hdr = i; break; }
    if (hdr < 0) return { err: "I could not find a header row with 'Student ID' or 'Student name'." };
    const nh = raw[hdr].map(norm);
    const cId = nh.findIndex((h) => ["id", "studentid", "studentno", "computerno", "computernumber", "universityid"].includes(h) || (h.includes("id") && h.includes("student")));
    const cNm = nh.findIndex((h) => h.includes("name"));
    const hit = {};
    cols.forEach(([q]) => {
      const k = norm(q), alts = q === "TOTAL" ? ["total", "totalmark", "mark", "marks", "score", "grade"] : [k, k.replace(/^q+/, ""), "q" + k];
      const j = nh.findIndex((h) => alts.includes(h) || alts.includes(h.replace(/(outof|max)\d+$/, "")));
      if (j >= 0 && j !== cId && j !== cNm) hit[q] = j;
    });
    if (cId < 0 && cNm < 0) return { err: "I could not find the Student ID or Student name column." };
    if (!Object.keys(hit).length) return { err: `I could not find any mark column with the same name as the questions (${cols.slice(0, 6).map((c) => c[0]).join(", ")}).` };
    const rows = [];
    for (let i = hdr + 1; i < raw.length; i++) {
      const r = raw[i]; let sid = cId >= 0 ? clean(r[cId]) : ""; if (sid.endsWith(".0")) sid = sid.slice(0, -2);
      const nm = cNm >= 0 ? clean(r[cNm]) : ""; if (!sid && !nm) continue;
      const v = {}; Object.entries(hit).forEach(([q, j]) => { v[q] = num(r[j]); });
      rows.push({ sid, nm, v, pm: {} });
    }
    const miss = cols.map((c) => c[0]).filter((q) => !(q in hit));
    return { rows, note: `${rows.length} students, ${Object.keys(hit).length} mark column(s) found${miss.length ? `. Not found: ${miss.join(", ")}` : ""}.` };
  }

  /* ---------------------------------------------------------------- the grid */
  /** cols: [[id, max, label]]. o: {id, rows, onSave(rows), file, note}. Paste from Excel anywhere; marks above the maximum become the maximum. */
  T.marksGridHtml = function (o) {
    const { cols, rows, id } = o;
    if (!rows.length || rows.some((r) => clean(r.sid) || clean(r.nm)) && !rows.slice(-1).every((r) => !clean(r.sid) && !clean(r.nm))) rows.push(...Array.from({ length: rows.length ? 1 : 10 }, () => ({ sid: "", nm: "", v: {}, pm: {} })));
    const head = `<tr><th style="width:36px">#</th><th style="width:130px">Student ID</th><th style="width:200px">Student name</th>${cols.map(([q, mx, l]) => `<th class="num" style="width:96px">${esc(l || q)}${mx !== null && mx !== undefined && !isNaN(mx) ? ` <span class="muted">(out of ${g2(mx)})</span>` : ""}</th>`).join("")}${o.calc ? `<th class="num" style="width:110px">${esc(o.calc.label)}</th>` : ""}<th style="width:34px"></th></tr>`;
    const body = rows.map((r, i) => `<tr><td class="ro muted">${i + 1}</td>
      <td><input class="cell" data-mg="${id}" data-r="${i}" data-c="sid" data-ref="mg:${id}:${i}:sid" value="${esc(r.sid)}"></td>
      <td><input class="cell" data-mg="${id}" data-r="${i}" data-c="nm" data-ref="mg:${id}:${i}:nm" value="${esc(r.nm)}"></td>
      ${cols.map(([q], j) => `<td><input class="cell num-in ${r.v[q] !== null && r.v[q] !== undefined ? "filled" : ""}" inputmode="decimal" data-mg="${id}" data-r="${i}" data-c="${j}" data-ref="mg:${id}:${i}:${j}" value="${esc(g2(r.v[q]))}"></td>`).join("")}
      ${o.calc ? `<td class="ro num" data-mgcalc="${i}">${esc(g2(o.calc.f(r)))}</td>` : ""}
      <td class="ctr">${clean(r.sid) || clean(r.nm) ? `<button class="x-btn" data-mgx="${id}" data-r="${i}" title="Delete this student">×</button>` : ""}</td></tr>`).join("");
    return `<div class="bp-wrap"><table class="tbl mg-tbl" style="min-width:${400 + (cols.length + (o.calc ? 1 : 0)) * 100}px">${head}<tbody>${body}</tbody></table></div>
      <div class="row-btns"><button class="btn sm" data-mgadd="${id}">+ Add 10 rows</button>
        <details class="sum-box mg-up"><summary>Upload the marks from Excel, or download a sheet to fill</summary>
          <div class="row-btns"><button class="btn sm" data-mgtpl="${id}">Download a sheet to fill (Excel)</button>
          <label class="btn sm"><input type="file" data-mgfile="${id}" accept=".xlsx,.xls,.csv" hidden>Upload the marks (Excel or CSV)</label></div>
          <p class="note">One row per student, with Student ID, Student name and ${cols.length === 1 && cols[0][0] === "TOTAL" ? "a Total column" : `one column per question (${cols.slice(0, 4).map((c) => esc(c[0])).join(", ")}${cols.length > 4 ? " ..." : ""})`}.</p>
          <div data-mgprev="${id}"></div></details></div>
      <p class="note">Paste from Excel: click a cell (for example the first Student ID) and press Ctrl+V. The marks save automatically. A mark above the maximum is changed to the maximum.</p>
      <p class="warn-text" data-mgdup="${id}" hidden></p>`;
  };
  T.marksGridWire = function (host, o) {
    const { cols, rows, id } = o, qids = cols.map((c) => c[0]);
    const capOf = (j) => { const mx = cols[j][1]; return mx !== null && mx !== undefined && !isNaN(mx) && mx > 0 ? mx : null; };
    const setCell = (i, c, val) => {
      while (rows.length <= i) rows.push({ sid: "", nm: "", v: {}, pm: {} });
      const r = rows[i];
      if (c === "sid" || c === "nm") { r[c] = clean(val); return; }
      const j = +c; if (!(j < cols.length)) return;
      let x = num(val); if (x !== null) { x = Math.max(0, x); const cap = capOf(j); if (cap !== null) x = Math.min(x, cap); }
      r.v[qids[j]] = x;
    };
    const dup = () => { const ids = rows.map((r) => clean(r.sid) || clean(r.nm)).filter(Boolean), seen = new Set(), d = new Set(); ids.forEach((x) => (seen.has(x) ? d.add(x) : seen.add(x))); const w = $(`[data-mgdup="${id}"]`, host); if (w) { w.hidden = !d.size; w.textContent = `The same student appears more than once: ${[...d].slice(0, 8).join(", ")}. Keep one row per student.`; } };
    const done = (redraw) => { o.onSave(rows); dup(); if (redraw) o.redraw(); };
    const ORDER = ["sid", "nm", ...cols.map((_, j) => String(j))];
    $$(`[data-mg="${id}"]`, host).forEach((f) => {
      f.onchange = () => { const i = +f.dataset.r, wasNew = !clean(rows[i].sid) && !clean(rows[i].nm); setCell(i, f.dataset.c, f.value); const r = rows[i];
        if (!["sid", "nm"].includes(f.dataset.c)) { const v = r.v[qids[+f.dataset.c]]; f.value = g2(v); f.classList.toggle("filled", v !== null && v !== undefined); const cc = o.calc && $(`[data-mgcalc="${i}"]`, host); if (cc) cc.textContent = g2(o.calc.f(r)); }
        done(wasNew || i === rows.length - 1 || ["sid", "nm"].includes(f.dataset.c) && !clean(r.sid) && !clean(r.nm)); };
      f.addEventListener("paste", (e) => {
        const txt = (e.clipboardData || window.clipboardData).getData("text");
        if (!txt || (!txt.includes("\t") && !/\n./.test(txt.replace(/\r?\n$/, "")))) return;
        e.preventDefault();
        const lines = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
        const i0 = +f.dataset.r, c0 = ORDER.indexOf(f.dataset.c);
        lines.forEach((cells, r) => cells.forEach((v, c) => { const col = ORDER[c0 + c]; if (col !== undefined) setCell(i0 + r, col, v); }));
        T.toast(`Pasted ${lines.length} row(s)`); done(true);
      });
    });
    $$(`[data-mgx="${id}"]`, host).forEach((b) => b.onclick = () => { rows.splice(+b.dataset.r, 1); done(true); });
    const add = $(`[data-mgadd="${id}"]`, host); if (add) add.onclick = () => { for (let k = 0; k < 10; k++) rows.push({ sid: "", nm: "", v: {}, pm: {} }); o.redraw(); };
    const tpl = $(`[data-mgtpl="${id}"]`, host);
    if (tpl) tpl.onclick = async () => {
      await T.importer.lib("xlsx");
      const data = rows.filter((r) => clean(r.sid) || clean(r.nm)).map((r) => Object.assign({ "Student ID": r.sid, "Student name": r.nm }, Object.fromEntries(cols.map(([q]) => [q === "TOTAL" ? "Total" : q, r.v[q] ?? ""]))));
      const ws = data.length ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([["Student ID", "Student name", ...cols.map(([q]) => (q === "TOTAL" ? "Total" : q))]]);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Marks"); XLSX.writeFile(wb, `${o.file || "marks"}.xlsx`.replace(/[^\w.-]+/g, "_"));
    };
    const fi = $(`[data-mgfile="${id}"]`, host), prev = $(`[data-mgprev="${id}"]`, host);
    if (fi) fi.onchange = async () => {
      const f = fi.files[0]; if (!f) return;
      try {
        await T.importer.lib("xlsx");
        const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array" });
        let got = null;
        for (const sh of wb.SheetNames) { got = readUpload(XLSX.utils.sheet_to_json(wb.Sheets[sh], { header: 1, defval: "", raw: true }), cols); if (!got.err) break; }
        if (got.err) { prev.innerHTML = `<p class="warn-text">${esc(got.err)}</p>`; return; }
        prev.innerHTML = `<div class="info-box"><span>${esc(got.note)}</span><button class="btn sm primary" data-mguse="${id}">Use the marks in this file</button></div>
          <div class="bp-wrap"><table class="tbl"><thead><tr><th>Student ID</th><th>Student name</th>${cols.map(([q]) => `<th class="num">${esc(q === "TOTAL" ? "Total" : q)}</th>`).join("")}</tr></thead><tbody>${got.rows.slice(0, 10).map((r) => `<tr><td>${esc(r.sid)}</td><td>${esc(r.nm)}</td>${cols.map(([q]) => `<td class="num">${esc(g2(r.v[q]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        $(`[data-mguse="${id}"]`, prev).onclick = () => {
          rows.length = 0;
          got.rows.forEach((r, i) => { rows.push({ sid: r.sid, nm: r.nm, v: {}, pm: {} }); cols.forEach(([q], j) => setCell(i, String(j), r.v[q])); });
          T.toast(`Marks taken from ${f.name}: ${got.rows.length} students`); done(true);
        };
      } catch (e) { prev.innerHTML = `<p class="warn-text">The file could not be read (${esc(e.message || e)}).</p>`; }
    };
    dup();
  };

  /* ---------------------------------------------------------------- part 2: questions with partial marks */
  const store = (sel, exam) => { const all = ui().ia_partial = ui().ia_partial || {}, k = EK(sel, exam); if (!all[k] || typeof all[k] !== "object") all[k] = {}; return all[k]; };
  /** TAMA's _iap_kpi: (target % of students, student score threshold %) of an outcome. */
  function kpiOf(sel, oid, exam) {
    if (exam) { const ov = (store(sel, exam).kpi || {})[oid]; if (ov && ov.length === 2 && num(ov[0]) !== null && num(ov[1]) !== null) return [num(ov[0]), num(ov[1])]; }
    const cl = tbl("clos").filter((r) => sameC(r, sel)), sl = tbl("slos").filter((r) => sameC(r, sel));
    let row = cl.find((r) => T.s(r.clo_id) === oid), tgt = null;
    if (!row) { const s = sl.find((r) => T.s(r.slo_id) === oid); if (s) { tgt = num(s.target_kpi); const cids = split(s.clo_id); row = cl.find((r) => cids.includes(T.s(r.clo_id))); } }
    let t = row ? num(row.target_pct) : null; if (tgt !== null) t = tgt;
    const y = row ? num(row.kpi_threshold) : null;
    return [t === null ? 70 : t, y === null ? 60 : y];
  }
  function questionsOf(sel, exam) {
    const d = store(sel, exam);
    if (!Array.isArray(d.questions)) {
      d.questions = tbl("questions").filter((q) => sameC(q, sel) && T.s(q.assessment).trim() === exam && T.s(q.question_id).trim() && !ONE01.has(T.s(q.question_type).toUpperCase().replace(/ /g, "")))
        .map((q) => [T.s(q.question_id).trim(), num(q.max_marks), (split(q.slos)[0] || split(q.clos)[0] || "")]);
      S.save();
    }
    return d.questions;
  }
  const usable = (sel, exam) => questionsOf(sel, exam).filter((q) => clean(q[0])).map((q) => [clean(q[0]), num(q[1]), clean(q[2])]);
  /** TAMA's _iap_outcome_results. */
  function outcomeResults(sel, exam) {
    const qs = usable(sel, exam).filter((q) => q[2] && q[1] !== null && q[1] > 0);
    if (!qs.length) return [];
    const m = marksOf(sel, exam).filter((r) => num(r.marks_awarded) !== null);
    const out = [];
    [...new Set(qs.map((q) => q[2]))].forEach((oid) => {
      const qq = qs.filter((q) => q[2] === oid), caps = Object.fromEntries(qq.map((q) => [q[0], q[1]]));
      const mm = m.filter((r) => T.s(r.question_id) in caps); if (!mm.length) return;
      const got = {}; mm.forEach((r) => { const s = T.s(r.student_id); got[s] = (got[s] || 0) + Math.min(Math.max(num(r.marks_awarded), 0), caps[T.s(r.question_id)]); });
      const full = Object.values(caps).reduce((a, b) => a + b, 0);
      const pct = Object.fromEntries(Object.entries(got).map(([s, g]) => [s, g * 100 / full]));
      const [x, y] = kpiOf(sel, oid, exam);
      const n = Object.keys(pct).length, k = Object.values(pct).filter((v) => Math.round(v * 1e6) / 1e6 >= y).length;
      const actual = n ? k * 100 / n : null;
      out.push({ oid, questions: qq.map((q) => q[0]).join(", "), full, x, y, n, k, needed: r1(x * n / 100), actual: actual === null ? null : r1(actual), ach: actual !== null && x ? r1(actual * 100 / x) : null, pct, got });
    });
    return out;
  }
  T.iaPartialResults = function (sel) {   // TAMA's ia_partial_results: for CLO achievement
    const out = [];
    Object.keys(ui().ia_partial || {}).forEach((k) => { const [c, exam] = k.split("||"); if (c !== String(sel) || !exam) return; outcomeResults(sel, exam).forEach((r) => { if (r.actual !== null) out.push({ assessment: exam, slo_id: r.oid, mean_difficulty: (r.k / r.n) }); }); });
    return out;
  };

  const grids = {};
  const later = T.debounce(() => T.refresh("irPart", "irMarks"), 400);   // the KPI, summary and the other grid follow the marks typed
  T.sections.irPart = function () {
    const sel = T.current(), el = $("#sec-irpart"); if (!el) return;
    const exam = T.irParts ? T.s((S.ui.irExam || {})[sel]).trim() : "";
    const kinds = exam ? ((ui().ia_kinds || {})[EK(sel, exam)] || []) : [];
    const on = exam && T.irParts.examsOf(sel).includes(exam) && kinds.includes("partial");
    el.hidden = !on; if (!on) { el.innerHTML = ""; return; }
    const ek = EK(sel, exam), d = store(sel, exam), qs = questionsOf(sel, exam);
    const opts = [...tbl("slos").filter((r) => sameC(r, sel)).map((r) => T.s(r.slo_id)), ...tbl("clos").filter((r) => sameC(r, sel)).map((r) => T.s(r.clo_id))].filter(Boolean);
    const optHtml = (cur) => `<option value="" ${cur ? "" : "selected"}>—</option>${opts.map((o) => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}`;
    const qTable = `<div class="bp-wrap"><table class="tbl ip-q" style="max-width:640px"><thead><tr><th>Question</th><th class="num" style="width:110px">Full mark</th><th style="width:150px">Linked SLO / CLO</th><th style="width:34px"></th></tr></thead><tbody>
      ${qs.map((q, i) => `<tr><td><input class="cell" data-ipq="${i}" data-c="0" data-ref="ipq:${i}:0" value="${esc(q[0])}" placeholder="e.g. Q21, Essay 1, Station 3"></td>
        <td><input class="cell num-in" inputmode="decimal" data-ipq="${i}" data-c="1" data-ref="ipq:${i}:1" value="${esc(g2(num(q[1])))}"></td>
        <td><select class="cell" data-ipq="${i}" data-c="2">${optHtml(T.s(q[2]))}</select></td><td class="ctr"><button class="x-btn" data-ipx="${i}" title="Delete this question">×</button></td></tr>`).join("")}
      <tr><td colspan="4"><button class="btn sm" id="ip-add">+ Add a question</button></td></tr></tbody></table></div>`;
    const use = usable(sel, exam);
    let marksHtml = "", resHtml = "";
    if (use.length) {
      const qids = use.map((q) => q[0]), cols = use.map((q) => [q[0], q[1], q[0]]);
      const g = grids[ek] && grids[ek].sig === qids.join("|") ? grids[ek] : (grids[ek] = Object.assign({ sig: qids.join("|") }, T.marksRows(sel, exam, qids)));
      marksHtml = `<h3 class="qm-h">b) The students' marks in these questions</h3>
        <p class="note">These are the same marks as in Student marks, so you type them once.${g.from ? ` The students come from ${esc(g.from)}; add or delete rows as needed.` : ""}</p>
        ${T.marksGridHtml({ id: "ip", cols, rows: g.rows })}`;
      const res = outcomeResults(sel, exam);
      const stmt = {}; tbl("clos").filter((r) => sameC(r, sel)).forEach((r) => { stmt[T.s(r.clo_id)] = T.s(r.clo_text); }); tbl("slos").filter((r) => sameC(r, sel)).forEach((r) => { stmt[T.s(r.slo_id)] = T.s(r.slo_text); });
      const typ = (cas(sel).find((r) => r.assessment === exam) || {}).type || "";
      const names = {}; marksOf(sel, exam).forEach((r) => { if (clean(r.student_name)) names[T.s(r.student_id)] = clean(r.student_name); });
      resHtml = `<h3 class="qm-h">c) The KPI of each SLO / CLO</h3>` + (!res.length
        ? `<p class="note">The calculation appears when the questions above are linked to an SLO / CLO, have a full mark, and have students' marks.</p>`
        : res.map((r) => { const ids = Object.keys(r.pct);
          return `<div class="ip-card"><div class="ip-left"><h4>${esc(r.oid)}</h4>
            <table class="tbl ip-info"><tbody>${[["Course code", T.baseCode(sel)], ["SLO/CLO no.", r.oid], ["SLO/CLO", stmt[r.oid] || ""], ["Type of Assessment", typ || exam], ["Questions", r.questions], ["Total mark of the Assessment", g2(r.full)]].map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
            <div class="bp-wrap ip-stu"><table class="tbl"><thead><tr><th style="width:40px">no.</th><th>Computer no.</th><th>Name</th><th class="num">Grade</th><th class="num">%</th><th class="ctr">Reached the KPI score</th></tr></thead><tbody>
              ${ids.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s)}</td><td>${esc(names[s] || "")}</td><td class="num">${g2(r.got[s])}</td><td class="num">${g2(r1(r.pct[s]))}</td><td class="ctr">${r1(r.pct[s]) >= r.y ? "✓" : ""}</td></tr>`).join("")}</tbody></table></div></div>
            <div class="ip-right"><b>KPI (pre-set performance indicator)</b>
              <div class="grid g2"><label class="fld filled"><span class="lbl">% of students</span><input type="number" min="0" max="100" step="5" data-ipk="${esc(r.oid)}" data-w="0" value="${g2(r.x)}"></label>
              <label class="fld filled"><span class="lbl">who scored (%) or more</span><input type="number" min="0" max="100" step="5" data-ipk="${esc(r.oid)}" data-w="1" value="${g2(r.y)}"></label></div>
              <table class="tbl ip-info"><tbody>${[["Total No. of students", g2(r.n)], ["Number of students who should achieve the KPI to reach 100% of achievement", `${g2(r.needed)} students`], ["Number of students who got the KPI score", `${r.k} students`], ["% of students who got the KPI score (Achieved KPI - ACTUAL)", `${g2(r.actual)}%`], ["% of KPI Achievement", `${g2(r.ach)}%`]].map(([a, b]) => `<tr><td>${esc(a)}</td><th>${esc(b)}</th></tr>`).join("")}</tbody></table>
              ${r.ach !== null ? (r.ach >= 100 ? `<p class="ok-text">✓ ${esc(r.oid)}: ${g2(r.ach)}% of the KPI achieved (target reached)</p>` : `<p class="warn-text">${esc(r.oid)}: ${g2(r.ach)}% of the KPI achieved (below the target)</p>`) : ""}
              <p class="note">KPI = ${g2(r.x)}% of the students score ${g2(r.y)}% or more. Starts from the CLO's Target % and Student score threshold in Course setup (or the SLO's Target KPI); change it here for this test only.</p></div></div>`; }).join("")
        + `<p class="note">Each student's % = Grade × 100 ÷ Total mark. Achieved KPI = students who scored the KPI score or more × 100 ÷ all students. % of KPI Achievement = Achieved KPI × 100 ÷ the KPI %. The Achieved KPI goes to CLO achievement with the item analysis results.</p>`);
    }
    el.innerHTML = `<div class="sec-head" id="h-irpart"><div><h2>Questions with partial marks</h2><p class="sub">For ${esc(exam)} questions that are not right / wrong (essay, short answer, OSCE station ...): the pre-set KPI "X% of the students score Y% or more" is checked for each SLO / CLO.</p></div></div>
      <h3 class="qm-h">a) Which questions have partial marks?</h3>
      <p class="note">One row per question (or per station / part). Type its full mark and choose the SLO or CLO it measures. Questions from the Exam builder that are not MCQ are listed for you.</p>
      ${qTable}${use.length ? "" : `<p class="note">Add the questions with partial marks in the table above to go on.</p>`}${marksHtml}${resHtml}`;
    const redo = () => T.refresh("irPart");
    $$("[data-ipq]", el).forEach((f) => f.onchange = () => { const q = qs[+f.dataset.ipq], c = +f.dataset.c; q[c] = c === 1 ? num(f.value) : clean(f.value); S.save(); T.toast("Questions saved"); redo(); });
    $$("[data-ipx]", el).forEach((b) => b.onclick = () => { qs.splice(+b.dataset.ipx, 1); S.save(); redo(); });
    $("#ip-add", el).onclick = () => { qs.push(["", null, ""]); S.save(); redo(); };
    $$("[data-ipk]", el).forEach((f) => f.onchange = () => {
      const oid = f.dataset.ipk, cur = kpiOf(sel, oid, exam), v = Math.max(0, Math.min(100, num(f.value) ?? cur[+f.dataset.w]));
      cur[+f.dataset.w] = v; (d.kpi = d.kpi || {})[oid] = cur; S.save(); redo();
    });
    if (use.length) {
      const qids = use.map((q) => q[0]), g = grids[ek];
      T.marksGridWire(el, { id: "ip", cols: use.map((q) => [q[0], q[1], q[0]]), rows: g.rows, file: `partial_marks_${T.baseCode(sel)}_${exam}`,
        onSave: (rows) => { T.marksSave(sel, exam, qids, rows, false); delete grids[`mk|${ek}`]; later(); }, redraw: redo });
    }
  };

  /* ---------------------------------------------------------------- part 3: Student marks (TAMA render_exam_marks, _xm_assessment_list, render_xm_subs) */
  const XM_TOTAL = "TOTAL";
  const SUB_KINDS = { "MCQ (right / wrong)": "mcq", "Partial marks (essay, short answer, OSCE ...)": "partial" };
  const SUB_INV = { mcq: "MCQ (right / wrong)", partial: "Partial marks (essay, short answer, OSCE ...)" };
  const fx = (v) => (v === null || v === undefined ? "" : String(Math.round(v * 100) / 100));
  /** The course's assessments with their full marks: the Mark of the Summative table (Assessment plan) first, as TAMA, then the rest. */
  const cas = (sel) => {
    const old = T.plan && T.plan.courseAssessments ? T.plan.courseAssessments(sel) : [], out = [];
    (T.plan && T.plan.gradingRows ? T.plan.gradingRows(sel) : []).forEach((r) => {
      const a = T.s(r.Assessment).trim(); if (!a || out.some((x) => x.assessment.toUpperCase() === a.toUpperCase())) return;
      const o = old.find((x) => x.assessment.toUpperCase() === a.toUpperCase()) || {};
      out.push({ assessment: a, type: o.type || (T.s(r.Method) === "Test-based assessment" ? "Written exam" : T.s(r.Method)), full_grade: num(r.Mark) !== null ? num(r.Mark) : num(o.full_grade) });
    });
    old.forEach((o) => { if (!out.some((x) => x.assessment.toUpperCase() === T.s(o.assessment).toUpperCase())) out.push(o); });
    return out;
  };
  function fullMarks(sel) { const out = {}; cas(sel).forEach((r) => { if (!(r.assessment in out)) out[r.assessment] = num(r.full_grade); }); return out; }
  function marked(sel) {
    const out = {};
    tbl("marks").filter((r) => sameC(r, sel) && num(r.marks_awarded) !== null).forEach((r) => { out[T.s(r.assessment).trim()] = "Entered here"; });
    const rec = (S.data.mark_sheets || {})[String(sel)];
    if (rec && rec.map && Array.isArray(rec.rows)) Object.entries(rec.map).forEach(([col, name]) => { name = T.s(name).trim(); if (name && !out[name] && rec.rows.some((r) => r.marks && r.marks[col] !== null && r.marks[col] !== undefined)) out[name] = "Course mark sheet"; });
    return out;
  }
  const partsOf = (sel, exam) => ((ui().xm_parts || {})[EK(sel, exam)] || []);
  function subRows(sel) {
    const all = ui().xm_sub_rows || {};
    if (!(String(sel) in all)) {
      const rows = [];
      Object.entries(ui().xm_parts || {}).forEach(([ek, parts]) => { const [c, ex] = ek.split("||"); if (c === String(sel)) (parts || []).forEach((p) => rows.push({ Assessment: ex, "Sub-category": T.s(p.part), Type: SUB_INV[p.kind] || "", Mark: p.mark === null || p.mark === undefined ? "" : fx(p.mark) })); });
      return rows;
    }
    return (all[String(sel)] || []).filter((r) => r && typeof r === "object").map((r) => ({ Assessment: clean(r.Assessment), "Sub-category": clean(r["Sub-category"]), Type: clean(r.Type), Mark: clean(r.Mark) }));
  }
  /** TAMA's _xm_sub_store: keep the rows as typed; an assessment's parts go to xm_parts (and Step 2) only when complete and equal to its full mark. */
  function subStore(sel, rows) {
    (ui().xm_sub_rows = ui().xm_sub_rows || {})[String(sel)] = rows;
    const allp = ui().xm_parts = ui().xm_parts || {}, old = {};
    Object.keys(allp).forEach((k) => { if (k.split("||")[0] === String(sel)) old[k] = allp[k]; });
    const full = fullMarks(sel), neu = {};
    [...new Set(rows.map((r) => r.Assessment).filter(Boolean))].forEach((a) => {
      const parts = rows.filter((r) => r.Assessment === a), ms = parts.map((r) => num(r.Mark));
      if (full[a] !== null && full[a] !== undefined && parts.every((r) => r["Sub-category"]) && ms.every((m) => m !== null && m >= 0) && Math.abs(ms.reduce((x, y) => x + y, 0) - full[a]) < 0.01)
        neu[EK(sel, a)] = parts.map((r, i) => ({ part: r["Sub-category"], kind: SUB_KINDS[r.Type] || "", mark: ms[i] }));
    });
    Object.keys(old).forEach((k) => delete allp[k]); Object.assign(allp, neu);
    const kinds = ui().ia_kinds = ui().ia_kinds || {};
    const kOf = (ps) => ["mcq", "partial"].filter((k) => (ps || []).some((p) => p.kind === k));
    new Set([...Object.keys(old), ...Object.keys(neu)]).forEach((ek) => {
      if (JSON.stringify(old[ek]) === JSON.stringify(neu[ek])) return;
      const k = kOf(neu[ek]), ok = kOf(old[ek]);
      if (k.length) kinds[ek] = k; else if (ok.length && JSON.stringify(kinds[ek]) === JSON.stringify(ok)) delete kinds[ek];
    });
    S.save();
  }
  function subsHtml(sel) {
    const mains = cas(sel).map((r) => r.assessment).filter(Boolean), full = fullMarks(sel), rows = subRows(sel);
    const tot = (() => { const g = T.plan && T.plan.crStore ? num(((T.plan.crStore(sel) || {}).grading_cfg || {}).total) : null; return g || Object.values(full).reduce((a, b) => a + (b || 0), 0); })();
    const opts = [...new Set([...mains, ...rows.map((r) => r.Assessment).filter(Boolean)])];
    const sel1 = (cur, list, attr, i) => `<select class="cell" ${attr}="${i}"><option value="" ${cur ? "" : "selected"}>${attr === "data-xsa" ? "Choose" : ""}</option>${list.map((o) => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    const msgs = [];
    [...new Set(rows.map((r) => r.Assessment))].forEach((a) => {
      const parts = rows.filter((r) => r.Assessment === a), w = (t) => `<span class="warn-text inline">${t}</span>`;
      if (!a) { msgs.push(w(`Pick the main assessment for: ${parts.map((r) => esc(r["Sub-category"] || "(no name)")).join(", ")}`)); return; }
      const A = `<b>${esc(a)}</b>`;
      if (!(a in full)) { msgs.push(w(`${A} is not in the Assessment plan any more (pick another assessment or delete its rows)`)); return; }
      const bad = parts.filter((r) => num(r.Mark) === null || num(r.Mark) < 0);
      if (bad.length) { msgs.push(w(`${A}: type a mark (a number, 0 or more) for ${bad.map((r) => esc(r["Sub-category"] || "(no name)")).join(", ")}`)); return; }
      if (parts.some((r) => !r["Sub-category"])) { msgs.push(w(`${A}: type the name of every sub-category`)); return; }
      const sm = parts.reduce((x, r) => x + num(r.Mark), 0), M = full[a], lab = `${A}: ${parts.length} sub-categor${parts.length !== 1 ? "ies" : "y"}, ${fx(sm)}`;
      if (M === null || M === undefined) msgs.push(`${lab} marks ${w("type the mark of this assessment in Assessment plan")}`);
      else if (Math.abs(sm - M) > 0.01) msgs.push(`${lab} of ${fx(M)} marks ${w(`the sub-categories should add up to ${fx(M)} (${sm < M ? "add" : "remove"} ${fx(Math.abs(M - sm))} marks)`)}`);
      else msgs.push(`${lab} of ${fx(M)} marks <span class="ok-text">✓</span>`);
    });
    return `<details class="sum-box" ${S.ui.xmSubOpen ? "open" : ""} id="xs-box"><summary>Sub-categories of the assessments (optional)</summary>
      <p class="note">Split any assessment into sub-categories, each with its own mark (e.g. Portfolio → Written report 12, Oral defence 8). Type each mark as a number or as a percentage of the assessment (e.g. 40%). The marks of the sub-categories must add up to the full mark of the assessment (from Assessment plan). The marks of each sub-category are then entered separately below. For a test, the type of questions is used in Step 2 above. Saved by itself.</p>
      ${mains.length ? `<div class="bp-wrap"><table class="tbl xs-tbl"><thead><tr><th>Main assessment</th><th>Sub-category</th><th>Type of questions</th><th class="num" style="width:90px">Mark <i class="hint" title="Type the mark (e.g. 4) or the percentage of the assessment (e.g. 40%).">?</i></th><th class="num" style="width:100px">% of the assessment</th><th class="num" style="width:110px">Weight (calculated)</th><th style="width:34px"></th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td>${sel1(r.Assessment, opts, "data-xsa", i)}</td><td><input class="cell" data-xs="${i}" data-c="Sub-category" data-ref="xs:${i}:s" value="${esc(r["Sub-category"])}" placeholder="e.g. Written report, MCQ part"></td>
          <td>${sel1(r.Type, Object.keys(SUB_KINDS), "data-xst", i)}</td><td><input class="cell num-in" inputmode="decimal" data-xs="${i}" data-c="Mark" data-ref="xs:${i}:m" value="${esc(r.Mark)}"></td>
          <td class="ro num">${num(r.Mark) !== null && full[r.Assessment] ? `${fx(num(r.Mark) / full[r.Assessment] * 100)}%` : ""}</td>
          <td class="ro num">${num(r.Mark) !== null && tot ? `${fx(num(r.Mark) / tot * 100)}%` : ""}</td><td class="ctr"><button class="x-btn" data-xsx="${i}" title="Delete this row">×</button></td></tr>`).join("")}
        <tr><td colspan="7"><button class="btn sm" id="xs-add">+ Add a sub-category</button></td></tr></tbody></table></div>
        ${msgs.length ? `<div class="xs-msgs">${msgs.join("<br>")}</div>` : ""}` : `<p class="note">Type the assessments in the Assessment plan first; then you can split them into sub-categories here.</p>`}</details>`;
  }
  function wireSubs(sel, el) {
    const rows = subRows(sel), redo = () => T.refresh("irTest", "irMcq", "irPart", "irMarks");
    const box = $("#xs-box", el); if (box) box.ontoggle = () => { S.ui.xmSubOpen = box.open; S.saveUi(); };
    const put = () => { subStore(sel, rows); redo(); };
    $$("[data-xsa]", el).forEach((s) => s.onchange = () => { rows[+s.dataset.xsa].Assessment = s.value; put(); });
    $$("[data-xst]", el).forEach((s) => s.onchange = () => { rows[+s.dataset.xst].Type = s.value; put(); });
    $$("[data-xs]", el).forEach((f) => f.onchange = () => { let v = clean(f.value); if (f.dataset.c === "Sub-category" && v) v = v[0].toUpperCase() + v.slice(1); const r = rows[+f.dataset.xs];
      if (f.dataset.c === "Mark" && /%\s*$/.test(v)) { const fm = fullMarks(sel)[r.Assessment], pc = num(v.replace("%", "")); if (fm && pc !== null) v = fx(fm * pc / 100); else { T.toast("Choose the main assessment (with its full mark) first, then type the percentage."); v = ""; } }
      r[f.dataset.c] = v; put(); });
    $$("[data-xsx]", el).forEach((b) => b.onclick = () => { rows.splice(+b.dataset.xsx, 1); put(); });
    const add = $("#xs-add", el); if (add) add.onclick = () => { rows.push({ Assessment: "", "Sub-category": "", Type: "", Mark: "" }); (ui().xm_sub_rows = ui().xm_sub_rows || {})[String(sel)] = rows; S.save(); redo(); };
  }
  const natKey = (s) => T.s(s).split(/(\d+)/).map((p, i) => (i % 2 ? p.padStart(8, "0") : p.toLowerCase())).join("");
  function examQuestions(sel, exam) {
    const seen = new Set(), out = [];
    tbl("questions").filter((q) => sameC(q, sel) && T.s(q.assessment).trim() === exam && T.s(q.question_id).trim()).forEach((q) => { const id = T.s(q.question_id).trim(); if (!seen.has(id)) { seen.add(id); out.push([id, num(q.max_marks), q]); } });
    return out.sort((a, b) => (natKey(a[0]) < natKey(b[0]) ? -1 : 1));
  }
  /** "These marks by CLO": TAMA's grade_results for one test (question links, or the Assessment plan ticks for a total mark). */
  function byClo(sel, exam, mode, full) {
    const m = marksOf(sel, exam).filter((r) => num(r.marks_awarded) !== null), out = {};
    if (mode === "q") {
      const qs = {}; examQuestions(sel, exam).forEach(([id, mx, q]) => { qs[id] = { mx, ids: split(q.clos) }; });
      const per = {};
      m.forEach((r) => { const q = qs[T.s(r.question_id)]; if (!q || q.mx === null) return; const got = Math.min(Math.max(num(r.marks_awarded), 0), q.mx);
        q.ids.forEach((c) => { const k = `${c}||${T.s(r.student_id)}`; per[k] = per[k] || [0, 0]; per[k][0] += got; per[k][1] += q.mx; }); });
      Object.entries(per).forEach(([k, [g, mx]]) => { const c = k.split("||")[0]; if (mx > 0) (out[c] = out[c] || []).push(g / mx); });
    } else if (full > 0) {
      const tot = m.filter((r) => T.s(r.question_id).toUpperCase() === XM_TOTAL).map((r) => Math.min(Math.max(num(r.marks_awarded), 0), full) / full);
      if (tot.length) tbl("clo_plan").filter((r) => sameC(r, sel)).forEach((r) => { if (split(T.s(r.assessment_methods).replace(/;/g, ",")).map((x) => x.toLowerCase()).includes(exam.toLowerCase())) out[T.s(r.clo_id)] = tot; });
    }
    return Object.keys(out).sort((a, b) => (natKey(a) < natKey(b) ? -1 : 1)).map((c) => [c, r1(out[c].reduce((x, y) => x + y, 0) / out[c].length * 100)]);
  }

  T.sections.irMarks = function () {
    const sel = T.current(), el = $("#sec-irmk"); if (!el) return;
    const exam = T.s((S.ui.irExam || {})[sel]).trim(), ok = exam && T.irParts.examsOf(sel).includes(exam);
    const ca = cas(sel), done = marked(sel), full = fullMarks(sel);
    const hasSub = ca.some((r) => partsOf(sel, r.assessment).length);
    const list = ca.length ? `<div class="bp-wrap"><table class="tbl" style="max-width:820px"><thead><tr><th>Assessment</th><th>Type</th><th class="num">Full mark</th>${hasSub ? '<th class="num">Sub-category mark</th>' : ""}<th>Student marks</th></tr></thead><tbody>
      ${ca.map((r) => `<tr><td><b>${esc(r.assessment)}</b></td><td>${esc(r.type || "")}</td><td class="num">${num(r.full_grade) === null ? "-" : fx(num(r.full_grade))}</td>${hasSub ? "<td></td>" : ""}<td>${done[r.assessment] ? `<span class="ok-text">✓ ${esc(done[r.assessment])}</span>` : `<span class="muted">Not yet</span>`}</td></tr>`
        + partsOf(sel, r.assessment).map((p) => `<tr class="sub-row"><td>&nbsp;&nbsp;↳ ${esc(p.part)}</td><td>${esc(SUB_INV[p.kind] || "")}</td><td></td><td class="num">${fx(p.mark)}</td><td></td></tr>`).join("")).join("")}</tbody></table></div>` : "";
    const missing = ca.map((r) => r.assessment).filter((a) => !done[a]), noFull = ca.filter((r) => num(r.full_grade) === null).map((r) => r.assessment);
    let body = `<p class="note">Choose the test in <b>Step 1</b> at the top of the page to enter its student marks.</p>`;
    if (ok) {
      const ek = EK(sel, exam), qs = examQuestions(sel, exam), cur = marksOf(sel, exam);
      const isTot = (r) => T.s(r.question_id).toUpperCase() === XM_TOTAL;
      const MODES = [["q", "Mark of each question"], ["total", "Total mark of the test only"]];
      let mode = "total";
      if (qs.length) { const xm = ui().xm_mode = ui().xm_mode || {}; const pn = new Set(partsOf(sel, exam).map((p) => T.s(p.part))); mode = xm[ek] || (cur.some(isTot) && !cur.some((r) => !isTot(r) && !pn.has(T.s(r.question_id))) ? "total" : "q"); if (xm[ek] !== mode) { xm[ek] = mode; S.save(); } }
      const fullT = mode === "q" ? qs.reduce((a, q) => a + (q[1] || 0), 0) : (full[exam] || 0);
      const parts = mode === "total" ? partsOf(sel, exam).filter((p) => p.part && num(p.mark) !== null) : [], byParts = parts.length > 0;
      const ppt = ((ui().xm_paper_parts = ui().xm_paper_parts || {})[ek]) || {};
      const paperOf = (p) => (num(ppt[p.part]) > 0 ? num(ppt[p.part]) : num(p.mark));
      const convPart = (p, v) => (v === null || v === undefined ? null : paperOf(p) > 0 ? Math.round(Math.min(Math.max(v, 0), paperOf(p)) * num(p.mark) / paperOf(p) * 100) / 100 : v);
      const partsSum = (r) => { let t = null; parts.forEach((p) => { const c = convPart(p, r.v[p.part]); if (c !== null) t = (t || 0) + c; }); return t === null ? null : Math.round(t * 100) / 100; };
      const paper = mode === "total" && !byParts ? (num((ui().xm_paper || {})[ek]) || 0) : 0, usePaper = mode === "total" && !byParts && paper > 0 && fullT > 0;
      const partNames = new Set(partsOf(sel, exam).map((p) => T.s(p.part))), isTotLike = (r) => isTot(r) || partNames.has(T.s(r.question_id));
      const other = cur.filter((r) => (mode === "q" ? isTotLike(r) : !isTotLike(r)) && num(r.marks_awarded) !== null);
      const qids = mode === "q" ? qs.map((q) => q[0]) : byParts ? [...parts.map((p) => p.part), XM_TOTAL] : [XM_TOTAL];
      const cols = mode === "q" ? qs.map((q) => [q[0], q[1], q[0]]) : byParts ? parts.map((p) => [p.part, paperOf(p), paperOf(p) !== num(p.mark) ? `${p.part} on the paper` : p.part]) : [[XM_TOTAL, usePaper ? paper : (fullT > 0 ? fullT : null), usePaper ? "Mark on the paper" : "Total mark"]];
      const sig = `${mode}|${paper}|${fullT}|${qids.join("|")}|${JSON.stringify(parts)}|${JSON.stringify(ppt)}`;
      let g = grids[`mk|${ek}`];
      if (!g || g.sig !== sig) {
        const r = T.marksRows(sel, exam, qids);
        if (!r.rows.length) { const rec = (S.data.mark_sheets || {})[String(sel)]; if (rec && Array.isArray(rec.rows)) { r.rows = rec.rows.filter((x) => !x.withdrawn).map((x) => ({ sid: T.s(x.computer_no), nm: T.s(x.name), v: {}, pm: {} })).filter((x) => x.sid || x.nm); if (r.rows.length) r.from = "the course mark sheet"; } }
        if (byParts) r.rows.forEach((x) => { parts.forEach((p) => { const t = x.v[p.part]; x.v[p.part] = x.pm[p.part] !== undefined && x.pm[p.part] !== null ? x.pm[p.part] : (t === null || t === undefined ? null : Math.round(t * paperOf(p) / num(p.mark) * 100) / 100); }); x.v[XM_TOTAL] = undefined; });
        if (usePaper) r.rows.forEach((x) => { const t = x.v[XM_TOTAL]; x.v[XM_TOTAL] = x.pm[XM_TOTAL] !== undefined && x.pm[XM_TOTAL] !== null ? x.pm[XM_TOTAL] : (t === null || t === undefined ? null : Math.round(t * paper / fullT * 100) / 100); });
        g = grids[`mk|${ek}`] = Object.assign({ sig }, r);
      }
      const conv = (pm) => (pm === null || pm === undefined ? null : Math.round(Math.min(Math.max(pm, 0), paper) * fullT / paper * 100) / 100);
      // summary of the saved marks
      const long = marksOf(sel, exam).filter((r) => (byParts ? [XM_TOTAL] : qids).includes(T.s(r.question_id)) && num(r.marks_awarded) !== null);
      const caps = byParts ? { [XM_TOTAL]: fullT } : Object.fromEntries(cols.map((c) => [c[0], mode === "q" ? c[1] : fullT]));
      const totBy = {}, clipBy = {};
      long.forEach((r) => { const s = T.s(r.student_id), v = num(r.marks_awarded), cap = caps[T.s(r.question_id)]; totBy[s] = (totBy[s] || 0) + v; clipBy[s] = (clipBy[s] || 0) + Math.min(Math.max(v, 0), cap === null || cap === undefined ? v : cap); });
      const nS = Object.keys(totBy).length, avg = nS ? Object.values(totBy).reduce((a, b) => a + b, 0) / nS : null, avgP = nS && fullT > 0 ? Object.values(clipBy).reduce((a, b) => a + b, 0) / nS / fullT * 100 : null;
      const clo = byClo(sel, exam, mode, fullT), cloIds = tbl("clos").filter((r) => sameC(r, sel)).length;
      body = `<h3 class="qm-h">Student marks in ${esc(exam)}</h3>
        ${qs.length ? `<div class="fld"><span class="lbl">How do you want to enter the marks? <i class="hint" title="Each question: the CLOs and SLOs of each question come from the Exam builder. Total only: the CLOs and SLOs come from the ticks on the Assessment plan page.">?</i></span>
          <div class="seg">${MODES.map(([v, l]) => `<button class="${mode === v ? "on" : ""}" data-xmm="${v}">${l}</button>`).join("")}</div></div>`
          : `<p class="note">${esc(exam)} has no questions in the Exam builder, so you enter ${byParts ? "the mark of each sub-category" : "one total mark"} per student. To enter the mark of each question, add its questions in Blueprint and Exam builder first.</p>`}
        ${mode === "q" ? `<p class="note">The CLOs and SLOs of each question come from the Exam builder.</p>`
          : `<div class="grid g3"><div class="kcard bp-actual"><div class="lab">Full mark of this test</div><div class="big">${fullT > 0 ? fx(fullT) : "-"}</div></div>
            ${byParts ? "" : `<label class="fld ${paper ? "filled" : ""}" for="xm-paper"><span class="lbl">Total mark on the paper <i class="hint" title="If the test was corrected out of another total (e.g. 65), type it here. You then type each student's mark on the paper and it is converted to the full mark (mark × full mark ÷ paper total). Leave 0 if not.">?</i></span><input type="text" inputmode="decimal" id="xm-paper" value="${esc(fx(paper))}"></label>`}</div>
            ${byParts ? `<h3 class="qm-h">Marks of each sub-category</h3><p class="note">${esc(exam)} has sub-categories, so each one gets its own column below. If a sub-category was marked on the paper out of another number, type that number; the mark is converted to its allocated mark (mark on the paper × allocated mark ÷ total on the paper).</p>
              <div class="bp-wrap"><table class="tbl" style="max-width:760px"><thead><tr><th>Sub-category</th><th class="num">Allocated mark</th><th class="num">% of the test</th><th class="num" style="width:140px">Total on the paper</th><th class="num">Conversion factor</th></tr></thead><tbody>
              ${parts.map((p) => `<tr><td><b>${esc(p.part)}</b></td><td class="num">${fx(num(p.mark))}</td><td class="num">${fullT > 0 ? `${fx(num(p.mark) / fullT * 100)}%` : ""}</td>
                <td><input class="cell num-in ${num(ppt[p.part]) > 0 ? "filled" : ""}" inputmode="decimal" data-xpp="${esc(p.part)}" data-ref="xpp:${esc(p.part)}" value="${esc(num(ppt[p.part]) > 0 ? fx(num(ppt[p.part])) : "")}" placeholder="${esc(fx(num(p.mark)))}"></td>
                <td class="num">${paperOf(p) > 0 ? +(num(p.mark) / paperOf(p)).toFixed(4) : ""}</td></tr>`).join("")}</tbody></table></div>
              <p class="note">The allocated marks come from the sub-categories table above (as a mark or a % of the test). Leave "Total on the paper" empty when the paper was marked out of the allocated mark.</p>` : ""}
            ${fullT > 0 ? "" : `<p class="warn-text">${esc(exam)} has no mark yet. Type it in <b>Assessment plan &gt; Summative assessment</b> first.</p>`}
            ${usePaper ? `<p class="note">Conversion factor (<bdi>معامل التحويل</bdi>) = ${fx(fullT)} ÷ ${fx(paper)} = ${+(fullT / paper).toFixed(4)}. Type the <b>Mark on the paper</b> (out of ${fx(paper)}); the <b>Total mark</b> (out of ${fx(fullT)}) is worked out.</p>` : ""}
            <p class="note">The full mark comes from the Assessment plan (change it there). The CLOs and SLOs this test counts for come from the ticks on the <b>Assessment plan</b> page.</p>`}
        ${other.length ? `<p class="warn-text">${esc(exam)} already has marks entered as <b>${mode === "q" ? MODES[1][1] : MODES[0][1]}</b> (${new Set(other.map((r) => T.s(r.student_id))).size} students). They will be replaced as soon as you type marks here.</p>` : ""}
        ${g.from ? `<p class="note">The ${g.rows.length} students come from ${esc(g.from)}. Add or delete rows as needed.</p>` : ""}
        ${T.marksGridHtml({ id: "xm", cols, rows: g.rows, calc: usePaper ? { label: `Total mark (out of ${fx(fullT)})`, f: (r) => conv(r.v[XM_TOTAL]) } : byParts ? { label: `Total mark (out of ${fx(fullT)})`, f: partsSum } : null })}
        ${nS && fullT > 0 ? `<div class="kcards">${[["Students with marks", nS], ["Average mark", `${fx(avg)} <small>/ ${fx(fullT)}</small>`], ["Average (%)", `${fx(avgP)}%`]].map(([l, v]) => `<div class="kcard"><div class="lab">${l}</div><div class="big">${v}</div></div>`).join("")}</div>
          ${clo.length ? `<h3 class="qm-h">These marks by CLO</h3><div class="bp-wrap"><table class="tbl" style="max-width:420px"><thead><tr><th>CLO</th><th class="num">Average share of the marks (%)</th></tr></thead><tbody>${clo.map(([c, v]) => `<tr><td><b>${esc(c)}</b></td><td class="num">${fx(v)}</td></tr>`).join("")}</tbody></table></div>`
            : cloIds ? `<div class="info-box"><span>No CLO is linked to these marks yet. ${mode === "q" ? "Link the questions to CLOs in the Exam builder." : `Tick <b>${esc(exam)}</b> for its CLOs on the Assessment plan page.`}</span></div>` : ""}` : ""}`;
      el.innerHTML = head() + body;
      $$("[data-xmm]", el).forEach((b) => b.onclick = () => { ui().xm_mode[ek] = b.dataset.xmm; S.save(); T.refresh("irMarks"); });
      $$("[data-xpp]", el).forEach((f) => f.onchange = () => { const all = ui().xm_paper_parts = ui().xm_paper_parts || {}, o = all[ek] = all[ek] || {}, v = num(f.value); if (v && v > 0) o[f.dataset.xpp] = v; else o[f.dataset.xpp] = undefined; S.save(); T.refresh("irMarks"); });
      const pp = $("#xm-paper", el); if (pp) pp.onchange = () => { (ui().xm_paper = ui().xm_paper || {})[ek] = Math.max(0, num(pp.value) || 0); S.save(); T.refresh("irMarks"); };
      T.marksGridWire(el, { id: "xm", cols, rows: g.rows, file: `marks_${T.baseCode(sel)}_${exam}`, calc: usePaper ? { f: (r) => conv(r.v[XM_TOTAL]) } : byParts ? { f: partsSum } : null,
        onSave: (rows) => { T.marksSave(sel, exam, qids, byParts ? rows.map((r) => { const v = {}, pm = {}; parts.forEach((p) => { v[p.part] = convPart(p, r.v[p.part]); if (r.v[p.part] !== null && r.v[p.part] !== undefined) pm[p.part] = r.v[p.part]; }); v[XM_TOTAL] = partsSum(r); return { sid: r.sid, nm: r.nm, v, pm }; }) : usePaper ? rows.map((r) => ({ sid: r.sid, nm: r.nm, v: { [XM_TOTAL]: conv(r.v[XM_TOTAL]) }, pm: { [XM_TOTAL]: r.v[XM_TOTAL] } })) : rows, true); delete grids[ek]; later(); },
        redraw: () => T.refresh("irMarks") });
      wireSubs(sel, el);
      return;
    }
    el.innerHTML = head() + body; wireSubs(sel, el);
    function head() {
      return `<div class="sec-head" id="h-irmk"><div><h2>Student marks</h2><p class="sub">A second way to measure CLO achievement: from the marks the students got, instead of the difficulty factor. The results show on the CLO achievement page in the student grades columns.</p></div></div>
        <h3 class="qm-h">Assessments of this course</h3><p class="note">All the assessments of the course and the full mark of each. The full marks come from the Assessment plan (change them there).</p>
        ${list}${ca.length && missing.length ? `<p class="warn-text"><b>${missing.length} of ${ca.length} assessments have no student marks yet:</b> ${missing.map(esc).join(", ")}. Choose one in Step 1 at the top of the page to enter its marks.</p>` : ca.length ? `<p class="ok-text">✓ Every assessment of ${esc(T.baseCode(sel))} has student marks.</p>` : `<p class="note">No assessments yet. Add them in the Assessment plan.</p>`}
        ${noFull.length ? `<p class="note">No full mark yet for: ${noFull.map(esc).join(", ")}.</p>` : ""}${subsHtml(sel)}`;
    }
  };

  T.marksParts = { readUpload, outcomeResults, kpiOf };
})();
