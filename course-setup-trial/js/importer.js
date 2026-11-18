/* Reading tables from Excel, CSV, Word (.docx) and PDF files, all inside the browser. */
(function () {
  const T = window.TAMA;
  const I = (T.importer = {});
  const libs = {
    xlsx: "vendor/xlsx.full.min.js",     // SheetJS 0.18.5
    jszip: "vendor/jszip.min.js",        // JSZip 3.10.1
    pdf: "vendor/pdf.min.js",            // pdf.js 3.11.174
  };
  const cdn = {   // used only when the copy in vendor/ is missing
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    jszip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  };
  const src = {};
  const loaded = {};
  const add = (url) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = url; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  I.lib = (name) => loaded[name] || (loaded[name] = add(libs[name]).then(() => { src[name] = libs[name]; })
    .catch(() => add(cdn[name]).then(() => { src[name] = cdn[name]; }))
    .catch(() => { loaded[name] = null; throw new Error("The reader for this file type could not be loaded. Reload the page and try again."); }));

  /** A grid (array of rows) -> {columns, rows}: the first non-empty row is the header. */
  function toTable(grid, name) {
    grid = grid.map((r) => r.map((c) => T.s(c).trim()));
    while (grid.length && grid[0].every((c) => !c)) grid.shift();
    if (!grid.length) return null;
    const width = Math.max(...grid.map((r) => r.length));
    const seen = {};
    const columns = Array.from({ length: width }, (_, i) => {
      let h = T.s(grid[0][i]).trim() || `Column ${i + 1}`;
      if (seen[h]) h = `${h} (${++seen[h]})`; else seen[h] = 1;
      return h;
    });
    const rows = grid.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, T.s(r[i]).trim()])));
    return { name, columns, rows };
  }

  /** Returns a list of tables found in the file: [{name, columns, rows}]. */
  I.read = async function (file) {
    const n = file.name.toLowerCase();
    const buf = await file.arrayBuffer();
    if (/\.(xlsx|xlsm|xls|csv)$/.test(n)) {
      await I.lib("xlsx");
      const wb = n.endsWith(".csv") ? XLSX.read(new TextDecoder().decode(buf), { type: "string" }) : XLSX.read(buf, { type: "array" });
      return wb.SheetNames.map((sn) => toTable(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: "" }), sn)).filter(Boolean);
    }
    if (n.endsWith(".docx")) {
      await I.lib("jszip");
      const zip = await JSZip.loadAsync(buf);
      const xml = await zip.file("word/document.xml").async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
      const out = [];
      [...doc.getElementsByTagNameNS(W, "tbl")].forEach((tbl, ti) => {
        if (tbl.parentNode && tbl.parentNode.closest && tbl.parentNode.closest("tbl")) return;
        const grid = [...tbl.getElementsByTagNameNS(W, "tr")].filter((tr) => tr.parentNode === tbl).map((tr) =>
          [...tr.getElementsByTagNameNS(W, "tc")].filter((tc) => tc.parentNode === tr).map((tc) =>
            [...tc.getElementsByTagNameNS(W, "p")].map((p) => [...p.getElementsByTagNameNS(W, "t")].map((t) => t.textContent).join("")).join("\n").trim()));
        const t = toTable(grid, `Table ${ti + 1}`); if (t && t.rows.length) out.push(t);
      });
      return out;
    }
    if (n.endsWith(".pdf")) {
      await I.lib("pdf");
      pdfjsLib.GlobalWorkerOptions.workerSrc = src.pdf.replace("pdf.min.js", "pdf.worker.min.js");
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const grid = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const items = (await (await pdf.getPage(p)).getTextContent()).items.filter((it) => it.str.trim());
        const lines = [];
        items.forEach((it) => {
          const y = Math.round(it.transform[5]);
          let ln = lines.find((l) => Math.abs(l.y - y) < 3);
          if (!ln) { ln = { y, parts: [] }; lines.push(ln); }
          ln.parts.push({ x: it.transform[4], w: it.width, s: it.str });
        });
        lines.sort((a, b) => b.y - a.y).forEach((l) => {
          l.parts.sort((a, b) => a.x - b.x);
          const cells = []; let end = -1e9;
          l.parts.forEach((pt) => { if (pt.x - end > 12 || !cells.length) cells.push(pt.s); else cells[cells.length - 1] += " " + pt.s; end = pt.x + pt.w; });
          if (cells.length > 1) grid.push(cells);
        });
      }
      const t = toTable(grid, "Table 1");
      return t && t.rows.length ? [t] : [];
    }
    throw new Error("Please choose an Excel (.xlsx, .xls), CSV, Word (.docx) or PDF file.");
  };

  /** The one example Excel file for importing CLOs and SLOs: sheet "CLOs" and sheet "SLOs" (as in TAMA). */
  I.templateDownload = async function (style, cloIds) {
    await I.lib("xlsx");
    const clos = style === "dotted"
      ? [["CLO ID", "CLO statement", "Domain", "Aligned PLOs"], ["1.1", "Describe ...", "K", "K1"], ["1.2", "Explain ...", "K", "K1, K2"], ["2.1", "Perform ...", "S", "S1"], ["3.1", "Demonstrate professional ...", "V", "V1"]]
      : [["CLO ID", "CLO statement", "Domain", "Aligned PLOs"], ["CLO1", "Describe ...", "K", "K1"], ["CLO2", "Perform ...", "S", "S1, S2"], ["CLO3", "Demonstrate professional ...", "V", "V1"]];
    const ids = (cloIds || []).filter((x) => T.s(x).trim()).length ? cloIds : clos.slice(1).map((r) => r[0]);
    const slos = [["SLO ID", "Lecture / topic", "SLO statement", "Domain", "Linked CLO", "Target KPI"],
      ["SLO1", "Lecture 1", "Describe ...", "K", ids[0], 70], ["SLO2", "Lecture 1", "Apply ...", "S:Cog.", ids[Math.min(1, ids.length - 1)], 70], ["SLO3", "Lecture 2", "Show ...", "V", ids[ids.length - 1], 70]];
    const wb = XLSX.utils.book_new();
    [["CLOs", clos], ["SLOs", slos]].forEach(([name, aoa]) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = aoa[0].map((_, i) => ({ wch: Math.min(Math.max(...aoa.map((r) => T.s(r[i]).length)) + 4, 60) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, "TAMA CLO and SLO import template.xlsx");
  };
})();
