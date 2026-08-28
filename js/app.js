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

// NLP Engine & Kategori Dikembalikan Sepenuhnya
function normalizeIndonesianWords(text) {
  let s = text.toLowerCase().replace(/setengah juta/g, '500000').replace(/sejuta/g, '1000000').replace(/seratus ribu/g, '100000').replace(/sepuluh ribu/g, '10000').replace(/ribu/g, '000');
  const unitMap = { 'satu':1, 'dua':2, 'tiga':3, 'empat':4, 'lima':5, 'enam':6, 'tujuh':7, 'delapan':8, 'sembilan':9, 'sepuluh':10 };
  s = s.replace(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*juta/g, (m, p1) => (unitMap[p1] * 1000000).toString());
  return s;
}

function parseNaturalLanguage(rawText) {
  const lower = normalizeIndonesianWords(rawText).toLowerCase().trim();
  let nominal = 0;
  const numMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/i);
  
  if (numMatch) {
    let rawNum = parseFloat(numMatch[1].replace(',', '.'));
    const unit = numMatch[2] ? numMatch[2].toLowerCase() : '';
    if (unit === 'juta' || unit === 'jt') nominal = rawNum * 1000000;
    else if (unit === 'ribu' || unit === 'rb' || unit === 'k') nominal = rawNum * 1000;
    else { if (numMatch[1].includes('.') && rawNum < 1000) nominal = parseInt(numMatch[1].replace(/\./g, '')); else nominal = rawNum; }
  }
  
  if (!nominal || nominal <= 0) return null;

  const incomeKeywords = ['gaji', 'income', 'masuk', 'cair', 'dapat', 'bonus', 'profit'];
  let type = 'expense', category = 'Lainnya';
  
  if (incomeKeywords.some(kw => lower.includes(kw)) && !lower.includes('setor')) {
    type = 'income'; category = 'Gaji & Pendapatan';
  } else {
    if (/setor|ortu|ibu|ayah/i.test(lower)) category = 'Keluarga & Transfer';
    else if (/kopi|makan|minum|resto|warteg|jajan|sarapan|bakso|ayam|mie/i.test(lower)) category = 'Makanan & Minuman';
    else if (/bensin|parkir|tol|gojek|grab|motor|mobil|servis/i.test(lower)) category = 'Transportasi';
    else if (/listrik|wifi|pulsa|kuota|token|pdam|kos/i.test(lower)) category = 'Tagihan & Utilitas';
    else if (/belanja|baju|sepatu|shopee|tokopedia|indomaret|alfamart/i.test(lower)) category = 'Belanja Harian';
    else if (/nonton|bioskop|game|topup|liburan/i.test(lower)) category = 'Hiburan & Santai';
    else if (/obat|dokter|rs|sakit/i.test(lower)) category = 'Kesehatan';
  }
  
  let desc = rawText.replace(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/gi, '').replace(/^(beli|bayar|isi)\s+/i, '').trim() || category;
  return { description: desc.charAt(0).toUpperCase() + desc.slice(1), nominal, type, category };
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    window.recognition = new SpeechRecognition();
    window.recognition.lang = 'id-ID';
    window.recognition.onresult = (e) => { document.getElementById('chat-input').value = e.results[0][0].transcript; toggleVoiceRecording(false); handleUserInput(); };
  }
}

function toggleVoiceRecording(forceState) {
  const btn = document.getElementById('btn-voice');
  if(forceState===false) { btn.classList.remove('recording-active'); window.recognition.stop(); return;}
  btn.classList.add('recording-active'); window.recognition.start();
}

function appendChatMessage(role, text) {
  const box = document.getElementById('chat-box'), isUser = role === 'user', div = document.createElement('div');
  div.className = `flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`;
  div.innerHTML = `<div class="${isUser?'bg-emerald-600 text-white rounded-tr-none':'bg-slate-800/90 text-slate-200 rounded-tl-none'} p-3 rounded-2xl text-xs whitespace-pre-wrap">${text}</div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

function recordTransaction(item) {
  const trx = { 
    id: Date.now(), 
    date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }), 
    description: item.description, type: item.type, category: item.category,
    nominal: parseFloat(item.nominal)
  };
  window.transactions.unshift(trx); 
  if (typeof saveCloudData === 'function') saveCloudData(); 
  renderAll(); 
  return trx;
}

function handleUserInput(e) {
  if (e) e.preventDefault(); const text = document.getElementById('chat-input').value.trim(); if (!text) return;
  appendChatMessage('user', text); document.getElementById('chat-input').value = '';
  
  const parsed = parseNaturalLanguage(text);
  if (parsed) {
    const trx = recordTransaction(parsed);
    const typeLabel = trx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    // Format Lengkap Dikembalikan
    appendChatMessage('assistant', `✅ **${typeLabel} Dicatat!**\n• **Item:** ${trx.description}\n• **Kategori:** ${trx.category}\n• **Nominal:** Rp ${trx.nominal.toLocaleString('id-ID')}`);
  } else {
    askAiConversation(text);
  }
}

async function askAiConversation(promptText) {
  const apiKey = localStorage.getItem('finai_openrouter_key');
  if (!apiKey) return appendChatMessage('assistant', '🔑 Masukkan API Key OpenRouter pada tombol kunci di atas untuk obrolan cerdas.');
  const loaderId = 'loading-' + Date.now(); appendChatMessage('assistant', '<span class="animate-pulse">Sedang menganalisis...</span>', loaderId);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({ model: 'google/gemini-2.0-flash-001', messages: [{ role: 'system', content: `Anda asisten finansial. Jika mendeteksi transaksi, tulis ini di bagian akhir: {"record": {"description": "...", "nominal": 10000, "type": "expense|income", "category": "Lainnya"}}` }, { role: 'user', content: promptText }] })
    });
    const data = await res.json(); document.getElementById(loaderId)?.remove();
    let rawReply = data.choices?.[0]?.message?.content || 'Gagal tersambung AI.', cleanReply = rawReply;
    const jsonMatch = rawReply.match(/\{"record":\s*\{[\s\S]*?\}\}/);
    if (jsonMatch) { try { const p = JSON.parse(jsonMatch[0]); if (p.record?.nominal) recordTransaction(p.record); cleanReply = rawReply.replace(jsonMatch[0], '').replace(/```json/g, '').replace(/```/g, '').trim(); } catch(e){} }
    appendChatMessage('assistant', cleanReply);
  } catch (err) { document.getElementById(loaderId)?.remove(); appendChatMessage('assistant', `⚠️ Error: ${err.message}`); }
}

async function requestAiAudit() {
  const apiKey = localStorage.getItem('finai_openrouter_key'); 
  if (!apiKey) return alert('Silakan atur API Key terlebih dahulu.');
  const box = document.getElementById('ai-insight-box'); box.textContent = '🧠 Sedang menganalisis rasio dan pengeluaran...';
  
  const m = {}; window.transactions.filter(t => t.type === 'expense').forEach(t => { m[t.category] = (m[t.category] || 0) + t.nominal; });
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` }, body: JSON.stringify({ model: 'google/gemini-2.0-flash-001', messages: [{ role: 'system', content: 'Evaluasi ringkas finansial pengguna.' }, { role: 'user', content: `Breakdown: ${JSON.stringify(m)}. Berikan 2 tips hemat singkat.` }] }) });
    box.textContent = (await res.json()).choices?.[0]?.message?.content || 'Analisis gagal.';
  } catch (err) { box.textContent = '⚠️ Error: ' + err.message; }
}

// Logika Render UI & Chart yang Terhapus Dikembalikan
function renderSummary() {
  let inc = 0, exp = 0, n = 0, w = 0;
  window.transactions.forEach(t => { 
    if (t.type === 'income') inc += t.nominal; 
    else { 
      exp += t.nominal; 
      if (['Makanan & Minuman','Transportasi','Tagihan & Utilitas','Kesehatan','Keluarga & Transfer'].includes(t.category)) n += t.nominal; 
      else w += t.nominal; 
    } 
  });
  
  document.getElementById('stat-balance').textContent = `Rp ${(inc - exp).toLocaleString('id-ID')}`;
  document.getElementById('stat-income').textContent = `Rp ${inc.toLocaleString('id-ID')}`; 
  document.getElementById('stat-expense').textContent = `Rp ${exp.toLocaleString('id-ID')}`;
  
  const tot = exp || 1, nP = Math.min(100, Math.round((n/tot)*100)), wP = Math.min(100, Math.round((w/tot)*100));
  
  // Amankan elemen jika belum dirender saat pindah tab
  if(document.getElementById('ratio-needs-pct')) {
    document.getElementById('ratio-needs-pct').textContent = nP+'%'; document.getElementById('ratio-needs-bar').style.width = nP+'%';
    document.getElementById('ratio-wants-pct').textContent = wP+'%'; document.getElementById('ratio-wants-bar').style.width = wP+'%';
  }
}

function renderHistoryTable() {
  const tb = document.getElementById('history-table-body');
  if(!tb) return;
  if(window.transactions.length === 0) { tb.innerHTML = '<tr><td class="p-4 text-center text-slate-500">Belum ada transaksi</td></tr>'; return; }
  tb.innerHTML = window.transactions.map((t, i) => `<tr class="border-b border-slate-800/60"><td class="p-2.5 text-slate-400">${t.date}</td><td class="p-2.5 font-bold">${t.description}</td><td class="p-2.5 text-right font-bold ${t.type==='income'?'text-emerald-400':'text-rose-400'}">Rp ${t.nominal.toLocaleString('id-ID')}</td><td class="p-2.5 text-center"><button onclick="deleteTransaction(${t.id})" class="text-slate-600 hover:text-rose-400 transition"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deleteTransaction(id) { window.transactions = window.transactions.filter(t => t.id !== id); saveCloudData(); renderAll(); }

function initChart() {
  const ctx = document.getElementById('categoryChart');
  if(!ctx) return;
  window.chartInstance = new Chart(ctx.getContext('2d'), { 
    type: 'doughnut', 
    data: { labels: [], datasets: [{ data: [], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#64748b'], borderWidth: 2, borderColor: '#0f172a' }] }, 
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } } } } 
  }); 
  updateChartData();
}

function updateChartData() {
  if (!window.chartInstance) return; 
  const m = {}; window.transactions.filter(t => t.type === 'expense').forEach(t => { m[t.category] = (m[t.category] || 0) + t.nominal; });
  const d = Object.values(m); 
  document.getElementById('chart-empty-msg').classList.toggle('hidden', d.length > 0); 
  document.getElementById('categoryChart').classList.toggle('hidden', d.length === 0);
  if (d.length > 0) { window.chartInstance.data.labels = Object.keys(m); window.chartInstance.data.datasets[0].data = d; window.chartInstance.update(); }
}

function switchTab(t) { 
  ['chat','charts','history'].forEach(x => { 
    document.getElementById(`tab-${x}`).classList.toggle('hidden', x!==t); 
    document.getElementById(`tab-btn-${x}`).classList.toggle('text-emerald-400', x===t); 
    document.getElementById(`tab-btn-${x}`).classList.toggle('bg-emerald-950/60', x===t); 
    document.getElementById(`tab-btn-${x}`).classList.toggle('border-emerald-800/80', x===t); 
  }); 
  if(t === 'charts') {
    if(!window.chartInstance) initChart();
    updateChartData();
  }
}

function openApiKeyModal() { document.getElementById('api-modal').classList.remove('hidden'); document.getElementById('api-modal').classList.add('flex'); }
function closeApiKeyModal() { document.getElementById('api-modal').classList.add('hidden'); document.getElementById('api-modal').classList.remove('flex'); }
function saveApiKey() { localStorage.setItem('finai_openrouter_key', document.getElementById('input-api-key').value); closeApiKeyModal(); }

// Receipt Upload OCR
async function handleReceiptUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  const apiKey = localStorage.getItem('finai_openrouter_key'); if (!apiKey) { alert('API Key diperlukan.'); openApiKeyModal(); return; }
  const loaderId = 'loader-' + Date.now(); appendChatMessage('assistant', '📷 Membaca total belanja struk...', loaderId);
  try {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = async (e) => {
      const base64Img = e.target.result;
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` }, body: JSON.stringify({ model: 'google/gemini-2.0-flash-001', messages: [{ role: 'user', content: [{ type: 'text', text: 'Temukan nama toko dan TOTAL AKHIR. JSON: {"description": "Toko", "nominal": 25000, "category": "Belanja Harian"}' }, { type: 'image_url', image_url: { url: base64Img } }] }] }) });
      const data = await res.json(); document.getElementById(loaderId)?.remove();
      const raw = data.choices?.[0]?.message?.content || ''; let detected = null; const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) { try { const p = JSON.parse(jsonMatch[0]); if (p.nominal || p.total) detected = { description: p.description || 'Struk', nominal: parseFloat(p.nominal || p.total), category: p.category || 'Belanja Harian' }; } catch(err){} }
      if (detected) { const trx = recordTransaction({ description: detected.description, nominal: detected.nominal, type: 'expense', category: detected.category }); appendChatMessage('assistant', `🧾 **Struk Dicatat!**\n• **Toko:** ${trx.description}\n• **Kategori:** ${trx.category}\n• **Total:** Rp ${trx.nominal.toLocaleString('id-ID')}`); } 
      else appendChatMessage('assistant', '⚠️ Gagal membaca nominal struk.');
    };
  } catch (err) { document.getElementById(loaderId)?.remove(); appendChatMessage('assistant', '⚠️ Error: ' + err.message); } finally { event.target.value = ''; }
}

function exportToCSV() {
  if (!window.transactions.length) return alert('Tidak ada data!');
  let csv = 'Tanggal,Deskripsi,Tipe,Kategori,Nominal\n';
  window.transactions.forEach(t => { csv += `"${t.date}","${t.description}","${t.type}","${t.category}","${t.nominal}"\n`; });
  const a = document.createElement('a'); a.href = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `laporan_${Date.now()}.csv`; a.click();
}
