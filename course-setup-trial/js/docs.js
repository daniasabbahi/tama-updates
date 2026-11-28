/* Documents and reports (TAMA render_documents_page, Dania 2026-11-22).
   One box per document. Opening a box shows what is filled from the data, what is still missing (with a link to the page
   where it is filled), and the downloads.
   - Course Report (TP-154 / TPG-154 cover for postgraduate courses): the official ETEC Word template (assets/tp154.docx)
     filled as TAMA's build_course_report_docx.
   - Student grades report and CLO achievement level: Word and Excel files made here.
   - Course Specification and Syllabus: listed, built in the next update.
   T.word.make(bodyXml, {landscape, title}) builds a simple Word file; it is used by the other pages too. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const X = (s) => T.s(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? null : x; };
  const f = (v, d = 2) => (v === null || v === undefined || isNaN(v) ? "" : String(Math.round(v * 10 ** d) / 10 ** d));
  const same = (r, sel) => String(r.course_code) === String(sel);
  const crs = (sel) => T.plan.crStore(sel);
  const ci = (sel) => S.courseInfo(sel) || {};
  const offering = (sel) => [T.s(ci(sel).term).trim(), T.s(ci(sel).year).trim()].filter(Boolean).join(" ") || "This offering";
  const sheet = (sel) => { try { const v = T.markSheet(sel); return v && v.rows.length ? v : null; } catch (e) { return null; } };
  const grades = (sel) => { const v = sheet(sel); return v ? T.msParts.crGrades(sel, v) : null; };
  const cloRows = (sel) => { try { return T.cloParts.reportRows(sel); } catch (e) { return []; } };
  const acts = (sel) => (S.data.tables.actions || []).filter((r) => same(r, sel));
  const tag = (sel) => T.baseCode(sel).replace(/[^\w.-]+/g, "_");
  const CR_GRADES = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];
  function reportDate(sel) { const v = T.s(ci(sel).report_date).trim(); const d = v ? new Date(v) : new Date(); return isNaN(d) ? v : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const isPG = (sel) => ["Master", "Doctor of Philosophy"].includes(T.s(ci(sel).program).trim()) || (T.msParts && T.msParts.isPG(sel));

  /* ---------------------------------------------------------------- a simple Word file */
  const run = (t, o = {}) => (t === "" || t === null || t === undefined ? "" : String(t).split("\n").map((line, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr>${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}</w:rPr><w:t xml:space="preserve">${X(line)}</w:t></w:r>`).join(""));
  const para = (runs, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}<w:spacing w:before="${o.before || 0}" w:after="${o.after === undefined ? 80 : o.after}"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}</w:pPr>${runs}</w:p>`;
  function table(head, rows, o = {}) {
    const W = o.width || 9000, ws = o.cols || head.map(() => Math.floor(W / head.length));
    const cell = (t, w, h, extra = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${h ? '<w:shd w:val="clear" w:color="auto" w:fill="1F2A44"/>' : extra.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${extra.fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${para(run(t, { b: h || extra.b, color: h ? "FFFFFF" : extra.color, sz: o.sz || 18 }), { after: 0, jc: extra.jc })}</w:tc>`;
    const B = ["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="B7B2C8"/>`).join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblBorders>${B}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>
      <w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => cell(h, ws[i], true, { jc: (o.center || []).includes(i) ? "center" : undefined })).join("")}</w:tr>
      ${rows.map((r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => { const o2 = c && typeof c === "object" ? c : { t: c }; return cell(o2.t, ws[i], false, Object.assign({ jc: (o.center || []).includes(i) ? "center" : undefined }, o2)); }).join("")}</w:tr>`).join("")}</w:tbl>${para("", { after: 120 })}`;
  }
  async function make(body, o = {}) {
    await T.importer.lib("jszip");
    const z = new JSZip(), land = !!o.landscape, pw = land ? 16838 : 11906, ph = land ? 11906 : 16838;
    const logo = T.settingsLogo ? T.settingsLogo() : null;
    let head = "", rels = "", ctx = "";
    if (logo) {
      const ext = logo.type === "image/png" ? "png" : "jpeg", [w, h] = logo.size || [4, 3], cy = 640000, cx = Math.round(cy * w / h);
      z.file(`word/media/logo.${ext === "jpeg" ? "jpg" : "png"}`, logo.b64, { base64: true });
      rels = `<Relationship Id="rLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${ext === "jpeg" ? "jpg" : "png"}"/>`;
      ctx = `<Default Extension="${ext === "jpeg" ? "jpg" : "png"}" ContentType="image/${ext}"/>`;
      head = `<w:p><w:pPr><w:jc w:val="${o.logoAlign || "left"}"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="900" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="900" name="logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${ctx}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
    z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    z.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels}</Relationships>`);
    z.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${WNS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>
      <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
      <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="34"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="6B4E71"/><w:sz w:val="26"/></w:rPr></w:style></w:styles>`);
    z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${WNS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${head}${body}<w:sectPr><w:pgSz w:w="${pw}" w:h="${ph}"${land ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="1000" w:right="900" w:bottom="1000" w:left="900" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  T.word = { make, run, para, table, X };
  const docHead = (sel, title) => para(run(title), { style: "Title", after: 60 }) + para(run(`${T.baseCode(sel)} ${T.s(ci(sel).course_name)} · ${T.termLabel(ci(sel).term)} ${T.s(ci(sel).year)}`, { color: "555555" }), { after: 40 })
    + para(run([ci(sel).department, ci(sel).faculty, ci(sel).institution].map(T.s).filter((x) => x.trim()).join(" · "), { color: "777777", sz: 18 }), { after: 200 });

  /* ---------------------------------------------------------------- what is filled (TAMA cr_status) */
  function crStatus(sel) {
    const d = crs(sel), c = ci(sel), rows = cloRows(sel), a = acts(sel), cur = offering(sel);
    const topics = d.topics && typeof d.topics === "object" ? d.topics : {};
    return [
      ["Course details (cover page)", ["course_name", "department", "program", "faculty", "institution", "year", "term", "course_director"].every((k) => T.s(c[k]).trim()), "course-setup", "Course setup"],
      ["A1. Grade distribution", !!grades(sel), "mark-sheet", "Course mark sheet"],
      ["A2. Comment on student grades", !!T.s(d.grade_comment).trim(), "mark-sheet", "Course mark sheet"],
      ["B1. CLO results (actual level)", rows.length > 0 && rows.every((r) => r.actual !== null && r.actual !== undefined), "clo-achievement", "CLO achievement"],
      ["B1. Comments on CLO results", rows.length > 0 && rows.every((r) => T.s(r.comment).trim()), "clo-achievement", "CLO achievement"],
      ["B2. Recommendations", !!T.s(d.recommendations).trim(), "clo-achievement", "CLO achievement"],
      ["C. Topics not covered", !!d.topics_none || Object.values(topics).some((v) => v && v.not_covered), "lectures-slos", "Lectures & SLOs"],
      ["D. Actions from last offering", a.some((r) => T.s(r.offering) !== cur), "action-plan", "Improvement action plan"],
      ["E. Student evaluation", !!T.s((d.eval || {}).text).trim(), "action-plan", "Improvement action plan"],
      ["F. Course improvement plan", a.some((r) => T.s(r.offering) === cur), "action-plan", "Improvement action plan"],
    ];
  }
  T.crStatus = crStatus;

  /* ---------------------------------------------------------------- the Course Report (TAMA build_course_report_docx) */
  const kids = (n, tag) => [...n.childNodes].filter((c) => c.namespaceURI === WNS && c.localName === tag);
  const textOf = (n) => [...n.getElementsByTagNameNS(WNS, "t")].map((t) => t.textContent).join("");
  const cellText = (tc) => kids(tc, "p").map(textOf).join("\n").trim();
  function cellSet(tc, text, o = {}) {
    const doc = tc.ownerDocument, el = (n) => doc.createElementNS(WNS, "w:" + n);
    const ps = kids(tc, "p"); let p = ps[0]; if (!p) { p = el("p"); tc.appendChild(p); } ps.slice(1).forEach((x) => tc.removeChild(x));
    const runs = kids(p, "r"); let keep = [];
    if (o.label) { for (const r of runs) { keep.push(r); if (textOf(r).includes(":")) break; } if (!keep.some((r) => textOf(r).includes(":"))) keep = []; }
    const proto = runs[runs.length - 1], prPr = proto ? kids(proto, "rPr")[0] : null;
    runs.forEach((r) => { if (!keep.includes(r)) p.removeChild(r); });
    [...p.childNodes].filter((c) => c.localName === "hyperlink" || c.localName === "sdt").forEach((c) => p.removeChild(c));
    const lines = T.s(text).split("\n");
    lines.forEach((line, i) => {
      const r = el("r"), pr = el("rPr");
      const copy = (n) => { const x = prPr && kids(prPr, n)[0]; if (x) pr.appendChild(x.cloneNode(true)); };
      copy("rFonts");
      if (o.bold) { pr.appendChild(el("b")); pr.appendChild(el("bCs")); }
      const it = el("i"); it.setAttributeNS(WNS, "w:val", "0"); pr.appendChild(it);
      const col = el("color"); col.setAttributeNS(WNS, "w:val", o.color || (o.label ? "5279BB" : "1F1F1F")); pr.appendChild(col);
      if (o.size) { ["sz", "szCs"].forEach((n) => { const s = el(n); s.setAttributeNS(WNS, "w:val", String(o.size * 2)); pr.appendChild(s); }); } else { copy("sz"); copy("szCs"); }
      copy("rtl"); copy("lang");
      r.appendChild(pr);
      const t = el("t"); t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = (o.label && i === 0 ? "  " : "") + line; r.appendChild(t);
      if (i < lines.length - 1) r.appendChild(el("br"));
      p.appendChild(r);
    });
    if (o.align) {
      let pPr = kids(p, "pPr")[0]; if (!pPr) { pPr = el("pPr"); p.insertBefore(pPr, p.firstChild); }
      kids(pPr, "jc").forEach((j) => pPr.removeChild(j));
      const jc = el("jc"); jc.setAttributeNS(WNS, "w:val", o.align);
      const after = [...pPr.childNodes].find((c) => ["textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"].includes(c.localName));
      pPr.insertBefore(jc, after || null);
    }
  }
  function fillRows(tbl, first, data, writer) {
    const trs = kids(tbl, "tr");
    while (first < trs.length - 1 && trs[first].getElementsByTagNameNS(WNS, "vMerge").length) first++;   // a two-row heading (merged cells) stays the heading
    const tmpl = trs.slice(first); if (!tmpl.length) return;
    const proto = tmpl[0].cloneNode(true); tmpl.slice(1).forEach((tr) => tbl.removeChild(tr));
    let last = tmpl[0]; const all = [last];
    for (let i = 1; i < Math.max(data.length, 1); i++) { const nt = proto.cloneNode(true); tbl.insertBefore(nt, last.nextSibling); last = nt; all.push(nt); }
    all.forEach((tr, i) => { if (i < data.length) writer(kids(tr, "tc"), data[i]); });
  }
  const AR_LABELS = { "اسم المقرر": "course_name", "رمز المقرر": "course_code", "القسم العلمي": "department", "البرنامج الأكاديمي": "program", "الكلية": "faculty", "المؤسسة": "institution", "العام الدراسي": "year", "الفصل الدراسي": "term", "أستاذ المقرر": "instructor", "منسق المقرر": "course_director", "عدد الشعب": "sections" };
  const pgByProgram = (sel) => ["Master", "Doctor of Philosophy"].includes(T.s(ci(sel).program).trim());
  async function courseReport(sel, lang) {
    const ar = lang === "ar";
    await T.importer.lib("jszip");
    const buf = await (await fetch(ar ? `assets/tp154_ar_${pgByProgram(sel) ? "pg" : "ug"}.docx` : "assets/tp154.docx")).arrayBuffer(), z = await JSZip.loadAsync(buf);
    const doc = new DOMParser().parseFromString(await z.file("word/document.xml").async("string"), "application/xml");
    const body = doc.getElementsByTagNameNS(WNS, "body")[0], Tb = kids(body, "tbl"), c = ci(sel), d = crs(sel), g = grades(sel);
    // cover: postgraduate courses get the TPG-154 cover picture (first-page header)
    if (!ar && isPG(sel)) {
      try {
        const sp = [...doc.getElementsByTagNameNS(WNS, "headerReference")].find((h) => h.getAttributeNS(WNS, "type") === "first" || h.getAttribute("w:type") === "first");
        const rid = sp && (sp.getAttribute("r:id") || sp.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
        const rels = await z.file("word/_rels/document.xml.rels").async("string"), hm = rid && rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || (rid && rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)));
        if (hm) {
          const hr = await z.file(`word/_rels/${hm[1]}.rels`).async("string"), im = hr.match(/Target="(media\/[^"]+)"/);
          if (im) z.file(`word/${im[1]}`, await (await fetch("assets/tpg154_cover.jpg")).arrayBuffer());
        }
      } catch (e) { /* keep the bachelor cover */ }
    }
    const vals = { "Course Title": c.course_name, "Course Code": T.baseCode(sel), Department: c.department, Program: c.program, College: c.faculty, Institution: c.institution,
      "Academic Year": c.year, Semester: T.termLabel(c.term), "Course Instructor": c.instructor, "Course Coordinator": c.course_director, "Number of Section(s)": c.sections, "Report Date": reportDate(sel) };
    kids(Tb[0], "tr").forEach((tr) => kids(tr, "tc").forEach((tc) => {
      const txt = cellText(tc), label = txt.split(":")[0].trim();
      if (label.startsWith("Number of Students")) cellSet(tc, g ? String(/Starting/.test(txt) ? g.started : g.completed) : "", { label: true });
      else if (label === "Location") {
        const boxes = [...tc.getElementsByTagNameNS(WNS, "t")].filter((t) => /[☐☒]/.test(t.textContent)), br = /branch/i.test(T.s(c.location));
        boxes.slice(0, 2).forEach((t, i) => { const want = br ? i === 1 : i === 0; t.textContent = t.textContent.replace("☒", "☐").replace("☐", want ? "☒" : "☐"); });
      } else if (label in vals) cellSet(tc, T.s(vals[label]), { label: true });
    }));
    if (ar && T.docSpec) {   // the Arabic cover: labels in Arabic (TAMA dr_cr_arabic)
      kids(Tb[0], "tr").forEach((tr) => kids(tr, "tc").forEach((tc) => {
        const lab = cellText(tc).split(":")[0].trim();
        if (lab in AR_LABELS) { const k = AR_LABELS[lab]; T.docSpec.afterColon(tc, k === "course_code" ? T.baseCode(sel) : k === "term" ? T.termLabel(c.term) : T.s(c[k])); }
        else if (lab.startsWith("عدد الطلاب")) T.docSpec.afterColon(tc, g ? String(lab.includes("بدأوا") ? g.started : g.completed) : "");
        else if (lab.startsWith("تاريخ إعداد التقرير")) T.docSpec.afterColon(tc, reportDate(sel));
        else if (lab.startsWith("مكان تقديم المقرر")) {
          const br = /branch|فرع/i.test(T.s(c.location)), boxes = [...tc.getElementsByTagNameNS(WNS, "t")].filter((t) => /[☐☒]/.test(t.textContent));
          if (boxes.length) boxes.slice(0, 2).forEach((t, i) => { const want = br ? i === 1 : i === 0; t.textContent = t.textContent.replace("☒", "☐").replace("☐", want ? "☒" : "☐"); });
          else T.docSpec.afterColon(tc, T.s(c.location));
        }
      }));
    }
    // A1 grades: row 2 numbers, row 3 percentages
    if (g) {
      const st = ["Denied Entry", "In Progress", "Incomplete", "Pass", "Fail", "Withdrawn"];
      const nums = CR_GRADES.map((L) => g.counts[L]).concat(st.map((k) => g.status[k])), pcts = CR_GRADES.map((L) => g.counts_pct[L]).concat(st.map((k) => g.status_pct[k]));
      const trs = kids(Tb[1], "tr");
      [[2, nums], [3, pcts]].forEach(([ri, vs]) => kids(trs[ri], "tc").slice(1).forEach((tc, i) => { const v = vs[i]; if (i < vs.length) cellSet(tc, v === null || v === undefined ? "" : ri === 2 ? String(v) : f(v), { size: ri === 2 ? 9 : 6, align: "center" }); }));
    }
    cellSet(kids(kids(Tb[2], "tr")[0], "tc")[0], T.s(d.grade_comment), { size: 10 });
    // B1 CLOs: per domain a group row ("1", "2", "3"), then item rows
    const tb = Tb[3], rows = cloRows(sel), groups = {}; let cg = null;
    kids(tb, "tr").slice(2).forEach((tr) => { const first = cellText(kids(tr, "tc")[0]); if (["1", "2", "3"].includes(first)) { cg = +first; groups[cg] = { head: tr, items: [] }; } else if (cg) groups[cg].items.push(tr); });
    Object.entries(groups).forEach(([gi, grp]) => {
      if (!grp.items.length) return;
      const items = rows.filter((r) => r.g === +gi), protos = [grp.items[0].cloneNode(true), (grp.items[1] || grp.items[0]).cloneNode(true)];
      grp.items.forEach((tr) => tb.removeChild(tr));
      let last = grp.head;
      (items.length ? items : [null]).forEach((it, k) => {
        const nt = protos[k % 2].cloneNode(true); tb.insertBefore(nt, last.nextSibling); last = nt;
        const cells = kids(nt, "tc");
        if (!it) { cells.forEach((tc) => cellSet(tc, "", { size: 9 })); return; }
        const v = [it.no, it.text, it.plos, it.methText, f(it.target), it.actual === null || it.actual === undefined ? "" : f(it.actual), it.comment];
        cells.forEach((tc, i) => { if (i < v.length) cellSet(tc, v[i], { size: i === 1 || i === 6 ? 8 : 9, align: i === 1 || i === 6 ? null : "center", color: i === 5 && it.actual !== null && it.target !== null && it.actual < it.target ? "B5651D" : null }); });
      });
    });
    if (rows.some((r) => r.methText.includes("*"))) {
      const names = [...new Set(rows.flatMap((r) => r.methText.split(",").map((s) => s.trim()).filter((s) => s.endsWith("*")).map((s) => s.slice(0, -1))))];
      const np = new DOMParser().parseFromString(`<w:p xmlns:w="${WNS}"><w:r><w:rPr><w:i/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">* ${X(names.join(", "))}: not included in the calculation of the actual level.</w:t></w:r></w:p>`, "application/xml").documentElement;
      tb.parentNode.insertBefore(doc.importNode(np, true), tb.nextSibling);
    }
    cellSet(kids(kids(Tb[4], "tr")[0], "tc")[0], T.s(d.recommendations), { size: 10 });
    // C topics not covered
    const tps = Object.entries(d.topics && typeof d.topics === "object" ? d.topics : {}).filter(([, v]) => v && v.not_covered);
    fillRows(Tb[5], 1, tps.length ? tps : [["None", {}]], (cells, [t, v]) => [t, v.reason, v.impact, v.action].forEach((x, i) => cells[i] && cellSet(cells[i], T.s(x), { size: 9 })));
    // D, E, F
    const a = acts(sel), cur = offering(sel), prev = a.filter((r) => T.s(r.offering) !== cur), plan = a.filter((r) => T.s(r.offering) === cur);
    fillRows(Tb[6], 1, prev.length ? prev : [{}], (cells, r) => { const v = [r.action, T.s(r.pct_achieved).trim() ? `${T.s(r.pct_achieved).trim()}%` : "", r.comments]; if (ar) v.reverse(); /* the Arabic form has these columns the other way round */ v.forEach((x, i) => cells[i] && cellSet(cells[i], T.s(x), { size: 9 })); });
    cellSet(kids(kids(Tb[7], "tr")[0], "tc")[0], T.s((d.eval || {}).text), { size: 10 });
    const t8 = kids(Tb[8], "tr"), merged = (tr) => tr.getElementsByTagNameNS(WNS, "vMerge").length > 0, fd = t8.length > 2 && (merged(t8[1]) || cellText(kids(t8[1], "tc")[0]).startsWith("Recommendations")) ? 2 : 1;
    fillRows(Tb[8], fd, plan.length ? plan : [{}], (cells, r) => [r.gap, r.action, r.support].forEach((x, i) => cells[i] && cellSet(cells[i], T.s(x), { size: 9 })));
    z.file("word/document.xml", new XMLSerializer().serializeToString(doc));
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  T.courseReportDocx = courseReport;

  /* ---------------------------------------------------------------- student grades report */
  function gradeRows(sel) {
    const v = sheet(sel); if (!v) return null;
    const cols = v.cols || Object.keys(v.max || {}).map((k) => ({ key: k, label: k, max: v.max[k] }));
    return { v, cols, rows: v.rows.map((r, i) => ({ n: i + 1, id: T.s(r.computer_no), name: T.s(r.name), marks: cols.map((c) => r.marks ? r.marks[c.key] : null), final: r.final, letter: r.status === "W" ? "W" : T.s(r.letter), status: r.status })) };
  }
  async function gradesDocx(sel) {
    const g = gradeRows(sel), gr = grades(sel), many = g.cols.length > 5;
    const head = ["No.", "ID", "Student name", ...g.cols.map((c) => `${c.label} (${f(c.max)})`), `Final (${f(g.v.final_max)})`, "Grade"];
    const W = many ? 14800 : 10000, rest = W - 500 - 1200 - 2600, each = Math.floor(rest / (g.cols.length + 2));
    const body = docHead(sel, "Student grades report")
      + table(head, g.rows.map((r) => [r.n, r.id, r.name, ...r.marks.map((m) => f(m)), { t: f(r.final), b: true }, { t: r.letter, b: true, color: r.letter === "F" ? "B5651D" : undefined }]), { width: W, cols: [500, 1200, 2600, ...head.slice(3).map(() => each)], center: head.map((h, i) => i).filter((i) => i !== 2), sz: 17 })
      + (gr ? para(run("Summary", {}), { style: "Heading1" }) + table(["", ...CR_GRADES, "Pass", "Fail", "Withdrawn"], [["Students", ...CR_GRADES.map((L) => gr.counts[L]), gr.status.Pass, gr.status.Fail, gr.status.Withdrawn], ["%", ...CR_GRADES.map((L) => f(gr.counts_pct[L], 1)), f(gr.status_pct.Pass, 1), f(gr.status_pct.Fail, 1), f(gr.status_pct.Withdrawn, 1)]], { width: W, center: [...Array(13).keys()].slice(1), sz: 17 })
        + para(run(`Started the course: ${gr.started} · completed: ${gr.completed}. Grade percentages are of the students who completed the course.`, { sz: 17, color: "555555" })) : "");
    return make(body, { landscape: many });
  }
  async function gradesXlsx(sel) {
    await T.importer.lib("xlsx");
    const g = gradeRows(sel), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g.rows.map((r) => Object.assign({ No: r.n, ID: r.id, "Student name": r.name }, Object.fromEntries(g.cols.map((c, i) => [`${c.label} (${f(c.max)})`, r.marks[i]])), { [`Final (${f(g.v.final_max)})`]: r.final, Grade: r.letter }))), "Grades");
    const gr = grades(sel);
    if (gr) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...CR_GRADES.map((L) => ({ Item: L, Students: gr.counts[L], "%": num(f(gr.counts_pct[L])) })), ...Object.keys(gr.status).map((k) => ({ Item: k, Students: gr.status[k], "%": num(f(gr.status_pct[k])) }))]), "Summary");
    XLSX.writeFile(wb, `student_grades_${tag(sel)}.xlsx`);
  }

  /* ---------------------------------------------------------------- CLO achievement level */
  const achieved = (r) => (r.actual === null || r.actual === undefined || r.target === null ? "Not measured" : r.actual >= r.target ? "Achieved" : "Not achieved");
  async function cloDocx(sel) {
    const rows = cloRows(sel), D = { 1: "Knowledge and understanding", 2: "Skills", 3: "Values, autonomy and responsibility" };
    let body = docHead(sel, "CLO achievement level");
    [1, 2, 3].forEach((gi) => {
      const rr = rows.filter((r) => r.g === gi); if (!rr.length) return;
      body += para(run(`${gi}. ${D[gi]}`), { style: "Heading1" }) + table(["No.", "CLO", "Assessment methods", "Target %", "Actual %", "Result"],
        rr.map((r) => [r.no, r.text, r.methText, f(r.target), f(r.actual), { t: achieved(r), b: true, color: achieved(r) === "Not achieved" ? "B5651D" : achieved(r) === "Achieved" ? "2E7D5B" : "777777" }]), { cols: [600, 3900, 1900, 800, 800, 1000], center: [0, 3, 4, 5] });
    });
    const n = rows.filter((r) => achieved(r) === "Achieved").length, m = rows.filter((r) => achieved(r) !== "Not measured").length;
    body += para(run(`${n} of ${m} measured CLOs achieved their target.`, { b: true }), { before: 120 });
    return make(body);
  }
  async function cloXlsx(sel) {
    await T.importer.lib("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cloRows(sel).map((r) => ({ No: r.no, "CLO ID": r.cid, CLO: r.text, PLOs: r.plos, "Assessment methods": r.methText, "Target %": r.target, "Actual %": r.actual === null || r.actual === undefined ? null : num(f(r.actual)), Result: achieved(r), Comment: r.comment }))), "CLO achievement");
    XLSX.writeFile(wb, `clo_achievement_level_${tag(sel)}.xlsx`);
  }

  /* ---------------------------------------------------------------- the page */
  const DOCS = [
    ["course_report", "📊", "Course Report", "The NCAAA Course Report (TP-154, or TPG-154 for postgraduate courses), filled from your marks, CLO results and action plan."],
    ["grades", "🎓", "Student grades report", "Every student's marks in each assessment, the final mark and grade, with a summary."],
    ["clo_level", "🎯", "CLO achievement level", "The achievement level of each CLO of the course: target, actual result, achieved or not."],
    ["course_spec", "📘", "Course Specification", "The official NCAAA form (TP-153 / TPG-153): identity, CLOs, content, assessment, resources."],
    ["syllabus", "📗", "Syllabus", "The course syllabus for students: instructor, description, CLOs, weekly topics, assessment, policies."],
  ];
  const SOON0 = new Set(["course_spec", "syllabus"]), SOON = { has: (id) => SOON0.has(id) && !(T.docSpec && T.docSpec.has(id)) };
  function boxStatus(sel, id) {
    if (id === "course_report") { const s = crStatus(sel), k = s.filter((x) => x[1]).length; return [k === s.length, `${k} of ${s.length} parts filled`]; }
    if (id === "grades") { const v = sheet(sel); return [!!v, v ? `${v.rows.length} students` : "No marks yet"]; }
    if (id === "clo_level") { const r = cloRows(sel), m = r.filter((x) => x.actual !== null && x.actual !== undefined).length; return [r.length && m === r.length, r.length ? `${m} of ${r.length} CLOs measured` : "No CLOs yet"]; }
    if (T.docSpec && T.docSpec.has(id)) return T.docSpec.status(sel, id);
    return [false, "Coming in the next update"];
  }
  const ui = () => (S.ui.docOpen = S.ui.docOpen || {});
  T.sections.docBoxes = function () {
    const sel = T.current(), el = $("#sec-docs"); if (!el) return;
    const open = ui()[sel];
    if (!open) {
      el.innerHTML = `<div class="sec-head" id="h-docs"><div><h2>Documents</h2><p class="sub">Open a document to see what is filled from your data, what is still missing, and to download it.</p></div></div>
        <div class="dr-grid">${DOCS.map(([id, ic, t, dsc]) => { const [ok, s] = boxStatus(sel, id); return `<button class="dr-card ${SOON.has(id) ? "soon" : ""}" data-dropen="${id}"><span class="dr-t">${ic} ${esc(t)}</span><span class="dr-d">${esc(dsc)}</span><span class="dr-s ${ok ? "ok" : SOON.has(id) ? "" : "part"}">${ok ? "✓ " : "● "}${esc(s)}</span></button>`; }).join("")}</div>`;
      $$("[data-dropen]", el).forEach((b) => b.onclick = () => { ui()[sel] = b.dataset.dropen; S.saveUi && S.saveUi(); T.refresh("docBoxes"); el.scrollIntoView({ block: "start" }); });
      return;
    }
    const [, ic, title] = DOCS.find((x) => x[0] === open) || DOCS[0];
    let inner = "";
    if (open === "course_report") {
      const s = crStatus(sel), miss = s.filter((x) => !x[1]);
      inner = `<p class="note">The official Course Report template, filled with this course's data. The parts not filled yet stay empty in the Word file, so you can also type them there.${isPG(sel) ? " This is a postgraduate course, so the file uses the TPG-154 cover." : ""}</p>
        ${miss.length ? `<div class="alert-box"><span class="alert-ic">⚠</span><span><b>${miss.length} part(s) not filled yet:</b> ${miss.map((x) => `${esc(x[0])} (<a href="#${x[2]}">${esc(x[3])}</a>)`).join("; ")}.</span></div>` : `<p class="ok-text">✓ Every part of the Course Report is filled.</p>`}
        <div class="bp-wrap"><table class="tbl" style="max-width:720px"><thead><tr><th>Part of the report</th><th style="width:110px">Filled?</th><th>Where it is filled</th></tr></thead><tbody>
        ${s.map(([l, ok, h, w]) => `<tr><td>${esc(l)}</td><td>${ok ? '<span class="ok-text">✓ Yes</span>' : '<span class="warn-text">Not yet</span>'}</td><td><a href="#${h}">${esc(w)}</a></td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn primary" id="dr-cr">⬇ Course Report (Word, English)</button><button class="btn" id="dr-cra">⬇ تقرير المقرر (Word, العربية)</button></div>
        <p class="note">The Arabic form has the same numbers and tables. The text boxes (comments, recommendations, actions) go in as you wrote them, so write them in Arabic for that file.</p>`;
    } else if (open === "grades") {
      const g = gradeRows(sel);
      inner = g ? `<p class="note">From the <a href="#mark-sheet">Course mark sheet</a>: ${g.rows.length} students, ${g.cols.length} assessments.</p>
        <div class="bp-wrap" style="overflow-x:auto;max-height:420px"><table class="tbl xs-tbl"><thead><tr><th>No.</th><th>ID</th><th>Student name</th>${g.cols.map((c) => `<th class="ctr">${esc(c.label)}<br><span class="note">${f(c.max)}</span></th>`).join("")}<th class="ctr">Final<br><span class="note">${f(g.v.final_max)}</span></th><th class="ctr">Grade</th></tr></thead><tbody>
        ${g.rows.map((r) => `<tr><td>${r.n}</td><td>${esc(r.id)}</td><td>${esc(r.name)}</td>${r.marks.map((m) => `<td class="ctr">${f(m)}</td>`).join("")}<td class="ctr"><b>${f(r.final)}</b></td><td class="ctr"><b>${esc(r.letter)}</b></td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn primary" id="dr-gw">⬇ Word</button><button class="btn" id="dr-gx">⬇ Excel</button></div>`
        : `<div class="alert-box"><span class="alert-ic">⚠</span><span>No student marks yet. Enter them on the <a href="#student-marks">Student marks</a> page or upload a mark sheet on the <a href="#mark-sheet">Course mark sheet</a> page.</span></div>`;
    } else if (open === "clo_level") {
      const rows = cloRows(sel);
      inner = rows.length ? `<p class="note">From <a href="#clo-achievement">CLO achievement</a> (For the course report).</p>
        <div class="bp-wrap"><table class="tbl"><thead><tr><th class="ctr">No.</th><th>CLO</th><th>Assessment methods</th><th class="ctr">Target %</th><th class="ctr">Actual %</th><th>Result</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="ctr">${r.no}</td><td>${esc(r.text)}</td><td>${esc(r.methText)}</td><td class="ctr">${f(r.target)}</td><td class="ctr">${f(r.actual)}</td><td>${achieved(r) === "Achieved" ? '<span class="ok-text">✓ Achieved</span>' : achieved(r) === "Not achieved" ? '<span class="warn-text">Not achieved</span>' : '<span class="note">Not measured</span>'}</td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn primary" id="dr-cw">⬇ Word</button><button class="btn" id="dr-cx">⬇ Excel</button></div>`
        : `<p class="note">This course has no CLOs yet. Add them in <a href="#course-setup">Course setup</a>.</p>`;
    } else if (T.docSpec && T.docSpec.has(open)) {
      inner = T.docSpec.html(sel, open);
    } else {
      inner = `<p class="note">This document is being rebuilt and comes in the next update. It will be filled from Course setup, Lectures & SLOs and the Assessment plan, in English or Arabic.</p>`;
    }
    el.innerHTML = `<div class="sec-head" id="h-docs"><div><button class="btn sm" id="dr-back">← All documents</button><h2 style="margin-top:10px">${ic} ${esc(title)} · ${esc(T.baseCode(sel))}</h2></div></div>${inner}`;
    $("#dr-back", el).onclick = () => { delete ui()[sel]; S.saveUi && S.saveUi(); T.refresh("docBoxes"); };
    const go = (id, fn, name) => { const b = $(id, el); if (b) b.onclick = async () => { b.disabled = true; try { const blob = await fn(sel); if (blob) dl(blob, name); } catch (e) { T.toast(`The file could not be made (${e.message || e}).`, "warn"); } b.disabled = false; }; };
    go("#dr-cr", courseReport, `Course_Report_${tag(sel)}.docx`);
    go("#dr-cra", (s) => courseReport(s, "ar"), `Course_Report_Arabic_${tag(sel)}.docx`);
    go("#dr-gw", gradesDocx, `student_grades_${tag(sel)}.docx`);
    go("#dr-gx", gradesXlsx, "");
    go("#dr-cw", cloDocx, `clo_achievement_level_${tag(sel)}.docx`);
    go("#dr-cx", cloXlsx, "");
    if (T.docSpec && T.docSpec.has(open)) T.docSpec.bind(el, sel, open, dl);
  };

  T.renderDocsPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "Add a course in Course setup first."}</p><div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = `<section class="card" id="sec-docs"></section>`;
    T.refresh("docBoxes");
  };
  T.docParts = { crStatus, courseReport, gradesDocx, cloDocx, gradeRows, cellSet, fillRows, isPG, reportDate };
})();
