/* The top of the exam paper, laid out by the user (Dania 2026-11-19): logos (left / middle / right, small / medium / large),
   title lines in any order (size, bold, colour, alignment), colours of the title and the section bars, and the information
   boxes in any order (student name, ID, time, marks, date and the user's own lines), in 1 to 3 columns.
   Saved in the data file:
     paper_layout[course or "*"] = { logos: [{ img, pos, size }], lines: [{ t, sz, b, c }], align, main, bar }
     paper_info["course||exam"]  = { items: [{ k, l, v }], cols, instructions, instrPos }   (k: name | id | time | marks | date | x)
   Used by the HTML / PDF paper (questions.js) and the built-in Word template (papertpl.js). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$;
  const dict = (k) => (S.data[k] && typeof S.data[k] === "object" && !Array.isArray(S.data[k]) ? S.data[k] : (S.data[k] = {}));
  const pick = (k, sel) => { const m = S.data[k] || {}; return m[sel] ? [sel, m[sel]] : m["*"] ? ["*", m["*"]] : [null, null]; };
  const AR = /[؀-ۿ]/;
  const DEF_LINES = () => [{ t: "{{DEPARTMENT}}", sz: "l", b: true, c: "main" }, { t: "{{COURSE_CODE}} - {{COURSE_NAME}}", sz: "m", b: true, c: "black" }, { t: "{{EXAM}} - {{TERM}} {{YEAR}}", sz: "s", b: false, c: "grey" }];
  const DEF = () => ({ logos: [], lines: DEF_LINES(), align: "center", main: "#14365d", bar: "#14365d" });
  const SZ = { l: [20, 32], m: [15, 24], s: [12.5, 20] };          // [HTML px, Word half-points]
  const LOGO = { s: [48, 1.3], m: [72, 2], l: [100, 2.8] };        // [HTML px height, Word cm height]
  const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(T.s(c)) ? T.s(c) : d);
  const colorOf = (L, c) => (c === "main" ? hex(L.main, "#14365d") : c === "grey" ? "#444444" : "#111111");

  /** The layout of the top of the paper for this course (its own, or the one for all courses, or the default). */
  T.paperLayoutOf = (sel) => { const [k, v] = pick("paper_layout", sel); const L = { ...DEF(), ...(v || {}) }; L.lines = Array.isArray(L.lines) ? L.lines : DEF_LINES(); L.logos = Array.isArray(L.logos) ? L.logos : []; return [k, L]; };
  const fillText = (t, vals) => T.s(t).replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (m, k) => (k.toUpperCase() in vals ? vals[k.toUpperCase()] : m));

  /* ---------------------------------------------------------------- the information boxes */
  const infoKey = (sel, exam) => `${sel}||${exam}`;
  function rawInfo(sel, exam) { return (S.data.paper_info || {})[infoKey(sel, exam)] || {}; }
  function itemsOf(v) {
    if (Array.isArray(v.items)) return v.items.filter((x) => x && typeof x === "object");
    // older entries (date + extra lines) and the default order
    return [{ k: "name", l: "Student name" }, { k: "id", l: "Student ID" }, { k: "time", l: "Time allowed" }, { k: "marks", l: "Total marks" }, { k: "date", l: "Date", v: T.s(v.date) },
      ...(Array.isArray(v.lines) ? v.lines.filter((l) => Array.isArray(l) && T.s(l[0]).trim()).map((l) => ({ k: "x", l: T.s(l[0]), v: T.s(l[1]) })) : [])];
  }
  T.paperInfo = (sel, exam) => { const v = rawInfo(sel, exam), items = itemsOf(v), d = items.find((x) => x.k === "date");
    return { items, date: d ? T.s(d.v) : "", instructions: T.s(v.instructions), instrPos: v.instrPos === "above" ? "above" : "below", cols: [1, 2, 3].includes(+v.cols) ? +v.cols : 2,
      lines: items.filter((x) => x.k === "x" || x.k === "date").map((x) => [T.s(x.l), T.s(x.v)]).filter((l) => T.s(l[0]).trim()) }; };
  /** [label, value] in the user's order; an empty value prints a line for the student to fill in. */
  T.paperInfoCells = (sel, exam, dur, total) => T.paperInfo(sel, exam).items.filter((x) => T.s(x.l).trim()).map((x) => [T.s(x.l).trim(), x.k === "time" ? T.s(dur) : x.k === "marks" ? T.s(total) : T.s(x.v).trim()]);

  /* ---------------------------------------------------------------- HTML: the top of the paper */
  T.paperHeadHtml = (sel, exam, key, vals) => {
    const [, L] = T.paperLayoutOf(sel), side = (p) => L.logos.filter((g) => g.pos === p && g.img);
    const img = (g) => `<img src="${esc(g.img)}" style="height:${LOGO[g.size] ? LOGO[g.size][0] : 72}px;max-width:220px;object-fit:contain" alt="">`;
    const lines = L.lines.filter((l) => T.s(l.t).trim()).map((l, i, a) => `<div style="font-size:${(SZ[l.sz] || SZ.m)[0]}px;font-weight:${l.b ? 700 : 400};color:${colorOf(L, l.c)};line-height:1.3"${AR.test(fillText(l.t, vals)) ? ' dir="auto"' : ""}>${esc(fillText(l.t, vals))}${key && i === a.length - 1 ? '<span class="stamp">ANSWER KEY</span>' : ""}</div>`).join("");
    const left = side("left"), right = side("right"), mid = side("middle");
    return `<table class="hd" style="width:100%;border-collapse:collapse;border-bottom:2px solid ${hex(L.main, "#14365d")};margin-bottom:12px"><tr>
      ${left.length || right.length ? `<td style="width:1%;white-space:nowrap;vertical-align:middle;padding:0 10px 8px 0">${left.map(img).join(" ")}</td>` : ""}
      <td style="text-align:${["left", "right"].includes(L.align) ? L.align : "center"};vertical-align:middle;padding:0 0 8px">${mid.length ? `<div style="margin-bottom:4px">${mid.map(img).join(" ")}</div>` : ""}${lines}${key && !lines ? '<span class="stamp">ANSWER KEY</span>' : ""}</td>
      ${left.length || right.length ? `<td style="width:1%;white-space:nowrap;vertical-align:middle;padding:0 0 8px 10px;text-align:right">${right.map(img).join(" ")}</td>` : ""}</tr></table>`;
  };
  T.paperCss = (sel) => { const [, L] = T.paperLayoutOf(sel); return `.sec{background:${hex(L.bar, "#14365d")}!important}`; };

  /* ---------------------------------------------------------------- Word: the top of the paper */
  T.paperHeadXml = async (sel, exam, key, vals, W) => {   // W = the Word helpers of papertpl.js
    const [, L] = T.paperLayoutOf(sel), side = (p) => L.logos.filter((g) => g.pos === p && g.img), jc = ["left", "right"].includes(L.align) ? L.align : "center";
    const pics = async (list, j) => { let r = ""; for (const g of list) r += await W.addPic(g.img, 6, (LOGO[g.size] || LOGO.m)[1]) + W.run(" "); return r ? W.para(r, { jc: j, after: 40 }) : ""; };
    const textLines = L.lines.filter((l) => T.s(l.t).trim()), linesXml = textLines.map((l, i) => W.para(W.run(fillText(l.t, vals), { b: !!l.b, sz: (SZ[l.sz] || SZ.m)[1], color: colorOf(L, l.c).slice(1) }) + (key && i === textLines.length - 1 ? W.run("   ANSWER KEY", { b: true, color: "0B6B3A", sz: 20 }) : ""), { jc, after: 0, bidi: AR.test(fillText(l.t, vals)) })).join("");
    const left = side("left"), right = side("right"), mid = await pics(side("middle"), jc);
    const center = mid + (linesXml || W.para(key ? W.run("ANSWER KEY", { b: true, color: "0B6B3A" }) : "", { jc }));
    const line = W.para("", { lineColor: hex(L.main, "#14365d").slice(1), after: 120 });
    if (!left.length && !right.length) return center + line;
    const cell = (w, x) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${x || "<w:p/>"}</w:tc>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="9900" w:type="dxa"/><w:tblBorders>${W.NIL}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="2200"/><w:gridCol w:w="5500"/><w:gridCol w:w="2200"/></w:tblGrid><w:tr>${cell(2200, await pics(left, "left"))}${cell(5500, center)}${cell(2200, await pics(right, "right"))}</w:tr></w:tbl>${line}`;
  };

  /* ---------------------------------------------------------------- the boxes in "Print the exam" */
  const SIZES = [["s", "Small"], ["m", "Medium"], ["l", "Large"]], POS = [["left", "Left"], ["middle", "Middle"], ["right", "Right"]];
  const seg = (attr, i, list, cur) => `<span class="seg mini">${list.map(([v, l]) => `<button class="${cur === v ? "on" : ""}" ${attr}="${i}" data-v="${v}">${l}</button>`).join("")}</span>`;
  T.paperLayoutHtml = function (sel) {
    const [k, L] = T.paperLayoutOf(sel);
    const where = k === "*" ? "*" : k ? "course" : (S.ui.tplScope === "*" ? "*" : "course");
    return `<details class="sum-box pl-box" id="pl-box" ${S.ui.plOpen ? "open" : ""}><summary>Design the top of the paper (logos, title lines, colours)</summary>
      <div class="pl-sec"><h5>Logos</h5>
        ${L.logos.map((g, i) => `<div class="pl-row logo"><img src="${esc(g.img)}" alt="">${seg("data-lgpos", i, POS, g.pos)}${seg("data-lgsz", i, SIZES, g.size)}<button class="btn sm" data-lgx="${i}" title="Remove this logo">✕</button></div>`).join("") || `<p class="note">No logo yet.</p>`}
        <div class="row-btns"><label class="btn sm"><input type="file" id="pl-logo" accept="image/png,image/jpeg" hidden>+ Add a logo</label><span class="muted">PNG or JPG. Add a second one for the other side if you need it.</span></div></div>
      <div class="pl-sec"><h5>Title lines <span class="muted">(top to bottom; use ↑ ↓ to change the order)</span></h5>
        ${L.lines.map((l, i) => `<div class="pl-row"><input type="text" class="cell filled" data-lnt="${i}" data-ref="lnt:${i}" value="${esc(l.t)}" placeholder="Text, e.g. {{DEPARTMENT}} or Final examination">
          <select class="cell filled" data-lnsz="${i}">${SIZES.map(([v, t]) => `<option value="${v}" ${l.sz === v ? "selected" : ""}>${t}</option>`).join("")}</select>
          <select class="cell filled" data-lnc="${i}">${[["main", "Title colour"], ["black", "Black"], ["grey", "Grey"]].map(([v, t]) => `<option value="${v}" ${(l.c || "black") === v ? "selected" : ""}>${t}</option>`).join("")}</select>
          <label class="tick-line"><input type="checkbox" data-lnb="${i}" ${l.b ? "checked" : ""}> Bold</label>
          <span class="pl-mv"><button class="btn sm" data-lnup="${i}" ${i ? "" : "disabled"} title="Move up">↑</button><button class="btn sm" data-lndn="${i}" ${i < L.lines.length - 1 ? "" : "disabled"} title="Move down">↓</button><button class="btn sm" data-lnx="${i}" title="Remove">✕</button></span></div>`).join("")}
        <div class="row-btns"><button class="btn sm" id="pl-addline">+ Add a line</button><span class="fld"><span class="lbl">Text alignment</span>${seg("data-plalign", 0, [["left", "Left"], ["center", "Middle"], ["right", "Right"]], L.align)}</span></div>
        <p class="note">You can type any text, and these words are filled in: {{DEPARTMENT}} {{FACULTY}} {{INSTITUTION}} {{COURSE_CODE}} {{COURSE_NAME}} {{EXAM}} {{TERM}} {{YEAR}} {{EXAM_DATE}} {{COURSE_DIRECTOR}}.</p></div>
      <div class="pl-sec"><h5>Colours</h5><div class="row-btns">
        <label class="pl-col"><input type="color" id="pl-main" value="${esc(hex(L.main, "#14365d"))}"> Title colour and line under the header</label>
        <label class="pl-col"><input type="color" id="pl-bar" value="${esc(hex(L.bar, "#14365d"))}"> Section bars (Multiple choice questions ...)</label></div></div>
      <div class="row-btns"><span class="fld"><span class="lbl">Use this design for</span>${seg("data-plscope", 0, [["course", "This course"], ["*", "All courses"]], where)}</span><button class="btn sm" id="pl-reset">Back to the standard design</button></div>
      <p class="note">The design is used in the HTML, PDF and Word papers (the Word file uses it when no Word template is saved).</p></details>`;
  };
  async function logoFrom(file) {
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("The picture could not be read.")); r.readAsDataURL(file); });
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("The picture could not be read.")); i.src = url; });
    const s = Math.min(1, 600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    const png = /png/i.test(file.type), cx = c.getContext("2d"); if (!png) { cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height); } cx.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
  }
  T.paperLayoutWire = function (sel, el) {
    const box = $("#pl-box", el); if (!box) return;
    const redraw = () => T.refresh("bpTab");
    box.ontoggle = () => { S.ui.plOpen = box.open; S.saveUi(); };
    // every change is saved where the design lives (this course or all courses)
    const edit = (f, re) => { const [k0, L] = T.paperLayoutOf(sel), k = k0 || (S.ui.tplScope === "*" ? "*" : String(sel)); f(L); dict("paper_layout")[k] = L; S.save(); if (re !== false) redraw(); };
    const each = (attr, f) => box.querySelectorAll(`[${attr}]`).forEach((x) => f(x, +x.getAttribute(attr)));
    each("data-lgpos", (b, i) => b.onclick = () => edit((L) => { L.logos[i].pos = b.dataset.v; }));
    each("data-lgsz", (b, i) => b.onclick = () => edit((L) => { L.logos[i].size = b.dataset.v; }));
    each("data-lgx", (b, i) => b.onclick = () => edit((L) => { L.logos.splice(i, 1); }));
    each("data-lnt", (x, i) => x.oninput = () => edit((L) => { L.lines[i].t = x.value; }, false));
    each("data-lnsz", (x, i) => x.onchange = () => edit((L) => { L.lines[i].sz = x.value; }));
    each("data-lnc", (x, i) => x.onchange = () => edit((L) => { L.lines[i].c = x.value; }));
    each("data-lnb", (x, i) => x.onchange = () => edit((L) => { L.lines[i].b = x.checked; }));
    each("data-lnup", (b, i) => b.onclick = () => edit((L) => { [L.lines[i - 1], L.lines[i]] = [L.lines[i], L.lines[i - 1]]; }));
    each("data-lndn", (b, i) => b.onclick = () => edit((L) => { [L.lines[i + 1], L.lines[i]] = [L.lines[i], L.lines[i + 1]]; }));
    each("data-lnx", (b, i) => b.onclick = () => edit((L) => { L.lines.splice(i, 1); }));
    $("#pl-addline", box).onclick = () => edit((L) => { L.lines.push({ t: "", sz: "s", b: false, c: "black" }); });
    each("data-plalign", (b) => b.onclick = () => edit((L) => { L.align = b.dataset.v; }));
    $("#pl-main", box).onchange = (e) => edit((L) => { L.main = e.target.value; });
    $("#pl-bar", box).onchange = (e) => edit((L) => { L.bar = e.target.value; });
    $("#pl-logo", box).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
      try { const img = await logoFrom(f); if (img.length > 700000) { T.toast("This logo is too big. Try a smaller picture."); return; }
        edit((L) => { const used = L.logos.map((g) => g.pos); L.logos.push({ img, pos: !used.includes("left") ? "left" : !used.includes("right") ? "right" : "middle", size: "m" }); }); T.toast("Logo added. Choose its place: Left, Middle or Right.");
      } catch (er) { T.toast(er.message); } };
    each("data-plscope", (b) => b.onclick = () => { const want = b.dataset.v === "*" ? "*" : String(sel), [k0, L] = T.paperLayoutOf(sel), m = dict("paper_layout");
      S.ui.tplScope = b.dataset.v === "*" ? "*" : "course"; S.saveUi(); if (k0 && k0 !== want) { m[want] = L; delete m[k0]; S.save(); } redraw(); });
    $("#pl-reset", box).onclick = () => { const [k0] = T.paperLayoutOf(sel); if (k0) { delete dict("paper_layout")[k0]; S.save(); } T.toast("The standard design is back."); redraw(); };
  };

  /* ---------------------------------------------------------------- the information boxes (per exam) */
  const BUILT = { name: "Student name", id: "Student ID", time: "Time allowed", marks: "Total marks", date: "Date" };
  T.paperInfoHtml = function (sel, exam) {
    const i = T.paperInfo(sel, exam);
    return `<div class="sum-box pi-box"><h4>Information at the top of the paper</h4>
      <p class="note">Change the order with ↑ ↓, rename any box, remove what you do not need, or add your own (Group, Section, Hall ...). Time allowed and Total marks are filled in automatically. Leave a value empty to print a line the student fills in. Everything saves itself.</p>
      <div class="pi-lines">${i.items.map((x, n) => `<div class="pi-row"><input type="text" class="cell filled" data-pil="${n}" data-ref="pil:${n}" placeholder="Label" value="${esc(T.s(x.l))}">
        ${x.k === "time" || x.k === "marks" ? `<span class="muted pi-auto">filled in automatically</span>` : x.k === "name" || x.k === "id" ? `<span class="muted pi-auto">the student writes it</span>` : `<input type="text" class="cell ${T.s(x.v) ? "filled" : ""}" data-piv="${n}" data-ref="piv:${n}" placeholder="${x.k === "date" ? "e.g. 15 January 2027" : "Value (empty = a line to fill in)"}" value="${esc(T.s(x.v))}">`}
        <span class="pl-mv"><button class="btn sm" data-piup="${n}" ${n ? "" : "disabled"} title="Move up">↑</button><button class="btn sm" data-pidn="${n}" ${n < i.items.length - 1 ? "" : "disabled"} title="Move down">↓</button><button class="btn sm" data-pix="${n}" title="Remove">✕</button></span></div>`).join("")}</div>
      <div class="row-btns"><button class="btn sm" id="pi-add">+ Add a line</button>${Object.keys(BUILT).filter((k) => !i.items.some((x) => x.k === k)).map((k) => `<button class="btn sm" data-pibk="${k}">+ ${BUILT[k]}</button>`).join("")}
        <span class="fld"><span class="lbl">Boxes per row</span>${seg("data-picols", 0, [["1", "1"], ["2", "2"], ["3", "3"]], String(i.cols))}</span></div>
      ${T.field({ id: "pi-instr", label: "Instructions", textarea: true, rows: 2, value: i.instructions, placeholder: "e.g. Answer ALL the questions. Mobile phones are not allowed." })}
      <div class="fld"><span class="lbl">Print the instructions</span>${seg("data-pipos", 0, [["above", "Above the boxes"], ["below", "Below the boxes"]], i.instrPos)}</div></div>`;
  };
  T.paperInfoWire = function (sel, exam, el) {
    const box = el.querySelector(".pi-box"); if (!box) return;
    const all = dict("paper_info"), k = infoKey(sel, exam), redraw = () => T.refresh("bpTab");
    const cur = () => { const v = (all[k] = all[k] || {}); if (!Array.isArray(v.items)) { v.items = itemsOf(v); delete v.date; delete v.lines; } return v; };
    const each = (attr, f) => box.querySelectorAll(`[${attr}]`).forEach((x) => f(x, +x.getAttribute(attr)));
    each("data-pil", (x, n) => x.oninput = () => { cur().items[n].l = x.value; S.save(); });
    each("data-piv", (x, n) => x.oninput = () => { cur().items[n].v = x.value; T.markFilled(x); S.save(); });
    each("data-piup", (b, n) => b.onclick = () => { const it = cur().items; [it[n - 1], it[n]] = [it[n], it[n - 1]]; S.save(); redraw(); });
    each("data-pidn", (b, n) => b.onclick = () => { const it = cur().items; [it[n + 1], it[n]] = [it[n], it[n + 1]]; S.save(); redraw(); });
    each("data-pix", (b, n) => b.onclick = () => { cur().items.splice(n, 1); S.save(); redraw(); });
    $("#pi-add", box).onclick = () => { cur().items.push({ k: "x", l: "", v: "" }); S.save(); redraw(); };
    box.querySelectorAll("[data-pibk]").forEach((b) => b.onclick = () => { cur().items.push({ k: b.dataset.pibk, l: BUILT[b.dataset.pibk], v: "" }); S.save(); redraw(); });
    each("data-picols", (b) => b.onclick = () => { cur().cols = +b.dataset.v; S.save(); redraw(); });
    each("data-pipos", (b) => b.onclick = () => { cur().instrPos = b.dataset.v; S.save(); redraw(); });
    const ins = $("#pi-instr", box); ins.oninput = () => { cur().instructions = ins.value; T.markFilled(ins); if (T.autoGrow) T.autoGrow(ins); S.save(); };
  };
})();
