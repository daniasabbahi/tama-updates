/* Course Specification (TAMA dr_spec / dr_value / dr_fill_tp153, Dania 2026-11-28).
   The official NCAAA form: TP-153 (Diploma / Bachelor) or TPG-153 (Master / Doctor of Philosophy), chosen from the program in
   Course setup, in English or Arabic (assets/tp153_{ug|pg}_{en|ar}.docx).
   Parts that come from an earlier page are shown read-only and always follow that page (Dania's rule); the rest is typed here.
   Saved as TAMA: course_report[c].docs.course_spec = { fields: {part: text}, tables: {part: [rows], "<part>__typed": {row key: {col: text}}} }. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $$ = T.$$;
  const WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const clean = (v) => { const s = v === null || v === undefined ? "" : String(v); return ["nan", "none", "nat"].includes(s.trim().toLowerCase()) ? "" : s.trim(); };
  const ci = (sel, k) => clean((S.courseInfo(sel) || {})[k]);
  const isPG = (sel) => ["Master", "Doctor of Philosophy"].includes(ci(sel, "program"));
  const store = (sel, doc) => { const d = T.plan.crStore(sel); d.docs = d.docs && typeof d.docs === "object" ? d.docs : {}; const s = (d.docs[doc] = d.docs[doc] && typeof d.docs[doc] === "object" ? d.docs[doc] : {}); s.fields = s.fields || {}; s.tables = s.tables || {}; return s; };
  const DOM = { 1: "Knowledge and understanding", 2: "Skills", 3: "Values, autonomy and responsibility" };
  const cloAuto = (sel) => { let rows = []; try { rows = T.cloParts.reportRows(sel); } catch (e) { rows = []; }
    return rows.map((r) => ({ Code: r.no, CLO: r.text, Domain: DOM[r.g], "Aligned PLO": r.plos, "Teaching strategies": "", "Assessment methods": r.methText.replace(/\*/g, "") })); };
  const topicsAuto = (sel) => { const seen = []; (S.data.tables.slos || []).filter((r) => String(r.course_code) === String(sel)).forEach((r) => { const t = clean(r.topic); if (t && !seen.includes(t)) seen.push(t); }); return seen.map((t, i) => ({ No: i + 1, "List of topics": t, "Contact hours": "" })); };
  const grading = (sel) => { try { return T.plan.gradingRows(sel); } catch (e) { return []; } };

  // [id, label, kind, auto(sel) or null, source: [page label, page hash, key column, typed columns] or null]
  const SETUP = (k) => ["Course setup", "course-setup", null, []];
  const SPEC = [
    ["#", "A. General information about the course"],
    ["course_name", "Course title", "text", (c) => ci(c, "course_name"), SETUP()],
    ["course_code", "Course code", "text", (c) => T.baseCode(c), SETUP()],
    ["program", "Program", "text", (c) => ci(c, "program"), SETUP()],
    ["department", "Department", "text", (c) => ci(c, "department"), SETUP()],
    ["faculty", "College", "text", (c) => ci(c, "faculty"), SETUP()],
    ["institution", "Institution", "text", (c) => ci(c, "institution"), SETUP()],
    ["version", "Version", "text", null, null],
    ["revision_date", "Last revision date", "text", null, null],
    ["credit_hours", "1. Credit hours", "text", (c) => ci(c, "credit_hours"), SETUP()],
    ["course_type", "2A. Course type", "text", (c) => ci(c, "course_type"), SETUP()],
    ["course_req", "2B. Required or elective", "text", (c) => ci(c, "course_req"), SETUP()],
    ["level", "3. Level / year at which the course is offered", "text", (c) => ci(c, "level"), SETUP()],
    ["description", "4. Course general description", "area", (c) => ci(c, "description"), SETUP()],
    ["prerequisites", "5. Pre-requisites for this course (if any)", "text", (c) => ci(c, "prerequisites"), SETUP()],
    ["corequisites", "6. Co-requisites for this course (if any)", "text", (c) => ci(c, "corequisites"), SETUP()],
    ["objective", "7. Course main objective(s)", "area", null, null],
    ["teaching_mode", "8. Teaching mode", ["No", "Mode of instruction", "Contact hours", "Percentage"],
      () => ["Traditional classroom", "E-learning", "Hybrid (traditional and e-learning)", "Distance learning"].map((m, i) => ({ No: i + 1, "Mode of instruction": m, "Contact hours": "", Percentage: "" })), null],
    ["contact_hours", "9. Contact hours (based on the academic semester)", ["No", "Activity", "Contact hours"],
      () => ["Lectures", "Laboratory / studio", "Field", "Tutorial", "Others (specify)", "Total"].map((a, i) => ({ No: i + 1, Activity: a, "Contact hours": "" })), null],
    ["#", "B. Course learning outcomes (CLOs), teaching strategies and assessment methods"],
    ["clos", "Course learning outcomes", ["Code", "CLO", "Domain", "Aligned PLO", "Teaching strategies", "Assessment methods"], cloAuto, ["Course setup and the Assessment plan", "course-setup", "Code", ["Teaching strategies"]]],
    ["#", "C. Course content"],
    ["content", "Course content", ["No", "List of topics", "Contact hours"], topicsAuto, ["Lectures & SLOs", "lectures-slos", "List of topics", ["Contact hours"]]],
    ["#", "D. Students assessment activities"],
    ["assessment", "Assessment activities", ["No", "Assessment activities", "Assessment timing (week no)", "Percentage of total assessment score"],
      (c) => grading(c).map((r, i) => ({ No: i + 1, "Assessment activities": clean(r.Assessment), "Assessment timing (week no)": clean(r["Due date"]), "Percentage of total assessment score": clean(r.Weight) })), ["Assessment plan", "assessment-plan", null, []]],
    ["#", "E. Learning resources and facilities"],
    ["essential_refs", "Essential references", "area", null, null],
    ["supportive_refs", "Supportive references", "area", null, null],
    ["electronic", "Electronic materials", "area", null, null],
    ["other_materials", "Other learning materials", "area", null, null],
    ["fac_rooms", "Facilities (classrooms, laboratories, exhibition rooms, simulation rooms, etc.)", "area", null, null],
    ["fac_tech", "Technology equipment (projector, smart board, software)", "area", null, null],
    ["fac_other", "Other equipment (depending on the nature of the specialty)", "area", null, null],
    ["#", "F. Assessment of course quality"],
    ["quality", "Assessment of course quality", ["Assessment areas / issues", "Assessor", "Assessment methods"],
      () => ["Effectiveness of teaching", "Effectiveness of students assessment", "Quality of learning resources", "The extent to which CLOs have been achieved", "Other"].map((a) => ({ "Assessment areas / issues": a, Assessor: "", "Assessment methods": "" })), null],
    ["#", "G. Specification approval"],
    ["council", "Council / committee", "text", null, null],
    ["reference_no", "Reference no.", "text", null, null],
    ["approval_date", "Date", "text", null, null],
  ];
  const FIXED = new Set(["No", "Mode of instruction", "Activity", "Assessment areas / issues"]);
  const DOCS = { course_spec: SPEC };
  const parts = (doc) => DOCS[doc].filter((p) => p[0] !== "#");
  const isTbl = (p) => Array.isArray(p[2]);

  function value(sel, doc, p) {
    const s = store(sel, doc), [pid, , kind, auto, src] = p;
    let v; try { v = auto ? auto(sel) : (isTbl(p) ? [] : ""); } catch (e) { v = isTbl(p) ? [] : ""; }
    if (src) {
      if (isTbl(p) && src[3].length && v.length) { const ex = s.tables[pid + "__typed"] || {}; v = v.map((r) => Object.assign({}, r, Object.fromEntries(Object.entries(ex[clean(r[src[2]])] || {}).filter(([, t]) => t)))); }
      return v;
    }
    const box = isTbl(p) ? s.tables : s.fields;
    return pid in box ? box[pid] : v;
  }
  function status(sel, doc) {
    const ps = parts(doc), n = ps.filter((p) => { const v = value(sel, doc, p); return Array.isArray(v) ? v.length : clean(v); }).length;
    return [n === ps.length, `${n} of ${ps.length} parts filled`];
  }

  /* ---------------------------------------------------------------- the page */
  function html(sel, doc) {
    const pg = isPG(sel), prog = ci(sel, "program");
    if (doc !== "course_spec") return htmlParts(sel, doc, `<p class="note">Parts marked “from …” come from that page and change only there; type the rest here. The policies start with the usual KAU text: change them as you need. Everything saves itself.</p>
      <div class="row-btns"><button class="btn primary" data-dsdl="${doc}">⬇ ${doc === "syllabus" ? "Syllabus" : esc(doc)} (Word)</button></div>`);
    return htmlParts(sel, doc, `<p class="note">Program of this course in Course setup: <b>${esc(prog || "not chosen yet")}</b>, so the <b>${pg ? "postgraduate (TPG-153)" : "undergraduate (TP-153)"}</b> NCAAA form is used. Parts marked “from …” come from that page and change only there; type the rest here. Everything saves itself.</p>
      <div class="row-btns"><button class="btn primary" data-dsdl="en">⬇ Course Specification (Word, English)</button><button class="btn" data-dsdl="ar">⬇ توصيف المقرر (Word, العربية)</button></div>
      <p class="note">The Arabic form gets the same data; write the typed parts in Arabic for that file.</p>`);
  }
  function htmlParts(sel, doc, out) {
    DOCS[doc].forEach((p) => {
      if (p[0] === "#") { out += `<h3 class="qm-h">${esc(p[1])}</h3>`; return; }
      const [pid, label, kind, , src] = p, v = value(sel, doc, p), from = src ? `<span class="ds-from">from <a href="#${src[1]}">${esc(src[0])}</a></span>` : "";
      if (!isTbl(p)) {
        if (src) out += `<div class="fld ds-ro"><span class="lbl">${esc(label)} ${from}</span><div class="ds-val">${clean(v) ? esc(v).replace(/\n/g, "<br>") : `<span class="warn-text">Empty: fill it in ${esc(src[0])}</span>`}</div></div>`;
        else out += `<label class="fld ${clean(v) ? "filled" : ""}"><span class="lbl">${esc(label)}</span>${kind === "area" ? `<textarea rows="2" data-dsf="${pid}">${esc(v)}</textarea>` : `<input type="text" data-dsf="${pid}" value="${esc(v)}">`}</label>`;
        return;
      }
      const cols = kind, typed = src ? src[3] : cols.filter((c) => !FIXED.has(c));
      out += `<div class="fld"><span class="lbl">${esc(label)} ${from}</span>
        ${v.length ? `<div class="bp-wrap" style="overflow-x:auto"><table class="tbl ds-tbl"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
        ${v.map((r, i) => `<tr>${cols.map((c) => typed.includes(c) ? `<td><textarea class="cell" rows="1" data-dst="${pid}" data-i="${i}" data-c="${esc(c)}">${esc(clean(r[c]))}</textarea></td>` : `<td class="${c === "No" || c === "Code" ? "ctr" : ""}">${esc(clean(r[c]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
          : `<p class="warn-text">Nothing yet: fill it in ${src ? esc(src[0]) : "the page"}.</p>`}</div>`;
    });
    return out;
  }
  function bind(el, sel, doc, dl) {
    const s = store(sel, doc);
    $$("[data-dsf]", el).forEach((x) => { if (x.tagName === "TEXTAREA") T.autoGrow(x); x.oninput = () => { s.fields[x.dataset.dsf] = x.value; if (x.tagName === "TEXTAREA") T.autoGrow(x); T.markFilled && T.markFilled(x); S.saveSoon(); }; });
    $$("[data-dst]", el).forEach((x) => {
      T.autoGrow(x);
      x.oninput = () => {
        const p = parts(doc).find((q) => q[0] === x.dataset.dst), src = p[4], i = +x.dataset.i, c = x.dataset.c, cur = value(sel, doc, p);
        if (src) { const key = clean(cur[i][src[2]]), ex = (s.tables[p[0] + "__typed"] = s.tables[p[0] + "__typed"] || {}); (ex[key] = ex[key] || {})[c] = x.value; }
        else { const rows = cur.map((r) => Object.assign({}, r)); rows[i][c] = x.value; s.tables[p[0]] = rows; }
        T.autoGrow(x); S.saveSoon();
      };
    });
    $$("[data-dsdl]", el).forEach((b) => b.onclick = async () => {
      const lang = b.dataset.dsdl; b.disabled = true;
      if (T.docBuilders && T.docBuilders[lang]) { try { dl(await T.docBuilders[lang](sel), `${lang === "syllabus" ? "Syllabus" : lang}_${T.baseCode(sel).replace(/[^\w.-]+/g, "_")}.docx`); } catch (e) { T.toast(`The file could not be made (${e.message || e}).`, "warn"); } b.disabled = false; return; }
      try { dl(await fillSpec(sel, lang), `${lang === "ar" ? "Course_Specification_Arabic" : "Course_Specification"}_${T.baseCode(sel).replace(/[^\w.-]+/g, "_")}.docx`); }
      catch (e) { T.toast(`The file could not be made (${e.message || e}).`, "warn"); }
      b.disabled = false;
    });
  }

  /* ---------------------------------------------------------------- the Word file (TAMA dr_fill_tp153) */
  const kids = (n, tg) => [...n.childNodes].filter((c) => c.namespaceURI === WNS && c.localName === tg);
  const textOf = (n) => [...n.getElementsByTagNameNS(WNS, "t")].map((t) => t.textContent).join("");
  const mk = (doc, n) => doc.createElementNS(WNS, "w:" + n);
  const runT = (doc, rPr, text) => { const r = mk(doc, "r"); if (rPr) r.appendChild(rPr.cloneNode(true)); const t = mk(doc, "t"); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = text; r.appendChild(t); return r; };
  const noBold = (rPr) => { if (!rPr) return null; const c = rPr.cloneNode(true); kids(c, "b").concat(kids(c, "bCs")).forEach((x) => c.removeChild(x)); return c; };
  function cellSet(tc, text) {   // keeps the first paragraph and its first run's look (direction, font, size), without bold
    const doc = tc.ownerDocument, ps = kids(tc, "p"); let p0 = ps[0]; if (!p0) { p0 = mk(doc, "p"); tc.appendChild(p0); }
    ps.slice(1).forEach((p) => tc.removeChild(p));
    const r0 = kids(p0, "r")[0], rPr = noBold(r0 ? kids(r0, "rPr")[0] : null);
    kids(p0, "r").forEach((r) => p0.removeChild(r)); [...p0.childNodes].filter((c) => c.localName === "sdt" || c.localName === "hyperlink").forEach((c) => p0.removeChild(c));
    clean(text).split("\n").forEach((line, i) => { let p = p0; if (i) { p = p0.cloneNode(false); const pp = kids(p0, "pPr")[0]; if (pp) p.appendChild(pp.cloneNode(true)); tc.appendChild(p); } p.appendChild(runT(doc, rPr, line)); });
  }
  function afterColon(tc, value) {
    const doc = tc.ownerDocument, p = kids(tc, "p")[0]; if (!p) return;
    let seen = false, colonRun = null;
    kids(p, "r").forEach((r) => { const ts = r.getElementsByTagNameNS(WNS, "t"); if (seen) { p.removeChild(r); return; } const tx = textOf(r); if (tx.includes(":")) { let left = tx.slice(0, tx.indexOf(":") + 1); [...ts].forEach((t, k) => { t.textContent = k === 0 ? left : ""; }); seen = true; colonRun = r; } });
    [...p.childNodes].filter((c) => c.localName === "sdt").forEach((c) => p.removeChild(c));
    if (clean(value) || seen) p.appendChild(runT(doc, noBold(colonRun ? kids(colonRun, "rPr")[0] : null), " " + clean(value)));
  }
  function fillDots(tc, value) {
    if (!clean(value)) return; const pat = /[.…]{3,}/;
    for (const p of kids(tc, "p")) {
      for (const t of p.getElementsByTagNameNS(WNS, "t")) if (pat.test(t.textContent)) { t.textContent = t.textContent.replace(pat, ` ${clean(value)} `); return; }
      const ts = [...p.getElementsByTagNameNS(WNS, "t")], full = ts.map((t) => t.textContent).join("");
      if (pat.test(full) && ts.length) { ts[0].textContent = full.replace(pat, ` ${clean(value)} `); ts.slice(1).forEach((t) => (t.textContent = "")); return; }
    }
  }
  function tick(tc) { for (const t of tc.getElementsByTagNameNS(WNS, "t")) if (t.textContent.includes("☐")) { t.textContent = t.textContent.replace("☐", "☒"); return; } }
  function rowsFill(tbl, items, cols, keepFirst = 1, keepLast = 0, numbered = true) {
    const trs = kids(tbl, "tr"), body = trs.slice(keepFirst, trs.length - keepLast); if (!body.length) return;
    const proto = body[0].cloneNode(true), anchor = body[body.length - 1].nextSibling;
    body.forEach((tr) => tbl.removeChild(tr));
    (items.length ? items : [{}]).forEach((it, i) => { const tr = proto.cloneNode(true); tbl.insertBefore(tr, anchor); const autoNo = numbered && kids(tr, "tc")[0] && kids(tr, "tc")[0].getElementsByTagNameNS(WNS, "numPr").length > 0;   // the form numbers the rows itself
      const vals = (numbered ? [autoNo ? "" : String(i + 1)] : []).concat(cols.map((c) => clean(it[c]))); kids(tr, "tc").forEach((tc, k) => { if (k < vals.length) cellSet(tc, vals[k]); }); });
  }
  async function fillSpec(sel, lang) {
    await T.importer.lib("jszip");
    const pg = isPG(sel), buf = await (await fetch(`assets/tp153_${pg ? "pg" : "ug"}_${lang}.docx`)).arrayBuffer(), z = await JSZip.loadAsync(buf);
    const doc = new DOMParser().parseFromString(await z.file("word/document.xml").async("string"), "application/xml");
    const body = doc.getElementsByTagNameNS(WNS, "body")[0];
    const Tb = [...body.getElementsByTagNameNS(WNS, "tbl")].filter((t) => { for (let n = t.parentNode; n && n !== body; n = n.parentNode) if (n.localName === "tbl") return false; return true; });
    const V = (pid) => value(sel, "course_spec", parts("course_spec").find((p) => p[0] === pid));
    const rows = (t) => kids(t, "tr"), cells = (tr) => kids(tr, "tc");
    ["course_name", "course_code", "program", "department", "faculty", "institution", "version", "revision_date"].forEach((pid, i) => { const tr = rows(Tb[0])[i]; if (tr) afterColon(cells(tr)[0], V(pid)); });
    const t1 = rows(Tb[1]);
    fillDots(cells(t1[0])[0], V("credit_hours"));
    const a = cells(t1[3]), b = cells(t1[4]);
    const ta = { University: 1, College: 2, Department: 3, Track: 4, Others: 5 }[V("course_type")]; if (ta && ta < a.length) tick(a[ta]);
    const tb = { Required: 1, Elective: 2 }[V("course_req")]; if (tb && tb < b.length) tick(b[tb]);
    fillDots(cells(t1[5])[0], V("level"));
    [[7, "description"], [9, "prerequisites"], [11, "corequisites"], [13, "objective"]].forEach(([r, pid]) => { if (t1[r]) cellSet(cells(t1[r])[0], V(pid)); });
    [[2, "teaching_mode"], [3, "contact_hours"]].forEach(([ti, pid]) => {
      const list = V(pid) || [], trs = rows(Tb[ti]).slice(1);
      trs.forEach((tr, k) => {
        if (k >= list.length) return;
        const cs = cells(tr), vals = [list[k]["Contact hours"], list[k].Percentage];
        let start = cs.length > 2 ? 2 : cs.length - 1;
        if (pid === "contact_hours" && k === trs.length - 1) start = cs.length - 1;
        cs.slice(start).forEach((c, j) => { if (clean(vals[j])) cellSet(c, vals[j]); });
      });
    });
    // B. CLOs by domain
    const t4 = Tb[4], all = rows(t4), heads = all.map((tr, i) => [tr, i]).filter(([tr]) => ["1.0", "2.0", "3.0"].includes(textOf(cells(tr)[0]).trim())).map(([, i]) => i);
    const groups = { 1: [], 2: [], 3: [] }; (V("clos") || []).forEach((r) => { let g = String(r.Code || "").split(".")[0]; if (!groups[g]) g = { K: "1", S: "2", V: "3" }[String(r.Domain || "").slice(0, 1).toUpperCase()] || "2"; groups[g].push(r); });
    heads.slice().reverse().forEach((hIdx, hi0) => {
      const hi = heads.length - 1 - hi0, start = hIdx + 1, end = hi + 1 < heads.length ? heads[hi + 1] : all.length, bodyRows = all.slice(start, end);
      if (!bodyRows.length) return;
      const proto = bodyRows[0].cloneNode(true); let anchor = all[hIdx]; bodyRows.forEach((tr) => t4.removeChild(tr));
      const g = String(hi + 1), items = groups[g].length ? groups[g] : [{ Code: `${g}.1` }];
      items.forEach((it) => { const tr = proto.cloneNode(true); t4.insertBefore(tr, anchor.nextSibling); anchor = tr; const vals = [it.Code, it.CLO, it["Aligned PLO"], it["Teaching strategies"], it["Assessment methods"]]; cells(tr).forEach((c, k) => { if (k < vals.length) cellSet(c, clean(vals[k])); }); });
    });
    // C. content (keeps the Total row) and D. assessment
    const content = (V("content") || []).filter((r) => clean(r["List of topics"]));
    rowsFill(Tb[5], content, ["List of topics", "Contact hours"], 1, 1);
    const hrs = content.map((r) => parseFloat(String(r["Contact hours"]).replace(",", "."))).filter((x) => !isNaN(x));
    if (hrs.length) { const last = rows(Tb[5]).slice(-1)[0], cs = cells(last); cellSet(cs[cs.length - 1], String(Math.round(hrs.reduce((x, y) => x + y, 0) * 100) / 100)); }
    rowsFill(Tb[6], (V("assessment") || []).filter((r) => clean(r["Assessment activities"])), ["Assessment activities", "Assessment timing (week no)", "Percentage of total assessment score"]);
    ["essential_refs", "supportive_refs", "electronic", "other_materials"].forEach((pid, i) => { const tr = rows(Tb[7])[i]; if (tr) { const cs = cells(tr); cellSet(cs[cs.length - 1], V(pid)); } });
    ["fac_rooms", "fac_tech", "fac_other"].forEach((pid, i) => { const tr = rows(Tb[8])[i + 1]; if (tr) { const cs = cells(tr); cellSet(cs[cs.length - 1], V(pid)); } });
    const q = V("quality") || []; rows(Tb[9]).slice(1).forEach((tr, k) => { if (k < q.length) { const cs = cells(tr); if (cs.length >= 3) { cellSet(cs[1], q[k].Assessor); cellSet(cs[2], q[k]["Assessment methods"]); } } });
    ["council", "reference_no", "approval_date"].forEach((pid, i) => { const tr = rows(Tb[10])[i]; if (tr) { const cs = cells(tr); cellSet(cs[cs.length - 1], V(pid)); } });
    z.file("word/document.xml", new XMLSerializer().serializeToString(doc));
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  T.docSpec = { has: (id) => id in DOCS, status, html, bind, value, parts, fillSpec, DOCS, store, isPG, cellSet, rowsFill };
})();
