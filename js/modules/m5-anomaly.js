(function() {
  function analyzeAnomalies() {
    const list = (window.transactions || []).filter(t => t.type === 'expense');
    const subsKeywords = /netflix|spotify|youtube|icloud|google one|wifi|indihome|biznet|bpjs|listrik|pln|pulsa|paket data|gym| Prime/i;
    const subscriptions = list.filter(t => subsKeywords.test(t.description));

    // Deteksi kemungkinan duplikat (deskripsi & nominal sama di tanggal yang sama)
    const seen = new Set();
    const duplicates = [];
    list.forEach(t => {
      const key = `${t.date}|${t.description.toLowerCase()}|${t.nominal}`;
      if (seen.has(key)) duplicates.push(t);
      seen.add(key);
    });

    // Hitung peringatan 80% per kategori dari budget/rata-rata
    const catTotals = {};
    list.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.nominal; });
    const avgLimit = (window.monthlyBudget || 2000000) * 0.35;
    const warnings = [];
    Object.entries(catTotals).forEach(([cat, total]) => {
      const pct = Math.round((total / avgLimit) * 100);
      if (pct >= 80) warnings.push({ cat, total, pct });
    });

    return { subscriptions, duplicates, warnings };
  }

  window.registerFinAIModule('m5-anomaly', 'Anomali & Langganan', '🚨', function(container) {
    const { subscriptions, duplicates, warnings } = analyzeAnomalies();
    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#f59e0b;margin-bottom:6px;">⚠️ Peringatan Kategori (>80% Rata-rata)</div>
        ${warnings.length ? warnings.map(w => `<div>• <b>${w.cat}</b>: Rp ${w.total.toLocaleString('id-ID')} (${w.pct}% dari batas wajar)</div>`).join('') : '<div style="color:#94a3b8;">Semua kategori masih di bawah batas aman 80%.</div>'}
      </div>
      <div class="fmod-box">
        <div style="font-weight:800;color:#38bdf8;margin-bottom:6px;">🔄 Deteksi Tagihan & Langganan Berulang</div>
        ${subscriptions.length ? subscriptions.map(s => `<div>• ${s.description}: <b>Rp ${s.nominal.toLocaleString('id-ID')}</b> (${s.date})</div>`).join('') : '<div style="color:#94a3b8;">Belum terdeteksi transaksi langganan (Netflix/Spotify/Wifi).</div>'}
      </div>
      <div class="fmod-box">
        <div style="font-weight:800;color:#f43f5e;margin-bottom:6px;">👯 Kemungkinan Transaksi Duplikat</div>
        ${duplicates.length ? duplicates.map(d => `<div>• ${d.description} - Rp ${d.nominal.toLocaleString('id-ID')} (${d.date})</div>`).join('') : '<div style="color:#94a3b8;">Tidak ada transaksi ganda yang terdeteksi.</div>'}
      </div>
    `;
  });
})();
