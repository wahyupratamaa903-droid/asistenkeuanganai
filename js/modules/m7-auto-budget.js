(function() {
  window.registerFinAIModule('m7-budget', 'Budget 50/30/20', '⚖️', function(container) {
    let totalInc = 0;
    (window.transactions || []).filter(t => t.type === 'income').forEach(t => totalInc += t.nominal);
    const baseIncome = totalInc > 0 ? totalInc : (window.monthlyBudget || 3000000);

    const needs = Math.round(baseIncome * 0.5);
    const wants = Math.round(baseIncome * 0.3);
    const savings = Math.round(baseIncome * 0.2);

    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">⚖️ Rekomendasi Budget 50/30/20</div>
        <div style="color:#94a3b8;font-size:11px;margin-bottom:8px;">Berdasarkan Basis Pemasukan: <b>Rp ${baseIncome.toLocaleString('id-ID')}</b></div>
        <div>🏠 <b>50% Kebutuhan Pokok:</b> Rp ${needs.toLocaleString('id-ID')} <br><span style="color:#94a3b8;font-size:10px;">(Makan: Rp ${Math.round(needs*0.5).toLocaleString('id-ID')}, Transport: Rp ${Math.round(needs*0.25).toLocaleString('id-ID')}, Tagihan: Rp ${Math.round(needs*0.25).toLocaleString('id-ID')})</span></div>
        <div style="margin-top:6px;">🎉 <b>30% Keinginan & Gaya Hidup:</b> Rp ${wants.toLocaleString('id-ID')} <br><span style="color:#94a3b8;font-size:10px;">(Belanja & Hiburan)</span></div>
        <div style="margin-top:6px;">💎 <b>20% Tabungan & Investasi:</b> Rp ${savings.toLocaleString('id-ID')} <br><span style="color:#94a3b8;font-size:10px;">(Sinking Fund, Emas & Portofolio)</span></div>
      </div>
    `;
  });
})();
