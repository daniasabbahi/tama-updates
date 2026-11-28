/* Sign-in (Dania 2026-11-28): the same Firebase project and accounts as the current TAMA (tama-848ff, email + password,
   email confirmation, password reset). Who gets in:
   - a confirmed @kau.edu.sa email (not stu.kau.edu.sa): free trial until the end of 30 September 2027, Riyadh time;
   - anyone else: only if the owner added them (Firestore subscribers/<email>). The check is TAMA's: the database lets
     the user read keys/app only when its own rules allow them.
   Course data never goes to Firebase: only the sign-in does. On this computer (localhost) the sign-in is skipped for the
   tests unless the address has ?gate=1. */
const KAU_TRIAL_END = Date.parse("2027-09-30T21:00:00Z");   // 1 October 2027, 00:00 in Riyadh
const isKau = (e) => /@kau\.edu\.sa$/i.test((e || "").trim());
const local = ["localhost", "127.0.0.1"].includes(location.hostname) && !new URLSearchParams(location.search).has("gate");
const $ = (id) => document.getElementById(id);
const html = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function unlock(text) {
  document.body.classList.remove("locked");
  const g = $("gate"); if (g) g.hidden = true;
  const w = $("who-bar"); if (w) { w.hidden = !text; w.innerHTML = text || ""; const o = $("sign-out"); if (o) o.onclick = (e) => { e.preventDefault(); window.__tamaSignOut && window.__tamaSignOut(); }; }
}
window.TAMA_AUTH = { isKau, KAU_TRIAL_END };

if (local) unlock("");
else {
  document.body.classList.add("locked");
  const box = $("gate");
  box.hidden = false;
  box.innerHTML = `<div class="gate-card">
    <div class="gate-band"><small>Teaching · Assessment · Measuring achievement</small><h1>TAMA</h1></div>
    <p class="gate-note">Sign in with your TAMA account. Your courses and marks stay on this computer and are not sent to any server.</p>
    <div id="g-signin" class="gate-view" hidden>
      <div class="gate-tabs"><button type="button" id="g-tin" class="on">Sign in</button><button type="button" id="g-tnew">Create account</button></div>
      <label for="g-em">Email</label><input type="email" id="g-em" autocomplete="username" placeholder="name@kau.edu.sa">
      <label for="g-pw">Password</label><input type="password" id="g-pw" autocomplete="current-password">
      <p class="gate-muted" id="g-newnote" hidden>Free trial for KAU staff with an @kau.edu.sa email until 30 September 2027. We send a link to your email to confirm it is yours.</p>
      <button class="btn primary gate-go" id="g-auth" type="button">Sign in</button>
      <p class="gate-muted"><a href="#" id="g-forgot">Forgot password?</a></p>
    </div>
    <div id="g-verify" class="gate-view" hidden>
      <p>We sent a link to <b id="g-vmail"></b>. Open that email, click the link, then come back and press the button below. (Check the junk folder too.)</p>
      <button class="btn primary gate-go" id="g-checked" type="button">I clicked the link</button>
      <p class="gate-muted"><a href="#" id="g-resend">Send the email again</a> · <a href="#" class="g-out">Sign out</a></p>
    </div>
    <div id="g-nosub" class="gate-view" hidden>
      <p>You are signed in as <b id="g-nmail"></b>.</p><p id="g-nowhy"></p>
      <p class="gate-muted"><a href="#" id="g-recheck">Check again</a> · <a href="#" class="g-out">Sign out</a></p>
    </div>
    <div id="g-wait" class="gate-view"><p class="gate-muted">Checking your sign-in…</p></div>
    <div id="g-err" class="gate-err" hidden></div>
  </div>`;
  const VIEWS = ["g-signin", "g-verify", "g-nosub", "g-wait"];
  const show = (id) => VIEWS.forEach((v) => { $(v).hidden = v !== id; });
  const err = (t) => { $("g-err").textContent = t || ""; $("g-err").hidden = !t; };
  const MSG = { "auth/invalid-credential": "The email or password is not right.", "auth/wrong-password": "The email or password is not right.",
    "auth/user-not-found": "There is no account with this email yet. Choose “Create account”.", "auth/email-already-in-use": "This email already has an account. Choose “Sign in”.",
    "auth/weak-password": "Please use a password with at least 6 characters.", "auth/invalid-email": "Please check the email address.",
    "auth/too-many-requests": "Too many tries. Please wait a few minutes and try again.", "auth/network-request-failed": "No internet connection. Please check it and try again." };
  const say = (e) => MSG[e && e.code] || `Something went wrong (${(e && (e.code || e.message)) || "unknown"}).`;
  try {
    const F = await import("../vendor/firebase-bundle.js");
    const app = F.initializeApp({ apiKey: "AIzaSyDNdIsV1T3aH1slwelMF05RApnRI_pwecA", authDomain: "tama-848ff.firebaseapp.com",
      projectId: "tama-848ff", storageBucket: "tama-848ff.firebasestorage.app", messagingSenderId: "1091477469921", appId: "1:1091477469921:web:077855e2626d84e21515a0" });
    const auth = F.getAuth(app), db = F.getFirestore(app);
    let creating = false;
    const out = async (e) => { e && e.preventDefault(); await F.signOut(auth); location.reload(); };
    window.__tamaSignOut = out;
    document.querySelectorAll(".g-out").forEach((a) => (a.onclick = out));
    async function after(user) {
      err("");
      if (!user) { show("g-signin"); return; }
      if (!user.emailVerified) { $("g-vmail").textContent = user.email; show("g-verify"); return; }
      show("g-wait");
      const kau = isKau(user.email), now = Date.now();
      if (kau && now >= KAU_TRIAL_END) {
        $("g-nmail").textContent = user.email; $("g-nowhy").textContent = "The free trial for KAU staff ended on 30 September 2027. Please contact the TAMA team to continue."; show("g-nosub"); return;
      }
      let allowed = false;
      try { await user.getIdToken(true); const d = await F.getDoc(F.doc(db, "keys", "app")); allowed = d.exists(); } catch (e) { allowed = false; }
      if (!allowed && kau) allowed = true;   // a confirmed KAU email inside the trial period gets in even if the database check cannot be reached
      if (allowed) {
        unlock(`<span>${html(user.email)}${kau ? ` · <span class="who-trial">free trial until 30 Sep 2027</span>` : ""}</span> · <a href="#" id="sign-out">Sign out</a>`);
      } else {
        $("g-nmail").textContent = user.email;
        $("g-nowhy").textContent = /@stu\.kau\.edu\.sa$/i.test(user.email) ? "TAMA is for KAU staff. Student emails (stu.kau.edu.sa) are not included." : "TAMA has a free trial for KAU staff with an @kau.edu.sa email. For other users, subscriptions will open soon.";
        show("g-nosub");
      }
    }
    F.onAuthStateChanged(auth, after);
    const setTab = (isNew) => { creating = isNew; $("g-tin").classList.toggle("on", !isNew); $("g-tnew").classList.toggle("on", isNew); $("g-newnote").hidden = !isNew; $("g-auth").textContent = isNew ? "Create account" : "Sign in"; $("g-pw").autocomplete = isNew ? "new-password" : "current-password"; err(""); };
    $("g-tin").onclick = () => setTab(false); $("g-tnew").onclick = () => setTab(true);
    $("g-auth").onclick = async () => {
      const em = $("g-em").value.trim(), pw = $("g-pw").value; err("");
      if (!em || !pw) { err("Please type your email and a password."); return; }
      $("g-auth").disabled = true;
      try { if (creating) { const c = await F.createUserWithEmailAndPassword(auth, em, pw); await F.sendEmailVerification(c.user); after(c.user); } else await F.signInWithEmailAndPassword(auth, em, pw); }
      catch (e) { err(say(e)); }
      $("g-auth").disabled = false;
    };
    $("g-pw").addEventListener("keydown", (e) => { if (e.key === "Enter") $("g-auth").click(); });
    $("g-checked").onclick = async () => { if (!auth.currentUser) return; await F.reload(auth.currentUser); if (!auth.currentUser.emailVerified) err("The email is not confirmed yet. Click the link in the email first."); else after(auth.currentUser); };
    $("g-resend").onclick = async (e) => { e.preventDefault(); try { await F.sendEmailVerification(auth.currentUser); err(""); $("g-resend").textContent = "Sent again"; } catch (x) { err(say(x)); } };
    $("g-forgot").onclick = async (e) => { e.preventDefault(); const em = $("g-em").value.trim(); if (!em) { err("Type your email first, then click “Forgot password?”."); return; }
      try { await F.sendPasswordResetEmail(auth, em); err(""); $("g-forgot").textContent = "Password email sent"; } catch (x) { err(say(x)); } };
    $("g-recheck").onclick = (e) => { e.preventDefault(); after(auth.currentUser); };
  } catch (e) {
    show("g-signin"); err("The sign-in could not load. Please check the internet connection and reload the page.");
  }
}
