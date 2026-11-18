/* TAMA Course setup trial: page shell, course picker, course details, toasts and the data panel. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc;
  const $ = (q, el) => (el || document).querySelector(q);
  const $$ = (q, el) => [...(el || document).querySelectorAll(q)];
  T.$ = $; T.$$ = $$;
  const NEW = "__new__";

  /* ---------------------------------------------------------------- toasts (never a banner that pushes the page down) */
  T.toast = function (msg, kind) {
    const box = $("#toasts"); if (!box) return;
    const el = document.createElement("div");
    el.className = "toast " + (kind || "ok");
    el.innerHTML = `<span class="ti">${kind === "warn" ? "!" : "✓"}</span><div>${esc(msg)}</div><button aria-label="Close">×</button>`;
    el.querySelector("button").onclick = () => el.remove();
    box.appendChild(el);
    setTimeout(() => el.classList.add("out"), kind === "warn" ? 9000 : 4500);
    setTimeout(() => el.remove(), kind === "warn" ? 9600 : 5100);
  };

  /* ---------------------------------------------------------------- field builders */
  let listN = 0;
  /** A text box that can also offer earlier entries (a combo box: choose, or type a new one). */
  T.field = function (o) {
    const id = o.id || "f_" + T.uid();
    let list = "";
    if (o.options && o.options.length) {
      const lid = "dl" + (++listN);
      list = `<datalist id="${lid}">${o.options.map((x) => `<option value="${esc(x)}"></option>`).join("")}</datalist>`;
      o.list = lid;
    }
    const v = T.s(o.value);
    const cls = ["fld", v.trim() ? "filled" : "", o.copied ? "copied" : "", o.locked ? "locked" : "", o.wide ? "wide" : ""].join(" ");
    const attrs = `id="${id}" data-k="${esc(o.k || "")}" data-label="${esc(o.label)}" ${o.list ? `list="${o.list}"` : ""} placeholder="${esc(o.placeholder || "")}" spellcheck="true" ${o.locked ? "disabled" : ""} autocomplete="off"`;
    const ctl = o.textarea
      ? `<textarea ${attrs} rows="${o.rows || 3}">${esc(v)}</textarea>`
      : `<input type="text" ${attrs} value="${esc(v)}">`;
    return `<label class="${cls}" for="${id}"><span class="lbl">${esc(o.label)}${o.req ? ' <b class="req">*</b>' : ""}${o.help ? ` <i class="hint" title="${esc(o.help)}">?</i>` : ""}</span>${ctl}${list}</label>`;
  };
  T.select = function (o) {
    const id = o.id || "s_" + T.uid();
    const v = T.s(o.value);
    const opts = [...o.options];
    if (v && !opts.some((x) => (Array.isArray(x) ? x[0] : x) === v)) opts.push(v);
    const html = (o.placeholder ? `<option value="" ${v ? "" : "selected"}>${esc(o.placeholder)}</option>` : "") +
      opts.map((x) => { const [val, lab] = Array.isArray(x) ? x : [x, x || "(choose)"]; if (o.placeholder && !val) return ""; return `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(lab)}</option>`; }).join("");
    return `<label class="fld ${v ? "filled" : ""} ${o.copied ? "copied" : ""}" for="${id}"><span class="lbl">${esc(o.label)}${o.req ? ' <b class="req">*</b>' : ""}${o.help ? ` <i class="hint" title="${esc(o.help)}">?</i>` : ""}</span><select id="${id}" data-k="${esc(o.k || "")}" data-label="${esc(o.label)}">${html}</select></label>`;
  };
  /** Light blue once a box has something in it, white while empty (smooth, no blink). */
  T.markFilled = (el) => { const l = el.closest(".fld"); if (l) l.classList.toggle("filled", !!T.s(el.value).trim()); };
  T.autoGrow = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };

  /** Re-draw one part of the page, keeping the cursor where it was (so nothing jumps or blinks). */
  T.refresh = function (...names) {
    const a = document.activeElement, ref = a && a.dataset ? a.dataset.ref : null;
    const sel = a && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
    const y = window.scrollY;
    names.forEach((n) => { const f = T.sections[n]; if (f) f(); });
    if (ref) { const b = document.querySelector(`[data-ref="${CSS.escape(ref)}"]`); if (b) { b.focus({ preventScroll: true }); if (sel && "setSelectionRange" in b) try { b.setSelectionRange(...sel); } catch (e) { /* not a text box */ } } }
    window.scrollTo(0, y);
    regrow();
  };
  // text boxes in tables grow to show all their text once the page has its final widths (and again when fonts or the window change)
  const regrow = () => requestAnimationFrame(() => T.$$("textarea.cell").forEach((t) => { if (t.offsetParent) T.autoGrow(t); }));
  T.regrow = regrow;
  let rgT = null; window.addEventListener("resize", () => { clearTimeout(rgT); rgT = setTimeout(regrow, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(regrow);
  T.sections = {};

  /* ---------------------------------------------------------------- course picker */
  T.current = () => S.ui.current || null;
  const codes = () => S.t("courses").map((r) => String(r.course_code));
  /* ---------------------------------------------------------------- pages (the link's #name picks the page) */
  const PAGES = {
    "course-setup": { name: "Course setup", sub: "Add a course, fill in its details, then its PLOs and CLOs. Everything saves itself as you type.",
      jump: [["h-details", "Course details"], ["h-plos", "PLOs"], ["h-clos", "CLOs"], ["sec-add", "Add CLOs"], ["h-slos", "CLOs and their SLOs"]] },
    "lectures-slos": { name: "Lectures & SLOs", sub: "The SLOs of each lecture or module, each linked to one CLO. Everything saves itself as you type.",
      jump: [["h-slotbl", "SLO table"], ["sec-sloadd", "Add SLOs"], ["h-topics", "Topics not covered"]] },
    "assessment-plan": { name: "Assessment plan", sub: "The grading breakdown of the course and which assessment methods measure each CLO or SLO. Everything saves itself as you type.",
      jump: [["h-summ", "Summative"], ["h-form", "Formative"], ["h-plan", "Plan"], ["h-plsum", "Summaries"]] },
  };
  T.page = () => (PAGES[location.hash.slice(1)] ? location.hash.slice(1) : "course-setup");
  function renderShell() {
    const pg = PAGES[T.page()];
    document.title = `TAMA ${pg.name}`;
    $("#page-title").textContent = pg.name; $("#page-sub").textContent = pg.sub; $("#crumb-page").textContent = pg.name;
    document.body.dataset.page = T.page();   // lets a page change the layout (the Assessment plan hides the side menu on medium windows)
    $$(".nav a[data-page]").forEach((a) => { const on = a.dataset.page === T.page(); a.classList.toggle("on", on); a.toggleAttribute("aria-current", on); });
    $("#jump").innerHTML = pg.jump.map(([id, l]) => `<a href="#" data-to="${id}">${esc(l)}</a>`).join("");
    $$("#jump a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const t = document.getElementById(a.dataset.to); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  }

  function renderPicker() {
    const setup = T.page() === "course-setup";
    const cur = T.current() === NEW && !setup ? null : T.current();
    const opts = codes().map((c) => `<option value="${esc(c)}" ${c === cur ? "selected" : ""}>${esc(S.courseLabel(c, true))}</option>`).join("");
    $("#picker").innerHTML = `
      <label class="picker-lbl" for="course-pick">Course</label>
      <div class="picker-row">
        <select id="course-pick" class="${cur ? "chosen" : ""}">
          <option value="" ${cur ? "" : "selected"} disabled>${setup ? "Choose a course, or add a new one" : "Choose a course"}</option>
          ${opts}
          ${setup ? `<option value="${NEW}" ${cur === NEW ? "selected" : ""}>+ Add new course</option>` : ""}
        </select>
        ${setup ? '<button class="btn primary" id="btn-new">+ New course</button>' : ""}
      </div>`;
    $("#course-pick").onchange = (e) => openCourse(e.target.value);
    const bn = $("#btn-new"); if (bn) bn.onclick = () => openCourse(NEW);
  }
  function openCourse(k) {
    S.ui.current = k || null; S.saveUi();
    renderAll();
    window.scrollTo({ top: 0 });
  }
  T.openCourse = openCourse;

  function renderAll() {
    renderShell();
    renderPicker();
    const cur = T.current();
    const valid = cur && (cur === NEW || codes().includes(cur));
    if (cur && !valid) { S.ui.current = null; S.saveUi(); }
    const c = valid ? cur : null;
    const slo = T.page() === "lectures-slos" || T.page() === "assessment-plan";
    $("#crumb-course").textContent = c && c !== NEW ? S.courseLabel(c) : (c === NEW && !slo ? "New course" : "");
    $("#jump").hidden = !(c && c !== NEW);
    if (T.page() === "assessment-plan") { T.renderPlanPage(c === NEW ? null : c); return; }
    if (slo) { T.renderSloPage(c === NEW ? null : c); return; }
    if (!c) {
      $("#content").innerHTML = `<div class="empty-state"><div class="empty-icon">📘</div>
        <h3>${codes().length ? "Choose the course you want to work on" : "No courses yet"}</h3>
        <p>${codes().length ? "Pick it in the Course box above, or add a new one." : "Add your first course, or open your TAMA data file under <b>Your data</b>."}</p>
        <div class="row-btns"><button class="btn primary" data-act="new">+ Add new course</button>
        <button class="btn" data-act="sample">Try it with sample data</button></div></div>`;
      $("[data-act=new]").onclick = () => openCourse(NEW);
      const sb = $("[data-act=sample]"); if (sb) sb.onclick = loadSample;
      return;
    }
    if (c === NEW) { $("#content").innerHTML = `<section class="card" id="sec-new"></section>`; T.sections.newCourse(); return; }
    $("#content").innerHTML = `
      <section class="card" id="sec-details"></section>
      <section class="card" id="sec-plos"></section>
      <section class="card" id="sec-clos"></section>
      <section class="card" id="sec-add"></section>
      <section class="card" id="sec-slos"></section>`;
    T.refresh("details", "plos", "clos", "add", "slos");
  }
  T.renderAll = renderAll;

  /* ---------------------------------------------------------------- course details boxes */
  const LAYOUT = [
    [["department", "Department", "combo"], ["course_code", "Course code", "code"], ["course_name", "Course name", "text"]],
    [["term", "Term / semester", "term"], ["year", "Academic year", "combo"], ["course_director", "Course director name", "combo"]],
    [["program", "Program", "combo", T.PROGRAM_CHOICES, "Choose or type the program"], ["faculty", "Faculty", "combo"], ["institution", "Institution", "combo"]],
    [["instructor", "Instructor/s teaching the course", "combo", [], "Several? Separate the names with commas"], ["location", "Location (main / branch)", "combo", T.LOCATION_CHOICES, "Choose or type the location"], ["sections", "Number of sections", "text"]],
    [["prerequisites", "Pre-requisite(s)", "text", [], "e.g. None, or the course codes"], ["corequisites", "Co-requisite(s)", "text", [], "e.g. None"]],
    [["credit_hours", "Credit hours", "text", [], "e.g. 3"], ["course_type", "Course type", "pick", T.COURSE_TYPES], ["course_req", "Required or elective", "pick", T.COURSE_REQ], ["level", "Level / year offered", "text", [], "e.g. Level 3 / Year 2"]],
    [["description", "Course general description", "area"]],
  ];
  function detailsGrid(vals, o) {
    return LAYOUT.map((row) => `<div class="grid g${row.length}">` + row.map(([k, label, kind, base, ph]) => {
      const copied = o.copied && o.copied.has(k);
      if (kind === "term") return T.select({ k, label, value: T.normTerm(vals[k]), options: T.TERMS, placeholder: "Select a term", copied });
      if (kind === "pick") return T.select({ k, label, value: vals[k], options: base.map((x) => [x, x || "(choose)"]), copied });
      if (kind === "code") return T.field({ k, label, value: o.isNew ? vals[k] : T.baseCode(vals[k]), req: o.isNew, locked: !o.isNew, copied,
        placeholder: "e.g. DENT 301", help: o.isNew ? "Written in capitals with a space before the numbers, e.g. dent301 becomes DENT 301." : "The course code links all of this course's data, so it cannot be changed here." });
      return T.field({ k, label, value: vals[k], copied, textarea: kind === "area", rows: 3, placeholder: ph || (kind === "combo" ? "Choose or type" : ""),
        options: kind === "combo" ? S.fieldOptions(k, base || []) : null });
    }).join("") + `</div>`).join("");
  }
  function tidy(el) {   // on leaving a box: trim, capital first letter, course code format
    if (el.tagName === "SELECT") return el.value;
    let v = el.value;
    if (el.dataset.k === "course_code") v = T.fmtCourseCode(v);
    else v = T.cap1(v.trim(), el.dataset.label);
    if (v !== el.value) el.value = v;
    T.markFilled(el);
    return v;
  }

  T.sections.details = function () {
    const sel = T.current(), cur = S.courseInfo(sel);
    if (!cur) return;
    // a box that is still empty starts with the remembered Department / Faculty / Institution (saved straight away)
    const dd = S.lastCourseDefaults(); let filledDefaults = false;
    T.SHARED_COURSE_FIELDS.forEach((k) => { if (!T.s(cur[k]).trim() && dd[k]) { cur[k] = dd[k]; filledDefaults = true; } });
    if (filledDefaults) S.saveSoon();
    const el = $("#sec-details");
    el.innerHTML = `<div class="sec-head" id="h-details"><div><h2>Course details</h2><p class="sub">Used in the Course Specification and the other documents. Everything you type saves itself.</p></div></div>
      ${detailsGrid(cur, { isNew: false })}
      <div class="row-btns between">
        <button class="btn ghost" id="same-all">Use this Department, Faculty and Institution for all my courses</button>
        <details class="danger-zone"><summary>Delete ${esc(T.baseCode(sel))}</summary>
          <p class="warn-text">This deletes ${esc(S.courseLabel(sel))} with its PLOs, CLOs, SLOs and exam details. It cannot be undone.</p>
          <label class="tick"><input type="checkbox" id="del-ok"> Yes, delete ${esc(T.baseCode(sel))}</label>
          <button class="btn" id="del-go" disabled>Delete ${esc(T.baseCode(sel))}</button></details>
      </div>`;
    $$("[data-k]", el).forEach((f) => {
      if (f.tagName === "TEXTAREA") T.autoGrow(f);
      const write = () => { cur[f.dataset.k] = f.tagName === "SELECT" ? f.value : f.value.trim(); T.markFilled(f); S.saveSoon(); };
      f.addEventListener("input", () => { write(); if (f.tagName === "TEXTAREA") T.autoGrow(f); });
      f.addEventListener("change", () => {
        cur[f.dataset.k] = tidy(f);
        S.rememberDefaults({ [f.dataset.k]: cur[f.dataset.k] });
        S.rememberFields({ [f.dataset.k]: cur[f.dataset.k] });
        S.save();
        if (["course_name", "term", "year"].includes(f.dataset.k)) { renderPicker(); $("#crumb-course").textContent = S.courseLabel(sel); }
      });
    });
    $("#same-all").onclick = () => {
      S.t("courses").forEach((r) => { T.SHARED_COURSE_FIELDS.forEach((k) => { r[k] = T.s(cur[k]).trim(); }); });
      S.rememberDefaults(cur); S.save();
      T.toast("Department, Faculty and Institution are now the same for all your courses.");
    };
    $("#del-ok").onchange = (e) => { $("#del-go").disabled = !e.target.checked; };
    $("#del-go").onclick = () => {
      const lbl = S.courseLabel(sel);
      T.links.deleteCourse(sel); S.save();
      T.toast(`${lbl} deleted.`);
      openCourse(null);
    };
  };

  /* ---------------------------------------------------------------- new course */
  T.sections.newCourse = function () {
    const el = $("#sec-new");
    const all = codes();
    const d = (S.ui.newDraft = S.ui.newDraft || { src: "", vals: {} });
    if (d.src && !all.includes(d.src)) d.src = "";
    const src = d.src ? S.courseInfo(d.src) : null;
    const COPY_KEYS = ["department", "course_code", "course_name", "course_director", "program", "faculty", "institution", "prerequisites", "corequisites", "credit_hours", "course_type", "course_req", "level", "description"];
    const dd = S.lastCourseDefaults();
    const vals = {}, copied = new Set();
    T.COURSE_COLS.forEach((k) => {
      let v = "";
      if (src && COPY_KEYS.includes(k) && T.s(src[k]).trim()) { v = k === "course_code" ? T.baseCode(src[k]) : T.s(src[k]).trim(); copied.add(k); }
      else if (T.SHARED_COURSE_FIELDS.includes(k)) v = dd[k] || "";
      vals[k] = k in d.vals ? d.vals[k] : v;   // what was typed before is kept, even after a reload
    });
    el.innerHTML = `<div class="sec-head"><div><h2>New course</h2><p class="sub">Fill in what you know now; you can change everything later.</p></div></div>
      ${all.length ? `<div class="copy-box"><div><b>Teaching a course again?</b> Copy it from an earlier term so you do not type it again.</div>
        ${T.select({ id: "copy-src", label: "Copy PLOs, CLOs and SLOs from", value: d.src, options: [["", "(Do not copy: start empty)"], ...all.map((c) => [c, S.courseLabel(c, true)])] })}
        ${src ? `<p class="note">The boxes with a <b>bold frame</b> were filled from ${esc(S.courseLabel(d.src))}. Change anything you need, then choose the term and academic year. Its PLOs, CLOs and SLOs are copied when you create the course.</p>` : ""}</div>` : ""}
      ${detailsGrid(vals, { isNew: true, copied })}
      <p class="note">Boxes marked with <b class="req">*</b> are required. What you type here is kept while you work, even if you close the page.</p>
      <div class="row-btns end"><button class="btn" id="new-cancel">Cancel</button><button class="btn primary" id="new-save">Create course</button></div>
      <p class="warn-text" id="new-msg" hidden></p>`;
    $$("[data-k]", el).forEach((f) => {
      if (f.tagName === "TEXTAREA") T.autoGrow(f);
      const keep = () => { d.vals[f.dataset.k] = f.value; T.markFilled(f); S.saveUi(); };
      f.addEventListener("input", keep);
      f.addEventListener("change", () => { tidy(f); keep(); });
    });
    const cs = $("#copy-src");
    if (cs) cs.onchange = () => { S.ui.newDraft = { src: cs.value, vals: {} }; S.saveUi(); T.sections.newCourse(); };
    $("#new-cancel").onclick = () => { S.ui.newDraft = null; openCourse(null); };
    $("#new-save").onclick = () => {
      const v = {}; $$("[data-k]", el).forEach((f) => { v[f.dataset.k] = tidy(f); });
      const msg = $("#new-msg");
      const code = T.fmtCourseCode(v.course_code);
      if (!code) { msg.hidden = false; msg.textContent = "Course code is required."; return; }
      const term = T.normTerm(v.term), year = T.s(v.year).trim();
      if (all.some((x) => T.baseCode(x).toUpperCase() === code.toUpperCase() && T.normTerm(S.courseInfo(x).term) === term && T.s(S.courseInfo(x).year).trim() === year)) {
        msg.hidden = false;
        msg.textContent = `${[code, T.termLabel(term), year].filter(Boolean).join(" – ")} already exists. Choose another term or academic year, or choose that course in the Course box above to edit it.`;
        return;
      }
      const key = T.newCourseKey(code, all);
      const row = {}; T.COURSE_COLS.forEach((k) => { row[k] = T.s(v[k]).trim(); });
      row.course_code = key; row.term = term; row.report_date = "";
      S.t("courses").push(row);
      const copiedN = d.src ? T.links.copyOutcomes(d.src, key) : null;
      S.rememberDefaults(v);
      S.rememberFields(v);
      S.save();
      T.toast(copiedN ? `${S.courseLabel(key)} saved, with ${copiedN.plos} PLOs, ${copiedN.clos} CLOs and ${copiedN.slos} SLOs copied from ${S.courseLabel(d.src)}. You can edit them here and on Lectures & SLOs.`
        : `${S.courseLabel(key)} saved. You can now add its PLOs and CLOs.`);
      S.ui.newDraft = null;
      openCourse(key);
    };
  };

  /* ---------------------------------------------------------------- Your data panel */
  T.renderDataPanel = function () {
    const p = $("#data-body"); if (!p) return;
    const n = codes().length;
    const fname = S.folderName();
    p.innerHTML = `
      <p>Your data stays on this computer: in this browser, and (if you choose one) in a folder of your own. Nothing is sent anywhere.
      This trial keeps its data apart from the real TAMA.</p>
      <div class="panel-box"><b>${n} course${n === 1 ? "" : "s"}</b> in this trial.</div>
      <h4>Folder copy</h4>
      ${!S.folderSupported() ? `<p class="note">Your browser cannot keep a folder copy (this needs Chrome or Edge). Use “Download a backup” instead.</p>`
        : fname ? `<p>A copy is kept in <b>${esc(fname)}</b> as <code>app_data_TRIAL.json</code>, with backups in <code>app_data_backups</code>.</p><button class="btn" data-a="pick">Choose another folder</button>`
        : S.pendingHandle ? `<p>Allow the folder copy again for this visit.</p><button class="btn primary" data-a="reconnect">Allow the folder copy</button>`
        : `<p>Pick a folder once and every change is also copied there.</p><button class="btn primary" data-a="pick">Choose a folder</button>`}
      <h4>Open my TAMA data</h4>
      <p class="note">Open your <code>app_data.json</code> (or a TAMA backup file) to try this page with your real courses. Your TAMA file itself is not changed.</p>
      <label class="btn file-btn">Open a TAMA file…<input type="file" accept=".json,application/json" data-a="open" hidden></label>
      <h4>Backup</h4>
      <button class="btn" data-a="backup">Download a backup (.json)</button>
      <button class="btn" data-a="sample">Load sample data</button>
      <h4>Start again</h4>
      <details class="danger-zone"><summary>Clear all trial data</summary><p class="warn-text">This removes every course in this trial from this browser. It cannot be undone.</p>
      <label class="tick"><input type="checkbox" data-a="clr-ok"> Yes, clear the trial data</label> <button class="btn" data-a="clear" disabled>Clear</button></details>`;
    const on = (a, ev, fn) => { const b = p.querySelector(`[data-a=${a}]`); if (b) b.addEventListener(ev, fn); };
    on("pick", "click", () => S.pickFolder());
    on("reconnect", "click", () => S.reconnectFolder());
    on("backup", "click", () => S.downloadBackup());
    on("sample", "click", () => { loadSample(); closePanel(); });
    on("open", "change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (await S.importFile(f)) { T.toast(`${codes().length} course(s) opened from ${f.name}.`); S.ui.current = null; S.saveUi(); closePanel(); renderAll(); }
    });
    on("clr-ok", "change", (e) => { p.querySelector("[data-a=clear]").disabled = !e.target.checked; });
    on("clear", "click", () => { S.clearAll(); S.ui = {}; S.saveUi(); closePanel(); renderAll(); T.toast("Trial data cleared."); });
  };
  const openPanel = () => { T.renderDataPanel(); $("#data-panel").hidden = false; document.body.classList.add("panel-open"); };
  const closePanel = () => { $("#data-panel").hidden = true; document.body.classList.remove("panel-open"); };

  function loadSample() {
    const k = T.newCourseKey("DPHE 858", codes());
    const c = {}; T.COURSE_COLS.forEach((x) => { c[x] = ""; });
    Object.assign(c, { course_code: k, course_name: "Research methods", department: "Dental public health", term: "Second", year: "2026",
      program: "Master", faculty: "Faculty of Dentistry", institution: "King Abdulaziz University", course_director: "Course director", credit_hours: "2", course_type: "Department", course_req: "Required", level: "Level 2" });
    S.t("courses").push(c);
    [["K1", "Demonstrate knowledge of research designs used in dental public health."], ["S1", "Critically appraise published research."], ["S2", "Analyse data with suitable statistical methods."], ["V1", "Act ethically when doing research."]]
      .forEach(([id, t]) => S.t("plos").push({ course_code: k, plo_id: id, plo_text: t }));
    [["CLO1", "K", "Describe the main research designs and their uses.", "K1"], ["CLO2", "S", "Appraise the quality of a published study.", "S1"], ["CLO3", "S", "Choose and run a suitable statistical test.", "S2"], ["CLO4", "V", "Apply research ethics to a study proposal.", "V1"]]
      .forEach(([id, dm, t, p]) => S.t("clos").push({ course_code: k, clo_id: id, clo_text: t, domain: dm, plo_1: p, plo_2: "", plo_3: "", target_pct: 70, kpi_threshold: 60 }));
    [["Lecture 1", "SLO1", "List the types of study design.", "K", "CLO1"], ["Lecture 1", "SLO2", "Explain bias and confounding.", "K", "CLO1"], ["Lecture 2", "SLO3", "Use a checklist to appraise a trial.", "S:Cog.", "CLO2"],
      ["Lecture 3", "SLO4", "Run a chi-square test in software.", "S:IT-N", "CLO3"], ["Lecture 4", "SLO5", "Write an informed consent form.", "V", "CLO4"], ["Lecture 4", "SLO6", "Discuss ethics approval steps.", "V", ""]]
      .forEach(([tp, id, t, dm, cl]) => S.t("slos").push({ course_code: k, week: "Week " + tp.slice(-1), topic: tp, slo_id: id, slo_text: t, domain: dm, clo_id: cl, assessment_methods: "", target_kpi: 70 }));
    // a small assessment plan, so the Assessment plan page has something to show
    S.data.extra_methods = S.data.extra_methods || {}; S.data.extra_methods[k] = ["Presentations"];
    S.data.tables.clo_plan = (S.data.tables.clo_plan || []).filter((r) => r.course_code !== k);
    [["CLO1", "Midterm exam, Final exam"], ["CLO2", "Final exam"], ["CLO3", "Midterm exam, Final exam"], ["CLO4", "Presentations"]].forEach(([c, m]) => S.data.tables.clo_plan.push({ course_code: k, clo_id: c, assessment_methods: m }));
    S.data.course_report = S.data.course_report || {};
    S.data.course_report[k] = Object.assign(S.data.course_report[k] || {}, { grading_cfg: { total: "100", mode: "Marks" },
      grading: [{ Assessment: "Midterm exam", Method: "Test-based assessment", Type: "Test-based", Mark: "30", Weight: "30%", "Due date": "Week 7" }, { Assessment: "Presentations", Method: "Presentations", Type: "Performance-based", Mark: "20", Weight: "20%", "Due date": "Week 10" },
        { Assessment: "Final exam", Method: "Test-based assessment", Type: "Test-based", Mark: "50", Weight: "50%", "Due date": "Week 15" }],
      formative: [{ Assessment: "One-minute paper", Description: "Students write the main point and the muddiest point of the lecture.", Timing: "Every lecture" }] });
    S.save(); T.toast("Sample course DPHE 858 added."); openCourse(k);
  }

  /* ---------------------------------------------------------------- start */
  document.addEventListener("DOMContentLoaded", async () => {
    S.load();
    await S.restoreFolder();
    $("#btn-data").onclick = openPanel;
    $("#data-close").onclick = closePanel;
    $("#data-panel").addEventListener("click", (e) => { if (e.target.id === "data-panel") closePanel(); });
    $("#menu-btn").onclick = () => document.body.classList.toggle("nav-open");
    window.addEventListener("hashchange", () => { document.body.classList.remove("nav-open"); renderAll(); window.scrollTo({ top: 0 }); });
    renderAll();
    S.mark(codes().length ? "All changes saved" : "Nothing to save yet");
    window.addEventListener("beforeunload", () => S.save());
  });
})();
