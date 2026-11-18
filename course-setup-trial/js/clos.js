/* CLO section: numbering style, the one CLO table (edited in place, saves itself), and the Add CLOs box. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const PC = ["plo_1", "plo_2", "plo_3"];

  T.closOf = (sel) => S.t("clos").filter((r) => String(r.course_code) === String(sel));
  const styleOf = (sel) => S.cloStyleOf(sel, T.closOf(sel).map((r) => r.clo_id));
  const isAuto = (st) => st === "clo" || st === "dotted";
  const ploList = (sel) => {
    const opts = T.ploOpts(sel);
    const used = []; T.closOf(sel).forEach((c) => PC.forEach((k) => { const v = T.s(c[k]).trim(); if (v && !["nan", "none"].includes(v.toLowerCase()) && !used.includes(v)) used.push(v); }));
    return [...opts, ...used.filter((x) => !opts.includes(x))];
  };

  function store(sel, rows, renames) {
    const st = styleOf(sel);
    const lost = T.links.storeClos(sel, rows, isAuto(st), st, renames);
    S.save();
    if (lost) T.toast(`CLOs saved. ${lost} SLO(s) were linked to a CLO that no longer exists; please link them again in Lectures & SLOs.`, "warn");
    return lost;
  }
  T.storeClosFor = store;

  T.sections.clos = function () {
    const sel = T.current(), el = $("#sec-clos");
    const rows = T.closOf(sel), st = styleOf(sel), auto = isAuto(st);
    const plos = T.ploOpts(sel), list = ploList(sel);
    const mode = S.ui.ploMode || "Type";
    const noTxt = rows.map((r, i) => (T.s(r.clo_text).trim() ? 0 : i + 1)).filter(Boolean);
    const noDom = rows.map((r, i) => (T.s(r.domain).trim() ? 0 : i + 1)).filter(Boolean);
    const lid = "dl-plos-" + T.uid();
    const ploCell = (r, i, k) => mode === "Type"
      ? `<input class="cell ${T.s(r[k]) ? "filled" : ""}" list="${lid}" data-ref="clo:${i}:${k}" data-c="${k}" value="${esc(r[k])}" title="Type a PLO code. This course's PLOs: ${esc(plos.join(", ") || "none yet")}" autocomplete="off">`
      : `<select class="cell ${T.s(r[k]) ? "filled" : ""}" data-ref="clo:${i}:${k}" data-c="${k}"><option value=""></option>${list.map((x) => `<option ${x === r[k] ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
    el.innerHTML = `<div class="sec-head" id="h-clos"><div><h2>Course learning outcomes (CLOs)</h2>
        <p class="sub">The one list of saved CLOs of ${esc(T.baseCode(sel))}. Edit any cell; it saves itself.</p></div><span class="count">${rows.length} CLO${rows.length === 1 ? "" : "s"}</span></div>
      <div class="grid g-style">
        ${T.select({ id: "clo-style", label: "CLO numbering", value: st, options: Object.entries(T.CLO_STYLE_LABELS),
          help: "1.1, 1.2, 2.1 ...: the first number is the domain (1 = K, 2 = S, 3 = V), the second is the order within the domain. Changing the style renumbers the CLOs and everything linked to them (SLOs, blueprints, questions, plans, results)." })}
        <div class="mode-box"><span class="lbl">How to fill the PLO cells <i class="hint" title="Type: write any PLO code in the cell (e.g. K1). Choose from the list: pick one of this course's PLOs.">?</i></span>
          <div class="seg">${["Type", "Choose from the list"].map((m) => `<button class="${m === mode ? "on" : ""}" data-mode="${m}">${m}</button>`).join("")}</div></div>
        <p class="note">PLOs of this course: ${plos.length ? `<b>${esc(plos.join(", "))}</b>` : "none yet (add them in the PLO section above)"}. Typed codes are matched to these whatever the capital letters, e.g. k1 becomes K1.</p>
      </div>
      ${rows.length ? `
      <p class="note">To move a CLO, type the place you want in <b>Order</b> (e.g. 3 puts it third). New CLOs are added in the Add CLOs box below, where you choose their place in the list.
        ${auto ? (st === "clo" ? "The CLOs are kept in order and numbered CLO1, CLO2, CLO3 ..., " : "The CLOs are listed by domain and numbered 1.1, 1.2, 2.1 ... (first number = domain, second = order), ") + "and their SLOs, blueprints and questions follow the new numbers." : "The CLOs keep the IDs you type."}</p>
      ${noTxt.length || noDom.length ? `<p class="warn-text">${noTxt.length ? `Add the CLO statement in row(s) ${T.fmtRows(noTxt)}. ` : ""}${noDom.length ? `Choose the domain (K, S or V) in row(s) ${T.fmtRows(noDom)}. ` : ""}Nothing is lost while rows are unfinished.</p>` : ""}
      <datalist id="${lid}">${list.map((x) => `<option value="${esc(x)}"></option>`).join("")}</datalist>
      <table class="tbl clo-tbl"><colgroup><col style="width:58px"><col style="width:70px"><col style="width:84px"><col><col style="width:96px"><col style="width:96px"><col style="width:96px"><col style="width:82px"><col style="width:82px"><col style="width:56px"></colgroup>
      <thead><tr><th>Order</th><th>CLO ID</th><th>CLO domain</th><th>CLO statement</th><th>PLO 1</th><th>PLO 2</th><th>PLO 3</th><th title="Target attainment (%)">Target attainment (%)</th><th title="Student score threshold (%)">Student score threshold (%)</th><th>Delete</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-i="${i}">
        <td><input class="cell num-in filled" type="number" min="1" step="1" value="${i + 1}" data-ref="clo:${i}:order" data-c="order" title="Type a number to put this CLO in that place."></td>
        <td>${auto ? `<span class="locked-id" title="Numbered automatically">${esc(r.clo_id)}</span>` : `<input class="cell ${T.s(r.clo_id) ? "filled" : ""}" data-ref="clo:${i}:clo_id" data-c="clo_id" value="${esc(r.clo_id)}" autocomplete="off">`}</td>
        <td><select class="cell ${T.s(r.domain) ? "filled" : ""}" data-ref="clo:${i}:domain" data-c="domain" title="K = Knowledge, S = Skill, V = Value"><option value=""></option>${Object.keys(T.CLO_DOMAINS).map((d) => `<option ${d === r.domain ? "selected" : ""}>${d}</option>`).join("")}</select></td>
        <td><textarea rows="1" class="cell ${T.s(r.clo_text).trim() ? "filled" : ""}" data-ref="clo:${i}:clo_text" data-c="clo_text" spellcheck="true">${esc(r.clo_text)}</textarea></td>
        ${PC.map((k) => `<td>${ploCell(r, i, k)}</td>`).join("")}
        <td><input class="cell num-in filled" type="number" min="0" max="100" step="1" value="${T.num(r.target_pct, 70)}" data-ref="clo:${i}:target_pct" data-c="target_pct"></td>
        <td><input class="cell num-in filled" type="number" min="0" max="100" step="1" value="${T.num(r.kpi_threshold, 60)}" data-ref="clo:${i}:kpi_threshold" data-c="kpi_threshold"></td>
        <td class="ctr"><button class="icon-btn" data-del="${i}" title="Delete this CLO" aria-label="Delete">🗑</button></td></tr>
        <tr class="confirm-row" data-confirm="${i}" hidden><td colspan="10"><span class="warn-text">Delete ${esc(r.clo_id || "this CLO")}? Its SLOs keep their text but lose the link. This cannot be undone.</span>
          <button class="btn sm" data-yes="${i}">Yes, delete</button> <button class="btn sm ghost" data-no="${i}">Cancel, keep it</button></td></tr>`).join("")}</tbody></table>`
      : `<div class="info-box"><span>${esc(T.baseCode(sel))} has no CLOs yet. Add them in the box below.</span></div>`}`;

    $("#clo-style").onchange = (e) => {
      const pick = e.target.value;
      S.data.clo_styles[String(sel)] = pick;
      if (isAuto(pick) && rows.length) T.links.storeClos(sel, rows, true, pick);
      S.save();
      T.toast(rows.length ? `CLO numbering changed: ${T.CLO_STYLE_LABELS[pick]}. SLOs, blueprints and questions follow the new IDs.` : `CLO numbering set: ${T.CLO_STYLE_LABELS[pick]}.`);
      T.refresh("clos", "add", "slos");
    };
    $$("[data-mode]", el).forEach((b) => b.onclick = () => { S.ui.ploMode = b.dataset.mode; S.saveUi(); T.refresh("clos"); });

    $$(".clo-tbl .cell", el).forEach((f) => {
      const i = +f.closest("tr").dataset.i, r = rows[i], c = f.dataset.c;
      if (f.tagName === "TEXTAREA") T.autoGrow(f);
      f.addEventListener("input", () => {
        f.classList.toggle("filled", !!T.s(f.value).trim());
        if (f.tagName === "TEXTAREA") { T.autoGrow(f); r[c] = f.value; S.saveSoon(); }
      });
      if (f.tagName !== "SELECT") f.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.blur(); } });
      if (c === "clo_text" || PC.includes(c) || c === "clo_id")
        f.addEventListener("paste", (e) => T.pasteGrid(e, f, "clo", rows, ["clo_id", "domain", "clo_text", ...PC].filter((x) => !(auto && x === "clo_id")), () => {
          rows.forEach((x) => { PC.forEach((k) => { x[k] = T.ploCode(x[k], plos); }); x.domain = ({ K: "K", S: "S", V: "V" })[T.s(x.domain).trim().toUpperCase()[0]] || ""; });
          store(sel, rows); T.refresh("plos", "clos", "slos");
        }));
      f.addEventListener("change", () => {
        if (c === "order") {
          let to = Math.round(T.num(f.value, i + 1)); to = Math.max(1, Math.min(rows.length, to));
          const moved = rows.splice(i, 1)[0]; rows.splice(to - 1, 0, moved);
          store(sel, rows); T.refresh("clos", "add", "slos");
          return;
        }
        if (c === "clo_text") { r.clo_text = T.cap1(f.value.trim(), "CLO statement"); f.value = r.clo_text; S.save(); return; }
        if (c === "target_pct" || c === "kpi_threshold") {
          const v = Math.max(0, Math.min(100, T.num(f.value, c === "target_pct" ? 70 : 60))); f.value = v; r[c] = v; S.save(); return;
        }
        if (c === "domain") {
          r.domain = f.value;
          if (st === "dotted") { store(sel, rows); T.refresh("clos", "add", "slos"); } else { S.save(); T.refresh("slos"); }
          return;
        }
        if (c === "clo_id") {
          const old = T.s(r.clo_id), v = f.value.trim();
          if (v && rows.some((o, j) => j !== i && T.s(o.clo_id).trim().toUpperCase() === v.toUpperCase())) {
            T.toast(`${v} is already used for another CLO of this course, so the ID was not changed.`, "warn"); f.value = old; return;
          }
          r.clo_id = v;
          const m = /^(\d+)\.\d+$/.exec(v);   // an ID such as 2.1 carries its domain in the first number
          if (m && T.NUM_DOM[m[1]] && r.domain !== T.NUM_DOM[m[1]]) { r.domain = T.NUM_DOM[m[1]]; T.toast(`The domain of ${v} was set from the first number of its ID.`); }
          store(sel, rows, old && v ? { [old]: v } : {}); T.refresh("clos", "add", "slos");
          return;
        }
        if (PC.includes(c)) {
          const v = T.ploCode(f.value, plos);   // k1 -> K1, 8 -> PLO8
          const others = PC.filter((k) => k !== c).map((k) => T.s(r[k]).toUpperCase()).filter(Boolean);
          if (v && others.includes(v.toUpperCase())) { T.toast(`The same PLO is chosen twice for ${r.clo_id}. Each PLO can be linked once.`, "warn"); f.value = r[c] || ""; return; }
          r[c] = v; f.value = v; S.save();
          if (v && !plos.includes(v)) T.toast(`Saved. ${v} is not in this course's PLO list yet: add it in the PLO section so it appears in reports and charts.`, "warn");
          T.refresh("plos");
        }
      });
    });
    $$("[data-del]", el).forEach((b) => b.onclick = () => { $(`[data-confirm="${b.dataset.del}"]`, el).hidden = false; });
    $$("[data-no]", el).forEach((b) => b.onclick = () => { $(`[data-confirm="${b.dataset.no}"]`, el).hidden = true; });
    $$("[data-yes]", el).forEach((b) => b.onclick = () => {
      const i = +b.dataset.yes, gone = rows[i].clo_id;
      rows.splice(i, 1);
      const lost = store(sel, rows);
      if (!lost) T.toast(`${gone || "CLO"} deleted.` + (auto ? " The CLOs after it were renumbered." : ""));
      T.refresh("plos", "clos", "add", "slos");
    });
  };

  /* ---------------------------------------------------------------- Add CLOs box: type one, or import a file */
  T.sections.add = function () {
    const sel = T.current(), el = $("#sec-add");
    const rows = T.closOf(sel), st = styleOf(sel), auto = isAuto(st);
    const tab = (S.ui.addTab || {})[sel] || "type";
    const openNow = !rows.length || (S.ui.addOpen || {})[sel] || (T.cloImportPending && T.cloImportPending(sel));
    el.innerHTML = `<details class="add-clos" id="add-details" ${openNow ? "open" : ""}><summary><span class="plus">＋</span> Add CLOs to ${esc(T.baseCode(sel))} <span class="muted">· type one, or import a file</span></summary>
      <div class="tabs"><button data-tab="type" class="${tab === "type" ? "on" : ""}">Type one CLO</button><button data-tab="import" class="${tab === "import" ? "on" : ""}">Import from a file (Excel, CSV, Word or PDF)</button></div>
      <div id="add-body"></div></details>`;
    $("#add-details").addEventListener("toggle", (e) => { S.ui.addOpen = S.ui.addOpen || {}; S.ui.addOpen[sel] = e.target.open; S.saveUi(); });
    $$("[data-tab]", el).forEach((b) => b.onclick = () => { S.ui.addTab = S.ui.addTab || {}; S.ui.addTab[sel] = b.dataset.tab; S.saveUi(); T.sections.add(); });
    if (tab === "import") { T.renderCloImport($("#add-body"), sel, st); return; }

    const sug = T.nextId("CLO", rows.map((r) => r.clo_id));
    const dr = (S.ui.cloDraft = S.ui.cloDraft || {});
    const d = dr[sel] || (dr[sel] = { domain: "", id: "", place: "At the end", text: "", plos: [], target: 70, kpi: 60 });
    const after = rows.map((r, i) => [`After ${r.clo_id} (${T.s(r.clo_text).slice(0, 40)})`, i]);
    const places = ["At the end", ...(rows.length ? ["At the very beginning"] : []), ...after.map((a) => a[0])];
    if (!places.includes(d.place)) d.place = "At the end";
    const plos = T.ploOpts(sel);
    d.plos = d.plos.filter((p) => plos.includes(p));
    const placeHelp = { clo: "The CLOs are renumbered in order, so the CLOs after it move down by one number.",
      dotted: "CLOs are listed by domain (K, then S, then V) and numbered inside their domain, so choose a place next to CLOs of the same domain. 'At the end' puts it last in its domain, 'At the very beginning' first.",
      custom: "The CLO keeps the identifier you type; this only sets its place in the list." }[st];
    $("#add-body").innerHTML = `<div class="grid g2">
        ${T.select({ id: "nc-domain", label: "Course learning outcome domain", req: true, value: d.domain, placeholder: "Select a domain", options: Object.entries(T.CLO_DOMAINS) })}
        ${auto ? T.select({ id: "nc-place", label: "Where to put this CLO in the list", value: d.place, options: places, help: placeHelp })
          : `<div class="grid g2 tight">${T.field({ id: "nc-id", label: "CLO identifier (e.g., CLO1)", req: true, value: d.id || sug })}${T.select({ id: "nc-place", label: "Where to put this CLO in the list", value: d.place, options: places, help: placeHelp })}</div>`}
      </div>
      ${T.field({ id: "nc-text", label: "CLO statement", req: true, value: d.text, textarea: true, rows: 2 })}
      <div class="grid g3">
        <div class="fld ${d.plos.length ? "filled" : ""}"><span class="lbl">Aligned PLOs (up to 3) <i class="hint" title="Add the PLOs of this course in the PLO section above first.">?</i></span>
          <div class="chips">${plos.length ? plos.map((p) => `<button class="chip ${d.plos.includes(p) ? "on" : ""}" data-plo="${esc(p)}">${esc(p)}</button>`).join("") : '<span class="muted">No PLOs yet</span>'}</div></div>
        ${T.field({ id: "nc-target", label: "Target attainment (%)", value: d.target })}
        ${T.field({ id: "nc-kpi", label: "Student score threshold (%)", value: d.kpi })}
      </div>
      <p class="note">Fields marked with <b class="req">*</b> are required. What you type is kept until you add the CLO.</p>
      <div class="row-btns end"><button class="btn primary" id="nc-add">Add CLO</button></div>
      <p class="warn-text" id="nc-msg" hidden></p>`;
    const body = $("#add-body");
    const sync = () => {
      d.domain = $("#nc-domain").value; d.place = $("#nc-place").value; d.text = $("#nc-text").value;
      if (!auto) d.id = $("#nc-id").value;
      d.target = $("#nc-target").value; d.kpi = $("#nc-kpi").value; S.saveUi();
    };
    $$("input, select, textarea", body).forEach((f) => {
      f.addEventListener("input", () => { T.markFilled(f); if (f.tagName === "TEXTAREA") T.autoGrow(f); sync(); });
      f.addEventListener("change", () => { if (f.id === "nc-text") f.value = T.cap1(f.value, "CLO statement"); T.markFilled(f); sync(); });
    });
    $$("[data-plo]", body).forEach((b) => b.onclick = () => {
      const p = b.dataset.plo;
      if (d.plos.includes(p)) d.plos = d.plos.filter((x) => x !== p);
      else if (d.plos.length >= 3) { T.toast("Up to 3 PLOs can be linked to one CLO.", "warn"); return; }
      else d.plos.push(p);
      S.saveUi(); b.classList.toggle("on", d.plos.includes(p)); b.closest(".fld").classList.toggle("filled", d.plos.length > 0);
    });
    $("#nc-add").onclick = () => {
      sync();
      const msg = $("#nc-msg"); msg.hidden = true;
      const cid = auto ? sug : T.s(d.id).trim(), ctxt = T.cap1(T.s(d.text).trim(), "CLO statement");
      let domain = d.domain;
      const mm = !auto && /^(\d+)\.\d+$/.exec(cid);
      if (mm && T.NUM_DOM[mm[1]]) domain = T.NUM_DOM[mm[1]];   // 1.x = K, 2.x = S, 3.x = V
      const missing = [["course learning outcome domain", domain], ["CLO identifier", cid], ["CLO statement", ctxt]].filter((x) => !x[1]).map((x) => x[0]);
      const pi = (after.find((a) => a[0] === d.place) || [])[1];
      const pdom = pi !== undefined ? rows[pi].domain : null;
      if (missing.length) { msg.hidden = false; msg.textContent = "Please fill in: " + missing.join(", ") + "."; return; }
      if (!auto && rows.some((r) => T.s(r.clo_id).toUpperCase() === cid.toUpperCase())) { msg.hidden = false; msg.textContent = `${cid} already exists for this course. Please use a different identifier.`; return; }
      if (st === "dotted" && pi !== undefined && pdom !== domain) {
        msg.hidden = false;
        msg.textContent = `${rows[pi].clo_id} is a ${T.CLO_DOMAINS[pdom] || pdom} CLO, but the new CLO is ${T.CLO_DOMAINS[domain] || domain}. With 1.1 / 2.1 / 3.1 numbering the CLOs are listed by domain, so choose a place after a CLO of the same domain (or 'At the end' / 'At the very beginning' of its domain).`;
        return;
      }
      const p = [...d.plos, "", "", ""].slice(0, 3);
      const row = { course_code: sel, clo_id: auto ? "" : cid, clo_text: ctxt, domain, plo_1: p[0], plo_2: p[1], plo_3: p[2],
        target_pct: Math.max(0, Math.min(100, T.num(d.target, 70))), kpi_threshold: Math.max(0, Math.min(100, T.num(d.kpi, 60))) };
      const k = d.place === "At the end" ? rows.length : d.place === "At the very beginning" ? 0 : pi + 1;
      const ordered = [...rows.slice(0, k), row, ...rows.slice(k)];
      store(sel, ordered);
      const now = T.closOf(sel), pos = now.findIndex((r) => r.clo_text === ctxt) + 1 || k + 1;
      T.toast(`${auto ? now[pos - 1].clo_id : cid} saved at position ${pos} of the list` + (auto && pos <= rows.length ? "; the CLOs after it were renumbered." : "."));
      delete dr[sel]; S.saveUi();
      T.refresh("clos", "add", "slos");
    };
  };
})();
