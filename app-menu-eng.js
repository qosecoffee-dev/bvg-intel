// ==================== MENU ENGINEERING MATRIX (KASAVANA & SMITH) ====================
STATE.menuEngCat = 'ALL';
STATE.menuEngQuad = 'ALL';

function getSavedMenuSalesMap() {
  try {
    return JSON.parse(localStorage.getItem('bvg_intel_menu_sales') || '{}');
  } catch (e) {
    return {};
  }
}

function setSavedMenuSales(recipeId, qty) {
  const map = getSavedMenuSalesMap();
  map[String(recipeId)] = Number(qty) || 0;
  try {
    localStorage.setItem('bvg_intel_menu_sales', JSON.stringify(map));
  } catch (e) {}
}

function getMenuEngineeringAnalysis() {
  const salesMap = getSavedMenuSalesMap();
  const baseList = STATE.recipes.map((raw, idx) => {
    const r = typeof normalizeRecipe === 'function'
      ? normalizeRecipe(raw, idx)
      : {
          id: String(raw.id || raw.ID || ('rcp_' + idx)),
          name: String(raw.name || raw['Nama Menu'] || 'Menu'),
          category: String(raw.category || raw['Kategori'] || 'Signature'),
          sellingPrice: Number(raw.sellingPrice || raw['Harga Jual'] || 0) || 0,
          hpp: Number(raw.hpp || raw['HPP'] || 0) || 0
        };
    const savedQty = salesMap[r.id] !== undefined
      ? Number(salesMap[r.id])
      : (Number(raw.salesQty !== undefined ? raw.salesQty : (raw['Terjual'] || raw['Sales'] || 0)) || 0);
    const cm = r.sellingPrice - r.hpp;
    const totalRevenue = r.sellingPrice * savedQty;
    const totalProfit = cm * savedQty;
    return { ...r, salesQty: savedQty, cm, totalRevenue, totalProfit };
  });

  const filtered = baseList.filter(item => STATE.menuEngCat === 'ALL' || item.category === STATE.menuEngCat);
  const totalUnits = filtered.reduce((s, x) => s + x.salesQty, 0);
  const totalProfitAll = filtered.reduce((s, x) => s + x.totalProfit, 0);
  const totalRevenueAll = filtered.reduce((s, x) => s + x.totalRevenue, 0);

  // Weighted Average Contribution Margin & 70% Popularity Rule
  const avgCm = totalUnits > 0
    ? (totalProfitAll / totalUnits)
    : (filtered.length > 0 ? filtered.reduce((s, x) => s + x.cm, 0) / filtered.length : 0);
  const popBenchmark = filtered.length > 0 ? ((100 / filtered.length) * 0.7) : 0;

  const analyzed = filtered.map(item => {
    const salesMix = totalUnits > 0 ? ((item.salesQty / totalUnits) * 100) : 0;
    const isHighPop = totalUnits > 0 ? (salesMix >= popBenchmark) : false;
    const isHighMargin = item.cm >= avgCm;

    let quadrant = 'DOG';
    let badge = '🐕 DOG';
    let badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
    let actionHint = 'Evaluasi resep, ganti menu baru, atau hapus jika membebani stok.';

    if (isHighPop && isHighMargin) {
      quadrant = 'STAR';
      badge = '⭐ STAR';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      actionHint = 'Menu andalan! Jaga konsistensi resep & tonjolkan di buku menu.';
    } else if (isHighPop && !isHighMargin) {
      quadrant = 'PLOWHORSE';
      badge = '🐎 PLOWHORSE';
      badgeClass = 'bg-amber-100 text-amber-900 border-amber-200';
      actionHint = 'Laris tapi margin tipis. Optimalkan takaran HPP, upsell topping, atau naikkan harga bertahap.';
    } else if (!isHighPop && isHighMargin) {
      quadrant = 'PUZZLE';
      badge = '🧩 PUZZLE';
      badgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
      actionHint = 'Margin tebal tapi kurang laku. Dorong rekomendasi kasir/barista & promo bundling.';
    }

    return { ...item, salesMix, isHighPop, isHighMargin, quadrant, badge, badgeClass, actionHint };
  });

  return { items: analyzed, totalUnits, totalProfitAll, totalRevenueAll, avgCm, popBenchmark };
}

function onMenuSalesInput(recipeId, val) {
  setSavedMenuSales(recipeId, val === '' ? 0 : (Number(val) || 0));
  renderCurrentTab();
}

async function saveMenuSalesToSheets() {
  const salesMap = getSavedMenuSalesMap();
  const updatedRecipes = STATE.recipes.map((r, idx) => {
    const id = String(r.id || r.ID || ('rcp_' + idx));
    const qty = salesMap[id] !== undefined ? salesMap[id] : (Number(r.salesQty) || 0);
    return { ...r, salesQty: qty };
  });
  await postToBackend({ action: 'saveRecipes', recipes: updatedRecipes }, 'Data penjualan Menu Engineering tersimpan!');
}

function renderMenuEngPage(main) {
  const { items, totalUnits, totalProfitAll, totalRevenueAll, avgCm, popBenchmark } = getMenuEngineeringAnalysis();
  const counts = {
    STAR: items.filter(x => x.quadrant === 'STAR').length,
    PLOWHORSE: items.filter(x => x.quadrant === 'PLOWHORSE').length,
    PUZZLE: items.filter(x => x.quadrant === 'PUZZLE').length,
    DOG: items.filter(x => x.quadrant === 'DOG').length
  };
  const visibleItems = items.filter(x => STATE.menuEngQuad === 'ALL' || x.quadrant === STATE.menuEngQuad);

  main.innerHTML = `
    <div class="grid grid-cols-3 gap-1 p-1 bg-stone-200 rounded-xl mb-3">
      <button onclick="STATE.masterSubTab='ingredients'; renderCurrentTab();"
        class="py-2 rounded-lg text-[11px] font-bold text-stone-600">
        🧪 Master (${STATE.ingredients.length})
      </button>
      <button onclick="STATE.masterSubTab='recipes'; renderCurrentTab();"
        class="py-2 rounded-lg text-[11px] font-bold text-stone-600">
        ☕ Resep (${STATE.recipes.length})
      </button>
      <button onclick="STATE.masterSubTab='menu_eng'; renderCurrentTab();"
        class="py-2 rounded-lg text-[11px] font-bold bg-white text-stone-900 shadow-sm">
        📈 Menu Eng
      </button>
    </div>

    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-stone-900">📈 Menu Engineering Matrix</h2>
          <p class="text-[11px] text-stone-500">Isi jumlah terjual (cup) untuk pemetaan kuadran otomatis</p>
        </div>
        <button onclick="downloadMenuEngPdf()" class="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold shrink-0 active:scale-95">
          📄 PDF
        </button>
      </div>

      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        ${['ALL', 'Signature', 'Coffee', 'Non-Coffee', 'Matcha & Tea', 'Mocktail', 'Seasonal'].map(cat => `
          <button onclick="STATE.menuEngCat='${cat}'; renderCurrentTab();"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${STATE.menuEngCat === cat ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'}">
            ${cat === 'ALL' ? 'Semua Kategori' : cat}
          </button>
        `).join('')}
      </div>

      <div class="grid grid-cols-3 gap-2 pt-1 text-[11px]">
        <div class="p-2 rounded-xl bg-stone-50 border border-stone-200">
          <span class="text-[10px] text-stone-400 block">Total Terjual</span>
          <b>${formatNum(totalUnits)} cup</b>
        </div>
        <div class="p-2 rounded-xl bg-stone-50 border border-stone-200">
          <span class="text-[10px] text-stone-400 block">Rata-rata Margin</span>
          <b class="text-emerald-700">${formatRp(avgCm)}</b>
        </div>
        <div class="p-2 rounded-xl bg-stone-50 border border-stone-200">
          <span class="text-[10px] text-stone-400 block">Total Profit</span>
          <b class="text-amber-800">${formatRp(totalProfitAll)}</b>
        </div>
      </div>
    </section>

    <!-- 4 Quadrant Filter Cards -->
    <div class="grid grid-cols-4 gap-1.5 mb-3 text-center">
      <button onclick="STATE.menuEngQuad = STATE.menuEngQuad === 'STAR' ? 'ALL' : 'STAR'; renderCurrentTab();"
        class="p-2 rounded-xl border ${STATE.menuEngQuad === 'STAR' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white border-emerald-200 text-emerald-900'}">
        <div class="text-xs font-extrabold">⭐ ${counts.STAR}</div>
        <div class="text-[10px] font-bold">Star</div>
      </button>
      <button onclick="STATE.menuEngQuad = STATE.menuEngQuad === 'PLOWHORSE' ? 'ALL' : 'PLOWHORSE'; renderCurrentTab();"
        class="p-2 rounded-xl border ${STATE.menuEngQuad === 'PLOWHORSE' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white border-amber-200 text-amber-900'}">
        <div class="text-xs font-extrabold">🐎 ${counts.PLOWHORSE}</div>
        <div class="text-[10px] font-bold">Plowhorse</div>
      </button>
      <button onclick="STATE.menuEngQuad = STATE.menuEngQuad === 'PUZZLE' ? 'ALL' : 'PUZZLE'; renderCurrentTab();"
        class="p-2 rounded-xl border ${STATE.menuEngQuad === 'PUZZLE' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-indigo-200 text-indigo-900'}">
        <div class="text-xs font-extrabold">🧩 ${counts.PUZZLE}</div>
        <div class="text-[10px] font-bold">Puzzle</div>
      </button>
      <button onclick="STATE.menuEngQuad = STATE.menuEngQuad === 'DOG' ? 'ALL' : 'DOG'; renderCurrentTab();"
        class="p-2 rounded-xl border ${STATE.menuEngQuad === 'DOG' ? 'bg-rose-600 text-white border-rose-700' : 'bg-white border-rose-200 text-rose-900'}">
        <div class="text-xs font-extrabold">🐕 ${counts.DOG}</div>
        <div class="text-[10px] font-bold">Dog</div>
      </button>
    </div>

    ${items.length === 0 ? `
      <div class="bg-white p-8 rounded-2xl text-center border border-stone-200">
        <p class="text-xs text-stone-500 mb-2.5">Belum ada data resep untuk dianalisis.</p>
        <button onclick="STATE.masterSubTab='recipes'; renderCurrentTab();" class="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">
          + Buat Resep HPP Dulu
        </button>
      </div>
    ` : `
      <section class="space-y-2.5 mb-3">
        ${visibleItems.map(item => `
          <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] px-2 py-0.5 rounded-full border font-bold ${item.badgeClass}">${item.badge}</span>
                  <span class="text-[10px] text-stone-400 font-semibold">${escHtml(item.category)}</span>
                </div>
                <h3 class="text-sm font-bold text-stone-900 mt-1">${escHtml(item.name)}</h3>
              </div>
              <div class="w-24 shrink-0">
                <label class="block text-[9px] font-bold text-stone-400 uppercase text-right">Terjual (Cup)</label>
                <input type="number" value="${item.salesQty || ''}" placeholder="0"
                  onchange="onMenuSalesInput('${escHtml(item.id)}', this.value)"
                  class="w-full px-2 py-1 rounded-lg border border-amber-400 bg-amber-50/50 text-xs font-extrabold text-right" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-stone-100 text-[11px]">
              <div>
                <span class="text-stone-400 block text-[10px]">Margin / Cup</span>
                <b class="text-emerald-700">${formatRp(item.cm)}</b>
              </div>
              <div>
                <span class="text-stone-400 block text-[10px]">Sales Mix</span>
                <b>${item.salesMix.toFixed(1)}%</b> <span class="text-[9px] text-stone-400">(std ${popBenchmark.toFixed(0)}%)</span>
              </div>
              <div>
                <span class="text-stone-400 block text-[10px]">Total Profit</span>
                <b class="text-stone-900">${formatRp(item.totalProfit)}</b>
              </div>
            </div>

            <p class="mt-2 text-[10px] text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg">
              💡 ${item.actionHint}
            </p>
          </div>
        `).join('')}
      </section>

      <button onclick="saveMenuSalesToSheets()" class="w-full py-3 rounded-2xl bg-stone-900 text-white font-bold text-xs shadow-md active:scale-95">
        💾 Simpan Data Penjualan Menu Engineering
      </button>
    `}
  `;
}

function downloadMenuEngPdf() {
  const doc = typeof createPdfDoc === 'function' ? createPdfDoc('l') : null;
  if (!doc) return;
  const { items, totalUnits, totalProfitAll, totalRevenueAll, avgCm, popBenchmark } = getMenuEngineeringAnalysis();

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('QOSE COFFEE — LAPORAN MENU ENGINEERING MATRIX', 12, 14);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  doc.text(`Total Terjual: ${formatNum(totalUnits)} cup  |  Total Omzet: ${formatRp(totalRevenueAll)}  |  Total Profit: ${formatRp(totalProfitAll)}  |  Std Margin: ${formatRp(avgCm)}  |  Std Popularitas: ${popBenchmark.toFixed(1)}%`, 12, 20);

  const body = items.map((it, idx) => [
    idx + 1,
    it.name,
    it.category,
    formatRp(it.sellingPrice),
    formatRp(it.hpp),
    formatRp(it.cm),
    formatNum(it.salesQty),
    it.salesMix.toFixed(1) + '%',
    formatRp(it.totalProfit),
    it.quadrant,
    it.actionHint
  ]);

  doc.autoTable({
    startY: 24,
    margin: { left: 10, right: 10 },
    head: [['No', 'Nama Menu', 'Kategori', 'Harga Jual', 'HPP', 'Margin/Cup', 'Terjual', 'Mix %', 'Total Profit', 'Kuadran', 'Rekomendasi Aksi']],
    body,
    styles: { fontSize: 7, cellPadding: 1.6 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 9) {
        const q = data.cell.raw;
        data.cell.styles.fontStyle = 'bold';
        if (q === 'STAR') data.cell.styles.textColor = [4, 120, 87];
        else if (q === 'PLOWHORSE') data.cell.styles.textColor = [180, 83, 9];
        else if (q === 'PUZZLE') data.cell.styles.textColor = [67, 56, 202];
        else if (q === 'DOG') data.cell.styles.textColor = [190, 18, 60];
      }
    }
  });

  doc.save(`Menu-Engineering-Qose-${new Date().toISOString().slice(0, 10)}.pdf`);
  showToast('PDF Menu Engineering berhasil diunduh');
}

// Hook cleanly into existing Master & HPP tab
(function attachMenuEngineeringTab() {
  const baseRender = window.renderMasterTab;
  window.renderMasterTab = function(main) {
    if (STATE.masterSubTab === 'menu_eng') {
      renderMenuEngPage(main);
      return;
    }
    if (typeof baseRender === 'function') baseRender(main);
    const switcher = main.querySelector('.grid.grid-cols-2');
    if (switcher) {
      switcher.className = 'grid grid-cols-3 gap-1 p-1 bg-stone-200 rounded-xl mb-3';
      switcher.querySelectorAll('button').forEach(b => {
        b.className = b.className.replace('text-xs', 'text-[11px]');
      });
      const btn = document.createElement('button');
      btn.className = 'py-2 rounded-lg text-[11px] font-bold text-stone-600';
      btn.textContent = '📈 Menu Eng';
      btn.onclick = () => { STATE.masterSubTab = 'menu_eng'; renderCurrentTab(); };
      switcher.appendChild(btn);
    }
  };
})();
