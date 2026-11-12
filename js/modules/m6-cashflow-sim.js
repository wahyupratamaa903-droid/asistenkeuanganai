(function() {
  window.registerFinAIModule('m6-cashflow', 'Prediksi & Simulasi', '📈', function(container) {
    const now = new Date();
    const todayDate = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(0, daysInMonth - todayDate);

    let inc = 0, exp = 0;
    (window.transactions || []).forEach(t => {
      if (t.type === 'income') inc += t.nominal;
      else exp += t.nominal;
    });
    const curBalance = inc - exp;
    const dailyBurnRate = Math.round(exp / Math.max(1, todayDate));
    const projectedEndBalance = curBalance - (dailyBurnRate * remainingDays);

    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">🔮 Proyeksi Arus Kas Akhir Bulan</div>
        <div>• Rata-rata pengeluaran harian: <b>Rp ${dailyBurnRate.toLocaleString('id-ID')}/hari</b></div>
        <div>• Sisa hari bulan ini: <b>${remainingDays} hari</b></div>
        <div style="margin-top:6px;">• Proyeksi Saldo Akhir Bulan: <b style="color:${projectedEndBalance >= 0 ? '#34d399' : '#f43f5e'};">Rp ${projectedEndBalance.toLocaleString('id-ID')}</b></div>
      </div>

      <div class="fmod-box">
        <div style="font-weight:800;color:#38bdf8;margin-bottom:8px;">🎯 Simulator Target Tabungan</div>
        <input id="m6-target" type="number" class="fmod-input" placeholder="Harga Target Impian (cth: 10000000)">
        <input id="m6-monthly" type="number" class="fmod-input" placeholder="Rencana Nabung per Bulan (cth: 500000)">
        <button id="m6-calc" class="fmod-btn">Hitung Kapan Tercapai</button>
        <div id="m6-res" style="margin-top:8px;color:#e2e8f0;"></div>
      </div>
    `;

    document.getElementById('m6-calc').onclick = () => {
      const target = Number(document.getElementById('m6-target').value) || 0;
      const monthly = Number(document.getElementById('m6-monthly').value) || 0;
      if (target <= 0 || monthly <= 0) return;
      const months = Math.ceil(target / monthly);
      const achieveDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
      const dateStr = achieveDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      document.getElementById('m6-res').innerHTML = `✅ Dengan menabung <b>Rp ${monthly.toLocaleString('id-ID')}/bulan</b>, target Rp ${target.toLocaleString('id-ID')} akan tercapai dalam <b>${months} bulan</b> (sekitar <b>${dateStr}</b>).`;
    };
  });
})();
