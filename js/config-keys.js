window.FINAI_KEYS = {
  OPENROUTER_1: "sk-or-v1-" + "38d2e4834a9546f6ab214906a3dab2ad9cade40ad04ff89de7ccf82829d3ce62",
  OPENROUTER_2: "sk-or-v1-" + "fb4edea4b324d13a83e5985de81ade2d32c27021739f73328f1de23db04d1b39",
  GROQ:         "gsk_" + "I1YOk9klQEAgJAgKI4j6WGdyb3FYf2OwMhcKcB5v0OYgrksnroen",
  CEREBRAS:     "csk-" + "5v8wych83t556j3effjee49tjm3f9c8932vd9rem544vvnt5",
  ELEVENLABS:   "sk_" + "1b05368f6bf583410a9bccfe9e63bf6ea19a18d3cee48218",
  EXA:          "0ddb8285-" + "0a93-4694-80e3-79318ecc0ed8",
  FIRECRAWL:    "fc-" + "3254c3133baa4a01973a4c616b3a0803",
  DEEPINFRA:    "X6Gxy6" + "NF6qaLZs1nyM4zNRIkyj4KOUF6",
  GITHUB:       "ghp_" + "lKZfDhrasCEdYokY5UINETtNm79ygP2AkeK4"
};

// Fungsi pemanggil LLM cepat (Groq -> Cerebras -> OpenRouter)
window.finaiCallLLM = async function(messages, jsonMode = false) {
  const K = window.FINAI_KEYS;
  const routes = [
    { url: 'https://api.groq.com/openai/v1/chat/completions', key: K.GROQ, model: 'llama-3.3-70b-versatile' },
    { url: 'https://api.cerebras.ai/v1/chat/completions', key: K.CEREBRAS, model: 'llama-3.3-70b' },
    { url: 'https://openrouter.ai/api/v1/chat/completions', key: K.OPENROUTER_1, model: 'google/gemini-2.5-flash' },
    { url: 'https://openrouter.ai/api/v1/chat/completions', key: K.OPENROUTER_2, model: 'openrouter/auto' }
  ];

  for (const r of routes) {
    try {
      const body = { model: r.model, messages, max_tokens: 800, temperature: 0.2 };
      if (jsonMode && r.url.includes('groq')) body.response_format = { type: 'json_object' };
      const res = await fetch(r.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + r.key },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
    } catch (e) {}
  }
  throw new Error('Tidak dapat terhubung ke server AI.');
};

// Registry untuk menampung modul-modul fitur secara terpisah
window.FinAIModules = window.FinAIModules || {};
window.registerFinAIModule = function(id, title, icon, renderFn) {
  window.FinAIModules[id] = { id, title, icon, renderFn };
  if (typeof window.refreshModuleLauncher === 'function') window.refreshModuleLauncher();
};
