(function() {
  window.addEventListener('DOMContentLoaded', () => {
    window.handleReceiptUpload = async function(event, mode = 'physical') {
      const file = event.target.files[0];
      if (!file) return;

      const loaderId = 'm2-vision-' + Date.now();
      appendChatMessage('assistant', '📷 Memindai rincian item, pajak & kategori struk...', loaderId);

      try {
        const base64Img = await compressImage(file, 1024, 0.85);
        const prompt = `Analisis gambar struk/bukti pembayaran ini secara mendetail.
Ekstrak nama toko/merchant, pajak/biaya layanan (jika ada), dan pecah daftar item per baris beserta kategorinya masing-masing ("Makanan & Minuman", "Belanja Harian", "Kesehatan", "Transportasi", "Tagihan & Utilitas", "Keluarga & Transfer", "Lainnya").
Jika ada pajak/service, tambahkan sebagai item tersendiri atau gabungkan proporsional.
Kembalikan HANYA format JSON persis ini:
{
  "merchant": "Nama Toko",
  "tax": 0,
  "total": 50000,
  "items": [
    { "description": "Nama Barang 1", "nominal": 25000, "type": "expense", "category": "Makanan & Minuman" },
    { "description": "Sabun Cuci", "nominal": 25000, "type": "expense", "category": "Belanja Harian" }
  ]
}`;

        const rawContent = await callMultiProviderAI([{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: base64Img } }
          ]
        }], true);

        document.getElementById(loaderId)?.remove();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Format struk tidak terbaca.');

        const parsed = JSON.parse(jsonMatch[0]);
        const items = Array.isArray(parsed.items) && parsed.items.length > 0
          ? parsed.items
          : [{ description: parsed.merchant || 'Struk Belanja', nominal: cleanNominal(parsed.total), type: 'expense', category: 'Belanja Harian' }];

        const summaryLines = [];
        items.forEach(it => {
          const nom = cleanNominal(it.nominal);
          if (nom > 0) {
            const trx = recordTransaction({
              description: `${parsed.merchant ? parsed.merchant + ' - ' : ''}${it.description}`,
              nominal: nom,
              type: it.type || 'expense',
              category: it.category || 'Belanja Harian'
            });
            summaryLines.push(`• **${trx.description}** (${trx.category}): Rp ${trx.nominal.toLocaleString('id-ID')}`);
          }
        });

        if (parsed.tax && cleanNominal(parsed.tax) > 0) {
          const taxNom = cleanNominal(parsed.tax);
          recordTransaction({
            description: `Pajak/Layanan (${parsed.merchant || 'Struk'})`,
            nominal: taxNom,
            type: 'expense',
            category: 'Lainnya'
          });
          summaryLines.push(`• **Pajak/Layanan**: Rp ${taxNom.toLocaleString('id-ID')}`);
        }

        const sisa = typeof getCurrentTotalBalance === 'function' ? getCurrentTotalBalance() : 0;
        appendChatMessage('assistant', `🧾 **Struk ${parsed.merchant || ''} Berhasil Dipecah (${summaryLines.length} Item):**\n${summaryLines.join('\n')}\n\n💰 **Sisa Saldo Cash:** Rp ${sisa.toLocaleString('id-ID')}`);
      } catch (err) {
        document.getElementById(loaderId)?.remove();
        appendChatMessage('assistant', `⚠️ Gagal memindai rincian struk: ${err.message}`);
      } finally {
        event.target.value = '';
      }
    };
  });
})();
