/* A Jornada — ponte entre o painel e o Supabase.
   O painel foi escrito para rodar dentro do Claude, onde existe window.claude.use("db" | "user" | "assets" | "sample" | "downloads").
   Este arquivo oferece exatamente essas mesmas funções, só que guardando tudo no SEU Supabase e usando a SUA chave da IA.
   Assim o código do painel continua igual ao do Claude, e as correções feitas lá podem ser trazidas para cá sem retrabalho. */
(function () {
  "use strict";
  const CFG = window.JORNADA_CONFIG || {};
  const SB_URL = String(CFG.SUPABASE_URL || "").replace(/\/+$/, "");
  const SB_KEY = String(CFG.SUPABASE_ANON_KEY || "");
  const BUCKET = "arquivos";
  const LIM = { images: { maxCount: 8, maxBytes: 5 * 1024 * 1024 } };

  let sb = null, UID = null, EMAIL = "", TOKEN = "", IMPORTING = false;
  let readyRes; const READY = new Promise(r => (readyRes = r));

  const mkErr = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const httpCode = s => (s === 429 || s === 529 ? "rate_limited" : s === 413 ? "too_large" : s === 401 || s === 403 ? "forbidden" : s >= 500 || !s ? "upstream_error" : "bad_request");
  const pgErr = e => mkErr(/payload|too large/i.test(e && e.message || "") ? "too_big" : "upstream_error", e && e.message);
  const stErr = e => { const s = Number(e && (e.statusCode || e.status)) || 0; return mkErr(httpCode(s), e && e.message); };
  const hex32 = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, "0")).join(""); };
  const lastSeg = p => p.slice(p.lastIndexOf("/") + 1);
  const parentOf = p => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
  const clone = d => (d === undefined || d === null ? d : JSON.parse(JSON.stringify(d)));

  /* ---------- banco de dados (tabela "docs") ---------- */
  const T = () => sb.from("docs");
  const snap = (id, d) => ({ id, exists: d !== undefined && d !== null, data: () => clone(d) });
  async function put(path, obj) {
    if (IMPORTING) return;
    const { error } = await T().upsert({ user_id: UID, path, parent: parentOf(path), data: clone(obj), updated_at: new Date().toISOString() }, { onConflict: "user_id,path" });
    if (error) throw pgErr(error);
  }
  const db = {
    doc(path) {
      path = String(path).replace(/\/+$/, "");
      const id = lastSeg(path);
      const ref = {
        id, path,
        async get() { const { data, error } = await T().select("data").eq("path", path).maybeSingle(); if (error) throw pgErr(error); return snap(id, data ? data.data : undefined); },
        async set(obj) { await put(path, obj); },
        async update(obj) { const cur = await ref.get(); await put(path, Object.assign(cur.exists ? cur.data() : {}, obj)); },
        async delete() { if (IMPORTING) return; const { error } = await T().delete().eq("path", path); if (error) throw pgErr(error); }
      };
      return ref;
    },
    collection(path) {
      path = String(path).replace(/\/+$/, "");
      return {
        doc: id => db.doc(path + "/" + id),
        async get() {
          const rows = []; const N = 500;
          for (let from = 0; ; from += N) {
            const { data, error } = await T().select("path,data").eq("parent", path).order("path").range(from, from + N - 1);
            if (error) throw pgErr(error);
            rows.push(...(data || []));
            if (!data || data.length < N) break;
          }
          const docs = rows.map(r => snap(lastSeg(r.path), r.data));
          return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) };
        }
      };
    }
  };

  /* ---------- arquivos (PDFs, imagens) no Storage ---------- */
  const objPath = id => UID + "/" + id;
  async function putObj(id, blob, upsert) {
    const { error } = await sb.storage.from(BUCKET).upload(objPath(id), blob, { contentType: blob.type || "application/octet-stream", upsert: !!upsert, cacheControl: "31536000" });
    if (error) throw stErr(error);
  }
  const assets = {
    async upload(blob) { if (!(blob instanceof Blob)) blob = new Blob([blob]); const id = hex32(); await putObj(id, blob, false); return { id, url: "/_blob/" + id, size: blob.size, contentType: blob.type }; },
    async delete(id) { const { error } = await sb.storage.from(BUCKET).remove([objPath(String(id))]); if (error) throw stErr(error); }
  };
  const blobUrl = id => SB_URL + "/storage/v1/object/authenticated/" + BUCKET + "/" + objPath(id);

  /* Endereços "/_blob/<id>" usados pelo painel: o service worker (sw.js) atende <img>, links e o leitor de PDF.
     Este desvio do fetch cobre o caso de o service worker ainda não estar ativo. */
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const u = typeof input === "string" ? input : input && input.url;
      const m = u && String(u).match(/^(?:https?:\/\/[^/]+)?\/_blob\/([0-9a-f]{32})/i);
      if (m && (!/^https?:/i.test(u) || new URL(u).origin === location.origin) && !(navigator.serviceWorker && navigator.serviceWorker.controller)) {
        return READY.then(() => {
          const h = new Headers((init && init.headers) || (input && input.headers) || {});
          h.set("Authorization", "Bearer " + TOKEN); h.set("apikey", SB_KEY);
          return nativeFetch(blobUrl(m[1]), Object.assign({}, init, { headers: h }));
        });
      }
    } catch (e) { }
    return nativeFetch(input, init);
  };

  /* ---------- IA (Edge Function "ai", com a sua chave da Anthropic) ---------- */
  async function toB64(blob) { const b = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  async function shrink(blob) {
    if (blob.size <= 3.5 * 1024 * 1024 && /^image\/(jpeg|png|gif|webp)$/.test(blob.type)) return blob;
    const bm = await createImageBitmap(blob); const k = Math.min(1, 2000 / Math.max(bm.width, bm.height));
    const c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  }
  async function fileBlock(f) {
    if (f && f.type === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: await toB64(f) } };
    const b = await shrink(f); return { type: "image", source: { type: "base64", media_type: b.type || "image/jpeg", data: await toB64(b) } };
  }
  function parseJSON(t) {
    t = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try { return JSON.parse(t); } catch (e) { }
    const a = t.search(/[{[]/), z = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && z > a) { try { return JSON.parse(t.slice(a, z + 1)); } catch (e) { } }
    throw mkErr("bad_json", "A IA não devolveu JSON válido");
  }
  async function callAI(input, opts, json) {
    opts = opts || {}; await READY;
    let messages = typeof input === "string" ? [{ role: "user", content: input }]
      : Array.isArray(input) ? input.map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: m && m.content != null ? m.content : "" }))
        : [{ role: "user", content: String(input) }];
    const last = messages[messages.length - 1];
    let blocks = typeof last.content === "string" ? [{ type: "text", text: last.content }] : [...last.content];
    if (opts.images && opts.images.length) { const ims = []; for (const f of [...opts.images].slice(0, LIM.images.maxCount)) ims.push(await fileBlock(f)); blocks = [...ims, ...blocks]; }
    if (json) blocks.push({ type: "text", text: "Responda somente com JSON válido, sem nenhum texto antes ou depois." });
    last.content = blocks;
    const stream = typeof opts.onText === "function" && !json;
    const r = await nativeFetch(SB_URL + "/functions/v1/ai", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, apikey: SB_KEY, "content-type": "application/json" },
      body: JSON.stringify({ messages, system: opts.system, tier: opts.modelTier || "default", stream, max_tokens: opts.maxTokens })
    });
    if (!r.ok) { let m = ""; try { m = await r.text(); } catch (e) { } throw mkErr(httpCode(r.status), m || ("IA indisponível (" + r.status + ")")); }
    let text = "", stop = "";
    if (stream) {
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (; ;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; try { opts.onText({ text, delta: ev.delta.text }); } catch (e) { } }
          else if (ev.type === "message_delta" && ev.delta) stop = ev.delta.stop_reason || stop;
          else if (ev.type === "error") throw mkErr("upstream_error", ev.error && ev.error.message);
        }
      }
    } else {
      const j = await r.json();
      text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join(""); stop = j.stop_reason || "";
    }
    return { text, stopReason: stop };
  }
  const sample = (input, opts) => callAI(input, opts, false);
  sample.json = async (input, opts) => parseJSON((await callAI(input, opts, true)).text);
  sample.limits = async () => clone(LIM);

  const user = { id: async () => { await READY; return UID; }, email: async () => { await READY; return EMAIL; } };
  const downloads = {
    async save({ filename, data }) {
      const b = data instanceof Blob ? data : new Blob([data]); const u = URL.createObjectURL(b), a = document.createElement("a");
      a.href = u; a.download = filename || "arquivo"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 4000);
    }
  };
  const API = { db, user, assets, sample, downloads };
  window.claude = Object.freeze({ use: async name => { await READY; return API[name] || null; } });

  /* ---------- service worker ---------- */
  function swPost(target) { try { (target || (navigator.serviceWorker && navigator.serviceWorker.controller))?.postMessage({ t: "auth", token: TOKEN, url: SB_URL, key: SB_KEY, uid: UID }); } catch (e) { } }
  async function swStart() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data && e.data.t === "need-auth" && e.ports && e.ports[0]) e.ports[0].postMessage({ token: TOKEN, url: SB_URL, key: SB_KEY, uid: UID });
    });
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (!navigator.serviceWorker.controller) {
        await Promise.race([new Promise(r => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true })), new Promise(r => setTimeout(r, 3000))]);
      }
      swPost(); if (reg.active) swPost(reg.active);
    } catch (e) { console.warn("service worker", e); }
  }

  /* ---------- tela de entrada e menu da conta ---------- */
  const CSS = `
  #jx-gate{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:16px;background:radial-gradient(1200px 600px at 20% 0%,#16324a 0%,#0b0f14 60%);color:#e8eef5;font:15px/1.45 Figtree,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  #jx-gate .jx-card{width:min(400px,100%);background:#111821;border:1px solid #233142;border-radius:16px;padding:28px 24px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
  #jx-gate h1{font:700 22px Unbounded,Figtree,sans-serif;letter-spacing:.02em;margin:0 0 4px}
  #jx-gate p{margin:0 0 18px;color:#9fb0c2}
  #jx-gate label{display:block;font-size:13px;color:#9fb0c2;margin:12px 0 6px}
  #jx-gate input{box-sizing:border-box;width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2b3b4f;background:#0b1118;color:#e8eef5;font:inherit}
  #jx-gate input:focus{outline:2px solid #3fa7ff;outline-offset:1px}
  .jx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:10px;border:0;background:#3fa7ff;color:#04121f;font:700 15px Figtree,sans-serif;cursor:pointer}
  .jx-btn[disabled]{opacity:.6;cursor:wait}.jx-btn.ghost{background:transparent;color:#9fd0ff;border:1px solid #2b3b4f}
  #jx-gate .jx-row{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}#jx-gate .jx-row .jx-btn{flex:1 1 140px}
  #jx-gate .jx-links{display:flex;justify-content:space-between;gap:10px;margin-top:16px;font-size:13.5px;flex-wrap:wrap}
  #jx-gate a,#jx-menu a{color:#9fd0ff;cursor:pointer;text-decoration:underline}
  .jx-msg{min-height:20px;margin-top:12px;font-size:13.5px;color:#ffc46b}.jx-msg.ok{color:#7ddc8a}
  #jx-fab{position:fixed;left:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483500;width:34px;height:34px;border-radius:50%;border:1px solid rgba(127,140,160,.45);background:rgba(17,24,33,.82);color:#cfe3f7;font:600 15px Figtree,sans-serif;cursor:pointer;opacity:.55;backdrop-filter:blur(6px)}
  #jx-fab:hover,#jx-fab:focus-visible{opacity:1}
  #jx-menu{position:fixed;left:10px;bottom:calc(52px + env(safe-area-inset-bottom,0px));z-index:2147483501;width:min(300px,calc(100vw - 20px));background:#111821;color:#e8eef5;border:1px solid #233142;border-radius:12px;padding:12px;box-shadow:0 14px 40px rgba(0,0,0,.45);font:14px/1.4 Figtree,sans-serif}
  #jx-menu .who{color:#9fb0c2;font-size:12.5px;margin:0 4px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #jx-menu button{display:block;width:100%;text-align:left;background:transparent;border:0;color:inherit;padding:10px;border-radius:8px;font:inherit;cursor:pointer}
  #jx-menu button:hover{background:#1a2532}
  #jx-imp{position:fixed;inset:0;z-index:2147483602;display:grid;place-items:center;padding:16px;background:rgba(5,8,12,.72);color:#e8eef5;font:15px/1.45 Figtree,sans-serif}
  #jx-imp .jx-card{width:min(520px,100%);background:#111821;border:1px solid #233142;border-radius:16px;padding:24px}
  #jx-imp h2{margin:0 0 8px;font:700 19px Unbounded,Figtree,sans-serif}#jx-imp p,#jx-imp li{color:#b8c6d4}#jx-imp ol{padding-left:20px}
  #jx-imp .bar{height:8px;border-radius:4px;background:#1d2a38;overflow:hidden;margin-top:14px}#jx-imp .bar i{display:block;height:100%;width:0;background:#3fa7ff;transition:width .2s}
  #jx-imp .jx-row{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;justify-content:flex-end}`;
  const $ = s => document.querySelector(s);
  const el = (h) => { const d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstChild; };
  function addCSS() { if ($("#jx-css")) return; const s = document.createElement("style"); s.id = "jx-css"; s.textContent = CSS; document.head.appendChild(s); }

  function gate(mode, msg) {
    addCSS(); let g = $("#jx-gate"); if (!g) { g = el('<div id="jx-gate" role="dialog" aria-modal="true" aria-label="Entrar na Jornada"></div>'); document.body.appendChild(g); }
    const T0 = { in: ["Entrar", "Acesse a sua Jornada de estudos."], up: ["Criar conta", "Crie o acesso com o seu e-mail."], reset: ["Recuperar senha", "Enviaremos um link para o seu e-mail."], newpw: ["Nova senha", "Escolha a nova senha de acesso."], cfg: ["Falta configurar", "Preencha o arquivo config.js com o endereço e a chave pública do seu Supabase."] }[mode];
    const pw = mode === "in" || mode === "up" || mode === "newpw", em = mode !== "newpw" && mode !== "cfg";
    g.innerHTML = `<form class="jx-card" novalidate>
      <h1>A JORNADA</h1><p><b style="color:#e8eef5">${T0[0]}.</b> ${T0[1]}</p>
      ${em ? '<label for="jx-em">E-mail</label><input id="jx-em" type="email" autocomplete="email" required>' : ""}
      ${pw ? `<label for="jx-pw">Senha</label><input id="jx-pw" type="password" minlength="6" autocomplete="${mode === "in" ? "current-password" : "new-password"}" required>` : ""}
      ${mode !== "cfg" ? `<div class="jx-row"><button class="jx-btn" type="submit">${{ in: "Entrar", up: "Criar conta", reset: "Enviar link", newpw: "Salvar senha" }[mode]}</button></div>` : ""}
      <div class="jx-links">${mode === "in" ? '<a data-m="up">Criar conta</a><a data-m="reset">Esqueci a senha</a>' : mode === "cfg" ? "" : '<a data-m="in">Voltar para entrar</a>'}</div>
      <div class="jx-msg" role="status" aria-live="polite">${msg || ""}</div></form>`;
    g.querySelectorAll("a[data-m]").forEach(a => a.onclick = () => gate(a.dataset.m));
    const f = g.querySelector("form"), say = (t, ok) => { const m = g.querySelector(".jx-msg"); m.textContent = t; m.className = "jx-msg" + (ok ? " ok" : ""); };
    f.onsubmit = async e => {
      e.preventDefault(); const b = f.querySelector("button"); b.disabled = true; say("");
      const email = (g.querySelector("#jx-em") || {}).value, password = (g.querySelector("#jx-pw") || {}).value;
      try {
        let r;
        if (mode === "in") r = await sb.auth.signInWithPassword({ email, password });
        else if (mode === "up") { r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }); if (!r.error && !r.data.session) { say("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.", true); b.disabled = false; return; } }
        else if (mode === "reset") { r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (!r.error) { say("Link enviado. Confira o seu e-mail.", true); b.disabled = false; return; } }
        else if (mode === "newpw") { r = await sb.auth.updateUser({ password }); if (!r.error) { say("Senha alterada.", true); setTimeout(() => location.replace(location.pathname), 900); return; } }
        if (r && r.error) throw r.error;
      } catch (err) {
        const m = String(err && err.message || err);
        say(/invalid login/i.test(m) ? "E-mail ou senha incorretos." : /confirm/i.test(m) ? "Confirme o e-mail pelo link enviado antes de entrar." : /already/i.test(m) ? "Este e-mail já tem conta. Use “Entrar”." : /password/i.test(m) ? "A senha precisa ter pelo menos 6 caracteres." : /not allowed|disabled/i.test(m) ? "Novos cadastros estão fechados neste site." : "Não foi possível agora: " + m);
      }
      b.disabled = false;
    };
    setTimeout(() => { const i = g.querySelector("input"); if (i) i.focus(); }, 30);
  }

  function fab() {
    addCSS(); if ($("#jx-fab")) return;
    const b = el('<button id="jx-fab" type="button" aria-label="Conta e dados" title="Conta e dados">⚙</button>'); document.body.appendChild(b);
    b.onclick = () => {
      const o = $("#jx-menu"); if (o) { o.remove(); return; }
      const m = el(`<div id="jx-menu" role="menu"><div class="who">Conectado como ${EMAIL.replace(/[<>&]/g, "")}</div>
        <button role="menuitem" data-k="imp">Importar meus dados…</button>
        <button role="menuitem" data-k="exp">Baixar cópia dos meus dados</button>
        <button role="menuitem" data-k="out">Sair</button></div>`);
      document.body.appendChild(m);
      m.onclick = e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; m.remove(); if (k === "imp") importDlg(); else if (k === "exp") exportAll(); else if (k === "out") sb.auth.signOut().then(() => location.reload()); };
      setTimeout(() => document.addEventListener("click", function h(ev) { if (!m.contains(ev.target) && ev.target !== b) { m.remove(); document.removeEventListener("click", h); } }), 0);
    };
  }

  /* ---------- importar / exportar ---------- */
  async function allDocs() {
    const base = "data/users/" + UID + "/", rows = []; const N = 500;
    for (let from = 0; ; from += N) {
      const { data, error } = await T().select("path,data").like("path", base + "%").order("path").range(from, from + N - 1);
      if (error) throw pgErr(error); rows.push(...(data || [])); if (!data || data.length < N) break;
    }
    return rows;
  }
  async function exportAll() {
    try {
      const base = "data/users/" + UID + "/", rows = await allDocs(), docs = {};
      rows.forEach(r => docs[r.path.slice(base.length)] = r.data);
      const out = { app: "a-jornada", v: 1, uidOld: UID, exportedAt: new Date().toISOString(), docs };
      await downloads.save({ filename: "jornada-dados-" + new Date().toISOString().slice(0, 10) + ".json", data: new Blob([JSON.stringify(out)], { type: "application/json" }) });
    } catch (e) { alert("Não foi possível baixar agora: " + (e && e.message || e)); }
  }
  function loadJSZip() { return window.JSZip ? Promise.resolve(window.JSZip) : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "/jszip.min.js"; s.onload = () => ok(window.JSZip); s.onerror = no; document.head.appendChild(s); }); }
  const MIME = { pdf: "application/pdf", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", json: "application/json" };

  function importDlg() {
    addCSS(); const old = $("#jx-imp"); if (old) old.remove();
    const d = el(`<div id="jx-imp" role="dialog" aria-modal="true" aria-label="Importar meus dados"><div class="jx-card">
      <h2>Importar meus dados</h2>
      <p>Selecione, de uma vez, o arquivo <b>jornada-dados.json</b> e os arquivos <b>jornada-pdfs-1.zip</b>, <b>jornada-pdfs-2.zip</b>… que você recebeu.</p>
      <ol><li>Os dados atuais desta conta serão <b>substituídos</b> pelos do arquivo.</li><li>Os PDFs são enviados para a nuvem do seu site; deixe esta aba aberta até terminar.</li></ol>
      <input type="file" id="jx-f" multiple accept=".json,.zip,application/json,application/zip" style="margin-top:6px;max-width:100%">
      <div class="jx-msg" role="status" aria-live="polite"></div><div class="bar"><i></i></div>
      <div class="jx-row"><button class="jx-btn ghost" type="button" data-k="x">Cancelar</button><button class="jx-btn" type="button" data-k="go">Importar</button></div></div></div>`);
    document.body.appendChild(d);
    const say = (t, ok) => { const m = d.querySelector(".jx-msg"); m.textContent = t; m.className = "jx-msg" + (ok ? " ok" : ""); };
    const bar = p => d.querySelector(".bar i").style.width = Math.round(p * 100) + "%";
    d.querySelector('[data-k="x"]').onclick = () => { if (!IMPORTING) d.remove(); };
    d.querySelector('[data-k="go"]').onclick = async () => {
      const fs = [...(d.querySelector("#jx-f").files || [])]; const js = fs.filter(f => /\.json$/i.test(f.name)), zs = fs.filter(f => /\.zip$/i.test(f.name));
      if (!js.length && !zs.length) { say("Escolha o arquivo .json e os .zip."); return; }
      const btns = d.querySelectorAll("button"); btns.forEach(b => b.disabled = true);
      IMPORTING = true;
      try {
        const base = "data/users/" + UID + "/";
        if (js.length) {
          say("Lendo os dados…"); const pk = JSON.parse(await js[0].text());
          if (!pk || !pk.docs || typeof pk.docs !== "object") throw new Error("o .json não é um backup da Jornada");
          let txt = JSON.stringify(pk.docs); if (pk.uidOld) txt = txt.split(pk.uidOld).join(UID);
          const docs = JSON.parse(txt), keys = Object.keys(docs);
          say("Limpando os dados anteriores desta conta…");
          const { error: de } = await T().delete().like("path", base + "%"); if (de) throw pgErr(de);
          for (let i = 0; i < keys.length; i += 25) {
            const rows = keys.slice(i, i + 25).map(k => { const path = base + k.replace(/^\/+/, ""); return { user_id: UID, path, parent: parentOf(path), data: docs[k], updated_at: new Date().toISOString() }; });
            const { error } = await T().upsert(rows, { onConflict: "user_id,path" }); if (error) throw pgErr(error);
            bar((i + rows.length) / keys.length * (zs.length ? .15 : 1)); say(`Gravando os dados: ${Math.min(i + 25, keys.length)} de ${keys.length}`);
          }
        }
        if (zs.length) {
          const JSZip = await loadJSZip(); const items = [];
          for (const z of zs) { say("Abrindo " + z.name + "…"); const zip = await JSZip.loadAsync(z); zip.forEach((p, e) => { const m = !e.dir && p.match(/(?:^|\/)([0-9a-f]{32})\.([a-z0-9]+)$/i); if (m) items.push({ e, id: m[1].toLowerCase(), ext: m[2].toLowerCase() }); }); }
          let n = 0, bad = 0;
          const work = async it => {
            for (let k = 0; k < 4; k++) {
              try { const ab = await it.e.async("arraybuffer"); await putObj(it.id, new Blob([ab], { type: MIME[it.ext] || "application/octet-stream" }), true); return; }
              catch (e) { if (k === 3) { bad++; console.warn("import", it.id, e); return; } await new Promise(r => setTimeout(r, 1500 * (k + 1))); }
            }
          };
          const q = items.slice(); const runners = Array.from({ length: 3 }, async () => { while (q.length) { await work(q.shift()); n++; bar(.15 + .85 * n / items.length); say(`Enviando os PDFs: ${n} de ${items.length}`); } });
          await Promise.all(runners);
          if (bad) say(`${bad} arquivo(s) não subiram. Rode a importação de novo só com os .zip para completar.`);
        }
        /* o painel guarda uma cópia local; apaga para ele ler da nuvem os dados importados */
        Object.keys(localStorage).forEach(k => { if (!/^sb-.*-auth-token$/.test(k)) localStorage.removeItem(k); });
        say("Pronto! Recarregando…", true); bar(1); setTimeout(() => location.reload(), 1200);
      } catch (e) {
        IMPORTING = false; btns.forEach(b => b.disabled = false);
        say("Não foi possível importar: " + (e && e.message || e));
      }
    };
  }

  /* ---------- início ---------- */
  async function start() {
    if (!SB_URL || !SB_KEY || !window.supabase || !window.supabase.createClient) { gate("cfg", !window.supabase ? "A biblioteca do Supabase não carregou. Confira a internet." : ""); return; }
    sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    let started = false;
    const onSession = async (ev, s) => {
      if (ev === "PASSWORD_RECOVERY") { gate("newpw"); return; }
      if (!s) { if (started) location.reload(); else if (!$("#jx-gate")) gate("in"); return; }
      TOKEN = s.access_token; swPost();
      if (started) return; started = true;
      UID = s.user.id; EMAIL = s.user.email || "";
      const g = $("#jx-gate"); if (g) g.remove();
      await swStart(); fab(); readyRes();
    };
    sb.auth.onAuthStateChange((ev, s) => { setTimeout(() => onSession(ev, s), 0); });
    const { data } = await sb.auth.getSession();
    if (!/type=recovery/.test(location.hash)) onSession("INITIAL", data && data.session);
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
