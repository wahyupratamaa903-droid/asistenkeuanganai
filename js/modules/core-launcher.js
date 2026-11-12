(function() {
  function initLauncher() {
    if (document.getElementById('finai-mod-launcher')) return;
    const style = document.createElement('style');
    style.textContent = `
      #finai-mod-btn { position:fixed; bottom:84px; right:16px; z-index:9990; background:linear-gradient(135deg,#10b981,#047857); color:#fff; border:1px solid #34d399; border-radius:999px; padding:10px 16px; font-size:12px; font-weight:800; box-shadow:0 8px 25px rgba(16,185,129,0.45); cursor:pointer; display:flex; align-items:center; gap:6px; }
      #finai-mod-launcher { display:none; position:fixed; inset:0; z-index:9999; background:rgba(9,13,24,0.88); backdrop-filter:blur(6px); padding:14px; overflow-y:auto; color:#f8fafc; font-family:system-ui,sans-serif; }
      .fmod-container { max-width:480px; margin:10px auto 40px; background:#0f172a; border:1px solid #1e293b; border-radius:18px; padding:16px; }
      .fmod-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:14px; }
      .fmod-card { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:10px; font-size:11px; font-weight:700; color:#e2e8f0; cursor:pointer; text-align:left; display:flex; align-items:center; gap:8px; }
      .fmod-card.active { border-color:#10b981; background:rgba(16,185,129,0.15); color:#34d399; }
      .fmod-input { width:100%; box-sizing:border-box; background:#090d16; border:1px solid #334155; color:#fff; padding:9px 11px; border-radius:10px; font-size:12px; margin-bottom:8px; }
      .fmod-btn { width:100%; background:#10b981; color:#052e16; border:none; padding:10px; border-radius:10px; font-weight:800; font-size:12px; cursor:pointer; margin-top:4px; }
      .fmod-box { background:#131c31; border:1px solid #1e293b; border-radius:12px; padding:12px; margin-top:10px; font-size:12px; line-height:1.5; }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'finai-mod-btn';
    btn.innerHTML = '🧩 Modul Fitur AI';
    btn.onclick = () => {
      document.getElementById('finai-mod-launcher').style.display = 'block';
      window.refreshModuleLauncher();
    };
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'finai-mod-launcher';
    modal.innerHTML = `
      <div class="fmod-container">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b;padding-bottom:10px;margin-bottom:12px;">
          <div>
            <div style="font-weight:800;font-size:15px;color:#10b981;">🧩 Modul Pintar FinAI</div>
            <div style="font-size:11px;color:#94a3b8;">Arsitektur Terpisah (Aman & Modular)</div>
          </div>
          <button onclick="document.getElementById('finai-mod-launcher').style.display='none'" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div id="fmod-menu" class="fmod-grid"></div>
        <div id="fmod-content"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  window.refreshModuleLauncher = function(activeId) {
    const menu = document.getElementById('fmod-menu');
    const content = document.getElementById('fmod-content');
    if (!menu || !content) return;
    const mods = Object.values(window.FinAIModules || {});
    if (mods.length === 0) {
      menu.innerHTML = '<div style="grid-column:span 2;color:#94a3b8;font-size:12px;">Belum ada modul tambahan yang dipasang.</div>';
      return;
    }
    const current = activeId || mods[0].id;
    menu.innerHTML = mods.map(m => `
      <button class="fmod-card ${m.id === current ? 'active' : ''}" onclick="window.refreshModuleLauncher('${m.id}')">
        <span style="font-size:16px;">${m.icon}</span>
        <span>${m.title}</span>
      </button>
    `).join('');
    const selected = window.FinAIModules[current];
    if (selected && typeof selected.renderFn === 'function') {
      content.innerHTML = '';
      selected.renderFn(content);
    }
  };

  document.addEventListener('DOMContentLoaded', initLauncher);
})();
