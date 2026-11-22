/* Cognitive distribution (TAMA's "Cognitive distribution" page, rebuilt and extended 2026-11-22).
   How the questions of the course's exams spread over Bloom's levels, by number of questions and by marks; lower-order
   (Remember, Understand) against higher-order (Apply and above) with an optional target; by exam, by question type and by SLO/CLO;
   and, where an item analysis exists, how difficult the questions of each level were.
   Reads tables.questions (cognitive_level, max_marks, question_type, slos, clos) and tables.ia_results (difficulty).
   Keeps: ui_settings.cog_target[course] = minimum % of marks for higher-order levels (optional). Exams chosen: S.ui.cogExams. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const ui = () => (S.data.ui_settings = S.data.ui_settings || {});
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : (S.data.tables[n] = []));
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".").replace("٫", ".").trim()); return isNaN(x) ? null : x; };
  const g1 = (n) => (n === null || n === undefined || isNaN(n) ? "-" : String(Math.round(n * 10) / 10));
  const same = (r, sel) => String(r.course_code) === String(sel);
  const LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"], NC = "Not classified";
  const LOWER = new Set(["Remember", "Understand"]);
  const COLOR = { Remember: "#9fb6cf", Understand: "#5f86b0", Apply: "#14365d", Analyze: "#c6a3bd", Evaluate: "#8a5d80", Create: "#5a3651", [NC]: "#c9c1b4" };
  const levelOf = (v) => { const s = T.s(v).trim().toLowerCase(); const f = LEVELS.find((l) => l.toLowerCase() === s || (s.length > 3 && l.toLowerCase().startsWith(s.slice(0, 4)))); return f || NC; };
  const split = (t) => T.s(t).replace(/;/g, ",").split(",").map((x) => x.trim()).filter((x) => x && !["nan", "none"].includes(x.toLowerCase()));
  const qn = (q) => T.s(q).trim().toUpperCase().replace(/^Q/, "");

  function examsWithQ(sel) { const out = []; tbl("questions").forEach((q) => { const a = T.s(q.assessment).trim(); if (same(q, sel) && a && !out.includes(a)) out.push(a); }); return out; }
  function chosen(sel) { const all = examsWithQ(sel), c = ((S.ui.cogExams || {})[sel]) || null; const ok = Array.isArray(c) ? c.filter((x) => all.includes(x)) : all; return ok.length ? ok : all; }
  function rows(sel) {
    const ex = new Set(chosen(sel));
    const p = {}; tbl("ia_results").filter((r) => same(r, sel)).forEach((r) => { const d = num(r.difficulty); if (d !== null) p[`${T.s(r.assessment).trim()}||${qn(r.question)}`] = d; });
    return tbl("questions").filter((q) => same(q, sel) && ex.has(T.s(q.assessment).trim())).map((q) => ({
      exam: T.s(q.assessment).trim(), id: T.s(q.question_id), level: levelOf(q.cognitive_level), marks: Math.max(0, num(q.max_marks) || 0),
      type: T.s(q.question_type).trim() || "MCQ", slos: split(q.slos), clos: split(q.clos), p: p[`${T.s(q.assessment).trim()}||${qn(q.question_id)}`] }));
  }
  const levelsIn = (rs) => [...LEVELS, NC].filter((l) => l !== NC || rs.some((r) => r.level === NC));
  function dist(rs) {
    const nQ = rs.length, nM = rs.reduce((a, r) => a + r.marks, 0);
    return levelsIn(rs).map((l) => { const x = rs.filter((r) => r.level === l), m = x.reduce((a, r) => a + r.marks, 0), pp = x.filter((r) => r.p !== undefined).map((r) => r.p);
      return { level: l, q: x.length, qp: nQ ? (x.length / nQ) * 100 : 0, m, mp: nM ? (m / nM) * 100 : 0, p: pp.length ? pp.reduce((a, b) => a + b, 0) / pp.length : null, np: pp.length }; });
  }
  const share = (rs, by, keep) => { const w = (r) => (by === "m" ? r.marks : 1), tot = rs.reduce((a, r) => a + w(r), 0); return tot ? (rs.filter(keep).reduce((a, r) => a + w(r), 0) / tot) * 100 : null; };
  const higher = (rs, by) => share(rs, by, (r) => r.level !== NC && !LOWER.has(r.level));
  const lower = (rs, by) => share(rs, by, (r) => LOWER.has(r.level));

  T.sections.cogPick = function () {
    const sel = T.current(), el = $("#sec-cgpick"); if (!el) return;
    const all = examsWithQ(sel), on = chosen(sel), tg = num((ui().cog_target || {})[sel]);
    el.innerHTML = `<div class="sec-head" id="h-cgpick"><div><h2>Which exams?</h2><p class="sub">The cognitive level of each question comes from the <a href="#exam-blueprint">Exam builder</a> (Cognitive level box).</p></div></div>
      ${all.length ? `<div class="cl-chips">${all.map((a) => `<label class="chip-tick"><input type="checkbox" data-cgx="${esc(a)}" ${on.includes(a) ? "checked" : ""}> ${esc(a)} <small>(${tbl("questions").filter((q) => same(q, sel) && T.s(q.assessment).trim() === a).length} questions)</small></label>`).join("")}</div>
        <div class="grid g3"><label class="fld ${tg !== null ? "filled" : ""}" for="cg-tg"><span class="lbl">Target for higher-order questions (% of marks, optional) <i class="hint" title="Higher-order = Apply, Analyze, Evaluate and Create. Many programs ask for a minimum share, for example 30% or 40%. Leave empty for no target.">?</i></span><input type="text" inputmode="decimal" id="cg-tg" value="${tg === null ? "" : esc(String(tg))}" placeholder="e.g. 40"></label></div>`
        : `<div class="info-box"><span>No exam questions yet. Add or import the questions of each exam in the <a href="#exam-blueprint">Blueprint and Exam builder</a>, with their cognitive level, and the distribution appears here.</span></div>`}`;
    $$("[data-cgx]", el).forEach((b) => b.onchange = () => { const s = new Set(chosen(sel)); if (b.checked) s.add(b.dataset.cgx); else s.delete(b.dataset.cgx); if (!s.size) { b.checked = true; T.toast("Keep at least one exam ticked.", "warn"); return; } S.ui.cogExams = Object.assign({}, S.ui.cogExams, { [sel]: [...s] }); S.saveUi(); draw(); });
    const t = $("#cg-tg", el); if (t) t.onchange = () => { const v = num(t.value), o = (ui().cog_target = ui().cog_target || {}); if (v === null) delete o[sel]; else o[sel] = Math.max(0, Math.min(100, v)); S.save(); draw(); };
  };

  T.sections.cogDist = function () {
    const sel = T.current(), el = $("#sec-cgdist"); if (!el) return;
    const rs = rows(sel); el.hidden = !rs.length; if (!rs.length) { el.innerHTML = ""; return; }
    const d = dist(rs), hiM = higher(rs, "m"), hiQ = higher(rs, "q"), tg = num((ui().cog_target || {})[sel]), nc = rs.filter((r) => r.level === NC).length;
    const totM = rs.reduce((a, r) => a + r.marks, 0);
    const cards = [["Questions", rs.length], ["Marks", g1(totM)], ["Lower-order (Remember, Understand)", `${g1(lower(rs, "m"))}% <small>of marks</small>`], ["Higher-order (Apply and above)", `${g1(hiM)}% <small>of marks</small>`]];
    const chart = T.charts.groupBars({ title: "Questions and marks at each cognitive level", sub: "(% of the exams chosen)", cats: d.map((x) => x.level), series: [{ name: "% of questions", color: "#14365d", values: d.map((x) => x.qp) }, { name: "% of marks", color: "#8a5d80", values: d.map((x) => x.mp) }], yTitle: "%", fmt: (v) => g1(v), file: `cognitive_${T.baseCode(sel)}` });
    el.innerHTML = `<div class="sec-head" id="h-cgdist"><div><h2>Cognitive distribution</h2><p class="sub">${esc(chosen(sel).join(", "))}. Each question counts once; its marks are its maximum marks.</p></div>
        <button class="btn" id="cg-xlsx">⬇ Excel</button></div>
      <div class="kcards ms-k">${cards.map(([l, v]) => `<div class="kcard"><div class="lab">${esc(l)}</div><div class="big">${v}</div></div>`).join("")}</div>
      ${tg !== null ? (hiM >= tg - 1e-9 ? `<p class="ok-text">✓ Higher-order questions carry ${g1(hiM)}% of the marks: the target of ${g1(tg)}% is reached.</p>`
        : `<div class="alert-box"><span class="alert-ic">⚠</span><span><b>Below the target:</b> higher-order questions carry ${g1(hiM)}% of the marks, the target is ${g1(tg)}%. Replace some Remember / Understand questions with Apply or Analyze questions.</span></div>`) : ""}
      ${nc ? `<p class="warn-text">${nc} question(s) (${g1(share(rs, "m", (r) => r.level === NC))}% of the marks) have no cognitive level, so they are neither lower- nor higher-order. Choose their level here:</p>
        <details class="sum-box" ${S.ui.cgFixOpen ? "open" : ""} id="cg-fix"><summary>Choose the level of the ${nc} question(s) without one</summary>
          <div class="bp-wrap" style="max-height:420px;overflow:auto"><table class="tbl xs-tbl"><thead><tr><th>Exam</th><th>Question</th><th>Type</th><th>Question text</th><th style="width:150px">Cognitive level</th></tr></thead><tbody>
          ${tbl("questions").map((q, i) => [q, i]).filter(([q]) => same(q, sel) && chosen(sel).includes(T.s(q.assessment).trim()) && levelOf(q.cognitive_level) === NC).map(([q, i]) => `<tr><td>${esc(q.assessment)}</td><td><b>${esc(q.question_id)}</b></td><td>${esc(q.question_type)}</td><td class="wrap">${esc(T.s(q.question_text).slice(0, 160))}</td>
            <td><select class="cell" data-cglv="${i}"><option value="">Choose</option>${LEVELS.map((l) => `<option>${l}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div></details>` : ""}
      <div class="ms-charts">${chart}
        <div class="bp-wrap"><table class="tbl xs-tbl ms-st"><thead><tr><th>Cognitive level</th><th class="ctr">Questions</th><th class="ctr">% of questions</th><th class="ctr">Marks</th><th class="ctr">% of marks</th></tr></thead><tbody>
          ${d.map((x) => `<tr><td><i class="cg-dot" style="background:${COLOR[x.level]}"></i>${esc(x.level)}</td><td class="ctr">${x.q}</td><td class="ctr">${g1(x.qp)}</td><td class="ctr">${g1(x.m)}</td><td class="ctr">${g1(x.mp)}</td></tr>`).join("")}
          <tr class="tot"><td><b>Lower-order</b></td><td class="ctr" colspan="2">${g1(lower(rs, "q"))}%</td><td class="ctr" colspan="2">${g1(lower(rs, "m"))}%</td></tr>
          <tr class="tot"><td><b>Higher-order</b></td><td class="ctr" colspan="2">${g1(hiQ)}%</td><td class="ctr" colspan="2">${g1(hiM)}%</td></tr>
          <tr class="tot"><td><b>Total</b></td><td class="ctr">${rs.length}</td><td class="ctr">100</td><td class="ctr">${g1(totM)}</td><td class="ctr">100</td></tr></tbody></table></div></div>`;
    $("#cg-xlsx", el).onclick = () => excel(sel);
    const fx = $("#cg-fix", el); if (fx) fx.ontoggle = () => { S.ui.cgFixOpen = fx.open; S.saveUi(); };
    $$("[data-cglv]", el).forEach((f) => f.onchange = () => { const q = tbl("questions")[+f.dataset.cglv]; if (!q || !f.value) return; q.cognitive_level = f.value; S.save(); T.toast(`${q.assessment} ${q.question_id}: ${f.value}`); draw(); });
  };

  T.sections.cogBy = function () {
    const sel = T.current(), el = $("#sec-cgby"); if (!el) return;
    const rs = rows(sel); el.hidden = !rs.length; if (!rs.length) { el.innerHTML = ""; return; }
    const L = levelsIn(rs), exams = chosen(sel), types = [...new Set(rs.map((r) => r.type))];
    const pctRow = (sub) => { const m = sub.reduce((a, r) => a + r.marks, 0); return L.map((l) => (m ? (sub.filter((r) => r.level === l).reduce((a, r) => a + r.marks, 0) / m) * 100 : 0)); };
    const matrix = (title, keys, pick, keyLabel) => `<h3 class="qm-h">${esc(title)}</h3><div class="bp-wrap" style="overflow-x:auto"><table class="tbl xs-tbl ms-st cg-mx"><thead><tr><th>${esc(keyLabel)}</th>${L.map((l) => `<th class="ctr">${esc(l)}</th>`).join("")}<th class="ctr">Higher-order</th><th class="ctr">Questions</th></tr></thead><tbody>
      ${keys.map((k) => { const sub = rs.filter((r) => pick(r, k)), pr = pctRow(sub); return `<tr><td><b>${esc(k)}</b></td>${pr.map((v, i) => `<td class="ctr" style="${v ? `background:${COLOR[L[i]]}${Math.round(25 + v * 0.6).toString(16).padStart(2, "0")}` : ""}">${v ? g1(v) + "%" : ""}</td>`).join("")}<td class="ctr"><b>${g1(higher(sub, "m"))}%</b></td><td class="ctr">${sub.length}</td></tr>`; }).join("")}</tbody></table></div>`;
    const chart = exams.length > 1 ? T.charts.groupBars({ title: "Cognitive levels in each exam", sub: "(% of the exam's marks)", cats: exams, series: L.map((l) => ({ name: l, color: COLOR[l], values: exams.map((e) => pctRow(rs.filter((r) => r.exam === e))[L.indexOf(l)]) })), yTitle: "% of marks", fmt: (v) => g1(v), noLabels: true, max: 100, file: `cognitive_by_exam_${T.baseCode(sel)}` }) : "";
    const outs = [...new Set(rs.flatMap((r) => r.slos.length ? r.slos : r.clos))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    el.innerHTML = `<div class="sec-head" id="h-cgby"><div><h2>By exam, question type and learning outcome</h2><p class="sub">The share of each exam's (or type's, or outcome's) marks at each level. Darker = a bigger share.</p></div></div>
      ${chart ? `<div class="ms-charts">${chart}</div>` : ""}
      ${matrix("By exam", exams, (r, k) => r.exam === k, "Exam")}
      ${matrix("By question type", types, (r, k) => r.type === k, "Question type")}
      ${outs.length ? matrix("By SLO / CLO", outs, (r, k) => (r.slos.length ? r.slos : r.clos).includes(k), "Outcome") + `<p class="note">An outcome with only Remember / Understand questions is measured at a low level only; check that this matches its verb (e.g. "apply", "appraise").</p>` : ""}`;
  };

  T.sections.cogDiff = function () {
    const sel = T.current(), el = $("#sec-cgdiff"); if (!el) return;
    const rs = rows(sel), d = dist(rs).filter((x) => x.np);
    el.hidden = !d.length; if (!d.length) { el.innerHTML = ""; return; }
    const chart = T.charts.groupBars({ title: "How difficult were the questions of each level?", sub: "(mean difficulty p: % of students who answered correctly)", cats: d.map((x) => x.level), series: [{ name: "Mean p", color: "#14365d", colors: d.map((x) => COLOR[x.level]), values: d.map((x) => x.p * 100) }], yTitle: "% correct", max: 100, fmt: (v) => g1(v), file: `difficulty_by_level_${T.baseCode(sel)}` });
    el.innerHTML = `<div class="sec-head" id="h-cgdiff"><div><h2>Difficulty by cognitive level</h2><p class="sub">From the item analysis on <a href="#exam-results">Exam results and item analysis</a>, matched to the questions by their number. Usually higher-order questions are answered correctly by fewer students.</p></div></div>
      <div class="ms-charts">${chart}<div class="bp-wrap"><table class="tbl xs-tbl ms-st"><thead><tr><th>Cognitive level</th><th class="ctr">Questions with an item analysis</th><th class="ctr">Mean difficulty (p)</th></tr></thead><tbody>
        ${d.map((x) => `<tr><td><i class="cg-dot" style="background:${COLOR[x.level]}"></i>${esc(x.level)}</td><td class="ctr">${x.np}</td><td class="ctr">${g1(x.p * 100)}%</td></tr>`).join("")}</tbody></table></div></div>`;
  };

  async function excel(sel) {
    await T.importer.lib("xlsx");
    const rs = rows(sel), wb = XLSX.utils.book_new(), add = (n, data) => XLSX.utils.book_append_sheet(wb, data.length ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([[]]), n);
    add("Distribution", dist(rs).map((x) => ({ "Cognitive level": x.level, Questions: x.q, "% of questions": +g1(x.qp), Marks: x.m, "% of marks": +g1(x.mp), "Mean difficulty (p %)": x.p === null ? "" : +g1(x.p * 100) })));
    add("Questions", rs.map((r) => ({ Exam: r.exam, Question: r.id, "Cognitive level": r.level, Marks: r.marks, Type: r.type, SLO: r.slos.join(", "), CLO: r.clos.join(", "), "Difficulty (p)": r.p === undefined ? "" : r.p })));
    XLSX.writeFile(wb, `cognitive_distribution_${T.baseCode(sel)}.xlsx`.replace(/[^\w.-]+/g, "_"));
  }

  const draw = () => T.refresh("cogPick", "cogDist", "cogBy", "cogDiff");
  T.renderCogPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">🧠</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "Add a course in Course setup first."}</p><div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = ["cgpick", "cgdist", "cgby", "cgdiff"].map((k) => `<section class="card" id="sec-${k}"></section>`).join("");
    draw();
  };
  T.cogParts = { rows, dist, higher, levelOf };
})();
