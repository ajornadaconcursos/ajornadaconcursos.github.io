/* A Jornada — service worker.
   O painel abre PDFs e imagens pelo endereço "/_blob/<id>". Aqui esse endereço é atendido
   buscando o arquivo no Storage do seu Supabase, com o login de quem está usando. */
let AUTH = null;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("message", e => { const d = e.data || {}; if (d.t === "auth" && d.token) AUTH = d; });

async function askAuth() {
  const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of cs) {
    const r = await new Promise(ok => {
      const ch = new MessageChannel(); ch.port1.onmessage = ev => ok(ev.data);
      try { c.postMessage({ t: "need-auth" }, [ch.port2]); } catch (e) { ok(null); }
      setTimeout(() => ok(null), 2000);
    });
    if (r && r.token) { AUTH = r; return true; }
  }
  return false;
}

async function blob(req, id) {
  if (!AUTH) await askAuth();
  for (let k = 0; k < 2; k++) {
    if (!AUTH) return new Response("Entre na sua conta para ver este arquivo.", { status: 401 });
    const h = new Headers({ Authorization: "Bearer " + AUTH.token, apikey: AUTH.key });
    const range = req.headers.get("range"); if (range) h.set("range", range);
    const url = AUTH.url + "/storage/v1/object/authenticated/arquivos/" + AUTH.uid + "/" + id;
    const r = await fetch(url, { method: req.method === "HEAD" ? "HEAD" : "GET", headers: h });
    if ((r.status === 400 || r.status === 401 || r.status === 403) && k === 0) { AUTH = null; await askAuth(); continue; }
    return r;
  }
}

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  const m = u.pathname.match(/^\/_blob\/([0-9a-f]{32})/i);
  if (m) e.respondWith(blob(e.request, m[1].toLowerCase()));
});
