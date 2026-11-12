(function() {
  let isPrivacyMode = localStorage.getItem('finai_privacy_mode') === 'true';

  function injectPremiumStyles() {
    if (document.getElementById('finai-premium-css')) return;
    const style = document.createElement('style');
    style.id = 'finai-premium-css';
    style.textContent = `
      /* Aurora Background & Smooth Transitions */
      body {
        background: radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.14), transparent 55%), #060a12 !important;
        letter-spacing: -0.01em;
      }
      /* Kartu Utama Glassmorphism Mewah */
      #main-app > div:first-child, .bg-slate-900 {
        background: linear-gradient(145deg, rgba(19, 28, 49, 0.92), rgba(11, 17, 30, 0.96)) !important;
        backdrop-filter: blur(16px) !important;
        border: 1px solid rgba(52, 211, 153, 0.16) !important;
        box-shadow: 0 14px 35px -10px rgba(0, 0, 0, 0.65) !important;
      }
      /* Efek Kartu Total Saldo Cash */
      #stat-balance {
        background: linear-gradient(90deg, #ffffff, #a7f3d0);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 900 !important;
        letter-spacing: -0.02em;
      }
      /* Efek Tekan Tombol Halus */
      button {
        transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease !important;
      }
      button:active {
        transform: scale(0.96) !important;
      }
      /* Sensor Blur Mode Privasi */
      body.finai-privacy-active #stat-balance,
      body.finai-privacy-active #stat-income,
      body.finai-privacy-active #stat-expense,
      body.finai-privacy-active #history-table-body td:nth-child(3) {
        filter: blur(8px);
        user-select: none;
        transition: filter 0.25s ease;
      }
      /* Bar Kesehatan Arus Kas */
      #finai-health-wrap {
        margin-top: 10px;
        background: rgba(15, 23, 42, 0.75);
        border-radius: 999px;
        height: 6px;
        width: 100%;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
      }
      #finai-health-bar {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        border-radius: 999px;
        transition: width 0.5s ease, background 0.4s ease;
      }
      .finai-eye-btn {
        margin-left: 8px;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.25);
        color: #94a3b8;
        padding: 5px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceBalanceCard() {
    const balEl = document.getElementById('stat-balance');
    if (!balEl || document.getElementById('finai-eye-toggle')) return;

    // Tombol Sensor Saldo (Privasi)
    const eyeBtn = document.createElement('button');
    eyeBtn.id = 'finai-eye-toggle';
    eyeBtn.type = 'button';
    eyeBtn.className = 'finai-eye-btn';
    eyeBtn.innerHTML = isPrivacyMode ? '🙈 Tampilkan' : '👁️ Privasi';
    eyeBtn.onclick = () => {
      isPrivacyMode = !isPrivacyMode;
      localStorage.setItem('finai_privacy_mode', isPrivacyMode);
      document.body.classList.toggle('finai-privacy-active', isPrivacyMode);
      eyeBtn.innerHTML = isPrivacyMode ? '🙈 Tampilkan' : '👁️ Privasi';
    };

    const editBtn = document.getElementById('btn-edit-balance');
    if (editBtn) {
      editBtn.insertAdjacentElement('afterend', eyeBtn);
    } else {
      balEl.parentElement.appendChild(eyeBtn);
    }

    // Bar Kesehatan Kas & Label Rasio
    const healthContainer = document.createElement('div');
    healthContainer.innerHTML = `
      <div id="finai-health-wrap"><div id="finai-health-bar"></div></div>
      <div id="finai-health-label" style="font-size:10px;color:#94a3b8;margin-top:4px;display:flex;justify-content:space-between;">
        <span>Kesehatan Arus Kas</span>
        <span id="finai-health-pct" style="color:#34d399;font-weight:700;">100% Aman</span>
      </div>
    `;
    balEl.parentElement.appendChild(healthContainer);

    if (isPrivacyMode) document.body.classList.add('finai-privacy-active');
    updateHealthBar();
  }

  function updateHealthBar() {
    const bar = document.getElementById('finai-health-bar');
    const pctEl = document.getElementById('finai-health-pct');
    if (!bar || !pctEl) return;

    let inc = 0, exp = 0;
    (window.transactions || []).forEach(t => {
      if (t.type === 'income') inc += t.nominal;
      else exp += t.nominal;
    });

    const ratio = inc > 0 ? Math.max(0, Math.min(100, Math.round(((inc - exp) / inc) * 100))) : 100;
    bar.style.width = ratio + '%';

    if (ratio >= 50) {
      bar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      pctEl.style.color = '#34d399';
      pctEl.textContent = `Sisa Kas ${ratio}% (Sehat)`;
    } else if (ratio >= 20) {
      bar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      pctEl.style.color = '#fbbf24';
      pctEl.textContent = `Sisa Kas ${ratio}% (Waspada)`;
    } else {
      bar.style.background = 'linear-gradient(90deg, #ef4444, #f43f5e)';
      pctEl.style.color = '#f43f5e';
      pctEl.textContent = `Sisa Kas ${ratio}% (Kritis)`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectPremiumStyles();
    setTimeout(enhanceBalanceCard, 400);
    // Pantau perubahan saldo secara otomatis
    const origRender = window.renderSummary;
    if (typeof origRender === 'function') {
      window.renderSummary = function() {
        origRender();
        enhanceBalanceCard();
        updateHealthBar();
      };
    }
  });
})();
