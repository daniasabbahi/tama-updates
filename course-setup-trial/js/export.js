/* Export reports (TAMA's Export page and "Fill forms with my course data", Dania 2026-11-22).
   1. Fill my own form: a Word or Excel form kept in Settings (ui_settings.forms) is read, the places to fill are found
      ({{placeholders}}, "Label:" with an empty space or cell after it, tables with empty rows under a heading row),
      each place is matched once to a piece of course data (saved in the form's map, so the next course is one click),
      and the filled file is downloaded. Only labels go to the AI tool, never student data.
   2. Course Report readiness of every course, with the Word file of each.
   3. All the data in one Excel workbook, and a backup of the data file. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", SNS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? null : x; };
  const f = (v, d = 2) => (v === null || v === undefined || isNaN(v) ? "" : String(Math.round(v * 10 ** d) / 10 ** d));
  const U = () => (S.data.ui_settings = S.data.ui_settings && typeof S.data.ui_settings === "object" ? S.data.ui_settings : {});
  const ci = (sel) => S.courseInfo(sel) || {};
  const tag = (sel) => T.baseCode(sel).replace(/[^\w.-]+/g, "_");
  const b64ToU8 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const norm = (t) => T.s(t).toLowerCase().replace(/[{}:：*_.…()\[\]]/g, " ").replace(/\s+/g, " ").trim();
  const CR_GRADES = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];

  /* ---------------------------------------------------------------- the data a form can use (TAMA ff_catalog) */
  function catalog(sel) {
    const c = ci(sel), Sg = {}, L = {}, put = (k, grp, lab, v) => { Sg[k] = [grp, lab, v === null || v === undefined ? "" : String(v)]; };
    [["course_code", "Course code", T.baseCode(sel)], ["course_name", "Course name", c.course_name], ["department", "Department", c.department], ["faculty", "Faculty / college", c.faculty],
      ["institution", "University / institution", c.institution], ["program", "Program", c.program], ["term", "Term / semester", T.termLabel(c.term)], ["year", "Academic year", c.year],
      ["course_director", "Course coordinator", c.course_director], ["instructor", "Instructor(s)", c.instructor], ["location", "Location / campus", c.location], ["sections", "Sections", c.sections],
      ["credit_hours", "Credit hours", c.credit_hours], ["level", "Level / year of the course", c.level]].forEach(([k, l, v]) => put(k, "Course details", l, v));
    const rd = T.s(c.report_date).trim(), dd = rd ? new Date(rd) : new Date();
    put("report_date", "Course details", "Report date", isNaN(dd) ? rd : dd.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }));
    put("today", "Course details", "Today's date", new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }));
    put("offering", "Course details", "Offering (term and year)", [T.termLabel(c.term), T.s(c.year)].filter((x) => T.s(x).trim()).join(" "));
    const rows = (() => { try { return T.cloParts.reportRows(sel); } catch (e) { return []; } })();
    const tb = (n) => (S.data.tables[n] || []).filter((r) => String(r.course_code) === String(sel));
    put("n_clos", "Course details", "Number of CLOs", rows.length); put("n_slos", "Course details", "Number of SLOs", tb("slos").length);
    put("clo_list", "Course details", "All CLOs (one per line)", rows.map((r) => `${r.no} ${r.text}`).join("\n"));
    let v = null; try { v = T.markSheet(sel); if (v && !v.rows.length) v = null; } catch (e) { v = null; }
    const g = v ? T.msParts.crGrades(sel, v) : null, st = v ? T.sug.statsOf(T.sug.gradedRows(v).map((r) => r.final)) : null, gs = g ? g.status : {}, gp = g ? g.status_pct : {};
    [["students_started", "Students who started", g && g.started], ["students_completed", "Students who completed", g && g.completed], ["students_passed", "Students who passed", gs.Pass],
      ["students_failed", "Students who failed", gs.Fail], ["students_withdrawn", "Students who withdrew", gs.Withdrawn], ["students_denied", "Students denied entry (DN)", gs["Denied Entry"]],
      ["pass_percent", "Pass rate (%)", g ? f(gp.Pass, 1) : ""], ["fail_percent", "Fail rate (%)", g ? f(gp.Fail, 1) : ""], ["withdrawn_percent", "Withdrawal rate (%)", g ? f(gp.Withdrawn, 1) : ""],
      ["mean_mark", "Mean final mark", st ? f(st.mean, 1) : ""], ["median_mark", "Median final mark", st ? f(st.median, 1) : ""], ["sd_mark", "Standard deviation of final marks", st ? f(st.sd, 1) : ""],
      ["lowest_mark", "Lowest final mark", st ? f(st.min, 1) : ""], ["highest_mark", "Highest final mark", st ? f(st.max, 1) : ""], ["pass_mark", "Pass mark", v ? f(v.pass_mark) : ""], ["final_max", "Final mark out of", v ? f(v.final_max) : ""]]
      .forEach(([k, l, x]) => put(k, "Students and grades", l, x));
    CR_GRADES.forEach((G) => { put(`grade_${G}_count`, "Students and grades", `Number with grade ${G}`, g ? g.counts[G] : ""); put(`grade_${G}_percent`, "Students and grades", `% with grade ${G}`, g ? f(g.counts_pct[G], 1) : ""); });
    const meas = rows.filter((r) => r.actual !== null && r.actual !== undefined), met = meas.filter((r) => r.target !== null && r.actual >= r.target);
    put("clos_measured", "CLO achievement", "Number of CLOs measured", meas.length); put("clos_met", "CLO achievement", "Number of CLOs that met the target", met.length);
    put("clos_not_met", "CLO achievement", "Number of CLOs below the target", meas.length - met.length); put("clos_met_percent", "CLO achievement", "% of measured CLOs that met the target", meas.length ? f(met.length / meas.length * 100, 1) : "");
    put("clos_met_list", "CLO achievement", "CLOs that met the target (list)", met.map((r) => r.no).join(", ")); put("clos_not_met_list", "CLO achievement", "CLOs below the target (list)", meas.filter((r) => !met.includes(r)).map((r) => r.no).join(", "));
    const d = T.plan.crStore(sel), ev = d.eval || {}, topics = Object.entries(d.topics && typeof d.topics === "object" ? d.topics : {}).filter(([, x]) => x && x.not_covered);
    [["grade_comment", "Comment on student grades", d.grade_comment], ["recommendations", "Recommendations (CLO results)", d.recommendations], ["student_evaluation", "Overall student evaluation", ev.text],
      ["survey_responses", "Survey: number of responses", ev.responses], ["survey_rating", "Survey: overall rating", ev.rating], ["survey_strengths", "Survey: what students liked", ev.strengths],
      ["survey_weaknesses", "Survey: what students want improved", ev.weaknesses], ["topics_not_covered", "Topics not covered (one per line)", topics.map(([t, x]) => t + (x.reason ? ` (${x.reason})` : "")).join("\n") || "None"]]
      .forEach(([k, l, x]) => put(k, "Course report texts", l, T.s(x)));
    rows.forEach((r, i) => { const n = i + 1, G = "Each CLO";
      put(`clo${n}_number`, G, `CLO ${n}: number (${r.no})`, r.no); put(`clo${n}_code`, G, `CLO ${n}: code`, r.cid); put(`clo${n}_text`, G, `CLO ${n}: statement`, r.text);
      put(`clo${n}_target`, G, `CLO ${n}: target level (%)`, f(r.target)); put(`clo${n}_actual`, G, `CLO ${n}: actual level (%)`, f(r.actual)); put(`clo${n}_methods`, G, `CLO ${n}: assessment methods`, r.methText.replace(/\*/g, "")); put(`clo${n}_comment`, G, `CLO ${n}: comment`, r.comment); });
    const dom = { 1: "Knowledge and understanding", 2: "Skills", 3: "Values, autonomy and responsibility" }, metT = (r) => (r.actual === null || r.actual === undefined || r.target === null ? "" : r.actual >= r.target ? "Achieved" : "Not achieved");
    L.clo = { label: "CLOs", cols: { number: "Number (1.1, 2.1 ...)", code: "Code", text: "Statement", domain: "Domain", plos: "Linked PLOs", methods: "Assessment methods", target: "Target level (%)", actual: "Actual level (%)", met: "Achieved / not achieved", comment: "Comment" },
      rows: rows.map((r) => ({ number: r.no, code: r.cid, text: r.text, domain: dom[r.g] || "", plos: r.plos, methods: r.methText.replace(/\*/g, ""), target: f(r.target), actual: f(r.actual), met: metT(r), comment: r.comment })) };
    L.slo = { label: "SLOs", cols: { code: "Code", text: "Statement", topic: "Lecture / topic", clo: "Linked CLO", methods: "Assessment methods" }, rows: tb("slos").map((r) => ({ code: T.s(r.slo_id), text: T.s(r.slo_text), topic: T.s(r.topic), clo: T.s(r.clo_id), methods: T.s(r.assessment_methods) })) };
    L.grade = { label: "Grade distribution", cols: { grade: "Grade", count: "Number of students", percent: "% of students" }, rows: g ? CR_GRADES.map((G) => ({ grade: G, count: String(g.counts[G]), percent: f(g.counts_pct[G], 1) })) : [] };
    L.status = { label: "Student status", cols: { status: "Status", count: "Number of students", percent: "% of students" }, rows: g ? Object.keys(gs).map((k) => ({ status: k, count: String(gs[k]), percent: f(gp[k], 1) })) : [] };
    const per = v ? T.sug.perAssess(v) : {};
    L.assessment = { label: "Assessments", cols: { name: "Assessment", full_grade: "Full grade", mean_percent: "Mean %" }, rows: tb("course_assessments").map((r) => ({ name: T.s(r.assessment), full_grade: f(num(r.full_grade)), mean_percent: f(per[T.s(r.assessment)], 1) })) };
    const cur = Sg.offering[2], a = tb("actions"), offT = [T.s(c.term).trim(), T.s(c.year).trim()].filter(Boolean).join(" ");
    const acols = { clo: "CLO", gap: "Recommendation / issue", action: "Action", owner: "Responsible", due_date: "Due date", status: "Status", support: "Needed support", achieved: "% achieved", comments: "Comments", offering: "Offering" };
    const arow = (r) => ({ clo: T.s(r.clo_id), gap: T.s(r.gap), action: T.s(r.action), owner: T.s(r.owner), due_date: T.s(r.due_date), status: T.s(r.status), support: T.s(r.support), achieved: T.s(r.pct_achieved), comments: T.s(r.comments), offering: T.s(r.offering) });
    L.plan = { label: "Improvement plan (this offering)", cols: acols, rows: a.filter((r) => T.s(r.offering) === offT || T.s(r.offering) === cur).map(arow) };
    L.last_action = { label: "Actions from last offering", cols: acols, rows: a.filter((r) => !(T.s(r.offering) === offT || T.s(r.offering) === cur)).map(arow) };
    L.topic = { label: "Topics not covered", cols: { topic: "Topic", reason: "Reason", impact: "Impact on learning outcomes", action: "Compensating action" }, rows: topics.map(([t, x]) => ({ topic: t, reason: T.s(x.reason), impact: T.s(x.impact), action: T.s(x.action) })) };
    return { S: Sg, L };
  }
  T.ffCatalog = catalog;

  const SYN = {
    course_name: ["course title", "course name", "title of the course", "name of the course", "اسم المقرر", "عنوان المقرر"], course_code: ["course code", "course number", "code", "course no", "رمز المقرر", "رقم المقرر"],
    department: ["department", "dept", "القسم"], faculty: ["faculty", "college", "school", "الكلية"], institution: ["university", "institution", "الجامعة", "المؤسسة"], program: ["program", "programme", "البرنامج"],
    term: ["term", "semester", "الفصل الدراسي", "الفصل"], year: ["academic year", "year", "العام الدراسي", "السنة"], course_director: ["course coordinator", "coordinator", "course director", "course leader", "منسق المقرر"],
    instructor: ["instructor", "instructors", "teacher", "lecturer", "faculty member", "course instructor", "أستاذ المقرر", "عضو هيئة التدريس"], location: ["location", "campus", "branch", "الموقع", "المقر"],
    sections: ["sections", "section", "number of sections", "الشعب", "الشعبة"], report_date: ["date", "report date", "date of report", "التاريخ", "تاريخ التقرير"], today: ["today", "today's date"], offering: ["offering", "course offering"],
    credit_hours: ["credit hours", "credits", "الساعات المعتمدة"], level: ["level", "course level", "المستوى"],
    students_started: ["number of students", "students enrolled", "enrolled students", "no of students", "total students", "number of students starting the course", "عدد الطلاب", "عدد الطلبة"],
    students_completed: ["students completed", "completed the course", "number of students completed", "number of students completed the course"], students_passed: ["passed", "number passed", "students passed", "الناجحين"],
    students_failed: ["failed", "number failed", "students failed", "الراسبين"], students_withdrawn: ["withdrawn", "withdrew", "students withdrawn", "المنسحبين"], pass_percent: ["pass rate", "success rate", "passing rate", "نسبة النجاح"],
    mean_mark: ["mean", "average", "average mark", "mean mark", "class average", "المتوسط"], sd_mark: ["standard deviation", "sd", "الانحراف المعياري"], grade_comment: ["comment on student grades", "comment on grades", "grades comment"],
    recommendations: ["recommendations", "التوصيات"], student_evaluation: ["student evaluation", "students evaluation", "overall student evaluation"], topics_not_covered: ["topics not covered", "topics not taught"],
  };
  const LSYN = { clo: ["clo", "learning outcome", "course learning outcome", "outcome"], grade: ["grade"], plan: ["recommendation", "improvement"], last_action: ["action"], topic: ["topic"], assessment: ["assessment"], slo: ["slo"] };
  function autoKey(text, cat) {
    const t = norm(text); if (!t) return "";
    const direct = t.replace(/ /g, "_"); if (cat.S[direct]) return direct;
    for (const [k, list] of Object.entries(SYN)) if (cat.S[k] && list.some((s) => s === t)) return k;
    const byLabel = Object.entries(cat.S).find(([, x]) => norm(x[1]) === t); if (byLabel) return byLabel[0];
    for (const [k, list] of Object.entries(SYN)) if (cat.S[k] && list.some((s) => s.length > 3 && (t.startsWith(s + " ") || t.endsWith(" " + s)))) return k;
    return "";
  }
  /** Matches the heading cells of one table to the columns of ONE list (the list most headings point to). */
  function autoTable(heads, cat) {
    const score = {}; Object.entries(cat.L).forEach(([n, x]) => { score[n] = heads.filter((h) => { const t = norm(h); return Object.entries(x.cols).some(([c, l]) => norm(l) === t || norm(c.replace(/_/g, " ")) === t || norm(l).includes(t) || (t.length > 3 && t.includes(norm(c.replace(/_/g, " "))))); }).length; });
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0]; if (!best || !best[1]) return heads.map(() => "");
    const [n] = best, cols = cat.L[n].cols;
    return heads.map((h) => { const t = norm(h);
      let hit = Object.entries(cols).find(([c, l]) => norm(l) === t || norm(c.replace(/_/g, " ")) === t) || Object.entries(cols).find(([c, l]) => norm(l).includes(t) || (t.length > 3 && t.includes(norm(c.replace(/_/g, " ")))));
      if (!hit && n === "clo" && /\bclos?\b|no\b|number/.test(t)) hit = ["number"];
      return hit ? `${n}.${hit[0]}` : ""; });
  }
  function autoCol(text, cat) {
    const t = norm(text); if (!t) return "";
    for (const [n, x] of Object.entries(cat.L)) for (const [c, lab] of Object.entries(x.cols)) if (norm(lab) === t || norm(c.replace(/_/g, " ")) === t) return `${n}.${c}`;
    const pairs = [["statement", "clo.text"], ["clo", "clo.number"], ["target", "clo.target"], ["actual", "clo.actual"], ["comment", "clo.comment"], ["action", "plan.action"], ["recommendation", "plan.gap"], ["needed support", "plan.support"], ["topic", "topic.topic"], ["reason", "topic.reason"], ["grade", "grade.grade"]];
    const hit = pairs.find(([w]) => t.includes(w)); return hit ? hit[1] : "";
  }

  /* ---------------------------------------------------------------- Word forms */
  const kids = (n, tg) => [...n.childNodes].filter((c) => c.namespaceURI === WNS && c.localName === tg);
  const textOf = (n) => [...n.getElementsByTagNameNS(WNS, "t")].map((t) => t.textContent).join("");
  const PH = /\{\{\s*([^{}]{1,80}?)\s*\}\}/g, phKey = (s) => T.s(s).toLowerCase().trim().replace(/\s*\.\s*/g, ".").replace(/[^a-z0-9_.\u0600-\u06ff+%]+/g, "_").replace(/^_+|_+$/g, "");
  const COLON_END = /^\s*(.{2,80}?)\s*[:：]\s*[._…\s-]*$/;
  const inTable = (p) => { for (let n = p.parentNode; n; n = n.parentNode) if (n.localName === "tbl") return true; return false; };
  async function openDocx(u8) { await T.importer.lib("jszip"); const z = await JSZip.loadAsync(u8); const doc = new DOMParser().parseFromString(await z.file("word/document.xml").async("string"), "application/xml"); return { z, doc, body: doc.getElementsByTagNameNS(WNS, "body")[0] }; }
  const topTables = (body) => [...body.getElementsByTagNameNS(WNS, "tbl")].filter((t) => { for (let n = t.parentNode; n && n !== body; n = n.parentNode) if (n.localName === "tbl") return false; return true; });
  function detectDocx(body) {
    const found = new Map(), add = (id, where, text, kind = "single") => { if (!found.has(id)) found.set(id, { id, where, text, kind }); };
    const paras = [...body.getElementsByTagNameNS(WNS, "p")];
    paras.forEach((p) => { const t = textOf(p); let m; PH.lastIndex = 0; while ((m = PH.exec(t))) { const k = phKey(m[1]); add("ph::" + k, k.includes(".") ? "Table row {{ }}" : "Placeholder {{ }}", `{{${m[1]}}}`, k.includes(".") ? "column" : "single"); } });
    topTables(body).forEach((tb, ti) => {
      const rows = kids(tb, "tr").map((tr) => kids(tr, "tc")), texts = rows.map((r) => r.map((tc) => textOf(tc).trim()));
      if (!rows.length) return;
      const head = texts[0], empties = texts.slice(1).some((r) => r.every((x) => !x)), isCols = head.length >= 2 && head.every(Boolean) && empties && !head.some((x) => x.includes("{{"));
      if (isCols) head.forEach((h, c) => add(`col::${ti}::${c}`, `Table ${ti + 1}: column`, h, "column"));
      texts.forEach((r, j) => { if (j === 0 && isCols) return; r.forEach((t, i) => {
        if (!t || t.includes("{{") || t.length > 80) return;
        const nx = i + 1 < r.length ? r[i + 1] : null;
        if (nx === "" || (COLON_END.test(t) && (nx === null || COLON_END.test(nx)))) add("lbl::" + norm(t), "Label in a table", t.replace(/[\s:：._…-]+$/, ""));
      }); });
    });
    paras.forEach((p) => { if (inTable(p)) return; const t = textOf(p); if (t.includes("{{")) return; const m = t.match(COLON_END); if (m) add("lbl::" + norm(m[1]), "Label at the end of a line", m[1].trim()); });
    return [...found.values()];
  }
  function setParaText(p, text) {
    const doc = p.ownerDocument, runs = kids(p, "r"), first = runs[0], rPr = first ? kids(first, "rPr")[0] : null;
    runs.forEach((r) => p.removeChild(r));
    T.s(text).split("\n").forEach((line, i, arr) => { const r = doc.createElementNS(WNS, "w:r"); if (rPr) r.appendChild(rPr.cloneNode(true)); const t = doc.createElementNS(WNS, "w:t"); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = line; r.appendChild(t); if (i < arr.length - 1) r.appendChild(doc.createElementNS(WNS, "w:br")); p.appendChild(r); });
  }
  function appendRun(p, text) {
    const doc = p.ownerDocument, runs = kids(p, "r"), last = runs[runs.length - 1], rPr = last ? kids(last, "rPr")[0] : null;
    // drop dots / underscores after the colon
    runs.slice().reverse().some((r) => { const t = textOf(r); if (/^[\s._…-]*$/.test(t)) { p.removeChild(r); return false; } const tt = r.getElementsByTagNameNS(WNS, "t"); const lt = tt[tt.length - 1]; if (lt) lt.textContent = lt.textContent.replace(/[\s._…-]+$/, ""); return true; });
    T.s(text).split("\n").forEach((line, i) => { const r = doc.createElementNS(WNS, "w:r"); if (rPr) { const c = rPr.cloneNode(true); kids(c, "b").concat(kids(c, "bCs")).forEach((x) => c.removeChild(x)); r.appendChild(c); } if (i) r.appendChild(doc.createElementNS(WNS, "w:br")); const t = doc.createElementNS(WNS, "w:t"); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = (i ? "" : " ") + line; r.appendChild(t); p.appendChild(r); });
  }
  function fillDocx(body, val, colVal) {
    const paras = [...body.getElementsByTagNameNS(WNS, "p")];
    paras.forEach((p) => { const t = textOf(p); if (!t.includes("{{")) return; PH.lastIndex = 0; const nt = t.replace(PH, (all, k) => { const key = phKey(k); return key.includes(".") ? all : val("ph::" + key, all); }); if (nt !== t) setParaText(p, nt); });
    const cellSet = T.docParts.cellSet;
    topTables(body).forEach((tb, ti) => {
      const trs = kids(tb, "tr"), rows = trs.map((tr) => kids(tr, "tc")), texts = rows.map((r) => r.map((tc) => textOf(tc).trim()));
      if (!rows.length) return;
      // {{list.col}} rows: the row is repeated once per item
      const phRow = trs.findIndex((tr) => /\{\{\s*[^{}]+\.[^{}]+\}\}/.test(textOf(tr)));
      if (phRow >= 0) {
        const tr = trs[phRow], name = (textOf(tr).match(/\{\{\s*([^{}.]+)\./) || [])[1], items = colVal.rows(phKey(name || ""));
        let last = tr; items.forEach((it) => { const nt = tr.cloneNode(true); [...nt.getElementsByTagNameNS(WNS, "p")].forEach((p) => { const t = textOf(p); if (t.includes("{{")) setParaText(p, t.replace(PH, (a, k) => T.s(it[phKey(k).split(".")[1]]))); }); tb.insertBefore(nt, last.nextSibling); last = nt; });
        if (items.length) tb.removeChild(tr); else [...tr.getElementsByTagNameNS(WNS, "p")].forEach((p) => { if (textOf(p).includes("{{")) setParaText(p, ""); });
        return;
      }
      const head = texts[0], firstEmpty = texts.findIndex((r, j) => j > 0 && r.every((x) => !x)), isCols = head.length >= 2 && head.every(Boolean) && firstEmpty > 0;
      if (isCols) {
        const map = head.map((h, c) => colVal.key(`col::${ti}::${c}`)), lists = [...new Set(map.filter(Boolean).map((k) => k.split(".")[0]))];
        if (lists.length) {
          const items = colVal.rows(lists[0]);
          T.docParts.fillRows(tb, firstEmpty, items.length ? items : [{}], (cells, it) => cells.forEach((tc, c) => { const k = map[c]; if (k && k.startsWith(lists[0] + ".")) cellSet(tc, T.s(it[k.split(".")[1]]), { size: 10 }); else if (k && k.startsWith("=")) cellSet(tc, k.slice(1), { size: 10 }); }));
        }
      }
      rows.forEach((r, j) => { if (j === 0 && isCols) return; r.forEach((tc, i) => {
        const t = texts[j][i]; if (!t || t.includes("{{") || t.length > 80) return;
        const id = "lbl::" + norm(t), v = val(id, null); if (v === null) return;
        const nx = i + 1 < r.length ? texts[j][i + 1] : null;
        if (nx === "") cellSet(r[i + 1], v, { size: 10 });
        else if (COLON_END.test(t)) { const p = kids(tc, "p").find((pp) => COLON_END.test(textOf(pp))); if (p) appendRun(p, v); }
      }); });
    });
    paras.forEach((p) => { if (inTable(p) || !p.parentNode) return; const t = textOf(p); if (t.includes("{{")) return; const m = t.match(COLON_END); if (!m) return; const v = val("lbl::" + norm(m[1]), null); if (v !== null) appendRun(p, v); });
  }

  /* ---------------------------------------------------------------- Excel forms (the file's own XML, so its look is kept) */
  const colN = (s) => s.split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0), colS = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  async function openXlsx(u8) {
    await T.importer.lib("jszip"); const z = await JSZip.loadAsync(u8), P = (x) => new DOMParser().parseFromString(x, "application/xml");
    const ssF = z.file("xl/sharedStrings.xml"), shared = ssF ? [...P(await ssF.async("string")).getElementsByTagNameNS(SNS, "si")].map((si) => [...si.getElementsByTagNameNS(SNS, "t")].map((t) => t.textContent).join("")) : [];
    const wbx = P(await z.file("xl/workbook.xml").async("string")), rels = await z.file("xl/_rels/workbook.xml.rels").async("string");
    const sheets = [...wbx.getElementsByTagNameNS(SNS, "sheet")].map((s) => { const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"); const m = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)); return { name: s.getAttribute("name"), path: m ? "xl/" + m[1].replace(/^\/?xl\//, "").replace(/^\//, "") : null }; }).filter((s) => s.path && z.file(s.path));
    for (const s of sheets) s.doc = P(await z.file(s.path).async("string"));
    return { z, shared, sheets };
  }
  const cellStr = (c, shared) => { const t = c.getAttribute("t"), v = c.getElementsByTagNameNS(SNS, "v")[0]; if (t === "s") return v ? shared[+v.textContent] || "" : ""; if (t === "inlineStr") return [...c.getElementsByTagNameNS(SNS, "t")].map((x) => x.textContent).join(""); return v ? v.textContent : ""; };
  function detectXlsx(x) {
    const found = new Map(), add = (id, where, text, kind = "single") => { if (!found.has(id)) found.set(id, { id, where, text, kind }); };
    x.sheets.forEach((s) => {
      const cells = [...s.doc.getElementsByTagNameNS(SNS, "c")], at = new Map(cells.map((c) => [c.getAttribute("r"), c]));
      cells.forEach((c) => { const v = cellStr(c, x.shared); if (!v) return; let m; PH.lastIndex = 0; let any = false;
        while ((m = PH.exec(v))) { any = true; const k = phKey(m[1]); add("ph::" + k, "Placeholder {{ }}", `{{${m[1]}}}`, k.includes(".") ? "column" : "single"); }
        if (any) return;
        if (COLON_END.test(v) && v.length <= 80) { const r = c.getAttribute("r").match(/^([A-Z]+)(\d+)$/), nb = r && at.get(colS(colN(r[1]) + 1) + r[2]); if (!nb || !cellStr(nb, x.shared).trim()) add("lbl::" + norm(v), `Label on sheet ${s.name}`, v.replace(/[\s:：._…-]+$/, "")); } });
    });
    return [...found.values()];
  }
  function setCell(doc, c, value) {
    [...c.childNodes].forEach((n) => c.removeChild(n));
    const n = num(value);
    if (n !== null && /^-?\d+(\.\d+)?$/.test(T.s(value).trim())) { c.removeAttribute("t"); const v = doc.createElementNS(SNS, "v"); v.textContent = String(n); c.appendChild(v); return; }
    c.setAttribute("t", "inlineStr"); const is = doc.createElementNS(SNS, "is"), t = doc.createElementNS(SNS, "t"); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = T.s(value); is.appendChild(t); c.appendChild(is);
  }
  function fillXlsx(x, val) {
    x.sheets.forEach((s) => {
      const doc = s.doc, cells = [...doc.getElementsByTagNameNS(SNS, "c")], at = new Map(cells.map((c) => [c.getAttribute("r"), c]));
      cells.forEach((c) => {
        const v = cellStr(c, x.shared); if (!v) return;
        if (v.includes("{{")) { PH.lastIndex = 0; const nv = v.replace(PH, (all, k) => val("ph::" + phKey(k), all)); if (nv !== v) setCell(doc, c, nv); return; }
        if (!COLON_END.test(v)) return;
        const got = val("lbl::" + norm(v), null); if (got === null) return;
        const r = c.getAttribute("r").match(/^([A-Z]+)(\d+)$/); if (!r) return;
        const ref = colS(colN(r[1]) + 1) + r[2]; let nb = at.get(ref);
        if (!nb) { nb = doc.createElementNS(SNS, "c"); nb.setAttribute("r", ref); const st = c.getAttribute("s"); if (st) nb.setAttribute("s", st); c.parentNode.insertBefore(nb, c.nextSibling); at.set(ref, nb); }
        else if (cellStr(nb, x.shared).trim()) return;
        setCell(doc, nb, got);
      });
      x.z.file(s.path, new XMLSerializer().serializeToString(doc));
    });
  }

  /* ---------------------------------------------------------------- reading and filling a saved form */
  const forms = () => U().forms || [];
  const isX = (n) => /\.xls[xm]$/i.test(n);
  async function detect(form) { const u8 = b64ToU8(form.data); if (isX(form.name)) return detectXlsx(await openXlsx(u8)); const d = await openDocx(u8); return detectDocx(d.body); }
  function valueOf(key, cat) { if (!key) return null; if (key.startsWith("=")) return key.slice(1); if (cat.S[key]) return cat.S[key][2]; return null; }
  async function fill(form, sel) {
    const cat = catalog(sel), map = form.map || {}, u8 = b64ToU8(form.data);
    const val = (id, dflt) => { const k = map[id]; const v = valueOf(k, cat); return v === null ? dflt : v; };
    if (isX(form.name)) { const x = await openXlsx(u8); fillXlsx(x, val); return x.z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); }
    const d = await openDocx(u8);
    fillDocx(d.body, val, { key: (id) => map[id] || "", rows: (name) => (cat.L[name] ? cat.L[name].rows : []) });
    d.z.file("word/document.xml", new XMLSerializer().serializeToString(d.doc));
    return d.z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  T.ffParts = { detect, fill, catalog, autoKey, autoCol, autoTable };

  const places = {};   // form name -> the places found (in memory)
  T.sections.exForms = function () {
    const sel = T.current(), el = $("#sec-exforms"); if (!el) return;
    const fs = forms().filter((x) => /\.(docx|xlsx|xlsm)$/i.test(x.name));
    let name = S.ui.ffForm; if (!fs.some((x) => x.name === name)) name = fs.length ? fs[0].name : "";
    const form = fs.find((x) => x.name === name), cat = catalog(sel);
    const head = `<div class="sec-head" id="h-exforms"><div><h2>Fill my own form with the course data</h2><p class="sub">Choose a Word or Excel form you saved in <a href="#settings">Settings</a>. TAMA finds the places to fill and matches each one to the course data. Check the matches once: they are kept with the form, so next time (or for another course) it is one click.</p></div></div>`;
    if (!form) { el.innerHTML = `${head}<div class="row-btns"><label class="btn primary">Add a form<input type="file" id="ex-addf" accept=".docx,.xlsx,.xlsm" hidden></label><a class="btn" href="#settings">Go to Settings</a></div><p class="note">No Word or Excel form saved yet.</p>`; bindAdd(el); return; }
    const pl = places[name];
    if (!pl) { el.innerHTML = `${head}<p class="note">Reading ${esc(name)}…</p>`; detect(form).then((p) => { places[name] = p; T.refresh("exForms"); }).catch((e) => { places[name] = []; T.toast(`The form could not be read (${e.message || e}).`, "warn"); T.refresh("exForms"); }); return; }
    const map = (form.map = form.map && typeof form.map === "object" ? form.map : {});
    let changed = false;
    const byTbl = {}; pl.filter((p) => p.id.startsWith("col::") && !(p.id in map)).forEach((p) => { const t = p.id.split("::")[1]; (byTbl[t] = byTbl[t] || []).push(p); });
    Object.values(byTbl).forEach((ps) => { const ks = autoTable(ps.map((p) => p.text), cat); ps.forEach((p, i) => { map[p.id] = ks[i]; }); changed = true; });
    pl.forEach((p) => { if (!(p.id in map)) { map[p.id] = p.kind === "column" ? (p.id.startsWith("ph::") ? "" : autoCol(p.text, cat)) : autoKey(p.id.startsWith("ph::") ? p.id.slice(4).replace(/_/g, " ") : p.text, cat); changed = true; } });
    if (changed) S.save();
    const grpOpts = (cur) => { const by = {}; Object.entries(cat.S).forEach(([k, [g, l]]) => { (by[g] = by[g] || []).push([k, l]); }); return Object.entries(by).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([k, l]) => `<option value="${esc(k)}" ${k === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</optgroup>`).join(""); };
    const colOpts = (cur) => Object.entries(cat.L).map(([n, x]) => `<optgroup label="${esc(x.label)}">${Object.entries(x.cols).map(([c, l]) => `<option value="${n}.${c}" ${`${n}.${c}` === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</optgroup>`).join("");
    const show = (p) => { const k = map[p.id]; if (p.id.startsWith("ph::") && p.kind === "column") return `<span class="note">One row per item of ${esc((cat.L[p.id.slice(4).split(".")[0]] || {}).label || "?")}</span>`; if (!k) return `<span class="note">Left empty</span>`; if (p.kind === "column") { const [n] = k.split("."); return `<span class="note">${cat.L[n] ? `${cat.L[n].rows.length} row(s)` : ""}</span>`; } const v = valueOf(k, cat); return v ? esc(v.length > 90 ? v.slice(0, 90) + "…" : v) : `<span class="warn-text">No data yet</span>`; };
    const nMatched = pl.filter((p) => map[p.id] || (p.id.startsWith("ph::") && p.kind === "column")).length;
    el.innerHTML = `${head}
      <div class="grid g2"><label class="fld filled" for="ex-form"><span class="lbl">Form</span><select id="ex-form">${fs.map((x) => `<option ${x.name === name ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <div class="fld"><span class="lbl">&nbsp;</span><div class="row-btns"><label class="btn sm">Add another form<input type="file" id="ex-addf" accept=".docx,.xlsx,.xlsm" hidden></label></div></div></div>
      ${pl.length ? `<p class="note">${pl.length} place(s) found, ${nMatched} matched. Change any match below; choose <b>Leave empty</b> for places you fill by hand.</p>
        <div class="bp-wrap" style="overflow-x:auto"><table class="tbl ex-tbl" style="min-width:760px"><thead><tr><th>In the form</th><th style="width:150px">Kind of place</th><th style="width:270px">Fill it with</th><th>For ${esc(T.baseCode(sel))}</th></tr></thead><tbody>
        ${pl.map((p, i) => { const k = map[p.id] || "", fixed = k.startsWith("=");
          return `<tr><td><b>${esc(p.text)}</b></td><td class="note">${esc(p.where)}</td><td>${p.id.startsWith("ph::") && p.kind === "column" ? `<span class="note">Filled by the {{ }} names</span>` : `<select class="cell" data-exm="${i}"><option value="">Leave empty</option><option value="=" ${fixed ? "selected" : ""}>Type a fixed text…</option>${p.kind === "column" ? colOpts(k) : grpOpts(k)}</select>${fixed ? `<input class="cell" data-exfix="${i}" value="${esc(k.slice(1))}" placeholder="The text to write">` : ""}`}</td><td>${show(p)}</td></tr>`; }).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn primary" id="ex-fill">⬇ Download ${esc(name)} filled for ${esc(T.baseCode(sel))}</button><button class="btn" id="ex-auto">Match again automatically</button><button class="btn" id="ex-ai" ${T.aiReady() ? "" : "disabled"} title="${T.aiReady() ? "Only the labels of the form go to your AI tool" : "Link your own AI tool under Ask the assistant (bottom right)"}">🤖 Match with AI</button></div>`
        : `<div class="alert-box"><span class="alert-ic">⚠</span><span>No places to fill were found in this form. Write the labels with a colon and leave the space after them empty (for example <b>Course code:</b>), or put {{course_code}} where the data goes. See <a href="#settings">Settings</a> for the names.</span></div>`}`;
    bindAdd(el);
    $("#ex-form", el).onchange = (e) => { S.ui.ffForm = e.target.value; S.saveUi(); T.refresh("exForms"); };
    $$("[data-exm]", el).forEach((s) => s.onchange = () => { const p = pl[+s.dataset.exm]; map[p.id] = s.value === "=" ? "=" + (map[p.id] && map[p.id].startsWith("=") ? map[p.id].slice(1) : "") : s.value; S.save(); T.refresh("exForms"); });
    $$("[data-exfix]", el).forEach((x) => x.onchange = () => { map[pl[+x.dataset.exfix].id] = "=" + x.value; S.save(); T.refresh("exForms"); });
    const fb = $("#ex-fill", el); if (fb) fb.onclick = async () => { fb.disabled = true; try { dl(await fill(form, sel), name.replace(/(\.\w+)$/, ` ${tag(sel)}$1`)); } catch (e) { T.toast(`The form could not be filled (${e.message || e}).`, "warn"); } fb.disabled = false; };
    const ab = $("#ex-auto", el); if (ab) ab.onclick = () => { pl.forEach((p) => delete map[p.id]); S.save(); T.refresh("exForms"); };
    const ai = $("#ex-ai", el); if (ai) ai.onclick = async () => {
      ai.disabled = true;
      try {
        const opts = Object.entries(cat.S).map(([k, [, l]]) => `${k}: ${l}`).join("\n"), cols = Object.entries(cat.L).flatMap(([n, x]) => Object.entries(x.cols).map(([c, l]) => `${n}.${c}: ${x.label} › ${l}`)).join("\n");
        const got = await T.aiJson(`A form has these places to fill (id | kind | label):\n${pl.map((p) => `${p.id} | ${p.kind} | ${p.text}`).join("\n")}\n\nSINGLE VALUES (key: meaning)\n${opts}\n\nTABLE COLUMNS (key: meaning)\n${cols}\n\nTASK\nMatch each place to the best key (single values for kind single, table columns for kind column), or "" when nothing fits or the place needs a person's judgement. Return a JSON object {id: key}.`);
        if (got && typeof got === "object") Object.entries(got).forEach(([id, k]) => { const p = pl.find((x) => x.id === id); if (p && (k === "" || cat.S[k] || (p.kind === "column" && cat.L[String(k).split(".")[0]]))) map[id] = k; });
        S.save(); T.toast("Matched with AI: check each match before you download."); T.refresh("exForms");
      } catch (e) { T.toast(`The AI could not match the form (${e.message || e}).`, "warn"); ai.disabled = false; }
    };
  };
  function bindAdd(el) {
    const fi = $("#ex-addf", el); if (!fi) return;
    fi.onchange = async () => {
      const file = fi.files[0]; if (!file) return;
      if (file.size > 1500000) { T.toast("This form is larger than 1.5 MB and was not added.", "warn"); return; }
      const u8 = new Uint8Array(await file.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      const u = U(), old = (u.forms || []).find((x) => x.name === file.name) || {};
      u.forms = (u.forms || []).filter((x) => x.name !== file.name).concat([{ name: file.name, data: btoa(s), map: old.map || {} }]);
      delete places[file.name]; S.ui.ffForm = file.name; S.saveUi(); S.save(); T.toast("Form saved (it is also listed in Settings)."); T.refresh("exForms");
    };
  }

  T.sections.exReady = function () {
    const el = $("#sec-exready"); if (!el) return;
    const codes = S.t("courses").map((r) => String(r.course_code)), parts = codes.length ? T.crStatus(codes[0]).map((x) => x[0].split(" ")[0].replace(/\.$/, "")) : [];
    el.innerHTML = `<div class="sec-head" id="h-exready"><div><h2>Course Report: what is ready in each course</h2><p class="sub">✓ means the part of the Course Report is filled. Open a course's missing parts from <a href="#documents">Documents and reports</a>.</p></div></div>
      ${codes.length ? `<div class="bp-wrap" style="overflow-x:auto"><table class="tbl xs-tbl"><thead><tr><th>Course</th>${T.crStatus(codes[0]).map((x) => `<th class="ctr" title="${esc(x[0])}">${esc(x[0].replace(/^([A-F]\d?)\..*$/, "$1").replace(/^Course details.*/, "Cover"))}</th>`).join("")}<th class="ctr">Ready</th><th></th></tr></thead><tbody>
        ${codes.map((c, i) => { const s = T.crStatus(c), k = s.filter((x) => x[1]).length; return `<tr><td style="min-width:210px">${esc(S.courseLabel(c))}</td>${s.map((x) => `<td class="ctr">${x[1] ? '<span class="ok-text">✓</span>' : '<span class="note">–</span>'}</td>`).join("")}<td class="ctr"><b>${k}/${s.length}</b></td><td><button class="btn xs" data-excr="${i}">⬇ Word</button></td></tr>`; }).join("")}</tbody></table></div>` : `<p class="note">No courses yet.</p>`}`;
    void parts;
    $$("[data-excr]", el).forEach((b) => b.onclick = async () => { const c = codes[+b.dataset.excr]; b.disabled = true; try { dl(await T.courseReportDocx(c), `Course_Report_${tag(c)}.docx`); } catch (e) { T.toast(`The file could not be made (${e.message || e}).`, "warn"); } b.disabled = false; });
  };

  T.sections.exData = function () {
    const el = $("#sec-exdata"); if (!el) return;
    el.innerHTML = `<div class="sec-head" id="h-exdata"><div><h2>All your data</h2><p class="sub">Every table of TAMA in one Excel workbook (one sheet per table), or the whole data file as a backup you can open again later.</p></div></div>
      <div class="row-btns"><button class="btn primary" id="ex-xlsx">⬇ All data (Excel)</button><button class="btn" id="ex-json">⬇ Backup of the data file (.json)</button></div>`;
    $("#ex-xlsx", el).onclick = async () => {
      await T.importer.lib("xlsx"); const wb = XLSX.utils.book_new(), used = new Set();
      Object.entries(S.data.tables || {}).forEach(([n, rows]) => { if (!Array.isArray(rows) || !rows.length) return; let nm = n.slice(0, 31); while (used.has(nm)) nm = nm.slice(0, 29) + used.size; used.add(nm); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), nm); });
      if (!used.size) { T.toast("There is no data yet.", "warn"); return; }
      XLSX.writeFile(wb, "tama_all_data.xlsx");
    };
    $("#ex-json", el).onclick = () => dl(new Blob([JSON.stringify(S.data, null, 1)], { type: "application/json" }), `tama_backup_${new Date().toISOString().slice(0, 10)}.json`);
  };

  T.renderExportPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📤</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "Add a course in Course setup first."}</p></div><section class="card" id="sec-exdata"></section>`;
      T.refresh("exData"); return;
    }
    content.innerHTML = ["exforms", "exready", "exdata"].map((k) => `<section class="card" id="sec-${k}"></section>`).join("");
    T.refresh("exForms", "exReady", "exData");
  };
})();
