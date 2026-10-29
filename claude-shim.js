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
  #jx-gate{position:fixed;inset:0;z-index:2147483600;overflow:auto;color:#f1ecff;font:15px/1.45 Figtree,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:radial-gradient(900px 620px at 78% 38%,rgba(160,107,255,.34),transparent 62%),radial-gradient(700px 480px at 96% 96%,rgba(255,95,143,.20),transparent 60%),radial-gradient(600px 400px at 0% 100%,rgba(123,60,255,.18),transparent 60%),linear-gradient(160deg,#120d2b 0%,#0c0a1d 55%,#0a0817 100%)}
  #jx-gate .jx-art{position:fixed;right:-8vw;top:50%;transform:translateY(-50%);width:min(64vw,980px);aspect-ratio:1;pointer-events:none;opacity:.9}
  #jx-gate .jx-art .ring{fill:none;stroke:rgba(255,255,255,.10);stroke-width:2}
  #jx-gate .jx-art .ring.b{stroke:rgba(196,79,210,.28);stroke-width:3}
  #jx-gate .jx-art .bigmark{opacity:.16}
  #jx-gate .jx-wrap{position:relative;min-height:100%;box-sizing:border-box;padding:22px 28px 28px;display:flex;flex-direction:column;gap:16px;max-width:520px}
  #jx-gate .jx-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  #jx-gate .jx-tile{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(150deg,#2b0f63,#170b38);box-shadow:0 0 0 1px rgba(160,107,255,.35),0 8px 24px rgba(123,60,255,.35)}
  #jx-gate .jx-logo{width:34px;height:34px}
  #jx-gate .jx-name{font:700 20px Unbounded,Figtree,sans-serif;letter-spacing:.04em;margin-right:6px}
  #jx-gate .jx-pill{border:0;border-radius:8px;padding:7px 12px;font:600 13px Figtree,sans-serif;color:#e6dcff;background:rgba(255,255,255,.08);cursor:pointer}
  #jx-gate .jx-pill[aria-pressed="true"]{background:linear-gradient(135deg,#7b3cff,#a06bff);color:#fff;box-shadow:0 4px 14px rgba(123,60,255,.45)}
  #jx-gate .jx-card{background:rgba(22,16,48,.80);backdrop-filter:blur(10px);border:1px solid rgba(160,107,255,.32);border-radius:14px;padding:22px 22px 20px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
  #jx-gate .jx-hero{position:relative;overflow:hidden}
  #jx-gate .jx-hero::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,#a06bff,#c44fd2,#ff5f8f)}
  #jx-gate h1{margin:4px 0 2px;font:700 22px Unbounded,Figtree,sans-serif;background:linear-gradient(90deg,#d9b8ff,#ff8fb6);-webkit-background-clip:text;background-clip:text;color:transparent}
  #jx-gate .jx-sub{margin:0 0 14px;color:#c9bde6;font-weight:600}
  #jx-gate label{display:block;font-size:13px;font-weight:600;color:#cbbfe8;margin:12px 0 6px}
  #jx-gate .jx-in{position:relative}
  #jx-gate input{box-sizing:border-box;width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(160,107,255,.35);background:rgba(10,7,26,.75);color:#f6f2ff;font:inherit}
  #jx-gate input.pw{padding-right:48px}
  #jx-gate input:focus{outline:2px solid #a06bff;outline-offset:1px}
  #jx-gate .jx-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:#cbbfe8;cursor:pointer;display:grid;place-items:center}
  #jx-gate .jx-eye:hover,#jx-gate .jx-eye:focus-visible{background:rgba(160,107,255,.18);color:#fff}
  #jx-gate .jx-eye svg{width:20px;height:20px}
  #jx-gate .jx-hint{font-size:12.5px;color:#a99cc9;margin-top:6px}
  .jx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:10px;border:0;background:linear-gradient(135deg,#7b3cff 0%,#c44fd2 55%,#ff5f8f 100%);color:#fff;font:700 15px Figtree,sans-serif;cursor:pointer;box-shadow:0 8px 22px rgba(196,79,210,.35)}
  .jx-btn[disabled]{opacity:.6;cursor:wait}.jx-btn.ghost{background:transparent;color:#e0d4ff;border:1px solid rgba(160,107,255,.4);box-shadow:none}
  #jx-gate .jx-row{display:flex;gap:10px;margin-top:18px}#jx-gate .jx-row .jx-btn{flex:1}
  #jx-gate .jx-duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  #jx-gate .jx-mini{text-align:left;cursor:pointer;color:inherit;font:inherit;padding:16px}
  #jx-gate .jx-mini b{display:block;font:700 15px Unbounded,Figtree,sans-serif;color:#d9b8ff;margin-bottom:4px}
  #jx-gate .jx-mini span{font-size:13px;color:#c2b6df}
  #jx-gate .jx-mini:hover{border-color:rgba(255,143,182,.6)}
  #jx-gate .jx-band{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:#e9e2ff;color:#1b1140;border-radius:14px;padding:16px 20px}
  #jx-gate .jx-band b{font:800 22px Unbounded,Figtree,sans-serif;letter-spacing:.02em}
  #jx-gate .jx-band span{font:800 15px Barlow Condensed,Figtree,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-left:3px solid #ff5f8f;border-right:3px solid #ff5f8f}
  #jx-gate .jx-msg{color:#ffd27a}#jx-gate .jx-msg.ok{color:#8ff0a8}
  @media (max-width:900px){#jx-gate .jx-art{opacity:.35;right:-40vw;width:120vw}#jx-gate .jx-wrap{margin:0 auto}}
  @media (max-width:420px){#jx-gate .jx-wrap{padding:16px}#jx-gate .jx-top{gap:8px}#jx-gate .jx-name{font-size:16px;margin-right:0}#jx-gate .jx-tile{width:38px;height:38px}#jx-gate .jx-logo{width:28px;height:28px}#jx-gate .jx-pill{padding:6px 9px;font-size:12.5px}#jx-gate .jx-duo{grid-template-columns:1fr}#jx-gate h1{font-size:19px}}
  .jx-msg{min-height:20px;margin-top:12px;font-size:13.5px;color:#ffc46b}.jx-msg.ok{color:#7ddc8a}
  #jx-fab{position:fixed;left:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483500;width:34px;height:34px;border-radius:50%;border:1px solid rgba(127,140,160,.45);background:rgba(43,15,99,.85);color:#efe6ff;font:600 15px Figtree,sans-serif;cursor:pointer;opacity:.55;backdrop-filter:blur(6px)}
  #jx-fab:hover,#jx-fab:focus-visible{opacity:1}
  #jx-menu{position:fixed;left:10px;bottom:calc(52px + env(safe-area-inset-bottom,0px));z-index:2147483501;width:min(300px,calc(100vw - 20px));background:#160f33;color:#f1ecff;border:1px solid rgba(160,107,255,.35);border-radius:12px;padding:12px;box-shadow:0 14px 40px rgba(0,0,0,.45);font:14px/1.4 Figtree,sans-serif}
  #jx-menu .who{color:#9fb0c2;font-size:12.5px;margin:0 4px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #jx-menu button{display:block;width:100%;text-align:left;background:transparent;border:0;color:inherit;padding:10px;border-radius:8px;font:inherit;cursor:pointer}
  #jx-menu button:hover{background:rgba(160,107,255,.16)}
  #jx-imp{position:fixed;inset:0;z-index:2147483602;display:grid;place-items:center;padding:16px;background:rgba(8,5,20,.78);color:#f1ecff;font:15px/1.45 Figtree,sans-serif}
  #jx-imp .jx-card{width:min(520px,100%);background:#160f33;border:1px solid rgba(160,107,255,.35);border-radius:16px;padding:24px}
  #jx-imp h2{margin:0 0 8px;font:700 19px Unbounded,Figtree,sans-serif}#jx-imp p,#jx-imp li{color:#b8c6d4}#jx-imp ol{padding-left:20px}
  #jx-imp .bar{height:8px;border-radius:4px;background:#1d2a38;overflow:hidden;margin-top:14px}#jx-imp .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7b3cff,#ff5f8f);transition:width .2s}
  #jx-imp .jx-row{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;justify-content:flex-end}`;
  const $ = s => document.querySelector(s);
  const el = (h) => { const d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstChild; };
  function addCSS() { if ($("#jx-css")) return; const s = document.createElement("style"); s.id = "jx-css"; s.textContent = CSS; document.head.appendChild(s); }

  const LOGO = "<svg class=\"jx-logo\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><defs><linearGradient id=\"g2L1jx\" gradientUnits=\"userSpaceOnUse\" x1=\"10\" y1=\"8\" x2=\"34\" y2=\"40\"><stop offset=\"0\" stop-color=\"#a06bff\"/><stop offset=\".5\" stop-color=\"#c44fd2\"/><stop offset=\"1\" stop-color=\"#ff5f8f\"/></linearGradient><linearGradient id=\"t2L1jx\" gradientUnits=\"userSpaceOnUse\" x1=\"4\" y1=\"2\" x2=\"44\" y2=\"46\"><stop offset=\"0\" stop-color=\"#7b3cff\"/><stop offset=\".55\" stop-color=\"#b53cc6\"/><stop offset=\"1\" stop-color=\"#ff5a8a\"/></linearGradient><linearGradient id=\"d2L1jx\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#2a2672\"/><stop offset=\"1\" stop-color=\"#0f0c29\"/></linearGradient><linearGradient id=\"au2L1jx\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffd98a\"/><stop offset=\"1\" stop-color=\"#f0a531\"/></linearGradient><linearGradient id=\"aus2L1jx\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#e59a2a\"/><stop offset=\"1\" stop-color=\"#b86e12\"/></linearGradient><radialGradient id=\"glow2L1jx\" cx=\".5\" cy=\".5\" r=\".5\"><stop offset=\"0\" stop-color=\"#c44fd2\" stop-opacity=\".55\"/><stop offset=\"1\" stop-color=\"#c44fd2\" stop-opacity=\"0\"/></radialGradient><clipPath id=\"c2L1jx\"><rect width=\"48\" height=\"48\" rx=\"13\"/></clipPath></defs><g clip-path=\"url(#c2L1jx)\"><rect width=\"48\" height=\"48\" fill=\"url(#d2L1jx)\"/><g fill=\"#fff\"><circle cx=\"7.5\" cy=\"8\" r=\".6\" opacity=\".8\"/><circle cx=\"20\" cy=\"5.5\" r=\".45\" opacity=\".6\"/><circle cx=\"42\" cy=\"22\" r=\".5\" opacity=\".6\"/><circle cx=\"6\" cy=\"22\" r=\".4\" opacity=\".5\"/><circle cx=\"40\" cy=\"31\" r=\".4\" opacity=\".5\"/></g><ellipse cx=\"24\" cy=\"26\" rx=\"18\" ry=\"17\" fill=\"url(#glow2L1jx)\"/><g class=\"ct\" transform=\"translate(2.2 -1.62)\"><g transform=\"translate(2.6 6) scale(.9)\"><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" transform=\"translate(2.75 3.50)\" fill=\"none\" stroke=\"#2b0f63\" stroke-width=\"7.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" transform=\"translate(2.20 2.80)\" fill=\"none\" stroke=\"#2b0f63\" stroke-width=\"7.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" transform=\"translate(1.65 2.10)\" fill=\"none\" stroke=\"#2b0f63\" stroke-width=\"7.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" transform=\"translate(1.10 1.40)\" fill=\"none\" stroke=\"#2b0f63\" stroke-width=\"7.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" transform=\"translate(0.55 0.70)\" fill=\"none\" stroke=\"#2b0f63\" stroke-width=\"7.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" fill=\"none\" stroke=\"url(#g2L1jx)\" stroke-width=\"7.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M20.5 12H28V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" transform=\"translate(-2.07 -2.07)\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".45\" stroke-width=\".8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><path d=\"M28 15V34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-3.5\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".95\" stroke-width=\"1.15\" stroke-linecap=\"round\" stroke-dasharray=\"2.2 2.3\"/><circle cx=\"12\" cy=\"32.5\" r=\"2.3\" fill=\"#ff5f8f\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"12\" cy=\"32.5\" r=\".8\" fill=\"#fff\"/></g><g transform=\"translate(25.3 13.9) scale(.62) translate(-25.3 -13.9)\"><line x1=\"25.3\" y1=\"13.9\" x2=\"25.3\" y2=\"2.8\" stroke=\"#f5b545\" stroke-width=\".75\" stroke-linecap=\"round\"/><circle cx=\"25.3\" cy=\"2.7\" r=\".75\" fill=\"url(#au2L1jx)\"/><g transform=\"translate(25.55 3.4) scale(.78) translate(-25.55 -3.4)\"><path d=\"M25.55 3.6c1.9-.9 3.6.6 5.5-.3s2.6-.8 2.6-.8v5.6s-.8 0-2.6.8-3.6-.7-5.5.3z\" fill=\"url(#aus2L1jx)\" transform=\"translate(.35 .55)\"/><path d=\"M25.55 3.6c1.9-.9 3.6.6 5.5-.3s2.6-.8 2.6-.8v5.6s-.8 0-2.6.8-3.6-.7-5.5.3z\" fill=\"url(#au2L1jx)\"/><path d=\"M25.55 3.6c1.9-.9 3.6.6 5.5-.3v2.8c-1.9.8-3.6-.7-5.5.3z\" fill=\"#fff\" opacity=\".22\"/></g></g><g transform=\"translate(21.35 8.799999999999999) scale(.26)\" opacity=\"0.6\"><rect x=\"3.2\" y=\"5.6\" width=\"4.6\" height=\"7.6\" rx=\"1.8\" fill=\"#2b0f63\"/><path d=\"M4.4 7.2h2.2\" stroke=\"#2b0f63\" stroke-width=\".8\" stroke-linecap=\"round\"/><g stroke=\"#2b0f63\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M8.3 12.4 6.6 18.6\" stroke-width=\"2.6\"/><path d=\"M10.6 12.4 12.6 18.6\" stroke-width=\"2.6\"/><path d=\"M10.3 7.2 15.4 5.9\" stroke-width=\"2.1\"/><path d=\"M10.3 9.4 15.4 8.9\" stroke-width=\"2.1\"/></g><rect x=\"6.3\" y=\"5.2\" width=\"5.4\" height=\"8\" rx=\"2.5\" fill=\"#2b0f63\"/><path d=\"M6.6 9.6h4.8\" stroke=\"#2b0f63\" stroke-width=\"1.1\"/><rect x=\"4.9\" y=\"17.9\" width=\"3.3\" height=\"2.1\" rx=\".9\" fill=\"#2b0f63\"/><rect x=\"11.4\" y=\"17.9\" width=\"3.3\" height=\"2.1\" rx=\".9\" fill=\"#2b0f63\"/><circle cx=\"15.7\" cy=\"5.8\" r=\"1.05\" fill=\"#2b0f63\"/><circle cx=\"15.7\" cy=\"8.85\" r=\"1.05\" fill=\"#2b0f63\"/><circle cx=\"9.3\" cy=\"2.9\" r=\"2.5\" fill=\"#2b0f63\"/><path d=\"M6.7 2.6a2.6 2.6 0 0 1 5.2 0z\" fill=\"#2b0f63\"/><path d=\"M10.9 2.4h2.6a.6.6 0 0 1 0 1.1h-2.6z\" fill=\"#2b0f63\"/><circle cx=\"10.6\" cy=\"3.3\" r=\".35\" fill=\"#2b0f63\"/></g><g transform=\"translate(21 8.35) scale(.26)\" opacity=\"1\"><rect x=\"3.2\" y=\"5.6\" width=\"4.6\" height=\"7.6\" rx=\"1.8\" fill=\"#ff5f8f\"/><path d=\"M4.4 7.2h2.2\" stroke=\"#ffd0dd\" stroke-width=\".8\" stroke-linecap=\"round\"/><g stroke=\"#fff\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M8.3 12.4 6.6 18.6\" stroke-width=\"2.6\"/><path d=\"M10.6 12.4 12.6 18.6\" stroke-width=\"2.6\"/><path d=\"M10.3 7.2 15.4 5.9\" stroke-width=\"2.1\"/><path d=\"M10.3 9.4 15.4 8.9\" stroke-width=\"2.1\"/></g><rect x=\"6.3\" y=\"5.2\" width=\"5.4\" height=\"8\" rx=\"2.5\" fill=\"#fff\"/><path d=\"M6.6 9.6h4.8\" stroke=\"#c44fd2\" stroke-width=\"1.1\"/><rect x=\"4.9\" y=\"17.9\" width=\"3.3\" height=\"2.1\" rx=\".9\" fill=\"#f5b545\"/><rect x=\"11.4\" y=\"17.9\" width=\"3.3\" height=\"2.1\" rx=\".9\" fill=\"#f5b545\"/><circle cx=\"15.7\" cy=\"5.8\" r=\"1.05\" fill=\"#ffe1c9\"/><circle cx=\"15.7\" cy=\"8.85\" r=\"1.05\" fill=\"#ffe1c9\"/><circle cx=\"9.3\" cy=\"2.9\" r=\"2.5\" fill=\"#ffe1c9\"/><path d=\"M6.7 2.6a2.6 2.6 0 0 1 5.2 0z\" fill=\"#7b3cff\"/><path d=\"M10.9 2.4h2.6a.6.6 0 0 1 0 1.1h-2.6z\" fill=\"#7b3cff\"/><circle cx=\"10.6\" cy=\"3.3\" r=\".35\" fill=\"#2b0f63\"/></g></g></g></svg>";
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const ART = `<svg class="jx-art" viewBox="0 0 1000 1000" aria-hidden="true"><circle class="ring" cx="500" cy="500" r="470"/><circle class="ring b" cx="500" cy="500" r="380"/><circle class="ring" cx="500" cy="500" r="300"/><circle class="ring" cx="500" cy="500" r="150"/><path class="ring" d="M30 500h940M500 30v940"/><g class="bigmark" transform="translate(290 290) scale(8.75)">${LOGO.replace(/<svg[^>]*>/, "").replace("</svg>", "").replace(/id="([^"]+)jx"/g, 'id="$1jxa"').replace(/url\(#([^)]+)jx\)/g, "url(#$1jxa)")}</g></svg>`;
  function pwField(id, label, ac, hint) {
    return `<label for="${id}">${label}</label><div class="jx-in"><input id="${id}" class="pw" type="password" minlength="6" autocomplete="${ac}" required><button type="button" class="jx-eye" data-eye="${id}" aria-label="Mostrar senha" aria-pressed="false" title="Mostrar senha">${EYE}</button></div>${hint ? `<div class="jx-hint">${hint}</div>` : ""}`;
  }
  function gate(mode, msg) {
    addCSS(); let g = $("#jx-gate"); if (!g) { g = el('<div id="jx-gate" role="dialog" aria-modal="true" aria-label="A Jornada: entrar ou criar conta"></div>'); document.body.appendChild(g); }
    const T0 = {
      in: ["Bem-vindo(a) de volta", "Entre para continuar a sua Jornada."],
      up: ["Comece a sua jornada", "Crie a sua conta e monte o plano de estudos do seu concurso."],
      reset: ["Recuperar a senha", "Enviaremos um link para o seu e-mail."],
      newpw: ["Nova senha", "Escolha a nova senha de acesso."],
      cfg: ["Falta configurar", "Preencha o arquivo config.js com o endereço e a chave pública do seu Supabase."]
    }[mode];
    const em = mode !== "newpw" && mode !== "cfg";
    const pws = mode === "in" ? pwField("jx-pw", "Senha", "current-password")
      : mode === "up" || mode === "newpw" ? pwField("jx-pw", mode === "up" ? "Crie uma senha" : "Nova senha", "new-password", "Pelo menos 6 caracteres.") + pwField("jx-pw2", "Confirme a senha", "new-password") : "";
    const mini = mode === "in" ? [["up", "Criar conta", "Primeira vez aqui? Cadastre-se e escolha o seu concurso."], ["reset", "Esqueci a senha", "Receba um link no e-mail para criar outra."]]
      : mode === "up" ? [["in", "Já tenho conta", "Entre com o seu e-mail e a sua senha."], ["reset", "Esqueci a senha", "Receba um link no e-mail para criar outra."]]
        : mode === "cfg" ? [] : [["in", "Voltar para entrar", "Entre com o seu e-mail e a sua senha."], ["up", "Criar conta", "Primeira vez aqui? Cadastre-se."]];
    g.innerHTML = `${ART}<div class="jx-wrap">
      <div class="jx-top"><div class="jx-tile">${LOGO}</div><span class="jx-name">A JORNADA</span>
        ${mode === "cfg" ? "" : `<button type="button" class="jx-pill" data-m="in" aria-pressed="${mode === "in"}">Entrar</button><button type="button" class="jx-pill" data-m="up" aria-pressed="${mode === "up"}">Criar conta</button>`}</div>
      <form class="jx-card jx-hero" novalidate>
        <h1>${T0[0]}</h1><p class="jx-sub">${T0[1]}</p>
        ${em ? '<label for="jx-em">E-mail</label><div class="jx-in"><input id="jx-em" type="email" autocomplete="email" inputmode="email" required></div>' : ""}
        ${pws}
        ${mode !== "cfg" ? `<div class="jx-row"><button class="jx-btn" type="submit">${{ in: "Entrar", up: "Criar minha conta", reset: "Enviar link", newpw: "Salvar a nova senha" }[mode]}</button></div>` : ""}
        <div class="jx-msg" role="status" aria-live="polite">${msg || ""}</div>
      </form>
      ${mini.length ? `<div class="jx-duo">${mini.map(([m, t, d]) => `<button type="button" class="jx-card jx-mini" data-m="${m}"><b>${t}</b><span>${d}</span></button>`).join("")}</div>` : ""}
      <div class="jx-band"><b>A JORNADA</b><span>Sua trilha até a aprovação</span></div>
    </div>`;
    g.querySelectorAll("[data-m]").forEach(a => a.onclick = () => gate(a.dataset.m));
    g.querySelectorAll("[data-eye]").forEach(b => b.onclick = () => {
      const i = g.querySelector("#" + b.dataset.eye), show = i.type === "password";
      i.type = show ? "text" : "password"; b.innerHTML = show ? EYE_OFF : EYE;
      b.setAttribute("aria-pressed", String(show)); b.setAttribute("aria-label", show ? "Esconder senha" : "Mostrar senha"); b.title = b.getAttribute("aria-label"); i.focus();
    });
    const f = g.querySelector("form"), say = (t, ok) => { const m = g.querySelector(".jx-msg"); m.textContent = t; m.className = "jx-msg" + (ok ? " ok" : ""); };
    if (!f.querySelector("button[type=submit]")) return;
    f.onsubmit = async e => {
      e.preventDefault(); const b = f.querySelector("button[type=submit]"); say("");
      const email = ((g.querySelector("#jx-em") || {}).value || "").trim(), password = (g.querySelector("#jx-pw") || {}).value || "", password2 = (g.querySelector("#jx-pw2") || {}).value;
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say("Digite um e-mail válido."); g.querySelector("#jx-em").focus(); return; }
      if ((mode === "up" || mode === "newpw") && password.length < 6) { say("A senha precisa ter pelo menos 6 caracteres."); g.querySelector("#jx-pw").focus(); return; }
      if (password2 !== undefined && password !== password2) { say("As senhas não são iguais. Digite a mesma senha nos dois campos."); g.querySelector("#jx-pw2").focus(); return; }
      if (mode === "in" && !password) { say("Digite a sua senha."); g.querySelector("#jx-pw").focus(); return; }
      b.disabled = true;
      try {
        let r;
        if (mode === "in") r = await sb.auth.signInWithPassword({ email, password });
        else if (mode === "up") { r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }); if (!r.error && !r.data.session) { gate("in", "Conta criada! Abra o e-mail que enviamos, clique no link de confirmação e depois entre aqui."); return; } }
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
        Object.keys(localStorage).forEach(k => { if (!/^sb-.*-auth-token$/.test(k) && k !== "jx-owner") localStorage.removeItem(k); });
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
      try {
        const own = localStorage.getItem("jx-owner"), appKeys = Object.keys(localStorage).filter(k => !/^sb-.*-auth-token$/.test(k) && k !== "jx-owner");
        if (own !== UID && (own || appKeys.length)) {
          appKeys.forEach(k => localStorage.removeItem(k));
          try { indexedDB.deleteDatabase("jornada-tjsp-pdfs"); } catch (e) { }
          localStorage.setItem("jx-owner", UID); location.reload(); return;
        }
        localStorage.setItem("jx-owner", UID);
      } catch (e) { }
      const g = $("#jx-gate"); if (g) g.remove();
      await swStart(); fab(); readyRes();
    };
    sb.auth.onAuthStateChange((ev, s) => { setTimeout(() => onSession(ev, s), 0); });
    const { data } = await sb.auth.getSession();
    if (!/type=recovery/.test(location.hash)) onSession("INITIAL", data && data.session);
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
