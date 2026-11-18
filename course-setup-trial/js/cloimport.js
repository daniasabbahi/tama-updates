/* CLO import: read a file, say which column is which, check the rows, change the PLO cells in a preview, then import. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const PC = ["plo_1", "plo_2", "plo_3"];

  const imp = (sel) => ((S.ui.cloImport = S.ui.cloImport || {})[sel]);
  T.cloImportPending = (sel) => !!imp(sel);

  function guess(cols, words, avoid) {
    for (const w of words) for (const c of cols) { const cl = c.toLowerCase(); if (cl.includes(w) && !(avoid || []).some((a) => cl.includes(a))) return c; }
    return "";
  }
  const domOf = (v) => {
    v = T.s(v).trim().toUpperCase(); if (!v) return null;
    for (const [k, w] of [["K", "KNOWLEDGE"], ["S", "SKILL"], ["V", "VALUE"]]) if (v === k || v.startsWith(k + " ") || v.startsWith(k + ":") || v.includes(w)) return k;
    return null;
  };

  /** The rows that are ready to import, and the problems found (ported from TAMA's CLO import). */
  function check(sel, st, s, tbl) {
    const clos = T.closOf(sel), plos = T.ploOpts(sel);
    const base = s.mode === "replace" ? [] : clos.map((r) => T.s(r.clo_id));
    const used = new Set(base.map((x) => x.toUpperCase()));
    const good = [], problems = [], newPlos = [];
    const known = Object.fromEntries(plos.map((x) => [x.toUpperCase(), x]));
    let curDom = null;
    const rows = tbl.rows.filter((r) => Object.values(r).some((v) => T.s(v).trim()));
    rows.forEach((r, i) => {
      const txt = T.s(r[s.text]).trim(), rowNo = i + 2;
      let cid = s.id ? T.s(r[s.id]).trim() : "";
      const hd = txt.length < 60 ? domOf(txt) : null;   // heading rows such as "1.0 | Knowledge" only set the domain below
      if ((hd && (!cid || cid.endsWith(".0") || cid.endsWith("."))) || (cid.endsWith(".0") && !txt)) { curDom = hd || T.NUM_DOM[cid.split(".")[0]] || curDom; return; }
      if (!txt) { if (cid) problems.push(`Row ${rowNo}: ${cid} has no CLO statement.`); return; }
      let dm = s.dom ? domOf(r[s.dom]) : null;
      if (!dm && /^\d+\.\d+/.test(cid)) dm = T.NUM_DOM[cid.split(".")[0]];
      dm = dm || curDom || s.dflt;
      if (!dm) { problems.push(`Row ${rowNo}: no domain (K, S or V). Choose a domain to use above.`); return; }
      if (cid && used.has(cid.toUpperCase())) { problems.push(`Row ${rowNo}: ${cid} is already used.`); return; }
      if (!cid) cid = st === "dotted" ? T.dottedId(dm, used) : T.nextId("CLO", used);
      used.add(cid.toUpperCase());
      const plist = [];
      (s.plos || []).forEach((pc) => {
        T.s(r[pc]).split(/[,;/\n]+|\s+/).forEach((t) => {
          t = t.trim();
          if (/^\d+\.0$/.test(t)) t = t.slice(0, -2);   // Excel numbers come as 8.0: use 8
          if (t && /\d/.test(t)) t = T.ploCode(t, plos);   // 8 -> PLO8, as in the PLO table
          if (t && /\d/.test(t) && !plist.some((x) => x.toUpperCase() === t.toUpperCase())) {
            if (!known[t.toUpperCase()]) { known[t.toUpperCase()] = t; newPlos.push(t); }
            plist.push(known[t.toUpperCase()]);
          }
        });
      });
      if (plist.length > 3) problems.push(`Row ${rowNo}: ${cid} lists more than 3 PLOs; only the first 3 are kept.`);
      const p3 = [...plist, "", "", ""].slice(0, 3);
      good.push({ course_code: sel, clo_id: cid, clo_text: T.cap1(txt, "CLO statement"), domain: dm, plo_1: p3[0], plo_2: p3[1], plo_3: p3[2], target_pct: T.num(s.target, 70), kpi_threshold: T.num(s.kpi, 60) });
    });
    return { good, problems, newPlos };
  }

  T.renderCloImport = function (box, sel, st) {
    const s = imp(sel);
    const styleNote = { clo: "This course numbers its CLOs CLO1, CLO2, CLO3 ...: after the import the CLOs are renumbered in that style, in the order of the file.",
      dotted: "This course numbers its CLOs 1.1, 1.2, 2.1 ... (domain.order): after the import the CLOs are listed by domain and renumbered in that style.",
      custom: "This course uses its own IDs: the IDs of the file are kept as typed." }[st];
    box.innerHTML = `<p class="note">One row per CLO. Needed: the CLO statement. Optional: CLO ID, domain (K/S/V) and aligned PLOs. Codes like 1.1 / 2.1 / 3.1 set the domain by themselves (1 = K, 2 = S, 3 = V). ${styleNote} Change the style under CLO numbering above.</p>
      <div class="info-box"><span>The same Excel file is used for CLOs and SLOs: it has two sheets, <b>CLOs</b> and <b>SLOs</b>. Fill both, then upload the same file here and on the other page. Each page reads its own sheet.</span>
        <button class="btn sm" id="tpl">Download the example Excel file (CLOs and SLOs)</button></div>
      <div class="drop" id="drop"><input type="file" id="clo-file" accept=".xlsx,.xls,.xlsm,.csv,.docx,.pdf" hidden>
        ${s ? `<b>${esc(s.fileName)}</b> <span class="muted">is being checked.</span> <button class="btn sm ghost" id="file-clear">Choose another file</button>`
          : `<span><b>Upload the CLO file</b> · drag it here, or</span> <label for="clo-file" class="btn sm">Browse files</label>`}</div>
      <div id="imp-body"></div>`;
    $("#tpl", box).onclick = () => T.importer.templateDownload(st, T.closOf(sel).map((r) => r.clo_id)).catch((e) => T.toast(e.message, "warn"));
    const fi = $("#clo-file", box);
    const take = async (file) => {
      try {
        const tables = await T.importer.read(file);
        if (!tables.length) { T.toast(`No table was found in ${file.name}. The file must hold a table (a scanned PDF image cannot be read).`, "warn"); return; }
        const pick = Math.max(0, tables.findIndex((t) => t.name.toLowerCase().includes("clo")));
        S.ui.cloImport[sel] = { fileName: file.name, tables, pick, mode: "add", dflt: "", target: 70, kpi: 60, pmode: "Type" };
        setMap(S.ui.cloImport[sel]);
        S.saveUi(); T.renderCloImport(box, sel, st);
      } catch (e) { T.toast("Could not read the file: " + e.message, "warn"); }
    };
    fi.onchange = () => fi.files[0] && take(fi.files[0]);
    const drop = $("#drop", box);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
    const fc = $("#file-clear", box);
    if (fc) fc.onclick = () => { delete S.ui.cloImport[sel]; S.saveUi(); T.renderCloImport(box, sel, st); };
    if (s) renderBody($("#imp-body", box), sel, st, s);
  };

  function setMap(s) {
    const cols = s.tables[s.pick].columns;
    s.text = guess(cols, ["statement", "outcome", "description", "text", "clo"], ["id", "code", "no.", "plo", "domain"]);
    s.id = guess(cols, ["id", "code", "no", "number", "#"], ["plo", "statement", "outcome", "description"]);
    s.dom = guess(cols, ["domain"]);
    s.plos = cols.filter((c) => c.toLowerCase().includes("plo")).slice(0, 3);
  }

  function renderBody(el, sel, st, s) {
    const tbl = s.tables[s.pick], cols = tbl.columns;
    const colSel = (id, label, val, req) => T.select({ id, label, req, value: val, options: [["", "(none)"], ...cols.map((c) => [c, c])] });
    const save = () => S.saveUi();
    let html = "";
    if (s.tables.length > 1) html += `<div class="grid g2">${T.select({ id: "imp-tbl", label: `Select ${/\.(xlsx|xls|xlsm)$/i.test(s.fileName) ? "sheet" : "table"} from ${s.fileName}`, value: String(s.pick), options: s.tables.map((t, i) => [String(i), `${t.name} (${t.rows.length} rows)`]) })}</div>`;
    html += `<label class="tick"><input type="checkbox" id="imp-raw" ${s.raw ? "checked" : ""}> Show the file as it was read</label>
      ${s.raw ? `<div class="raw">${tableHtml(cols, tbl.rows.slice(0, 30))}</div>` : ""}
      <h4>Which column is which?</h4>
      <div class="grid g3">${colSel("m-text", "CLO statement", s.text, true)}${colSel("m-id", "CLO ID (optional)", s.id)}${colSel("m-dom", "Domain (optional)", s.dom)}</div>
      <div class="fld ${s.plos.length ? "filled" : ""}"><span class="lbl">Aligned PLO column(s) (optional, up to 3)</span>
        <div class="chips">${cols.map((c) => `<button class="chip ${s.plos.includes(c) ? "on" : ""}" data-pcol="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
      <div class="grid g3">
        ${T.select({ id: "m-dflt", label: "Domain to use when the file gives none", value: s.dflt, options: [["", "(none - skip those rows)"], ...Object.entries(T.CLO_DOMAINS)] })}
        ${T.field({ id: "m-target", label: "Target attainment (%)", value: s.target })}
        ${T.field({ id: "m-kpi", label: "Student score threshold (%)", value: s.kpi })}
      </div>
      <div class="fld"><span class="lbl">What to do with the CLOs already saved for this course</span>
        <div class="seg">${[["add", "Add the imported CLOs to them"], ["replace", "Replace them with the imported CLOs"]].map(([v, l]) => `<button class="${s.mode === v ? "on" : ""}" data-imode="${v}">${l}</button>`).join("")}</div></div>
      <div id="imp-check"></div>`;
    el.innerHTML = html;
    const it = $("#imp-tbl", el); if (it) it.onchange = () => { s.pick = +it.value; setMap(s); save(); renderBody(el, sel, st, s); };
    $("#imp-raw", el).onchange = (e) => { s.raw = e.target.checked; save(); renderBody(el, sel, st, s); };
    [["m-text", "text"], ["m-id", "id"], ["m-dom", "dom"], ["m-dflt", "dflt"]].forEach(([id, k]) => { $("#" + id, el).onchange = (e) => { s[k] = e.target.value; save(); renderBody(el, sel, st, s); }; });
    [["m-target", "target"], ["m-kpi", "kpi"]].forEach(([id, k]) => { $("#" + id, el).onchange = (e) => { s[k] = Math.max(0, Math.min(100, T.num(e.target.value, k === "target" ? 70 : 60))); save(); renderBody(el, sel, st, s); }; });
    $$("[data-pcol]", el).forEach((b) => b.onclick = () => {
      const c = b.dataset.pcol;
      if (s.plos.includes(c)) s.plos = s.plos.filter((x) => x !== c); else if (s.plos.length < 3) s.plos.push(c); else { T.toast("Up to 3 PLO columns can be chosen.", "warn"); return; }
      save(); renderBody(el, sel, st, s);
    });
    $$("[data-imode]", el).forEach((b) => b.onclick = () => { s.mode = b.dataset.imode; s.okReplace = false; save(); renderBody(el, sel, st, s); });
    renderCheck($("#imp-check", el), sel, st, s, tbl);
  }

  function renderCheck(el, sel, st, s, tbl) {
    if (!s.text) { el.innerHTML = `<p class="warn-text">Choose the column that holds the CLO statement.</p>`; return; }
    const { good, problems } = check(sel, st, s, tbl);
    const plos = T.ploOpts(sel);
    // PLO changes made earlier in this preview are kept (saved with the settings), also after the page is closed
    const ui = S.data.ui_settings; ui.import_plo_edits = ui.import_plo_edits || {};
    const pedits = (ui.import_plo_edits[sel] = ui.import_plo_edits[sel] || {});
    const rk = (k, g) => `${k}|${g.clo_id}|${T.s(g.clo_text).slice(0, 60)}`;
    good.forEach((g, k) => { const sv = pedits[rk(k, g)]; if (Array.isArray(sv) && sv.length === 3) PC.forEach((c, j) => { g[c] = sv[j]; }); });
    const ipl = [...plos]; good.forEach((g) => PC.forEach((c) => { if (g[c] && !ipl.some((x) => x.toUpperCase() === g[c].toUpperCase())) ipl.push(g[c]); }));
    const iknown = new Set(plos.map((x) => x.toUpperCase()));
    const newPlos = []; good.forEach((g) => PC.forEach((c) => { if (g[c] && !iknown.has(g[c].toUpperCase()) && !newPlos.includes(g[c])) newPlos.push(g[c]); }));
    if (s.addNew === undefined) s.addNew = true;
    const nOld = T.closOf(sel).length;
    const lid = "dl-imp-" + T.uid();
    el.innerHTML = `${problems.length ? `<div class="warn-box"><b>Please check these rows:</b><ul>${problems.slice(0, 20).map((p) => `<li>${esc(p)}</li>`).join("")}${problems.length > 20 ? "<li>...</li>" : ""}</ul></div>` : ""}
      ${good.length ? `<div class="ok-box">${good.length} CLO(s) are ready to import. Check them below, then press the Import button. They then appear in the CLO list above, and this preview disappears.</div>
      <div class="grid g-style"><div class="mode-box"><span class="lbl">How to fill the PLO cells</span>
        <div class="seg">${["Type", "Choose from the list"].map((m) => `<button class="${m === s.pmode ? "on" : ""}" data-pm="${m}">${m}</button>`).join("")}</div></div>
        <p class="note">You can change the PLO 1, PLO 2 and PLO 3 cells below before you import. PLOs to choose from: ${esc(ipl.join(", ") || "none yet")}. Typed codes are matched to these whatever the capital letters.</p></div>
      <datalist id="${lid}">${ipl.map((x) => `<option value="${esc(x)}"></option>`).join("")}</datalist>
      <table class="tbl prev-tbl"><colgroup><col style="width:44px"><col style="width:76px"><col style="width:72px"><col><col style="width:70px"><col style="width:70px"><col style="width:70px"></colgroup>
        <thead><tr><th>#</th><th>CLO ID</th><th>Domain</th><th>CLO statement</th><th>PLO 1</th><th>PLO 2</th><th>PLO 3</th></tr></thead>
        <tbody>${good.map((g, k) => `<tr data-k="${k}"><td class="num">${k + 1}</td><td class="ro">${esc(g.clo_id)}</td><td class="ro">${esc(g.domain)}</td><td class="ro wrap">${esc(g.clo_text)}</td>
          ${PC.map((c) => `<td>${s.pmode === "Type" ? `<input class="cell ${g[c] ? "filled" : ""}" list="${lid}" data-pc="${c}" value="${esc(g[c])}" autocomplete="off">`
            : `<select class="cell ${g[c] ? "filled" : ""}" data-pc="${c}"><option value=""></option>${ipl.map((x) => `<option ${x === g[c] ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`}</td>`).join("")}</tr>`).join("")}</tbody></table>
      ${newPlos.length ? `<div class="info-box"><span>The file links CLOs to PLOs that are not in this course's PLO table yet: <b>${esc(newPlos.join(", "))}</b>.</span></div>
        <label class="tick"><input type="checkbox" id="imp-addplo" ${s.addNew ? "checked" : ""}> Add these PLOs to the PLO table too, so I can write their statements there</label>` : ""}
      ${s.mode === "replace" && nOld ? `<p class="warn-text">The ${nOld} CLO(s) saved for this course will be DELETED and replaced by the imported ones.</p>
        <label class="tick"><input type="checkbox" id="imp-okrep" ${s.okReplace ? "checked" : ""}> Yes, replace the saved CLOs</label>` : ""}
      <div class="row-btns end"><button class="btn primary" id="imp-go">Import ${good.length} CLO(s)</button></div>` : ""}`;
    $$("[data-pm]", el).forEach((b) => b.onclick = () => { s.pmode = b.dataset.pm; S.saveUi(); renderCheck(el, sel, st, s, tbl); });
    $$("[data-pc]", el).forEach((f) => f.addEventListener("change", () => {
      const k = +f.closest("tr").dataset.k, g = good[k], c = f.dataset.pc;
      const v = T.ploCode(f.value, ipl);
      const others = PC.filter((x) => x !== c).map((x) => T.s(g[x]).toUpperCase()).filter(Boolean);
      if (v && others.includes(v.toUpperCase())) { T.toast(`The same PLO was given twice for ${g.clo_id}: it is kept once.`, "warn"); f.value = g[c]; return; }
      g[c] = v;
      pedits[rk(k, g)] = PC.map((x) => g[x]);
      S.save(); renderCheck(el, sel, st, s, tbl);
    }));
    const ap = $("#imp-addplo", el); if (ap) ap.onchange = () => { s.addNew = ap.checked; S.saveUi(); };
    const ok = $("#imp-okrep", el); if (ok) ok.onchange = () => { s.okReplace = ok.checked; S.saveUi(); };
    const go = $("#imp-go", el);
    if (go) go.onclick = () => {
      if (s.mode === "replace" && nOld && !s.okReplace) { T.toast("Nothing was imported. Tick “Yes, replace the saved CLOs” first.", "warn"); return; }
      const keep = s.mode === "replace" ? [] : T.closOf(sel);
      const addPlos = newPlos.length && s.addNew;
      if (addPlos) newPlos.forEach((x) => S.t("plos").push({ course_code: sel, plo_id: x, plo_text: "" }));
      const all = [...keep.map((r) => ({ ...r })), ...good];
      const auto = st === "clo" || st === "dotted";
      const lost = T.links.storeClos(sel, all, auto, st);
      delete S.ui.cloImport[sel]; S.saveUi();
      delete ui.import_plo_edits[sel];
      S.save();
      let msg = `${good.length} CLOs imported.`;
      if (addPlos) msg += ` ${newPlos.length} PLO(s) (${newPlos.join(", ")}) were added to the PLO table above: please write their statements.`;
      if (lost) msg += ` ${lost} SLO(s) were linked to a CLO that no longer exists; please link them again in Lectures & SLOs.`;
      T.toast(msg, lost ? "warn" : "ok");
      T.refresh("plos", "clos", "add", "slos");
    };
  }

  function tableHtml(cols, rows) {
    return `<table class="tbl"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="wrap">${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  T.tableHtml = tableHtml;
})();
