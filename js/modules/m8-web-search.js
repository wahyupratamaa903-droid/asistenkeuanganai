(function() {
  async function fetchLiveMarketContext(query) {
    // Ambil kurs USD/IDR real-time dari open API sebagai jangkar fakta
    let usdIdr = '16.200';
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const d = await r.json();
      if (d?.rates?.IDR) usdIdr = Math.round(d.rates.IDR).toLocaleString('id-ID');
    } catch (e) {}

    // Coba panggil Exa Search jika tersedia
    let webSnippets = `Kurs 1 USD saat ini = Rp ${usdIdr}.`;
    try {
      const exaRes = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': window.FINAI_KEYS.EXA },
        body: JSON.stringify({ query: query + ' Indonesia terbaru', numResults: 2, contents: { text: true } })
      });
      if (exaRes.ok) {
        const exaData = await exaRes.json();
        if (exaData?.results?.length) {
          webSnippets += '\n' + exaData.results.map(x => `${x.title}: ${(x.text || '').slice(0, 200)}`).join('\n');
        }
      }
    } catch (e) {}
    return webSnippets;
  }

  window.registerFinAIModule('m8-search', 'Riset Kurs & Emas', '🌐', function(container) {
    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">🌐 Riset & Edukasi Finansial Faktual</div>
        <input id="m8-q" class="fmod-input" placeholder="Tanya kurs USD, harga emas, atau suku bunga...">
        <button id="m8-btn" class="fmod-btn">🔍 Cari Fakta & Analisis AI</button>
        <div id="m8-res" style="margin-top:10px;color:#e2e8f0;white-space:pre-wrap;"></div>
      </div>
    `;

    document.getElementById('m8-btn').onclick = async () => {
      const q = document.getElementById('m8-q').value.trim() || 'Berapa kurs USD ke Rupiah dan tips beli emas saat ini?';
      const resEl = document.getElementById('m8-res');
      resEl.textContent = '⏳ Mengambil data pasar terbaru...';
      try {
        const ctx = await fetchLiveMarketContext(q);
        const reply = await window.finaiCallLLM([
          { role: 'system', content: `Gunakan data pasar terkini berikut sebagai konteks faktual:\n${ctx}\nJawab dengan ringkas dan akurat.` },
          { role: 'user', content: q }
        ]);
        resEl.textContent = reply;
      } catch (e) {
        resEl.textContent = 'Gagal memuat riset: ' + e.message;
      }
    };
  });
})();
