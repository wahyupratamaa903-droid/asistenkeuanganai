(function() {
  async function parseWithLLM(rawText) {
    const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const todayISO = new Date().toISOString().split('T')[0];

    const sysPrompt = `Anda adalah parser transaksi keuangan. Hari ini: ${todayStr} (ISO: ${todayISO}).
Tugas Anda: Analisis kalimat user dan tentukan apakah itu:
1. "RECORD": Mencatat satu atau banyak transaksi pemasukan/pengeluaran.
2. "SET_BALANCE": Mengatur total saldo kas saat ini (contoh: "uang cash sekarang 1 juta", "saldo awal 2 juta").
3. "QUERY": Pertanyaan tentang data/keuangan atau obrolan biasa (contoh: "berapa pengeluaran bulan ini?", "kalau nabung 500rb kapan tercapai?").

Aturan Tanggal Relatif: Hitung tanggal sebenarnya berdasarkan hari ini (${todayISO}) jika user menyebut "kemarin", "2 hari lalu", "Jumat lalu", dll. Format date: "DD MMM YYYY" dalam bahasa Indonesia (contoh: "11 Nov 2026").
Kategori wajib salah satu: "Makanan & Minuman", "Transportasi", "Tagihan & Utilitas", "Belanja Harian", "Hiburan & Santai", "Keluarga & Transfer", "Kesehatan", "Tabungan & Impian", "Gaji & Pendapatan", "Lainnya".

Kembalikan HANYA JSON valid dengan format persis ini:
{
  "intent": "RECORD" | "SET_BALANCE" | "QUERY",
  "targetBalance": 0,
  "transactions": [
    { "description": "Kopi", "nominal": 25000, "type": "expense", "category": "Makanan & Minuman", "date": "12 Nov 2026", "timestamp": 1794460000000 }
  ]
}`;

    const reply = await window.finaiCallLLM([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: rawText }
    ], true);

    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON tidak valid');
    return JSON.parse(match[0]);
  }

  // Override handleUserInput secara aman dengan fallback ke fungsi lama jika offline
  window.addEventListener('DOMContentLoaded', () => {
    const originalHandle = window.handleUserInput;
    window.handleUserInput = async function(e) {
      if (e) e.preventDefault();
      const inputEl = document.getElementById('chat-input');
      const text = inputEl ? inputEl.value.trim() : '';
      if (!text) return;

      // Jika sedang offline, gunakan regex bawaan sebagai cadangan
      if (!navigator.onLine) {
        return originalHandle(e);
      }

      appendChatMessage('user', text);
      inputEl.value = '';
      const loaderId = 'm1-load-' + Date.now();
      appendChatMessage('assistant', '<span class="animate-pulse">⚡ Memproses dengan AI...</span>', loaderId);

      try {
        const result = await parseWithLLM(text);
        document.getElementById(loaderId)?.remove();

        if (result.intent === 'SET_BALANCE' && result.targetBalance >= 0) {
          if (typeof setExactCashBalance === 'function') {
            setExactCashBalance(result.targetBalance);
            appendChatMessage('assistant', `✅ **Saldo Cash Diatur!**\n• **Saldo Saat Ini:** Rp ${Number(result.targetBalance).toLocaleString('id-ID')}`);
            return;
          }
        }

        if (result.intent === 'RECORD' && Array.isArray(result.transactions) && result.transactions.length > 0) {
          const logs = result.transactions.map(item => {
            const trx = recordTransaction({
              description: item.description || 'Transaksi',
              nominal: Number(item.nominal) || 0,
              type: item.type === 'income' ? 'income' : 'expense',
              category: item.category || 'Lainnya',
              date: item.date || undefined,
              timestamp: item.timestamp || Date.now()
            });
            const sign = trx.type === 'income' ? 'Pemasukan (+)' : 'Pengeluaran (-)';
            return `✅ **${sign}** (${trx.date})\n• **Item:** ${trx.description}\n• **Kategori:** ${trx.category}\n• **Nominal:** Rp ${trx.nominal.toLocaleString('id-ID')}`;
          });
          const sisa = typeof getCurrentTotalBalance === 'function' ? getCurrentTotalBalance() : 0;
          appendChatMessage('assistant', logs.join('\n\n') + `\n\n💰 **Sisa Saldo Cash:** Rp ${sisa.toLocaleString('id-ID')}`);
          return;
        }

        // Jika intent adalah QUERY, teruskan ke Modul 4 (Data Query) atau AI Chat biasa
        if (typeof window.finaiAnswerDataQuery === 'function') {
          await window.finaiAnswerDataQuery(text);
        } else {
          await askAiConversation(text);
        }
      } catch (err) {
        document.getElementById(loaderId)?.remove();
        // Cadangan Regex jika API gagal
        const fallbackList = typeof parseMultipleTransactions === 'function' ? parseMultipleTransactions(text) : [];
        if (fallbackList.length > 0) {
          fallbackList.forEach(item => recordTransaction(item));
          appendChatMessage('assistant', `✅ Dicatat via Mode Cadangan Offline (${fallbackList.length} item).`);
        } else {
          await askAiConversation(text);
        }
      }
    };
  });
})();
