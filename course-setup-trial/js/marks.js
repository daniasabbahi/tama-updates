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
    const head = `<tr><th style="width:36px">#</th><th style="width:130px">Student ID</th><th style="width:200px">Student name</th>${cols.map(([q, mx, l]) => `<th class="num" style="width:96px">${esc(l || q)}${mx !== null && mx !== undefined && !isNaN(mx) ? ` <span class="muted">(out of ${g2(mx)})</span>` : ""}</th>`).join("")}<th style="width:34px"></th></tr>`;
    const body = rows.map((r, i) => `<tr><td class="ro muted">${i + 1}</td>
      <td><input class="cell" data-mg="${id}" data-r="${i}" data-c="sid" data-ref="mg:${id}:${i}:sid" value="${esc(r.sid)}"></td>
      <td><input class="cell" data-mg="${id}" data-r="${i}" data-c="nm" data-ref="mg:${id}:${i}:nm" value="${esc(r.nm)}"></td>
      ${cols.map(([q], j) => `<td><input class="cell num-in ${r.v[q] !== null && r.v[q] !== undefined ? "filled" : ""}" inputmode="decimal" data-mg="${id}" data-r="${i}" data-c="${j}" data-ref="mg:${id}:${i}:${j}" value="${esc(g2(r.v[q]))}"></td>`).join("")}
      <td class="ctr">${clean(r.sid) || clean(r.nm) ? `<button class="x-btn" data-mgx="${id}" data-r="${i}" title="Delete this student">×</button>` : ""}</td></tr>`).join("");
    return `<div class="bp-wrap"><table class="tbl mg-tbl" style="min-width:${400 + cols.length * 96}px">${head}<tbody>${body}</tbody></table></div>
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
        if (!["sid", "nm"].includes(f.dataset.c)) { const v = r.v[qids[+f.dataset.c]]; f.value = g2(v); f.classList.toggle("filled", v !== null && v !== undefined); }
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
      const typ = ((T.plan && T.plan.courseAssessments ? T.plan.courseAssessments(sel) : []).find((r) => r.assessment === exam) || {}).type || "";
      const names = {}; marksOf(sel, exam).forEach((r) => { if (clean(r.student_name)) names[T.s(r.student_id)] = clean(r.student_name); });
      resHtml = `<h3 class="qm-h">c) The KPI of each SLO / CLO <span class="muted" style="font-weight:400">(as in the Excel sheet "تحديد مؤشر الآداء")</span></h3>` + (!res.length
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
        onSave: (rows) => { T.marksSave(sel, exam, qids, rows, false); }, redraw: redo });
    }
  };
  T.marksParts = { readUpload, outcomeResults, kpiOf };
})();
