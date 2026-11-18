// TAMA installable app helper (_INSTALL_APP_V1).
// It keeps NO copies of TAMA: every page load still comes fresh from the internet, so updates arrive as before.
// It only shows a friendly page when TAMA's window is opened with no internet connection.
const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TAMA</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6fa;
font:16px system-ui,sans-serif;color:#1f2937}.c{background:#fff;border-radius:14px;padding:28px 32px;max-width:420px;
box-shadow:0 4px 20px rgba(0,0,0,.08);text-align:center}h1{color:#14365d;font-size:22px;margin:0 0 10px}button{margin-top:14px;
background:#1b998b;color:#fff;border:0;border-radius:9px;padding:10px 18px;font-size:15px;cursor:pointer}</style></head>
<body><div class="c"><h1>No internet connection</h1><p>TAMA needs the internet to open. Your courses are safe on this computer.</p>
<p>Connect to the internet, then press the button.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();   // no extra wait when TAMA opens
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;           // everything else goes straight to the internet, untouched
  e.respondWith((async () => (await e.preloadResponse) || fetch(e.request))().catch(() =>
    new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
