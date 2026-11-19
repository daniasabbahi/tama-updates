/* Blueprint for written exams, tab 2: Question mapping (TAMA's "blueprint sheet").
   Same saved table as TAMA: tables.questions with columns course_code, assessment, question_id, max_marks, topic, cognitive_level,
   map_basis, slos, clos, question_type, question_text, options (JSON), correct_answer, model_answer, answer_lines, image (data URI). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const Q_TYPES = ["MCQ", "True / False", "Fill in the blank", "Matching", "Short Essay", "Long Essay"];
  const Q_SECTION = { MCQ: "Multiple choice questions", "True / False": "True / False questions", "Fill in the blank": "Fill in the blanks", Matching: "Matching questions", "Short Essay": "Short essay questions", "Long Essay": "Long essay questions" };
  const Q_INSTR = { MCQ: "Choose the ONE best answer.", "True / False": "Mark each statement as True or False.", "Fill in the blank": "Write the missing word(s) in each blank.",
    Matching: "Match each item in the left column with the correct item in the right column.", "Short Essay": "Answer briefly in the space provided.", "Long Essay": "Answer fully in the space provided." };
  const LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create", "Not classified"];
  const QUESTION_COLS = ["course_code", "assessment", "question_id", "max_marks", "topic", "cognitive_level", "map_basis", "slos", "clos", "question_type", "question_text", "options", "correct_answer", "model_answer", "answer_lines", "image", "options_layout"];
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const split = (t) => T.s(t).replace(/;/g, ",").split(",").map((x) => x.trim()).filter((x) => x && !["nan", "none"].includes(x.toLowerCase()));
  const num = (v) => { const x = parseFloat(String(v === undefined || v === null ? "" : v).replace(",", ".").trim()); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const jl = (v) => { try { const x = typeof v === "string" && v.trim() ? JSON.parse(v) : Array.isArray(v) ? v : []; return Array.isArray(x) ? x : []; } catch (e) { return []; } };
  const natKey = (s) => T.s(s).split(/(\d+)/).map((p, i) => (i % 2 ? p.padStart(8, "0") : p.toLowerCase())).join("");
  const qOf = (sel, exam) => tbl("questions").filter((q) => String(q.course_code) === String(sel) && (exam === undefined || T.s(q.assessment) === exam));
  const draftKey = (sel, exam) => `${sel}||${exam}`;
  const draft = (sel, exam) => { S.ui.qDraft = S.ui.qDraft || {}; const k = draftKey(sel, exam); return (S.ui.qDraft[k] = S.ui.qDraft[k] || { type: "MCQ", marks: "1", level: "Remember", nopt: 4, npair: 4, opts: [], pairs: [] }); };
  const fmtMarks = (v) => { const x = num(v); if (x === null) return ""; return `${g2(x)} mark${Math.abs(x - 1) < 1e-9 ? "" : "s"}`; };

  function sloInfo(sel) {
    const slos = tbl("slos").filter((r) => String(r.course_code) === String(sel)), clos = T.closOf(sel);
    return { slos, clos, slo2clo: Object.fromEntries(slos.map((r) => [String(r.slo_id), T.s(r.clo_id)])),
      sloLabel: (id) => { const r = slos.find((x) => String(x.slo_id) === String(id)); return r ? `${r.slo_id} - ${T.s(r.slo_text).slice(0, 60)}` : id; },
      cloLabel: (id) => { const r = clos.find((x) => String(x.clo_id) === String(id)); return r ? `${r.clo_id} - ${T.s(r.clo_text).slice(0, 60)}` : id; } };
  }
  const nextId = (sel, exam) => { const used = new Set(qOf(sel, exam).map((q) => T.s(q.question_id).trim().toUpperCase())); let n = qOf(sel, exam).length + 1; while (used.has(`Q${n}`)) n++; return `Q${n}`; };

  /** Shrink a picture and return it as a data URI (as TAMA: at most 1000 px, JPEG, under about 600 KB). */
  function prepImage(file) {
    return new Promise((res, rej) => {
      const r = new FileReader(); r.onerror = () => rej(new Error("The picture could not be read."));
      r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error("The picture could not be read."));
        im.onload = () => { const s = Math.min(1, 1000 / Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
          let q = 0.85, out = c.toDataURL("image/jpeg", q); while (out.length * 0.75 > 600000 && q > 0.4) { q -= 0.15; out = c.toDataURL("image/jpeg", q); } res(out); };
        im.src = r.result; };
      r.readAsDataURL(file);
    });
  }

  /* ---------------------------------------------------------------- the tab */
  /** The smaller tabs of the Exam builder (Dania 2026-11-19). */
  const EB_TABS = [["add", "Add questions"], ["bank", "Question bank"], ["print", "Print the exam"], ["reports", "Reports"]];
  T.bpMapTab = function (sel, exam) {
    const info = sloInfo(sel), d = draft(sel, exam), qid = nextId(sel, exam);
    const topics = []; [...info.slos.map((r) => r.topic), ...qOf(sel).map((q) => q.topic)].forEach((t) => { t = T.s(t).trim(); if (t && t.toLowerCase() !== "nan" && !topics.includes(t)) topics.push(t); });
    const autoClo = d.slo && info.slo2clo[d.slo] ? [info.slo2clo[d.slo]] : [];
    const clos = d.closFor === d.slo && Array.isArray(d.clos) ? d.clos : autoClo;
    const t = d.type;
    const content = t === "MCQ" ? `${T.field({ id: "qd-stem", label: "Question stem", req: true, textarea: true, rows: 2, value: d.stem })}
        <div class="grid g3"><label class="fld filled"><span class="lbl">Number of options</span><select id="qd-nopt">${[2, 3, 4, 5, 6].map((n) => `<option ${+d.nopt === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <div class="fld"><span class="lbl">Options in the printed paper <i class="hint" title="Two columns put the options side by side (A and B on the first line, C and D on the next), which saves space for short options.">?</i></span>
            <div class="seg">${[["", "One column"], ["2", "Two columns"]].map(([v, l]) => `<button class="${(d.ocols || "") === v ? "on" : ""}" data-qocol="${v}">${l}</button>`).join("")}</div></div></div>
        <div class="grid g2">${Array.from({ length: +d.nopt }, (_, i) => T.field({ id: `qd-opt${i}`, label: `Option ${String.fromCharCode(65 + i)}`, req: true, value: (d.opts || [])[i] })).join("")}</div>
        <div class="grid g3">${T.select({ id: "qd-ans", label: "Correct answer", req: true, placeholder: "Select the correct option", value: d.ans, options: Array.from({ length: +d.nopt }, (_, i) => String.fromCharCode(65 + i)) })}</div>`
      : t === "True / False" ? `${T.field({ id: "qd-stem", label: "Statement", req: true, textarea: true, rows: 2, value: d.stem })}
        <div class="fld"><span class="lbl">Correct answer <b class="req">*</b></span><div class="seg">${["True", "False"].map((v) => `<button class="${d.ans === v ? "on" : ""}" data-qtf="${v}">${v}</button>`).join("")}</div></div>`
      : t === "Fill in the blank" ? `${T.field({ id: "qd-stem", label: "Question text - write ___ (three underscores) where each blank goes", req: true, textarea: true, rows: 2, value: d.stem, help: "Example: The ___ nerve supplies the muscles of facial expression." })}
        ${T.field({ id: "qd-ans", label: "Correct answer(s) - separate the blanks with a semicolon (;)", req: true, value: d.ans })}`
      : t === "Matching" ? `${T.field({ id: "qd-stem", label: "Instruction / title (optional)", placeholder: "Match each ... with ...", value: d.stem })}
        <div class="grid g3"><label class="fld filled"><span class="lbl">Number of pairs</span><select id="qd-npair">${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option ${+d.npair === n ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
        ${Array.from({ length: +d.npair }, (_, i) => `<div class="grid g2">${T.field({ id: `qd-pl${i}`, label: `Item ${i + 1} (left)`, req: true, value: ((d.pairs || [])[i] || [])[0] })}${T.field({ id: `qd-pr${i}`, label: `Matching answer ${i + 1} (right)`, req: true, value: ((d.pairs || [])[i] || [])[1] })}</div>`).join("")}
        <p class="note">In the printed paper the right column is shuffled and lettered; the answer key shows the correct letters.</p>`
      : `${T.field({ id: "qd-stem", label: "Question", req: true, textarea: true, rows: 3, value: d.stem })}
        <div class="grid g3">${T.field({ id: "qd-lines", label: "Answer space (number of lines in the printed paper)", value: d.lines || (t === "Short Essay" ? "5" : "15") })}</div>
        ${T.field({ id: "qd-model", label: "Model answer / marking points (shown only in the answer key)", textarea: true, rows: 3, value: d.model })}`;
    const all = qOf(sel), here = qOf(sel, exam);
    const multi = all.filter((q) => split(q.slos).length > 1);
    const total = all.reduce((a, q) => a + (num(q.max_marks) || 0), 0);
    const hasPic = (q) => T.s(q.image).startsWith("data:image");
    const multiHtml = `${multi.length ? `<div class="warn-box qm-multi"><div><b>⚠ ${multi.length} question(s) are linked to more than one SLO.</b> A question should measure ONE SLO only, so its marks count correctly for that SLO and its CLO. Pick one SLO for each question and press Save (the first SLO is already selected).
        <table class="tbl sum-tbl"><thead><tr><th>Exam</th><th>Question</th><th>Linked now to</th><th>Keep only this SLO</th></tr></thead><tbody>
        ${multi.map((q, i) => `<tr><td>${esc(q.assessment)}</td><td>${esc(q.question_id)}</td><td>${esc(split(q.slos).join(", "))}</td><td><select class="cell filled" data-ms="${i}">${[...new Set([...split(q.slos), ...info.slos.map((s) => String(s.slo_id))])].map((s) => `<option ${s === split(q.slos)[0] ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>
        <div class="row-btns"><button class="btn primary sm" id="qm-multi-go">💾 Save one SLO for these questions</button></div></div></div>` : ""}`;
    const sub = EB_TABS.some(([k]) => k === S.ui.ebTab) ? S.ui.ebTab : "add";
    const bar = `<div class="tabs sub-tabs">${EB_TABS.map(([k, l]) => `<button class="${k === sub ? "on" : ""}" data-ebtab="${k}">${l}${k === "bank" && all.length ? ` <span class="cnt">${all.length}</span>` : ""}</button>`).join("")}</div>`;
    const addHtml = `<h3 class="qm-h">Add a question to ${esc(exam)}</h3>
      <div class="grid g3">
        <label class="fld locked"><span class="lbl">Question ID (automatic) <i class="hint" title="Numbered automatically by the number of questions in this exam.">?</i></span><input type="text" value="${esc(qid)}" disabled></label>
        ${T.field({ id: "qd-marks", label: "Maximum marks", value: d.marks })}
        ${T.field({ id: "qd-topic", label: "Topic / lecture", placeholder: "Select or type a topic / lecture", value: d.topic, options: topics, help: "The list comes from the lectures entered in Lectures & SLOs and from earlier questions. You can also type a new one." })}
      </div>
      <div class="grid g3">
        ${T.select({ id: "qd-level", label: "Cognitive level", value: d.level, options: LEVELS })}
        ${T.select({ id: "qd-slo", label: "Mapped SLO (one only)", placeholder: "Select the SLO this question measures", value: d.slo, options: info.slos.map((s) => [String(s.slo_id), info.sloLabel(s.slo_id)]), help: "Each question measures ONE SLO, so its marks count for that SLO and its CLO. The CLO is filled in automatically." })}
        <div class="fld"><span class="lbl">Mapped CLOs</span><div class="chips">${info.clos.map((c) => `<label class="chip ${clos.includes(String(c.clo_id)) ? "on" : ""}" title="${esc(info.cloLabel(c.clo_id))}"><input type="checkbox" data-qclo="${esc(c.clo_id)}" ${clos.includes(String(c.clo_id)) ? "checked" : ""}>${esc(c.clo_id)}</label>`).join("") || `<span class="muted">No CLOs yet</span>`}</div></div>
      </div>
      ${!info.slos.length ? `<p class="note">This course has no SLOs yet. Add them in Lectures & SLOs, or map the question to CLOs only.</p>` : ""}
      ${d.slo && !autoClo.length ? `<p class="warn-text">The chosen SLO is not linked to any CLO. Link it in Lectures & SLOs, or choose the CLO here.</p>` : ""}
      <h4>Question content <span class="muted">(used to print the exam paper)</span></h4>
      <div class="grid g3">${T.select({ id: "qd-type", label: "Question type", value: t, options: Q_TYPES, help: "Each type has its own layout in the printed paper." })}</div>
      ${content}
      <div class="fld"><span class="lbl">Add a picture to this question (optional) <i class="hint" title="The picture is shrunk and saved with the question. It is printed under the question text.">?</i></span>
        <div class="row-btns"><label class="btn sm"><input type="file" id="qd-img" accept="image/png,image/jpeg" hidden>Choose a picture</label>${d.image ? `<img src="${esc(d.image)}" class="qd-pic" alt=""><button class="btn sm" id="qd-img-x">Remove</button>` : ""}</div></div>
      <div class="row-btns"><button class="btn primary" id="qd-add">Add question</button></div>
      ${T.bpImportHtml ? T.bpImportHtml(sel, exam) : ""}`;
    const bankHtml = `<h3 class="qm-h">Question bank of this course</h3>
      <p class="note">Every question you add or import is kept here, for all the exams of this course. The questions of ${esc(exam)} come first.</p>
      ${all.length ? `<div class="kcards four qm-k">${[["Total planned marks", g2(total)], ["Questions", all.length], ["Unmapped questions", all.filter((q) => !split(q.clos).length).length], [`Questions in ${exam}`, here.length]].map(([l, v]) => `<div class="kcard"><div class="lab">${esc(l)}</div><div class="big">${v}</div></div>`).join("")}</div>
        <div class="bp-wrap"><table class="tbl sum-tbl qm-list"><thead><tr><th>Exam</th><th>ID</th><th>Type</th><th>Question</th><th class="num">Marks</th><th>Topic</th><th>Cognitive level</th><th>SLOs</th><th>CLOs</th><th>Picture</th></tr></thead>
        <tbody>${all.slice().sort((a, b) => (T.s(a.assessment) === exam ? 0 : 1) - (T.s(b.assessment) === exam ? 0 : 1) || natKey(a.assessment).localeCompare(natKey(b.assessment)) || natKey(a.question_id).localeCompare(natKey(b.question_id))).map((q) => `<tr class="${T.s(q.assessment) === exam ? "" : "other"}"><td>${esc(q.assessment)}</td><td class="b">${esc(q.question_id)}</td><td>${esc(q.question_type)}</td><td class="wrap">${esc(T.s(q.question_text).slice(0, 160))}</td><td class="num">${esc(g2(num(q.max_marks)))}</td><td>${esc(q.topic)}</td><td>${esc(q.cognitive_level)}</td><td>${esc(q.slos)}</td><td>${esc(q.clos)}</td><td>${hasPic(q) ? "Yes" : ""}</td></tr>`).join("")}</tbody></table></div>
        <div class="row-btns"><button class="btn sm" id="qm-csv">Download blueprint CSV</button></div>
        ${here.length ? `<details class="sum-box"><summary>Delete questions of this exam</summary>
          <div class="chips">${here.map((q) => `<label class="chip"><input type="checkbox" data-qdel="${esc(q.question_id)}">${esc(q.question_id)}</label>`).join("")}</div>
          <p class="warn-text" id="qdel-warn" hidden></p>
          <label class="tick-line" hidden id="qdel-ok-l"><input type="checkbox" id="qdel-ok"> Yes, delete these questions</label>
          <div class="row-btns"><button class="btn sm" id="qdel-go">Delete the selected questions</button></div></details>` : ""}`
      : `<p class="note">No questions yet for this course. Add them in <b>Add questions</b>.</p>`}`;
    const printHtml = `<h3 class="qm-h">Print ${esc(exam)}</h3>
      ${here.length ? `<p class="note">${here.length} question(s), ${g2(here.reduce((a, x) => a + (num(x.max_marks) || 0), 0))} marks. The questions are grouped by type, numbered and laid out for printing.</p>
        ${[["Exam paper", false], ["Answer key", true]].map(([l, k]) => `<div class="qm-print"><b>${l}</b><button class="btn sm" data-pp="html" data-pk="${k ? 1 : 0}">⬇ HTML</button><button class="btn sm" data-pp="doc" data-pk="${k ? 1 : 0}">⬇ Word</button><button class="btn sm" data-pp="pdf" data-pk="${k ? 1 : 0}">Print / save as PDF</button></div>`).join("")}
        <p class="note">The HTML file gives the best layout: open it in your browser and press Ctrl+P. "Print / save as PDF" opens the paper and the print window (choose "Save as PDF" there). The Word file opens in Microsoft Word and can be edited${(S.data.paper_templates || {})[sel] || (S.data.paper_templates || {})["*"] ? "; it uses your faculty's Word template" : ""}. Arabic text prints correctly in all three.</p>`
      : `<p class="note">${esc(exam)} has no questions yet. Add them in <b>Add questions</b>, then print the paper here.</p>`}
      ${T.paperInfoHtml ? T.paperInfoHtml(sel, exam) : ""}
      ${T.paperTplHtml ? T.paperTplHtml(sel, exam) : ""}`;
    const body = sub === "bank" ? bankHtml : sub === "print" ? printHtml : sub === "reports" ? (T.bpDownloadsTab ? T.bpDownloadsTab(sel, exam) : "") : addHtml;
    return `${multiHtml}${bar}<div class="sub-body">${body}</div>`;
  };

  /* ---------------------------------------------------------------- wiring */
  T.bpMapWire = function (sel, exam, el) {
    const d = draft(sel, exam), info = sloInfo(sel);
    const keep = () => S.saveUi(), redraw = () => T.refresh("bpTab");
    const bind = (id, f, ev) => { const x = $(id, el); if (x) x[ev || "oninput"] = () => { f(x.value); T.markFilled(x); keep(); }; };
    bind("#qd-stem", (v) => { d.stem = v; }); bind("#qd-marks", (v) => { d.marks = v; }); bind("#qd-topic", (v) => { d.topic = v; });
    bind("#qd-lines", (v) => { d.lines = v; }); bind("#qd-model", (v) => { d.model = v; });
    const ans = $("#qd-ans", el); if (ans) ans[ans.tagName === "SELECT" ? "onchange" : "oninput"] = () => { d.ans = ans.value; T.markFilled(ans); keep(); };
    bind("#qd-level", (v) => { d.level = v; }, "onchange");
    bind("#qd-slo", (v) => { d.slo = v; d.closFor = null; redraw(); }, "onchange");
    bind("#qd-type", (v) => { d.type = v; d.ans = ""; redraw(); }, "onchange");
    bind("#qd-nopt", (v) => { d.nopt = +v; redraw(); }, "onchange"); bind("#qd-npair", (v) => { d.npair = +v; redraw(); }, "onchange");
    $$("[id^=qd-opt]", el).forEach((x) => x.oninput = () => { d.opts = d.opts || []; d.opts[+x.id.slice(6)] = x.value; T.markFilled(x); keep(); });
    $$("[id^=qd-pl],[id^=qd-pr]", el).forEach((x) => x.oninput = () => { d.pairs = d.pairs || []; const i = +x.id.slice(5); d.pairs[i] = d.pairs[i] || ["", ""]; d.pairs[i][x.id[4] === "l" ? 0 : 1] = x.value; T.markFilled(x); keep(); });
    $$("[data-qtf]", el).forEach((b) => b.onclick = () => { d.ans = b.dataset.qtf; keep(); redraw(); });
    $$("[data-qocol]", el).forEach((b) => b.onclick = () => { d.ocols = b.dataset.qocol; keep(); redraw(); });
    $$("[data-qclo]", el).forEach((c) => c.onchange = () => {
      const cur = new Set(d.closFor === d.slo && Array.isArray(d.clos) ? d.clos : (d.slo && info.slo2clo[d.slo] ? [info.slo2clo[d.slo]] : []));
      if (c.checked) cur.add(c.dataset.qclo); else cur.delete(c.dataset.qclo);
      d.clos = info.clos.map((x) => String(x.clo_id)).filter((x) => cur.has(x)); d.closFor = d.slo; keep(); redraw(); });
    const img = $("#qd-img", el); if (img) img.onchange = async () => { const f = img.files[0]; if (!f) return; try { d.image = await prepImage(f); keep(); redraw(); } catch (e) { T.toast(e.message); } };
    const ix = $("#qd-img-x", el); if (ix) ix.onclick = () => { d.image = ""; keep(); redraw(); };
    $$("[data-ebtab]", el).forEach((b) => b.onclick = () => { S.ui.ebTab = b.dataset.ebtab; S.saveUi(); redraw(); });
    const addB = $("#qd-add", el); if (addB) addB.onclick = () => addQuestion(sel, exam, d, info);
    if ($("#dl-xlsx", el) && T.bpDownloadsWire) T.bpDownloadsWire(sel, exam, el);
    if (T.bpImportWire) T.bpImportWire(sel, exam, el);
    const mg = $("#qm-multi-go", el); if (mg) mg.onclick = () => {
      const multi = qOf(sel).filter((q) => split(q.slos).length > 1);
      $$("[data-ms]", el).forEach((s) => { const q = multi[+s.dataset.ms]; if (!q) return; q.slos = s.value; q.map_basis = "SLOs"; if (info.slo2clo[s.value]) q.clos = info.slo2clo[s.value]; });
      S.save(); T.toast("Each question is now linked to one SLO."); redraw(); };
    const csv = $("#qm-csv", el); if (csv) csv.onclick = () => {
      const cols = QUESTION_COLS.filter((c) => c !== "image"), q = (v) => `"${T.s(v).replace(/"/g, '""')}"`;
      const blob = new Blob(["﻿" + [cols.map(q).join(","), ...qOf(sel).map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n")], { type: "text/csv" });
      dl(blob, "exam_blueprint.csv"); };
    $$("[data-pp]", el).forEach((b) => b.onclick = () => printPaper(sel, exam, b.dataset.pk === "1", b.dataset.pp));
    if (T.paperTplWire) T.paperTplWire(sel, exam, el);
    if (T.paperInfoWire) T.paperInfoWire(sel, exam, el);
    // delete + renumber
    const dels = $$("[data-qdel]", el), warn = $("#qdel-warn", el), okl = $("#qdel-ok-l", el);
    dels.forEach((c) => c.onchange = () => { const n = dels.filter((x) => x.checked).map((x) => x.dataset.qdel); warn.hidden = okl.hidden = !n.length;
      warn.textContent = `You are about to DELETE ${n.length} question(s): ${n.join(", ")}. This cannot be undone.`; c.closest(".chip").classList.toggle("on", c.checked); });
    const go = $("#qdel-go", el); if (go) go.onclick = () => {
      const n = dels.filter((x) => x.checked).map((x) => x.dataset.qdel);
      if (!n.length) { T.toast("Tick the questions to delete first."); return; }
      if (!$("#qdel-ok", el).checked) { T.toast("Nothing was deleted. Tick 'Yes, delete these questions' first."); return; }
      deleteQuestions(sel, exam, n); T.toast("Questions deleted and the remaining questions were renumbered (Q1, Q2, Q3 ...)."); redraw(); };
  };

  function addQuestion(sel, exam, d, info) {
    const t = d.type, err = [];
    const stem = T.s(d.stem).trim(); let opts = "", correct = "", model = "", lines = "";
    if (t === "MCQ") {
      const o = Array.from({ length: +d.nopt }, (_, i) => T.s((d.opts || [])[i]).trim()); opts = JSON.stringify(o); correct = T.s(d.ans);
      if (!stem) err.push("question stem"); if (o.some((x) => !x)) err.push("all the options");
      const seen = {}, dups = []; o.forEach((x, i) => { const k = x.toLowerCase().split(/\s+/).join(" "); if (!k) return; if (k in seen) dups.push(`${String.fromCharCode(65 + seen[k])} and ${String.fromCharCode(65 + i)}`); else seen[k] = i; });
      if (dups.length) err.push(`different options (${dups.join("; ")} are identical)`);
      if (!correct || correct.charCodeAt(0) - 65 >= +d.nopt) err.push("the correct answer");
    } else if (t === "True / False") { correct = T.s(d.ans); if (!stem) err.push("statement"); if (!correct) err.push("the correct answer"); }
    else if (t === "Fill in the blank") {
      correct = T.s(d.ans).trim(); const nb = (stem.match(/_{3,}/g) || []).length;
      if (!stem) err.push("question text"); else if (!nb) err.push("at least one blank (___)");
      if (!correct) err.push("the correct answer(s)"); else if (nb && correct.split(";").filter((x) => x.trim()).length !== nb) err.push(`${nb} answer(s), one for each blank`);
    } else if (t === "Matching") {
      const p = Array.from({ length: +d.npair }, (_, i) => [T.s(((d.pairs || [])[i] || [])[0]).trim(), T.s(((d.pairs || [])[i] || [])[1]).trim()]);
      opts = JSON.stringify(p); if (p.some(([a, b]) => !a || !b)) err.push("all the pairs");
    } else { model = T.s(d.model).trim(); lines = Math.min(60, Math.max(1, Math.round(num(d.lines) || (t === "Short Essay" ? 5 : 15)))); if (!stem) err.push("question text"); }
    if (err.length) { T.toast(`Please complete: ${err.join(", ")}.`); return; }
    const marks = num(d.marks); if (marks === null || marks < 0) { T.toast("Enter the maximum marks (0 or more)."); return; }
    const qid = nextId(sel, exam), slos = d.slo ? [d.slo] : [];
    const clos = d.closFor === d.slo && Array.isArray(d.clos) ? d.clos : (d.slo && info.slo2clo[d.slo] ? [info.slo2clo[d.slo]] : []);
    tbl("questions").push({ course_code: sel, assessment: exam, question_id: qid, max_marks: marks, topic: T.s(d.topic).trim(), cognitive_level: d.level || "Remember",
      map_basis: slos.length ? "SLOs" : "CLOs", slos: slos.join(", "), clos: clos.join(", "), question_type: t, question_text: stem, options: opts, options_layout: t === "MCQ" && d.ocols === "2" ? "2" : "", correct_answer: correct,
      model_answer: model, answer_lines: lines, image: d.image || "" });
    // a new empty form, keeping the type, marks, topic and level (as TAMA keeps the last choices)
    S.ui.qDraft[draftKey(sel, exam)] = { type: t, marks: d.marks, level: d.level, topic: d.topic, nopt: d.nopt, npair: d.npair, opts: [], pairs: [], lines: d.lines, ocols: d.ocols };
    S.save(); S.saveUi(); T.toast(`${qid} saved.`); T.refresh("bpTab");
  }

  function deleteQuestions(sel, exam, ids) {
    const all = tbl("questions"), mine = (q) => String(q.course_code) === String(sel) && T.s(q.assessment) === exam;
    S.data.tables.questions = all.filter((q) => !(mine(q) && ids.includes(T.s(q.question_id))));
    const left = S.data.tables.questions.filter(mine), map = {};
    left.forEach((q, i) => { map[T.s(q.question_id)] = `Q${i + 1}`; q.question_id = `Q${i + 1}`; });
    const mk = S.data.tables.marks;   // student marks follow the new numbers; marks of deleted questions are removed
    if (Array.isArray(mk)) S.data.tables.marks = mk.filter((m) => { if (!(String(m.course_code) === String(sel) && T.s(m.assessment) === exam)) return true; const n = map[T.s(m.question_id)]; if (!n) return false; m.question_id = n; return true; });
    S.save();
  }

  /* ---------------------------------------------------------------- the printable paper (same layout as TAMA) */
  const PAPER_CSS = `@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#111;margin:0;background:#e9edf2;line-height:1.45;font-size:14px}
.paper{max-width:800px;margin:18px auto;background:#fff;padding:28px 34px;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.head{text-align:center;border-bottom:2px solid #14365d;padding-bottom:10px;margin-bottom:12px}
.head h1{margin:0;font-size:20px;color:#14365d}.head img.hdr{display:block;width:100%;margin:0 0 8px}.info .iv{font-weight:400}.instr{font-size:13px;margin:4px 0 10px;padding:6px 10px;border:1px solid #bbb;border-radius:4px}.head h2{margin:2px 0;font-size:15px;font-weight:600}.head .sub{font-size:12.5px;color:#444}
.info{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:13px;margin:10px 0}.info div{border-bottom:1px solid #999;padding:3px 0;min-height:22px}
.sec{margin:18px 0 6px;padding:5px 10px;background:#14365d;color:#fff;border-radius:4px;font-weight:700;font-size:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sec small{font-weight:400;opacity:.9;margin-left:8px}
.q{margin:10px 0;break-inside:avoid;page-break-inside:avoid}.q .t{display:flex;gap:8px}.q .n{font-weight:700;min-width:24px}.q .m{margin-left:auto;white-space:nowrap;color:#555;font-size:12px}
.opts{margin:4px 0 0 32px}.opt{margin:2px 0}.opt b{display:inline-block;width:22px}.opts2{margin:4px 0 0 32px;border-collapse:collapse;width:calc(100% - 32px)}.opts2 td{width:50%;padding:2px 12px 2px 0;vertical-align:top;border:0}
.blank{display:inline-block;min-width:90px;border-bottom:1.5px solid #111;margin:0 3px}
.lines{margin:6px 0 0 32px;border:1px solid #bbb;border-radius:3px;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 25px,#bbb 25px,#bbb 26px)}
.match{display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;margin:4px 0 0 32px}
.tf span{display:inline-block;border:1px solid #333;border-radius:12px;padding:1px 14px;margin-right:10px;font-size:13px}
.key{color:#0b6b3a;font-weight:700}.keybox{margin:6px 0 0 32px;padding:6px 10px;border-left:4px solid #0b6b3a;background:#eaf7ef;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stamp{display:inline-block;border:2px solid #0b6b3a;color:#0b6b3a;padding:1px 10px;border-radius:4px;font-weight:700;margin-left:8px}
@media print{body{background:#fff}.paper{box-shadow:none;margin:0;padding:0;max-width:none}}`;
  // the same shuffle for a question every time (TAMA shuffles the matching answers with the question id as the seed)
  const seeded = (seed) => { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
  function paperHtml(sel, exam, key) {
    const c = S.courseInfo(sel) || {}, ex = tbl("exams").find((x) => String(x.course_code) === String(sel) && T.s(x.assessment) === exam);
    const q = qOf(sel, exam), total = q.reduce((a, x) => a + (num(x.max_marks) || 0), 0), dur = ex && num(ex.duration_min) !== null ? `${g2(num(ex.duration_min))} minutes` : "";
    const hdr = T.paperHeaderOf ? T.paperHeaderOf(sel) : "";
    const parts = [`<div class="head">${hdr ? `<img class="hdr" src="${esc(hdr)}" alt="">` : `<h1>${esc(c.department) || "Exam paper"}</h1>`}<h2>${esc(T.baseCode(c.course_code || sel))} - ${esc(c.course_name)}</h2><div class="sub">${esc(exam)} - ${esc(c.term)} ${esc(c.year)}${key ? '<span class="stamp">ANSWER KEY</span>' : ""}</div></div>`,
      `<div class="info">${(T.paperInfoCells ? T.paperInfoCells(sel, exam, dur, g2(total)) : [["Student name", ""], ["Student ID", ""], ["Time allowed", dur], ["Total marks", g2(total)]]).map(([l, v]) => `<div>${esc(l)}: ${v ? `<b class="iv">${esc(v)}</b>` : ""}</div>`).join("")}</div>`
      + (T.paperInfo && T.paperInfo(sel, exam).instructions.trim() ? `<div class="instr"><b>Instructions:</b> ${esc(T.paperInfo(sel, exam).instructions.trim()).replace(/\n/g, "<br>")}</div>` : "")];
    let n = 0;
    Q_TYPES.forEach((t) => {
      const qs = q.filter((x) => T.s(x.question_type) === t); if (!qs.length) return;
      const mk = qs.reduce((a, x) => a + (num(x.max_marks) || 0), 0);
      parts.push(`<div class="sec">${esc(Q_SECTION[t])}<small>${qs.length} question(s) - ${g2(mk)} mark(s). ${esc(Q_INSTR[t])}</small></div>`);
      qs.forEach((r) => {
        n++; let text = esc(r.question_text) || (t === "Matching" ? "Match the following:" : "<i>(question text not entered)</i>"), body = "";
        if (t === "MCQ") { const cells = jl(r.options).map((o, i) => { const k = key && String.fromCharCode(65 + i) === T.s(r.correct_answer); return [k, `<b>${String.fromCharCode(65 + i)}.</b> ${esc(o)}${k ? " &#10003;" : ""}`]; });
          // two columns (Dania 2026-11-19): a table, so Word keeps the layout too; A B on the first line, C D on the next
          if (T.s(r.options_layout) === "2") { const rows = []; for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
            body = `<table class="opts2">${rows.map((rw) => `<tr>${rw.map(([k, h]) => `<td class="opt${k ? " key" : ""}">${h}</td>`).join("")}${rw.length < 2 ? "<td></td>" : ""}</tr>`).join("")}</table>`; }
          else body = `<div class="opts">${cells.map(([k, h]) => `<div class="opt${k ? " key" : ""}">${h}</div>`).join("")}</div>`; }
        else if (t === "True / False") body = `<div class="opts tf">${["True", "False"].map((v) => { const k = key && T.s(r.correct_answer) === v; return `<span class="${k ? "key" : ""}">${v}${k ? " &#10003;" : ""}</span>`; }).join("")}</div>`;
        else if (t === "Fill in the blank") { const a = T.s(r.correct_answer).split(";").map((x) => x.trim()); let i = 0; text = text.replace(/_{3,}/g, () => (key ? `<span class="blank key">${esc(a[i++] || "")}</span>` : '<span class="blank"></span>')); }
        else if (t === "Matching") {
          const pairs = jl(r.options), idx = pairs.map((_, i) => i), rnd = seeded(T.s(r.question_id));
          for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
          const letter = {}; idx.forEach((orig, pos) => { letter[orig] = String.fromCharCode(65 + pos); });
          body = `<div class="match"><div>${pairs.map((p, i) => `<div>${i + 1}. ${esc(p[0])}${key ? ` <span class="key">&rarr; ${letter[i]}</span>` : " ......"}</div>`).join("")}</div><div>${idx.map((orig, pos) => `<div>${String.fromCharCode(65 + pos)}. ${esc((pairs[orig] || [])[1])}</div>`).join("")}</div></div>`;
        } else {
          const lines = Math.max(1, Math.round(num(r.answer_lines) || (t === "Short Essay" ? 5 : 15)));
          body = `<div class="lines" style="height:${lines * 26}px"></div>`;
          if (key && T.s(r.model_answer).trim()) body += `<div class="keybox"><b>Model answer / marking points:</b><br>${esc(r.model_answer).replace(/\n/g, "<br>")}</div>`;
        }
        if (T.s(r.image).startsWith("data:image")) body = `<img src="${esc(r.image)}" style="max-width:62%;max-height:260px;margin:6px 0 0 32px;display:block">` + body;
        parts.push(`<div class="q"><div class="t"><span class="n">${n}.</span><span>${text}</span><span class="m">[${esc(fmtMarks(r.max_marks))}]</span></div>${body}</div>`);
      });
    });
    const other = q.filter((x) => !Q_TYPES.includes(T.s(x.question_type)));
    if (other.length) { parts.push(`<div class="sec">Questions without written content<small>Open the Exam builder and add the question text</small></div>`);
      other.forEach((r) => { n++; parts.push(`<div class="q"><div class="t"><span class="n">${n}.</span><span>${esc(r.question_id)} - ${esc(r.topic)}</span><span class="m">[${esc(fmtMarks(r.max_marks))}]</span></div></div>`); }); }
    if (!q.length) parts.push("<p>No questions have been added to this exam yet.</p>");
    const rtl = /[؀-ۿ]/.test(parts.join("")) ? ' dir="auto"' : "";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(exam)} - ${key ? "answer key" : "exam paper"}</title><style>${PAPER_CSS}</style></head><body${rtl}><div class="paper">${parts.join("")}</div></body></html>`;
  }
  const dl = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  function printPaper(sel, exam, key, how) {
    const html = paperHtml(sel, exam, key), sf = `${T.baseCode(sel)}_${exam}`.replace(/[^\w؀-ۿ-]+/g, "_"), nm = `${key ? "answer_key" : "exam_paper"}_${sf}`;
    if (how === "html") dl(new Blob([html], { type: "text/html" }), `${nm}.html`);
    else if (how === "doc") T.bpPaperDocx(sel, exam, key).then((b) => dl(b, `${nm}.docx`)).catch((e) => T.toast("The Word file could not be built: " + e.message));
    else { const w = window.open("", "_blank"); if (!w) { T.toast("The browser blocked the new window. Allow pop-ups for this site, or use ⬇ HTML."); return; } w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* closed */ } }, 500); }
  }
  T.bpPaperHtml = paperHtml;
  T.bpPaperParts = { qOf, Q_TYPES, Q_SECTION, Q_INSTR, jl, seeded, fmtMarks };
})();
