/* PLO section: Add box, the PLO table (edited in place, saves itself), and PLOs the CLOs point to but the table lacks. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;

  T.plosOf = (sel) => S.t("plos").filter((r) => String(r.course_code) === String(sel));
  T.ploOpts = (sel) => T.plosOf(sel).map((r) => T.s(r.plo_id).trim()).filter(Boolean);

  function sortPlos(sel) {
    const mine = T.plosOf(sel).sort((a, b) => T.cmpKeys(T.ploSortKey(a.plo_id), T.ploSortKey(b.plo_id)));
    S.setT("plos", [...S.t("plos").filter((r) => String(r.course_code) !== String(sel)), ...mine]);
  }
  /** CLO links that point to a PLO that is no longer in the table are cleared (as in TAMA). */
  function clearBadLinks(sel) {
    const valid = new Set(T.plosOf(sel).map((r) => T.s(r.plo_id)));
    let n = 0;
    S.t("clos").forEach((c) => {
      if (String(c.course_code) !== String(sel)) return;
      ["plo_1", "plo_2", "plo_3"].forEach((k) => { if (T.s(c[k]) && !valid.has(c[k])) { c[k] = ""; n++; } });
    });
    return n;
  }

  T.sections.plos = function () {
    const sel = T.current(), el = $("#sec-plos");
    const rows = T.plosOf(sel);
    const sug = T.nextId("PLO", rows.map((r) => r.plo_id));
    const gaps = rows.map((r, i) => (T.s(r.plo_text).trim() ? 0 : i + 1)).filter(Boolean);
    const noid = rows.map((r, i) => (T.s(r.plo_id).trim() ? 0 : i + 1)).filter(Boolean);
    const have = new Set(rows.map((r) => T.s(r.plo_id).trim().toUpperCase()).filter(Boolean));
    const miss = [];
    S.t("clos").filter((c) => String(c.course_code) === String(sel)).forEach((c) => ["plo_1", "plo_2", "plo_3"].forEach((k) => {
      const v = T.s(c[k]).trim(); if (v && !have.has(v.toUpperCase()) && !miss.includes(v)) miss.push(v);
    }));
    const dr = (S.ui.ploDraft = S.ui.ploDraft || {});
    const draft = dr[sel] || { id: "", text: "" };
    el.innerHTML = `<div class="sec-head" id="h-plos"><div><h2>Program learning outcomes (PLOs) of this course</h2>
        <p class="sub">The PLOs this course supports. The CLOs below are linked to them.</p></div><span class="count">${rows.length} PLO${rows.length === 1 ? "" : "s"}</span></div>
      ${gaps.length || noid.length ? `<p class="warn-text">${gaps.length ? `Add the PLO statement in row(s) ${T.fmtRows(gaps)}. ` : ""}${noid.length ? `Add the PLO ID in row(s) ${T.fmtRows(noid)}. ` : ""}Nothing is lost while rows are unfinished.</p>` : ""}
      ${miss.length ? `<div class="info-box"><span>Your CLOs are linked to PLOs that are not in the PLO table yet: <b>${esc(miss.join(", "))}</b>.</span>
         <button class="btn primary sm" id="add-miss">Add them to the PLO table (then write their statements)</button></div>` : ""}
      <div class="add-box">
        <div class="add-title">Add a PLO</div>
        <div class="grid g-plo">
          ${T.field({ id: "plo-new-id", label: "PLO identifier", req: true, value: draft.id || sug })}
          ${T.field({ id: "plo-new-text", label: "PLO statement", req: true, value: draft.text })}
          <div class="fld-btn"><button class="btn primary" id="plo-add">Add PLO</button></div>
        </div>
        <p class="warn-text" id="plo-msg" hidden></p>
      </div>
      ${rows.length ? `<table class="tbl plo-tbl"><colgroup><col style="width:44px"><col style="width:16%"><col><col style="width:64px"></colgroup>
        <thead><tr><th>#</th><th>PLO ID</th><th>PLO statement</th><th>Delete</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr data-i="${i}"><td class="num">${i + 1}</td>
          <td><textarea rows="1" class="cell ${T.s(r.plo_id).trim() ? "filled" : ""}" data-ref="plo:${i}:plo_id" data-c="plo_id" data-label="PLO ID" spellcheck="false">${esc(r.plo_id)}</textarea></td>
          <td><textarea rows="1" class="cell ${T.s(r.plo_text).trim() ? "filled" : ""}" data-ref="plo:${i}:plo_text" data-c="plo_text" data-label="PLO statement" spellcheck="true">${esc(r.plo_text)}</textarea></td>
          <td class="ctr"><button class="icon-btn" data-del="${i}" title="Delete this PLO" aria-label="Delete">🗑</button></td></tr>
          <tr class="confirm-row" data-confirm="${i}" hidden><td colspan="4"><span class="warn-text">Delete ${esc(r.plo_id || "this PLO")}? CLO links to it are cleared. This cannot be undone.</span>
          <button class="btn sm" data-yes="${i}">Yes, delete</button> <button class="btn sm ghost" data-no="${i}">Cancel, keep it</button></td></tr>`).join("")}
        </tbody></table>
        <div class="row-btns"><button class="btn ghost sm" id="plo-row">+ Add an empty row</button></div>`
      : `<p class="note">No PLOs yet. Add them in the box above.</p>`}`;

    const keep = () => { dr[sel] = { id: $("#plo-new-id").value, text: $("#plo-new-text").value }; S.saveUi(); };
    ["#plo-new-id", "#plo-new-text"].forEach((q) => { const f = $(q); f.addEventListener("input", () => { T.markFilled(f); keep(); }); f.addEventListener("change", () => { f.value = T.cap1(f.value, f.dataset.label); T.markFilled(f); keep(); }); });
    $("#plo-add").onclick = () => {
      const pid = $("#plo-new-id").value.trim(), ptxt = T.cap1($("#plo-new-text").value.trim(), "PLO statement");
      const msg = $("#plo-msg");
      if (!pid || !ptxt) { msg.hidden = false; msg.textContent = "Both the PLO identifier and the PLO statement are required."; return; }
      if (have.has(pid.toUpperCase())) { msg.hidden = false; msg.textContent = `${pid} already exists for this course. Please use a different identifier.`; return; }
      S.t("plos").push({ course_code: sel, plo_id: pid, plo_text: ptxt });
      sortPlos(sel); delete dr[sel]; S.saveUi(); S.save();
      T.toast(`${pid} saved.`);
      T.refresh("plos", "clos");
    };
    const ma = $("#add-miss");
    if (ma) ma.onclick = () => {
      miss.forEach((x) => S.t("plos").push({ course_code: sel, plo_id: x, plo_text: "" }));
      sortPlos(sel); S.save();
      T.toast(`${miss.length} PLO(s) added to the table. Write their statements there.`);
      T.refresh("plos", "clos");
    };
    const rowBtn = $("#plo-row");
    if (rowBtn) rowBtn.onclick = () => { S.t("plos").push({ course_code: sel, plo_id: "", plo_text: "" }); S.save(); T.refresh("plos"); const c = $$(".plo-tbl textarea[data-c=plo_id]"); c[c.length - 1].focus(); };

    $$(".plo-tbl textarea.cell", el).forEach((ta) => {
      T.autoGrow(ta);
      const i = +ta.closest("tr").dataset.i, r = rows[i], c = ta.dataset.c;
      let before = T.s(r[c]);
      ta.addEventListener("input", () => { T.autoGrow(ta); ta.classList.toggle("filled", !!ta.value.trim()); if (c === "plo_text") { r[c] = ta.value; S.saveSoon(); } });
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.blur(); } });
      ta.addEventListener("paste", (e) => T.pasteGrid(e, ta, "plo", rows, ["plo_id", "plo_text"], () => { sortPlos(sel); S.save(); T.refresh("plos", "clos"); }));
      ta.addEventListener("change", () => {
        let v = ta.value.trim();
        if (c === "plo_text") { v = T.cap1(v, "PLO statement"); ta.value = v; r[c] = v; S.save(); return; }
        if (v && rows.some((o, j) => j !== i && T.s(o.plo_id).trim().toUpperCase() === v.toUpperCase())) {
          T.toast(`${v} is already used for another PLO of this course, so the ID was not changed.`, "warn");
          ta.value = before; return;
        }
        r.plo_id = v; before = v;
        sortPlos(sel);
        const n = clearBadLinks(sel);
        S.save();
        if (n) T.toast(`PLO saved. ${n} CLO link(s) to the old PLO ID were cleared; link the CLOs again in the CLO table.`, "warn");
        T.refresh("plos", "clos");
      });
    });
    $$("[data-del]", el).forEach((b) => b.onclick = () => { $(`[data-confirm="${b.dataset.del}"]`, el).hidden = false; });
    $$("[data-no]", el).forEach((b) => b.onclick = () => { $(`[data-confirm="${b.dataset.no}"]`, el).hidden = true; });
    $$("[data-yes]", el).forEach((b) => b.onclick = () => {
      const r = rows[+b.dataset.yes];
      S.setT("plos", S.t("plos").filter((x) => x !== r));
      const n = clearBadLinks(sel);
      S.save();
      T.toast(`${r.plo_id || "PLO"} deleted.` + (n ? ` ${n} CLO link(s) to it were cleared.` : ""));
      T.refresh("plos", "clos");
    });
  };

  /** Ctrl+V of several cells copied from Excel fills the table from the cell you paste into, downwards and to the right. */
  T.pasteGrid = function (e, ta, kind, rows, cols, done) {
    const txt = (e.clipboardData || window.clipboardData).getData("text");
    if (!txt || (!txt.includes("\t") && !/\n./.test(txt.replace(/\r?\n$/, "")))) return;   // one cell: normal paste
    e.preventDefault();
    const grid = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    const r0 = +ta.closest("tr").dataset.i, c0 = cols.indexOf(ta.dataset.c);
    let n = 0, skipped = 0;
    grid.forEach((line, dr) => line.forEach((v, dc) => {
      const r = rows[r0 + dr], c = cols[c0 + dc];
      if (!r || !c) { skipped++; return; }
      r[c] = T.cap1(v.trim(), c.includes("id") ? "id" : "statement"); n++;
    }));
    done();
    T.toast(`${n} cell(s) filled from the copied cells.` + (skipped ? ` ${skipped} did not fit in the table and were left out.` : ""), skipped ? "warn" : "ok");
  };
})();
