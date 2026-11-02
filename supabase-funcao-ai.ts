// A Jornada — função "ai" (Supabase Edge Function).
// Recebe o pedido do painel, confere o login e repassa para a API da Anthropic com a SUA chave,
// que fica guardada só aqui no servidor (segredo ANTHROPIC_API_KEY), nunca no navegador.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  (obrigatório)  sua chave da API da Anthropic
//   ALLOWED_EMAILS     (recomendado)  e-mails do dono, com IA sempre liberada (os demais: só no teste de 7 dias ou com plano)
//   MODEL_QUICK / MODEL_DEFAULT / MODEL_COMPLEX  (opcional) para trocar os modelos sem mexer no código

const MODELS: Record<string, string> = {
  quick: Deno.env.get("MODEL_QUICK") ?? "claude-haiku-5-5",
  default: Deno.env.get("MODEL_DEFAULT") ?? "claude-sonnet-5-5",
  complex: Deno.env.get("MODEL_COMPLEX") ?? "claude-opus-5-5",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Soma o consumo do dia na tabela uso_ia (função somar_uso_ia), para você acompanhar os gastos.
async function registrar(uid: string, ent: number, sai: number) {
  const url = Deno.env.get("SUPABASE_URL"), sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !sk || !uid) return;
  try {
    await fetch(`${url}/rest/v1/rpc/somar_uso_ia`, {
      method: "POST",
      headers: { apikey: sk, authorization: `Bearer ${sk}`, "content-type": "application/json" },
      body: JSON.stringify({ uid, ent, sai }),
    });
  } catch { /* não atrapalha a resposta */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "use POST" });

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json(500, { error: "Falta o segredo ANTHROPIC_API_KEY na função ai." });

  // Quem está pedindo? (o Supabase já recusa pedidos sem login válido; aqui lemos o e-mail)
  const auth = req.headers.get("authorization") ?? "";
  const ures = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
  });
  if (!ures.ok) return json(401, { error: "Entre na sua conta." });
  const user = await ures.json();
  // Quem pode usar a IA: os e-mails de ALLOWED_EMAILS (o dono) sempre; os demais durante o teste grátis
  // de 7 dias (perfis.teste_ate) ou com um plano liberado (perfis.plano preenchido).
  const allowed = (Deno.env.get("ALLOWED_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(user.email ?? "").toLowerCase())) {
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const pr = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/perfis?user_id=eq.${user.id}&select=plano,teste_ate`, {
      headers: { apikey: sk, authorization: `Bearer ${sk}` },
    });
    const p = pr.ok ? (await pr.json())[0] : null;
    const fim = p?.teste_ate ? Date.parse(p.teste_ate) : Date.parse(user.created_at ?? "") + 7 * 864e5;
    if (!p?.plano && !(fim > Date.now())) {
      return json(403, { error: "O seu teste grátis de 7 dias terminou. Fale com a equipe da A Jornada para liberar o acesso." });
    }
  }

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "pedido inválido" }); }
  // ---------- Lei seca: texto oficial no Planalto ----------
  // lei_texto: baixa a página da lei (só planalto.gov.br), tira o que foi revogado (texto riscado) e devolve o texto limpo.
  // lei_busca: acha a página oficial da lei no Planalto com a busca na web da Anthropic.
  if (body.mode === "lei_texto") {
    let u: URL;
    try { u = new URL(String(body.url || "")); } catch { return json(400, { error: "link inválido" }); }
    if (!/(^|\.)planalto\.gov\.br$/i.test(u.hostname)) return json(400, { error: "use um link do planalto.gov.br" });
    u.protocol = "https:";
    const pr = await fetch(u.toString(), { headers: { "user-agent": "Mozilla/5.0 (A Jornada; lei seca)" }, redirect: "follow" });
    if (!pr.ok) return json(502, { error: "o Planalto não respondeu (" + pr.status + ")" });
    const buf = new Uint8Array(await pr.arrayBuffer());
    if (buf.length > 12_000_000) return json(413, { error: "página grande demais" });
    const head = new TextDecoder("latin1").decode(buf.slice(0, 4000));
    const cs = ((pr.headers.get("content-type") || "").match(/charset=([\w-]+)/i) || head.match(/charset=["']?([\w-]+)/i) || [])[1] || "windows-1252";
    let html = "";
    try { html = new TextDecoder(cs.toLowerCase() === "utf-8" ? "utf-8" : "windows-1252").decode(buf); } catch { html = new TextDecoder("windows-1252").decode(buf); }
    const titulo = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim();
    let t = html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(strike|s|del)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d|table|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&ordm;/g, "º").replace(/&ordf;/g, "ª").replace(/&sect;/g, "§").replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d))
      .replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    return json(200, { titulo, url: u.toString(), texto: t.slice(0, 4_000_000) });
  }
  if (body.mode === "lei_busca") {
    const q = String(body.q || "").slice(0, 200);
    if (!q) return json(400, { error: "diga qual lei" });
    const rr = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELS.quick, max_tokens: 1200,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, allowed_domains: ["planalto.gov.br", "www.planalto.gov.br"] }],
        messages: [{ role: "user", content: `Ache no site do Planalto (planalto.gov.br) a página oficial com o TEXTO COMPILADO (versão atualizada) desta norma: "${q}". Responda só com JSON, sem mais nada: {"url":"https://www.planalto.gov.br/...","nome":"nome oficial da norma"}. Se não achar, {"url":"","nome":""}.` }],
      }),
    });
    const jj = await rr.json().catch(() => null);
    if (!rr.ok || !jj) return json(502, { error: "a busca não respondeu" });
    const txt = (jj.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    try { await registrar(user.id, jj.usage?.input_tokens ?? 0, jj.usage?.output_tokens ?? 0); } catch { /* ignora */ }
    const m = txt.match(/\{[\s\S]*\}/);
    let o: any = {}; try { o = m ? JSON.parse(m[0]) : {}; } catch { /* ignora */ }
    const url = typeof o.url === "string" && /^https?:\/\/(www\.)?planalto\.gov\.br\//i.test(o.url) ? o.url : "";
    return json(200, { url, nome: String(o.nome || "").slice(0, 200) });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json(400, { error: "sem mensagens" });

  const payload: Record<string, unknown> = {
    model: MODELS[body.tier] ?? MODELS.default,
    max_tokens: Math.min(Number(body.max_tokens) || 8192, 32000),
    messages,
    stream: !!body.stream,
  };
  if (typeof body.system === "string" && body.system) payload.system = body.system;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    return new Response(t, { status: r.status, headers: { ...CORS, "content-type": "application/json" } });
  }
  if (payload.stream) {
    // repassa o texto enquanto chega e, no fim, soma os tokens usados
    let ent = 0, sai = 0, buf = "";
    const dec = new TextDecoder();
    const tap = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        ctl.enqueue(chunk);
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5));
            if (ev.type === "message_start") ent = ev.message?.usage?.input_tokens ?? ent;
            if (ev.type === "message_delta") sai = ev.usage?.output_tokens ?? sai;
          } catch { /* linha parcial */ }
        }
      },
      flush() { return registrar(user.id, ent, sai); },
    });
    return new Response(r.body!.pipeThrough(tap), { headers: { ...CORS, "content-type": "text/event-stream", "cache-control": "no-cache" } });
  }
  const txt = await r.text();
  try { const j = JSON.parse(txt); await registrar(user.id, j.usage?.input_tokens ?? 0, j.usage?.output_tokens ?? 0); } catch { /* ignora */ }
  return new Response(txt, { headers: { ...CORS, "content-type": "application/json" } });
});
