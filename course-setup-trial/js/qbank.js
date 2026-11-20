/* Exam builder > Question bank (Dania 2026-11-20): every question of this course in every year / term, with search and filters
   (year, term, exam it was used in, SLO, CLO, type, cognitive level, item analysis) and the item analysis of each question.
   The item analysis comes from TAMA's table ia_results (course_code, assessment, question, difficulty, discrimination,
   difficulty_level, suggestion, distractor_over_key); its "question" (1, 2 ... or Q1, Q2 ...) is matched to the question ID.
   A later item-analysis page may add "distractors" (the share of students who chose each option); it is shown when present. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$;
  const tbl = (n) => (Array.isArray(S.data.tables[n]) ? S.data.tables[n] : []);
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? null : x; };
  const g2 = (n) => (n === null || n === undefined || isNaN(n) ? "" : String(Math.round(n * 100) / 100));
  const split = (v) => T.s(v).split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const natKey = (s) => T.s(s).split(/(\d+)/).map((p, i) => (i % 2 ? p.padStart(8, "0") : p.toLowerCase())).join("");
  const qNo = (v) => { const m = /(\d+)\s*$/.exec(T.s(v).trim()); return m ? String(+m[1]) : T.s(v).trim().toUpperCase(); };
  const jl = (v) => { try { const x = typeof v === "string" && v.trim() ? JSON.parse(v) : Array.isArray(v) ? v : []; return Array.isArray(x) ? x : []; } catch (e) { return []; } };

  /** Every question of this course (all its years and terms), with its year, term and item analysis. */
  function bank(sel) {
    const base = T.baseCode(sel), offers = {};
    S.t("courses").forEach((c) => { if (T.baseCode(c.course_code) === base) offers[String(c.course_code)] = c; });
    offers[String(sel)] = offers[String(sel)] || S.courseInfo(sel) || {};
    const ia = {}; tbl("ia_results").forEach((r) => { if (offers[String(r.course_code)]) ia[`${r.course_code}||${T.s(r.assessment)}||${qNo(r.question)}`] = r; });
    return tbl("questions").filter((q) => offers[String(q.course_code)]).map((q) => { const c = offers[String(q.course_code)];
      return { q, year: T.s(c.year).trim(), term: T.s(c.term).trim(), here: String(q.course_code) === String(sel), ia: ia[`${q.course_code}||${T.s(q.assessment)}||${qNo(q.question_id)}`] || null }; });
  }
  const F = () => (S.ui.qbf = S.ui.qbf || {});
  const IA_OPTS = [["", "All"], ["yes", "Analysed"], ["no", "Not analysed yet"], ["easy", "Easy (difficulty 0.8 or more)"], ["hard", "Hard (difficulty under 0.3)"], ["poor", "Poor discrimination (under 0.2)"], ["dist", "A distractor chosen more than the key"]];
  function match(r, f) {
    const q = r.q;
    if (f.year && r.year !== f.year) return false;
    if (f.term && r.term !== f.term) return false;
    if (f.exam && T.s(q.assessment) !== f.exam) return false;
    if (f.slo && !split(q.slos).includes(f.slo)) return false;
    if (f.clo && !split(q.clos).includes(f.clo)) return false;
    if (f.type && T.s(q.question_type) !== f.type) return false;
    if (f.level && T.s(q.cognitive_level) !== f.level) return false;
    const d = r.ia ? num(r.ia.difficulty) : null, di = r.ia ? num(r.ia.discrimination) : null;
    if (f.ia === "yes" && !r.ia) return false; if (f.ia === "no" && r.ia) return false;
    if (f.ia === "easy" && !(d !== null && d >= 0.8)) return false; if (f.ia === "hard" && !(d !== null && d < 0.3)) return false;
    if (f.ia === "poor" && !(di !== null && di < 0.2)) return false; if (f.ia === "dist" && !(r.ia && T.s(r.ia.distractor_over_key) === "Yes")) return false;
    if (f.text) { const t = f.text.toLowerCase(), hay = [q.question_text, q.options, q.topic, q.model_answer, q.question_id, q.assessment].map(T.s).join(" ").toLowerCase(); if (!hay.includes(t)) return false; }
    return true;
  }
  const uniq = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => natKey(a).localeCompare(natKey(b)));
  const sel1 = (id, label, opts, cur) => `<label class="fld ${cur ? "filled" : ""}"><span class="lbl">${label}</span><select data-qbf="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === (cur || "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  const all = (l) => [["", "All"], ...l.map((x) => [x, x])];

  function iaCell(r) {
    if (!r.ia) return `<td class="muted" colspan="3">not analysed yet</td>`;
    const d = num(r.ia.difficulty), di = num(r.ia.discrimination);
    const dc = d === null ? "" : d >= 0.8 ? "qb-easy" : d < 0.3 ? "qb-hard" : "qb-ok", dic = di === null ? "" : di < 0.2 ? "qb-hard" : di >= 0.3 ? "qb-ok" : "";
    return `<td class="num"><span class="qb-pill ${dc}">${g2(d)}</span>${r.ia.difficulty_level ? `<br><small class="muted">${esc(r.ia.difficulty_level)}</small>` : ""}</td><td class="num"><span class="qb-pill ${dic}">${g2(di)}</span></td>
      <td>${T.s(r.ia.distractor_over_key) === "Yes" ? `<span class="warn-text" title="A distractor was chosen by more students than the correct answer" style="white-space:nowrap">Check</span>` : "OK"}</td>`;
  }
  function detail(r) {
    const q = r.q, t = T.s(q.question_type);
    let body = "";
    if (t === "MCQ") body = `<ol type="A" class="qb-opts">${jl(q.options).map((o, i) => `<li class="${String.fromCharCode(65 + i) === T.s(q.correct_answer) ? "key" : ""}">${esc(o)}${String.fromCharCode(65 + i) === T.s(q.correct_answer) ? " ✓" : ""}</li>`).join("")}</ol>`;
    else if (t === "Matching") body = `<ul class="qb-opts">${jl(q.options).map((p) => `<li>${esc((p || [])[0])} → ${esc((p || [])[1])}</li>`).join("")}</ul>`;
    else if (T.s(q.correct_answer)) body = `<p>Answer: <b>${esc(q.correct_answer)}</b></p>`;
    if (T.s(q.model_answer).trim()) body += `<p><b>Model answer:</b><br>${esc(q.model_answer).replace(/\n/g, "<br>")}</p>`;
    if (T.s(q.image).startsWith("data:image")) body += `<img src="${esc(q.image)}" class="qb-pic" alt="">`;
    let ia = `<p class="muted">No item analysis yet. It is linked here automatically once the item analysis of ${esc(q.assessment)} is entered.</p>`;
    if (r.ia) {
      const dist = (() => { try { const x = typeof r.ia.distractors === "string" ? JSON.parse(r.ia.distractors) : r.ia.distractors; return x && typeof x === "object" ? x : null; } catch (e) { return null; } })();
      ia = `<table class="tbl sum-tbl qb-ia"><tbody><tr><th>Difficulty factor</th><td>${g2(num(r.ia.difficulty))} ${esc(r.ia.difficulty_level || "")}</td></tr><tr><th>Discrimination index</th><td>${g2(num(r.ia.discrimination))}</td></tr>
        <tr><th>Distractors</th><td>${T.s(r.ia.distractor_over_key) === "Yes" ? "A distractor was chosen by more students than the correct answer" : "No distractor was chosen more than the correct answer"}</td></tr>
        ${dist ? `<tr><th>Students choosing each option</th><td>${Object.entries(dist).map(([k, v]) => `${esc(k)}: ${esc(g2(num(v) !== null && num(v) <= 1 ? num(v) * 100 : num(v)))}%`).join(" · ")}</td></tr>` : ""}
        ${T.s(r.ia.suggestion) ? `<tr><th>Suggestion</th><td>${esc(r.ia.suggestion)}</td></tr>` : ""}</tbody></table>`;
    }
    return `<div class="qb-det"><div><p class="qb-full">${esc(q.question_text) || "<i>(no question text)</i>"}</p>${body}</div><div><h5>Item analysis</h5>${ia}</div></div>`;
  }
  function results(sel, exam) {
    const f = F(), rows = bank(sel).filter((r) => match(r, f)).sort((a, b) => (b.year || "").localeCompare(a.year || "") || natKey(a.term).localeCompare(natKey(b.term)) || natKey(a.q.assessment).localeCompare(natKey(b.q.assessment)) || natKey(a.q.question_id).localeCompare(natKey(b.q.question_id)));
    const open = new Set(S.ui.qbOpen || []), id = (r) => `${r.q.course_code}||${r.q.assessment}||${r.q.question_id}`;
    if (!rows.length) return `<p class="note">No question matches these filters.</p>`;
    return `<p class="note"><b>${rows.length}</b> question(s). Click ▸ to see the whole question and its item analysis.</p>
      <div class="bp-wrap"><table class="tbl sum-tbl qm-list qb-list"><thead><tr><th></th><th>Year / term</th><th>Used in</th><th>ID</th><th>Type</th><th>Question</th><th class="num">Marks</th><th>Cognitive level</th><th>SLO</th><th>CLO</th><th class="num">Difficulty</th><th class="num">Discrimination</th><th>Distractors</th></tr></thead>
      <tbody>${rows.map((r) => { const k = id(r), on = open.has(k), q = r.q; return `<tr class="${r.here && T.s(q.assessment) === exam ? "" : "other"}"><td><button class="qb-tg" data-qbo="${esc(k)}" aria-expanded="${on}">${on ? "▾" : "▸"}</button></td><td>${esc(r.year)}${r.term ? `<br><small class="muted">${esc(T.termLabel(r.term))}</small>` : ""}</td><td>${esc(q.assessment)}</td><td class="b">${esc(q.question_id)}</td><td>${esc(q.question_type)}</td><td class="wrap">${esc(T.s(q.question_text).slice(0, 140))}${T.s(q.question_text).length > 140 ? "…" : ""}</td><td class="num">${esc(g2(num(q.max_marks)))}</td><td>${esc(q.cognitive_level)}</td><td>${esc(q.slos)}</td><td>${esc(q.clos)}</td>${iaCell(r)}</tr>
        ${on ? `<tr class="qb-open"><td></td><td colspan="12">${detail(r)}</td></tr>` : ""}`; }).join("")}</tbody></table></div>
      <div class="row-btns"><button class="btn sm" id="qb-xlsx">⬇ These ${rows.length} question(s) (Excel)</button></div>`;
  }
  T.qBankFiltersHtml = function (sel, exam) {
    const b = bank(sel), f = F();
    return `<div class="qb-filters"><label class="fld qb-search ${f.text ? "filled" : ""}"><span class="lbl">Search the questions</span><input type="search" id="qb-text" data-ref="qb-text" value="${esc(f.text || "")}" placeholder="Words in the question, options, topic or answer"></label>
      <div class="grid g4">${sel1("year", "Year", all(uniq(b.map((r) => r.year)).reverse()), f.year)}${sel1("term", "Term", [["", "All"], ...uniq(b.map((r) => r.term)).map((t) => [t, T.termLabel(t)])], f.term)}
        ${sel1("exam", "Used in (exam)", all(uniq(b.map((r) => T.s(r.q.assessment)))), f.exam)}${sel1("type", "Question type", all(uniq(b.map((r) => T.s(r.q.question_type)))), f.type)}
        ${sel1("slo", "Linked SLO", all(uniq(b.flatMap((r) => split(r.q.slos)))), f.slo)}${sel1("clo", "Linked CLO", all(uniq(b.flatMap((r) => split(r.q.clos)))), f.clo)}
        ${sel1("level", "Cognitive level", all(uniq(b.map((r) => T.s(r.q.cognitive_level)))), f.level)}${sel1("ia", "Item analysis", IA_OPTS, f.ia)}</div>
      <div class="row-btns"><button class="btn sm" id="qb-clear">Clear the filters</button><span class="muted">The bank holds the questions of ${esc(T.baseCode(sel))} from every year and term (${b.length} in all).</span></div></div>
      <div id="qb-res">${results(sel, exam)}</div>`;
  };
  T.qBankWire = function (sel, exam, el) {
    const box = el.querySelector(".qb-filters"); if (!box) return;
    const res = () => { const r = $("#qb-res", el); r.innerHTML = results(sel, exam); wireRes(); };
    const wireRes = () => {
      el.querySelectorAll("[data-qbo]").forEach((b) => b.onclick = () => { const s = new Set(S.ui.qbOpen || []), k = b.dataset.qbo; if (s.has(k)) s.delete(k); else s.add(k); S.ui.qbOpen = [...s].slice(-30); S.saveUi(); res(); });
      const x = $("#qb-xlsx", el); if (x) x.onclick = async () => {
        try { await T.importer.lib("xlsx"); const f = F(), rows = bank(sel).filter((r) => match(r, f));
          const out = rows.map((r) => ({ Year: r.year, Term: r.term, "Used in": r.q.assessment, ID: r.q.question_id, Type: r.q.question_type, Question: T.s(r.q.question_text), Options: jl(r.q.options).map((o) => (Array.isArray(o) ? o.join(" = ") : o)).join(" | "),
            "Correct answer": T.s(r.q.correct_answer), Marks: num(r.q.max_marks), Topic: T.s(r.q.topic), "Cognitive level": T.s(r.q.cognitive_level), SLO: T.s(r.q.slos), CLO: T.s(r.q.clos),
            Difficulty: r.ia ? num(r.ia.difficulty) : "", "Difficulty level": r.ia ? T.s(r.ia.difficulty_level) : "", Discrimination: r.ia ? num(r.ia.discrimination) : "", "Distractor > key": r.ia ? T.s(r.ia.distractor_over_key) : "" }));
          const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), "Question bank"); XLSX.writeFile(wb, `question_bank_${T.baseCode(sel).replace(/[^\w-]+/g, "_")}.xlsx`);
        } catch (e) { T.toast("The Excel file could not be built: " + e.message); } };
    };
    el.querySelectorAll("[data-qbf]").forEach((s) => s.onchange = () => { F()[s.dataset.qbf] = s.value; s.closest(".fld").classList.toggle("filled", !!s.value); S.saveUi(); res(); });
    const t = $("#qb-text", el); let tm; t.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { F().text = t.value.trim(); t.closest(".fld").classList.toggle("filled", !!t.value); S.saveUi(); res(); }, 200); };
    $("#qb-clear", el).onclick = () => { S.ui.qbf = {}; S.saveUi(); T.refresh("bpTab"); };
    wireRes();
  };
})();
