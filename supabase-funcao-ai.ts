// A Jornada — função "ai" (Supabase Edge Function).
// Recebe o pedido do painel, confere o login e repassa para a API da Anthropic com a SUA chave,
// que fica guardada só aqui no servidor (segredo ANTHROPIC_API_KEY), nunca no navegador.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  (obrigatório)  sua chave da API da Anthropic
//   ALLOWED_EMAILS     (recomendado)  e-mails que podem usar a IA, separados por vírgula
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
  const allowed = (Deno.env.get("ALLOWED_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(user.email ?? "").toLowerCase())) {
    return json(403, { error: "Esta conta não tem acesso à IA." });
  }

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "pedido inválido" }); }
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
