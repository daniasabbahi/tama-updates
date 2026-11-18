/* Data: the same app_data.json layout as TAMA, kept in this browser and (optionally) copied to a folder the user picks.
   Nothing is sent anywhere. The trial keeps its own storage, apart from the real TAMA. */
(function () {
  const T = window.TAMA;
  const KEY = "tama_course_setup_trial_v1";
  const FILE = "app_data_TRIAL.json";
  const S = (T.store = {});
  let loadFailed = false;

  function blank() {
    return { tables: { courses: [], plos: [], clos: [], slos: [], exams: [] },
      course_defaults: {}, clo_styles: {}, field_memory: {}, ui_settings: {}, look: "Platform" };
  }
  function normalise(d) {
    if (!d || typeof d !== "object") d = blank();
    d.tables = d.tables || {};
    ["courses", "plos", "clos", "slos", "exams"].forEach((k) => { if (!Array.isArray(d.tables[k])) d.tables[k] = []; });
    ["course_defaults", "clo_styles", "field_memory", "ui_settings"].forEach((k) => { if (!d[k] || typeof d[k] !== "object") d[k] = {}; });
    d.tables.courses.forEach((r) => T.COURSE_COLS.forEach((c) => { if (r[c] === undefined || r[c] === null) r[c] = ""; }));
    d.tables.clos.forEach((r) => { r.target_pct = T.num(r.target_pct, 70); r.kpi_threshold = T.num(r.kpi_threshold, 60); });
    return d;
  }

  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      S.data = normalise(raw ? JSON.parse(raw) : blank());
    } catch (e) {
      loadFailed = true;   // never save over data that could not be read
      S.data = normalise(blank());
      T.toast("Your saved trial data could not be read, so nothing will be saved over it. Reload the page to try again.", "warn");
    }
    S.ui = (() => { try { return JSON.parse(localStorage.getItem(KEY + "_ui") || "{}"); } catch (e) { return {}; } })();
  };
  S.saveUi = function () { try { localStorage.setItem(KEY + "_ui", JSON.stringify(S.ui)); } catch (e) { /* only a convenience */ } };

  let lastText = null;
  S.save = function () {
    if (loadFailed) return;
    const text = JSON.stringify(S.data);
    if (text === lastText) return;
    try { localStorage.setItem(KEY, text); lastText = text; S.mark("Saved"); }
    catch (e) { S.mark("Not saved: this browser's storage is full"); }
    folderSave(text);
  };
  S.saveSoon = T.debounce(() => S.save(), 250);
  S.mark = function (txt) {
    const el = document.getElementById("save-state");
    if (!el) return;
    const t = new Date();
    el.textContent = txt === "Saved" ? `All changes saved · ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : txt;
  };

  S.t = (name) => S.data.tables[name];
  S.setT = (name, rows) => { S.data.tables[name] = rows; };
  S.courseInfo = (code) => S.t("courses").find((r) => String(r.course_code) === String(code)) || null;
  S.courseLabel = (k, withName) => {
    const ci = S.courseInfo(k);
    if (!ci) return T.baseCode(k);
    let out = [T.baseCode(k), T.termLabel(ci.term), T.s(ci.year).trim()].filter(Boolean).join(" – ");
    if (withName && T.s(ci.course_name).trim()) out += ` (${T.s(ci.course_name).trim()})`;
    return out;
  };
  S.cloStyleOf = (course, ids) => {
    const stored = S.data.clo_styles[String(course)];
    const found = T.cloDetect(ids);
    if (stored === "custom") return "custom";
    if ((stored === "clo" || stored === "dotted") && (found === null || found === stored)) return stored;
    return found || "clo";
  };
  S.lastCourseDefaults = () => {
    const mem = S.data.course_defaults || {}, out = {};
    T.SHARED_COURSE_FIELDS.forEach((k) => {
      let v = T.s(mem[k]).trim();
      if (!v) { const vals = S.t("courses").map((r) => T.s(r[k]).trim()).filter(Boolean); v = vals.length ? vals[vals.length - 1] : ""; }
      out[k] = v;
    });
    return out;
  };
  S.rememberDefaults = (vals) => {
    Object.entries(vals).forEach(([k, v]) => { if (T.SHARED_COURSE_FIELDS.includes(k) && T.s(v).trim()) S.data.course_defaults[k] = T.s(v).trim(); });
  };
  S.rememberFields = (vals) => {
    const mem = S.data.field_memory;
    Object.entries(vals).forEach(([k, v]) => {
      v = T.s(v).trim();
      if (!v || !T.MEMORY_FIELDS.includes(k)) return;
      const lst = (mem[k] || []).filter((x) => x.toLowerCase() !== v.toLowerCase());
      mem[k] = [v, ...lst].slice(0, 30);
    });
  };
  /** What can be picked in a Course details box: fixed choices, then earlier entries, newest first. */
  S.fieldOptions = (field, base) => {
    const out = [...(base || [])].filter(Boolean), seen = new Set(out.map((x) => x.toLowerCase()));
    const vals = [...(S.data.field_memory[field] || []), ...S.t("courses").map((r) => T.s(r[field]).trim()).reverse()];
    vals.forEach((v) => { v = T.s(v).trim(); if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); } });
    return out;
  };

  /* ---------- the folder copy (Chrome and Edge only), with dated backups: at most one per 10 minutes, the last 20 kept */
  let dirHandle = null;
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open("tama_trial", 1); r.onupgradeneeded = () => r.result.createObjectStore("h"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbSet(k, v) { const db = await idb(); return new Promise((res) => { const tx = db.transaction("h", "readwrite"); tx.objectStore("h").put(v, k); tx.oncomplete = res; }); }
  async function idbGet(k) { const db = await idb(); return new Promise((res) => { const q = db.transaction("h").objectStore("h").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
  S.folderSupported = () => "showDirectoryPicker" in window;
  S.folderName = () => (dirHandle ? dirHandle.name : null);
  S.pickFolder = async function () {
    try {
      dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      await idbSet("dir", dirHandle);
      lastText = null; S.save();
      T.toast(`A copy of your data is now kept in the folder “${dirHandle.name}”.`);
    } catch (e) { /* the person closed the picker */ }
    T.renderDataPanel && T.renderDataPanel();
  };
  S.restoreFolder = async function () {
    try {
      const h = await idbGet("dir");
      if (h && (await h.queryPermission({ mode: "readwrite" })) === "granted") dirHandle = h;
      else if (h) S.pendingHandle = h;
    } catch (e) { /* no folder yet */ }
  };
  S.reconnectFolder = async function () {
    if (!S.pendingHandle) return S.pickFolder();
    if ((await S.pendingHandle.requestPermission({ mode: "readwrite" })) === "granted") { dirHandle = S.pendingHandle; S.pendingHandle = null; lastText = null; S.save(); }
    T.renderDataPanel && T.renderDataPanel();
  };
  let lastBackup = 0;
  async function folderSave(text) {
    if (!dirHandle) return;
    try {
      if (Date.now() - lastBackup > 600000) {
        try {
          const old = await (await dirHandle.getFileHandle(FILE)).getFile();
          const oldText = await old.text();
          JSON.parse(oldText);   // only a readable file is backed up
          const bdir = await dirHandle.getDirectoryHandle("app_data_backups", { create: true });
          const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
          const w = await (await bdir.getFileHandle(`app_data_TRIAL_${stamp}.json`, { create: true })).createWritable();
          await w.write(oldText); await w.close();
          const names = []; for await (const [n] of bdir.entries()) if (n.startsWith("app_data_TRIAL_")) names.push(n);
          names.sort().reverse().slice(20).forEach((n) => bdir.removeEntry(n).catch(() => {}));
          lastBackup = Date.now();
        } catch (e) { /* first save: nothing to back up yet */ }
      }
      const w = await (await dirHandle.getFileHandle(FILE, { create: true })).createWritable();   // written whole, then swapped in by the browser
      await w.write(text); await w.close();
    } catch (e) { S.mark("Saved in this browser (the folder copy failed)"); }
  }

  /* ---------- open a TAMA file / download a backup */
  S.importFile = async function (file) {
    const text = await file.text();
    let d;
    try { d = JSON.parse(text); } catch (e) { T.toast("That file is not a TAMA data file (.json).", "warn"); return false; }
    if (!d || !d.tables || !Array.isArray(d.tables.courses)) { T.toast("That file has no TAMA courses in it.", "warn"); return false; }
    S.data = normalise(d);   // every other key and table is kept unchanged, so the file can go back into TAMA
    lastText = null; S.save();
    return true;
  };
  S.downloadBackup = function () {
    const blob = new Blob([JSON.stringify(S.data)], { type: "application/json" });
    const a = document.createElement("a");
    const day = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob); a.download = `TAMA trial backup ${day}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  S.clearAll = function () { S.data = normalise(blank()); lastText = null; S.save(); };
})();
