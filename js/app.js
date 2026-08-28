const OPENROUTER_API_KEY = atob("c2stb3ItdjEtOTJjMjU3ZTRkZDIxYzkyMjQxNjkwMmNiODVkYzE0ZDc0ZmQ0ZDRjNmI2MzcxNjA1ZmI2MWUwNTlhMDgyMzUzMg==");

window.chartInstance = null;
window.recognition = null;
window.currentPeriod = 'all';
window.goals = JSON.parse(localStorage.getItem('finai_goals_v1') || '[]');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
});

// 1. Kompresi Gambar Otomatis via Canvas (Mencegah Payload Error)
function compressImage(file, maxDimension = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// 2. Pembersih Format Angka Nominal dari AI
function cleanNominal(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let str = String(val).replace(/[^0-9.,]/g, '').trim();
  if (str.includes('.') && !str.includes(',')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',') && !str.includes('.')) {
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  return parseFloat(str) || 0;
}

// 3. Filter Transaksi Periode
function getFilteredTransactions() {
  const list = window.transactions || [];
  if (window.currentPeriod === 'all') return list;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (window.currentPeriod === 'today') {
    return list.filter(t => (t.timestamp || t.id) >= startOfToday);
  }

  if (window.currentPeriod === 'week') {
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
    return list.filter(t => (t.timestamp || t.id) >= startOfWeek);
  }

  if (window.currentPeriod === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return list.filter(t => (t.timestamp || t.id) >= startOfMonth);
  }

  return list;
}

function setPeriod(period) {
  window.currentPeriod = period;
  const periods = ['today', 'week', 'month', 'all'];
  periods.forEach(p => {
    const btn = document.getElementById(`period-btn-${p}`);
    if (btn) {
      if (p === period) {
        btn.className = 'flex-1 py-1 rounded-lg text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 font-bold transition text-center';
      } else {
        btn.className = 'flex-1 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition text-center';
      }
    }
  });
  renderAll();
}

function renderAll() {
  renderSummary();
  renderHistoryTable();
  renderGoals();
  if (window.chartInstance) updateChartData();
}

// 4. Normalisasi Kata Angka Bahasa Indonesia
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

// 5. Parser Transaksi Lokal
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
    else if (/tabung|invest|emas|reksadana|sinking/i.test(lower)) category = 'Tabungan & Impian';
  }
  
  let desc = rawText.replace(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/gi, '').replace(/^(beli|bayar|isi|buat|untuk|beliin)\s+/i, '').trim();
  if (!desc) desc = category;
  return { description: desc.charAt(0).toUpperCase() + desc.slice(1), nominal, type, category };
}

// 6. Rekam Transaksi
function recordTransaction(item) {
  const now = Date.now();
  const trx = { 
    id: item.id || now, 
    timestamp: item.timestamp || now,
    date: item.date || new Date(now).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }), 
    description: item.description, 
    type: item.type || 'expense', 
    category: item.category || 'Lainnya',
    nominal: parseFloat(item.nominal)
  };
  window.transactions.unshift(trx); 
  if (typeof saveCloudData === 'function') saveCloudData(); 
  renderAll(); 
  return trx;
}

// 7. Input Handler
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

// 8. Speech Recognition
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

// 9. Request AI dengan Multi-Model Fallback
async function callOpenRouter(messages) {
  const models = [
    'google/gemini-2.0-flash-001',
    'google/gemini-flash-1.5',
    'meta-llama/llama-3.2-11b-vision-instruct',
    'meta-llama/llama-3.3-70b-instruct'
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'FinAI Assistant'
        },
        body: JSON.stringify({ model: model, messages: messages })
      });

      const data = await res.json();
      if (data.choices && data.choices[0]) {
        return data.choices[0].message.content;
      }
      if (data.error) {
        lastError = data.error.message || JSON.stringify(data.error);
      }
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error(lastError || 'Semua model AI sedang sibuk.');
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
    appendChatMessage('assistant', `⚠️ Gagal terhubung ke AI: ${err.message}`);
  }
}

async function requestAiAudit() {
  const currentList = getFilteredTransactions();
  if (currentList.length === 0) return alert('Belum ada transaksi pada periode ini untuk dianalisis.');
  
  const box = document.getElementById('ai-insight-box');
  const btn = document.getElementById('btn-audit');
  btn.disabled = true;
  box.textContent = '🧠 Sedang menganalisis data periode terpilih...';
  
  const expList = currentList.filter(t => t.type === 'expense');
  const incList = currentList.filter(t => t.type === 'income');
  const totalExp = expList.reduce((s, t) => s + t.nominal, 0);
  const totalInc = incList.reduce((s, t) => s + t.nominal, 0);

  const catTotals = {};
  expList.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.nominal; });

  try {
    const prompt = `Periode Filter: ${window.currentPeriod.toUpperCase()}. Total Pemasukan: Rp ${totalInc}, Total Pengeluaran: Rp ${totalExp}, Breakdown: ${JSON.stringify(catTotals)}. Berikan evaluasi singkat: 1 kalimat kondisi keuangan periode ini, kategori pengeluaran terbesar, dan 2 saran penghematan.`;
    const reply = await callOpenRouter([
      { role: 'system', content: 'Anda konsultan keuangan pribadi profesional. Berikan jawaban padat dan terstruktur.' },
      { role: 'user', content: prompt }
    ]);
    box.textContent = reply;
  } catch (err) {
    box.textContent = `⚠️ Analisis gagal: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

// 10. Render Metrik Saldo
function renderSummary() {
  const currentList = getFilteredTransactions();
  let inc = 0, exp = 0;
  
  currentList.forEach(t => { 
    if (t.type === 'income') inc += t.nominal; 
    else exp += t.nominal; 
  });
  
  document.getElementById('stat-balance').textContent = `Rp ${(inc - exp).toLocaleString('id-ID')}`;
  document.getElementById('stat-income').textContent = `Rp ${inc.toLocaleString('id-ID')}`; 
  document.getElementById('stat-expense').textContent = `Rp ${exp.toLocaleString('id-ID')}`;
}

// 11. Pelacak Sinking Fund Presisi
function renderGoals() {
  const container = document.getElementById('goals-container');
  if (!container) return;

  if (!window.goals || window.goals.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">
        Belum ada target impian. Klik "+ Tambah Target" di atas untuk menghitung alokasi harian dan mingguan secara presisi!
      </div>
    `;
    return;
  }

  const now = new Date().getTime();

  container.innerHTML = window.goals.map(g => {
    const targetDate = new Date(g.deadline).getTime();
    const diffTime = targetDate - now;
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const diffWeeks = Math.max(1, Math.ceil(diffDays / 7));

    const remainingAmount = Math.max(0, g.target - g.current);
    const dailyAllocation = Math.round(remainingAmount / diffDays);
    const weeklyAllocation = Math.round(remainingAmount / diffWeeks);
    const progressPct = Math.min(100, Math.round((g.current / g.target) * 100));
    const isFinished = g.current >= g.target;

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>${g.name}</span>
              ${isFinished ? '<span class="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[8px] px-1.5 py-0.2 rounded font-mono">TERCAPAI</span>' : ''}
            </h4>
            <p class="text-[10px] text-slate-400">Target: ${new Date(g.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • <b class="text-cyan-400">${diffDays} hari lagi</b></p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold text-emerald-400">${progressPct}%</span>
            <button onclick="deleteGoal(${g.id})" class="text-slate-600 hover:text-rose-400 transition p-1"><i class="fas fa-trash"></i></button>
          </div>
        </div>

        <div class="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
        </div>

        <div class="flex justify-between items-center text-[10px] font-mono text-slate-400">
          <span>Terkumpul: <b class="text-slate-200">Rp ${g.current.toLocaleString('id-ID')}</b></span>
          <span>Target: <b class="text-slate-200">Rp ${g.target.toLocaleString('id-ID')}</b></span>
        </div>

        ${!isFinished ? `
          <div class="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 grid grid-cols-2 gap-2 text-center font-mono">
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Alokasi Harian</span>
              <span class="text-xs font-bold text-cyan-400">Rp ${dailyAllocation.toLocaleString('id-ID')}/hr</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Alokasi Mingguan</span>
              <span class="text-xs font-bold text-amber-400">Rp ${weeklyAllocation.toLocaleString('id-ID')}/mgg</span>
            </div>
          </div>
        ` : ''}

        <div class="pt-1">
          <button onclick="depositToGoal(${g.id})" class="w-full bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold py-2 rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition">
            <i class="fas fa-plus-circle"></i> Setor Tabungan dari Saldo
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openGoalModal() {
  document.getElementById('goal-name').value = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-current').value = '0';
  document.getElementById('goal-deadline').value = '';
  document.getElementById('goal-modal').classList.remove('hidden');
  document.getElementById('goal-modal').classList.add('flex');
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.add('hidden');
  document.getElementById('goal-modal').classList.remove('flex');
}

function handleSaveGoal(e) {
  e.preventDefault();
  const newGoal = {
    id: Date.now(),
    name: document.getElementById('goal-name').value.trim(),
    target: parseFloat(document.getElementById('goal-target').value) || 0,
    current: parseFloat(document.getElementById('goal-current').value) || 0,
    deadline: document.getElementById('goal-deadline').value
  };

  window.goals.push(newGoal);
  localStorage.setItem('finai_goals_v1', JSON.stringify(window.goals));
  closeGoalModal();
  renderGoals();
}

function deleteGoal(id) {
  if (confirm('Hapus target impian ini?')) {
    window.goals = window.goals.filter(g => g.id !== id);
    localStorage.setItem('finai_goals_v1', JSON.stringify(window.goals));
    renderGoals();
  }
}

function depositToGoal(id) {
  const goal = window.goals.find(g => g.id === id);
  if (!goal) return;

  const inputAmount = prompt(`Masukkan nominal setor tabungan untuk "${goal.name}" (Rp):`);
  const amount = parseFloat(inputAmount);

  if (amount && amount > 0) {
    goal.current += amount;
    localStorage.setItem('finai_goals_v1', JSON.stringify(window.goals));
    
    recordTransaction({
      description: `Tabungan: ${goal.name}`,
      nominal: amount,
      type: 'expense',
      category: 'Tabungan & Impian'
    });

    renderGoals();
  }
}

// 12. Render Tabel Riwayat dengan Pencarian & Filter Kategori
function renderHistoryTable() {
  const tb = document.getElementById('history-table-body');
  if (!tb) return;
  
  let currentList = getFilteredTransactions();

  const searchInput = document.getElementById('history-search-input');
  const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const catFilter = document.getElementById('history-category-filter');
  const selectedCat = catFilter ? catFilter.value : 'ALL';

  if (keyword) {
    currentList = currentList.filter(t => 
      t.description.toLowerCase().includes(keyword) || 
      t.category.toLowerCase().includes(keyword)
    );
  }

  if (selectedCat !== 'ALL') {
    currentList = currentList.filter(t => t.category === selectedCat);
  }

  if (currentList.length === 0) { 
    tb.innerHTML = '<tr><td class="p-6 text-center text-slate-500">Tidak ada transaksi yang cocok</td></tr>'; 
    return; 
  }

  tb.innerHTML = currentList.map(t => `
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

// 13. Navigasi 4 Tab
function switchTab(selectedTab) {
  const tabs = ['chat', 'charts', 'goals', 'history'];
  
  tabs.forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    
    if (t === selectedTab) {
      section.classList.remove('hidden');
      btn.className = 'py-2 font-bold rounded-xl text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 transition flex items-center justify-center gap-1';
    } else {
      section.classList.add('hidden');
      btn.className = 'py-2 font-bold rounded-xl text-[11px] text-slate-400 bg-slate-950 border border-slate-800 transition flex items-center justify-center gap-1';
    }
  });

  if (selectedTab === 'charts') {
    if (!window.chartInstance) initChart();
    updateChartData();
  } else if (selectedTab === 'goals') {
    renderGoals();
  }
}

// 14. Diagram Lingkaran
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
  const currentList = getFilteredTransactions();
  const m = {}; 
  
  currentList.filter(t => t.type === 'expense').forEach(t => { 
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

// 15. DUAL-ENGINE OCR (KOMPRESI OTOMATIS + SANITASI ANGKA)
async function handleReceiptUpload(event, mode = 'physical') {
  const file = event.target.files[0];
  if (!file) return;

  const loaderId = 'loader-' + Date.now();
  const label = mode === 'digital' ? 'screenshot resi transfer / QRIS / E-Wallet...' : 'total belanja struk kasir...';
  appendChatMessage('assistant', `📷 Membaca ${label}`, loaderId);

  try {
    // Kompres gambar otomatis agar ringan (< 150KB)
    const base64Img = await compressImage(file, 1024, 0.8);
    
    const promptText = mode === 'digital' 
      ? `Anda adalah OCR pembaca bukti transaksi / screenshot E-Wallet (DANA, GoPay, OVO, ShopeePay, QRIS, BCA, BRImo, Mandiri).
1. Temukan nama penerima/merchant/toko tujuan.
2. Temukan TOTAL NOMINAL uang transaksi (harus angka bulat).
3. Tentukan type: 'expense' (keluar/transfer) atau 'income' (uang masuk/terima).
4. Tentukan category: Makanan & Minuman / Transportasi / Tagihan & Utilitas / Belanja Harian / Hiburan & Santai / Keluarga & Transfer / Kesehatan / Lainnya.

KEMBALIKAN HANYA JSON VALID:
{"description": "Nama Merchant / Penerima", "nominal": 50000, "type": "expense", "category": "Keluarga & Transfer"}`
      : `Ekstrak nama toko dan TOTAL AKHIR belanja dari foto struk ini. Kembalikan JSON: {"description": "Nama Toko", "nominal": 25000, "type": "expense", "category": "Belanja Harian"}`;

    const rawContent = await callOpenRouter([{
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: base64Img } }
      ]
    }]);

    document.getElementById(loaderId)?.remove();
    
    let detected = null;
    const jsonMatch = rawContent.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const cleanedNominal = cleanNominal(parsed.nominal || parsed.total || parsed.amount);
        if (cleanedNominal > 0) {
          detected = { 
            description: parsed.description || parsed.merchant || (mode === 'digital' ? 'Transfer / QRIS' : 'Struk Belanja'), 
            nominal: cleanedNominal, 
            type: parsed.type || 'expense',
            category: parsed.category || (mode === 'digital' ? 'Keluarga & Transfer' : 'Belanja Harian')
          };
        }
      } catch(err){}
    }

    if (detected && detected.nominal > 0) {
      const trx = recordTransaction(detected);
      const typeLabel = trx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const badge = mode === 'digital' ? '📱 Resi Digital' : '🧾 Struk Kasir';
      appendChatMessage('assistant', `✅ **${badge} Terdeteksi!**\n• **Item:** ${trx.description}\n• **Kategori:** ${trx.category}\n• **Nominal:** Rp ${trx.nominal.toLocaleString('id-ID')}`);
    } else {
      appendChatMessage('assistant', '⚠️ Gagal mendeteksi nominal transaksi. Pastikan tulisan total harga / transfer pada gambar terlihat jelas.');
    }
  } catch (err) {
    document.getElementById(loaderId)?.remove();
    appendChatMessage('assistant', `⚠️ Gagal membaca gambar: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

// 16. Ekspor CSV
function exportToCSV() {
  const currentList = getFilteredTransactions();
  if (!currentList.length) return alert('Tidak ada transaksi pada periode ini untuk diunduh!');
  
  let csv = 'Tanggal,Deskripsi,Tipe,Kategori,Nominal\n';
  currentList.forEach(t => { 
    csv += `"${t.date}","${t.description}","${t.type}","${t.category}","${t.nominal}"\n`; 
  });
  
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `laporan_keuangan_${window.currentPeriod}_${Date.now()}.csv`;
  a.click();
}

// 17. Ekspor Rekap Visual PDF
function exportVisualPDF() {
  const currentList = getFilteredTransactions();
  if (!currentList.length) return alert('Tidak ada data transaksi untuk diekspor ke PDF!');

  let inc = 0, exp = 0;
  const catTotals = {};
  currentList.forEach(t => {
    if (t.type === 'income') inc += t.nominal;
    else {
      exp += t.nominal;
      catTotals[t.category] = (catTotals[t.category] || 0) + t.nominal;
    }
  });
  const balance = inc - exp;

  const periodLabels = {
    today: 'Hari Ini',
    week: 'Minggu Ini',
    month: 'Bulan Ini',
    all: 'Semua Waktu'
  };

  const userName = document.getElementById('user-display-name')?.textContent || 'Pengguna';
  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  let topExpensesHtml = '';
  const sortedExp = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  sortedExp.forEach(([cat, nom]) => {
    const pct = exp > 0 ? Math.round((nom / exp) * 100) : 0;
    topExpensesHtml += `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px;">
        <span><b>${cat}</b> (${pct}%)</span>
        <span>Rp ${nom.toLocaleString('id-ID')}</span>
      </div>
    `;
  });

  const tempContainer = document.createElement('div');
  tempContainer.style.padding = '24px';
  tempContainer.style.background = '#ffffff';
  tempContainer.style.color = '#0f172a';
  tempContainer.style.fontFamily = 'Arial, sans-serif';

  tempContainer.innerHTML = `
    <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h1 style="font-size: 20px; margin: 0; color: #047857; font-weight: bold;">FinAI - Rekap Keuangan</h1>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Laporan Transaksi Periode: <b>${periodLabels[window.currentPeriod]}</b></p>
      </div>
      <div style="text-align: right; font-size: 10px; color: #64748b;">
        <div>Nama: <b>${userName}</b></div>
        <div>Dicetak: ${currentDate}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 8px;">
        <span style="font-size: 9px; color: #166534; text-transform: uppercase;">Saldo Bersih</span>
        <div style="font-size: 13px; font-weight: bold; color: #15803d; margin-top: 3px;">Rp ${balance.toLocaleString('id-ID')}</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
        <span style="font-size: 9px; color: #475569; text-transform: uppercase;">Total Pemasukan</span>
        <div style="font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 3px;">Rp ${inc.toLocaleString('id-ID')}</div>
      </div>
      <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 10px; border-radius: 8px;">
        <span style="font-size: 9px; color: #9f1239; text-transform: uppercase;">Total Pengeluaran</span>
        <div style="font-size: 13px; font-weight: bold; color: #be123c; margin-top: 3px;">Rp ${exp.toLocaleString('id-ID')}</div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 12px; margin: 0 0 8px 0; color: #334155; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Rincian Pengeluaran per Kategori</h3>
      ${topExpensesHtml || '<p style="font-size:11px; color:#94a3b8;">Tidak ada pengeluaran.</p>'}
    </div>

    <div>
      <h3 style="font-size: 12px; margin: 0 0 8px 0; color: #334155; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Daftar Transaksi (${currentList.length} Entri)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 6px; border: 1px solid #cbd5e1;">Tanggal</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1;">Deskripsi</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1;">Kategori</th>
            <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${currentList.slice(0, 15).map(t => `
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0;">${t.date}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0;">${t.description}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0;">${t.category}</td>
              <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: right; color: ${t.type==='income'?'#16a34a':'#dc2626'}; font-weight: bold;">Rp ${t.nominal.toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const opt = {
    margin: 8,
    filename: `Rekap_FinAI_${window.currentPeriod}_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(tempContainer).save();
}
