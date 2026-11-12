(function() {
  function getAssets() {
    return JSON.parse(localStorage.getItem('finai_portfolio_v1') || '[]');
  }
  function saveAssets(list) {
    localStorage.setItem('finai_portfolio_v1', JSON.stringify(list));
  }

  window.registerFinAIModule('m10-portfolio', 'Portofolio & Forex', '🪙', function(container) {
    let usdRate = Number(localStorage.getItem('finai_usd_idr')) || 16200;

    function renderPortfolio() {
      const assets = getAssets();
      let totalIdr = 0;
      const rows = assets.map((a, idx) => {
        const valIdr = a.currency === 'USD' ? Math.round(a.amount * usdRate) : Math.round(a.amount);
        totalIdr += valIdr;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b;padding:6px 0;">
            <div>
              <b>[${a.type}] ${a.name}</b>
              <div style="font-size:10px;color:#94a3b8;">${a.currency === 'USD' ? '$' + a.amount + ' (Rp ' + valIdr.toLocaleString('id-ID') + ')' : 'Rp ' + valIdr.toLocaleString('id-ID')}</div>
            </div>
            <button onclick="window.delPortfolioAsset(${idx})" style="background:none;border:none;color:#f43f5e;cursor:pointer;">🗑️</button>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="fmod-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:800;color:#f59e0b;">🪙 Total Nilai Portofolio Aset</span>
            <span style="font-size:10px;color:#38bdf8;">1 USD ≈ Rp ${usdRate.toLocaleString('id-ID')}</span>
          </div>
          <div style="font-size:18px;font-weight:800;color:#fff;margin:6px 0;">Rp ${totalIdr.toLocaleString('id-ID')}</div>
          ${rows || '<div style="color:#94a3b8;font-size:11px;">Belum ada aset tercatat.</div>'}
        </div>

        <div class="fmod-box">
          <div style="font-weight:800;color:#10b981;margin-bottom:8px;">+ Tambah Aset (Emas / Forex / Kripto / Tanah)</div>
          <select id="m10-type" class="fmod-input">
            <option value="Emas">🥇 Emas / Logam Mulia (XAU)</option>
            <option value="Forex">💱 Forex / Mata Uang Asing (USD/EUR)</option>
            <option value="Kripto">₿ Kripto (BTC/ETH/USDT)</option>
            <option value="Saham">📊 Saham / Reksadana</option>
            <option value="Tanah">🏡 Tanah & Properti</option>
          </select>
          <input id="m10-name" class="fmod-input" placeholder="Keterangan Aset (cth: Emas Antam 10g / Saldo Broker USD)">
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:6px;">
            <select id="m10-cur" class="fmod-input">
              <option value="IDR">IDR (Rp)</option>
              <option value="USD">USD ($)</option>
            </select>
            <input id="m10-val" type="number" class="fmod-input" placeholder="Nilai Saat Ini">
          </div>
          <button id="m10-add" class="fmod-btn">Simpan ke Portofolio</button>
        </div>
      `;

      document.getElementById('m10-add').onclick = () => {
        const type = document.getElementById('m10-type').value;
        const name = document.getElementById('m10-name').value.trim();
        const currency = document.getElementById('m10-cur').value;
        const amount = parseFloat(document.getElementById('m10-val').value) || 0;
        if (!name || amount <= 0) return;
        const list = getAssets();
        list.push({ type, name, currency, amount });
        saveAssets(list);
        renderPortfolio();
      };
    }

    window.delPortfolioAsset = function(idx) {
      const list = getAssets();
      list.splice(idx, 1);
      saveAssets(list);
      renderPortfolio();
    };

    // Update kurs USD/IDR real-time di latar belakang
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => {
        if (d?.rates?.IDR) {
          usdRate = Math.round(d.rates.IDR);
          localStorage.setItem('finai_usd_idr', usdRate);
          renderPortfolio();
        }
      }).catch(() => {});

    renderPortfolio();
  });
})();
