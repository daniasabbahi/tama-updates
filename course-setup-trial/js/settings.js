/* Settings (Dania 2026-11-22): "a page I can upload my logo in that it can appear on the page interface, upload any forms I need
   the app to fill for me from the entered data, and stuff I customize in the app".
   Same keys as TAMA's Settings page, so the data file stays compatible:
   ui_settings.logos = [{name, data (PNG, base64)}], ui_settings.logo = the name shown; ui_settings.hero_title, tag, faculty, university;
   ui_settings.forms = [{name, data (base64), map}]. New here: ui_settings.logo_docs (false = no logo in the Word files),
   logos[].w / .h (the picture size). */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const U = () => (S.data.ui_settings = S.data.ui_settings && typeof S.data.ui_settings === "object" ? S.data.ui_settings : {});
  const FORM_MAX = 1500000;   // the data file lives in the browser: keep each form under about 1.5 MB
  const bufToB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const b64ToBlob = (b, type) => new Blob([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], { type: type || "application/octet-stream" });
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const kb = (b64) => Math.round((b64.length * 3) / 4 / 1024);

  const curLogo = () => { const u = U(); return (u.logos || []).find((x) => x.name === u.logo) || null; };
  /** The logo for the Word files, or null. */
  T.settingsLogo = function () { const l = curLogo(); if (!l || U().logo_docs === false) return null; return { b64: l.data, type: "image/png", size: [l.w || 4, l.h || 3] }; };
  /** Shows the logo and the texts of the settings in the side menu and the top bar. */
  T.applyBrand = function () {
    const u = U(), l = curLogo(), box = $(".brand .logo"), sub = $(".brand span"), tag = $(".trial-tag");
    if (box) { box.classList.toggle("has-img", !!l); box.innerHTML = l ? `<img src="data:image/png;base64,${l.data}" alt="">` : "T"; }
    if (sub) sub.textContent = T.s(u.hero_title).trim() || "Academic Assessment Manager";
    if (tag) tag.textContent = T.s(u.tag).trim() || "Trial";
    let tl = $("#top-logo");
    if (!tl) { const cr = $(".top .crumbs"); if (cr) { tl = document.createElement("img"); tl.id = "top-logo"; tl.alt = ""; cr.parentNode.insertBefore(tl, cr); } }
    if (tl) { tl.hidden = !l || u.logo_top === false; if (l) tl.src = `data:image/png;base64,${l.data}`; }
  };

  function readLogo(file) {
    return new Promise((ok, bad) => {
      const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => {
        const k = Math.min(1, 400 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, 0, 0, w, h);
        ok({ name: file.name, data: cv.toDataURL("image/png").split(",")[1], w, h }); };
        im.onerror = () => bad(new Error("not a picture")); im.src = r.result; };
      r.onerror = () => bad(r.error); r.readAsDataURL(file);
    });
  }

  T.sections.setLogo = function () {
    const el = $("#sec-stlogo"); if (!el) return;
    const u = U(), logos = u.logos || [];
    el.innerHTML = `<div class="sec-head" id="h-stlogo"><div><h2>Your logo</h2><p class="sub">Add your faculty or university logo (PNG or JPG). The logo you choose is shown in the side menu and the top bar, and at the top of the Word files TAMA makes.</p></div></div>
      <div class="row-btns"><label class="btn primary">Add a logo<input type="file" id="st-logo" accept="image/png,image/jpeg" multiple hidden></label></div>
      ${logos.length ? `<div class="st-logos">${logos.map((x, i) => `<div class="st-logo ${x.name === u.logo ? "on" : ""}"><button class="st-pick" data-stpick="${i}" title="Show this logo"><img src="data:image/png;base64,${x.data}" alt=""></button>
          <span class="st-nm" title="${esc(x.name)}">${esc(x.name)}</span><span class="row-btns">${x.name === u.logo ? `<span class="ok-text">✓ Shown</span>` : `<button class="btn xs" data-stpick="${i}">Show this one</button>`}<button class="btn xs" data-strm="${i}">Remove</button></span></div>`).join("")}</div>
        <div class="row-btns">${u.logo ? `<button class="btn sm" id="st-nologo">Show no logo</button>` : ""}</div>
        <label class="tick-line"><input type="checkbox" id="st-ltop" ${u.logo_top === false ? "" : "checked"}> Show the logo in the top bar too</label>
        <label class="tick-line"><input type="checkbox" id="st-ldoc" ${u.logo_docs === false ? "" : "checked"}> Put the logo at the top of the Word files TAMA makes (grades report, CLO achievement level ...)</label>
        <p class="note">The official forms (Course Report, Course Specification) keep their own ETEC cover and are not changed.</p>`
        : `<p class="note">No logo yet. The side menu shows the letter T until you add one.</p>`}`;
    const done = (msg) => { S.save(); T.applyBrand(); T.refresh("setLogo"); if (msg) T.toast(msg); };
    $("#st-logo", el).onchange = async (e) => {
      const files = [...e.target.files]; let list = (u.logos || []).slice(), bad = [];
      for (const f of files) { try { const l = await readLogo(f); list = list.filter((x) => x.name !== l.name).concat([l]); } catch (er) { bad.push(f.name); } }
      u.logos = list; if ((!u.logo || !list.some((x) => x.name === u.logo)) && list.length) u.logo = list[list.length - 1].name;
      done(bad.length ? `Could not read ${bad.join(", ")} as a picture.` : "Logo saved and shown.");
    };
    $$("[data-stpick]", el).forEach((b) => b.onclick = () => { u.logo = logos[+b.dataset.stpick].name; done(); });
    $$("[data-strm]", el).forEach((b) => b.onclick = () => { const x = logos[+b.dataset.strm]; u.logos = logos.filter((y) => y !== x); if (u.logo === x.name) u.logo = ""; done(); });
    const nl = $("#st-nologo", el); if (nl) nl.onclick = () => { u.logo = ""; done(); };
    const lt = $("#st-ltop", el); if (lt) lt.onchange = () => { u.logo_top = lt.checked; done(); };
    const ld = $("#st-ldoc", el); if (ld) ld.onchange = () => { u.logo_docs = ld.checked; done(); };
  };

  T.sections.setNames = function () {
    const el = $("#sec-stnames"); if (!el) return;
    const u = U(), dflt = S.lastCourseDefaults ? S.lastCourseDefaults() : {};
    const fac = T.s(u.faculty).trim() || T.s(dflt.faculty), uni = T.s(u.university).trim() || T.s(dflt.institution);
    const fld = (id, k, l, v, ph) => `<label class="fld ${T.s(v).trim() ? "filled" : ""}" for="${id}"><span class="lbl">${l}</span><input type="text" id="${id}" data-stk="${k}" value="${esc(v)}" placeholder="${esc(ph || "")}"></label>`;
    el.innerHTML = `<div class="sec-head" id="h-stnames"><div><h2>Names and texts</h2><p class="sub">Your faculty and university are filled in for every new course. The other two texts change what the side menu and the top bar say.</p></div></div>
      <div class="grid g2">${fld("st-fac", "faculty", "Faculty / college", fac, "e.g. Faculty of Public Health")}${fld("st-uni", "university", "University / institution", uni, "e.g. King Abdulaziz University")}
        ${fld("st-hero", "hero_title", "Text under TAMA in the side menu", u.hero_title, "Academic Assessment Manager")}${fld("st-tag", "tag", "Small badge in the top bar", u.tag, "Trial")}</div>
      <p class="note">Everything saves itself. Clear a box to go back to the usual text.</p>`;
    $$("[data-stk]", el).forEach((x) => {
      x.oninput = () => { u[x.dataset.stk] = x.value; T.markFilled && T.markFilled(x); T.applyBrand(); S.saveSoon(); };
      x.onchange = () => {
        const k = x.dataset.stk, v = x.value.trim(); u[k] = v;
        if (k === "faculty" && v && S.rememberDefaults) S.rememberDefaults({ faculty: v });
        if (k === "university" && v && S.rememberDefaults) S.rememberDefaults({ institution: v });
        S.save(); T.applyBrand();
      };
    });
  };

  T.sections.setForms = function () {
    const el = $("#sec-stforms"); if (!el) return;
    const u = U(), forms = u.forms || [];
    const ic = (n) => (/\.pdf$/i.test(n) ? "📕" : /\.xls[xm]?$/i.test(n) ? "📗" : "📘");
    el.innerHTML = `<div class="sec-head" id="h-stforms"><div><h2>Forms and templates</h2><p class="sub">Keep the forms you fill in often (Word, Excel or PDF). TAMA can fill your Word and Excel forms with the course data: on the <a href="#export-reports">Export reports</a> page choose the form and the course, check what goes where, and download it filled.</p></div></div>
      <h3 class="qm-h">Built into TAMA</h3>
      <div class="st-forms">
        <div class="st-form"><span>📘 Course Report TP-154 (blank).docx</span><button class="btn xs" data-stbi="0">⬇ Download</button></div>
        <div class="st-form"><span>📘 Course Report TPG-154 Postgraduate (blank).docx</span><button class="btn xs" data-stbi="1">⬇ Download</button></div></div>
      <h3 class="qm-h">Your own forms</h3>
      <div class="row-btns"><label class="btn primary">Add a form<input type="file" id="st-form" accept=".docx,.xlsx,.xlsm,.pdf" multiple hidden></label></div>
      <p class="note">How to make a form TAMA can fill: in Word or Excel, write the label with a colon and leave the space after it empty (for example <b>Course code:</b>), or put words in double curly brackets where the data goes, such as <b>{{course_code}}</b>, <b>{{course_name}}</b>, <b>{{instructor}}</b>, <b>{{pass_percent}}</b>. Each form must be under 1.5 MB.</p>
      ${forms.length ? `<div class="st-forms">${forms.map((x, i) => `<div class="st-form"><span>${ic(x.name)} ${esc(x.name)} <span class="note">(${kb(x.data)} KB${x.map && Object.keys(x.map).length ? `, ${Object.keys(x.map).length} places matched` : ""})</span></span>
          <span class="row-btns">${/\.(docx|xlsx|xlsm)$/i.test(x.name) ? `<a class="btn xs primary" href="#export-reports" data-stfill="${i}">Fill it</a>` : ""}<button class="btn xs" data-stdl="${i}">⬇ Download</button><button class="btn xs" data-stfrm="${i}">Remove</button></span></div>`).join("")}</div>`
        : `<p class="note">No forms of your own yet.</p>`}`;
    $$("[data-stbi]", el).forEach((b) => b.onclick = async () => {
      const pg = b.dataset.stbi === "1";
      try {
        const buf = await (await fetch("assets/tp154.docx")).arrayBuffer();
        if (!pg) { dl(new Blob([buf]), "Course Report TP-154 (blank).docx"); return; }
        await T.importer.lib("jszip"); const z = await JSZip.loadAsync(buf), cover = await (await fetch("assets/tpg154_cover.jpg")).arrayBuffer();
        const rels = await z.file("word/_rels/document.xml.rels").async("string"), doc = await z.file("word/document.xml").async("string");
        const rid = (doc.match(/<w:headerReference[^>]*w:type="first"[^>]*r:id="([^"]+)"/) || doc.match(/<w:headerReference[^>]*r:id="([^"]+)"[^>]*w:type="first"/) || [])[1];
        const hm = rid && (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)));
        if (hm) { const hr = await z.file(`word/_rels/${hm[1]}.rels`).async("string"), im = hr.match(/Target="(media\/[^"]+)"/); if (im) z.file(`word/${im[1]}`, cover); }
        dl(await z.generateAsync({ type: "blob" }), "Course Report TPG-154 Postgraduate (blank).docx");
      } catch (e) { T.toast(`The file could not be made (${e.message || e}).`, "warn"); }
    });
    $("#st-form", el).onchange = async (e) => {
      let list = (u.forms || []).slice(); const big = [];
      for (const f of e.target.files) {
        if (f.size > FORM_MAX) { big.push(f.name); continue; }
        const data = bufToB64(new Uint8Array(await f.arrayBuffer())), old = list.find((x) => x.name === f.name) || {};
        list = list.filter((x) => x.name !== f.name).concat([{ name: f.name, data, map: old.map || {} }]);
      }
      u.forms = list; S.save(); T.refresh("setForms");
      T.toast(big.length ? `Not added (larger than 1.5 MB): ${big.join(", ")}.` : "Form saved.", big.length ? "warn" : undefined);
    };
    $$("[data-stdl]", el).forEach((b) => b.onclick = () => { const x = forms[+b.dataset.stdl]; dl(b64ToBlob(x.data), x.name); });
    $$("[data-stfrm]", el).forEach((b) => b.onclick = () => { const x = forms[+b.dataset.stfrm]; u.forms = forms.filter((y) => y !== x); S.save(); T.refresh("setForms"); });
    $$("[data-stfill]", el).forEach((a) => a.onclick = () => { S.ui.ffForm = forms[+a.dataset.stfill].name; S.saveUi(); });
  };

  T.sections.setData = function () {
    const el = $("#sec-stdata"); if (!el) return;
    el.innerHTML = `<div class="sec-head" id="h-stdata"><div><h2>Your data</h2><p class="sub">Everything you enter stays on this computer. From here you can download a backup, open a TAMA data file, keep a copy in a folder, or start again.</p></div></div>
      <div class="row-btns"><button class="btn primary" id="st-data">Open “Your data”</button></div>`;
    $("#st-data", el).onclick = () => { const b = $("#btn-data"); if (b) b.click(); };
  };

  T.renderSettingsPage = function () {
    $("#content").innerHTML = ["stlogo", "stnames", "stforms", "stdata"].map((k) => `<section class="card" id="sec-${k}"></section>`).join("");
    T.refresh("setLogo", "setNames", "setForms", "setData");
  };
  setTimeout(() => { try { T.applyBrand(); } catch (e) { /* the page still works without it */ } }, 0);
})();
