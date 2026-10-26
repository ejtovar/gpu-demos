/* Builds runoff, supersonic and stratus and assembles site/ for GitHub Pages:
 *   site/index.html                launcher
 *   site/<app>/index.html          the app's single-file build + install tags
 *   site/<app>/manifest.webmanifest, sw.js, icon-*.png
 * Each app folder is its own installable web app (scope = its folder). */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const HOME = process.env.HOME;
const APPS = [
  { id: 'runoff', dir: `${HOME}/Projects/runoff`, out: 'dist/runoff.html', name: 'Runoff', short: 'Runoff', color: '#1c2522',
    desc: 'Flash floods on your GPU: ryujin shallow water in the browser.' },
  { id: 'supersonic', dir: `${HOME}/Projects/supersonic`, out: 'dist/supersonic.html', name: 'Supersonic', short: 'Supersonic', color: '#1c2522',
    desc: 'Drag a cylinder through a Mach 3 stream: ryujin Euler in the browser.' },
  { id: 'stratus', dir: `${HOME}/Projects/stratus`, out: 'dist/stratus.html', name: 'Stratus', short: 'Stratus', color: '#1c2522',
    desc: 'Wind over mountains you draw, in a stratified atmosphere: ryujin Euler with gravity.' },
];
const site = path.resolve('docs');
const skipBuild = process.argv.includes('--no-build');

for (const app of APPS) {
  if (!skipBuild) execSync('npm run -s build', { cwd: app.dir, stdio: 'inherit' });
  let html = fs.readFileSync(path.join(app.dir, app.out), 'utf8');
  const version = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);
  const headTags = `<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-180.png">\n`;
  const swTag = `<script>if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");</script>\n`;
  html = html.replace('</head>', headTags + '</head>').replace('</body>', swTag + '</body>');
  const dir = path.join(site, app.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify({
    name: app.name, short_name: app.short, description: app.desc,
    start_url: './', scope: './', display: 'standalone', orientation: 'any',
    background_color: app.color, theme_color: app.color,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, null, 2));
  /* network first (always fresh when online), cache as offline fallback */
  fs.writeFileSync(path.join(dir, 'sw.js'), `const CACHE = "${app.id}-${version}";
const FILES = ["./", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("${app.id}-") && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
`);
  console.log(`${app.id}: ${(html.length / 1024).toFixed(0)} kB, version ${version}`);
}

fs.writeFileSync(path.join(site, '.nojekyll'), '');
fs.writeFileSync(path.join(site, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>GPU fluid demos</title>
<meta name="theme-color" content="#1c2522">
<link rel="icon" type="image/png" href="supersonic/icon-192.png">
<style>
  :root { --bg: #e7ece7; --panel: #f5f7f4; --ink: #1c2925; --muted: #56665f; --line: #c7d1ca; --accent: #245f9f; }
  @media (prefers-color-scheme: dark) { :root { --bg: #141b19; --panel: #1c2522; --ink: #e2e9e5; --muted: #93a39c; --line: #33413b; --accent: #72a9df; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    padding: max(1.5rem, env(safe-area-inset-top)) 16px max(1.5rem, env(safe-area-inset-bottom)); }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  a { color: var(--accent); }
  p.lead { color: var(--muted); margin: 0 0 1.5rem; }
  a.app { display: flex; gap: 1rem; align-items: center; padding: 1rem; margin-bottom: 0.9rem; background: var(--panel);
    border: 1px solid var(--line); border-radius: 14px; color: inherit; text-decoration: none; }
  a.app:hover, a.app:focus-visible { border-color: var(--accent); outline: none; }
  a.app img { width: 72px; height: 72px; border-radius: 16px; flex: none; }
  a.app h2 { margin: 0; font-size: 1.15rem; }
  a.app p { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.92rem; }
  .note { color: var(--muted); font-size: 0.88rem; border-top: 1px solid var(--line); padding-top: 1rem; margin-top: 1.5rem; }
  .note b { color: var(--ink); }
</style>
</head>
<body>
<main>
  <h1>GPU fluid demos</h1>
  <p class="lead">Finite element solvers from <a href="https://github.com/conservation-laws/ryujin">ryujin</a>, ported to WebGPU. They run entirely on your device's GPU.</p>
${APPS.map((a) => `  <a class="app" href="${a.id}/"><img src="${a.id}/icon-192.png" alt=""><div><h2>${a.name}</h2><p>${a.desc}</p></div></a>`).join('\n')}
  <div class="note">
    <p><b>Install on a phone:</b> open an app, then on iPhone tap Share → <i>Add to Home Screen</i>; on Android tap the menu → <i>Install app</i>. It then opens full screen, like an app, and works offline.</p>
    <p><b>Needs WebGPU:</b> Chrome or Edge on Mac, Windows and Android; Safari on iOS/iPadOS 26 and macOS 26 or newer. On an older Mac, Safari can turn it on: Settings → Advanced → <i>Show features for web developers</i>, then Develop → Feature Flags → <i>WebGPU</i>.</p>
  </div>
</main>
</body>
</html>
`);
console.log('docs/ ready');
