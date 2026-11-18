/* Blueprint, Question mapping: importing questions (ported from TAMA).
   a) "Import question blueprint": a TAMA questions file (Excel / CSV) that REPLACES all saved questions.
   b) "Import exam questions from files": old exam papers or question banks (Word .docx, Excel, CSV, PDF, text, pictures).
      Word, Excel, CSV, text and typed PDF are read inside the browser; pictures and scanned PDF pages need the linked AI tool.
      The questions found are shown in a table to check, then added to the exam. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const Q_TYPES = ["MCQ", "True / False", "Fill in the blank", "Matching", "Short Essay", "Long Essay"];
  const QX_OPT = "ABCDEF";
  const QX_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create", "Not classified"];
  const QX_DEFAULT_MARKS = { MCQ: 1, "True / False": 1, "Fill in the blank": 1, Matching: 2, "Short Essay": 2, "Long Essay": 5 };
  const QUESTION_COLS = ["course_code", "assessment", "question_id", "max_marks", "topic", "cognitive_level", "map_basis", "slos", "clos", "question_type", "question_text", "options", "correct_answer", "model_answer", "answer_lines", "image"];
  const AR_LET = { "أ": "A", "ا": "A", "ب": "B", "ج": "C", "د": "D", "ه": "E", "هـ": "E", "و": "F" };
  const arDig = (s) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const QSTART = [/^\s*§Q\s*(.*)$/s, /^\s*(?:Q(?:uestion)?|السؤال|سؤال|س)\s*[.\-#:]?\s*(\d{1,3})\s*[.)\-–:]?\s*(.*)$/is, /^\s*\(?(\d{1,3})\s*(?:[.)]|\s[\-–])\s*(?=\D)(.+)$/s];
  const OPTRE = /^\s*[([]?\s*([A-Fa-f]|هـ|[أابجدهو])\s*[).\-–:\]]\s*(.*)$/s;
  const INLINE = () => /(?:^|\s{2,}|\t|\s(?=\(?[B-Fb-f][).]\s))\(?([A-Fa-f])[).]\s+/g;
  const FILLER = /^[\s.\-_…·•]*$|^\s*page\s*\d+(\s*(of|\/)\s*\d+)?\s*$|^\s*صفحة\s*\d+/i;
  const ANS = /^\s*(?:the\s+)?(?:correct\s+)?(?:answer|ans|key|الإجابة(?:\s+الصحيحة)?|الجواب)\s*(?:is)?\s*[:\-–=]\s*(.*)$/is;
  const MODEL = /^\s*(?:model\s+answer|marking\s+(?:points|scheme|guide)|suggested\s+answer|الإجابة\s+النموذجية)\s*[:\-–]?\s*(.*)$/is;
  const MARKS = /[([]\s*(\d+(?:\.\d+)?)\s*(?:marks?|mks?|pts?\.?|points?|درجة|درجات|د)\s*[)\]]/i;
  const MARKED_SRC = String.raw`^\s*[*✓✔√]\s*|\s*(?:[*✓✔√]|\((?:correct|right|الصحيحة|صح)\))\s*$`;
  const KEYHEAD = /^\s*(?:answer\s*key|answers|key\s*answers?|مفتاح\s*الإجابة|الإجابات)\s*[:\-–]?\s*(.*)$/is;
  const KEYPAIR = () => /(\d{1,3})\s*[.)\-–:]?\s*([A-Fa-f]|true|false|T|F)\b/gi;
  const isUpper = (s) => s === s.toUpperCase() && s !== s.toLowerCase();

  function section(line) {
    const l = line.trim().toLowerCase();
    if (!l || l.length > 90 || /^\s*(?:q(?:uestion)?\s*)?\d/.test(l)) return null;
    if (/multiple[\s\-]*choice|\bmcqs?\b|choose the (?:one )?(?:best|correct)|اختيار من متعدد|اختر الإجابة/.test(l)) return "MCQ";
    if (/true\s*(?:or|\/|&|and)\s*false|\bt\s*\/\s*f\b|صح\s*(?:أو|ام|أم|\/)\s*خطأ|صواب\s*(?:أو|\/)\s*خطأ/.test(l)) return "True / False";
    if (/fill\s*(?:in)?\s*the\s*blanks?|complete the (?:following|sentences)|أكمل|املأ الفراغ/.test(l)) return "Fill in the blank";
    if (/\bmatch(?:ing)?\b|صل(?![\p{L}\p{N}_])|وصل|طابق/u.test(l)) return "Matching";
    if (/short[\s\-]*(?:essay|answer)|\bsaqs?\b|أسئلة قصيرة|مقالي قصير/.test(l)) return "Short Essay";
    if (/long[\s\-]*(?:essay|answer)|\bleqs?\b|essay questions?|\bseqs?\b|مقالي طويل|أسئلة مقالية/.test(l)) return /short|\bseqs?\b/.test(l) ? "Short Essay" : "Long Essay";
    return null;
  }
  function splitInline(text) {
    const ms = [...text.matchAll(INLINE())];
    if (ms.length < 2 || ms.map((m) => m[1].toUpperCase()).join("") !== QX_OPT.slice(0, ms.length) || (ms[0].index > 0 && text.slice(0, ms[0].index).trim())) return null;
    return ms.map((m, i) => text.slice(m.index + m[0].length, i + 1 < ms.length ? ms[i + 1].index : text.length).trim());
  }

  /** Find the questions in plain text (offline). */
  function parseText(text, source) {
    const out = [], key = {}; let cur = null, sec = null, inKey = false;
    const close = () => { if (cur && (cur.text.trim() || cur.opts.length)) out.push(cur); };
    for (const raw of String(text).replace(/\r/g, "\n").split("\n")) {
      const line = arDig(raw).trim();
      if (!line || FILLER.test(line)) continue;
      const km = KEYHEAD.exec(line);
      if (km && !/^\s*answers?\s*:\s*[A-F]\b/i.test(line) && line.length < 80 + km[1].length) {
        const pairs = [...km[1].matchAll(KEYPAIR())];
        if (pairs.length || !km[1].trim()) { inKey = true; pairs.forEach((p) => { key[+p[1]] = p[2]; }); continue; }
      }
      if (inKey) {
        const pairs = [...line.matchAll(KEYPAIR())];
        if (pairs.length && line.replace(/[\d\s.)\-–:A-Fa-f,;|]|true|false/gi, "").length < 4) { pairs.forEach((p) => { key[+p[1]] = p[2]; }); continue; }
        inKey = false;
      }
      let s2 = section(line);
      if (s2 && cur !== null && !(/^\s*(?:section|part|القسم|الجزء|[IVX]+[.\-:)])/i.test(line) || line.trimEnd().endsWith(":") || line.toLowerCase().includes("question") || line.includes("أسئلة") || isUpper(line))) s2 = null;
      if (s2 && !(cur && cur.opts.length && OPTRE.test(line))) { close(); cur = null; sec = s2; continue; }
      if (cur !== null) {
        const am = ANS.exec(line);
        if (am) {
          const v = am[1].trim(), lm = /^\(?([A-Fa-f]|هـ|[أابجدهو])\)?(?:[.):\s]|$)/.exec(v);
          if (cur.opts.length && lm) cur.answer = AR_LET[lm[1]] || lm[1].toUpperCase();
          else if (/^(true|false|t|f|صح|خطأ|صواب)\.?$/i.test(v)) cur.answer = "tص".includes(v.toLowerCase()[0]) ? "True" : "False";
          else if (cur.opts.length) cur.answer = v;
          else { cur.model = (cur.model + "\n" + v).trim(); cur.blank_ans = v; }
          cur.after = "answer"; continue;
        }
        const mm = MODEL.exec(line);
        if (mm) { cur.model = mm[1].trim(); cur.after = "model"; continue; }
      }
      let qm = null, qi = -1; for (let i = 0; i < QSTART.length; i++) { qm = QSTART[i].exec(line); if (qm) { qi = i; break; } }
      const om = OPTRE.exec(line);
      if (om && cur !== null && (cur.opts.length || cur.after === "stem")) {
        const let_ = AR_LET[om[1]] || om[1].toUpperCase();
        if (cur.opts.length < 6 ? let_ === QX_OPT[cur.opts.length] : false) {
          const body = om[2].trim(), inl = splitInline(line);
          if (inl && !cur.opts.length) inl.forEach((o) => cur.opts.push(o)); else cur.opts.push(body);
          cur.after = "opts"; continue;
        }
      }
      if (qm) {
        close();
        const g = qm.slice(1), num = g.length === 2 && g[0] ? parseInt(g[0], 10) : null, body = (g[g.length - 1] || "").trim();
        cur = { num, text: body, opts: [], answer: "", model: "", blank_ans: "", section: sec, after: "stem", source };
        const inl = splitInline(body);
        if (inl) { const cut = INLINE().exec(body).index; cur.text = body.slice(0, cut).trim(); cur.opts = inl; cur.after = "opts"; }
        continue;
      }
      if (cur === null) continue;
      if (cur.after === "opts") { const inl = splitInline(line); if (inl && !cur.opts.length) cur.opts = inl; else cur.opts[cur.opts.length - 1] = (cur.opts[cur.opts.length - 1] + " " + line).trim(); }
      else if (cur.after === "model" || cur.after === "answer") cur.model = (cur.model + "\n" + line).trim();
      else { const inl = splitInline(line); if (inl) { cur.opts = inl; cur.after = "opts"; } else cur.text = (cur.text + "\n" + line).trim(); }
    }
    close();
    return out.map((q) => finish(q, q.num ? key[q.num] : null));
  }

  /** The question type, marks and correct answer of one found question (as TAMA's _qx_finish). */
  function finish(q, keyAns) {
    let text = q.text.trim(), opts = q.opts.map((o) => String(o).trim()).filter(Boolean), marks = null;
    const m = MARKS.exec(text);
    if (m) { marks = parseFloat(m[1]); text = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim(); }
    let ans = q.answer || "";
    const marked = opts.map((o, i) => (new RegExp(MARKED_SRC, "i").test(o) ? i : -1)).filter((i) => i >= 0);
    if (marked.length) { opts = opts.map((o) => o.replace(new RegExp(MARKED_SRC, "gi"), "").trim()); if (marked.length === 1 && opts.length > 1 && !ans) ans = QX_OPT[marked[0]]; }
    if (keyAns && !ans) ans = keyAns;
    const sec = q.section, low = text.toLowerCase();
    const tf = new Set(["true", "false", "t", "f", "صح", "خطأ", "صواب"]);
    let qt;
    if (opts.length >= 2 && opts.every((o) => tf.has(o.toLowerCase().replace(/^[. ]+|[. ]+$/g, "")))) {
      qt = "True / False";
      if ((ans === "A" || ans === "B") && opts.length === 2) ans = "tص".includes(opts["AB".indexOf(ans)].toLowerCase()[0]) ? "True" : "False";
      opts = [];
    } else if (opts.length >= 2) qt = "MCQ";
    else if (sec === "Matching") qt = "Matching";
    else if (sec === "True / False" || /\(\s*(?:t\s*\/\s*f|true\s*\/\s*false|true or false)\s*\)\s*$/.test(low)) { qt = "True / False"; text = text.replace(/\(\s*(?:t\s*\/\s*f|true\s*\/\s*false|true or false)\s*\)\s*$/i, "").trim(); }
    else if (/_{3,}|\.{5,}|…{2,}/.test(text) || sec === "Fill in the blank") { qt = "Fill in the blank"; text = text.replace(/(?:\.{5,}|…{2,}|_{3,})/g, "___"); if (!ans && q.blank_ans) ans = q.blank_ans; }
    else if (sec === "Short Essay" || sec === "Long Essay") qt = sec;
    else if ((marks || 0) >= 5 || /\b(?:discuss|describe in detail|elaborate|critically|compare and contrast|write an essay|essay)\b|ناقش|اشرح بالتفصيل/.test(low)) qt = "Long Essay";
    else qt = "Short Essay";
    if (qt === "True / False" && ans) { const c = String(ans).toLowerCase()[0]; ans = "tص".includes(c) ? "True" : "fخ".includes(c) ? "False" : ans; }
    if (qt === "MCQ" && ans) {
      const a = String(ans).trim();
      if (a.length === 1 && QX_OPT.includes(a.toUpperCase())) ans = a.toUpperCase();
      else { const hit = opts.findIndex((o) => o.toLowerCase().replace(/^[ .]+|[ .]+$/g, "") === a.toLowerCase().replace(/^[ .]+|[ .]+$/g, "")); ans = hit >= 0 ? QX_OPT[hit] : ""; }
    }
    const row = { add: true, question_type: qt, question_text: text, correct_answer: qt === "Short Essay" || qt === "Long Essay" ? "" : ans,
      max_marks: marks !== null ? marks : QX_DEFAULT_MARKS[qt], cognitive_level: "Not classified", model_answer: qt === "Short Essay" || qt === "Long Essay" ? q.model || "" : "", slos: "", source: q.source || "" };
    [...QX_OPT].forEach((L, i) => { row[L] = i < opts.length ? opts[i] : ""; });
    if (opts.length > 6) row.F = opts.slice(5).join(" / ");
    return row;
  }

  const HEAD = { question: "question_text", questions: "question_text", "question text": "question_text", stem: "question_text", "question stem": "question_text", item: "question_text", statement: "question_text", "السؤال": "question_text",
    type: "question_type", "question type": "question_type", "نوع السؤال": "question_type", answer: "correct_answer", "correct answer": "correct_answer", key: "correct_answer", correct: "correct_answer",
    "answer key": "correct_answer", "الإجابة": "correct_answer", "الإجابة الصحيحة": "correct_answer", marks: "max_marks", mark: "max_marks", points: "max_marks", score: "max_marks", "max marks": "max_marks", "الدرجة": "max_marks",
    "model answer": "model_answer", "marking points": "model_answer", "cognitive level": "cognitive_level", level: "cognitive_level", slo: "slos", slos: "slos" };
  /** A sheet that already has a 'Question' column (and maybe A-D, Answer, Marks) -> question rows. */
  function tableRows(grid, source) {
    grid = grid.map((r) => r.map((c) => T.s(c).trim())).filter((r) => r.some(Boolean));
    if (!grid.length) return null;
    const width = Math.max(...grid.map((r) => r.length)), keep = Array.from({ length: width }, (_, j) => grid.some((r) => r[j]));
    grid = grid.map((r) => Array.from({ length: width }, (_, j) => r[j] || "").filter((_, j) => keep[j]));
    let hdr = -1; for (let i = 0; i < Math.min(grid.length, 15); i++) if (grid[i].some((c) => HEAD[c.toLowerCase()] === "question_text")) { hdr = i; break; }
    if (hdr < 0) return null;
    const names = grid[hdr], colmap = {}, optcols = {};
    names.forEach((nm, j) => {
      const l = nm.toLowerCase().replace(/^[ :]+|[ :]+$/g, "");
      if (HEAD[l] && !Object.values(colmap).includes(HEAD[l])) { colmap[j] = HEAD[l]; return; }
      const m = /^(?:option|choice|opt\.?|answer|الخيار)?\s*\(?([a-f]|[1-6]|[أبجده])\)?$/.exec(l);
      if (m) { const k = m[1]; optcols[j] = AR_LET[k] || (/[a-f]/.test(k) ? k.toUpperCase() : QX_OPT[+k - 1]); }
    });
    const rows = [];
    grid.slice(hdr + 1).forEach((vals) => {
      const g = {}; Object.entries(colmap).forEach(([j, c]) => { g[c] = T.s(vals[j]).trim(); });
      if (!g.question_text) return;
      const o6 = ["", "", "", "", "", ""]; Object.entries(optcols).forEach(([j, L]) => { o6[QX_OPT.indexOf(L)] = T.s(vals[j]).trim(); });
      const opts = o6.filter(Boolean);
      const q = { num: null, text: g.question_text, opts, answer: g.correct_answer || "", model: g.model_answer || "", blank_ans: g.correct_answer || "", section: null, source };
      const t = (g.question_type || "").toLowerCase();
      if (t) q.section = Q_TYPES.find((x) => x.toLowerCase() === t) || section(t) || (t.includes("mcq") || t.includes("multiple") ? "MCQ" : t.includes("long") ? "Long Essay" : t.includes("short") || t.includes("essay") ? "Short Essay" : null);
      const row = finish(q);
      if (Q_TYPES.includes(q.section) && q.section !== row.question_type && !(q.section === "MCQ" && opts.length < 2)) row.question_type = q.section;
      if (g.max_marks) { const mk = parseFloat(g.max_marks); if (!isNaN(mk)) row.max_marks = mk; }
      const lv = (g.cognitive_level || "").toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()); if (QX_LEVELS.includes(lv)) row.cognitive_level = lv;
      if (g.slos) row.slos = g.slos;
      rows.push(row);
    });
    return rows;
  }

  /* ---------------------------------------------------------------- reading the files */
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const kids = (el, tag) => [...el.childNodes].filter((n) => n.nodeType === 1 && n.namespaceURI === W && n.localName === tag);
  const kid = (el, tag) => (el ? kids(el, tag)[0] || null : null);
  const wv = (el, a) => (el ? el.getAttributeNS(W, a) || el.getAttribute("w:" + a) : null);
  /** Word file -> text in reading order. Word's automatic numbering is added back as markers; a bold, highlighted or
      underlined option (and only one) is marked as the correct one. (TAMA's _qx_docx_text) */
  async function docxText(buf) {
    await T.importer.lib("jszip");
    const zip = await JSZip.loadAsync(buf), P = new DOMParser();
    const xml = async (n) => { const f = zip.file(n); return f ? P.parseFromString(await f.async("string"), "application/xml") : null; };
    const doc = await xml("word/document.xml"), num = await xml("word/numbering.xml"), sty = await xml("word/styles.xml");
    const fmts = {}, lvlInd = {};
    if (num) {
      const absf = {};
      kids(num.documentElement, "abstractNum").forEach((an) => { const aid = wv(an, "abstractNumId"); kids(an, "lvl").forEach((lv) => { const il = wv(lv, "ilvl"), nf = kid(lv, "numFmt"); absf[aid + "|" + il] = nf ? wv(nf, "val") : ""; const ind = kid(kid(lv, "pPr"), "ind"); if (ind) lvlInd[aid + "|" + il] = (+(wv(ind, "left") || wv(ind, "start") || 0)) * 635; }); });
      kids(num.documentElement, "num").forEach((n) => { const a = kid(n, "abstractNumId"); if (!a) return; const aid = wv(a, "val"); Object.keys(absf).forEach((k) => { const [x, il] = k.split("|"); if (x === aid) { fmts[wv(n, "numId") + "|" + il] = absf[k]; if (lvlInd[k] !== undefined) lvlInd["n" + wv(n, "numId") + "|" + il] = lvlInd[k]; } }); });
    }
    const styles = {}; if (sty) kids(sty.documentElement, "style").forEach((s) => { styles[wv(s, "styleId")] = s; });
    const styleChain = (id) => { const out = []; let s = styles[id], n = 0; while (s && n++ < 20) { out.push(s); const b = kid(s, "basedOn"); s = b ? styles[wv(b, "val")] : null; } return out; };
    const ents = [];
    const para = (p) => {
      const t = [...p.getElementsByTagNameNS(W, "*")].filter((n) => ["t", "tab", "br", "cr"].includes(n.localName)).map((n) => (n.localName === "t" ? n.textContent : n.localName === "tab" ? "\t" : "\n")).join("").trim();
      if (!t) return;
      const runs = [...p.getElementsByTagNameNS(W, "r")].filter((r) => [...r.getElementsByTagNameNS(W, "t")].some((x) => x.textContent.trim()));
      const on = (rpr, tag) => { const e = kid(rpr, tag); if (!e) return false; const v = wv(e, "val"); return !(v === "false" || v === "0" || v === "none"); };
      const mark = runs.length && runs.every((r) => { const rpr = kid(r, "rPr"); return on(rpr, "b") || !!kid(rpr, "highlight") || on(rpr, "u"); }) ? " ✓" : "";
      let info = null;
      try {
        const ppr = kid(p, "pPr"); let np = kid(ppr, "numPr"); const st = kid(ppr, "pStyle"), chain = st ? styleChain(wv(st, "val")) : [];
        for (const s of chain) { if (np) break; np = kid(kid(s, "pPr"), "numPr"); }
        const nidE = kid(np, "numId");
        if (np && nidE && wv(nidE, "val") !== "0") {
          const nid = wv(nidE, "val"), ilE = kid(kid(ppr, "numPr"), "ilvl") || kid(np, "ilvl"), il = ilE ? wv(ilE, "val") : "0";
          let ind = null; const pi = kid(ppr, "ind"); if (pi && (wv(pi, "left") || wv(pi, "start"))) ind = (+(wv(pi, "left") || wv(pi, "start"))) * 635;
          if (ind === null) for (const s of chain) { const si = kid(kid(s, "pPr"), "ind"); if (si && (wv(si, "left") || wv(si, "start"))) { ind = (+(wv(si, "left") || wv(si, "start"))) * 635; break; } }
          if (ind === null) ind = lvlInd["n" + nid + "|" + il] || 0;
          info = [fmts[nid + "|" + il] || "decimal", +il, ind];
        }
      } catch (e) { info = null; }
      ents.push([t, mark, info]);
    };
    const body = kid(doc.documentElement, "body");
    [...body.childNodes].filter((n) => n.nodeType === 1).forEach((el) => {
      if (el.localName === "p") para(el);
      else if (el.localName === "tbl") kids(el, "tr").forEach((tr) => kids(tr, "tc").forEach((tc) => { const vm = kid(kid(tc, "tcPr"), "vMerge"); if (vm && wv(vm, "val") !== "restart") return; kids(tc, "p").forEach(para); }));
    });
    const notQ = (i) => i[0].includes("etter") || ["bullet", "arabicAbjad", "arabicAlpha", "none"].includes(i[0]);
    const nums = ents.map((e) => e[2]).filter((i) => i && !notQ(i));
    const top = nums.length ? nums.reduce((a, i) => (i[1] < a[0] || (i[1] === a[0] && i[2] < a[1]) ? [i[1], i[2]] : a), [nums[0][1], nums[0][2]]) : null;
    const lines = ents.map(([t, mark, info]) => {
      if (!info) return t + (OPTRE.test(t) ? mark : "");
      if (top && info[1] === top[0] && info[2] === top[1] && !notQ(info)) return "§Q " + t;
      return "§O " + t + mark;
    });
    const out = []; let n = 0;
    lines.forEach((l) => {
      if (l.startsWith("§O ")) { out.push(OPTRE.test(l.slice(3)) ? l.slice(3) : `${QX_OPT[Math.min(n, 5)]}. ${l.slice(3)}`); n++; }
      else { if (l.startsWith("§Q ") || QSTART[1].test(l) || QSTART[2].test(l)) n = 0; out.push(l); }
    });
    return out.join("\n");
  }
  async function pdfRead(buf, name) {
    await T.importer.lib("pdf");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise, texts = [], pics = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p), items = (await page.getTextContent()).items.filter((it) => it.str.trim()), lines = [];
      items.forEach((it) => { const y = Math.round(it.transform[5]); let ln = lines.find((l) => Math.abs(l.y - y) < 3); if (!ln) { ln = { y, parts: [] }; lines.push(ln); } ln.parts.push({ x: it.transform[4], s: it.str }); });
      const t = lines.sort((a, b) => b.y - a.y).map((l) => l.parts.sort((a, b) => a.x - b.x).map((x) => x.s).join(" ").replace(/\s+/g, " ").trim()).join("\n");
      if (t.trim().length < 40) {   // a scanned page: it is a picture, not text
        try { const vp = page.getViewport({ scale: 150 / 72 }), c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; pics.push([`${name} page ${p}`, c.toDataURL("image/jpeg", 0.85)]); } catch (e) { /* skipped */ }
      } else texts.push(t);
    }
    return { text: texts.join("\n"), pics };
  }
  const fileUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  /** One file -> { rows found offline, text for the AI, pictures only the AI can read, note } */
  async function readFile(f) {
    const name = f.name, low = name.toLowerCase();
    if (/\.(png|jpe?g|webp|bmp)$/.test(low)) return { rows: [], text: "", pics: [[name, await fileUrl(f)]], note: "" };
    const buf = await f.arrayBuffer();
    if (low.endsWith(".pdf")) { const { text, pics } = await pdfRead(buf, name); return { rows: parseText(text, name), text, pics, note: "" }; }
    if (low.endsWith(".docx")) { const text = await docxText(buf); return { rows: parseText(text, name), text, pics: [], note: "" }; }
    if (low.endsWith(".doc")) return { rows: [], text: "", pics: [], note: `${name}: old Word format (.doc). Open it in Word and use File > Save As > Word Document (.docx), then upload it again.` };
    if (/\.(xlsx|xls|csv)$/.test(low)) {
      await T.importer.lib("xlsx");
      const wb = low.endsWith(".csv") ? XLSX.read(new TextDecoder().decode(buf), { type: "string" }) : XLSX.read(buf, { type: "array" });
      const rows = [], texts = [];
      wb.SheetNames.forEach((sn) => {
        const grid = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: "" }), src = low.endsWith(".csv") ? name : `${name} (${sn})`;
        const tr = tableRows(grid, src);
        if (tr && tr.length) rows.push(...tr);
        else { const t = grid.map((r) => r.map((x) => T.s(x).trim()).filter(Boolean).join(" ")).join("\n"); texts.push(t); rows.push(...parseText(t, src)); }
      });
      return { rows, text: texts.join("\n"), pics: [], note: "" };
    }
    if (low.endsWith(".txt")) { const text = new TextDecoder().decode(buf); return { rows: parseText(text, name), text, pics: [], note: "" }; }
    return { rows: [], text: "", pics: [], note: `${name}: this kind of file cannot be read.` };
  }

  /* ---------------------------------------------------------------- the AI (the user's own linked tool) */
  const AI_SYSTEM = "You copy exam questions out of exam papers for a university teacher. Copy the wording exactly as written, in its original language (Arabic or English); fix only obvious scanning errors. Never invent a question, an option or an answer.";
  const AI_TASK = `Find every exam question in the material and return a JSON list. One object per question:
{"type": "MCQ" | "True / False" | "Fill in the blank" | "Matching" | "Short Essay" | "Long Essay",
 "text": the question stem without its number (for fill in the blank write ___ for each blank),
 "options": MCQ: the options in order without their letters; Matching: up to 6 strings "left item = right item"; otherwise [],
 "answer": MCQ: the letter of the correct option; True / False: "True" or "False"; Fill in the blank: the answers separated by ;
           leave "" when the paper does not show the correct answer (do not guess),
 "marks": the marks shown for the question, or null,
 "model_answer": model answer / marking points if the paper gives them, else ""}
Short Essay = brief answer (a few lines); Long Essay = an extended answer (e.g. discuss, describe in detail, 5 marks or more).
Leave out instructions, headers and student details. If there are no questions, return [].`;
  const shrink = (url) => new Promise((res) => { const im = new Image(); im.onload = () => { const s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); res({ mime: "image/jpeg", b64: c.toDataURL("image/jpeg", 0.85).split(",")[1] }); }; im.onerror = () => res(null); im.src = url; });
  async function aiExtract(text, pics, source) {
    const imgs = (await Promise.all((pics || []).map(([, u]) => shrink(u)))).filter(Boolean);
    const prompt = AI_TASK + (T.s(text).trim() ? "\n\nMATERIAL (text taken from the file):\n" + text : "\n\nThe material is in the picture(s).");
    const txt = await T.aiAsk(prompt, AI_SYSTEM, 16000, false, imgs);
    const m = /\[[\s\S]*\]/.exec(txt); if (!m) throw new Error("the AI answer was not in the expected format. Try again.");
    let items; try { items = JSON.parse(m[0]); } catch (e) { throw new Error("the AI answer was not in the expected format (it may have been cut off). Try again with fewer pages at a time."); }
    const rows = [];
    (Array.isArray(items) ? items : []).forEach((it) => {
      if (!it || typeof it !== "object" || (!T.s(it.text).trim() && !(it.options || []).length)) return;
      const qt = Q_TYPES.includes(it.type) ? it.type : null;
      const q = { num: null, text: T.s(it.text), opts: (it.options || []).map(String).filter((o) => o.trim()), answer: T.s(it.answer), model: T.s(it.model_answer), blank_ans: T.s(it.answer), section: qt, source };
      let pairs = []; if (qt === "Matching") { pairs = q.opts; q.opts = []; }
      const row = finish(q); if (qt) row.question_type = qt;
      if (qt === "Matching") [...QX_OPT].forEach((L, i) => { row[L] = pairs[i] || ""; });
      if (qt === "Fill in the blank") row.correct_answer = q.answer;
      const mk = parseFloat(it.marks); if (!isNaN(mk) && mk > 0) row.max_marks = mk; else if (qt) row.max_marks = QX_DEFAULT_MARKS[qt];
      rows.push(row);
    });
    return rows;
  }

  /* ---------------------------------------------------------------- found questions -> the exam */
  function toQuestions(list, sel, exam, startN, used, sloIds, slo2clo) {
    const out = [], notes = []; let n = startN;
    const up = Object.fromEntries(sloIds.map((s) => [String(s).trim().toUpperCase(), s]));
    list.forEach((r) => {
      if (r.add !== true || !(T.s(r.question_text).trim() || [...QX_OPT].some((L) => T.s(r[L]).trim()))) return;
      while (used.has(`Q${n}`)) n++; const qid = `Q${n}`; used.add(qid); n++;
      const qt = Q_TYPES.includes(r.question_type) ? r.question_type : "Short Essay";
      const opts = [...QX_OPT].map((L) => T.s(r[L]).trim()).filter(Boolean);
      let ans = T.s(r.correct_answer).trim(), oj = "", lines = "";
      if (qt === "MCQ") { oj = JSON.stringify(opts); ans = QX_OPT.slice(0, opts.length).includes(ans.slice(0, 1).toUpperCase()) && ans ? ans.slice(0, 1).toUpperCase() : ""; if (opts.length < 2) notes.push(`${qid} is an MCQ with fewer than 2 options`); if (!ans) notes.push(`${qid} has no correct answer yet`); }
      else if (qt === "Matching") oj = JSON.stringify(opts.map((o) => (o.includes("=") ? [o.slice(0, o.indexOf("=")), o.slice(o.indexOf("=") + 1)] : [o, ""]).map((x) => x.trim())));
      else if (qt === "True / False") { const c = ans.toLowerCase()[0] || ""; ans = c && "tص".includes(c) ? "True" : c && "fخ".includes(c) ? "False" : ""; if (!ans) notes.push(`${qid} has no correct answer yet`); }
      else if (qt === "Short Essay" || qt === "Long Essay") lines = qt === "Short Essay" ? 5 : 15;
      const sl = [], unknown = [];
      T.s(r.slos).split(/[,;/\s]+/).forEach((s) => { if (!s.trim()) return; const hit = up[s.trim().toUpperCase()]; (hit ? sl : unknown).push(hit || s.trim()); });
      if (unknown.length) notes.push(`${qid}: SLO ${unknown.join(", ")} is not in this course`);
      const cl = []; sl.forEach((s) => { const c = slo2clo[s]; if (c && !cl.includes(c)) cl.push(c); });
      const mk = parseFloat(r.max_marks);
      out.push({ course_code: sel, assessment: exam, question_id: qid, max_marks: !isNaN(mk) ? mk : QX_DEFAULT_MARKS[qt] || 1, topic: "", cognitive_level: QX_LEVELS.includes(r.cognitive_level) ? r.cognitive_level : "Not classified",
        map_basis: sl.length ? "SLOs" : "CLOs", slos: sl.join(", "), clos: cl.join(", "), question_type: qt, question_text: T.s(r.question_text).trim(), options: oj,
        correct_answer: qt === "Short Essay" || qt === "Long Essay" ? "" : ans, model_answer: qt === "Short Essay" || qt === "Long Essay" ? T.s(r.model_answer).trim() : "", answer_lines: lines, image: "" });
    });
    return { out, notes };
  }

  /* ---------------------------------------------------------------- the import box */
  const found = {};   // course||exam -> rows to check (kept while the page is open, as TAMA keeps them for the session)
  T.bpImportHtml = function (sel, exam) {
    const k = `${sel}||${exam}`, rows = found[k] || [], ai = T.aiReady();
    const counts = {}; rows.forEach((r) => { counts[r.question_type] = (counts[r.question_type] || 0) + 1; });
    const nTick = rows.filter((r) => r.add).length;
    return `<details class="sum-box" id="qx-box" ${rows.length || S.ui.qxOpen ? "open" : ""}><summary>Import exam questions from files (pictures, PDF, Word, Excel)</summary>
      <p class="note">Upload one or more old exam papers or question banks. TAMA finds the MCQ and essay questions, shows them in a table for you to check, and then adds them to this exam, so they print in the TAMA exam paper format.
        Word, Excel and typed PDF files are read inside this browser (nothing is sent anywhere). Photos and scanned pages need your linked AI tool (Ask the assistant > Link my AI tool).</p>
      <div class="row-btns"><label class="btn sm"><input type="file" id="qx-files" multiple accept=".png,.jpg,.jpeg,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" hidden>Choose files</label>
        <span class="muted" id="qx-names"></span></div>
      <div class="row-btns" id="qx-go-row" hidden><button class="btn primary sm" id="qx-go">Extract the questions</button>
        <button class="btn sm" id="qx-goai" ${ai ? "" : "disabled"} title="${ai ? "Sends the question files (not student data) to your linked AI tool. It can also read photos and scanned pages." : "Link your AI tool under Ask the assistant > Link my AI tool to use this."}">Extract with AI (more accurate, needs internet)</button></div>
      ${rows.length ? `<h4>Check the questions found (${rows.length}: ${Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(", ")})</h4>
        <p class="note">Edit any box to correct it. A-F are the MCQ options (for Matching write 'left item = right item'). Correct answer: the option letter (A, B ...) for MCQ, True or False, or the blank answers separated by ;. SLO: type ONE SLO code per question (e.g. SLO2); its CLO is filled in for you. Untick a row to leave it out.</p>
        <div class="bp-wrap"><table class="tbl qx-tbl"><colgroup><col style="width:40px"><col style="width:130px"><col style="width:260px">${[...QX_OPT].map(() => `<col style="width:110px">`).join("")}<col style="width:90px"><col style="width:64px"><col style="width:120px"><col style="width:180px"><col style="width:80px"><col style="width:120px"></colgroup>
        <thead><tr><th>Add</th><th>Type</th><th>Question</th>${[...QX_OPT].map((L) => `<th>${L}</th>`).join("")}<th>Correct answer</th><th>Marks</th><th>Cognitive level</th><th>Model answer (essays)</th><th>SLO (one)</th><th>From file</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td class="ctr"><input type="checkbox" data-qx="${i}" data-c="add" ${r.add ? "checked" : ""}></td>
          <td><select class="cell filled" data-qx="${i}" data-c="question_type">${Q_TYPES.map((t) => `<option ${t === r.question_type ? "selected" : ""}>${t}</option>`).join("")}</select></td>
          ${["question_text", ...QX_OPT, "correct_answer", "max_marks"].map((c) => `<td><textarea class="cell ${T.s(r[c]).trim() ? "filled" : ""}" rows="1" data-qx="${i}" data-c="${c}" data-ref="qx:${i}:${c}">${esc(T.s(r[c]))}</textarea></td>`).join("")}
          <td><select class="cell filled" data-qx="${i}" data-c="cognitive_level">${QX_LEVELS.map((t) => `<option ${t === r.cognitive_level ? "selected" : ""}>${t}</option>`).join("")}</select></td>
          ${["model_answer", "slos"].map((c) => `<td><textarea class="cell ${T.s(r[c]).trim() ? "filled" : ""}" rows="1" data-qx="${i}" data-c="${c}" data-ref="qx:${i}:${c}">${esc(T.s(r[c]))}</textarea></td>`).join("")}
          <td class="ro muted">${esc(r.source)}</td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn primary sm" id="qx-add" ${nTick ? "" : "disabled"}>Add the ${nTick} ticked question(s) to ${esc(exam)}</button><button class="btn sm" id="qx-clear">Clear this list</button></div>` : ""}
      </details>
      <details class="sum-box" id="qi-box"><summary>Import question blueprint (a TAMA questions file)</summary>
        <p class="note">An Excel or CSV file with the columns course_code, assessment, question_id, max_marks, topic, cognitive_level and clos (as the 'Download blueprint CSV' file). <b>Importing REPLACES all the questions that are saved now</b> (for all courses and exams).</p>
        <div class="row-btns"><button class="btn sm" id="qi-tpl">⬇ Download the questions file to fill in (Excel)</button><label class="btn sm"><input type="file" id="qi-file" accept=".xlsx,.xls,.csv" hidden>Choose the file</label><span class="muted" id="qi-name"></span></div>
        <p class="note">The downloaded file already holds every question saved now (all courses and exams), so nothing is lost when you import it back. If none is saved yet, it has one example row for ${esc(exam)} to copy; change or delete it. Its second sheet explains each column.</p>
        <div id="qi-confirm" hidden><label class="tick-line"><input type="checkbox" id="qi-ok"> Yes, replace the saved questions</label><div class="row-btns"><button class="btn sm" id="qi-go">Import these questions</button></div></div>
      </details>`;
  };

  T.bpImportWire = function (sel, exam, el) {
    const k = `${sel}||${exam}`, redraw = () => T.refresh("bpTab");
    const box = $("#qx-box", el); if (box) box.ontoggle = () => { S.ui.qxOpen = box.open; S.saveUi(); };
    const fi = $("#qx-files", el), row = $("#qx-go-row", el);
    if (fi) fi.onchange = () => { $("#qx-names", el).textContent = [...fi.files].map((f) => f.name).join(", "); row.hidden = !fi.files.length;
      if ([...fi.files].some((f) => /\.(png|jpe?g)$/i.test(f.name)) && !T.aiReady()) T.toast("Pictures can only be read by the AI. Link your AI tool under Ask the assistant > Link my AI tool, then press Extract with AI."); };
    const run = async (useAi) => {
      const files = [...(fi.files || [])]; if (!files.length) return;
      const bAi = $("#qx-goai", el), bGo = $("#qx-go", el); bAi.disabled = bGo.disabled = true; (useAi ? bAi : bGo).textContent = "Reading the files...";
      const got = [], notes = [], skipped = [];
      for (const f of files) {
        let r; try { r = await readFile(f); } catch (e) { notes.push(`${f.name}: could not be read (${e.message || e})`); continue; }
        if (r.note) { notes.push(r.note); continue; }
        if (useAi) {
          try {
            if (r.text.trim()) for (let i = 0; i < r.text.length; i += 12000) got.push(...await aiExtract(r.text.slice(i, i + 12000), [], f.name));
            for (let i = 0; i < r.pics.length; i += 4) got.push(...await aiExtract("", r.pics.slice(i, i + 4), r.pics.length > 1 ? r.pics[i][0] : f.name));
          } catch (e) { notes.push(`${f.name}: the AI could not read it (${e.message}). The questions found without AI are shown instead.`); got.push(...r.rows); }
        } else { got.push(...r.rows); if (r.pics.length) skipped.push(`${f.name} (${r.pics.length} picture/scanned page${r.pics.length > 1 ? "s" : ""})`); }
      }
      if (got.length) found[k] = [...(found[k] || []), ...got];
      let msg = got.length ? `Found ${got.length} question(s).` : "No questions were found in these files.";
      if (skipped.length) msg += " Not read without AI: " + skipped.join("; ") + (T.aiReady() ? " - press Extract with AI." : " - link your AI tool to read them.");
      if (notes.length) msg += " " + notes.join(" ");
      T.toast(msg); redraw();
    };
    const go = $("#qx-go", el); if (go) go.onclick = () => run(false);
    const goai = $("#qx-goai", el); if (goai) goai.onclick = () => run(true);
    $$("[data-qx]", el).forEach((x) => {
      const ev = x.type === "checkbox" || x.tagName === "SELECT" ? "onchange" : "oninput";
      x[ev] = () => { const r = (found[k] || [])[+x.dataset.qx]; if (!r) return; r[x.dataset.c] = x.type === "checkbox" ? x.checked : x.value;
        if (x.tagName === "TEXTAREA") { T.autoGrow(x); x.classList.toggle("filled", !!x.value.trim()); }
        if (ev === "onchange") redraw(); };
    });
    const add = $("#qx-add", el); if (add) add.onclick = () => {
      const all = S.data.tables.questions = Array.isArray(S.data.tables.questions) ? S.data.tables.questions : [];
      const here = all.filter((q) => String(q.course_code) === String(sel) && T.s(q.assessment) === exam), used = new Set(here.map((q) => T.s(q.question_id).trim().toUpperCase()));
      const slos = S.t("slos").filter((r) => String(r.course_code) === String(sel));
      const { out, notes } = toQuestions(found[k] || [], sel, exam, here.length + 1, used, slos.map((s) => String(s.slo_id)), Object.fromEntries(slos.map((s) => [String(s.slo_id), T.s(s.clo_id)])));
      if (!out.length) return;
      all.push(...out); found[k] = (found[k] || []).filter((r) => !r.add); if (!found[k].length) delete found[k];
      S.save(); T.toast(`${out.length} question(s) added to ${exam} (${out[0].question_id} to ${out[out.length - 1].question_id}). They are in the exam paper below.` + (notes.length ? " Please check: " + notes.slice(0, 12).join("; ") + (notes.length > 12 ? "..." : "") + "." : ""));
      redraw();
    };
    const clr = $("#qx-clear", el); if (clr) clr.onclick = () => { delete found[k]; redraw(); };
    // the TAMA questions file to fill in: all the saved questions (or one example row), plus a sheet explaining the columns
    const tpl = $("#qi-tpl", el);
    if (tpl) tpl.onclick = async () => {
      try {
        await T.importer.lib("xlsx");
        const saved = (S.data.tables.questions || []).map((q) => Object.fromEntries(QUESTION_COLS.map((c) => [c, q[c] ?? ""])));
        const ex = { course_code: sel, assessment: exam, question_id: "Q1", max_marks: 1, topic: "Lecture 1", cognitive_level: "Remember", map_basis: "SLOs", slos: "SLO1", clos: "CLO1",
          question_type: "MCQ", question_text: "Which study design starts from the outcome?", options: "Cohort | Case-control | Randomised trial | Cross-sectional", correct_answer: "B", model_answer: "", answer_lines: "", image: "" };
        // options are saved as a JSON list; in the file they are written the easy way: a | b | c (Matching: left = right | ...)
        const easy = (v) => { try { const x = JSON.parse(T.s(v)); if (Array.isArray(x)) return x.map((o) => (Array.isArray(o) ? `${o[0]} = ${o[1]}` : o)).join(" | "); } catch (e) { /* plain text */ } return T.s(v); };
        const rows = saved.length ? saved.map((r) => ({ ...r, options: easy(r.options), image: r.image ? "(picture kept in TAMA)" : "" })) : [ex];
        const help = [["Column", "Required?", "What to write"],
          ["course_code", "Yes", `The course code exactly as in TAMA, e.g. ${sel}`], ["assessment", "Yes", `The exam name exactly as in the Summative table, e.g. ${exam}`],
          ["question_id", "Yes", "Q1, Q2, Q3 ... (unique inside one exam)"], ["max_marks", "Yes", "The marks of the question, e.g. 1 or 5"],
          ["topic", "Yes", "The lecture / module of the question"], ["cognitive_level", "Yes", "Remember, Understand, Apply, Analyze, Evaluate or Create"],
          ["map_basis", "No", "SLOs or CLOs (empty = CLOs)"], ["slos", "No", "The one SLO the question measures, e.g. SLO2"], ["clos", "Yes", "The CLO(s), separated by commas, e.g. CLO1, CLO3"],
          ["question_type", "No", "MCQ, True / False, Fill in the blank, Matching, Short Essay or Long Essay"], ["question_text", "No", "The question as it is printed on the paper"],
          ["options", "No", "MCQ choices separated by | (Matching: left = right pairs separated by |)"], ["correct_answer", "No", "MCQ: the letter (A, B, C ...). True / False: True or False. Fill in the blank: the word"],
          ["model_answer", "No", "Essay questions: the points of the model answer"], ["answer_lines", "No", "Essay questions: how many lines to leave on the paper"],
          ["image", "No", "Leave empty for a new question; pictures are added in the Exam builder. '(picture kept in TAMA)' keeps the saved picture of that question: do not change it"],
          ["", "", ""], ["IMPORTANT", "", "Importing this file REPLACES all the questions saved now, so keep the rows of the other exams and courses in it."]];
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(rows, { header: QUESTION_COLS });
        ws["!cols"] = QUESTION_COLS.map((c) => ({ wch: ["question_text", "options", "model_answer"].includes(c) ? 40 : 14 }));
        XLSX.utils.book_append_sheet(wb, ws, "Questions");
        const hs = XLSX.utils.aoa_to_sheet(help); hs["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 90 }]; XLSX.utils.book_append_sheet(wb, hs, "How to fill");
        XLSX.writeFile(wb, "TAMA_questions_file.xlsx");
      } catch (e) { T.toast("The file could not be built: " + e.message); }
    };
    // a TAMA questions file: replaces all the saved questions
    const qf = $("#qi-file", el); let pending = null;
    if (qf) qf.onchange = async () => {
      const f = qf.files[0]; if (!f) return; $("#qi-name", el).textContent = f.name; pending = null; $("#qi-confirm", el).hidden = true;
      try {
        const t = (await T.importer.read(f))[0]; if (!t) { T.toast("The file has no table."); return; }
        const req = ["course_code", "assessment", "question_id", "max_marks", "topic", "cognitive_level", "clos"];
        const miss = req.filter((c) => !t.columns.includes(c)); if (miss.length) { T.toast("Required columns: " + [...req].sort().join(", ")); return; }
        const pics = {}; (S.data.tables.questions || []).forEach((q) => { if (q.image) pics[`${q.course_code}||${q.assessment}||${q.question_id}`] = q.image; });
        pending = t.rows.map((r) => { const o = Object.fromEntries(QUESTION_COLS.map((c) => [c, c in r ? r[c] : c === "map_basis" ? "CLOs" : ""]));
          if (T.s(o.image).startsWith("(picture")) o.image = pics[`${o.course_code}||${o.assessment}||${o.question_id}`] || "";
          const op = T.s(o.options).trim();   // "a | b | c" (or "left = right | ...") from the file to fill in -> the saved JSON list
          if (op && !op.startsWith("[")) { const parts = op.split("|").map((x) => x.trim()).filter(Boolean); o.options = JSON.stringify(/matching/i.test(T.s(o.question_type)) ? parts.map((x) => { const i = x.indexOf("="); return i < 0 ? [x, ""] : [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }) : parts); }
          return o; });
        $("#qi-confirm", el).hidden = false;
      } catch (e) { T.toast(e.message); }
    };
    const qg = $("#qi-go", el); if (qg) qg.onclick = () => {
      if (!pending) return; if (!$("#qi-ok", el).checked) { T.toast("Nothing was imported. Tick the box above first."); return; }
      S.data.tables.questions = pending; S.save(); T.toast("Blueprint imported."); redraw();
    };
  };
  T.qx = { parseText, finish, tableRows, docxText };   // for checking
})();
