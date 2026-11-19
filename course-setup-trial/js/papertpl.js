/* Printing the exam with the faculty's own format (Dania 2026-11-19).
   a) A Word template (.docx): the faculty's header, logo and layout are kept. Words in double curly brackets are filled in
      ({{COURSE_CODE}}, {{EXAM}} ...) and {{QUESTIONS}} is replaced by the questions. Without {{QUESTIONS}} the questions go at the end.
   b) A PDF or a picture: its header part (the top of the first page) is printed at the top of the paper (HTML, PDF and Word).
   Saved in the data file: paper_templates[course or "*"] = { name, b64 } and paper_header[course or "*"] = { name, img }.
   Without a Word template, the Word file uses a built-in template with the same layout as the HTML paper. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$;
  const X = (s) => T.s(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const unX = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const AR = /[؀-ۿ]/;
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const MAX = 1500000;   // the data file lives in the browser: keep a template under about 1.5 MB
  const dict = (k) => (S.data[k] && typeof S.data[k] === "object" && !Array.isArray(S.data[k]) ? S.data[k] : (S.data[k] = {}));
  const pick = (k, sel) => { const m = S.data[k] || {}; return m[sel] ? [sel, m[sel]] : m["*"] ? ["*", m["*"]] : [null, null]; };
  T.paperHeaderOf = (sel) => (pick("paper_header", sel)[1] || {}).img || "";
  const b64ToBuf = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  const bufToB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  /* ---------------------------------------------------------------- Word XML pieces */
  const run = (t, o = {}) => (t === "" || t === undefined || t === null ? "" : `<w:r><w:rPr>${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/><w:iCs/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}${o.u ? '<w:u w:val="single"/>' : ""}${AR.test(t) ? "<w:rtl/>" : ""}</w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r>`);
  const TAB = "<w:r><w:tab/></w:r>";
  const para = (runs, o = {}) => `<w:p><w:pPr>${o.keep ? "<w:keepNext/>" : ""}${o.line || o.lineColor ? `<w:pBdr><w:bottom w:val="single" w:sz="${o.lineColor ? 12 : 4}" w:space="1" w:color="${o.lineColor || "999999"}"/></w:pBdr>` : ""}${o.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>` : ""}${o.tab ? `<w:tabs><w:tab w:val="right" w:pos="${o.tab}"/></w:tabs>` : ""}${o.bidi ? "<w:bidi/>" : ""}<w:spacing w:before="${o.before || 0}" w:after="${o.after === undefined ? 60 : o.after}"${o.lineH ? ` w:line="${o.lineH}" w:lineRule="exact"` : ""}/>${o.ind ? `<w:ind w:left="${o.ind}"/>` : ""}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}</w:pPr>${runs}</w:p>`;
  const NIL = ["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="nil"/>`).join("");
  const grid2 = (rows, ind) => `<w:tbl><w:tblPr><w:tblW w:w="${9000 - ind}" w:type="dxa"/><w:tblInd w:w="${ind}" w:type="dxa"/><w:tblBorders>${NIL}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${(9000 - ind) / 2}"/><w:gridCol w:w="${(9000 - ind) / 2}"/></w:tblGrid>
    ${rows.map((r) => `<w:tr>${[0, 1].map((i) => `<w:tc><w:tcPr><w:tcW w:w="${(9000 - ind) / 2}" w:type="dxa"/></w:tcPr>${r[i] || "<w:p/>"}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  const drawing = (rid, id, cx, cy) => `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="picture${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const imgSize = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.naturalWidth || 1, im.naturalHeight || 1]); im.onerror = () => ok([4, 3]); im.src = src; });
  /** Adds a picture to the Word file; returns the run that shows it. maxW / maxH in cm. */
  async function addPic(media, dataUrl, maxW, maxH) {
    const m = /^data:image\/(png|jpe?g);base64,(.*)$/.exec(T.s(dataUrl)); if (!m) return "";
    const ext = m[1] === "png" ? "png" : "jpeg", i = media.length + 1, rid = `rIdTama${i}`;
    const [w, h] = await imgSize(dataUrl), EMU = 360000, s = Math.min(maxW * EMU / w, maxH * EMU / h);
    media.push({ rid, name: `tama_pic${i}.${ext}`, ext, b64: m[2] });
    return drawing(rid, 9000 + i, Math.round(w * s), Math.round(h * s));
  }

  /** The questions as Word paragraphs, in the same order and layout as the HTML paper. */
  async function questionsXml(sel, exam, key, media) {
    const Q = T.bpPaperParts, q = Q.qOf(sel, exam), out = [], green = { b: true, color: "0B6B3A" };
    const BAR = T.paperLayoutOf ? T.s(T.paperLayoutOf(sel)[1].bar || "#14365d").replace("#", "").toUpperCase() : "14365D";
    const bidi = (s) => AR.test(T.s(s));
    let n = 0;
    for (const t of Q.Q_TYPES) {
      const qs = q.filter((x) => T.s(x.question_type) === t); if (!qs.length) continue;
      const mk = qs.reduce((a, x) => a + (num(x.max_marks) || 0), 0);
      out.push(para(run(Q.Q_SECTION[t], { b: true, color: "FFFFFF" }) + run(`   ${qs.length} question(s) - ${g2(mk)} mark(s). ${Q.Q_INSTR[t]}`, { color: "FFFFFF", sz: 18 }), { shd: BAR, before: 240, after: 100, keep: true }));
      for (const r of qs) {
        n++;
        let text = T.s(r.question_text) || (t === "Matching" ? "Match the following:" : "(question text not entered)"), textRuns;
        if (t === "Fill in the blank") { const a = T.s(r.correct_answer).split(";").map((x) => x.trim()); let i = 0;
          textRuns = text.split(/_{3,}/).map((part, j, arr) => run(part) + (j < arr.length - 1 ? (key ? run(` ${a[i++] || ""} `, { ...green, u: true }) : run("______________")) : "")).join(""); }
        else textRuns = run(text);
        out.push(para(run(`${n}. `, { b: true }) + textRuns + TAB + run(`[${Q.fmtMarks(r.max_marks)}]`, { color: "555555", sz: 18 }), { tab: 9000, keep: true, before: 140, bidi: bidi(text) }));
        if (T.s(r.image).startsWith("data:image")) out.push(para(await addPic(media, r.image, 10, 7), { ind: 400 }));
        if (t === "MCQ") {
          const two = T.s(r.options_layout) === "2";
          const cells = Q.jl(r.options).map((o, i) => { const k = key && String.fromCharCode(65 + i) === T.s(r.correct_answer); return para(run(`${String.fromCharCode(65 + i)}. `, { b: true, ...(k ? green : {}) }) + run(T.s(o) + (k ? " ✓" : ""), k ? green : {}), { bidi: bidi(o), after: 40, ind: two ? 0 : 400 }); });
          if (two) { const rows = []; for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2)); out.push(grid2(rows, 400)); }
          else cells.forEach((c) => out.push(c));
        } else if (t === "True / False") {
          out.push(para(["True", "False"].map((v) => { const k = key && T.s(r.correct_answer) === v; return run(v + (k ? " ✓" : ""), k ? green : {}) + run("          "); }).join(""), { ind: 400 }));
        } else if (t === "Matching") {
          const pairs = Q.jl(r.options), idx = pairs.map((_, i) => i), rnd = Q.seeded(T.s(r.question_id));
          for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
          const letter = {}; idx.forEach((orig, pos) => { letter[orig] = String.fromCharCode(65 + pos); });
          const rows = pairs.map((p, i) => [para(run(`${i + 1}. ${T.s(p[0])}`) + (key ? run(`  → ${letter[i]}`, green) : run("  ......")), { after: 40 }), para(run(`${String.fromCharCode(65 + i)}. ${T.s((pairs[idx[i]] || [])[1])}`), { after: 40 })]);
          out.push(grid2(rows, 400));
        } else if (t === "Short Essay" || t === "Long Essay") {
          const lines = Math.max(1, Math.round(num(r.answer_lines) || (t === "Short Essay" ? 5 : 15)));
          // answer lines: a table whose rows have a bottom border (Word joins the borders of paragraphs that follow each other)
          out.push(`<w:tbl><w:tblPr><w:tblW w:w="8600" w:type="dxa"/><w:tblInd w:w="400" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="nil"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="8600"/></w:tblGrid>${Array.from({ length: lines }, () => `<w:tr><w:trPr><w:trHeight w:val="420" w:hRule="exact"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="8600" w:type="dxa"/></w:tcPr><w:p/></w:tc></w:tr>`).join("")}</w:tbl>`);
          if (key && T.s(r.model_answer).trim()) { out.push(para(run("Model answer / marking points:", green), { ind: 400, before: 80 }));
            T.s(r.model_answer).split(/\n/).forEach((l) => out.push(para(run(l, { color: "0B6B3A" }), { ind: 400, bidi: bidi(l) }))); }
        }
      }
    }
    const other = q.filter((x) => !Q.Q_TYPES.includes(T.s(x.question_type)));
    if (other.length) { out.push(para(run("Questions without written content", { b: true, color: "FFFFFF" }), { shd: BAR, before: 240 }));
      other.forEach((r) => { n++; out.push(para(run(`${n}. ${T.s(r.question_id)} - ${T.s(r.topic)}`) + TAB + run(`[${Q.fmtMarks(r.max_marks)}]`, { color: "555555", sz: 18 }), { tab: 9000 })); }); }
    if (!q.length) out.push(para(run("No questions have been added to this exam yet.")));
    out.push(para(""));
    return out.join("");
  }

  /* ---------------------------------------------------------------- the built-in template (same layout as the HTML paper) */
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  async function builtinTemplate(withHeaderNote) {
    await T.importer.lib("jszip");
    const z = new JSZip();
    z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`);
    z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    z.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`);
    z.file("word/header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${para(run("{{DEPARTMENT}}   |   {{COURSE_CODE}} - {{EXAM}}", { color: "777777", sz: 16 }), { jc: "right" })}</w:hdr>`);
    const body = [withHeaderNote ? para(run("{{HEADER_PICTURE}}"), { jc: "center" }) : "",
      para(run("{{HEAD_BLOCK}}")),
      para(run("{{INFO_TABLE}}")), para(run("{{INSTRUCTIONS_BLOCK}}")),
      para(run("{{QUESTIONS}}")),
      `<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr>`].join("");
    z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
    return z;
  }

  /* ---------------------------------------------------------------- filling a template */
  const P_RE = /<w:p(?=[\s>])(?:(?!<w:p[\s>])[\s\S])*?<\/w:p>/g, T_RE = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  function fill(xml, vals, blocks) {   // blocks: {QUESTIONS: xml, HEADER_PICTURE: xml} replace their whole paragraph
    const found = {};
    xml = xml.replace(P_RE, (p) => {
      const ts = [...p.matchAll(T_RE)]; if (!ts.length) return p;
      const full = unX(ts.map((m) => m[1]).join("")); if (!full.includes("{{")) return p;
      for (const b of Object.keys(blocks || {})) if (new RegExp(`\\{\\{\\s*${b}\\s*\\}\\}`, "i").test(full)) { found[b] = true; return blocks[b]; }
      const txt = full.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (m, k) => (k.toUpperCase() in vals ? vals[k.toUpperCase()] : m));
      let i = 0; return p.replace(T_RE, () => (i++ === 0 ? `<w:t xml:space="preserve">${X(txt)}</w:t>` : "<w:t></w:t>"));
    });
    return [xml, found];
  }
  function values(sel, exam, key) {
    const c = S.courseInfo(sel) || {}, ex = (S.data.tables.exams || []).find((x) => String(x.course_code) === String(sel) && T.s(x.assessment) === exam);
    const q = T.bpPaperParts.qOf(sel, exam), total = q.reduce((a, x) => a + (num(x.max_marks) || 0), 0);
    return { DEPARTMENT: T.s(c.department), COLLEGE: T.s(c.faculty), FACULTY: T.s(c.faculty), INSTITUTION: T.s(c.institution), COURSE_CODE: T.baseCode(c.course_code || sel), COURSE_NAME: T.s(c.course_name),
      EXAM: exam, TERM: T.s(c.term), YEAR: T.s(c.year), DURATION: ex && num(ex.duration_min) !== null ? `${g2(num(ex.duration_min))} minutes` : "", TOTAL_MARKS: g2(total), QUESTION_COUNT: String(q.length),
      DATE: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), EXAM_DATE: T.paperInfo(sel, exam).date, INSTRUCTIONS: T.paperInfo(sel, exam).instructions.replace(/\n/g, " "), PAPER: key ? "ANSWER KEY" : "", COURSE_DIRECTOR: T.s(c.course_director) };
  }
  function infoTable(sel, exam, vals) {
    const cells = T.paperInfoCells(sel, exam, vals.DURATION, vals.TOTAL_MARKS), n = T.paperInfo(sel, exam).cols || 2, w = Math.floor(9600 / n), rows = [];
    if (!cells.length) return para("");
    for (let i = 0; i < cells.length; i += n) rows.push(cells.slice(i, i + n));
    const tc = (c) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tcBorders></w:tcPr>${c ? para(run(`${c[0]}: `, { sz: 20 }) + run(c[1] || "", { sz: 20 }), { before: 80, after: 40, bidi: AR.test(c[1] || "") }) : "<w:p/>"}</w:tc>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${w * n}" w:type="dxa"/><w:tblBorders>${NIL}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: n }, () => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map((r) => `<w:tr>${Array.from({ length: n }, (_, i) => tc(r[i])).join("")}</w:tr>`).join("")}</w:tbl>`;
  }
  const instrXml = (sel, exam) => { const t = T.paperInfo(sel, exam).instructions.trim(); return t ? t.split(/\n/).map((l, i) => para((i === 0 ? run("Instructions: ", { b: true }) : "") + run(l), { before: i === 0 ? 120 : 0, bidi: AR.test(l) })).join("") : para(""); };
  const extraXml = (sel, exam) => { const i = T.paperInfo(sel, exam), l = i.lines; return l.length ? l.map(([a, b]) => para(run(`${T.s(a).trim()}: `, { b: true }) + run(T.s(b).trim() || "........................"), { after: 40 })).join("") : para(""); };
  async function buildDocx(sel, exam, key) {
    await T.importer.lib("jszip");
    const [, tpl] = pick("paper_templates", sel), hdr = T.paperHeaderOf(sel);
    const z = tpl ? await JSZip.loadAsync(b64ToBuf(tpl.b64)) : await builtinTemplate(!!hdr);
    const media = [], vals = values(sel, exam, key);
    const qx = await questionsXml(sel, exam, key, media);
    const W = { run, para, NIL, addPic: (img, w, h) => addPic(media, img, w, h) }, above = T.paperInfo(sel, exam).instrPos === "above";
    const blocks = { QUESTIONS: qx, HEAD_BLOCK: T.paperHeadXml ? await T.paperHeadXml(sel, exam, key, vals, W) : para(""),
      INFO_TABLE: above ? instrXml(sel, exam) + infoTable(sel, exam, vals) : infoTable(sel, exam, vals), INSTRUCTIONS_BLOCK: above ? para("") : instrXml(sel, exam), EXTRA_INFO: extraXml(sel, exam), HEADER_PICTURE: hdr && !tpl ? para(await addPic(media, hdr, 17, 6), { jc: "center", after: 80 }) : para("") };
    let doc = await z.file("word/document.xml").async("string");
    // the namespaces the questions and pictures need
    doc = doc.replace(/<w:document\b([^>]*)>/, (m, a) => `<w:document${a}${/xmlns:r=/.test(a) ? "" : ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'}${/xmlns:wp=/.test(a) ? "" : ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'}>`);
    const [d2, found] = fill(doc, vals, blocks); doc = d2;
    if (!found.QUESTIONS) { const b = doc.lastIndexOf("</w:body>"), s = doc.lastIndexOf("<w:sectPr", b), at = s > -1 && doc.indexOf("</w:sectPr>", s) < b && !doc.slice(s, b).includes("</w:p>") ? s : b; doc = doc.slice(0, at) + qx + doc.slice(at); }
    z.file("word/document.xml", doc);
    for (const f of Object.keys(z.files).filter((f) => /^word\/(header|footer)\d*\.xml$/.test(f))) z.file(f, fill(await z.file(f).async("string"), vals, {})[0]);
    if (media.length) {
      const rp = "word/_rels/document.xml.rels"; let rels = z.file(rp) ? await z.file(rp).async("string") : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
      rels = rels.replace("</Relationships>", media.map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join("") + "</Relationships>");
      z.file(rp, rels); media.forEach((m) => z.file(`word/media/${m.name}`, m.b64, { base64: true }));
      let ct = await z.file("[Content_Types].xml").async("string");
      ["jpeg", "png"].forEach((e) => { if (media.some((m) => m.ext === e) && !new RegExp(`Extension="${e}"`, "i").test(ct)) ct = ct.replace("<Default ", `<Default Extension="${e}" ContentType="image/${e}"/><Default `); });
      z.file("[Content_Types].xml", ct);
    }
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  T.bpPaperDocx = buildDocx;
  T.paperValues = values;

  /* ---------------------------------------------------------------- a PDF or a picture: its header part */
  async function headerFromFile(f) {
    let canvas;
    if (/\.pdf$/i.test(f.name)) {
      await T.importer.lib("pdf"); if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, page = await pdf.getPage(1), vp = page.getViewport({ scale: 2 });
      canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height; const cx = canvas.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, vp.width, vp.height);
      await page.render({ canvasContext: cx, viewport: vp }).promise;
    } else {
      const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("The picture could not be read.")); r.readAsDataURL(f); });
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("The picture could not be read.")); i.src = url; });
      canvas = document.createElement("canvas"); canvas.width = im.naturalWidth; canvas.height = im.naturalHeight; const cx = canvas.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, canvas.width, canvas.height); cx.drawImage(im, 0, 0);
      return shrink(canvas, 0, canvas.height);
    }
    // the header = the first block of content at the top of the page (it ends at the first clear white band)
    const W = canvas.width, H = canvas.height, px = canvas.getContext("2d").getImageData(0, 0, W, H).data;
    const inked = (y) => { for (let x = 0; x < W; x += 3) { const i = (y * W + x) * 4; if (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11 < 225) return true; } return false; };
    let top = -1; for (let y = 0; y < H * 0.5; y++) if (inked(y)) { top = y; break; }
    if (top < 0) throw new Error("No header was found at the top of the first page of this PDF.");
    const gap = Math.round(H * 0.03), cap = Math.round(H * 0.4); let end = cap, white = 0;
    for (let y = top; y < cap; y++) { if (inked(y)) white = 0; else if (++white >= gap) { end = y - white + 1; break; } }
    return shrink(canvas, Math.max(0, top - 12), Math.min(H, end + 12));
  }
  function shrink(src, y0, y1) {
    const w = Math.min(1600, src.width), s = w / src.width, h = Math.max(1, Math.round((y1 - y0) * s)), c = document.createElement("canvas");
    c.width = w; c.height = h; const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(src, 0, y0, src.width, y1 - y0, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9);
  }

  /* ---------------------------------------------------------------- the box in "Print the exam" */
  T.paperTplHtml = function (sel, exam) {
    const [tk, tpl] = pick("paper_templates", sel), [hk, hdr] = pick("paper_header", sel);
    const scope = S.ui.tplScope === "*" ? "*" : "course";
    const where = (k) => (k === "*" ? "all courses" : "this course");
    return `<details class="sum-box" id="tpl-box" ${S.ui.tplOpen || tpl || hdr ? "open" : ""}><summary>Your faculty's format (template)</summary>
      <p class="note">If your faculty requires its own format or header, add it here and the exam paper and answer key are printed with it.</p>
      <ul class="tpl-how">
        <li><b>Word template (.docx)</b> - best: your header, logo and layout are kept. Write these words where the information should go:
          <code>{{COURSE_CODE}}</code> <code>{{COURSE_NAME}}</code> <code>{{EXAM}}</code> <code>{{TERM}}</code> <code>{{YEAR}}</code> <code>{{DURATION}}</code> <code>{{TOTAL_MARKS}}</code> <code>{{DEPARTMENT}}</code> <code>{{EXAM_DATE}}</code> <code>{{INSTRUCTIONS}}</code> <code>{{EXTRA_INFO}}</code> (the extra lines above, each on its own line) <code>{{DATE}}</code> (today) <code>{{PAPER}}</code> (= ANSWER KEY in the answer key),
          and <code>{{QUESTIONS}}</code> on its own line where the questions go (without it, the questions go at the end). They also work in the Word header and footer.</li>
        <li><b>PDF or picture</b> - the header at the top of its first page is cut out and printed at the top of the paper (HTML, PDF and Word).</li></ul>
      <div class="row-btns"><button class="btn sm" id="tpl-sample">⬇ Sample Word template</button>
        <label class="btn sm"><input type="file" id="tpl-file" accept=".docx,.pdf,.png,.jpg,.jpeg" hidden>Upload a template (Word, PDF or picture)</label>
        <span class="fld tpl-scope"><span class="seg">${[["course", "For this course"], ["*", "For all courses"]].map(([v, l]) => `<button class="${scope === v ? "on" : ""}" data-tplscope="${v}">${l}</button>`).join("")}</span></span></div>
      ${tpl ? `<div class="tpl-saved"><span>📄 Word template: <b>${esc(tpl.name)}</b> <span class="muted">(${where(tk)})</span></span><button class="btn sm" id="tpl-x">Remove</button></div>` : ""}
      ${hdr ? `<div class="tpl-saved"><span>🖼 Header from <b>${esc(hdr.name)}</b> <span class="muted">(${where(hk)})</span>${tpl ? ` <span class="muted">- not used in the Word file while a Word template is saved</span>` : ""}</span><button class="btn sm" id="hdr-x">Remove</button></div><img class="tpl-hdr" src="${esc(hdr.img)}" alt="The header that is printed">` : ""}
    </details>`;
  };
  T.paperTplWire = function (sel, exam, el) {
    const box = $("#tpl-box", el); if (!box) return;
    const redraw = () => T.refresh("bpTab");
    box.ontoggle = () => { S.ui.tplOpen = box.open; S.saveUi(); };
    el.querySelectorAll("[data-tplscope]").forEach((b) => b.onclick = () => { S.ui.tplScope = b.dataset.tplscope === "*" ? "*" : "course"; S.saveUi(); redraw(); });
    $("#tpl-sample", el).onclick = async () => {
      try { const z = await builtinTemplate(false); const blob = await z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "TAMA_exam_template.docx"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      } catch (e) { T.toast("The sample could not be built: " + e.message); } };
    const f = $("#tpl-file", el);
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return; const k = S.ui.tplScope === "*" ? "*" : String(sel);
      try {
        if (/\.docx$/i.test(file.name)) {
          const u8 = new Uint8Array(await file.arrayBuffer()); if (u8.length > MAX) { T.toast("This Word file is too big (over 1.5 MB). Make the pictures in it smaller and try again."); return; }
          await T.importer.lib("jszip"); const z = await JSZip.loadAsync(u8); if (!z.file("word/document.xml")) { T.toast("This does not look like a Word (.docx) file."); return; }
          const xml = await z.file("word/document.xml").async("string"), hasQ = /\{\{\s*QUESTIONS\s*\}\}/i.test(unX(xml.replace(/<[^>]+>/g, "")));
          dict("paper_templates")[k] = { name: file.name, b64: bufToB64(u8) }; S.save();
          T.toast(hasQ ? "Word template saved. The Word buttons now use it." : "Word template saved. It has no {{QUESTIONS}} line, so the questions go at the end of it.");
        } else {
          const img = await headerFromFile(file); if (img.length > MAX) { T.toast("The header picture is too big. Try a smaller file."); return; }
          dict("paper_header")[k] = { name: file.name, img }; S.save(); T.toast("Header saved. Check it below; it is printed at the top of the paper.");
        }
        redraw();
      } catch (e) { T.toast("The template could not be read: " + e.message); }
    };
    const tx = $("#tpl-x", el); if (tx) tx.onclick = () => { const [k] = pick("paper_templates", sel); if (k) { delete S.data.paper_templates[k]; S.save(); T.toast("Word template removed."); redraw(); } };
    const hx = $("#hdr-x", el); if (hx) hx.onclick = () => { const [k] = pick("paper_header", sel); if (k) { delete S.data.paper_header[k]; S.save(); T.toast("Header removed."); redraw(); } };
  };
})();
