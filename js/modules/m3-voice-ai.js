(function() {
  let mediaRecorder = null;
  let audioChunks = [];

  window.speakWithElevenLabs = async function(text) {
    const key = window.FINAI_KEYS?.ELEVENLABS;
    const cleanText = String(text).replace(/[*#_`~]/g, '');
    if (!key) return fallbackBrowserTTS(cleanText);

    try {
      // Gunakan voice multibahasa ElevenLabs (Rachel / Adam)
      const voiceId = '21m00Tcm4TlvDq8ikWAM';
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText.slice(0, 450),
          model_id: 'eleven_multilingual_v2'
        })
      });
      if (!res.ok) throw new Error('Fallback TTS');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      fallbackBrowserTTS(cleanText);
    }
  };

  function fallbackBrowserTTS(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID';
      window.speechSynthesis.speak(u);
    }
  }

  async function transcribeWithGroqWhisper(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'id');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + window.FINAI_KEYS.GROQ },
      body: formData
    });
    const data = await res.json();
    return data.text || '';
  }

  window.registerFinAIModule('m3-voice', 'Voice & Podcast AI', '🎙️', function(container) {
    container.innerHTML = `
      <div class="fmod-box">
        <b>🎙️ Rekam Suara Presisi Tinggi (Groq Whisper + ElevenLabs)</b>
        <p style="color:#94a3b8;margin:6px 0 10px;">Bicara santai untuk mencatat transaksi atau bertanya, lalu dengarkan balasan suara AI.</p>
        <button id="m3-rec-btn" class="fmod-btn">🎤 Mulai Bicara (Whisper STT)</button>
        <button id="m3-pod-btn" class="fmod-btn" style="background:#8b5cf6;color:#fff;margin-top:8px;">🎧 Putar Ringkasan Audio Mingguan (ElevenLabs)</button>
        <div id="m3-status" style="margin-top:10px;color:#34d399;font-size:11px;"></div>
      </div>
    `;

    const recBtn = document.getElementById('m3-rec-btn');
    const statusEl = document.getElementById('m3-status');

    recBtn.onclick = async () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recBtn.textContent = '⏳ Menerjemahkan suara via Groq Whisper...';
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          try {
            const transcript = await transcribeWithGroqWhisper(blob);
            recBtn.textContent = '🎤 Mulai Bicara (Whisper STT)';
            if (transcript) {
              statusEl.textContent = `Terdeteksi: "${transcript}"`;
              document.getElementById('finai-mod-launcher').style.display = 'none';
              const chatInput = document.getElementById('chat-input');
              if (chatInput) {
                chatInput.value = transcript;
                await handleUserInput();
              }
            }
          } catch (err) {
            recBtn.textContent = '🎤 Mulai Bicara (Whisper STT)';
            statusEl.textContent = 'Gagal transkripsi: ' + err.message;
          }
        };
        mediaRecorder.start();
        recBtn.textContent = '⏹️ Selesai Bicara (Klik untuk Kirim)';
        recBtn.style.background = '#ef4444';
        recBtn.style.color = '#fff';
      } catch (e) {
        statusEl.textContent = 'Izinkan akses mikrofon di browser Anda.';
      }
    };

    document.getElementById('m3-pod-btn').onclick = async () => {
      statusEl.textContent = 'Menyusun naskah ringkasan mingguan...';
      const list = window.transactions || [];
      let inc = 0, exp = 0;
      list.forEach(t => { if (t.type === 'income') inc += t.nominal; else exp += t.nominal; });
      const prompt = `Buat ringkasan podcast radio singkat (maksimal 3 kalimat ramah) dalam bahasa Indonesia untuk pengguna bernama Aditya. Saldo saat ini Rp ${(inc - exp).toLocaleString('id-ID')}, pemasukan Rp ${inc.toLocaleString('id-ID')}, pengeluaran Rp ${exp.toLocaleString('id-ID')}.`;
      try {
        const script = await window.finaiCallLLM([{ role: 'user', content: prompt }]);
        statusEl.textContent = script;
        window.speakWithElevenLabs(script);
      } catch (e) {
        statusEl.textContent = 'Gagal membuat podcast.';
      }
    };
  });
})();
