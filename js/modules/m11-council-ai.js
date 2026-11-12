(function() {
  async function askSingleProvider(url, key, model, roleDesc, question) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: roleDesc + ' Jawab maksimal 2 kalimat padat dalam bahasa Indonesia.' },
            { role: 'user', content: question }
          ],
          max_tokens: 180,
          temperature: 0.4
        })
      });
      const d = await res.json();
      return d?.choices?.[0]?.message?.content || 'Tidak ada respons.';
    } catch (e) {
      return 'Gagal memuat opini.';
    }
  }

  window.registerFinAIModule('m11-council', 'Dewan 3 Otak AI', '⚔️', function(container) {
    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">⚔️ Dewan Penasihat 3 Provider AI</div>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 8px;">Uji keputusan finansial Anda dengan 3 mesin AI tercepat secara paralel (Groq, Cerebras, dan OpenRouter/SambaNova).</p>
        <input id="m11-q" class="fmod-input" placeholder="Cth: Uang 2 juta mending beli emas atau trading forex?">
        <button id="m11-btn" class="fmod-btn">⚡ Jalankan Debat 3 AI Sekaligus</button>
        <div id="m11-res" style="margin-top:10px;display:grid;gap:8px;"></div>
      </div>
    `;

    document.getElementById('m11-btn').onclick = async () => {
      const q = document.getElementById('m11-q').value.trim();
      if (!q) return;
      const resBox = document.getElementById('m11-res');
      resBox.innerHTML = '<div style="color:#34d399;font-size:11px;">⏳ Memanggil Groq, Cerebras, dan Gemini secara bersamaan...</div>';

      const K = window.FINAI_KEYS;
      const saldo = typeof getCurrentTotalBalance === 'function' ? getCurrentTotalBalance() : 0;
      const fullQ = `Saldo kas saya saat ini Rp ${saldo.toLocaleString('id-ID')}. Pertanyaan: ${q}`;

      const [op1, op2, op3] = await Promise.all([
        askSingleProvider('https://api.groq.com/openai/v1/chat/completions', K.GROQ, 'llama-3.3-70b-versatile', 'Anda Penasihat Konservatif (fokus keamanan dana darurat & anti-risiko).', fullQ),
        askSingleProvider('https://api.cerebras.ai/v1/chat/completions', K.CEREBRAS, 'llama-3.3-70b', 'Anda Strategis Pertumbuhan (fokus efisiensi modal, investasi emas/aset & imbal hasil).', fullQ),
        askSingleProvider('https://openrouter.ai/api/v1/chat/completions', K.OPENROUTER_1, 'google/gemini-2.5-flash', 'Anda Hakim Finansial Objektif (memberikan jalan tengah paling realistis).', fullQ)
      ]);

      resBox.innerHTML = `
        <div style="background:#090d16;border-left:3px solid #38bdf8;padding:8px;border-radius:6px;font-size:11px;">
          <b style="color:#38bdf8;">🛡️ Opini 1 — Konservatif (Groq Llama-3.3):</b><br>${op1}
        </div>
        <div style="background:#090d16;border-left:3px solid #f59e0b;padding:8px;border-radius:6px;font-size:11px;">
          <b style="color:#f59e0b;">🚀 Opini 2 — Agresif/Bertumbuh (Cerebras Engine):</b><br>${op2}
        </div>
        <div style="background:#090d16;border-left:3px solid #10b981;padding:8px;border-radius:6px;font-size:11px;">
          <b style="color:#10b981;">⚖️ Putusan Akhir (Gemini 2.5 Flash):</b><br>${op3}
        </div>
      `;
    };
  });
})();
