/* Lectures & SLOs page: the SLO table (edited in place, saves itself), the Add SLOs box (type one or import a file),
   and "Topics not covered" for the Course Report. Ported from TAMA's Lectures & SLOs page. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const NO_CLO = "(None)";
  const DOMAIN_HELP = "K = Knowledge, S:Cog. = Cognitive skills, S:IT-N = IT & numerical skills, S:Psych = Psychomotor skills, V = Values";

  const slosOf = (sel) => S.t("slos").filter((r) => String(r.course_code) === String(sel));
  const cloLabel = (c) => `${c.clo_id} - ${T.s(c.clo_text).slice(0, 70)}`;

  /** Store the SLO rows of course `sel` in the given order, numbered SLO1, SLO2 ..., keeping everything linked to them in step. */
  function storeSlos(sel, rows) {
    rows = rows.map((r) => ({ ...r }));
    const idmap = {};
    rows.forEach((r, i) => { if (T.s(r.slo_id)) idmap[r.slo_id] = `SLO${i + 1}`; r.slo_id = `SLO${i + 1}`; r.course_code = sel; r.target_kpi = T.num(r.target_kpi, 70); if (r.assessment_methods === undefined) r.assessment_methods = ""; });
    S.setT("slos", [...S.t("slos").filter((r) => String(r.course_code) !== String(sel)), ...rows]);
    const tb = S.data.tables;
    (tb.questions || []).forEach((q) => {
      if (String(q.course_code) !== String(sel)) return;
      q.slos = T.s(q.slos).split(",").map((x) => x.trim()).filter((t) => t && t in idmap).map((t) => idmap[t]).join(", ");
    });
    if (tb.plans) tb.plans = tb.plans.filter((p) => {
      if (String(p.course_code) !== String(sel) || p.basis !== "SLOs") return true;
      if (!(p.outcome_id in idmap)) return false; p.outcome_id = idmap[p.outcome_id]; return true;
    });
    const bp = S.data.bp_raw || {};
    Object.keys(bp).forEach((k) => {
      const parts = k.split("||");
      if (parts.length === 3 && parts[0] === String(sel) && parts[2] === "SLOs") {
        const v = bp[k], nv = {}; Object.keys(v || {}).forEach((o) => { if (o in idmap) nv[idmap[o]] = v[o]; }); bp[k] = nv;
      }
    });
    const f = (v) => { v = T.s(v); return v.toUpperCase().startsWith("SLO") ? (idmap[v] || "") : v; };
    [["ia_map", "outcome_id"], ["ia_results", "outcome_id"], ["slo_other", "slo_id"]].forEach(([k, col]) => {
      (tb[k] || []).forEach((r) => { if (String(r.course_code) === String(sel) && col in r) r[col] = f(r[col]); });
    });
    S.save();
  }

  T.renderSloPage = function (sel) {
    const content = $("#content");
    if (!sel) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📗</div><h3>${S.t("courses").length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${S.t("courses").length ? "Pick it in the Course box above." : "The SLO page fills in as soon as you have saved at least one course in Course setup."}</p>
        <div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    if (!T.closOf(sel).length) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">📗</div><h3>${esc(T.baseCode(sel))} has no CLOs yet</h3>
        <p>Add them in Course setup, then come back to link the SLOs to them.</p><div class="row-btns"><a class="btn primary" href="#course-setup">Go to Course setup</a></div></div>`;
      return;
    }
    content.innerHTML = `<section class="card" id="sec-slotbl"></section><section class="card" id="sec-sloadd"></section><section class="card" id="sec-topics"></section>`;
    T.refresh("slotbl", "sloadd", "topics");
  };

  /* ---------------------------------------------------------------- SLO table */
  T.sections.slotbl = function () {
    const sel = T.current(), el = $("#sec-slotbl"); if (!el) return;
    const rows = slosOf(sel), clos = T.closOf(sel), cloIds = clos.map((c) => String(c.clo_id));
    const unlinked = rows.map((r, i) => (cloIds.includes(T.s(r.clo_id)) ? 0 : i + 1)).filter(Boolean);
    const noTopic = rows.map((r, i) => (T.s(r.topic).trim() ? 0 : i + 1)).filter(Boolean);
    const noTxt = rows.map((r, i) => (T.s(r.slo_text).trim() ? 0 : i + 1)).filter(Boolean);
    const noDom = rows.map((r, i) => (T.s(r.domain).trim() ? 0 : i + 1)).filter(Boolean);
    const topics = [...new Set(rows.map((r) => T.s(r.topic).trim()).filter(Boolean))];
    const tid = "dl-topics-" + T.uid();
    el.innerHTML = `<div class="sec-head" id="h-slotbl"><div><h2>Student learning outcomes (SLOs) by lecture / module</h2>
        <p class="sub">Each SLO belongs to a lecture or module and is linked to one of the CLOs entered in Course setup. Edit any cell; it saves itself.</p></div>
        <span class="count">${rows.length} SLO${rows.length === 1 ? "" : "s"}</span></div>
      ${rows.length ? `
      <p class="note">To move an SLO, type the place you want in <b>Order</b> (e.g. 3 puts it third). The SLOs are kept in order and numbered SLO1, SLO2, SLO3 ..., and blueprints, questions and item analysis follow the new numbers. New SLOs are added in the Add SLOs box below.</p>
      ${unlinked.length ? `<p class="warn-text">These SLOs are not linked to a CLO (shown as ${NO_CLO}): row(s) ${T.fmtRows(unlinked)}. Choose a Linked CLO for them if they should count towards a CLO.</p>` : ""}
      ${noTopic.length || noTxt.length || noDom.length ? `<p class="warn-text">${noTopic.length ? `Add the lecture / module in row(s) ${T.fmtRows(noTopic)}. ` : ""}${noTxt.length ? `Add the SLO statement in row(s) ${T.fmtRows(noTxt)}. ` : ""}${noDom.length ? `Choose the learning domain in row(s) ${T.fmtRows(noDom)}. ` : ""}Nothing is lost while rows are unfinished.</p>` : ""}
      <datalist id="${tid}">${topics.map((t) => `<option value="${esc(t)}"></option>`).join("")}</datalist>
      <table class="tbl slo-tbl"><colgroup><col style="width:58px"><col style="width:17%"><col style="width:64px"><col><col style="width:104px"><col style="width:104px"><col style="width:78px"><col style="width:56px"></colgroup>
      <thead><tr><th>Order</th><th>Lecture / module</th><th>SLO ID</th><th>SLO statement</th><th title="${DOMAIN_HELP}">Learning domain</th><th>Linked CLO</th><th>Target KPI (%)</th><th>Delete</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const linked = cloIds.includes(T.s(r.clo_id));
        return `<tr data-i="${i}">
        <td data-l="Order"><input class="cell num-in filled" type="number" min="1" step="1" value="${i + 1}" data-ref="slo:${i}:order" data-c="order" title="Type a number to put this SLO in that place."></td>
        <td data-l="Lecture / module"><textarea rows="1" class="cell ${T.s(r.topic).trim() ? "filled" : ""}" list="${tid}" data-ref="slo:${i}:topic" data-c="topic" spellcheck="true">${esc(r.topic)}</textarea></td>
        <td data-l="SLO ID"><span class="locked-id" title="Numbered automatically">${esc(r.slo_id)}</span></td>
        <td data-l="SLO statement"><textarea rows="1" class="cell ${T.s(r.slo_text).trim() ? "filled" : ""}" data-ref="slo:${i}:slo_text" data-c="slo_text" spellcheck="true">${esc(r.slo_text)}</textarea></td>
        <td data-l="Learning domain"><select class="cell ${T.s(r.domain) ? "filled" : ""}" data-ref="slo:${i}:domain" data-c="domain" title="${DOMAIN_HELP}"><option value=""></option>${T.SLO_DOMAINS.map((d) => `<option ${d === r.domain ? "selected" : ""}>${d}</option>`).join("")}</select></td>
        <td data-l="Linked CLO"><select class="cell ${linked ? "filled" : "no-clo"}" data-ref="slo:${i}:clo_id" data-c="clo_id" title="Choose ${NO_CLO} for an SLO that is not linked to a CLO.">${cloIds.map((c) => `<option ${c === r.clo_id ? "selected" : ""}>${esc(c)}</option>`).join("")}<option value="" ${linked ? "" : "selected"}>${NO_CLO}</option></select></td>
        <td data-l="Target KPI (%)"><input class="cell num-in filled" type="number" min="0" max="100" step="1" value="${T.num(r.target_kpi, 70)}" data-ref="slo:${i}:target_kpi" data-c="target_kpi"></td>
        <td class="ctr"><button class="icon-btn" data-del="${i}" title="Delete this SLO" aria-label="Delete">🗑</button></td></tr>
        <tr class="confirm-row" data-confirm="${i}" hidden><td colspan="8"><span class="warn-text">Delete ${esc(r.slo_id || "this SLO")}? The SLOs after it are renumbered. This cannot be undone.</span>
          <button class="btn sm" data-yes="${i}">Yes, delete</button> <button class="btn sm ghost" data-no="${i}">Cancel, keep it</button></td></tr>`; }).join("")}</tbody></table>`
      : `<div class="info-box"><span>${esc(T.baseCode(sel))} has no SLOs yet. Add them in the box below.</span></div>`}`;

    $$(".slo-tbl .cell", el).forEach((f) => {
      const i = +f.closest("tr").dataset.i, r = rows[i], c = f.dataset.c;
      if (f.tagName === "TEXTAREA") T.autoGrow(f);
      f.addEventListener("input", () => {
        f.classList.toggle("filled", !!T.s(f.value).trim());
        if (f.tagName === "TEXTAREA") { T.autoGrow(f); r[c] = f.value; S.saveSoon(); }
      });
      if (f.tagName !== "SELECT") f.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.blur(); } });
      if (c === "topic" || c === "slo_text")
        f.addEventListener("paste", (e) => T.pasteGrid(e, f, "slo", rows, ["topic", "slo_text"], () => { S.save(); T.refresh("slotbl", "sloadd", "topics"); }));
      f.addEventListener("change", () => {
        if (c === "order") {
          let to = Math.round(T.num(f.value, i + 1)); to = Math.max(1, Math.min(rows.length, to));
          const moved = rows.splice(i, 1)[0]; rows.splice(to - 1, 0, moved);
          storeSlos(sel, rows); T.toast("SLOs put in order and renumbered."); T.refresh("slotbl", "sloadd");
          return;
        }
        if (c === "topic" || c === "slo_text") {
          r[c] = T.cap1(f.value.trim(), c === "topic" ? "Lecture" : "SLO statement"); f.value = r[c]; S.save();
          if (c === "topic") T.refresh("sloadd", "topics");
          return;
        }
        if (c === "target_kpi") { const v = Math.max(0, Math.min(100, T.num(f.value, 70))); f.value = v; r.target_kpi = v; S.save(); return; }
        r[c] = f.value; S.save();
        if (c === "clo_id") { f.classList.toggle("no-clo", !f.value); f.classList.toggle("filled", !!f.value); }
        T.refresh("slotbl");
      });
    });
    $$("[data-del]", el).forEach((b) => b.onclick = () => { $(`[data-confirm="${b.dataset.del}"]`, el).hidden = false; });
    $$("[data-no]", el).forEach((b) => b.onclick = () => { $(`[data-confirm="${b.dataset.no}"]`, el).hidden = true; });
    $$("[data-yes]", el).forEach((b) => b.onclick = () => {
      const i = +b.dataset.yes, gone = rows[i].slo_id;
      rows.splice(i, 1); storeSlos(sel, rows);
      T.toast(`${gone} deleted. The SLOs after it were renumbered.`);
      T.refresh("slotbl", "sloadd", "topics");
    });
  };

  /* ---------------------------------------------------------------- Add SLOs box */
  T.sections.sloadd = function () {
    const sel = T.current(), el = $("#sec-sloadd"); if (!el) return;
    const rows = slosOf(sel), clos = T.closOf(sel);
    const tab = (S.ui.sloTab || {})[sel] || "type";
    const openNow = !rows.length || (S.ui.sloAddOpen || {})[sel] || !!((S.ui.sloImport || {})[sel]);
    el.innerHTML = `<details class="add-clos" id="slo-add-details" ${openNow ? "open" : ""}><summary><span class="plus">＋</span> Add SLOs to ${esc(T.baseCode(sel))} <span class="muted">· type one, or import a file</span></summary>
      <div class="tabs"><button data-tab="type" class="${tab === "type" ? "on" : ""}">Type one SLO</button><button data-tab="import" class="${tab === "import" ? "on" : ""}">Import from a file (Excel, CSV, Word or PDF)</button></div>
      <div id="slo-add-body"></div></details>`;
    $("#slo-add-details").addEventListener("toggle", (e) => { S.ui.sloAddOpen = S.ui.sloAddOpen || {}; S.ui.sloAddOpen[sel] = e.target.open; S.saveUi(); });
    $$("[data-tab]", el).forEach((b) => b.onclick = () => { S.ui.sloTab = S.ui.sloTab || {}; S.ui.sloTab[sel] = b.dataset.tab; S.saveUi(); T.sections.sloadd(); });
    if (tab === "import") { renderImport($("#slo-add-body"), sel); return; }

    const dr = (S.ui.sloDraft = S.ui.sloDraft || {});
    const d = dr[sel] || (dr[sel] = { domain: "", topic: "", clo: "", text: "", place: "At the end", target: 70 });
    const places = ["At the end", ...(rows.length ? ["At the very beginning"] : []), ...rows.map((r) => `After ${r.slo_id} (${T.s(r.topic).slice(0, 40)})`)];
    if (!places.includes(d.place)) d.place = "At the end";
    const cloOpts = [...clos.map((c) => [String(c.clo_id), cloLabel(c)]), [NO_CLO, NO_CLO]];
    if (d.clo && !cloOpts.some((o) => o[0] === d.clo)) d.clo = "";
    const topics = [...new Set(rows.map((r) => T.s(r.topic).trim()).filter(Boolean))];
    $("#slo-add-body").innerHTML = `<div class="grid g2">
        ${T.select({ id: "ns-domain", label: "Learning domain", req: true, value: d.domain, placeholder: "Select a domain", options: T.SLO_DOMAINS, help: DOMAIN_HELP })}
        ${T.field({ id: "ns-topic", label: "Lecture / module title", req: true, value: d.topic, options: topics, placeholder: "Choose or type" })}
      </div>
      <div class="grid g1">${T.select({ id: "ns-clo", label: "Linked CLO (code of the CLO this SLO belongs to)", req: true, value: d.clo, placeholder: "Select a CLO", options: cloOpts })}</div>
      ${T.field({ id: "ns-text", label: "SLO statement", req: true, value: d.text, textarea: true, rows: 2 })}
      <div class="grid g2">
        ${T.select({ id: "ns-place", label: "Where to put this SLO in the list", value: d.place, options: places, help: "The SLOs are renumbered in order, so the SLOs after it move down by one number." })}
        ${T.field({ id: "ns-target", label: "Target KPI for this SLO (%)", value: d.target })}
      </div>
      <p class="note">Fields marked with <b class="req">*</b> are required. Assessment methods are set in the Assessment plan page. What you type is kept until you add the SLO.</p>
      <div class="row-btns end"><button class="btn primary" id="ns-add">Add SLO</button></div>
      <p class="warn-text" id="ns-msg" hidden></p>`;
    const body = $("#slo-add-body");
    const sync = () => { d.domain = $("#ns-domain").value; d.topic = $("#ns-topic").value; d.clo = $("#ns-clo").value; d.text = $("#ns-text").value; d.place = $("#ns-place").value; d.target = $("#ns-target").value; S.saveUi(); };
    $$("input, select, textarea", body).forEach((f) => {
      if (f.tagName === "TEXTAREA") T.autoGrow(f);
      f.addEventListener("input", () => { T.markFilled(f); if (f.tagName === "TEXTAREA") T.autoGrow(f); sync(); });
      f.addEventListener("change", () => { if (f.id === "ns-text" || f.id === "ns-topic") f.value = T.cap1(f.value.trim(), f.dataset.label); T.markFilled(f); sync(); });
    });
    $("#ns-add").onclick = () => {
      sync();
      const msg = $("#ns-msg"); msg.hidden = true;
      const stxt = T.cap1(T.s(d.text).trim(), "SLO statement"), stopic = T.cap1(T.s(d.topic).trim(), "Lecture");
      const missing = [["learning domain", d.domain], ["lecture / module title", stopic], ["linked CLO", d.clo], ["SLO statement", stxt]].filter((x) => !x[1]).map((x) => x[0]);
      if (missing.length) { msg.hidden = false; msg.textContent = "Please fill in: " + missing.join(", ") + "."; return; }
      const row = { course_code: sel, topic: stopic, slo_id: "", slo_text: stxt, domain: d.domain, clo_id: d.clo === NO_CLO ? "" : d.clo, assessment_methods: "", target_kpi: Math.max(0, Math.min(100, T.num(d.target, 70))) };
      const k = d.place === "At the end" ? rows.length : d.place === "At the very beginning" ? 0 : rows.findIndex((r) => d.place.startsWith(`After ${r.slo_id} (`)) + 1;
      storeSlos(sel, [...rows.slice(0, k), row, ...rows.slice(k)]);
      T.toast(`SLO${k + 1} saved at position ${k + 1}` + (k < rows.length ? "; the SLOs after it were renumbered." : "."));
      dr[sel] = { domain: "", topic: d.topic, clo: "", text: "", place: "At the end", target: 70 };   // the lecture title stays for the next SLO of the same lecture
      S.saveUi();
      T.refresh("slotbl", "sloadd", "topics");
      const t = $("#ns-text"); if (t) t.focus({ preventScroll: true });
    };
  };

  /* ---------------------------------------------------------------- SLO import */
  function guess(cols, words, avoid) {
    for (const w of words) for (const c of cols) { const cl = c.toLowerCase(); if (cl.includes(w) && !(avoid || []).some((a) => cl.includes(a))) return c; }
    return "";
  }
  const DOM_MAP = (() => {
    const m = {}; T.SLO_DOMAINS.forEach((d) => { m[d.toUpperCase().replace(/ /g, "")] = d; });
    Object.assign(m, { KNOWLEDGE: "K", COGNITIVE: "S:Cog.", "S:COG": "S:Cog.", "S:COGNITIVE": "S:Cog.", "S:IT": "S:IT-N", "S:ITN": "S:IT-N", "S:PSYCHOMOTOR": "S:Psych", PSYCHOMOTOR: "S:Psych", VALUES: "V" });
    return m;
  })();

  function renderImport(box, sel) {
    const store = (S.ui.sloImport = S.ui.sloImport || {});
    const s = store[sel];
    const clos = T.closOf(sel), cloIds = clos.map((c) => String(c.clo_id));
    box.innerHTML = `<p class="note">One row per SLO. Needed: SLO statement, lecture / topic and domain. Optional: SLO ID, linked CLO, target KPI.</p>
      <div class="info-box"><span>The same Excel file is used for CLOs and SLOs: it has two sheets, <b>CLOs</b> and <b>SLOs</b>. Fill both, then upload the same file here and on Course setup. Each page reads its own sheet.</span>
        <button class="btn sm" id="stpl">Download the example Excel file (CLOs and SLOs)</button></div>
      <div class="drop" id="sdrop"><input type="file" id="slo-file" accept=".xlsx,.xls,.xlsm,.csv,.docx,.pdf" hidden>
        ${s ? `<b>${esc(s.fileName)}</b> <span class="muted">is being checked.</span> <button class="btn sm ghost" id="sfile-clear">Choose another file</button>`
          : `<span><b>Upload the SLO file</b> · drag it here, or</span> <label for="slo-file" class="btn sm">Browse files</label>`}</div>
      <div id="simp-body"></div>`;
    $("#stpl", box).onclick = () => T.importer.templateDownload(S.cloStyleOf(sel, cloIds), cloIds).catch((e) => T.toast(e.message, "warn"));
    const take = async (file) => {
      try {
        const tables = await T.importer.read(file);
        if (!tables.length) { T.toast(`No table was found in ${file.name}. The file must hold a table (a scanned PDF image cannot be read).`, "warn"); return; }
        const pick = Math.max(0, tables.findIndex((t) => t.name.toLowerCase().includes("slo")));
        store[sel] = { fileName: file.name, tables, pick, mode: "add", dclo: "", dkpi: 70 };
        setMap(store[sel]); S.saveUi(); renderImport(box, sel);
      } catch (e) { T.toast("Could not read the file: " + e.message, "warn"); }
    };
    const fi = $("#slo-file", box); fi.onchange = () => fi.files[0] && take(fi.files[0]);
    const drop = $("#sdrop", box);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
    const fc = $("#sfile-clear", box); if (fc) fc.onclick = () => { delete store[sel]; S.saveUi(); renderImport(box, sel); };
    if (!s) return;

    const tbl = s.tables[s.pick], cols = tbl.columns, el = $("#simp-body", box);
    const colSel = (id, label, val, req) => T.select({ id, label, req, value: val, options: [["", "(none)"], ...cols.map((c) => [c, c])] });
    let html = s.tables.length > 1 ? `<div class="grid g2">${T.select({ id: "s-tbl", label: `Select ${/\.(xlsx|xls|xlsm)$/i.test(s.fileName) ? "sheet" : "table"} from ${s.fileName}`, value: String(s.pick), options: s.tables.map((t, i) => [String(i), `${t.name} (${t.rows.length} rows)`]) })}</div>` : "";
    html += `<label class="tick"><input type="checkbox" id="s-raw" ${s.raw ? "checked" : ""}> Show the file as it was read</label>
      ${s.raw ? `<div class="raw">${T.tableHtml(cols, tbl.rows.slice(0, 30))}</div>` : ""}
      <h4>Which column is which?</h4>
      <div class="grid g3">${colSel("s-text", "SLO statement", s.text, true)}${colSel("s-topic", "Lecture / topic", s.topic, true)}${colSel("s-dom", "Domain", s.dom, true)}</div>
      <div class="grid g3">${colSel("s-id", "SLO ID (optional)", s.id)}${colSel("s-clo", "Linked CLO (optional)", s.clo)}${colSel("s-kpi", "Target KPI (optional)", s.kpi)}</div>
      <div class="grid g2">
        ${T.select({ id: "s-dclo", label: "Link to this CLO when the file has no valid CLO", value: s.dclo, options: [["", "(empty - leave the CLO link empty)"], ...clos.map((c) => [String(c.clo_id), cloLabel(c)])] })}
        ${T.field({ id: "s-dkpi", label: "Target KPI (%) for imported SLOs (also used where the file column is empty)", value: s.dkpi })}
      </div>
      <div class="fld"><span class="lbl">What to do with the SLOs already saved for this course</span>
        <div class="seg">${[["add", "Add the imported SLOs to them"], ["replace", "Replace them with the imported SLOs"]].map(([v, l]) => `<button class="${s.mode === v ? "on" : ""}" data-smode="${v}">${l}</button>`).join("")}</div></div>
      <div id="s-check"></div>`;
    el.innerHTML = html;
    const redo = () => { S.saveUi(); renderImport(box, sel); };
    const st = $("#s-tbl", el); if (st) st.onchange = () => { s.pick = +st.value; setMap(s); redo(); };
    $("#s-raw", el).onchange = (e) => { s.raw = e.target.checked; redo(); };
    [["s-text", "text"], ["s-topic", "topic"], ["s-dom", "dom"], ["s-id", "id"], ["s-clo", "clo"], ["s-kpi", "kpi"], ["s-dclo", "dclo"]].forEach(([id, k]) => { $("#" + id, el).onchange = (e) => { s[k] = e.target.value; redo(); }; });
    $("#s-dkpi", el).onchange = (e) => { s.dkpi = Math.max(0, Math.min(100, T.num(e.target.value, 70))); redo(); };
    $$("[data-smode]", el).forEach((b) => b.onclick = () => { s.mode = b.dataset.smode; s.okReplace = false; redo(); });

    const chk = $("#s-check", el);
    const missCols = [["SLO statement", s.text], ["Lecture / topic", s.topic], ["Domain", s.dom]].filter((x) => !x[1]).map((x) => x[0]);
    if (missCols.length) { chk.innerHTML = `<p class="warn-text">Choose the column for: ${missCols.join(", ")}.</p>`; return; }
    const saved = slosOf(sel);
    const used = new Set((s.mode === "replace" ? [] : saved.map((r) => T.s(r.slo_id))).map((x) => x.toUpperCase()));
    // other ways a file may name the course's CLOs (2.3 = third Skill CLO, CLO3 = third CLO)
    const cloSet = Object.fromEntries(cloIds.map((x) => [x.toUpperCase(), x]));
    const cnt = {};
    clos.forEach((c, k) => {
      cnt[c.domain] = (cnt[c.domain] || 0) + 1;
      const a = `${T.DOM_NUM[c.domain] || 9}.${cnt[c.domain]}`;
      [a, `CLO${k + 1}`, `CLO ${k + 1}`].forEach((x) => { if (!(x in cloSet)) cloSet[x] = String(c.clo_id); });
    });
    const good = [], problems = [], unmatched = [];
    tbl.rows.filter((r) => Object.values(r).some((v) => T.s(v).trim())).forEach((r, i) => {
      const txt = T.s(r[s.text]).trim(), top = T.s(r[s.topic]).trim(), dmRaw = T.s(r[s.dom]).trim(), rowNo = i + 2;
      const dm = DOM_MAP[dmRaw.toUpperCase().replace(/ /g, "")];
      if (!txt || !top || !dmRaw) { problems.push(`Row ${rowNo}: statement, lecture / topic and domain are all required.`); return; }
      if (!dm) { problems.push(`Row ${rowNo}: domain '${dmRaw}' is not one of ${T.SLO_DOMAINS.join(", ")}.`); return; }
      let sid = s.id ? T.s(r[s.id]).trim() : "";
      if (sid && used.has(sid.toUpperCase())) { problems.push(`Row ${rowNo}: ${sid} is already used.`); return; }
      if (!sid) sid = T.nextId("SLO", used);
      used.add(sid.toUpperCase());
      let clo = s.dclo;
      if (s.clo && T.s(r[s.clo]).trim()) {
        let fc = T.s(r[s.clo]).trim(); if (/^\d+\.0$/.test(fc)) fc = fc.slice(0, -2);
        clo = cloSet[fc.toUpperCase()] || s.dclo;
        if (!cloSet[fc.toUpperCase()] && !unmatched.includes(fc)) unmatched.push(fc);
      }
      let kpi = T.num(s.dkpi, 70);
      if (s.kpi) { const kv = parseFloat(r[s.kpi]); if (!isNaN(kv)) kpi = Math.min(Math.max(kv, 0), 100); }
      good.push({ course_code: sel, topic: T.cap1(top, "Lecture"), slo_id: sid, slo_text: T.cap1(txt, "SLO statement"), domain: dm, clo_id: clo, assessment_methods: "", target_kpi: kpi });
    });
    chk.innerHTML = `${problems.length ? `<div class="warn-box"><b>These rows cannot be imported and will be skipped:</b><ul>${problems.slice(0, 20).map((p) => `<li>${esc(p)}</li>`).join("")}${problems.length > 20 ? "<li>...</li>" : ""}</ul></div>` : ""}
      ${unmatched.length ? `<p class="warn-text">These CLOs in the file are not CLOs of this course, so their SLOs ${s.dclo ? "get the CLO chosen above" : "are left without a CLO"}: ${esc(unmatched.join(", "))}. This course's CLOs are ${esc(cloIds.join(", "))}. Add or import the CLOs first, or fix the file.</p>` : ""}
      ${good.length ? `<div class="ok-box">${good.length} SLO(s) are ready to import. Check them below, then press the Import button. They then appear in the SLO list above, and this preview disappears.</div>
        <table class="tbl"><colgroup><col style="width:17%"><col style="width:64px"><col><col style="width:80px"><col style="width:84px"><col style="width:78px"></colgroup>
        <thead><tr><th>Lecture / topic</th><th>SLO ID</th><th>SLO statement</th><th>Domain</th><th>Linked CLO</th><th>Target KPI (%)</th></tr></thead>
        <tbody>${good.map((g) => `<tr><td class="wrap">${esc(g.topic)}</td><td>${esc(g.slo_id)}</td><td class="wrap">${esc(g.slo_text)}</td><td>${esc(g.domain)}</td><td class="${g.clo_id ? "" : "no-clo-text"}">${esc(g.clo_id || NO_CLO)}</td><td class="num">${g.target_kpi}</td></tr>`).join("")}</tbody></table>
        ${s.mode === "replace" && saved.length ? `<p class="warn-text">The ${saved.length} SLO(s) saved for this course will be DELETED and replaced by the imported ones.</p>
          <label class="tick"><input type="checkbox" id="s-okrep" ${s.okReplace ? "checked" : ""}> Yes, replace the saved SLOs</label>` : ""}
        <div class="row-btns end"><button class="btn primary" id="s-go">Import ${good.length} SLO(s)</button></div>` : ""}`;
    const ok = $("#s-okrep", chk); if (ok) ok.onchange = () => { s.okReplace = ok.checked; S.saveUi(); };
    const go = $("#s-go", chk);
    if (go) go.onclick = () => {
      if (s.mode === "replace" && saved.length && !s.okReplace) { T.toast("Nothing was imported. Tick “Yes, replace the saved SLOs” first.", "warn"); return; }
      if (s.mode === "replace") {
        const prev = Object.fromEntries(saved.map((r) => [r.slo_id, r.assessment_methods]));
        good.forEach((g) => { g.assessment_methods = prev[g.slo_id] || ""; });
        S.setT("slos", [...S.t("slos").filter((r) => String(r.course_code) !== String(sel)), ...good]);
      } else S.setT("slos", [...S.t("slos"), ...good]);
      delete store[sel]; S.saveUi(); S.save();
      T.toast(`${good.length} SLOs imported.` + (problems.length ? ` ${problems.length} rows were skipped.` : ""));
      T.refresh("slotbl", "sloadd", "topics");
    };
  }
  function setMap(s) {
    const cols = s.tables[s.pick].columns;
    // the first word is the best hint: "statement" must win over "slo", which also matches "SLO ID"
    s.text = guess(cols, ["statement", "outcome", "text", "description", "slo"], ["id", "code", "no.", "clo", "kpi", "domain", "lecture", "topic"]);
    s.topic = guess(cols, ["lecture", "topic", "module"]);
    s.dom = guess(cols, ["domain"]);
    s.id = guess(cols, ["slo id", "id", "code", "number", "no."], ["clo", "statement"]);
    s.clo = guess(cols, ["linked clo", "clo"]);
    s.kpi = guess(cols, ["kpi", "target"]);
  }

  /* ---------------------------------------------------------------- Topics not covered (section C of the Course Report) */
  function crStore(sel) {
    const all = (S.data.course_report = S.data.course_report || {});
    const d = (all[String(sel)] = all[String(sel)] || {});
    d.rule = d.rule || "kpi";
    ["methods", "actual", "clo_comments", "topics", "eval"].forEach((k) => { if (!d[k] || typeof d[k] !== "object") d[k] = {}; });
    return d;
  }
  const split = (t) => T.s(t).replace(/;/g, ",").split(",").map((x) => x.trim()).filter((x) => x && !["nan", "none"].includes(x.toLowerCase()));
  function topicLinks(sel, topic) {
    const sl = slosOf(sel), mine = sl.filter((r) => T.s(r.topic) === topic);
    const clos = [...new Set(mine.flatMap((r) => split(r.clo_id)))];
    const others = {};
    clos.forEach((c) => { others[c] = new Set(sl.filter((r) => T.s(r.topic) !== topic && split(r.clo_id).includes(c)).map((r) => T.s(r.topic))).size; });
    return [mine.map((r) => r.slo_id), clos, others];
  }
  function cloMethods(sel, cid) {
    const typed = crStore(sel).methods[String(cid)];
    if (T.s(typed).trim()) return split(typed);
    let got = (S.data.tables.clo_plan || []).filter((p) => String(p.course_code) === String(sel) && String(p.clo_id) === String(cid)).flatMap((p) => split(p.assessment_methods));
    if (!got.length) got = slosOf(sel).filter((r) => split(r.clo_id).includes(String(cid))).flatMap((r) => split(r.assessment_methods));
    return [...new Set(got)];
  }
  // CLO numbers as the Course Report shows them: 1.x knowledge, 2.x skills, 3.x values
  function cloNos(sel) {
    const count = { 1: 0, 2: 0, 3: 0 }, out = {};
    T.closOf(sel).forEach((c) => { const g = { K: 1, S: 2, V: 3 }[T.s(c.domain).trim().toUpperCase().slice(0, 1)] || 2; count[g]++; out[String(c.clo_id)] = { no: `${g}.${count[g]}`, text: T.s(c.clo_text) }; });
    return out;
  }
  function sugImpact(sel, topic) {
    const [slos, clos, others] = topicLinks(sel, topic);
    if (!clos.length) return "Limited: the SLOs of this topic are not linked to any CLO, so no CLO result depends on it directly.";
    const nos = cloNos(sel);
    const lab = (c) => { const r = nos[c]; if (!r) return c; const t = r.text; return `${r.no} (${t.slice(0, 45).trimEnd()}${t.length > 45 ? "..." : ""})`; };
    const parts = clos.map((c) => (others[c] ? `CLO ${lab(c)} (also covered by ${others[c]} other topic${others[c] !== 1 ? "s" : ""})` : `CLO ${lab(c)} (no other topic covers it)`));
    const level = clos.some((c) => others[c] === 0) ? "High" : clos.some((c) => others[c] <= 1) ? "Moderate" : "Limited";
    return `${level}: this topic supports ${slos.join(", ") || "its SLOs"}, linked to ${parts.join("; ")}.`;
  }
  function sugAction(sel, topic) {
    const [, clos] = topicLinks(sel, topic);
    const meth = [...new Set(clos.flatMap((c) => cloMethods(sel, c)))];
    let txt = "Cover the key points through assigned reading and a recorded or make-up session";
    if (clos.length) txt += `, and include them in ${meth.length ? meth.join(", ") : "the next assessment"} so CLO ${clos.map((c) => (cloNos(sel)[c] || { no: c }).no).join(", ")} is still measured`;
    return txt + ". Schedule the topic early in the next offering.";
  }

  T.sections.topics = function () {
    const sel = T.current(), el = $("#sec-topics"); if (!el) return;
    const topics = [...new Set(slosOf(sel).map((r) => T.s(r.topic).trim()).filter((t) => t && t.toLowerCase() !== "nan"))];
    if (!topics.length) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    const d = crStore(sel), tp = d.topics;
    const was = Object.values(tp).some((v) => v.not_covered) || d.topics_choice === "no" ? "no" : d.topics_none ? "yes" : null;
    const n = Object.values(tp).filter((v) => v.not_covered).length;
    el.innerHTML = `<div class="sec-head" id="h-topics"><div><h2>Topics not covered</h2><p class="sub">For section C of the Course Report.</p></div></div>
      <div class="fld"><span class="lbl">Were all the topics covered by the end of the course?</span>
        <div class="seg">${[["yes", "Yes, all topics were covered"], ["no", "No, some topics were not covered"]].map(([v, l]) => `<button class="${was === v ? "on" : ""}" data-tq="${v}">${l}</button>`).join("")}</div></div>
      ${was === "yes" ? `<p class="ok-text">All topics were covered: section C of the Course Report will say None.</p>`
        : was === null ? `<p class="note">Choose Yes or No. Choose No to list the topics that were not covered.</p>`
        : `<p class="note">Tick the lectures/topics that were not covered this offering and say why. The impact and compensating action can be suggested from the SLOs and CLOs linked to the topic.</p>
        <table class="tbl top-tbl"><colgroup><col style="width:18%"><col style="width:84px"><col><col><col></colgroup>
          <thead><tr><th>Topic</th><th>Not covered</th><th>Reason</th><th>Impact on learning outcomes</th><th>Compensating action</th></tr></thead>
          <tbody>${topics.map((t, i) => { const v = tp[t] || {}; return `<tr data-t="${i}" class="${v.not_covered ? "nc-on" : ""}"><td class="wrap ro">${esc(t)}</td>
            <td class="ctr nc-cell"><label class="nc-lab"><input type="checkbox" class="nc-tick" data-ref="top:${i}:nc" ${v.not_covered ? "checked" : ""} aria-label="Not covered"><span class="nc-word">Not covered</span></label></td>
            ${[["reason", "Reason"], ["impact", "Impact on learning outcomes"], ["action", "Compensating action"]].map(([k, lab]) => `<td data-l="${lab}"><textarea rows="1" class="cell ${T.s(v[k]).trim() ? "filled" : ""}" data-ref="top:${i}:${k}" data-k="${k}" spellcheck="true">${esc(v[k])}</textarea></td>`).join("")}</tr>`; }).join("")}</tbody></table>
        <div class="row-btns"><button class="btn" id="top-sug">✨ Suggest impact and action for the ticked topics</button>
          <button class="btn" id="top-ai" ${T.aiReady() ? "" : "disabled"} title="${T.aiReady() ? "Your own linked AI tool writes them" : "Link your own AI tool in the Ask the assistant window first"}">🤖 Ask AI for impact and action</button></div>
        <p class="warn-text" id="top-ai-msg" hidden></p>
        <p class="note">${n ? `${n} topic(s) marked as not covered. They will be listed in section C of the Course Report.` : "Tick the topics that were not covered (or choose Yes above if every topic was covered)."}</p>`}`;
    $$("[data-tq]", el).forEach((b) => b.onclick = () => {
      const now = b.dataset.tq; if (now === was) return;
      d.topics_choice = now; d.topics_none = now === "yes";
      if (now === "yes") Object.values(tp).forEach((v) => { v.not_covered = false; });
      S.save(); T.refresh("topics");
    });
    const put = (t, patch) => {
      const row = { not_covered: false, reason: "", impact: "", action: "", ...(tp[t] || {}), ...patch };
      if (row.not_covered || row.reason || row.impact || row.action) tp[t] = row; else delete tp[t];
    };
    $$(".top-tbl tr[data-t]", el).forEach((tr) => {
      const t = topics[+tr.dataset.t];
      $(".nc-tick", tr).onchange = (e) => { put(t, { not_covered: e.target.checked }); S.save(); T.refresh("topics"); };
      $$("textarea", tr).forEach((ta) => {
        T.autoGrow(ta);
        ta.addEventListener("input", () => { T.autoGrow(ta); ta.classList.toggle("filled", !!ta.value.trim()); put(t, { [ta.dataset.k]: ta.value }); S.saveSoon(); });
        ta.addEventListener("change", () => { ta.value = T.cap1(ta.value.trim(), "text"); put(t, { [ta.dataset.k]: ta.value }); S.save(); });
      });
    });
    const sb = $("#top-sug", el);
    if (sb) sb.onclick = () => {
      const ticked = Object.keys(tp).filter((t) => tp[t].not_covered && topics.includes(t));
      if (!ticked.length) { T.toast("Tick at least one topic as not covered first.", "warn"); return; }
      ticked.forEach((t) => { tp[t].impact = tp[t].impact || sugImpact(sel, t); tp[t].action = tp[t].action || sugAction(sel, t); });
      S.save(); T.toast(`Impact and action suggested for ${ticked.length} topic(s). Boxes you had already filled were kept.`);
      T.refresh("topics");
    };
    const ab = $("#top-ai", el);
    if (ab) ab.onclick = async () => {
      const ticked = Object.keys(tp).filter((t) => tp[t].not_covered && topics.includes(t));
      if (!ticked.length) { T.toast("Tick at least one topic as not covered first.", "warn"); return; }
      const info = ticked.map((t) => {
        const [, clos, others] = topicLinks(sel, t);
        const txts = slosOf(sel).filter((r) => T.s(r.topic) === t).map((r) => r.slo_text);
        return `Topic '${t}' (reason not covered: ${tp[t].reason || "not given"}); its SLOs: ${txts.join("; ")}; linked CLOs: ${clos.join(", ") || "none"}; other topics covering the same CLOs: ${JSON.stringify(others)}`;
      });
      const ci = S.courseInfo(sel) || {};
      const ctx = `Course: ${S.courseLabel(sel, true)}; program ${ci.program || "-"}.\nCLOs:\n` + T.closOf(sel).map((c) => `${c.clo_id} (${c.domain}): ${c.clo_text}`).join("\n");
      ab.disabled = true; ab.textContent = "🤖 Asking your AI tool...";
      try {
        const got = await T.aiJson(`COURSE DATA\n${ctx}\n\nTOPICS NOT COVERED\n${info.join("\n")}\n\nTASK\nFor each topic, write the 'Extent of their Impact on Learning Outcomes' and a practical 'Compensating Action' for the Course Report (25-60 words each). Return a JSON object: {topic: {"impact": ..., "action": ...}} using the topic names exactly as given.`);
        let n = 0;
        Object.entries(got || {}).forEach(([t, v]) => { if (tp[t] && v && typeof v === "object") { tp[t].impact = T.s(v.impact || tp[t].impact).trim(); tp[t].action = T.s(v.action || tp[t].action).trim(); n++; } });
        S.save(); T.toast(`Your AI tool wrote the impact and action for ${n} topic(s). Change anything you need.`); T.refresh("topics");
      } catch (e) {
        ab.disabled = false; ab.textContent = "🤖 Ask AI for impact and action";
        const m = $("#top-ai-msg", el); m.hidden = false; m.textContent = "Your AI tool could not answer: " + e.message;
      }
    };
  };
})();
