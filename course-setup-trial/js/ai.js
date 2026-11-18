/* "Ask the assistant": a button fixed in the bottom-right corner of every page. It opens a help window with the steps for
   the page you are on, its common questions and a search over the questions of all pages. If the user links their own AI
   tool (Claude, ChatGPT, Gemini or an OpenAI-compatible service, with their own account key), the same box can ask it any
   question. The key stays in this browser only and is never put in the data file or backups. Ported from TAMA. */
(function () {
  const T = window.TAMA, S = T.store, esc = T.esc, $ = T.$, $$ = T.$$;
  const H = window.TAMA_HELP;
  const AI_KEY = "tama_ai_settings_v1";
  const PROVIDERS = { claude: "Claude (Anthropic)", openai: "ChatGPT (OpenAI)", gemini: "Gemini (Google)",
    compatible: "Other service with an OpenAI-compatible address (e.g. Ollama, DeepSeek, Azure)" };
  const DEFAULT_MODEL = { claude: "claude-opus-5-5", openai: "", gemini: "", compatible: "" };
  const PAGE_KEY = { "course-setup": "Course setup", "lectures-slos": "Lectures & SLOs" };
  const NAV = ["Dashboard", "Course setup", "Lectures & SLOs", "Assessment plan", "Exam blueprint", "Item analysis", "CLO achievement",
    "Student marks", "Cognitive distribution", "Improvement action plan", "Documents and reports", "Export reports", "Settings"];
  const show = (p) => H.show[p] || p;
  const HELP_SYSTEM = "You are the built-in help assistant of TAMA, a web app that university teachers use to plan course learning " +
    "outcomes (CLOs, SLOs), assessments and exam blueprints, analyse exam results, measure CLO achievement and make NCAAA course " +
    "documents. The user is a teacher, not a technical person. Answer in short, plain steps that name the TAMA page and the box or " +
    "button to use. Use only the TAMA guide below for how the app works; if the guide does not cover it, say so honestly instead of " +
    "inventing buttons. You may also explain assessment ideas (e.g. difficulty factor, CLO, blueprint) in simple words. Answer in the " +
    "language of the question (Arabic or English).";
  T.AI_SYSTEM = "You are an experienced academic quality and assessment adviser helping a university course coordinator write the " +
    "NCAAA/ETEC Course Report (TP-154). Base every statement on the course data you are given; do not invent numbers. When a cause is " +
    "a possibility rather than a fact, say so (for example 'may', 'could'). Write in clear, formal, concise English suitable for an " +
    "official report, without headings or markdown unless asked.";

  /* ---------------------------------------------------------------- settings (this browser only) */
  T.aiSettings = () => { try { return JSON.parse(localStorage.getItem(AI_KEY) || "{}"); } catch (e) { return {}; } };
  const saveSettings = (s) => { try { localStorage.setItem(AI_KEY, JSON.stringify(s)); } catch (e) { T.toast("The AI settings could not be saved in this browser.", "warn"); } };
  T.aiReady = () => {
    const s = T.aiSettings();
    if (!s.enabled || !PROVIDERS[s.provider]) return false;
    if (s.provider === "compatible") return !!(T.s(s.base_url).trim() && T.s(s.model).trim());
    return !!T.s(s.api_key).trim() && (s.provider === "claude" || !!T.s(s.model).trim());
  };

  /* ---------------------------------------------------------------- one request to the linked AI tool */
  async function post(url, body, headers) {
    let r;
    try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error("the AI service could not be reached. Check the internet connection and the address. (Only AI services that accept requests from a web page, such as Claude, ChatGPT and Gemini, work here.)"); }
    const txt = await r.text();
    if (!r.ok) { const err = new Error(`the AI service answered ${r.status}: ${txt.slice(0, 300)}`); err.status = r.status; throw err; }
    try { return JSON.parse(txt); } catch (e) { throw new Error("the AI service sent an answer TAMA could not read. If your internet asks you to sign in (e.g. hotel or campus Wi-Fi), sign in first and try again."); }
  }
  /** images (optional): [{ mime: "image/jpeg", b64: "..." }] - pictures sent with the question (e.g. photos of exam papers). */
  T.aiAsk = async function (prompt, system, maxTokens, quick, images) {
    images = images || [];
    const s = T.aiSettings(), p = s.provider, key = T.s(s.api_key).trim();
    const model = T.s(s.model).trim() || DEFAULT_MODEL[p] || "";
    system = system || T.AI_SYSTEM; maxTokens = maxTokens || 4000;
    if (p === "claude") {
      if (!key) throw new Error("no Claude API key is saved. Add it under Link my AI tool.");
      const body = { model, max_tokens: quick ? maxTokens : Math.max(maxTokens, 16000), system, output_config: { effort: quick ? "low" : "medium" }, messages: [{ role: "user", content: images.length ? [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mime, data: im.b64 } })), { type: "text", text: prompt }] : prompt }] };
      let out;
      try { out = await post("https://api.anthropic.com/v1/messages", body, { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }); }
      catch (e) {
        if (e.status === 401 || e.status === 403) throw new Error("Claude did not accept the API key. Check it under Link my AI tool.");
        if (e.status === 404) throw new Error(`Claude does not know the model '${model}'. Leave the model box empty to use the default.`);
        if (e.status === 429 || e.status === 529) throw new Error("Claude is busy or the account limit was reached. Try again in a minute.");
        throw new Error(e.message.replace("the AI service", "Claude"));
      }
      if (out.stop_reason === "refusal") throw new Error("Claude declined this request.");
      return (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    }
    if (p === "openai" || p === "compatible") {
      let base = p === "openai" ? "https://api.openai.com/v1" : T.s(s.base_url).trim().replace(/\/+$/, "");
      if (!base.endsWith("/chat/completions")) base += "/chat/completions";
      const out = await post(base, { model, messages: [{ role: "system", content: system }, { role: "user", content: images.length ? [...images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.mime};base64,${im.b64}` } })), { type: "text", text: prompt }] : prompt }] }, key ? { Authorization: `Bearer ${key}` } : {});
      try { return out.choices[0].message.content.trim(); } catch (e) { throw new Error(`unexpected answer from the AI service: ${JSON.stringify(out).slice(0, 200)}`); }
    }
    if (p === "gemini") {
      const out = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [...images.map((im) => ({ inline_data: { mime_type: im.mime, data: im.b64 } })), { text: prompt }] }] }, { "x-goog-api-key": key });
      try { return out.candidates[0].content.parts.map((x) => x.text || "").join("").trim(); } catch (e) { throw new Error(`unexpected answer from Gemini: ${JSON.stringify(out).slice(0, 200)}`); }
    }
    throw new Error("no AI tool is linked. Open Link my AI tool in the Ask the assistant window.");
  };
  T.aiJson = async function (prompt) {
    const txt = await T.aiAsk(prompt + "\n\nReply with the JSON only, no other text.");
    const m = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(txt);
    if (!m) throw new Error("the AI answer was not in the expected format. Try again.");
    try { return JSON.parse(m[1]); } catch (e) { throw new Error("the AI answer was not in the expected format. Try again."); }
  };

  /* ---------------------------------------------------------------- help search (same scoring as TAMA) */
  const STOP = new Set("how do does can is are the my in on of to and or an it this that what where why which when with for from me we you be there not get at as".split(" "));
  const words = (t) => (T.s(t).toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []);
  const hit = (w, ws) => ws.some((x) => x === w || (w.length > 2 && x.startsWith(w)) || (x.length > 2 && w.startsWith(x) && w.length - x.length <= 2));
  function search(q) {
    const ws = words(q).filter((w) => w.length > 1 && !STOP.has(w));
    if (!ws.length) return [];
    return H.faq.map(([pg, qu, an]) => {
      const wq = words(qu), wa = words(an + " " + show(pg) + " " + pg);
      return [ws.reduce((n, w) => n + (hit(w, wq) ? 3 : 0) + (hit(w, wa) ? 1 : 0), 0), pg, qu, an];
    }).filter((x) => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 8);
  }
  function guideText() {
    const lines = ["TAMA pages (menu order): " + NAV.map(show).join(", ")];
    NAV.forEach((p) => { if (H.steps[p]) lines.push(`\nPage ${show(p)}:\n` + H.steps[p].map((x) => "- " + x).join("\n")); });
    lines.push("\nCommon questions:");
    H.faq.forEach(([p, q, a]) => lines.push(`Q (${show(p)}): ${q}\nA: ${a}`));
    return lines.join("\n");
  }
  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

  /* ---------------------------------------------------------------- the window */
  let lastAi = null;
  function open() {
    const pg = PAGE_KEY[T.page()] || "Course setup";
    $("#help-wrap").hidden = false; document.body.classList.add("panel-open");
    render(pg, "");
    setTimeout(() => { const q = $("#help-q"); if (q) q.focus(); }, 30);
  }
  const close = () => { $("#help-wrap").hidden = true; document.body.classList.remove("panel-open"); };
  function render(pg, q) {
    const ready = T.aiReady(), s = T.aiSettings();
    const mine = [...H.faq.filter((f) => f[0] === pg), ...H.faq.filter((f) => f[0] === "All pages")];
    const hits = q.trim() ? search(q) : [];
    $("#help-body").innerHTML = `
      <label class="fld" for="help-q"><span class="lbl">Type your question (e.g. how do I add a CLO?)</span>
        <input id="help-q" type="text" value="${esc(q)}" placeholder="Type a few words, e.g. backup, add SLO, Arabic" autocomplete="off" spellcheck="true"></label>
      ${ready ? `<div class="row-btns"><button class="btn primary" id="help-ai">🤖 Ask my AI tool</button><span class="note">Uses your own linked AI tool (${esc(PROVIDERS[s.provider])}). The answer can take up to a minute.</span></div>`
        : `<p class="note">Want answers to any question? Link your own AI tool below. It uses your own AI account, so any cost is billed to you by that service.</p>`}
      <div id="help-ai-out">${lastAi && lastAi.q === q.trim() && lastAi.a ? `<div class="ai-answer"><b>🤖 Your AI tool says:</b><div>${md(lastAi.a)}</div></div>` : ""}</div>
      ${q.trim() ? (hits.length ? `<div class="help-hits">${hits.map(([, hp, hq, ha]) => `<div class="hit"><b>${esc(hq)}</b>${hp === "All pages" ? "" : `<span class="hit-page">Page: ${esc(show(hp))}</span>`}<p>${md(ha)}</p></div>`).join("")}</div>`
        : `<p class="note">No answer found for that. Try other words, or read the steps for this page below.</p>`) : ""}
      <h4>How to use the page ${esc(show(pg))}</h4>
      <ol class="help-steps">${(H.steps[pg] || []).map((x) => `<li>${md(x)}</li>`).join("")}</ol>
      <h4>Common questions</h4>
      ${mine.map(([, qu, an]) => `<details class="faq"><summary>${esc(qu)}</summary><p>${md(an)}</p></details>`).join("")}
      <h4>Link my AI tool (optional)</h4>
      <details class="faq" id="ai-link" ${S.ui.aiOpen ? "open" : ""}><summary>${ready ? `Linked: ${esc(PROVIDERS[s.provider])}` : "Not linked"} · change</summary>
        <p class="note">Link Claude, ChatGPT, Gemini or another AI service with your own account. You need your own API key from that service (it is billed by them).
        The key is kept in this browser only. It is never put in your data file or backups. Only the question and TAMA's help text are sent from this window. TAMA works fully without this.</p>
        <label class="tick"><input type="checkbox" id="ai-on" ${s.enabled ? "checked" : ""}> Use an AI tool</label>
        ${T.select({ id: "ai-prov", label: "AI tool", value: s.provider || "claude", options: Object.entries(PROVIDERS) })}
        <div class="grid g2">
          ${T.field({ id: "ai-model", label: "Model", value: s.model || "", placeholder: { claude: "Leave empty for the default (claude-opus-5-5)", openai: "The model name from OpenAI", gemini: "The Gemini model name from Google AI Studio", compatible: "The model name your service uses" }[s.provider || "claude"] })}
          <label class="fld" for="ai-key"><span class="lbl">API key</span><input id="ai-key" type="password" value="${esc(s.api_key || "")}" autocomplete="off"></label>
        </div>
        ${(s.provider || "claude") === "compatible" ? T.field({ id: "ai-base", label: "Service address (base URL)", value: s.base_url || "", placeholder: "e.g. http://localhost:11434/v1" }) : ""}
        <div class="row-btns"><button class="btn primary sm" id="ai-save">Save</button><button class="btn sm" id="ai-test">Test the connection</button></div>
        <p class="note" id="ai-msg"></p></details>`;
    const qi = $("#help-q");
    qi.addEventListener("input", T.debounce(() => { const pos = qi.selectionStart; render(pg, qi.value); const n = $("#help-q"); n.focus(); n.setSelectionRange(pos, pos); }, 250));
    const ab = $("#help-ai");
    if (ab) ab.onclick = async () => {
      const qq = $("#help-q").value.trim(), out = $("#help-ai-out");
      if (!qq) { out.innerHTML = `<p class="warn-text">Type your question in the box first.</p>`; return; }
      out.innerHTML = `<p class="note">Asking your AI tool...</p>`; ab.disabled = true;
      try {
        const a = await T.aiAsk("TAMA guide:\n" + guideText() + "\n\nThe user is on the page: " + show(pg) + "\n\nThe user's question:\n" + qq, HELP_SYSTEM, 2000, true);
        lastAi = { q: qq, a }; out.innerHTML = `<div class="ai-answer"><b>🤖 Your AI tool says:</b><div>${md(a)}</div></div>`;
      } catch (e) { out.innerHTML = `<p class="warn-text">Your AI tool could not answer: ${esc(e.message)}</p>`; }
      ab.disabled = false;
    };
    $("#ai-link").addEventListener("toggle", (e) => { S.ui.aiOpen = e.target.open; S.saveUi(); });
    const read = () => ({ enabled: $("#ai-on").checked, provider: $("#ai-prov").value, model: $("#ai-model").value.trim(), api_key: $("#ai-key").value.trim(), base_url: $("#ai-base") ? $("#ai-base").value.trim() : "" });
    $("#ai-prov").onchange = () => { saveSettings({ ...read(), model: "", api_key: "" }); render(pg, $("#help-q").value); };
    $("#ai-save").onclick = () => { const v = read(); saveSettings(v); T.toast(v.enabled ? "AI settings saved." : "AI assistant turned off."); render(pg, $("#help-q").value); T.renderAiButtons && T.renderAiButtons(); };
    $("#ai-test").onclick = async () => {
      saveSettings(read()); const m = $("#ai-msg"); m.textContent = "Asking the AI tool...";
      try { const a = await T.aiAsk("Reply with the single word: ready", null, 50, true); m.className = "ok-text"; m.textContent = `Connected. The AI tool answered: ${a.slice(0, 80)}`; }
      catch (e) { m.className = "warn-text"; m.textContent = `Not connected: ${e.message}`; }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#help-btn").onclick = open;
    $("#help-close").onclick = close;
    $("#help-wrap").addEventListener("click", (e) => { if (e.target.id === "help-wrap") close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); const dp = $("#data-panel"); if (dp && !dp.hidden) $("#data-close").click(); } });
  });
})();
