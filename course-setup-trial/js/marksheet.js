/* Course mark sheet (TAMA's "Course mark sheet" page: render_mark_sheet_dashboard + render_grades_for_report), rebuilt (Dania 2026-11-22).
   The sheet collects every assessment of the course from the Student marks page (one column per assessment), or shows an uploaded
   faculty mark sheet as old TAMA did. Withdrawn / denied-entry students, discipline of postgraduate students, statistics and charts.
   Keys: mark_sheets[course] = the uploaded sheet (TAMA shape, unchanged); ui_settings.ms_source[course] = "marks" | "upload";
   ui_settings.ms_status[course][student] = "W" | "DN" | "A" ("A" keeps a student whose marks are all 0 in the averages);
   ui_settings.ms_disc[course][student] = discipline; ui_settings.ms_postgrad[course]; ui_settings.ms_pass[course] (% of the final mark);
   ui_settings.ms_scale[course] = [[letter, minimum %]]; course_report[course].in_progress / incomplete / grade_comment (as TAMA). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const ui = () => (S.data.ui_settings = S.data.ui_settings || {});
  const sub = (k, sel) => { const a = (ui()[k] = ui()[k] && typeof ui()[k] === "object" ? ui()[k] : {}); if (sel === undefined) return a; return (a[sel] = a[sel] && typeof a[sel] === "object" ? a[sel] : {}); };
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").trim()); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const clean = (v) => { const s = T.s(v).trim(); return ["nan", "none"].includes(s.toLowerCase()) ? "" : s; };
  const MP = () => T.marksParts;
  const SCALE0 = [["A+", 95], ["A", 90], ["B+", 85], ["B", 80], ["C+", 75], ["C", 70], ["D+", 65], ["D", 60], ["F", 0]];
  const LETTER_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F", "DN"], CR_GRADES = LETTER_ORDER.slice(0, 9);
  const COL = { M: "#14365d", F: "#8a5d80", T: "#5c8f6b" };
  const GL = { M: "Male", F: "Female", T: "All students" };
  const scaleOf = (sel) => { const s = (ui().ms_scale || {})[sel]; return (Array.isArray(s) && s.length ? s : SCALE0).map(([l, m]) => [T.s(l), num(m) || 0]).sort((a, b) => b[1] - a[1]); };
  const letterOf = (sel, pct) => { if (pct === null || pct === undefined || isNaN(pct)) return ""; const s = scaleOf(sel); for (const [l, m] of s) if (pct >= m - 1e-9) return l; return s[s.length - 1][0]; };
  const courseRow = (sel) => S.t("courses").find((r) => String(r.course_code) === String(sel)) || {};
  const isPG = (sel) => { const v = (ui().ms_postgrad || {})[sel]; return v !== undefined ? !!v : /master|doctor|ph\.?d|ماجستير|دكتوراه/i.test(T.s(courseRow(sel).program)); };
  const sourceOf = (sel) => { const v = (ui().ms_source || {})[sel]; return v === "upload" || v === "marks" ? v : (S.data.mark_sheets || {})[String(sel)] ? "upload" : "marks"; };
  const stats = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length, m = s.reduce((x, y) => x + y, 0) / n;
    return { n, mean: m, median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, sd: Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / n), min: s[0], max: s[n - 1] }; };

  /* ---------------------------------------------------------------- the sheet built from Student marks */
  function buildFromMarks(sel) {
    const ca = MP().cas(sel).filter((r) => T.s(r.assessment).trim()), max = {};
    ca.forEach((r) => { if (!(r.assessment in max)) max[r.assessment] = num(r.full_grade); });
    const byA = {}, names = {};
    tbl("marks").filter((r) => String(r.course_code) === String(sel) && num(r.marks_awarded) !== null).forEach((r) => {
      const a = T.s(r.assessment).trim(), s = T.s(r.student_id).trim(); if (!a || !s) return;
      if (clean(r.student_name)) names[s] = clean(r.student_name);
      const parts = new Set(MP().partsOf(sel, a).map((p) => T.s(p.part)));
      const o = ((byA[a] = byA[a] || {})[s] = byA[a][s] || { tot: null, q: null });
      if (T.s(r.question_id).toUpperCase() === "TOTAL") o.tot = num(r.marks_awarded);
      else if (!parts.has(T.s(r.question_id))) o.q = (o.q || 0) + Math.max(0, num(r.marks_awarded));
    });
    Object.keys(byA).forEach((a) => { if (!(a in max)) { const qs = MP().examQuestions(sel, a); const t = qs.reduce((x, q) => x + (q[1] || 0), 0); max[a] = t > 0 ? t : null; } });
    const cols = Object.keys(max), seen = new Set(), studs = [];
    T.classList(sel).list.forEach((r) => { const k = r.sid || r.nm; if (!k || seen.has(k)) return; seen.add(k); studs.push({ sid: r.sid, nm: r.nm, gn: r.gn }); });
    const extra = []; Object.values(byA).forEach((o) => Object.keys(o).forEach((s) => { if (!seen.has(s)) { seen.add(s); extra.push({ sid: s, nm: names[s] || "", gn: "" }); } }));
    extra.sort((a, b) => a.sid.localeCompare(b.sid, undefined, { numeric: true })); studs.push(...extra);
    const gm = MP().genderMap(sel), st = (ui().ms_status || {})[sel] || {}, dc = (ui().ms_disc || {})[sel] || {};
    const fmax = cols.reduce((a, c) => a + (max[c] || 0), 0), withMax = cols.filter((c) => max[c] > 0);
    const rows = studs.map((s, i) => {
      const k = s.sid || s.nm, marks = {};
      cols.forEach((c) => { const o = (byA[c] || {})[k]; let v = o ? (o.tot !== null ? o.tot : o.q) : null; if (v !== null && max[c] > 0) v = Math.min(Math.max(v, 0), max[c]); marks[c] = v; });
      const got = cols.filter((c) => marks[c] !== null), fin = got.length ? Math.round(got.reduce((a, c) => a + marks[c], 0) * 100) / 100 : null;
      const allZero = withMax.length > 0 && withMax.every((c) => marks[c] === 0);
      const s0 = st[k], status = s0 === "W" || s0 === "DN" ? s0 : s0 === "A" ? "" : allZero ? "W" : "";
      return { serial: i + 1, computer_no: s.sid, name: s.nm, gender: s.gn || MP().gOf(gm, s), department: clean(dc[k]), marks, final: fin, key: k, status, wd_auto: allZero,
        withdrawn: status === "W", letter: status === "DN" ? "DN" : fin === null ? "" : letterOf(sel, fmax > 0 ? (fin / fmax) * 100 : null), missing: withMax.filter((c) => marks[c] === null) };
    });
    const pp = num((ui().ms_pass || {})[sel]);
    return { max, final_max: fmax, rows, pass_mark: fmax * (pp === null ? 60 : pp) / 100, passPct: pp === null ? 60 : pp, source: "marks", cols: cols.map((c) => ({ key: c, label: c, max: max[c] })) };
  }

  /* ---------------------------------------------------------------- an uploaded faculty mark sheet (TAMA parse_mark_sheet) */
  const NOT_ASSESSMENT = /final|total|round|percent|letter|grade|serial|number|excuse|gender|discipline|specialty|speciality|major/i;
  function parseMarkSheet(raw) {
    raw = raw.filter((r) => r.some((c) => clean(c)));
    const head = (v) => T.s(v).replace(/\s+/g, " ").trim();
    const hdr = raw.findIndex((r) => r.some((v) => head(v).toLowerCase().includes("student name")));
    if (hdr < 0) return "I could not find a header row with the column 'Student name'.";
    const heads = raw[hdr].map(head), maxrow = raw[hdr + 1];
    const col = (...keys) => { const i = heads.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k))); return i < 0 ? null : i; };
    const cName = col("student name"), cSer = col("serial"), cComp = col("computer"), cDept = col("department", "discipline", "specialty", "speciality"), cGen = col("gender"), cLet = col("letter"), cFin0 = heads.findIndex((h) => /final|total/i.test(h) && !/exam|test|quiz/i.test(h)), cFin = cFin0 < 0 ? null : cFin0;
    const maxes = {};
    heads.forEach((h, i) => { if (!h || (NOT_ASSESSMENT.test(h) && !/exam|test|quiz/i.test(h)) || i === cFin || i === cDept || !maxrow) return; const m = num(maxrow[i]); if (m !== null && m > 0) maxes[h] = m; });
    if (!Object.keys(maxes).length) return "I could not find the maximum marks of the assessments in the row under the headers.";
    const fm = cFin !== null && maxrow ? num(maxrow[cFin]) : null, final_max = fm !== null ? fm : Object.values(maxes).reduce((a, b) => a + b, 0);
    const rows = [];
    for (let i = hdr + 2; i < raw.length; i++) {
      const r = raw[i], ser = cSer !== null ? num(r[cSer]) : null, nm = head(r[cName]);
      if (!nm || (cSer !== null && ser === null)) continue;
      const marks = {}; Object.keys(maxes).forEach((h) => { marks[h] = num(r[heads.indexOf(h)]); });
      let fin = cFin !== null ? num(r[cFin]) : null; if (fin === null) fin = Object.values(marks).reduce((a, v) => a + (v || 0), 0);
      const wd = Object.values(marks).every((v) => !v) && fin === 0;
      rows.push({ serial: ser === null ? null : Math.round(ser), computer_no: cComp !== null ? head(r[cComp]).replace(/\.0$/, "") : "", name: nm, department: cDept !== null ? head(r[cDept]) : "",
        gender: cGen !== null ? head(r[cGen]) : "", marks, final: fin, letter: cLet !== null ? head(r[cLet]) : "", withdrawn: wd, wd_auto: wd });
    }
    if (!rows.length) return "I found the header but no student rows below it.";
    return { max: maxes, final_max, rows };
  }
  function uploadedView(sel) {
    const rec = (S.data.mark_sheets || {})[String(sel)]; if (!rec || !Array.isArray(rec.rows)) return null;
    const gm = MP().genderMap(sel);
    const rows = rec.rows.map((r, i) => { const g = T.s(r.gender).trim().toUpperCase()[0] || ""; return Object.assign(r, {}) && { ...r, idx: i, key: T.s(r.computer_no) || T.s(r.name),
      gender: g === "M" || g === "F" ? g : MP().gOf(gm, { sid: r.computer_no, nm: r.name }), status: r.withdrawn ? "W" : T.s(r.letter).toUpperCase() === "DN" ? "DN" : "", missing: [] }; });
    return { max: rec.max, final_max: num(rec.final_max) || 0, rows, pass_mark: num(rec.pass_mark) === null ? 60 : num(rec.pass_mark), source: "upload", rec,
      cols: Object.keys(rec.max).map((c) => ({ key: c, label: (rec.map || {})[c] && rec.map[c] !== c ? `${c} (${rec.map[c]})` : c, max: rec.max[c] })) };
  }
  /** The mark sheet of a course in TAMA's shape: from Student marks, or the uploaded sheet. Used by CLO achievement too. */
  T.markSheet = function (sel) { return sourceOf(sel) === "upload" ? uploadedView(sel) || buildFromMarks(sel) : buildFromMarks(sel); };
  T.markSheetSource = sourceOf;

  /* ---------------------------------------------------------------- page sections */
  T.sections.msSource = function () {
    const sel = T.current(), el = $("#sec-mssrc"); if (!el) return;
    const src = sourceOf(sel), rec = (S.data.mark_sheets || {})[String(sel)], pg = isPG(sel), v = T.markSheet(sel);
    const ca = MP().cas(sel), done = MP().marked(sel), miss = ca.map((r) => r.assessment).filter((a) => !done[a]);
    el.innerHTML = `<div class="sec-head" id="h-mssrc"><div><h2>Where the marks come from</h2><p class="sub">The course mark sheet puts together the marks of every assessment of ${esc(T.baseCode(sel))}, one column per assessment, and adds them up to the final mark.</p></div></div>
      <div class="fld"><span class="lbl">Take the marks from</span><div class="seg">
        <button class="${src === "marks" ? "on" : ""}" data-mssrc="marks">The Student marks page</button><button class="${src === "upload" ? "on" : ""}" data-mssrc="upload">A mark sheet file I upload (Excel)</button></div></div>
      ${src === "marks" ? `<p class="note">Every assessment of the course is a column: the marks typed on the <a href="#student-marks">Student marks</a> page (the total of each test, or the sum of its questions). The students come from the Student list there.</p>
          ${ca.length && miss.length ? `<p class="warn-text"><b>${miss.length} of ${ca.length} assessments have no student marks yet:</b> ${miss.map(esc).join(", ")}. Their column stays empty until you enter them on the Student marks page.</p>` : ca.length ? `<p class="ok-text">✓ Every assessment has student marks.</p>` : `<p class="note">No assessments yet. Add them in the Assessment plan.</p>`}`
        : `<div class="row-btns"><label class="btn sm primary"><input type="file" id="ms-file" accept=".xlsx,.xls" hidden>${rec ? "Replace the mark sheet" : "Upload the mark sheet (Excel)"}</label>${rec ? `<span class="note">Saved: ${esc(rec.file || "mark sheet")}${rec.sheet ? `, sheet ${esc(rec.sheet)}` : ""}</span><button class="btn sm" id="ms-remove">Remove this mark sheet</button>` : ""}</div>
          <p class="note">The faculty mark sheet: a header row with "Student name", the maximum mark of each assessment in the row under it, then one row per student.</p><div id="ms-prev"></div>
          ${rec ? mapHtml(sel, rec) : `<div class="alert-box"><span class="alert-ic">⚠</span><span>No mark sheet is uploaded for this course yet. Upload one, or take the marks from the Student marks page.</span></div>`}`}
      <div class="grid g3">
        <label class="fld filled" for="ms-pass"><span class="lbl">Pass mark (% of the final mark)</span><input type="text" inputmode="decimal" id="ms-pass" value="${esc(g2(src === "upload" && v && v.final_max ? (v.pass_mark / v.final_max) * 100 : v ? v.passPct : 60))}"></label>
        <div class="fld"><span class="lbl">Postgraduate course? <i class="hint" title="Postgraduate courses often have students from different disciplines. When this is on, the mark sheet has a Discipline column and the statistics are shown per discipline too.">?</i></span>
          <div class="seg"><button class="${pg ? "on" : ""}" data-mspg="1">Yes: add the students' discipline</button><button class="${pg ? "" : "on"}" data-mspg="0">No</button></div></div></div>
      ${src === "marks" ? `<details class="sum-box"><summary>Letter grades (A+ to F) used for the final mark</summary>
        <div class="bp-wrap"><table class="tbl" style="max-width:360px"><thead><tr><th>Grade</th><th class="num">From (% of the final mark)</th></tr></thead><tbody>
        ${scaleOf(sel).map(([l, m], i) => `<tr><td><b>${esc(l)}</b></td><td><input class="cell num-in" inputmode="decimal" data-msscale="${i}" value="${esc(g2(m))}"></td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn sm" id="ms-scale0">Back to the usual scale</button></div><p class="note">A student whose final mark is at or above a grade's "From" value gets that grade. Denied entry (DN) is chosen per student in the mark sheet.</p></details>` : ""}`;
    $$("[data-mssrc]", el).forEach((b) => b.onclick = () => { sub("ms_source")[sel] = b.dataset.mssrc; S.save(); redrawAll(); });
    $$("[data-mspg]", el).forEach((b) => b.onclick = () => { sub("ms_postgrad")[sel] = b.dataset.mspg === "1"; S.save(); redrawAll(); });
    $("#ms-pass", el).onchange = (e) => { const p = Math.min(100, Math.max(0, num(e.target.value) || 0)); if (src === "upload" && rec) rec.pass_mark = (num(rec.final_max) || 100) * p / 100; else sub("ms_pass")[sel] = p; S.save(); redrawAll(); };
    $$("[data-msscale]", el).forEach((f) => f.onchange = () => { const s = scaleOf(sel); s[+f.dataset.msscale][1] = Math.min(100, Math.max(0, num(f.value) || 0)); sub("ms_scale")[sel] = s; S.save(); redrawAll(); });
    const s0 = $("#ms-scale0", el); if (s0) s0.onclick = () => { delete sub("ms_scale")[sel]; S.save(); redrawAll(); };
    const rm = $("#ms-remove", el); if (rm) rm.onclick = () => { if (!confirm(`Remove the uploaded mark sheet of ${T.baseCode(sel)}?`)) return; delete S.data.mark_sheets[String(sel)]; S.save(); redrawAll(); };
    $$("[data-msmap]", el).forEach((f) => f.onchange = () => { rec.map = rec.map || defaultMap(sel, rec); rec.map[f.dataset.msmap] = f.value; S.save(); redrawAll(); });
    const fi = $("#ms-file", el);
    if (fi) fi.onchange = async () => {
      const f = fi.files[0], prev = $("#ms-prev", el); if (!f) return;
      try {
        await T.importer.lib("xlsx");
        const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array" }), digits = T.s(sel).replace(/\D/g, "");
        const order = [...wb.SheetNames].sort((a, b) => (b.trim() === digits) - (a.trim() === digits));
        let got = null, sheet = "";
        for (const sh of order) { got = parseMarkSheet(XLSX.utils.sheet_to_json(wb.Sheets[sh], { header: 1, defval: "", raw: true })); sheet = sh; if (typeof got !== "string") break; }
        if (typeof got === "string") { prev.innerHTML = `<div class="alert-box"><span class="alert-ic">⚠</span><span>${esc(got)}</span></div>`; return; }
        got.file = f.name; got.sheet = sheet; got.size = f.size; got.pass_mark = rec && num(rec.pass_mark) !== null ? rec.pass_mark : got.final_max * 0.6;
        S.data.mark_sheets = S.data.mark_sheets || {}; S.data.mark_sheets[String(sel)] = got; got.map = defaultMap(sel, got); S.save();
        const nW = got.rows.filter((r) => r.withdrawn).length;
        T.toast(`Mark sheet saved: ${got.rows.length} students${nW ? `, ${nW} labelled Withdrawn` : ""}`); redrawAll();
      } catch (e) { prev.innerHTML = `<div class="alert-box"><span class="alert-ic">⚠</span><span>The file could not be read (${esc(e.message || e)}).</span></div>`; }
    };
  };
  function defaultMap(sel, rec) {   // TAMA default_sheet_map
    const names = [...new Set([...MP().cas(sel).map((r) => r.assessment), ...((T.plan && T.plan.methods ? T.plan.methods(sel) : []) || [])])], out = {};
    Object.keys(rec.max).forEach((col) => { const c = col.trim().toLowerCase();
      out[col] = names.find((n) => n.trim().toLowerCase() === c) || names.find((n) => c.length >= 3 && (n.trim().toLowerCase().startsWith(c) || c.startsWith(n.trim().toLowerCase()))) || ""; });
    return out;
  }
  function mapHtml(sel, rec) {
    const map = rec.map || defaultMap(sel, rec), names = [...new Set([...MP().cas(sel).map((r) => r.assessment), ...((T.plan && T.plan.methods ? T.plan.methods(sel) : []) || [])])];
    return `<h3 class="qm-h">Columns of the mark sheet and the assessments they are</h3><p class="note">Each column is matched to an assessment of the course. The CLOs and SLOs it counts for come from the ticks on the Assessment plan page.</p>
      <div class="bp-wrap"><table class="tbl" style="max-width:640px"><thead><tr><th>Mark-sheet column</th><th class="num">Maximum</th><th>Assessment of the course</th></tr></thead><tbody>
      ${Object.keys(rec.max).map((c) => `<tr><td><b>${esc(c)}</b></td><td class="num">${g2(rec.max[c])}</td><td><select class="cell" data-msmap="${esc(c)}"><option value="">(not linked)</option>${names.map((n) => `<option ${map[c] === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
  }

  /** The mark sheet table: one row per student, editable status and discipline. */
  T.sections.msSheet = function () {
    const sel = T.current(), el = $("#sec-mssheet"); if (!el) return;
    const v = T.markSheet(sel), pg = isPG(sel), hide = !!S.ui.msHide;
    if (!v || !v.rows.length) { el.innerHTML = `<div class="sec-head" id="h-mssheet"><div><h2>The course mark sheet</h2></div></div><p class="note">No students yet. Add the Student list on the <a href="#student-marks">Student marks</a> page${v && v.source === "upload" ? ", or upload a mark sheet above" : ""}.</p>`; return; }
    const discs = [...new Set(v.rows.map((r) => r.department).filter(Boolean))].sort();
    const miss = v.rows.filter((r) => r.status === "" && r.missing && r.missing.length && r.final !== null), none = v.rows.filter((r) => r.status === "" && r.final === null);
    const auto = v.rows.filter((r) => r.wd_auto && r.status === "W");
    el.innerHTML = `<div class="sec-head" id="h-mssheet"><div><h2>The course mark sheet</h2><p class="sub">${v.rows.length} students · final mark out of ${g2(v.final_max)}. Choose <b>Withdrawn</b> or <b>Denied entry</b> for a student to leave them out of the averages.${pg ? " Type each student's discipline." : ""}</p></div></div>
      <div class="row-btns"><button class="btn sm" id="ms-hide">${hide ? "Show the student names" : "Hide the student names"}</button><button class="btn sm" id="ms-xl">Download the mark sheet (Excel)</button></div>
      ${auto.length ? `<div class="info-box"><span>${auto.length} student(s) have every mark equal to 0, so they are labelled <b>Withdrawn</b>: ${auto.slice(0, 6).map((r) => esc(r.name || r.computer_no)).join(", ")}${auto.length > 6 ? " ..." : ""}. Change the status of a student who really scored 0.</span></div>` : ""}
      ${miss.length ? `<div class="alert-box"><span class="alert-ic">⚠</span><span><b>${miss.length} student(s) have missing marks</b>, so their final mark is not complete yet (for example ${esc(miss[0].name || miss[0].computer_no)}: ${miss[0].missing.map(esc).join(", ")}). Enter the marks on the Student marks page, or choose a status.</span></div>` : ""}
      ${none.length ? `<p class="warn-text">${none.length} student(s) have no marks at all yet. They are left out of the statistics until they have marks.</p>` : ""}
      <datalist id="ms-discs">${discs.map((d) => `<option value="${esc(d)}">`).join("")}</datalist>
      <div class="bp-wrap ms-wrap" style="overflow-x:auto"><table class="tbl ms-tbl"><thead><tr><th class="ctr" style="width:36px">#</th>${hide ? "" : '<th class="ctr">Student ID</th><th>Student name</th>'}<th class="ctr">Gender</th>${pg ? '<th style="min-width:130px">Discipline</th>' : ""}
        ${v.cols.map((c) => `<th class="ctr ms-a">${esc(c.label)}<span class="mg-out">out of ${c.max ? g2(c.max) : "-"}</span></th>`).join("")}
        <th class="ctr ms-f">Final mark<span class="mg-out">out of ${g2(v.final_max)}</span></th><th class="ctr">%</th><th class="ctr">Grade</th><th class="ctr" style="min-width:132px">Status</th></tr></thead><tbody>
        ${v.rows.map((r, i) => { const pc = r.final !== null && v.final_max > 0 ? (r.final / v.final_max) * 100 : null, out = r.status === "W" || r.status === "DN", fail = !out && r.final !== null && r.final < v.pass_mark - 1e-9;
          return `<tr class="${out ? "ms-out" : ""}"><td class="ctr muted">${i + 1}</td>${hide ? "" : `<td class="ctr">${esc(r.computer_no)}</td><td>${esc(r.name)}</td>`}<td class="ctr">${esc(r.gender || "-")}</td>
          ${pg ? `<td><input class="cell" list="ms-discs" data-msdisc="${i}" data-ref="msd:${i}" value="${esc(r.department)}" placeholder="Discipline"></td>` : ""}
          ${v.cols.map((c) => `<td class="ctr ${r.marks[c.key] === null || r.marks[c.key] === undefined ? "ms-miss" : ""}">${r.marks[c.key] === null || r.marks[c.key] === undefined ? "-" : g2(r.marks[c.key])}</td>`).join("")}
          <td class="ctr ms-f"><b>${g2(r.final)}</b></td><td class="ctr">${pc === null ? "" : g2(pc)}</td><td class="ctr ${fail ? "ms-fail" : ""}"><b>${esc(r.letter || "")}</b></td>
          <td class="ctr"><select class="cell" data-msst="${i}" data-ref="mss:${i}"><option value="" ${r.status ? "" : "selected"}>Active</option><option value="W" ${r.status === "W" ? "selected" : ""}>Withdrawn (W)</option><option value="DN" ${r.status === "DN" ? "selected" : ""}>Denied entry (DN)</option></select></td></tr>`; }).join("")}
        </tbody></table></div>
      <p class="note">Withdrawn and denied-entry rows are shaded and left out of the averages. A grade shaded orange is below the pass mark (${g2(v.pass_mark)}).</p>`;
    $("#ms-hide", el).onclick = () => { S.ui.msHide = !hide; S.saveUi(); T.refresh("msSheet", "msStats"); };
    $$("[data-msst]", el).forEach((f) => f.onchange = () => {
      const r = v.rows[+f.dataset.msst], val = f.value;
      if (v.source === "upload") { const o = v.rec.rows[r.idx]; o.withdrawn = val === "W"; if (val === "DN") { if (T.s(o.letter).toUpperCase() !== "DN") o.letter_orig = o.letter; o.letter = "DN"; } else if (T.s(o.letter).toUpperCase() === "DN") { o.letter = o.letter_orig || ""; } }
      else { const st = sub("ms_status", sel); if (val) st[r.key] = val; else if (r.wd_auto) st[r.key] = "A"; else delete st[r.key]; }
      S.save(); redrawAll();
    });
    $$("[data-msdisc]", el).forEach((f) => f.onchange = () => {
      const r = v.rows[+f.dataset.msdisc], val = clean(f.value);
      if (v.source === "upload") v.rec.rows[r.idx].department = val; else { const d = sub("ms_disc", sel); if (val) d[r.key] = val; else delete d[r.key]; }
      S.save(); T.refresh("msSheet", "msStats", "msReport");
    });
    $("#ms-xl", el).onclick = async () => {
      await T.importer.lib("xlsx");
      const data = v.rows.map((r, i) => Object.assign({ "#": i + 1 }, hide ? {} : { "Student ID": r.computer_no, "Student name": r.name }, { Gender: r.gender }, pg ? { Discipline: r.department } : {},
        Object.fromEntries(v.cols.map((c) => [`${c.label} (/${g2(c.max)})`, r.marks[c.key] ?? ""])), { [`Final mark (/${g2(v.final_max)})`]: r.final ?? "", Grade: r.letter, Status: r.status === "W" ? "Withdrawn" : r.status === "DN" ? "Denied entry" : r.final === null ? "" : r.final >= v.pass_mark - 1e-9 ? "Pass" : "Fail" }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Mark sheet");
      const st = summary(sel, v); if (st) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st.byGender.map((g) => ({ Group: g.label, Students: g.n, Withdrawn: g.w, "Mean final mark": g.s ? +g2(g.s.mean) : "", Median: g.s ? +g2(g.s.median) : "", SD: g.s ? +g2(g.s.sd) : "", Highest: g.s ? g.s.max : "", Lowest: g.s ? g.s.min : "", "Pass rate %": g.pr === null ? "" : +g2(g.pr) }))), "Statistics");
      XLSX.writeFile(wb, `mark_sheet_${T.baseCode(sel)}.xlsx`.replace(/[^\w.-]+/g, "_"));
    };
  };

  /* ---------------------------------------------------------------- statistics */
  function summary(sel, v) {
    if (!v || !v.rows.length) return null;
    const gOf = (r) => (r.gender === "M" || r.gender === "F" ? r.gender : "");
    const active = v.rows.filter((r) => r.status !== "W"), graded = active.filter((r) => r.status !== "DN" && r.final !== null);
    const pass = (rs) => rs.filter((r) => r.final >= v.pass_mark - 1e-9).length;
    const grp = (code, label, rs) => { const g = rs.filter((r) => r.status !== "W" && r.status !== "DN" && r.final !== null); return { code, label, all: rs, n: rs.length, w: rs.filter((r) => r.status === "W").length, dn: rs.filter((r) => r.status === "DN").length, graded: g, s: stats(g.map((r) => r.final)), pr: g.length ? (pass(g) / g.length) * 100 : null }; };
    const hasG = v.rows.some((r) => gOf(r));
    const byGender = [...(hasG ? [grp("M", "Male", v.rows.filter((r) => gOf(r) === "M")), grp("F", "Female", v.rows.filter((r) => gOf(r) === "F"))] : []), grp("T", "All students", v.rows)];
    const letters = [...LETTER_ORDER.filter((l) => active.some((r) => (r.letter || "") === l)), ...[...new Set(active.map((r) => r.letter || "").filter((l) => l && !LETTER_ORDER.includes(l)))].sort()];
    return { active, graded, byGender, hasG, letters, s: stats(graded.map((r) => r.final)), passed: pass(graded) };
  }
  T.sections.msStats = function () {
    const sel = T.current(), el = $("#sec-msstats"); if (!el) return;
    const v = T.markSheet(sel), st = summary(sel, v), pg = isPG(sel);
    const headH = `<div class="sec-head" id="h-msstats"><div><h2>Statistics and charts</h2><p class="sub">Withdrawn and denied-entry students are left out of the averages. Every chart can be downloaded as a picture.</p></div></div>`;
    if (!st || !st.graded.length) { el.innerHTML = headH + `<p class="note">The statistics appear as soon as students have marks.</p>`; return; }
    const fm = v.final_max, nW = v.rows.filter((r) => r.status === "W").length, nDN = v.rows.filter((r) => r.status === "DN").length;
    const cards = [["Students assessed", st.graded.length], ["Mean final mark", `${g2(st.s.mean)} <small>/ ${g2(fm)}</small>`], ["Median", g2(st.s.median)], ["Standard deviation", g2(st.s.sd)],
      ["Highest", g2(st.s.max)], ["Lowest", g2(st.s.min)], ["Pass rate", `${g2((st.passed / st.graded.length) * 100)}%`], ["Withdrawn", nW + (nDN ? ` <small>+ ${nDN} DN</small>` : "")]];
    const G = st.byGender, series = (fn) => G.map((g) => ({ name: g.label, color: COL[g.code], values: fn(g) }));
    // grade distribution
    const gradeChart = T.charts.groupBars({ title: "Grade distribution", sub: "(number of students)", cats: st.letters, series: series((g) => st.letters.map((l) => g.all.filter((r) => r.status !== "W" && (r.letter || "") === l).length)), yTitle: "Students", fmt: (x) => String(x), intAxis: true, file: `grades_${T.baseCode(sel)}` });
    const gradeTbl = `<div class="bp-wrap"><table class="tbl xs-tbl ms-st"><thead><tr><th rowspan="2">Grade</th>${G.map((g) => `<th class="ctr" colspan="2">${g.label}</th>`).join("")}</tr><tr>${G.map(() => '<th class="ctr">n</th><th class="ctr">%</th>').join("")}</tr></thead><tbody>
      ${[...st.letters.map((l) => [l, (g) => g.all.filter((r) => r.status !== "W" && (r.letter || "") === l).length]), ["Withdrawn", (g) => g.w]].map(([l, fn]) => `<tr><td><b>${esc(l)}</b></td>${G.map((g) => { const n = fn(g); return `<td class="ctr">${n}</td><td class="ctr">${g.n ? g2((n / g.n) * 100) : "0"}</td>`; }).join("")}</tr>`).join("")}
      <tr class="tot"><td><b>Total</b></td>${G.map((g) => `<td class="ctr"><b>${g.n}</b></td><td class="ctr">${g.n ? 100 : 0}</td>`).join("")}</tr></tbody></table></div><p class="note">Percentages are of all the students of that group, withdrawn included, so each column adds up to 100%.${st.hasG && v.rows.some((r) => r.gender !== "M" && r.gender !== "F") ? ` ${v.rows.filter((r) => r.gender !== "M" && r.gender !== "F").length} student(s) have no gender recorded; they are counted in All students only.` : ""}</p>`;
    // by gender
    const genTbl = `<div class="bp-wrap"><table class="tbl xs-tbl ms-st"><thead><tr><th>Group</th><th class="ctr">Students</th><th class="ctr">Withdrawn</th><th class="ctr">Mean</th><th class="ctr">Median</th><th class="ctr">SD</th><th class="ctr">Highest</th><th class="ctr">Lowest</th><th class="ctr">Pass rate</th></tr></thead><tbody>
      ${G.map((g) => `<tr class="${g.code === "T" ? "tot" : ""}"><td><b>${g.label}</b></td><td class="ctr">${g.n}</td><td class="ctr">${g.w}</td>${g.s ? `<td class="ctr">${g2(g.s.mean)}</td><td class="ctr">${g2(g.s.median)}</td><td class="ctr">${g2(g.s.sd)}</td><td class="ctr">${g2(g.s.max)}</td><td class="ctr">${g2(g.s.min)}</td>` : '<td colspan="5" class="ctr muted">no marks</td>'}<td class="ctr">${g.pr === null ? "-" : g2(g.pr) + "%"}</td></tr>`).join("")}</tbody></table></div>`;
    // assessments
    const aCols = v.cols.filter((c) => c.max > 0 && st.graded.some((r) => r.marks[c.key] !== null && r.marks[c.key] !== undefined));
    const aMean = (g, c) => { const xs = g.graded.map((r) => r.marks[c.key]).filter((x) => x !== null && x !== undefined); return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length / c.max) * 100 : null; };
    const aChart = aCols.length ? T.charts.groupBars({ title: "Mean of each assessment", sub: "(% of its full mark)", cats: aCols.map((c) => c.label), series: series((g) => aCols.map((c) => aMean(g, c))), max: 100, yTitle: "% of the full mark", ref: { value: v.final_max ? (v.pass_mark / v.final_max) * 100 : 60, label: "Pass level" }, file: `assessments_${T.baseCode(sel)}` }) : "";
    const aTbl = aCols.length ? `<div class="bp-wrap"><table class="tbl xs-tbl ms-st"><thead><tr><th>Assessment</th><th class="ctr">Full mark</th><th class="ctr">Students</th><th class="ctr">Mean</th><th class="ctr">Mean %</th><th class="ctr">Highest</th><th class="ctr">Lowest</th>${st.hasG ? '<th class="ctr">Male mean %</th><th class="ctr">Female mean %</th>' : ""}</tr></thead><tbody>
      ${aCols.map((c) => { const xs = st.graded.map((r) => r.marks[c.key]).filter((x) => x !== null && x !== undefined), s = stats(xs); return `<tr><td><b>${esc(c.label)}</b></td><td class="ctr">${g2(c.max)}</td><td class="ctr">${s.n}</td><td class="ctr">${g2(s.mean)}</td><td class="ctr">${g2((s.mean / c.max) * 100)}</td><td class="ctr">${g2(s.max)}</td><td class="ctr">${g2(s.min)}</td>${st.hasG ? `<td class="ctr">${g2(aMean(G[0], c))}</td><td class="ctr">${g2(aMean(G[1], c))}</td>` : ""}</tr>`; }).join("")}</tbody></table></div>` : "";
    // status by gender
    const stCats = ["Pass", "Fail", "Withdrawn", ...(nDN ? ["Denied entry"] : [])];
    const stFn = (g) => [g.graded.filter((r) => r.final >= v.pass_mark - 1e-9).length, g.graded.filter((r) => r.final < v.pass_mark - 1e-9).length, g.w, ...(nDN ? [g.dn] : [])];
    const stChart = T.charts.groupBars({ title: "Pass, fail and withdrawn", sub: "(number of students)", cats: stCats, series: series(stFn), yTitle: "Students", fmt: (x) => String(x), intAxis: true, file: `status_${T.baseCode(sel)}` });
    // discipline
    let dHtml = "";
    if (pg || v.rows.some((r) => r.department)) {
      const ds = [...new Set(v.rows.map((r) => r.department || "Not stated"))];
      const D = ds.map((d) => { const rs = v.rows.filter((r) => (r.department || "Not stated") === d), g = rs.filter((r) => r.status !== "W" && r.status !== "DN" && r.final !== null), s = stats(g.map((r) => r.final));
        return { d, n: rs.length, m: rs.filter((r) => r.gender === "M").length, f: rs.filter((r) => r.gender === "F").length, w: rs.filter((r) => r.status === "W").length, s, pr: g.length ? (g.filter((r) => r.final >= v.pass_mark - 1e-9).length / g.length) * 100 : null }; }).sort((a, b) => b.n - a.n);
      dHtml = `<h3 class="qm-h">Students by discipline</h3>
        ${ds.length === 1 && ds[0] === "Not stated" ? `<p class="note">Type each student's discipline in the mark sheet above to see the statistics per discipline.</p>` : `
        <div class="bp-wrap"><table class="tbl xs-tbl ms-st"><thead><tr><th>Discipline</th><th class="ctr">Students</th><th class="ctr">% of students</th>${st.hasG ? '<th class="ctr">Male</th><th class="ctr">Female</th>' : ""}<th class="ctr">Withdrawn</th><th class="ctr">Mean final mark</th><th class="ctr">Highest</th><th class="ctr">Lowest</th><th class="ctr">Pass rate</th></tr></thead><tbody>
        ${D.map((x) => `<tr><td><b>${esc(x.d)}</b></td><td class="ctr">${x.n}</td><td class="ctr">${g2((x.n / v.rows.length) * 100)}</td>${st.hasG ? `<td class="ctr">${x.m}</td><td class="ctr">${x.f}</td>` : ""}<td class="ctr">${x.w}</td><td class="ctr">${x.s ? g2(x.s.mean) : "-"}</td><td class="ctr">${x.s ? g2(x.s.max) : "-"}</td><td class="ctr">${x.s ? g2(x.s.min) : "-"}</td><td class="ctr">${x.pr === null ? "-" : g2(x.pr) + "%"}</td></tr>`).join("")}
        <tr class="tot"><td><b>Total</b></td><td class="ctr"><b>${v.rows.length}</b></td><td class="ctr">100</td>${st.hasG ? `<td class="ctr">${G[0].n}</td><td class="ctr">${G[1].n}</td>` : ""}<td class="ctr">${nW}</td><td class="ctr">${g2(st.s.mean)}</td><td class="ctr">${g2(st.s.max)}</td><td class="ctr">${g2(st.s.min)}</td><td class="ctr">${g2((st.passed / st.graded.length) * 100)}%</td></tr></tbody></table></div>
        <div class="ms-charts">${T.charts.groupBars({ title: "Students in each discipline", cats: D.map((x) => x.d), series: st.hasG ? [{ name: "Male", color: COL.M, values: D.map((x) => x.m) }, { name: "Female", color: COL.F, values: D.map((x) => x.f) }] : [{ name: "Students", color: COL.M, values: D.map((x) => x.n) }], yTitle: "Students", fmt: (x) => String(x), intAxis: true, file: `disciplines_${T.baseCode(sel)}` })}
        ${T.charts.groupBars({ title: "Mean final mark of each discipline", sub: `(out of ${g2(fm)})`, cats: D.map((x) => x.d), series: [{ name: "Mean final mark", color: COL.T, values: D.map((x) => (x.s ? x.s.mean : null)) }], max: fm || undefined, ref: { value: v.pass_mark, label: "Pass mark" }, file: `discipline_means_${T.baseCode(sel)}` })}</div>`}`;
    }
    el.innerHTML = headH + `<div class="kcards ms-k">${cards.map(([l, x]) => `<div class="kcard"><div class="lab">${l}</div><div class="big">${x}</div></div>`).join("")}</div>
      <h3 class="qm-h">Grades</h3><div class="ms-charts">${gradeChart}<div>${gradeTbl}</div></div>
      <h3 class="qm-h">Final marks</h3><div class="ms-charts">${T.charts.hist({ title: "How the final marks are spread", sub: `(out of ${g2(fm)})`, values: st.graded.map((r) => r.final), max: fm || Math.max(...st.graded.map((r) => r.final)), bins: 10, pass: v.pass_mark, xTitle: `Final mark (out of ${g2(fm)})`, file: `final_marks_${T.baseCode(sel)}` })}${stChart}</div>
      ${st.hasG ? `<h3 class="qm-h">Male and female students</h3>` : `<h3 class="qm-h">Summary</h3><p class="note">Add the students' gender in the Student list (Student marks page) to compare male and female students.</p>`}${genTbl}
      ${aCols.length ? `<h3 class="qm-h">Each assessment</h3>${aChart}${aTbl}` : ""}
      ${dHtml}`;
  };

  /* ---------------------------------------------------------------- for the course report (TAMA render_grades_for_report / cr_grades) */
  function crGrades(sel, v) {
    const d = T.plan.crStore(sel), rows = v.rows, started = rows.length, wd = rows.filter((r) => r.status === "W"), act = rows.filter((r) => r.status !== "W");
    const denied = act.filter((r) => r.status === "DN" || T.s(r.letter).toUpperCase() === "DN"), graded = act.filter((r) => !(r.status === "DN" || T.s(r.letter).toUpperCase() === "DN") && r.final !== null);
    const ip = Math.max(0, Math.round(num(d.in_progress) || 0)), inc = Math.max(0, Math.round(num(d.incomplete) || 0)), pct = (n, b) => (b ? (n / b) * 100 : null);
    const counts = Object.fromEntries(CR_GRADES.map((L) => [L, graded.filter((r) => T.s(r.letter).toUpperCase() === L).length]));
    const passed = graded.filter((r) => r.final >= v.pass_mark - 1e-9 && T.s(r.letter).toUpperCase() !== "F").length, failed = graded.length - passed;
    return { started, completed: Math.max(graded.length - ip - inc, 0), graded: graded.length, counts, counts_pct: Object.fromEntries(CR_GRADES.map((L) => [L, pct(counts[L], graded.length)])),
      status: { "Denied Entry": denied.length, "In Progress": ip, Incomplete: inc, Pass: passed, Fail: failed, Withdrawn: wd.length },
      status_pct: { "Denied Entry": pct(denied.length, started), "In Progress": pct(ip, started), Incomplete: pct(inc, started), Pass: pct(passed, graded.length), Fail: pct(failed, graded.length), Withdrawn: pct(wd.length, started) } };
  }
  T.sections.msReport = function () {
    const sel = T.current(), el = $("#sec-msrep"); if (!el) return;
    const v = T.markSheet(sel), d = T.plan.crStore(sel);
    if (!v || !v.rows.length) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    const g = crGrades(sel, v), keys = Object.keys(g.status);
    el.innerHTML = `<div class="sec-head" id="h-msrep"><div><h2>For the course report</h2><p class="sub">Section A of the Course Report. The grades come from the mark sheet above. Add the students who are still In progress or have an Incomplete grade, which the mark sheet does not show.</p></div></div>
      <div class="grid g3"><label class="fld filled" for="ms-ip"><span class="lbl">In progress (students)</span><input type="text" inputmode="numeric" id="ms-ip" value="${esc(g2(num(d.in_progress) || 0))}"></label>
        <label class="fld filled" for="ms-inc"><span class="lbl">Incomplete (students)</span><input type="text" inputmode="numeric" id="ms-inc" value="${esc(g2(num(d.incomplete) || 0))}"></label></div>
      <div class="bp-wrap" style="overflow-x:auto"><table class="tbl xs-tbl ms-st"><thead><tr><th></th>${CR_GRADES.map((L) => `<th class="ctr">${L}</th>`).join("")}${keys.map((k) => `<th class="ctr">${k}</th>`).join("")}</tr></thead><tbody>
        <tr><td><b>Number of students</b></td>${CR_GRADES.map((L) => `<td class="ctr">${g.counts[L]}</td>`).join("")}${keys.map((k) => `<td class="ctr">${g.status[k]}</td>`).join("")}</tr>
        <tr><td><b>Percentage</b></td>${CR_GRADES.map((L) => `<td class="ctr">${g.counts_pct[L] === null ? "" : g2(g.counts_pct[L])}</td>`).join("")}${keys.map((k) => `<td class="ctr">${g.status_pct[k] === null ? "" : g2(g.status_pct[k])}</td>`).join("")}</tr></tbody></table></div>
      <p class="note">Started the course: ${g.started} · completed: ${g.completed}. Grade percentages are of the students who completed the course; denied entry, in progress, incomplete and withdrawn are of the students who started it.</p>
      <label class="fld ${T.s(d.grade_comment).trim() ? "filled" : ""}" for="ms-com"><span class="lbl">Comment on student grades (including particular factors, if any, affecting the results)</span><textarea id="ms-com" rows="4" data-ref="ms-com">${esc(d.grade_comment || "")}</textarea></label>
      ${T.sug.html("mscom")}`;
    $("#ms-ip", el).onchange = (e) => { d.in_progress = Math.max(0, Math.round(num(e.target.value) || 0)); S.save(); T.refresh("msReport"); };
    $("#ms-inc", el).onchange = (e) => { d.incomplete = Math.max(0, Math.round(num(e.target.value) || 0)); S.save(); T.refresh("msReport"); };
    const ta = $("#ms-com", el); T.autoGrow(ta); ta.oninput = () => { d.grade_comment = ta.value; T.autoGrow(ta); T.markFilled(ta); S.save(); };
    T.sug.bind(el, "mscom", { redraw: () => T.refresh("msReport"),
      items: () => [{ id: "com", label: "", current: d.grade_comment || "" }],
      local: () => T.sug.gradeComment(sel),
      apply: (id, t) => { d.grade_comment = t; },
      ai: () => T.sug.askText(sel, T.sug.TASKS.grade_comment, d.grade_comment) });
  };

  const redrawAll = () => T.refresh("msSource", "msSheet", "msStats", "msReport");
  T.renderMarkSheetPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "The mark sheet fills in as soon as you have saved at least one course in Course setup."}</p>
        <div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = `<section class="card" id="sec-mssrc"></section><section class="card" id="sec-mssheet"></section><section class="card" id="sec-msstats"></section><section class="card" id="sec-msrep"></section>`;
    redrawAll();
  };
  T.msParts = { parseMarkSheet, buildFromMarks, summary, crGrades, letterOf, isPG, defaultMap };
})();
