/* Keeping links in step when CLOs are renumbered, renamed or deleted (ported from TAMA's renumber_and_store_clos). */
(function () {
  const T = window.TAMA, S = T.store;
  const L = (T.links = {});

  /** Store the CLO rows of course `sel` in the given order. With auto=true they are numbered in the course's style and
   *  everything linked to them follows. `renames` maps an earlier ID to a new one typed by hand.
   *  Returns the number of SLOs that lost their CLO link because their CLO was deleted. */
  L.storeClos = function (sel, rows, auto, style, renames) {
    rows = rows.map((r) => ({ ...r }));
    if (auto && style === "dotted") {
      const rank = { K: 0, S: 1, V: 2 };
      rows = rows.map((r, i) => [r, i]).sort((a, b) => ((rank[a[0].domain] ?? 9) - (rank[b[0].domain] ?? 9)) || (a[1] - b[1])).map((x) => x[0]);
    }
    const oldIds = rows.map((r) => T.s(r.clo_id));
    let newIds;
    if (auto && style === "dotted") {
      const cnt = {};
      newIds = rows.map((r) => { cnt[r.domain] = (cnt[r.domain] || 0) + 1; return `${T.DOM_NUM[r.domain] || 9}.${cnt[r.domain]}`; });
    } else newIds = auto ? rows.map((_, i) => `CLO${i + 1}`) : oldIds;
    const idmap = {};
    oldIds.forEach((o, i) => { if (o) idmap[o] = newIds[i]; });
    Object.entries(renames || {}).forEach(([o, n]) => { if (o && !(o in idmap)) idmap[o] = idmap[n] || n; });
    rows.forEach((r, i) => { r.clo_id = newIds[i]; r.course_code = sel; });
    S.setT("clos", [...S.t("clos").filter((r) => String(r.course_code) !== String(sel)), ...rows]);
    let lost = 0;
    S.t("slos").forEach((r) => {
      if (String(r.course_code) !== String(sel) || !T.s(r.clo_id)) return;
      if (!(r.clo_id in idmap)) lost++;
      r.clo_id = idmap[r.clo_id] || "";
    });
    if (!auto && !Object.keys(renames || {}).length) return lost;
    const tb = S.data.tables;
    (tb.questions || []).forEach((q) => {
      if (String(q.course_code) !== String(sel)) return;
      q.clos = T.s(q.clos).replace(/;/g, ",").split(",").map((x) => x.trim()).filter((t) => t && t in idmap).map((t) => idmap[t]).join(", ");
    });
    if (tb.plans) tb.plans = tb.plans.filter((p) => {
      if (String(p.course_code) !== String(sel) || p.basis !== "CLOs") return true;
      if (!(p.outcome_id in idmap)) return false; p.outcome_id = idmap[p.outcome_id]; return true;
    });
    ["clo_plan", "actions"].forEach((k) => {
      if (tb[k]) tb[k] = tb[k].filter((p) => {
        if (String(p.course_code) !== String(sel)) return true;
        if (!(p.clo_id in idmap)) return false; p.clo_id = idmap[p.clo_id]; return true;
      });
    });
    const bp = S.data.bp_raw || {};
    Object.keys(bp).forEach((k) => {
      const parts = k.split("||");
      if (parts.length === 3 && parts[0] === String(sel) && parts[2] === "CLOs") {
        const v = bp[k], nv = {}; Object.keys(v || {}).forEach((o) => { if (o in idmap) nv[idmap[o]] = v[o]; }); bp[k] = nv;
      }
    });
    const f = (v) => { v = T.s(v); return v.toUpperCase().startsWith("CLO") ? (idmap[v] || "") : v; };
    [["ia_map", "outcome_id"], ["ia_results", "outcome_id"], ["slo_other", "slo_id"]].forEach(([k, col]) => {
      (tb[k] || []).forEach((r) => { if (String(r.course_code) === String(sel) && col in r) r[col] = f(r[col]); });
    });
    return lost;
  };

  /** Copies the PLO, CLO and SLO rows of course src to course dst. */
  L.copyOutcomes = function (src, dst) {
    const done = {};
    ["plos", "clos", "slos"].forEach((t) => {
      const part = S.t(t).filter((r) => String(r.course_code) === String(src)).map((r) => ({ ...r, course_code: dst }));
      S.setT(t, [...S.t(t), ...part]); done[t] = part.length;
    });
    if (S.data.clo_styles[String(src)]) S.data.clo_styles[String(dst)] = S.data.clo_styles[String(src)];
    return done;
  };

  L.deleteCourse = function (sel) {
    ["courses", "plos", "clos", "slos", "exams"].forEach((k) => S.setT(k, S.t(k).filter((r) => String(r.course_code) !== String(sel))));
  };
})();
