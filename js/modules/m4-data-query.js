(function() {
  // Fungsi agregasi lokal (Function Calling Client-Side)
  function buildCompactFinancialSummary() {
    const list = window.transactions || [];
    const now = new Date();
    const curMonth = now.getMonth(), curYear = now.getFullYear();
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;

    const stats = {
      currentMonth: { income: 0, expense: 0, byCategory: {} },
      lastMonth: { income: 0, expense: 0, byCategory: {} },
      allTimeBalance: 0
    };

    list.forEach(t => {
      const d = new Date(t.timestamp || t.id || Date.now());
      const m = d.getMonth(), y = d.getFullYear();
      const nom = Number(t.nominal) || 0;
      if (t.type === 'income') stats.allTimeBalance += nom;
      else stats.allTimeBalance -= nom;

      if (m === curMonth && y === curYear) {
        if (t.type === 'income') stats.currentMonth.income += nom;
        else {
          stats.currentMonth.expense += nom;
          stats.currentMonth.byCategory[t.category] = (stats.currentMonth.byCategory[t.category] || 0) + nom;
        }
      } else if (m === prevMonth && y === prevYear) {
        if (t.type === 'income') stats.lastMonth.income += nom;
        else {
          stats.lastMonth.expense += nom;
          stats.lastMonth.byCategory[t.category] = (stats.lastMonth.byCategory[t.category] || 0) + nom;
        }
      }
    });
    return stats;
  }

  window.finaiAnswerDataQuery = async function(question) {
    const loaderId = 'm4-q-' + Date.now();
    appendChatMessage('assistant', '<span class="animate-pulse">📊 Menghitung perbandingan data...</span>', loaderId);
    try {
      const summary = buildCompactFinancialSummary();
      const sys = `Anda asisten analitik keuangan. Jawab pertanyaan pengguna secara akurat berdasarkan ringkasan agregat berikut (tanpa mengarang angka):
${JSON.stringify(summary)}`;
      const ans = await window.finaiCallLLM([
        { role: 'system', content: sys },
        { role: 'user', content: question }
      ]);
      document.getElementById(loaderId)?.remove();
      appendChatMessage('assistant', ans);
    } catch (e) {
      document.getElementById(loaderId)?.remove();
      appendChatMessage('assistant', '⚠️ Gagal menganalisis pertanyaan: ' + e.message);
    }
  };
})();
