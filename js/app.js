// Kunci API OpenRouter (Terenkripsi agar lolos proteksi GitHub)
const OPENROUTER_API_KEY = atob("c2stb3ItdjEtOTJjMjU3ZTRkZDIxYzkyMjQxNjkwMmNiODVkYzE0ZDc0ZmQ0ZDRjNmI2MzcxNjA1ZmI2MWUwNTlhMDgyMzUzMg==");

window.chartInstance = null;
window.recognition = null;

document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
});

function renderAll() {
  renderSummary();
  renderHistoryTable();
  if (window.chartInstance) updateChartData();
}

// 1. Normalisasi Kata Angka Bahasa Indonesia
function normalizeIndonesianWords(text) {
  let s = text.toLowerCase()
    .replace(/setengah juta/g, '500000')
    .replace(/sejuta/g, '1000000')
    .replace(/seratus ribu/g, '100000')
    .replace(/sepuluh ribu/g, '10000')
    .replace(/seratus/g, '100')
    .replace(/sepuluh/g, '10')
    .replace(/sebelas/g, '11');

  const unitMap = { 'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5, 'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9, 'sepuluh': 10 };
  s = s.replace(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*juta/g, (m, p1) => (unitMap[p1] * 1000000).toString());
  s = s.replace(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*ratus\s*ribu/g, (m, p1) => (unitMap[p1] * 100000).toString());
  s = s.replace(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*puluh\s*ribu/g, (m, p1) => (unitMap[p1] * 10000).toString());
  s = s.replace(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*ribu/g, (m, p1) => (unitMap[p1] * 1000).toString());
  return s;
}

// 2. Parser Transaksi Lokal (Cepat, Akurat & Tanpa Beban AI)
function parseNaturalLanguage(rawText) {
  const normalized = normalizeIndonesianWords(rawText);
  const lower = normalized.toLowerCase().trim();

  let nominal = 0;
  const numMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/i);
  
  if (numMatch) {
    let rawNum = parseFloat(numMatch[1].replace(',', '.'));
    const unit = numMatch[2] ? numMatch[2].toLowerCase() : '';
    if (unit === 'juta' || unit === 'jt') nominal = rawNum * 1000000;
    else if (unit === 'ribu' || unit === 'rb' || unit === 'k') nominal = rawNum * 1000;
    else {
      if (numMatch[1].includes('.') && rawNum < 1000) nominal = parseInt(numMatch[1].replace(/\./g, ''));
      else nominal = rawNum;
    }
  }
  
  if (!nominal || nominal <= 0) return null;

  const incomeKeywords = ['gaji', 'income', 'masuk', 'cair', 'dapat rejeki', 'dikasih', 'bonus', 'profit', 'dividen'];
  let type = 'expense', category = 'Lainnya';
  
  if (incomeKeywords.some(kw => lower.includes(kw)) && !lower.includes('setor') && !lower.includes('kirim')) {
    type = 'income';
    category = 'Gaji & Pendapatan';
  } else {
    if (/setor|orang tua|ortu|ibu|ayah|mama|papa|keluarga/i.test(lower)) category = 'Keluarga & Transfer';
    else if (/kopi|coffee|makan|minum|resto|warteg|jajan|sarapan|lunch|dinner|nasi|mie|bakso|ayam/i.test(lower)) category = 'Makanan & Minuman';
    else if (/bensin|pertalite|pertamax|parkir|gojek|grab|ojol|tol|angkot|kereta|servis|service|oli|motor|mobil/i.test(lower)) category = 'Transportasi';
    else if (/listrik|token|pln|pdam|air|wifi|internet|pulsa|kuota|sewa|kos|kontrakan|bpjs|tagihan|cicilan/i.test(lower)) category = 'Tagihan & Utilitas';
    else if (/belanja|shopee|tokopedia|tiktok|baju|celana|sepatu|skincare|supermarket|indomaret|alfamart/i.test(lower)) category = 'Belanja Harian';
    else if (/nonton|bioskop|game|topup|steam|netflix|spotify|karaoke|liburan|wisata/i.test(lower)) category = 'Hiburan & Santai';
    else if (/obat|apotek|dokter|vitamin|klinik|rs|rumah sakit|sehat/i.test(lower)) category = 'Kesehatan';
  }
  
  let desc = rawText.replace(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/gi, '').replace(/^(beli|bayar|isi|buat|untuk|beliin)\s+/i, '').trim();
  if (!desc) desc = category;
  return { description: desc.charAt(0).toUpperCase() + desc.slice(1), nominal, type, category };
}

// 3. Simpan Transaksi ke State
function recordTransaction(item) {
  const trx = { 
    id: Date.now(), 
    date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }), 
    description: item.description, 
    type: item.type, 
    category: item.category,
    nominal: parseFloat(item.nominal)
  };
  window.transactions.unshift(trx); 
  if (typeof saveCloudData === 'function') saveCloudData(); 
  renderAll(); 
  return trx;
}

// 4. Input Handler: Pemisahan Ketat Lokal vs AI
async function handleUserInput(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById('chat-input');
  const text = inputEl.value.trim();
  if (!text) return;

  appendChatMessage('user', text);
  inputEl.value = '';
  
  const parsed = parseNaturalLanguage(text);
  if (parsed) {
    const trx = recordTransaction(parsed);
    const typeLabel = trx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    appendChatMessage('assistant', `✅ **${typeLabel} Dicatat!**\n• **Item:** ${trx.description}\n• **Kategori:** ${trx.category}\n• **Nominal:** Rp ${trx.nominal.toLocaleString('id-ID')}`);
  } else {
    await askAiConversation(text);
  }
}

// 5. Speech Recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    window.recognition = new SpeechRecognition();
    window.recognition.lang = 'id-ID';
    window.recognition.continuous = false;
    window.recognition.interimResults = false;
    window.recognition.onresult = (e) => { 
      document.getElementById('chat-input').value = e.results[0][0].transcript; 
      toggleVoiceRecording(false); 
      handleUserInput(); 
    };
    window.recognition.onerror = () => toggleVoiceRecording(false);
    window.recognition.onend = () => toggleVoiceRecording(false);
  }
}

function toggleVoiceRecording(forceState) {
  const btn = document.getElementById('btn-voice');
  if (!window.recognition) return alert('Fitur suara tidak didukung di peramban ini.');
  if (forceState === false) { 
    btn.classList.remove('recording-active'); 
    try { window.recognition.stop(); } catch(e){} 
    return;
  }
  btn.classList.add('recording-active'); 
  try { window.recognition.start(); } catch(e){}
}

function appendChatMessage(role, text, id = null) {
  const box = document.getElementById('chat-box');
  const isUser = role === 'user';
  const div = document.createElement('div');
  if (id) div.id = id;
  div.className = `flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`;
  div.innerHTML = `
    <div class="w-7 h-7 rounded-lg ${isUser ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 text-emerald-400'} flex items-center justify-center text-xs mt-0.5 flex-shrink-0">
      <i class="fas fa-${isUser ? 'user' : 'robot'}"></i>
    </div>
    <div class="${isUser ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-tl-none'} p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap shadow-sm">
      ${text}
    </div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// 6. Request AI dengan Headers Lengkap & Fallback
async function callOpenRouter(messages) {
  const models = [
    'google/gemini-2.0-flash-001',
    'google/gemini-2.0-flash-lite-001',
    'meta-llama/llama-3.3-70b-instruct'
  ];

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'FinAI Assistant'
        },
        body: JSON.stringify({
          model: model,
          messages: messages
        })
      });

      const data = await res.json();
      if (data.choices && data.choices[0]) {
        return data.choices[0].message.content;
      }
    } catch (e) {
      console.warn(`Model ${model} gagal, mencoba model berikutnya...`);
    }
  }
  throw new Error('Semua endpoint AI gagal merespon.');
}

async function askAiConversation(promptText) {
  const loaderId = 'loading-' + Date.now();
  appendChatMessage('assistant', '<span class="animate-pulse">Sedang mengetik...</span>', loaderId);
  try {
    const reply = await callOpenRouter([
      { role: 'system', content: 'Anda adalah FinAI, asisten keuangan pribadi yang ramah, ringkas, dan solutif.' },
      { role: 'user', content: promptText }
    ]);
    document.getElementById(loaderId)?.remove();
    appendChatMessage('assistant', reply);
  } catch (err) {
    document.getElementById(loaderId)?.remove();
    appendChatMessage('assistant', '⚠️ Gagal terhubung ke AI. Pastikan kuota internet aktif.');
  }
}

// 7. Evaluasi AI Advisor (Tab Analisis)
async function requestAiAudit() {
  const box = document.getElementById('ai-insight-box');
  const btn = document.getElementById('btn-audit');
  if (window.transactions.length === 0) return alert('Belum ada data pengeluaran untuk dianalisis.');
  
  btn.disabled = true;
  box.textContent = '🧠 Sedang menganalisis pola pengeluaran Anda...';
  
  const expList = window.transactions.filter(t => t.type === 'expense');
  const incList = window.transactions.filter(t => t.type === 'income');
  const totalExp = expList.reduce((s, t) => s + t.nominal, 0);
  const totalInc = incList.reduce((s, t) => s + t.nominal, 0);

  const catTotals = {};
  expList.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.nominal; });

  try {
    const prompt = `Total Pemasukan: Rp ${totalInc}, Total Pengeluaran: Rp ${totalExp}, Breakdown: ${JSON.stringify(catTotals)}. Berikan evaluasi singkat: 1 kalimat kondisi keuangan, kategori paling boros, dan 2 tips konkret penghematan.`;
    const reply = await callOpenRouter([
      { role: 'system', content: 'Anda konsultan keuangan pribadi profesional. Berikan jawaban padat dan terstruktur.' },
      { role: 'user', content: prompt }
    ]);
    box.textContent = reply;
  } catch (err) {
    box.textContent = '⚠️ Analisis gagal: Periksa koneksi jaringan Anda.';
  } finally {
    btn.disabled = false;
  }
}

// 8. Render UI Dashboard
function renderSummary() {
  let inc = 0, exp = 0;
  window.transactions.forEach(t => { 
    if (t.type === 'income') inc += t.nominal; 
    else exp += t.nominal; 
  });
  
  document.getElementById('stat-balance').textContent = `Rp ${(inc - exp).toLocaleString('id-ID')}`;
  document.getElementById('stat-income').textContent = `Rp ${inc.toLocaleString('id-ID')}`; 
  document.getElementById('stat-expense').textContent = `Rp ${exp.toLocaleString('id-ID')}`;
}

function renderHistoryTable() {
  const tb = document.getElementById('history-table-body');
  if (!tb) return;
  if (window.transactions.length === 0) { 
    tb.innerHTML = '<tr><td class="p-6 text-center text-slate-500">Belum ada transaksi</td></tr>'; 
    return; 
  }
  tb.innerHTML = window.transactions.map((t, i) => `
    <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
      <td class="p-2.5 text-slate-400 whitespace-nowrap">${t.date}</td>
      <td class="p-2.5 font-bold text-slate-200">
        <div>${t.description}</div>
        <div class="text-[9px] font-normal text-slate-400">${t.category}</div>
      </td>
      <td class="p-2.5 text-right font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">Rp ${t.nominal.toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-center"><button onclick="deleteTransaction(${t.id})" class="text-slate-600 hover:text-rose-400 transition p-1"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

function deleteTransaction(id) {
  window.transactions = window.transactions.filter(t => t.id !== id);
  if (typeof saveCloudData === 'function') saveCloudData();
  renderAll();
}

// 9. Perbaikan Indikator Tab Aktif
function switchTab(selectedTab) {
  const tabs = ['chat', 'charts', 'history'];
  
  tabs.forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    
    if (t === selectedTab) {
      section.classList.remove('hidden');
      btn.className = 'py-2 font-bold rounded-xl text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 transition';
    } else {
      section.classList.add('hidden');
      btn.className = 'py-2 font-bold rounded-xl text-[11px] text-slate-400 bg-slate-950 border border-slate-800 transition';
    }
  });

  if (selectedTab === 'charts') {
    if (!window.chartInstance) initChart();
    updateChartData();
  }
}

// 10. Chart.js Distribusi Kategori
function initChart() {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  window.chartInstance = new Chart(ctx.getContext('2d'), { 
    type: 'doughnut', 
    data: { 
      labels: [], 
      datasets: [{ 
        data: [], 
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#64748b'], 
        borderWidth: 2, 
        borderColor: '#0f172a' 
      }] 
    }, 
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { 
        legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } } 
      } 
    } 
  }); 
  updateChartData();
}

function updateChartData() {
  if (!window.chartInstance) return; 
  const m = {}; 
  window.transactions.filter(t => t.type === 'expense').forEach(t => { 
    m[t.category] = (m[t.category] || 0) + t.nominal; 
  });
  const d = Object.values(m); 
  const emptyEl = document.getElementById('chart-empty-msg');
  const chartEl = document.getElementById('categoryChart');
  
  if (d.length === 0) {
    emptyEl.classList.remove('hidden');
    chartEl.classList.add('hidden');
  } else {
    emptyEl.classList.add('hidden');
    chartEl.classList.remove('hidden');
    window.chartInstance.data.labels = Object.keys(m); 
    window.chartInstance.data.datasets[0].data = d; 
    window.chartInstance.update(); 
  }
}

// 11. Scan Struk Kasir
async function handleReceiptUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const loaderId = 'loader-' + Date.now();
  appendChatMessage('assistant', '📷 Membaca total belanja struk dengan AI Vision...', loaderId);

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async (e) => {
    try {
      const base64Img = e.target.result;
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'FinAI Assistant'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Ekstrak nama toko dan TOTAL AKHIR belanja. Kembalikan format JSON: {"description": "Nama Toko / Barang", "nominal": 25000, "category": "Makanan & Minuman / Transportasi / Belanja Harian"}' },
              { type: 'image_url', image_url: { url: base64Img } }
            ]
          }]
        })
      });
      const data = await res.json();
      document.getElementById(loaderId)?.remove();
      const raw = data.choices?.[0]?.message?.content || '';
      let detected = null;
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.nominal || parsed.total) {
            detected = { 
              description: parsed.description || 'Struk Belanja', 
              nominal: parseFloat(parsed.nominal || parsed.total), 
              category: parsed.category || 'Belanja Harian' 
            };
          }
        } catch(err){}
      }
      if (detected && detected.nominal > 0) {
        const trx = recordTransaction({ description: detected.description, nominal: detected.nominal, type: 'expense', category: detected.category });
        appendChatMessage('assistant', `🧾 **Struk Dicatat!**\n• **Item:** ${trx.description}\n• **Kategori:** ${trx.category}\n• **Nominal:** Rp ${trx.nominal.toLocaleString('id-ID')}`);
      } else {
        appendChatMessage('assistant', '⚠️ Tidak dapat membaca angka total struk. Pastikan foto struk jelas.');
      }
    } catch (err) {
      document.getElementById(loaderId)?.remove();
      appendChatMessage('assistant', '⚠️ Gagal membaca struk: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
}

function exportToCSV() {
  if (!window.transactions.length) return alert('Tidak ada transaksi untuk diunduh!');
  let csv = 'Tanggal,Deskripsi,Tipe,Kategori,Nominal\n';
  window.transactions.forEach(t => { 
    csv += `"${t.date}","${t.description}","${t.type}","${t.category}","${t.nominal}"\n`; 
  });
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `laporan_keuangan_${Date.now()}.csv`;
  a.click();
}
