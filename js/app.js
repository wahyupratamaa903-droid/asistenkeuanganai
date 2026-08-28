window.chartInstance = null;
window.recognition = null;

document.addEventListener('DOMContentLoaded', () => initSpeechRecognition());

function renderAll() {
  renderSummary();
  renderHistoryTable();
  if (window.chartInstance) updateChartData();
}

// 1. Bugfix NLP: Konversi kata ke angka
function normalizeIndonesianWords(text) {
  let s = text.toLowerCase().replace(/setengah juta/g, '500000').replace(/sejuta/g, '1000000').replace(/seratus ribu/g, '100000').replace(/sepuluh ribu/g, '10000').replace(/ribu/g, '000');
  const unitMap = { 'satu':1, 'dua':2, 'tiga':3, 'empat':4, 'lima':5, 'enam':6, 'tujuh':7, 'delapan':8, 'sembilan':9, 'sepuluh':10 };
  s = s.replace(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s*juta/g, (m, p1) => (unitMap[p1] * 1000000).toString());
  return s;
}

// 2. Speech Recog
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

// 3. UI Appends
function appendChatMessage(role, text) {
  const box = document.getElementById('chat-box'), isUser = role === 'user', div = document.createElement('div');
  div.className = `flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`;
  div.innerHTML = `<div class="${isUser?'bg-emerald-600 text-white rounded-tr-none':'bg-slate-800/90 text-slate-200 rounded-tl-none'} p-3 rounded-2xl text-xs whitespace-pre-wrap">${text}</div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

// 4. Proses Transaksi Utama (Bugfix parseFloat)
function recordTransaction(item) {
  const trx = { 
    id: Date.now(), 
    date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }), 
    description: item.description, type: item.type, category: item.category,
    nominal: parseFloat(item.nominal) // FIX BUG: Memastikan selalu angka, bukan string
  };
  window.transactions.unshift(trx); 
  if (typeof saveCloudData === 'function') saveCloudData(); 
  renderAll(); 
  return trx;
}

function handleUserInput(e) {
  if (e) e.preventDefault(); const text = document.getElementById('chat-input').value.trim(); if (!text) return;
  appendChatMessage('user', text); document.getElementById('chat-input').value = '';
  
  const lower = normalizeIndonesianWords(text).toLowerCase();
  const numMatch = lower.match(/(\d+)/);
  if(numMatch) {
    let type = lower.includes('gaji') || lower.includes('masuk') ? 'income' : 'expense';
    let cat = type === 'income' ? 'Pendapatan' : (lower.includes('setor') ? 'Keluarga' : 'Harian');
    let trx = recordTransaction({description: text.replace(/\d+/g,'').trim() || cat, nominal: numMatch[0], type: type, category: cat});
    appendChatMessage('assistant', `✅ **Dicatat!**\nRp ${trx.nominal.toLocaleString('id-ID')}`);
  } else askAiConversation(text);
}

// 5. Fitur Saldo Utama & Rekap
function renderSummary() {
  let inc = 0, exp = 0;
  window.transactions.forEach(t => { if (t.type === 'income') inc += t.nominal; else exp += t.nominal; });
  const balance = inc - exp;
  document.getElementById('stat-balance').textContent = `Rp ${balance.toLocaleString('id-ID')}`;
  document.getElementById('stat-income').textContent = `Rp ${inc.toLocaleString('id-ID')}`; 
  document.getElementById('stat-expense').textContent = `Rp ${exp.toLocaleString('id-ID')}`;
}

function renderHistoryTable() {
  const tb = document.getElementById('history-table-body');
  tb.innerHTML = window.transactions.map((t, i) => `<tr class="border-b border-slate-800"><td class="p-2">${t.date}</td><td class="p-2 font-bold">${t.description}</td><td class="p-2 text-right ${t.type==='income'?'text-emerald-400':'text-rose-400'}">Rp ${t.nominal.toLocaleString('id-ID')}</td><td class="p-2"><button onclick="deleteTransaction(${t.id})" class="text-rose-400"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deleteTransaction(id) { window.transactions = window.transactions.filter(t => t.id !== id); saveCloudData(); renderAll(); }
function switchTab(t) { ['chat','charts','history'].forEach(x => { document.getElementById(`tab-${x}`).classList.toggle('hidden', x!==t); document.getElementById(`tab-btn-${x}`).classList.toggle('text-emerald-400', x===t); }); }
function openApiKeyModal() { document.getElementById('api-modal').classList.remove('hidden'); document.getElementById('api-modal').classList.add('flex'); }
function closeApiKeyModal() { document.getElementById('api-modal').classList.add('hidden'); document.getElementById('api-modal').classList.remove('flex'); }
function saveApiKey() { localStorage.setItem('finai_openrouter_key', document.getElementById('input-api-key').value); closeApiKeyModal(); }
function openBudgetModal() { document.getElementById('budget-modal').classList.remove('hidden'); document.getElementById('budget-modal').classList.add('flex'); }
function closeBudgetModal() { document.getElementById('budget-modal').classList.add('hidden'); document.getElementById('budget-modal').classList.remove('flex'); }
function saveBudget() { window.monthlyBudget = parseFloat(document.getElementById('input-monthly-budget').value); saveCloudData(); renderSummary(); closeBudgetModal(); }
function initChart() {} function updateChartData() {}
