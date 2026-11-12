(function() {
  window.registerFinAIModule('m12-link', 'Bedah Link & Web', '🔗', function(container) {
    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">🔗 Bedah Link Artikel / Barang (Jina AI Reader)</div>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 8px;">Tempel link berita ekonomi/emas atau halaman web apa pun. Jina AI akan mengekstrak isinya dan menganalisis dampaknya ke keuangan Anda.</p>
        <input id="m12-url" class="fmod-input" placeholder="https://...">
        <button id="m12-btn" class="fmod-btn">🌐 Ekstrak & Analisis Link</button>
        <div id="m12-res" style="margin-top:10px;font-size:11px;color:#e2e8f0;white-space:pre-wrap;"></div>
      </div>
    `;

    document.getElementById('m12-btn').onclick = async () => {
      const url = document.getElementById('m12-url').value.trim();
      const resEl = document.getElementById('m12-res');
      if (!url.startsWith('http')) return alert('Masukkan URL lengkap diawali https://');
      resEl.textContent = '⏳ Membaca isi halaman web dengan Jina AI...';

      try {
        const jinaRes = await fetch('https://r.jina.ai/' + url, {
          headers: { 'Authorization': 'Bearer ' + window.FINAI_KEYS.JINA }
        });
        const textContent = (await jinaRes.text()).slice(0, 3000);
        const saldo = typeof getCurrentTotalBalance === 'function' ? getCurrentTotalBalance() : 0;

        const summary = await window.finaiCallLLM([
          { role: 'system', content: 'Rangkum poin terpenting dari halaman web berikut dan berikan saran finansial berdasarkan saldo pengguna Rp ' + saldo.toLocaleString('id-ID') },
          { role: 'user', content: textContent }
        ]);
        resEl.textContent = summary;
      } catch (e) {
        resEl.textContent = 'Gagal mengekstrak halaman: ' + e.message;
      }
    };
  });
})();
