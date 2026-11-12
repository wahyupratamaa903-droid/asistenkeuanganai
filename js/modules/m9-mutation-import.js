(function() {
  let stagedTransactions = [];

  window.registerFinAIModule('m9-import', 'Impor Mutasi Bank', '📥', function(container) {
    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">📥 Impor Mutasi CSV / Teks E-Wallet</div>
        <input type="file" id="m9-file" accept=".csv,.txt" class="fmod-input">
        <textarea id="m9-text" class="fmod-input" rows="3" placeholder="Atau tempel teks mutasi rekening/e-wallet di sini..."></textarea>
        <button id="m9-parse" class="fmod-btn">🤖 Ekstrak & Pratinjau dengan AI</button>
        <div id="m9-preview" style="margin-top:10px;"></div>
      </div>
    `;

    document.getElementById('m9-file').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { document.getElementById('m9-text').value = String(ev.target.result || '').slice(0, 3500); };
      reader.readAsText(file);
    };

    document.getElementById('m9-parse').onclick = async () => {
      const raw = document.getElementById('m9-text').value.trim();
      const prev = document.getElementById('m9-preview');
      if (!raw) return;
      prev.innerHTML = '⏳ Mengekstrak daftar mutasi...';
      try {
        const prompt = `Ekstrak daftar transaksi dari teks/CSV mutasi berikut ke dalam JSON:
{"items":[{"description":"Nama","nominal":50000,"type":"expense","category":"Belanja Harian","date":"12 Nov 2026"}]}
Data mutasi:\n${raw.slice(0, 2500)}`;
        const res = await window.finaiCallLLM([{ role: 'user', content: prompt }], true);
        const parsed = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
        stagedTransactions = parsed.items || [];

        if (!stagedTransactions.length) {
          prev.innerHTML = 'Tidak ada transaksi yang ditemukan.';
          return;
        }
        prev.innerHTML = `
          <div style="font-weight:700;color:#34d399;margin-bottom:6px;">Ditemukan ${stagedTransactions.length} Transaksi (Siap Konfirmasi):</div>
          <div style="max-height:140px;overflow-y:auto;font-size:11px;margin-bottom:8px;">
            ${stagedTransactions.map(t => `<div>• ${t.description} (${t.category}): <b>Rp ${Number(t.nominal).toLocaleString('id-ID')}</b></div>`).join('')}
          </div>
          <button id="m9-confirm" class="fmod-btn">✅ Konfirmasi & Simpan Semua</button>
        `;
        document.getElementById('m9-confirm').onclick = () => {
          stagedTransactions.forEach(t => recordTransaction(t));
          prev.innerHTML = `🎉 <b>${stagedTransactions.length} transaksi berhasil disimpan!</b>`;
          stagedTransactions = [];
        };
      } catch (e) {
        prev.innerHTML = 'Gagal mengekstrak mutasi: ' + e.message;
      }
    };
  });
})();
