/* TAMA Course setup trial: small helpers ported from TAMA's app.py, so the rules stay the same. */
(function () {
  const T = (window.TAMA = window.TAMA || {});

  T.OFFER_MARK = "​";   // a second offering of the same course code gets invisible marks (never stripped from saved keys)
  T.TERMS = ["First", "Second", "Summer", "Crash course"];
  T.PROGRAM_CHOICES = ["Diploma", "Bachelor", "Master", "Doctor of Philosophy"];
  T.LOCATION_CHOICES = ["Main", "Branch"];
  T.COURSE_TYPES = ["", "University", "College", "Department", "Track", "Others"];
  T.COURSE_REQ = ["", "Required", "Elective"];
  T.CLO_DOMAINS = { K: "Knowledge (K)", S: "Skill (S)", V: "Value (V)" };
  T.SLO_DOMAINS = ["K", "S:Cog.", "S:IT-N", "S:Psych", "V"];
  T.DOM_NUM = { K: 1, S: 2, V: 3 };
  T.NUM_DOM = { 1: "K", 2: "S", 3: "V" };
  T.CLO_STYLE_LABELS = {
    clo: "CLO1, CLO2, CLO3 ... (numbered automatically)",
    dotted: "1.1, 1.2, 2.1 ... (domain.order, numbered automatically)",
    custom: "My own IDs (I type them)",
  };
  T.COURSE_COLS = ["department", "course_code", "course_name", "term", "year", "course_director",
    "program", "faculty", "institution", "instructor", "location", "sections", "report_date",
    "prerequisites", "corequisites", "credit_hours", "course_type", "course_req", "level", "description"];
  T.PLO_COLS = ["course_code", "plo_id", "plo_text"];
  T.CLO_COLS = ["course_code", "clo_id", "clo_text", "domain", "plo_1", "plo_2", "plo_3", "target_pct", "kpi_threshold"];
  T.SLO_COLS = ["course_code", "topic", "slo_id", "slo_text", "domain", "clo_id", "assessment_methods", "target_kpi"];
  T.SHARED_COURSE_FIELDS = ["department", "faculty", "institution"];
  T.MEMORY_FIELDS = ["department", "faculty", "institution", "course_director", "instructor", "location", "program", "year"];
  T.DOMAIN_COLOURS = { K: "#2a62a8", S: "#a8832f", "S:Cog.": "#a8832f", "S:IT-N": "#cfae63", "S:Psych": "#6e5418", V: "#d9849f" };

  T.s = (v) => (v === null || v === undefined || (typeof v === "number" && isNaN(v)) || String(v).trim().toLowerCase() === "nan") ? "" : String(v);
  T.esc = (v) => T.s(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** 'dent301' -> 'DENT 301', 'Dent  301a' -> 'DENT 301A'. */
  T.fmtCourseCode = (v) => T.s(v).trim().replace(/\s+/g, " ").toUpperCase().replace(/(\p{L})(\d)/gu, "$1 $2");

  /** Capital first letter (sentence case), except for labels about codes, ids, e-mails, links and files. */
  T.cap1 = (v, label) => {
    if (typeof v !== "string" || !v.trim()) return v;
    if (/\b(code|codes|id|ids|identifier|identifiers|e-?mail|password|key|url|link|path|file|website)\b/i.test(label || "")) return v;
    const t = v.replace(/^\s+/, "");
    const first = t.split(/\s+/)[0] || "";
    if (t[0] === t[0].toUpperCase() || first.includes("@") || /^(http|www\.)/i.test(first)) return v;
    return v.slice(0, v.length - t.length) + t[0].toUpperCase() + t.slice(1);
  };

  T.baseCode = (k) => T.s(k).split(T.OFFER_MARK).join("");
  T.termLabel = (t) => { t = T.s(t).trim(); return ["First", "Second", "Summer"].includes(t) ? `${t} term` : t; };
  T.normTerm = (v) => {
    const t = T.s(v).trim();
    const k = t.toLowerCase().replace("semester", "").replace("term", "").trim().replace(/^[ .\-_]+|[ .\-_]+$/g, "");
    if (["1", "1st", "first", "one", "fall", "autumn"].includes(k)) return "First";
    if (["2", "2nd", "second", "two", "spring"].includes(k)) return "Second";
    if (["3", "3rd", "third", "summer"].includes(k)) return "Summer";
    if (k.includes("crash")) return "Crash course";
    return t;
  };
  T.newCourseKey = (code, existing) => {
    const have = new Set(existing.map(String)); let k = String(code);
    while (have.has(k)) k += T.OFFER_MARK;
    return k;
  };
  T.nextId = (prefix, ids) => {
    const used = new Set([...ids].map((x) => T.s(x).trim().toUpperCase()));
    let n = 1; while (used.has(`${prefix}${n}`.toUpperCase())) n++;
    return `${prefix}${n}`;
  };
  T.dottedId = (domain, used) => {
    const n = T.DOM_NUM[domain] || 9; let k = 1;
    const u = new Set([...used].map((x) => String(x).toUpperCase()));
    while (u.has(`${n}.${k}`)) k++;
    return `${n}.${k}`;
  };
  T.cloDetect = (ids) => {
    ids = ids.map((x) => T.s(x).trim()).filter(Boolean);
    if (!ids.length) return null;
    if (ids.every((x) => /^CLO\d+$/i.test(x))) return "clo";
    if (ids.every((x) => /^\d+\.\d+$/.test(x))) return "dotted";
    return "custom";
  };
  /** PLOs run K, then S, then V (others after), by number inside each letter. */
  T.ploSortKey = (v) => {
    const m = /^\s*([A-Za-z]*)[\s._-]*(\d+)?/.exec(T.s(v));
    const letter = (m && m[1] ? m[1] : "").toUpperCase();
    const num = m && m[2] ? parseInt(m[2], 10) : 0;
    return [letter ? ({ K: 0, S: 1, V: 2 }[letter[0]] ?? 3) : 4, letter, num, T.s(v)];
  };
  T.cmpKeys = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };
  /** A PLO code as the PLO table writes it: k1 -> K1, a bare number such as 8 (or 8.0) -> PLO8 (or the one PLO with that number). */
  T.ploCode = (v, ploIds) => {
    v = T.s(v).trim();
    if (!v || ["nan", "none"].includes(v.toLowerCase())) return "";
    const ids = ploIds.map((x) => T.s(x).trim()).filter(Boolean);
    const byUp = Object.fromEntries(ids.map((x) => [x.toUpperCase(), x]));
    if (byUp[v.toUpperCase()]) return byUp[v.toUpperCase()];
    const m = /^(\d+)(?:\.0+)?$/.exec(v);
    if (!m) return v;
    const n = parseInt(m[1], 10);
    if (byUp[`PLO${n}`]) return byUp[`PLO${n}`];
    const same = ids.filter((x) => { const mm = /(\d+)\s*$/.exec(x); return mm && parseInt(mm[1], 10) === n; });
    return same.length === 1 ? same[0] : `PLO${n}`;
  };
  /** Row numbers as plain words: [1,2,3,4,6] -> "1 to 4 and 6". */
  T.fmtRows = (nums) => {
    nums = [...new Set(nums.map(Number))].sort((a, b) => a - b);
    const parts = []; let i = 0;
    while (i < nums.length) {
      let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      parts.push(i === j ? String(nums[i]) : (j === i + 1 ? `${nums[i]} and ${nums[j]}` : `${nums[i]} to ${nums[j]}`));
      i = j + 1;
    }
    return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  };
  T.dupIds = (vals) => {
    const seen = new Set(), d = [];
    vals.map((v) => T.s(v).trim()).filter(Boolean).forEach((v) => { const u = v.toUpperCase(); if (seen.has(u) && !d.includes(v)) d.push(v); seen.add(u); });
    return d;
  };
  T.num = (v, dflt) => { const n = parseFloat(v); return isNaN(n) ? dflt : n; };
  T.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  T.uid = () => Math.random().toString(36).slice(2, 9);
})();
