/* Syllabus (TAMA dr_spec("syllabus") and dr_build_docx, laid out like Dania's DPHE 808 syllabus, 2026-11-28).
   Uses the same parts store as the Course Specification: course_report[c].docs.syllabus. The Word file is made here
   (T.word.make), with the logo from Settings at the top when there is one. */
(function () {
  const T = window.TAMA, S = T.store, W = T.word;
  const clean = (v) => { const s = v === null || v === undefined ? "" : String(v); return ["nan", "none", "nat"].includes(s.trim().toLowerCase()) ? "" : s.trim(); };
  const ci = (sel, k) => clean((S.courseInfo(sel) || {})[k]);
  const POL = {"attendance": "Attendance for this course follows the official King Abdulaziz University regulations. Students are required to attend all scheduled sessions and actively participate in learning activities; attendance is recorded from the first week of the semester. If a student's absences reach 25% or more of the total contact hours for the course, they will be denied entry to the final examination and/or final project assessment in accordance with university policy.", "participation": "Students are expected to:\n• Participate actively in class discussions and activities\n• Contribute positively to a collaborative learning environment\n• Treat classmates and the instructor with respect\n• Complete all assigned work on time", "late_work": "• All assignments, reports, and projects are due on the date and time specified in the instruction given for each assignment. Late submissions disrupt feedback and assessment and are therefore strongly discouraged.\n• Assignments submitted up to 36 hours after the deadline will incur a deduction of 10% of the total possible marks for each 24-hour period (or part thereof) beyond the deadline.\n• No assignments will be accepted more than 3 days after the original deadline, and work submitted after this cut-off will receive a grade of zero, unless an officially documented excuse is approved according to King Abdulaziz University regulations (e.g., serious illness, family emergency).\n• Students who anticipate difficulty meeting a deadline must contact the instructor in writing (email) before the due date to request a short extension; approval is at the instructor's discretion and may require supporting documentation.", "integrity": "Students must uphold the highest standards of academic integrity in all coursework and assessments. Academic dishonesty, including plagiarism, cheating, fabrication of data, and unauthorized collaboration, may result in a failing grade on the assignment or in the course and referral for further disciplinary action under university regulations. Students are responsible for correct citation and for respecting intellectual property and copyright in all submitted work.", "prof_comm": "Students are expected to communicate in a professional and respectful manner in class and online. This includes using appropriate language (no offensive terms, harassment, slang, or ALL CAPS), following basic email etiquette (greeting, clear subject line with course code, signature), and allowing at least 24 hours for responses to routine messages on working days.", "conduct": "Students are expected to:\n• Respect the instructor and other students and refrain from disruptive behavior.\n• Maintain professional communication and avoid offensive language or harassment.\n• Follow all university conduct policies and contribute to a learning environment characterized by dignity and mutual respect.\n• Violation may result in disciplinary actions ranging from a formal warning to suspension or expulsion from the university, in accordance with official procedures", "recording": "• Audio or video recording of class sessions (including via phones, laptops, or other devices) is not permitted unless explicit permission is granted by the instructor for that specific session.\n• The instructor will decide at each lecture whether recording is allowed and will announce this at the beginning of the session; permission may be limited to audio only and to personal educational use by enrolled students.\n• Any approved recordings may not be shared, posted online, or redistributed in any form, and must not be used for purposes other than individual study for this course.\n• Students with approved disability accommodation that requires recording should contact the instructor and the relevant university unit to arrange appropriate permissions in advance.", "modifications": "This syllabus may be subject to change at the discretion of the instructor. Students will be notified of any changes via email with sufficient notice when possible.", "consent": "By remaining enrolled in this course, you acknowledge that you have read this syllabus, understood the course requirements, and agree to abide by all policies outlined herein."};
  const DOM = { 1: "Knowledge and understanding", 2: "Skills", 3: "Values, autonomy and responsibility" };
  const offering = (c) => [T.termLabel(ci(c, "term")), ci(c, "year")].filter(Boolean).join(" ");
  const clos = (c) => { let r = []; try { r = T.cloParts.reportRows(c); } catch (e) { r = []; } return r.map((x) => ({ Domain: DOM[x.g], CLO: x.text })); };
  const grading = (c) => { try { return T.plan.gradingRows(c).map((r) => ({ Assessment: clean(r.Assessment), Mark: clean(r.Mark), Weight: clean(r.Weight), "Due Date": clean(r["Due date"]) })); } catch (e) { return []; } };
  function schedule(c) {
    const who = ci(c, "instructor") || ci(c, "course_director"), dom = (v) => ({ K: "Knowledge", S: "Skill", V: "Value" })[clean(v).toUpperCase().slice(0, 1)] || clean(v);
    let last = null;
    return (S.data.tables.slos || []).filter((r) => String(r.course_code) === String(c)).map((r) => { const t = clean(r.topic), row = { Date: clean(r.week), Topic: t !== last ? t : "", Domain: dom(r.domain), "Learning Outcomes": clean(r.slo_text), "Lecturer Name": t !== last ? who : "" }; last = t; return row; });
  }
  const SET = (k) => ["Course setup", "course-setup", null, []];
  const SYL = [
    ["#", "Basic Course Information"],
    ["course_code", "Course Code", "text", (c) => `(${T.baseCode(c)})`, SET()],
    ["course_name", "Course Title", "text", (c) => ci(c, "course_name"), SET()],
    ["credit_hours", "Credit Hours", "text", (c) => ci(c, "credit_hours"), SET()],
    ["offering", "Semester/Term", "text", offering, SET()],
    ["modality", "Course Modality", "text", () => "In-person", null],
    ["class_time", "Course Times", "text", null, null],
    ["location", "Location", "text", (c) => ci(c, "location"), SET()],
    ["prerequisites", "Prerequisite(s)", "text", (c) => ci(c, "prerequisites"), SET()],
    ["#", "Instructor Information"],
    ["instructor", "Instructor Name", "text", (c) => ci(c, "instructor") || ci(c, "course_director"), SET()],
    ["office", "Office Location", "text", null, null],
    ["phone", "Office Phone", "text", null, null],
    ["email", "Email", "text", null, null],
    ["office_hours", "Office Hours", "text", null, null],
    ["communication", "Communication Policy", "area", (c) => `Students should contact the instructor using their official university email accounts and include the course code (${T.baseCode(c)}) in the subject line. Emails will typically receive a response within 24-48 hours on working days; messages sent on weekends, holidays, or immediately before assignment deadlines may be answered on the next working day.`, null],
    ["#", "Course Description"],
    ["description", "Course Description", "area", (c) => ci(c, "description"), SET()],
    ["#", "Course Prerequisites and Co-requisites"],
    ["prereq2", "Prerequisite(s) ", "text", (c) => ci(c, "prerequisites"), SET()],
    ["corequisites", "Co-requisite(s)", "text", (c) => ci(c, "corequisites"), SET()],
    ["#", "Course Learning Outcomes"],
    ["clo_intro", "Sentence before the CLOs", "text", () => "Upon successful completion of this course, students will be able to:", null],
    ["clos", "CLOs (grouped by domain in the Word file)", ["Domain", "CLO"], clos, ["Course setup", "course-setup", null, []]],
    ["clo_note", "Note under the CLOs", "text", (c) => (ci(c, "program") ? `Note: These learning outcomes align with the ${ci(c, "program")} Program Learning Outcomes.` : "Note: These learning outcomes align with the Program Learning Outcomes."), null],
    ["#", "Required Materials and Textbooks"],
    ["textbooks", "Required Materials and Textbooks", "area", null, null],
    ["#", "Course Requirements and Grading"],
    ["assessment", "Grading Breakdown", ["Assessment", "Mark", "Weight", "Due Date"], grading, ["Assessment plan", "assessment-plan", null, []]],
    ["assign_desc", "Assignment Descriptions", "area", () => "Will be explained during the introductory session", null],
    ["#", "Course Schedule and Topic Outline"],
    ["schedule", "Course schedule", ["Date", "Topic", "Domain", "Learning Outcomes", "Lecturer Name"], schedule, ["Lectures & SLOs", "lectures-slos", "Learning Outcomes", ["Date", "Lecturer Name"]]],
    ["schedule_note", "Note under the schedule", "text", () => "Note: This schedule might be subject to change at the instructor's discretion. Students will be notified of any changes.", null],
    ["#", "Course Policies"],
    ["attendance", "Attendance Policy", "area", () => POL.attendance, null],
    ["participation", "Participation Expectations", "area", () => POL.participation, null],
    ["late_work", "Late Work Policy", "area", () => POL.late_work, null],
    ["integrity", "Academic integrity", "area", () => POL.integrity, null],
    ["prof_comm", "Professional communication", "area", () => POL.prof_comm, null],
    ["conduct", "Classroom conduct and respect", "area", () => POL.conduct, null],
    ["recording", "Policy on Use of Recording in Classroom", "area", () => POL.recording, null],
    ["modifications", "Course Modifications", "area", () => POL.modifications, null],
    ["consent", "Consent to Syllabus", "area", () => POL.consent, null],
    ["last_updated", "Last Updated", "text", () => new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }), null],
  ];
  T.docSpec.DOCS.syllabus = SYL;

  async function build(sel) {
    const V = (p) => T.docSpec.value(sel, "syllabus", p), { run, para, table } = W;
    const top = [ci(sel, "institution"), ci(sel, "faculty"), ci(sel, "department")].filter(Boolean).join(" · ");
    let body = (top ? para(run(top, { color: "555F6D", sz: 20 }), { jc: "center" }) : "") + para(run("Syllabus"), { style: "Title", jc: "center" })
      + para(run(`${T.baseCode(sel)} ${ci(sel, "course_name")}`.trim(), { b: true }), { jc: "center" }) + (offering(sel) ? para(run(offering(sel)), { jc: "center", after: 200 }) : "");
    const bullets = (text) => clean(text).split("\n").map((line) => { const s = line.trim(); return /^[•\-*·]\s*/.test(s) && s.length > 1 ? `<w:p><w:pPr><w:spacing w:after="40"/><w:ind w:left="360" w:hanging="240"/></w:pPr>${run("• " + s.replace(/^[•\-*·]\s*/, ""))}</w:p>` : para(run(s)); }).join("");
    let head = "";
    SYL.forEach((p) => {
      if (p[0] === "#") { head = p[1]; body += para(run(p[1]), { style: "Heading1" }); return; }
      const [pid, label, kind] = p, v = V(p);
      if (Array.isArray(kind)) {
        if (pid === "clos") { const g = {}; (v || []).forEach((r) => { (g[clean(r.Domain) || "Other"] = g[clean(r.Domain) || "Other"] || []).push(clean(r.CLO)); }); Object.entries(g).forEach(([d, items]) => { body += para(run(d, { b: true, color: "6B4E71" }), { before: 80 }) + items.map((x, i) => para(run(`${i + 1}. ${x}`), { after: 40 })).join(""); }); return; }
        if (!v || !v.length) return;
        if (label.trim().toLowerCase() !== head.toLowerCase() && pid !== "schedule" && pid !== "assessment") body += para(run(label, { b: true }));
        const ws = pid === "schedule" ? [1100, 1700, 1100, 3700, 1400] : null;
        body += table(kind, v.map((r) => kind.map((c) => clean(r[c]))), ws ? { cols: ws, sz: 18 } : { sz: 19 });
        return;
      }
      if (kind === "area") { if (label.trim().toLowerCase() !== head.toLowerCase()) body += para(run(label, { b: true }), { before: 60 }); body += bullets(v); return; }
      if (["clo_intro", "clo_note", "schedule_note"].includes(pid)) { if (clean(v)) body += para(run(clean(v), { i: pid !== "clo_intro" })); return; }
      body += para(run(label.trim() + ": ", { b: true }) + run(clean(v)), { after: 30 });
    });
    return W.make(body);
  }
  T.docBuilders = Object.assign(T.docBuilders || {}, { syllabus: build });
})();
