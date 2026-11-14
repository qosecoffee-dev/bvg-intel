const SO_LIMIT_THRESHOLD = 20000000;

function getDailyRecord(dateStr, ingId) {
  const key = dateStr + '__' + ingId;
  if (STATE.draftDaily[key]) return STATE.draftDaily[key];
  const found = STATE.invDaily.find(r => String(r.date) === dateStr && String(r.ingId) === String(ingId));
  return {
    inQty: found ? (Number(found.inQty) || 0) : 0,
    outQty: found ? (Number(found.outQty) || 0) : 0
  };
}

function onDailyInputChange(ingId, field, rawVal) {
  const dateStr = STATE.selectedDate;
  const key = dateStr + '__' + ingId;
  const cur = { ...getDailyRecord(dateStr, ingId) };
  cur[field] = rawVal === '' ? 0 : (Number(rawVal) || 0);
  STATE.draftDaily[key] = cur;

  const cl = cur.inQty - cur.outQty;
  const clEl = document.getElementById('cl_cell_' + ingId);
  if (clEl) {
    clEl.textContent = formatNum(cl);
    clEl.className = 'text-xs font-extrabold ' + (cl < 0 ? 'text-rose-600' : 'text-emerald-700');
  }
}

function computeTotalMonthlyValueSo(mKey) {
  const summaryMap = getMonthlySummaryMap(mKey);
  let total = 0;
  STATE.ingredients.forEach(ing => {
    const s = summaryMap[ing.id] || {};
    const draft = STATE.draftMonthly[mKey + '__' + ing.id] || {};
    const soVal = draft.soQty !== undefined ? draft.soQty : s.soQty;
    const hasSo = soVal !== '' && soVal !== null && soVal !== undefined;
    if (hasSo) {
      total += Number(soVal) * (Number(ing.unitCost) || 0);
    }
  });
  return total;
}

function updateLiveTotalValueSoDisplay(mKey) {
  const totalVal = computeTotalMonthlyValueSo(mKey);
  const isOver = totalVal > SO_LIMIT_THRESHOLD;
  const colorClass = isOver ? 'text-rose-600' : 'text-emerald-600';

  const topEl = document.getElementById('topTotalValueSoDisplay');
  if (topEl) {
    topEl.textContent = formatRp(totalVal);
    topEl.className = 'text-xs font-extrabold ' + (isOver ? 'text-rose-400' : 'text-emerald-300');
  }

  const bottomEl = document.getElementById('bottomTotalValueSoDisplay');
  if (bottomEl) {
    bottomEl.textContent = formatRp(totalVal);
    bottomEl.className = 'p-2.5 text-right font-extrabold text-xs ' + colorClass;
  }
}

function onMonthlyAuditChange(ingId, field, rawVal) {
  const mKey = getMonthKey(STATE.selectedDate);
  const key = mKey + '__' + ingId;
  const summaryMap = getMonthlySummaryMap(mKey);
  const base = summaryMap[String(ingId)] || { totalCl: 0, soQty: '', pemakaianBar: 0 };
  const draft = STATE.draftMonthly[key] || {
    soQty: base.soQty
  };

  if (field === 'soQty') {
    draft.soQty = rawVal === '' ? '' : (Number(rawVal) || 0);
  }
  STATE.draftMonthly[key] = draft;

  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  const unitCost = ing ? Number(ing.unitCost) || 0 : 0;
  const hasSo = draft.soQty !== '' && draft.soQty !== null && draft.soQty !== undefined;
  const selisih = hasSo ? (Number(draft.soQty) - Number(base.totalCl || 0)) : 0;
  const valSo = hasSo ? (Number(draft.soQty) * unitCost) : 0;

  const selEl = document.getElementById('selisih_cell_' + ingId);
  if (selEl) {
    selEl.textContent = hasSo ? formatNum(selisih) : '-';
    selEl.className = 'text-xs font-bold ' + (selisih < 0 ? 'text-rose-600' : 'text-stone-800');
  }
  const valEl = document.getElementById('valso_cell_' + ingId);
  if (valEl) valEl.textContent = hasSo ? formatRp(valSo) : 'Rp 0';

  updateLiveTotalValueSoDisplay(mKey);
}

function setDailyDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const maxDay = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(day)), maxDay);
  STATE.selectedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  renderCurrentTab();
}

async function saveDailyBatchAction() {
  const dateStr = STATE.selectedDate;
  const entries = STATE.ingredients.map(ing => {
    const rec = getDailyRecord(dateStr, ing.id);
    return {
      ingId: ing.id,
      ingName: ing.name,
      subCategory: ing.subCategory,
      unit: ing.unit,
      inQty: Number(rec.inQty) || 0,
      outQty: Number(rec.outQty) || 0
    };
  }).filter(e => e.inQty !== 0 || e.outQty !== 0 || STATE.invDaily.some(r => String(r.date) === dateStr && String(r.ingId) === String(e.ingId)));

  const ok = await postToBackend({
    action: 'saveDailyBatch',
    date: dateStr,
    entries
  }, `Stok harian ${dateStr} tersimpan!`);

  if (ok) {
    Object.keys(STATE.draftDaily).forEach(k => {
      if (k.startsWith(dateStr + '__')) delete STATE.draftDaily[k];
    });
  }
}

async function saveMonthlyAuditAction() {
  const mKey = getMonthKey(STATE.selectedDate);
  const summaryMap = getMonthlySummaryMap(mKey);
  const entries = STATE.ingredients.map(ing => {
    const key = mKey + '__' + ing.id;
    const base = summaryMap[String(ing.id)] || { soQty: '', pemakaianBar: 0 };
    const draft = STATE.draftMonthly[key] || {};
    const autoPemakaianRp = Math.round(Number(base.pemakaianBar) || 0);
    return {
      ingId: ing.id,
      soQty: draft.soQty !== undefined ? draft.soQty : base.soQty,
      pemakaianBar: autoPemakaianRp
    };
  }).filter(e => e.soQty !== '' || e.pemakaianBar > 0);

  const ok = await postToBackend({
    action: 'saveMonthlyAudit',
    monthKey: mKey,
    entries
  }, `Audit SO (${mKey}) tersimpan!`);

  if (ok) {
    Object.keys(STATE.draftMonthly).forEach(k => {
      if (k.startsWith(mKey + '__')) delete STATE.draftMonthly[k];
    });
  }
}

function getFilteredDailyIngredients() {
  const sortedList = getSortedIngredients();
  const q = STATE.dailySearch.trim().toLowerCase();
  return sortedList.filter(ing => {
    const matchCat = STATE.dailyCatFilter === 'ALL' || ing.subCategory === STATE.dailyCatFilter;
    const matchQ = !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
}

function buildDailyItemsAndAuditHtml() {
  const [yStr, mStr] = STATE.selectedDate.split('-');
  const mKey = `${yStr}-${mStr}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const summaryMap = getMonthlySummaryMap(mKey);
  const filtered = getFilteredDailyIngredients();

  const groups = [];
  const groupMap = {};
  filtered.forEach(ing => {
    if (!groupMap[ing.subCategory]) {
      groupMap[ing.subCategory] = [];
      groups.push({ cat: ing.subCategory, items: groupMap[ing.subCategory] });
    }
    groupMap[ing.subCategory].push(ing);
  });

  const totalValueSoAll = computeTotalMonthlyValueSo(mKey);
  const isOverLimit = totalValueSoAll > SO_LIMIT_THRESHOLD;

  const cardsHtml = `
    <section class="space-y-3 mb-4">
      ${groups.length === 0 ? `<div class="bg-white p-6 rounded-2xl text-center text-xs text-stone-400">Tidak ada bahan ditemukan.</div>` : ''}
      ${groups.map(grp => `
        <div class="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div class="px-3.5 py-2 bg-stone-800 text-white flex items-center justify-between">
            <span class="text-xs font-bold tracking-wide">${escHtml(grp.cat)}</span>
            <span class="text-[10px] text-stone-300">${grp.items.length} item</span>
          </div>
          <div class="divide-y divide-stone-100">
            ${grp.items.map(ing => {
              const rec = getDailyRecord(STATE.selectedDate, ing.id);
              const cl = rec.inQty - rec.outQty;
              const mSum = summaryMap[ing.id] || { totalIn: 0, totalOut: 0, totalCl: 0 };
              return `
                <div class="p-3">
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p class="text-xs font-bold text-stone-900">${escHtml(ing.name)}</p>
                      <p class="text-[10px] text-stone-500">Satuan: <b>${escHtml(ing.unit)}</b> • Bln Ini: IN <b>${formatNum(mSum.totalIn)}</b> | OUT <b>${formatNum(mSum.totalOut)}</b> | CL <b>${formatNum(mSum.totalCl)}</b></p>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="text-[10px] text-stone-400 block">CL Harian</span>
                      <span id="cl_cell_${ing.id}" class="text-xs font-extrabold ${cl < 0 ? 'text-rose-600' : 'text-emerald-700'}">${formatNum(cl)}</span>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-[10px] font-semibold text-stone-500 mb-0.5">IN (${escHtml(ing.unit)})</label>
                      <input type="number" step="any" value="${rec.inQty || ''}" placeholder="0"
                        oninput="onDailyInputChange('${ing.id}', 'inQty', this.value)"
                        class="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-bold bg-stone-50 focus:bg-white focus:border-amber-600 focus:outline-none" />
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-stone-500 mb-0.5">OUT (${escHtml(ing.unit)})</label>
                      <input type="number" step="any" value="${rec.outQty || ''}" placeholder="0"
                        oninput="onDailyInputChange('${ing.id}', 'outQty', this.value)"
                        class="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-bold bg-stone-50 focus:bg-white focus:border-amber-600 focus:outline-none" />
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}

      <button onclick="saveDailyBatchAction()" class="w-full py-3 rounded-2xl bg-stone-900 text-white font-bold text-xs shadow-md active:scale-95">
        💾 Simpan Data Harian (${STATE.selectedDate})
      </button>
    </section>

    <section class="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      <div class="p-3.5 bg-amber-950 text-white">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-xs font-bold">📊 Rekap Bulanan &amp; Audit SO (${months[Number(mStr) - 1]} ${yStr})</h3>
            <p class="text-[10px] text-amber-200">Pemakaian Bar (Rp) &amp; Value SO (Stok Fisik) otomatis</p>
          </div>
          <div class="text-right shrink-0">
            <span class="text-[10px] text-amber-300 block">Total Value SO</span>
            <span id="topTotalValueSoDisplay" class="text-xs font-extrabold ${isOverLimit ? 'text-rose-400' : 'text-emerald-300'}">${formatRp(totalValueSoAll)}</span>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr class="bg-stone-100 text-stone-700 border-b border-stone-200">
              <th class="p-2 font-bold sticky left-0 bg-stone-100 min-w-[130px]">Bahan</th>
              <th class="p-2 font-bold text-right">Tot IN</th>
              <th class="p-2 font-bold text-right">Tot OUT</th>
              <th class="p-2 font-bold text-right">Tot CL</th>
              <th class="p-2 font-bold text-center min-w-[72px]">SO</th>
              <th class="p-2 font-bold text-right">Selisih</th>
              <th class="p-2 font-bold text-right min-w-[95px]">Pemakaian Bar</th>
              <th class="p-2 font-bold text-right min-w-[95px]">Value SO</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            ${filtered.map(ing => {
              const mSum = summaryMap[ing.id] || { totalIn: 0, totalOut: 0, totalCl: 0, soQty: '', selisih: 0, pemakaianBar: 0, valueSo: 0 };
              const draft = STATE.draftMonthly[mKey + '__' + ing.id] || {};
              const soVal = draft.soQty !== undefined ? draft.soQty : mSum.soQty;
              const hasSo = soVal !== '' && soVal !== null && soVal !== undefined;
              const selisih = hasSo ? (Number(soVal) - Number(mSum.totalCl || 0)) : 0;
              const valSo = hasSo ? (Number(soVal) * (Number(ing.unitCost) || 0)) : 0;
              const pemakaianBarRp = Number(mSum.pemakaianBar) || 0;

              return `
                <tr>
                  <td class="p-2 sticky left-0 bg-white font-semibold text-stone-800 border-r border-stone-100">
                    <div class="truncate max-w-[130px]">${escHtml(ing.name)}</div>
                    <div class="text-[9px] text-stone-400">${escHtml(ing.subCategory)} (${escHtml(ing.unit)})</div>
                  </td>
                  <td class="p-2 text-right font-medium">${formatNum(mSum.totalIn)}</td>
                  <td class="p-2 text-right font-medium">${formatNum(mSum.totalOut)}</td>
                  <td class="p-2 text-right font-bold text-emerald-700">${formatNum(mSum.totalCl)}</td>
                  <td class="p-1.5">
                    <input type="number" step="any" value="${soVal !== '' ? soVal : ''}" placeholder="-"
                      oninput="onMonthlyAuditChange('${ing.id}', 'soQty', this.value)"
                      class="w-16 px-1.5 py-1 rounded border border-stone-300 text-center font-bold bg-amber-50/40" />
                  </td>
                  <td id="selisih_cell_${ing.id}" class="p-2 text-right font-bold ${selisih < 0 ? 'text-rose-600' : 'text-stone-800'}">
                    ${hasSo ? formatNum(selisih) : '-'}
                  </td>
                  <td class="p-2 text-right font-semibold text-stone-700">
                    ${formatRp(pemakaianBarRp)}
                  </td>
                  <td id="valso_cell_${ing.id}" class="p-2 text-right font-bold text-stone-900">
                    ${hasSo ? formatRp(valSo) : 'Rp 0'}
                  </td>
                </tr>
              `;
            }).join('')}

            <tr class="bg-stone-100 border-t-2 border-stone-300">
              <td colspan="7" class="p-2.5 text-right font-extrabold text-stone-800 uppercase text-[10px] tracking-wide">
                Total Value SO (Stok Fisik)
              </td>
              <td id="bottomTotalValueSoDisplay" class="p-2.5 text-right font-extrabold text-xs ${isOverLimit ? 'text-rose-600' : 'text-emerald-600'}">
                ${formatRp(totalValueSoAll)}
              </td>
            </tr>
            <tr class="bg-stone-50 border-t border-stone-200">
              <td colspan="7" class="p-2 text-right font-bold text-stone-500 uppercase text-[10px] tracking-wide">
                Acuan / Batas Maksimal Stok Fisik
              </td>
              <td class="p-2 text-right font-extrabold text-stone-700 text-[11px]">
                Rp 20.000.000
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-3 bg-stone-50 border-t border-stone-200">
        <button onclick="saveMonthlyAuditAction()" class="w-full py-2.5 rounded-xl bg-amber-700 text-white font-bold text-xs active:scale-95">
          💾 Simpan Stock Opname (${months[Number(mStr) - 1]} ${yStr})
        </button>
      </div>
    </section>
  `;

  return cardsHtml;
}

function updateDailyFilteredViewOnly() {
  const wrap = document.getElementById('dailyContentWrapper');
  if (wrap) wrap.innerHTML = buildDailyItemsAndAuditHtml();
}

function renderDailyTab(main) {
  const [yStr, mStr, dStr] = STATE.selectedDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const sortedList = getSortedIngredients();

  main.innerHTML = `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-stone-900">📦 Daily Inventory Bar</h2>
          <p class="text-[11px] text-stone-500">Rumus otomatis: <b>CL = IN - OUT</b></p>
        </div>
        <button onclick="openAddRawMaterialModal()" class="px-2.5 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold active:scale-95">
          + Raw Material
        </button>
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        <select onchange="setDailyDateParts('${yStr}', '${mStr}', this.value)" class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
            const val = String(d).padStart(2, '0');
            return `<option value="${val}" ${val === dStr ? 'selected' : ''}>Tgl ${d}</option>`;
          }).join('')}
        </select>
        <select onchange="setDailyDateParts('${yStr}', this.value, '${dStr}')" class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${months.map((lbl, idx) => {
            const val = String(idx + 1).padStart(2, '0');
            return `<option value="${val}" ${val === mStr ? 'selected' : ''}>${lbl}</option>`;
          }).join('')}
        </select>
        <select onchange="setDailyDateParts(this.value, '${mStr}', '${dStr}')" class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${[2025, 2026, 2027, 2028].map(yr => `<option value="${yr}" ${String(yr) === yStr ? 'selected' : ''}>${yr}</option>`).join('')}
        </select>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1">
        <button onclick="downloadDailyPdf()" class="py-2 px-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold active:scale-95">
          📄 PDF Harian (${dStr}/${mStr})
        </button>
        <button onclick="downloadMonthlyPdf()" class="py-2 px-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold active:scale-95">
          📊 PDF Bulanan (${months[Number(mStr) - 1]} ${yStr})
        </button>
      </div>
    </section>

    <div class="space-y-2 mb-3">
      <div class="flex gap-2">
        <input id="dailySearchInput" type="text" value="${escHtml(STATE.dailySearch)}"
          oninput="STATE.dailySearch=this.value; updateDailyFilteredViewOnly();"
          placeholder="Cari bahan baku..." class="flex-1 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs focus:border-amber-600 focus:outline-none" />
        <button onclick="STATE.activeTab='master'; STATE.masterSubTab='ingredients'; renderCurrentTab();"
          class="px-3 py-2 rounded-xl bg-white border border-stone-300 text-[11px] font-bold text-stone-700 shrink-0">
          ⚙️ Susunan
        </button>
      </div>
      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button onclick="STATE.dailyCatFilter='ALL'; renderCurrentTab();"
          class="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${STATE.dailyCatFilter === 'ALL' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}">
          Semua (${sortedList.length})
        </button>
        ${SUB_CATEGORIES.map(cat => `
          <button onclick="STATE.dailyCatFilter='${cat}'; renderCurrentTab();"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${STATE.dailyCatFilter === cat ? 'bg-amber-600 text-white' : 'bg-white text-stone-600 border border-stone-200'}">
            ${cat}
          </button>
        `).join('')}
      </div>
    </div>

    <div id="dailyContentWrapper">
      ${buildDailyItemsAndAuditHtml()}
    </div>
  `;
}

// ==================== PAR STOCK TAB ====================
function onParInputChange(ingId, val) {
  STATE.draftPar[String(ingId)] = val === '' ? 0 : (Number(val) || 0);
}

async function saveParStockAction() {
  const updates = STATE.ingredients.map(ing => ({
    id: ing.id,
    minStock: STATE.draftPar[String(ing.id)] !== undefined ? STATE.draftPar[String(ing.id)] : (Number(ing.minStock) || 0)
  }));
  const ok = await postToBackend({ action: 'saveParStock', updates }, 'Batas Minimum Par Stock disimpan!');
  if (ok) STATE.draftPar = {};
}

function buildParStockListHtml() {
  const curMonth = new Date().toISOString().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  const q = STATE.parSearch.trim().toLowerCase();
  const sortedList = getSortedIngredients().filter(ing => {
    return !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q);
  });

  if (sortedList.length === 0) {
    return `<div class="p-6 text-center text-xs text-stone-400">Bahan tidak ditemukan.</div>`;
  }

  return sortedList.map(ing => {
    const curStock = mMap[ing.id] ? mMap[ing.id].totalCl : 0;
    const minVal = STATE.draftPar[ing.id] !== undefined ? STATE.draftPar[ing.id] : (ing.minStock || 0);
    const isLow = minVal > 0 && curStock <= minVal;
    return `
      <div class="p-3 flex items-center justify-between gap-2 ${isLow ? 'bg-rose-50/60' : ''}">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold text-stone-900 truncate">${escHtml(ing.name)}</p>
          <p class="text-[10px] text-stone-500">
            ${escHtml(ing.subCategory)} • Sisa Daily: <b class="${isLow ? 'text-rose-600' : 'text-emerald-700'}">${formatNum(curStock)} ${escHtml(ing.unit)}</b>
          </p>
        </div>
        <div class="w-28 shrink-0">
          <label class="block text-[9px] font-bold text-stone-400 uppercase">Min Stock (${escHtml(ing.unit)})</label>
          <input type="number" step="any" value="${minVal || ''}" placeholder="0"
            oninput="onParInputChange('${ing.id}', this.value)"
            class="w-full px-2.5 py-1.5 rounded-lg border ${isLow ? 'border-rose-400 bg-white' : 'border-stone-300 bg-stone-50'} text-xs font-bold text-right" />
        </div>
      </div>
    `;
  }).join('');
}

function updateParStockListOnly() {
  const el = document.getElementById('parStockListContainer');
  if (el) el.innerHTML = buildParStockListHtml();
}

function renderParStockTab(main) {
  main.innerHTML = `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-stone-900">⚠️ Par Stock (Batas Minimum)</h2>
          <p class="text-[11px] text-stone-500">Isi manual minimum stock untuk pengingat di Home</p>
        </div>
        <button onclick="openAddRawMaterialModal()" class="px-2.5 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold active:scale-95">
          + Raw Material
        </button>
      </div>
      <div class="flex gap-2">
        <input id="parSearchInput" type="text" value="${escHtml(STATE.parSearch)}"
          oninput="STATE.parSearch=this.value; updateParStockListOnly();"
          placeholder="Cari nama bahan atau kategori..." class="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs focus:border-amber-600 focus:outline-none" />
        <button onclick="downloadParStockPdf()" class="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shrink-0">
          📄 PDF
        </button>
      </div>
    </section>

    <section id="parStockListContainer" class="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mb-3 divide-y divide-stone-100">
      ${buildParStockListHtml()}
    </section>

    <button onclick="saveParStockAction()" class="w-full py-3 rounded-2xl bg-stone-900 text-white font-bold text-xs shadow-md active:scale-95">
      💾 Simpan Semua Minimum Stock
    </button>
  `;
}

// ==================== MASTER INGREDIENTS & RECIPES TAB ====================
function moveIngredientOrder(ingId, dir) {
  const list = getSortedIngredients();
  const idx = list.findIndex(x => String(x.id) === String(ingId));
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= list.length) return;
  const temp = list[idx];
  list[idx] = list[target];
  list[target] = temp;
  list.forEach((item, i) => { item.sortOrder = i + 1; });
  STATE.ingredients = list;
  updateMasterIngListOnly();
}

function jumpIngredientOrder(ingId, newPosRaw) {
  const list = getSortedIngredients();
  const idx = list.findIndex(x => String(x.id) === String(ingId));
  const target = Math.min(Math.max(1, Number(newPosRaw) || 1), list.length) - 1;
  if (idx < 0 || idx === target) return;
  const [moved] = list.splice(idx, 1);
  list.splice(target, 0, moved);
  list.forEach((item, i) => { item.sortOrder = i + 1; });
  STATE.ingredients = list;
  updateMasterIngListOnly();
}

function changeIngredientSubCat(ingId, newCat) {
  const item = STATE.ingredients.find(x => String(x.id) === String(ingId));
  if (item) {
    item.subCategory = newCat;
    item.category = newCat;
    item['Kategori'] = newCat;
  }
}

function deleteIngredientItem(ingId) {
  STATE.ingredients = STATE.ingredients.filter(x => String(x.id) !== String(ingId));
  updateMasterIngListOnly();
  showToast('Bahan dihapus dari daftar (tekan Simpan Susunan)');
}

async function saveMasterOrderAction() {
  const ordered = getSortedIngredients().map((item, idx) => ({
    ...item,
    sortOrder: idx + 1
  }));
  const ok = await postToBackend({
    action: 'saveMasterIngredients',
    ingredients: ordered
  }, 'Susunan Master Ingredients berhasil disimpan!');
  if (ok) STATE.masterEditMode = false;
}

function openAddRawMaterialModal(editIngId = null) {
  const editIng = editIngId ? STATE.ingredients.find(x => String(x.id) === String(editIngId)) : null;
  const isEdit = !!editIng;
  openModal(isEdit ? 'Edit Raw Material' : '+ Tambah Raw Material Baru', `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Nama Bahan Baku</label>
        <input id="rmName" type="text" value="${escHtml(isEdit ? editIng.name : '')}" placeholder="Contoh: Powder Matcha Ceremonial"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Sub-Kategori</label>
          <select id="rmSubCat" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white">
            ${SUB_CATEGORIES.map(c => `<option value="${c}" ${(isEdit && editIng.subCategory === c) ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Satuan</label>
          <select id="rmUnit" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white">
            ${['gram', 'ml', 'pcs', 'bottle', 'pack'].map(u => `<option value="${u}" ${(isEdit && editIng.unit === u) ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Harga Beli (Rp)</label>
          <input id="rmPrice" type="number" value="${isEdit ? (editIng.price || '') : ''}" placeholder="150000"
            class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Isi Kemasan</label>
          <input id="rmPackSize" type="number" value="${isEdit ? (editIng.packSize || 1000) : 1000}" placeholder="1000"
            class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Minimum Stock / Par Stock (Opsional)</label>
        <input id="rmMinStock" type="number" value="${isEdit ? (editIng.minStock || '') : ''}" placeholder="0"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <button onclick="submitRawMaterialForm('${isEdit ? escHtml(editIng.id) : ''}')"
        class="w-full py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs active:scale-95">
        ${isEdit ? 'Simpan Perubahan' : 'Tambahkan & Sinkronkan'}
      </button>
    </div>
  `);
}

async function submitRawMaterialForm(editId) {
  const name = (document.getElementById('rmName')?.value || '').trim();
  const subCategory = document.getElementById('rmSubCat')?.value || 'Other Base';
  const unit = document.getElementById('rmUnit')?.value || 'gram';
  const price = Number(document.getElementById('rmPrice')?.value) || 0;
  const packSize = Number(document.getElementById('rmPackSize')?.value) || 1;
  const minStock = Number(document.getElementById('rmMinStock')?.value) || 0;
  const unitCost = packSize > 0 ? price / packSize : 0;

  if (!name) {
    showToast('Nama bahan wajib diisi');
    return;
  }
  closeModal();

  if (editId) {
    const idx = STATE.ingredients.findIndex(x => String(x.id) === String(editId));
    if (idx >= 0) {
      STATE.ingredients[idx] = {
        ...STATE.ingredients[idx],
        name, 'Nama Bahan': name,
        subCategory, category: subCategory, 'Kategori': subCategory,
        unit, 'Satuan': unit,
        price, 'Harga Beli': price,
        packSize, 'Ukuran': packSize,
        unitCost, 'Unit Cost': unitCost,
        minStock
      };
      await saveMasterOrderAction();
    }
  } else {
    await postToBackend({
      action: 'addRawMaterial',
      item: { name, subCategory, unit, price, packSize, unitCost, minStock }
    }, `${name} berhasil ditambahkan!`);
  }
}

function buildMasterIngListHtml() {
  const allSorted = getSortedIngredients();
  const q = STATE.masterSearch.trim().toLowerCase();
  const sortedList = allSorted.filter(ing => {
    return !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q);
  });

  if (sortedList.length === 0) {
    return `<div class="p-6 text-center text-xs text-stone-400">Bahan tidak ditemukan.</div>`;
  }

  return sortedList.map((ing) => {
    const realPos = allSorted.findIndex(x => String(x.id) === String(ing.id)) + 1;
    return `
      <div class="p-3 flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            ${STATE.masterEditMode ? `
              <input type="number" min="1" max="${allSorted.length}" value="${realPos}"
                onchange="jumpIngredientOrder('${ing.id}', this.value)"
                class="w-11 px-1 py-0.5 rounded border border-amber-400 bg-amber-50 text-[11px] font-bold text-center text-amber-950" />
            ` : `
              <span class="text-[10px] font-bold text-stone-400">#${realPos}</span>
            `}
            <p class="text-xs font-bold text-stone-900 truncate">${escHtml(ing.name)}</p>
          </div>
          ${STATE.masterEditMode ? `
            <select onchange="changeIngredientSubCat('${ing.id}', this.value)" class="mt-1 px-2 py-1 rounded-lg border border-stone-300 bg-stone-50 text-[11px] font-bold text-stone-800">
              ${SUB_CATEGORIES.map(c => `<option value="${c}" ${ing.subCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          ` : `
            <p class="text-[10px] text-stone-500 mt-0.5">
              <span class="px-1.5 py-0.5 rounded bg-stone-100 font-semibold text-stone-700">${escHtml(ing.subCategory)}</span>
              • ${formatRp(ing.unitCost)} / ${escHtml(ing.unit)}
            </p>
          `}
        </div>
        ${STATE.masterEditMode ? `
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="moveIngredientOrder('${ing.id}', -1)" class="w-7 h-7 rounded-lg bg-stone-100 font-bold text-xs">▲</button>
            <button onclick="moveIngredientOrder('${ing.id}', 1)" class="w-7 h-7 rounded-lg bg-stone-100 font-bold text-xs">▼</button>
            <button onclick="openAddRawMaterialModal('${escHtml(ing.id)}')" class="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 text-xs">✏️</button>
            <button onclick="deleteIngredientItem('${ing.id}')" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 text-xs">🗑️</button>
          </div>
        ` : `
          <div class="text-right shrink-0">
            <p class="text-xs font-bold text-stone-800">${formatRp(ing.price)}</p>
            <p class="text-[10px] text-stone-400">/${formatNum(ing.packSize)} ${escHtml(ing.unit)}</p>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function updateMasterIngListOnly() {
  const el = document.getElementById('masterIngListContainer');
  if (el) el.innerHTML = buildMasterIngListHtml();
}

function renderMasterTab(main) {
  const isIngSub = STATE.masterSubTab === 'ingredients';

  main.innerHTML = `
    <div class="grid grid-cols-2 gap-1.5 p-1 bg-stone-200 rounded-xl mb-3">
      <button onclick="STATE.masterSubTab='ingredients'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold ${isIngSub ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
        🧪 Master Ingredients (${STATE.ingredients.length})
      </button>
      <button onclick="STATE.masterSubTab='recipes'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold ${!isIngSub ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
        ☕ Resep &amp; HPP (${STATE.recipes.length})
      </button>
    </div>

    ${isIngSub ? `
      <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-stone-900">Otak Pengelompokan Bahan</h2>
            <p class="text-[11px] text-stone-500">Urutan &amp; kategori di sini otomatis mengatur Daily Inv &amp; PDF</p>
          </div>
          <button onclick="STATE.masterEditMode=!STATE.masterEditMode; renderCurrentTab();"
            class="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${STATE.masterEditMode ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-800 border border-stone-300'}">
            ${STATE.masterEditMode ? '✓ Selesai Edit' : '✏️ Edit Susunan'}
          </button>
        </div>
        <div class="flex gap-2">
          <input id="masterSearchInput" type="text" value="${escHtml(STATE.masterSearch)}"
            oninput="STATE.masterSearch=this.value; updateMasterIngListOnly();"
            placeholder="Cari bahan atau sub-kategori..." class="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs focus:border-amber-600 focus:outline-none" />
          <button onclick="openAddRawMaterialModal()" class="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold shrink-0">
            + Tambah
          </button>
        </div>
        ${STATE.masterEditMode ? `
          <p class="text-[10px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
            Ketik nomor urut di kotak angka untuk lompat posisi langsung, atau gunakan ▲ / ▼.
          </p>
          <button onclick="saveMasterOrderAction()" class="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow active:scale-95">
            💾 Simpan Perubahan Susunan &amp; Kategori
          </button>
        ` : ''}
      </section>

      <section id="masterIngListContainer" class="bg-white rounded-2xl shadow-sm border border-stone-200 divide-y divide-stone-100">
        ${buildMasterIngListHtml()}
      </section>
    ` : renderRecipesSubView()}
  `;
}

// ==================== RECIPE HPP CALCULATOR & BUILDER ====================
window._recipeDraftItems = [];

function normalizeRecipe(raw, idx) {
  const id = String(raw.id || raw.ID || ('rcp_' + idx));
  const name = String(raw.name || raw['Nama Menu'] || 'Menu').trim();
  const category = String(raw.category || raw['Kategori'] || 'Signature').trim();
  const sellingPrice = Number(raw.sellingPrice !== '' && raw.sellingPrice !== undefined ? raw.sellingPrice : (raw['Harga Jual'] || 0)) || 0;
  const notes = String(raw.notes || raw['Catatan'] || '').trim();
  let parsedItems = [];
  const rawIngs = raw.ingredients !== undefined ? raw.ingredients : raw['Bahan'];
  if (Array.isArray(rawIngs)) {
    parsedItems = rawIngs;
  } else if (typeof rawIngs === 'string' && rawIngs.trim().startsWith('[')) {
    try { parsedItems = JSON.parse(rawIngs); } catch (e) {}
  }

  const items = parsedItems.map(it => {
    const liveIng = STATE.ingredients.find(x => String(x.id) === String(it.ingId));
    const unitCost = liveIng ? Number(liveIng.unitCost) : (Number(it.unitCost) || 0);
    const qty = Number(it.qty) || 0;
    return {
      ingId: String(it.ingId || ''),
      name: liveIng ? liveIng.name : (it.name || 'Bahan'),
      unit: liveIng ? liveIng.unit : (it.unit || 'gram'),
      unitCost,
      qty
    };
  });

  const computedHpp = items.length > 0
    ? items.reduce((s, it) => s + (it.qty * it.unitCost), 0)
    : (Number(raw.hpp || raw['HPP'] || 0) || 0);
  const margin = sellingPrice > 0 ? (((sellingPrice - computedHpp) / sellingPrice) * 100) : 0;

  return { id, name, category, sellingPrice, notes, items, hpp: computedHpp, margin };
}

function buildRecipeCardsHtml() {
  const allRecipes = STATE.recipes.map(normalizeRecipe);
  const q = STATE.recipeSearch.trim().toLowerCase();
  const recipes = allRecipes.filter(r => {
    const matchCat = STATE.recipeCatFilter === 'ALL' || r.category === STATE.recipeCatFilter;
    const matchQ = !q ||
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.items.some(it => it.name.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  if (allRecipes.length === 0) {
    return `
      <div class="bg-white p-8 rounded-2xl text-center border border-stone-200">
        <p class="text-xs text-stone-500 mb-2.5">Belum ada resep minuman tercatat.</p>
        <button onclick="openRecipeModal()" class="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold">
          + Racik Resep Pertama
        </button>
      </div>
    `;
  }

  if (recipes.length === 0) {
    return `
      <div class="bg-white p-6 rounded-2xl text-center border border-stone-200 text-xs text-stone-400">
        Menu tidak ditemukan untuk pencarian "<b>${escHtml(STATE.recipeSearch)}</b>".
      </div>
    `;
  }

  return `
    <section class="space-y-2.5">
      ${recipes.map(r => {
        const profit = r.sellingPrice - r.hpp;
        const cogsPct = r.sellingPrice > 0 ? ((r.hpp / r.sellingPrice) * 100).toFixed(1) : '0.0';
        return `
          <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <span class="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold">${escHtml(r.category)}</span>
                <h3 class="text-sm font-bold text-stone-900 mt-1">${escHtml(r.name)}</h3>
              </div>
              <div class="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                <button onclick="downloadSingleRecipeHppPdf('${escHtml(r.id)}')"
                  class="px-2 h-7 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-[10px] font-bold active:scale-95" title="Download PDF HPP">
                  📄 HPP
                </button>
                <button onclick="downloadSingleRecipeSopPdf('${escHtml(r.id)}')"
                  class="px-2 h-7 rounded-lg bg-stone-100 border border-stone-300 text-stone-800 text-[10px] font-bold active:scale-95" title="Download PDF SOP">
                  📋 SOP
                </button>
                <button onclick="openRecipeModal('${escHtml(r.id)}')" class="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 text-xs">✏️</button>
                <button onclick="deleteRecipeAction('${escHtml(r.id)}')" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 text-xs">🗑️</button>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-stone-100 text-[11px]">
              <div>
                <span class="text-stone-400 block text-[10px]">Harga Jual</span>
                <b>${formatRp(r.sellingPrice)}</b>
              </div>
              <div>
                <span class="text-stone-400 block text-[10px]">HPP (${cogsPct}%)</span>
                <b class="text-amber-800">${formatRp(r.hpp)}</b>
              </div>
              <div>
                <span class="text-stone-400 block text-[10px]">Margin (${r.margin.toFixed(1)}%)</span>
                <b class="${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}">${formatRp(profit)}</b>
              </div>
            </div>

            ${r.items.length > 0 ? `
              <div class="mt-2.5 pt-2 border-t border-dashed border-stone-200 space-y-1">
                ${r.items.map(it => `
                  <div class="flex justify-between text-[10px] text-stone-600">
                    <span>• ${escHtml(it.name)} (${formatNum(it.qty)} ${escHtml(it.unit)})</span>
                    <span class="font-semibold">${formatRp(it.qty * it.unitCost)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${r.notes ? `<p class="mt-2 text-[10px] text-stone-500 bg-stone-50 px-2.5 py-1.5 rounded-lg">Catatan: ${escHtml(r.notes)}</p>` : ''}
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function updateRecipeCardsOnly() {
  const el = document.getElementById('recipeCardsContainer');
  if (el) el.innerHTML = buildRecipeCardsHtml();
}

function renderRecipesSubView() {
  return `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-stone-900">☕ Kalkulator &amp; Daftar Resep HPP</h2>
          <p class="text-[11px] text-stone-500">Hitung otomatis HPP per cup &amp; cetak PDF HPP / SOP</p>
        </div>
        <button onclick="openRecipeModal()" class="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0 active:scale-95">
          + Resep HPP
        </button>
      </div>

      <div class="relative flex items-center">
        <input id="recipeSearchInput" type="text" value="${escHtml(STATE.recipeSearch)}"
          oninput="STATE.recipeSearch=this.value; updateRecipeCardsOnly();"
          placeholder="Cari nama menu atau bahan resep..."
          class="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white text-xs focus:border-amber-600 focus:outline-none" />
        <button type="button" onclick="STATE.recipeSearch=''; document.getElementById('recipeSearchInput').value=''; updateRecipeCardsOnly();"
          class="absolute right-2.5 text-stone-400 hover:text-stone-700 text-xs font-bold">✕</button>
      </div>

      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        ${['ALL', 'Signature', 'Coffee', 'Non-Coffee', 'Matcha & Tea', 'Mocktail', 'Seasonal'].map(cat => `
          <button onclick="STATE.recipeCatFilter='${cat}'; renderCurrentTab();"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${STATE.recipeCatFilter === cat ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}">
            ${cat === 'ALL' ? 'Semua' : cat}
          </button>
        `).join('')}
      </div>
    </section>

    <div id="recipeCardsContainer">
      ${buildRecipeCardsHtml()}
    </div>
  `;
}

function openRecipeModal(editRecipeId = null) {
  const existing = editRecipeId ? STATE.recipes.map(normalizeRecipe).find(x => String(x.id) === String(editRecipeId)) : null;
  window._recipeDraftItems = existing ? existing.items.map(i => ({ ...i })) : [];

  window._acCallbacks['rcpAc'] = (ing) => {
    const qtyEl = document.getElementById('rcpIngQty');
    if (qtyEl) {
      qtyEl.placeholder = `Takaran (${ing.unit})`;
      qtyEl.focus();
    }
  };

  openModal(existing ? 'Edit Resep & HPP' : '+ Tambah Resep & Hitung HPP', `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Nama Menu Minuman</label>
        <input id="rcpName" type="text" value="${escHtml(existing ? existing.name : '')}" placeholder="Contoh: Ube Matcha Latte"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Kategori Menu</label>
          <select id="rcpCategory" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white">
            ${['Signature', 'Coffee', 'Non-Coffee', 'Matcha & Tea', 'Mocktail', 'Seasonal'].map(c =>
              `<option value="${c}" ${(existing && existing.category === c) ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Harga Jual (Rp)</label>
          <input id="rcpSellPrice" type="number" value="${existing ? (existing.sellingPrice || '') : ''}" placeholder="28000"
            oninput="recalcRecipeModalSummary()"
            class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold" />
        </div>
      </div>

      <div class="p-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
        <p class="text-[11px] font-bold text-stone-800">Tambah Komposisi Bahan Baku (Pencarian Cepat)</p>
        ${renderIngAutocompleteHtml('rcpAc', '', 'Ketik nama bahan (misal: ube, matcha, milk)...')}
        <div class="flex gap-2">
          <input id="rcpIngQty" type="number" step="any" placeholder="Takaran (gram / ml / pcs)"
            class="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-white" />
          <button type="button" onclick="addIngredientToRecipeDraft()" class="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-bold shrink-0">
            + Tambah
          </button>
        </div>
      </div>

      <div id="rcpItemsContainer" class="space-y-1.5 max-h-44 overflow-y-auto"></div>

      <div id="rcpSummaryBox" class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1"></div>

      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Catatan / SOP Penyajian (Opsional)</label>
        <input id="rcpNotes" type="text" value="${escHtml(existing ? existing.notes : '')}" placeholder="Contoh: Es batu 150gr, garnish marshmallow"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>

      <button onclick="submitRecipeForm('${existing ? escHtml(existing.id) : ''}')"
        class="w-full py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs active:scale-95">
        💾 Simpan Resep &amp; HPP
      </button>
    </div>
  `);

  renderRecipeDraftList();
}

function addIngredientToRecipeDraft() {
  const ingId = document.getElementById('rcpAc_val')?.value;
  const qty = Number(document.getElementById('rcpIngQty')?.value) || 0;
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  if (!ing || qty <= 0) {
    showToast('Pilih bahan dari pencarian dan isi takaran > 0');
    return;
  }
  const existingIdx = window._recipeDraftItems.findIndex(x => String(x.ingId) === String(ing.id));
  if (existingIdx >= 0) {
    window._recipeDraftItems[existingIdx].qty += qty;
  } else {
    window._recipeDraftItems.push({
      ingId: ing.id,
      name: ing.name,
      unit: ing.unit,
      unitCost: Number(ing.unitCost) || 0,
      qty
    });
  }
  const qtyInput = document.getElementById('rcpIngQty');
  if (qtyInput) qtyInput.value = '';
  clearIngAutocomplete('rcpAc');
  renderRecipeDraftList();
}

function removeIngredientFromRecipeDraft(idx) {
  window._recipeDraftItems.splice(idx, 1);
  renderRecipeDraftList();
}

function renderRecipeDraftList() {
  const box = document.getElementById('rcpItemsContainer');
  if (!box) return;
  if (window._recipeDraftItems.length === 0) {
    box.innerHTML = `<p class="text-[11px] text-stone-400 text-center py-2">Belum ada bahan ditambahkan ke resep ini.</p>`;
  } else {
    box.innerHTML = window._recipeDraftItems.map((it, idx) => `
      <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-[11px]">
        <div class="min-w-0 flex-1">
          <p class="font-bold text-stone-800 truncate">${escHtml(it.name)}</p>
          <p class="text-[10px] text-stone-500">${formatNum(it.qty)} ${escHtml(it.unit)} × ${formatRp(it.unitCost)}</p>
        </div>
        <span class="font-bold text-stone-900 shrink-0">${formatRp(it.qty * it.unitCost)}</span>
        <button type="button" onclick="removeIngredientFromRecipeDraft(${idx})" class="w-6 h-6 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">✕</button>
      </div>
    `).join('');
  }
  recalcRecipeModalSummary();
}

function recalcRecipeModalSummary() {
  const sumBox = document.getElementById('rcpSummaryBox');
  if (!sumBox) return;
  const sellPrice = Number(document.getElementById('rcpSellPrice')?.value) || 0;
  const totalHpp = window._recipeDraftItems.reduce((s, it) => s + (it.qty * it.unitCost), 0);
  const profit = sellPrice - totalHpp;
  const marginPct = sellPrice > 0 ? ((profit / sellPrice) * 100) : 0;
  const cogsPct = sellPrice > 0 ? ((totalHpp / sellPrice) * 100) : 0;

  sumBox.innerHTML = `
    <div class="flex justify-between">
      <span class="text-stone-600">Total HPP (COGS):</span>
      <b class="text-stone-900">${formatRp(totalHpp)} (${cogsPct.toFixed(1)}%)</b>
    </div>
    <div class="flex justify-between">
      <span class="text-stone-600">Gross Profit / Cup:</span>
      <b class="${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}">${formatRp(profit)} (Margin ${marginPct.toFixed(1)}%)</b>
    </div>
  `;
}

async function submitRecipeForm(editRecipeId) {
  const name = (document.getElementById('rcpName')?.value || '').trim();
  const category = document.getElementById('rcpCategory')?.value || 'Signature';
  const sellingPrice = Number(document.getElementById('rcpSellPrice')?.value) || 0;
  const notes = (document.getElementById('rcpNotes')?.value || '').trim();
  const hpp = window._recipeDraftItems.reduce((s, it) => s + (it.qty * it.unitCost), 0);
  const margin = sellingPrice > 0 ? Number((((sellingPrice - hpp) / sellingPrice) * 100).toFixed(2)) : 0;

  if (!name || window._recipeDraftItems.length === 0) {
    showToast('Nama menu & minimal 1 bahan wajib diisi');
    return;
  }
  closeModal();

  await postToBackend({
    action: 'saveRecipe',
    recipe: {
      id: editRecipeId || ('rcp_' + Date.now()),
      name,
      category,
      sellingPrice,
      ingredients: window._recipeDraftItems,
      hpp,
      margin,
      notes
    }
  }, `Resep ${name} (HPP ${formatRp(hpp)}) tersimpan!`);
}

async function deleteRecipeAction(recipeId) {
  await postToBackend({ action: 'deleteRecipe', recipeId }, 'Resep dihapus');
}
