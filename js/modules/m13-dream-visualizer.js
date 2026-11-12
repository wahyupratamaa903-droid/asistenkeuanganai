(function() {
  window.registerFinAIModule('m13-dream', 'Visual Impian AI', '🎨', function(container) {
    container.innerHTML = `
      <div class="fmod-box">
        <div style="font-weight:800;color:#10b981;margin-bottom:6px;">🎨 Visualisasi Target Impian (Pollinations AI)</div>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 8px;">Ubah target tabungan Anda menjadi poster motivasi 3D fotorealistis.</p>
        <input id="m13-prompt" class="fmod-input" placeholder="Cth: MacBook Pro M4 di meja kerja minimalis modern">
        <button id="m13-btn" class="fmod-btn">✨ Buat Gambar Impian</button>
        <div id="m13-img-box" style="margin-top:10px;text-align:center;"></div>
      </div>
    `;

    document.getElementById('m13-btn').onclick = () => {
      const p = document.getElementById('m13-prompt').value.trim() || 'Luxury gold bars and modern laptop on desk, cinematic lighting';
      const box = document.getElementById('m13-img-box');
      const encoded = encodeURIComponent(p + ', photorealistic, 8k, cinematic lighting, luxury financial goal');
      const imgUrl = `https://image.pollinations.ai/prompt/${encoded}?width=600&height=400&nologo=true&seed=${Date.now()}`;
      box.innerHTML = `
        <div style="font-size:11px;color:#34d399;margin-bottom:6px;">🎨 Sedang merender visual impian Anda...</div>
        <img src="${imgUrl}" alt="Dream Goal" style="width:100%;border-radius:12px;border:1px solid #10b981;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
      `;
    };
  });
})();
