/* Help text of the Ask the assistant window, copied from TAMA (HELP_STEPS and HELP_FAQ in app.py). */
window.TAMA_HELP = {
"steps": {
"Dashboard": [
"This page shows **all your courses** in one list, sorted by code, year and term.",
"Pick a course in the list to see its summary numbers and charts.",
"No courses yet? Go to **Course setup** and add your first course.",
"Open **Check my data (all courses)** to see what is still missing in each course."
],
"Course setup": [
"Add a course in **New course** (type the code, e.g. dent301 becomes DENT 301).",
"Teaching the same course in another term? Add it again with the new term and year; you can copy its PLOs, CLOs and SLOs from the earlier offering.",
"Fill in **Course details** (they are used later in the Course Specification and Course Report).",
"Add the **PLOs** of the program that this course serves.",
"Add the **CLOs** in the **➕ Add CLOs** box (type one, or import a file). Choose where it goes in the list with **Where to put this CLO**.",
"Edit, reorder or delete CLOs directly in the CLO table. Everything saves by itself."
],
"Lectures & SLOs": [
"Pick the course at the top.",
"Add SLOs in the **➕ Add SLOs** box: type one (with its lecture / topic and its CLO), or import an Excel file.",
"Each SLO belongs to one CLO. Choose \"(None)\" only if it does not belong to any CLO.",
"Edit, reorder or delete SLOs directly in the SLO table."
],
"Assessment plan": [
"Pick the course, then choose whether the plan is built on **CLOs** or **SLOs**.",
"Tick which assessment methods (MCQ, Short Essay, Long Essay, projects ...) measure each outcome.",
"Need another method? Use **Add a column**: pick one from the list or type its name.",
"Fill in the **Summative** table (order, weights and grading breakdown) and the **Formative** table."
],
"Exam blueprint": [
"Pick the course and the assessment (or choose **New** to start a new exam).",
"Enter the exam duration and revision time, then press **Save exam details** once for a new exam.",
"Section 1 tells you **how many questions** of each type and domain fit the time.",
"Section 2 (**Question mapping**): add each question and link it to one SLO, or import questions from a file.",
"Your questions are kept in the **question bank** of the course code, so you can reuse them in later terms."
],
"Item analysis": [
"This page has two tabs: **Item analysis (difficulty factor)** and **Student marks**.",
"Item analysis: pick the test, say if it was made in this app, then upload the Question Mark or Condensed Test Report PDF.",
"TAMA shows the difficulty and discrimination of each question and flags the weak ones.",
"Student marks: paste the marks from Excel into the students x questions grid (Ctrl+V), or enter only the totals."
],
"CLO achievement": [
"Choose how CLO achievement is measured: from **Item analysis**, from **Student marks**, or **Compare** both.",
"Follow the steps on the page; a tick shows each step that is done.",
"Read the achievement table: each CLO's result against its target.",
"If a step is empty, the page tells you which page to fill in first."
],
"Student marks": [
"This is the whole-course mark sheet: one row per student.",
"Paste the marks from Excel (Ctrl+V fills all the picked cells at once).",
"The older question-level form is under **Advanced**."
],
"Cognitive distribution": [
"Pick the course to see how its exam questions spread over the cognitive levels.",
"The levels come from the questions you entered in **Exam blueprint**."
],
"Improvement action plan": [
"Write the improvement plan for this offering.",
"Review the actions from the last offering: how much was achieved (%) and your comments.",
"Add the overall student evaluation and comments."
],
"Documents and reports": [
"Pick the course and the language (English or Arabic).",
"Choose a box: Course Specification, Syllabus, Course Report, Student grades or CLO achievement level, and download the Word file.",
"Fields that come from earlier pages are locked here. \"Fill in ... page\" tells you where to type them.",
"Only information that is not stored anywhere else is typed on this page (marked with ✏)."
],
"Export reports": [
"**Fill forms with my course data**: add your own Word, Excel or PDF form, and TAMA fills it with the course data.",
"Check the readiness table to see what is still missing.",
"Download the visual report, all data in Excel, or a backup file of a course."
],
"Settings": [
"Change the look, your faculty and university names, and the banner texts.",
"Add your logos and the forms you fill in often.",
"Make a backup (**Download all my data**), restore an earlier copy, or delete a course."
]
},
"faq": [
[
"All pages",
"Do I need to press Save?",
"No, not to keep what you type: every entry saves itself as soon as you type it or leave the box. A few buttons (for example **Save new course** or **Save exam details**) create something new: press them once to create it."
],
[
"All pages",
"Where is my data kept?",
"On your own computer: inside this browser, and (in Chrome or Edge) also in a folder you choose once on the start page, for example a OneDrive folder. Nothing is kept on anyone else's server."
],
[
"All pages",
"Can I use Safari or a Mac?",
"TAMA opens in any modern browser, but keeping your data in a folder works only in Chrome and Edge. On a Mac, use Chrome."
],
[
"All pages",
"How do I make a backup of my data?",
"Go to Settings and press **Download all my data (backup file)**. Keep that file somewhere safe, e.g. OneDrive."
],
[
"All pages",
"I deleted or changed something by mistake. Can I get it back?",
"Yes. Go to Settings: TAMA keeps dated backups of your data, and you can restore an earlier one."
],
[
"All pages",
"How do I paste many cells from Excel at once?",
"Copy the cells in Excel, click the first cell (or pick several cells) in the TAMA table and press Ctrl+V. All picked cells are filled."
],
[
"All pages",
"The page looks old or a new change is missing.",
"Press Ctrl+Shift+R (on a Mac: Cmd+Shift+R) to load the newest version of TAMA."
],
[
"All pages",
"Which course am I working on?",
"The course banner at the top of every page shows the chosen course (code, name, term and year)."
],
[
"All pages",
"What is the right order to fill TAMA in?",
"Course setup (course, PLOs, CLOs) > Lectures & SLOs > Assessment plan > Exam blueprint > Exam results > CLO achievement > Improvement action plan > Documents and reports. The progress bar at the top of each page shows what is done."
],
[
"All pages",
"Can I open TAMA in two tabs?",
"Please use one browser tab only. Two tabs can overwrite each other's changes."
],
[
"Course setup",
"How do I add a course?",
"On Course setup, fill in **New course** (code, name, term, year). The code is written in capitals automatically, e.g. DENT 301."
],
[
"Course setup",
"I teach the same course again this term. Do I start from zero?",
"No. Add the course again with the new term and year, and choose to copy the PLOs, CLOs and SLOs from the earlier offering."
],
[
"Course setup",
"How do I add a CLO?",
"Use the **➕ Add CLOs** box under the CLO table. Type the CLO, pick its domain and where it goes in the list. You can also import CLOs from a file."
],
[
"Course setup",
"How do I delete or reorder a CLO?",
"Do it directly in the CLO table on Course setup."
],
[
"Course setup",
"How do I delete a course?",
"On Course setup open **Delete <course>** under Course details, tick Yes and press Delete. You can also do it in Settings."
],
[
"Lectures & SLOs",
"How do I add an SLO?",
"On Lectures & SLOs, use the **➕ Add SLOs** box: type the SLO, its lecture / topic and its CLO. You can also import an Excel file."
],
[
"Lectures & SLOs",
"Is there a template for importing CLOs and SLOs?",
"Yes. The import area offers one shared Excel template for CLOs and SLOs. Download it, fill it in and upload it."
],
[
"Assessment plan",
"How do I add an assessment method that is not in the list?",
"On Assessment plan use **Add a column**: pick a method from the list or type its name. It is added at once."
],
[
"Assessment plan",
"What are the 4 method types?",
"Test-based, Performance-based, Indirect and Others. You can change the type of each method on the Assessment plan page."
],
[
"Exam blueprint",
"How many questions should my exam have?",
"On Exam blueprint, section 1 works it out from the exam duration and the minutes needed per question type and domain."
],
[
"Exam blueprint",
"How do I link a question to an SLO?",
"In Exam blueprint, section 2 (Question mapping): each question is linked to one SLO."
],
[
"Exam blueprint",
"Can I reuse questions from an earlier term?",
"Yes. Questions are kept in the question bank of the course code; pick them from the bank in Exam blueprint."
],
[
"Exam blueprint",
"How do I rename, join or delete an exam?",
"In Exam blueprint, pick the exam: the options to rename, join with another exam or delete it are on that page."
],
[
"Item analysis",
"Which file do I upload for item analysis?",
"The PDF report of the test: Question Mark or Condensed Test Report. Upload it in the Item analysis tab of Exam results."
],
[
"Item analysis",
"How do I enter student marks?",
"Exam results > Student marks tab: paste the marks from Excel into the grid with Ctrl+V, or enter only each student's total."
],
[
"Item analysis",
"My test has parts (e.g. written + practical).",
"Use the parts of a test option in the Student marks tab. The parts must add up to the full mark."
],
[
"CLO achievement",
"My CLO achievement is empty.",
"CLO achievement needs the CLOs, the SLOs linked to them, the exam questions linked to SLOs, and the results (item analysis or student marks). The page tells you which step is missing."
],
[
"CLO achievement",
"What is the difference between the methods?",
"Item analysis uses each question's result; Student marks uses each student's marks; Compare shows both side by side in a chart."
],
[
"Documents and reports",
"Why can I not type in some boxes of a document?",
"Those boxes come from earlier pages (e.g. Course setup) and are locked so the data is never typed twice. \"Fill in ... page\" tells you where to type it."
],
[
"Documents and reports",
"Which NCAAA form does TAMA use?",
"It is chosen from the program level in Course setup: Diploma and Bachelor use the undergraduate forms, Master and PhD use the postgraduate forms."
],
[
"Documents and reports",
"Can I get the Course Specification in Arabic?",
"Yes. On Documents and reports choose Arabic as the language of the Word file."
],
[
"Export reports",
"Can TAMA fill in my own form?",
"Yes. On Export reports use **Fill forms with my course data**: add your Word, Excel or fillable PDF form and TAMA fills it."
],
[
"Dashboard",
"What does the Overview page show?",
"All your courses in one list, and for the chosen course its summary numbers, charts and what still needs attention."
],
[
"Dashboard",
"How do I link my own AI tool?",
"On the Overview page open **AI assistant (optional): link your AI tool**, choose your AI (Claude, ChatGPT, Gemini ...), paste your API key from that service and press Save. It is billed to your own AI account."
],
[
"Student marks",
"What is the Course mark sheet?",
"One row per student with the marks of the whole course (all assessments) and the total out of 100. Paste them from Excel with Ctrl+V."
],
[
"Student marks",
"Where do I enter the marks of each exam question?",
"In Exam results > Student marks tab (students x questions grid). The older form is under Advanced on the Course mark sheet."
],
[
"Cognitive distribution",
"Why is the cognitive distribution empty?",
"It needs the exam questions with their cognitive level, entered in Exam blueprint."
],
[
"Improvement action plan",
"Where do last term's actions come from?",
"From the improvement plan of the earlier offering of the same course. Fill in how much was achieved (%) and your comments."
],
[
"Settings",
"How do I add my faculty logo?",
"Go to Settings > Logos and add a PNG or JPG file."
]
],
"show": {
"Dashboard": "Overview",
"Item analysis": "Exam results",
"Student marks": "Course mark sheet"
}
};
