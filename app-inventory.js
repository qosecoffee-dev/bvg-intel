// ==================== DAILY & MONTHLY INVENTORY TAB ====================
function setDailyDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const maxDay = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(day)), maxDay);
  STATE.selectedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  renderCurrentTab();
}

function setMonthlyPeriodParts(year, month) {
  const [, , dStr] = STATE.selectedDate.split('-');
  setDailyDateParts(year, month, dStr || '01');
}

function countDailyDraftsForDate(dateStr) {
  const prefix = `${dateStr}__`;
  return Object.keys(STATE.draftDaily).filter(k => k.startsWith(prefix)).length;
}

function updateDailyDirtyBadge() {
  const el = document.getElementById('dailyDirtyBadge');
  if (!el) return;
  const cnt = countDailyDraftsForDate(STATE.selectedDate);
  if (cnt > 0) {
    el.textContent = `${cnt} item diubah (belum disimpan)`;
    el.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900';
  } else {
    el.textContent = 'Semua tersinkron';
    el.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
  }
}

function onDailyCellInput(ingId, field, rawVal) {
  const dateStr = STATE.selectedDate;
  const current = getDailyRecord(dateStr, ingId);
  const numVal = rawVal === '' ? 0 : (Number(rawVal) || 0);

  const updated = {
    inQty: field === 'inQty' ? numVal : current.inQty,
    outQty: field === 'outQty' ? numVal : current.outQty,
    wasteQty: field === 'wasteQty' ? numVal : current.wasteQty
  };

  STATE.draftDaily[`${dateStr}__${ingId}`] = updated;

  const cl = updated.inQty - updated.outQty - updated.wasteQty;
  const clEl = document.getElementById(`dailyCl_${ingId}`);
  if (clEl) {
    clEl.textContent = formatNum(cl);
    clEl.className = `w-full px-2 py-1.5 rounded-xl border text-xs font-extrabold text-right ${
      cl < 0
        ? 'bg-rose-50 border-rose-300 text-rose-700'
        : 'bg-stone-100 border-stone-200 text-stone-900'
    }`;
  }
  updateDailyDirtyBadge();
}

function buildDailyListHtml() {
  const dateStr = STATE.selectedDate;
  const sorted = getSortedIngredients();
  const q = String(STATE.dailySearch || '').trim().toLowerCase();

  const filtered = sorted.filter(ing => {
    const matchCat = STATE.dailyCatFilter === 'ALL' || ing.subCategory === STATE.dailyCatFilter;
    const matchQ = !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (filtered.length === 0) {
    return `
      <div class="bg-white p-8 rounded-2xl text-center border border-stone-200 text-xs text-stone-500">
        Tidak ada bahan baku yang cocok dengan filter pencarian.
      </div>
    `;
  }

  return filtered.map((ing, idx) => {
    const rec = getDailyRecord(dateStr, ing.id);
    const isNeg = rec.clQty < 0;
    const hasActivity = rec.inQty > 0 || rec.outQty > 0 || rec.wasteQty > 0 || rec.isDirty;

    return `
      <div class="bg-white p-3 rounded-2xl shadow-sm border ${rec.isDirty ? 'border-amber-400' : 'border-stone-200'}">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold text-stone-400">#${idx + 1}</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-bold">${escHtml(ing.subCategory)}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">${escHtml(ing.unit)}</span>
            </div>
            <h3 class="text-xs font-extrabold text-stone-900 mt-1">${escHtml(ing.name)}</h3>
          </div>
          ${rec.picName ? `
            <span class="text-[9px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-semibold shrink-0">
              👤 ${escHtml(rec.picName)}
            </span>
          ` : ''}
        </div>

        <div class="grid grid-cols-4 gap-1.5">
          <div>
            <label class="block text-[9px] font-extrabold text-emerald-700 uppercase mb-0.5">IN (+)</label>
            <input type="number" step="any" inputmode="decimal"
              value="${hasActivity && rec.inQty !== 0 ? rec.inQty : ''}" placeholder="0"
              oninput="onDailyCellInput('${escHtml(ing.id)}', 'inQty', this.value)"
              class="w-full px-2 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/40 text-xs font-bold text-right text-stone-900 focus:border-emerald-600 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[9px] font-extrabold text-amber-800 uppercase mb-0.5">OUT (-)</label>
            <input type="number" step="any" inputmode="decimal"
              value="${hasActivity && rec.outQty !== 0 ? rec.outQty : ''}" placeholder="0"
              oninput="onDailyCellInput('${escHtml(ing.id)}', 'outQty', this.value)"
              class="w-full px-2 py-1.5 rounded-xl border border-amber-300 bg-amber-50/40 text-xs font-bold text-right text-stone-900 focus:border-amber-600 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[9px] font-extrabold text-rose-700 uppercase mb-0.5">WASTE (-)</label>
            <input type="number" step="any" inputmode="decimal"
              value="${hasActivity && rec.wasteQty !== 0 ? rec.wasteQty : ''}" placeholder="0"
              oninput="onDailyCellInput('${escHtml(ing.id)}', 'wasteQty', this.value)"
              class="w-full px-2 py-1.5 rounded-xl border border-rose-300 bg-rose-50/50 text-xs font-bold text-right text-rose-900 focus:border-rose-600 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[9px] font-extrabold text-stone-500 uppercase mb-0.5 text-right">CL (Sisa)</label>
            <div id="dailyCl_${escHtml(ing.id)}"
              class="w-full px-2 py-1.5 rounded-xl border text-xs font-extrabold text-right ${
                isNeg
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-stone-100 border-stone-200 text-stone-900'
              }">
              ${formatNum(rec.clQty)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateDailyListOnly() {
  const el = document.getElementById('dailyListContainer');
  if (el) el.innerHTML = buildDailyListHtml();
}

function renderDailyTab(main) {
  const [yStr, mStr, dStr] = STATE.selectedDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dirtyCount = countDailyDraftsForDate(STATE.selectedDate);

  // Cari PIC terakhir yang menginput pada tanggal ini
  const dayLogs = STATE.invDaily.filter(r => String(r.date) === STATE.selectedDate && r.picName);
  const lastDayLog = dayLogs.length > 0
    ? [...dayLogs].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
    : null;

  main.innerHTML = `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-extrabold text-stone-900">📋 Daily Inventory Bar</h2>
          <p class="text-[11px] text-stone-500">Rumus: <b>CL = IN - OUT - WASTE</b></p>
        </div>
        <span id="dailyDirtyBadge" class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
          dirtyCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
        }">
          ${dirtyCount > 0 ? `${dirtyCount} item diubah (belum disimpan)` : 'Semua tersinkron'}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-1.5">
        <select onchange="setDailyDateParts('${yStr}', '${mStr}', this.value)"
          class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
            const val = String(d).padStart(2, '0');
            return `<option value="${val}" ${val === dStr ? 'selected' : ''}>Tgl ${d}</option>`;
          }).join('')}
        </select>
        <select onchange="setDailyDateParts('${yStr}', this.value, '${dStr}')"
          class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${months.map((lbl, idx) => {
            const val = String(idx + 1).padStart(2, '0');
            return `<option value="${val}" ${val === mStr ? 'selected' : ''}>${lbl}</option>`;
          }).join('')}
        </select>
        <select onchange="setDailyDateParts(this.value, '${mStr}', '${dStr}')"
          class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${[2025, 2026, 2027, 2028].map(yr =>
            `<option value="${yr}" ${String(yr) === yStr ? 'selected' : ''}>${yr}</option>`
          ).join('')}
        </select>
      </div>

      ${lastDayLog ? `
        <div class="px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-[10px] text-stone-600">
          <span>Terakhir diinput oleh: <b class="text-stone-900">${escHtml(lastDayLog.picName)}</b></span>
          <span>${escHtml(lastDayLog.updatedAt || STATE.selectedDate)}</span>
        </div>
      ` : ''}

      <div class="relative flex items-center">
        <input id="dailySearchInput" type="text" value="${escHtml(STATE.dailySearch)}"
          oninput="STATE.dailySearch=this.value; updateDailyListOnly();"
          placeholder="Cari nama bahan baku..."
          class="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white text-xs focus:border-amber-600 focus:outline-none" />
        <button type="button" onclick="STATE.dailySearch=''; const el=document.getElementById('dailySearchInput'); if(el) el.value=''; updateDailyListOnly();"
          class="absolute right-2.5 text-stone-400 text-xs font-bold">✕</button>
      </div>

      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        ${['ALL', ...SUB_CATEGORIES].map(cat => `
          <button onclick="STATE.dailyCatFilter='${cat}'; renderCurrentTab();"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
              STATE.dailyCatFilter === cat ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }">
            ${cat === 'ALL' ? 'Semua' : cat}
          </button>
        `).join('')}
      </div>

      <button onclick="downloadDailyPdf()" class="w-full py-2 rounded-xl bg-stone-900 text-white text-xs font-bold active:scale-95">
        📄 Download PDF Harian (${dStr}/${mStr}/${yStr})
      </button>
    </section>

    <section id="dailyListContainer" class="space-y-2 mb-3">
      ${buildDailyListHtml()}
    </section>

    <!-- Verifikasi PIC + PIN & Simpan Daily Inventory -->
    <section class="bg-white p-3.5 rounded-2xl shadow-md border border-stone-200 space-y-2.5 mb-2">
      ${renderPicPinBoxHtml('dailyAuth', 'PIC Penginput Daily Inventory')}
      <button onclick="submitDailyInventoryBatch()"
        class="w-full py-3 rounded-2xl bg-amber-600 text-white font-extrabold text-xs shadow-md active:scale-95">
        💾 Simpan Data Harian (${STATE.selectedDate})
      </button>
    </section>
  `;
}

async function submitDailyInventoryBatch() {
  const auth = getPicPinValues('dailyAuth');
  if (!auth) return;

  const dateStr = STATE.selectedDate;
  const sorted = getSortedIngredients();
  const entries = [];

  sorted.forEach(ing => {
    const draftKey = `${dateStr}__${ing.id}`;
    const saved = STATE.invDaily.find(r => String(r.date) === dateStr && String(r.ingId) === String(ing.id));
    const draft = STATE.draftDaily[draftKey];

    if (draft || saved) {
      const rec = getDailyRecord(dateStr, ing.id);
      entries.push({
        ingId: ing.id,
        ingName: ing.name,
        subCategory: ing.subCategory,
        unit: ing.unit,
        inQty: rec.inQty,
        outQty: rec.outQty,
        wasteQty: rec.wasteQty
      });
    }
  });

  if (entries.length === 0) {
    showToast('Belum ada angka IN / OUT / WASTE yang diisi pada tanggal ini.');
    return;
  }

  const ok = await postToBackend({
    action: 'saveDailyBatch',
    date: dateStr,
    picName: auth.picName,
    pin: auth.pin,
    entries
  }, `Data harian ${dateStr} disimpan oleh ${auth.picName}!`);

  if (ok) {
    const prefix = `${dateStr}__`;
    Object.keys(STATE.draftDaily).forEach(k => {
      if (k.startsWith(prefix)) delete STATE.draftDaily[k];
    });
    renderCurrentTab();
  }
}

// ==================== MONTHLY REKAP & STOCK OPNAME TAB ====================
function onMonthlySoInput(ingId, rawVal) {
  const mKey = STATE.selectedDate.slice(0, 7);
  STATE.draftMonthly[`${mKey}__${ingId}`] = {
    soQty: rawVal === '' ? '' : (Number(rawVal) || 0)
  };

  const summaryMap = getMonthlySummaryMap(mKey);
  const s = summaryMap[ingId];
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  const unitCost = getIngUnitCost(ing);
  const hasSo = rawVal !== '' && rawVal !== null && rawVal !== undefined;
  const soNum = hasSo ? (Number(rawVal) || 0) : 0;
  const selisih = hasSo ? (soNum - (s ? s.totalCl : 0)) : 0;
  const valSo = hasSo ? (soNum * unitCost) : 0;

  const selEl = document.getElementById(`monthlySelisih_${ingId}`);
  if (selEl) {
    selEl.textContent = hasSo ? formatNum(selisih) : '-';
    selEl.className = `font-extrabold ${
      !hasSo ? 'text-stone-400' : (selisih < 0 ? 'text-rose-600' : (selisih > 0 ? 'text-amber-700' : 'text-emerald-700'))
    }`;
  }

  const valEl = document.getElementById(`monthlyValSo_${ingId}`);
  if (valEl) {
    valEl.textContent = hasSo ? formatRp(valSo) : 'Rp 0';
  }

  // Update Grand Total Value SO
  let grandTotal = 0;
  STATE.ingredients.forEach(item => {
    const itemSum = summaryMap[item.id];
    if (itemSum) grandTotal += itemSum.valueSo;
  });

  const grandEl = document.getElementById('monthlyGrandValSo');
  const hintEl = document.getElementById('monthlyLimitHint');
  const isOver = grandTotal > 20000000;
  if (grandEl) {
    grandEl.textContent = formatRp(grandTotal);
    grandEl.className = `text-base font-extrabold ${isOver ? 'text-rose-600' : 'text-emerald-700'}`;
  }
  if (hintEl) {
    hintEl.textContent = isOver
      ? '⚠️ Melebihi batas maksimal acuan Rp 20.000.000'
      : '✓ Aman di bawah batas maksimal Rp 20.000.000';
    hintEl.className = `text-[10px] font-bold ${isOver ? 'text-rose-600' : 'text-emerald-700'}`;
  }
}

function buildMonthlyListHtml() {
  const mKey = STATE.selectedDate.slice(0, 7);
  const sorted = getSortedIngredients();
  const summaryMap = getMonthlySummaryMap(mKey);
  const q = String(STATE.monthlySearch || '').trim().toLowerCase();

  const filtered = sorted.filter(ing => {
    const matchCat = STATE.monthlyCatFilter === 'ALL' || ing.subCategory === STATE.monthlyCatFilter;
    const matchQ = !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (filtered.length === 0) {
    return `
      <div class="bg-white p-8 rounded-2xl text-center border border-stone-200 text-xs text-stone-500">
        Tidak ada bahan baku yang cocok dengan pencarian.
      </div>
    `;
  }

  return filtered.map((ing, idx) => {
    const s = summaryMap[ing.id] || {
      totalIn: 0, totalOut: 0, totalWaste: 0, totalCl: 0,
      soQty: '', selisih: 0, pemakaianBar: 0, wasteCost: 0, valueSo: 0, picName: ''
    };
    const draft = STATE.draftMonthly[`${mKey}__${ing.id}`];
    const activeSo = draft && draft.soQty !== undefined ? draft.soQty : s.soQty;
    const hasSo = activeSo !== '' && activeSo !== null && activeSo !== undefined;

    return `
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border ${draft ? 'border-amber-400' : 'border-stone-200'} space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold text-stone-400">#${idx + 1}</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-bold">${escHtml(ing.subCategory)}</span>
              <span class="text-[10px] text-stone-400 font-semibold">${escHtml(ing.unit)}</span>
            </div>
            <h3 class="text-xs font-extrabold text-stone-900 mt-1">${escHtml(ing.name)}</h3>
          </div>
          <div class="w-24 shrink-0">
            <label class="block text-[9px] font-extrabold text-amber-800 uppercase text-right mb-0.5">SO Fisik (${escHtml(ing.unit)})</label>
            <input type="number" step="any" inputmode="decimal"
              value="${hasSo ? activeSo : ''}" placeholder="-"
              oninput="onMonthlySoInput('${escHtml(ing.id)}', this.value)"
              class="w-full px-2 py-1.5 rounded-xl border border-amber-400 bg-amber-50/50 text-xs font-extrabold text-right text-stone-900 focus:border-amber-600 focus:outline-none" />
          </div>
        </div>

        <!-- Baris 1: Total IN, OUT, Waste, CL -->
        <div class="grid grid-cols-4 gap-1.5 pt-2 border-t border-stone-100 text-[11px]">
          <div class="px-2 py-1 rounded-lg bg-emerald-50/60">
            <span class="text-[9px] text-emerald-800 block font-bold">Total IN</span>
            <b class="text-stone-900">${formatNum(s.totalIn)}</b>
          </div>
          <div class="px-2 py-1 rounded-lg bg-amber-50/60">
            <span class="text-[9px] text-amber-800 block font-bold">Total OUT</span>
            <b class="text-stone-900">${formatNum(s.totalOut)}</b>
          </div>
          <div class="px-2 py-1 rounded-lg bg-rose-50/70">
            <span class="text-[9px] text-rose-800 block font-bold">Total Waste</span>
            <b class="text-rose-700">${formatNum(s.totalWaste)}</b>
          </div>
          <div class="px-2 py-1 rounded-lg bg-stone-100">
            <span class="text-[9px] text-stone-600 block font-bold">Total CL</span>
            <b class="text-stone-900">${formatNum(s.totalCl)}</b>
          </div>
        </div>

        <!-- Baris 2: Selisih, Pemakaian Bar, Waste (Rp), Value SO -->
        <div class="grid grid-cols-2 gap-1.5 text-[11px]">
          <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-100">
            <span class="text-[10px] text-stone-500">Selisih (SO-CL):</span>
            <b id="monthlySelisih_${escHtml(ing.id)}" class="font-extrabold ${
              !hasSo ? 'text-stone-400' : (s.selisih < 0 ? 'text-rose-600' : (s.selisih > 0 ? 'text-amber-700' : 'text-emerald-700'))
            }">
              ${hasSo ? formatNum(s.selisih) : '-'}
            </b>
          </div>
          <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-100">
            <span class="text-[10px] text-stone-500">Value SO:</span>
            <b id="monthlyValSo_${escHtml(ing.id)}" class="text-stone-900">${formatRp(s.valueSo)}</b>
          </div>
          <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50/50 border border-amber-100">
            <span class="text-[10px] text-amber-900">Pemakaian:</span>
            <b class="text-amber-900">${formatRp(s.pemakaianBar)}</b>
          </div>
          <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-50/50 border border-rose-100">
            <span class="text-[10px] text-rose-900">Waste (Rp):</span>
            <b class="text-rose-700">${formatRp(s.wasteCost)}</b>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateMonthlyListOnly() {
  const el = document.getElementById('monthlyListContainer');
  if (el) el.innerHTML = buildMonthlyListHtml();
}

function renderMonthlyTab(main) {
  const [yStr, mStr] = STATE.selectedDate.split('-');
  const mKey = `${yStr}-${mStr}`;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const summaryMap = getMonthlySummaryMap(mKey);

  let grandValueSo = 0;
  let grandPemakaian = 0;
  let grandWasteRp = 0;
  Object.values(summaryMap).forEach(s => {
    grandValueSo += s.valueSo;
    grandPemakaian += s.pemakaianBar;
    grandWasteRp += s.wasteCost;
  });

  const isOver = grandValueSo > 20000000;

  // Cek PIC terakhir yang menyimpan SO bulan ini
  const monthLogs = STATE.invMonthly.filter(m => String(m.monthKey) === mKey && m.picName);
  const lastSoLog = monthLogs.length > 0
    ? [...monthLogs].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
    : null;

  main.innerHTML = `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-extrabold text-stone-900">📊 Rekap Bulanan &amp; Stock Opname</h2>
          <p class="text-[11px] text-stone-500">Akumulasi IN, OUT, Waste &amp; Valuasi Stok Fisik</p>
        </div>
        <button onclick="downloadMonthlyPdf()" class="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold shrink-0 active:scale-95">
          📄 PDF Lengkap
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <select onchange="setMonthlyPeriodParts('${yStr}', this.value)"
          class="px-2.5 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${months.map((lbl, idx) => {
            const val = String(idx + 1).padStart(2, '0');
            return `<option value="${val}" ${val === mStr ? 'selected' : ''}>Bulan: ${lbl}</option>`;
          }).join('')}
        </select>
        <select onchange="setMonthlyPeriodParts(this.value, '${mStr}')"
          class="px-2.5 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
          ${[2025, 2026, 2027, 2028].map(yr =>
            `<option value="${yr}" ${String(yr) === yStr ? 'selected' : ''}>Tahun: ${yr}</option>`
          ).join('')}
        </select>
      </div>

      <!-- Ringkasan Rupiah Bulanan -->
      <div class="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-stone-600">Total Value Stok Fisik (SO):</span>
          <span id="monthlyGrandValSo" class="text-base font-extrabold ${isOver ? 'text-rose-600' : 'text-emerald-700'}">
            ${formatRp(grandValueSo)}
          </span>
        </div>
        <p id="monthlyLimitHint" class="text-[10px] font-bold ${isOver ? 'text-rose-600' : 'text-emerald-700'}">
          ${isOver ? '⚠️ Melebihi batas maksimal acuan Rp 20.000.000' : '✓ Aman di bawah batas maksimal Rp 20.000.000'}
        </p>
        <div class="grid grid-cols-2 gap-2 pt-1.5 border-t border-stone-200 text-[11px]">
          <div>
            <span class="text-[10px] text-stone-500 block">Total Pemakaian Bar</span>
            <b class="text-amber-900">${formatRp(grandPemakaian)}</b>
          </div>
          <div>
            <span class="text-[10px] text-stone-500 block">Total Waste Bar</span>
            <b class="text-rose-700">${formatRp(grandWasteRp)}</b>
          </div>
        </div>
      </div>

      ${lastSoLog ? `
        <div class="px-2.5 py-1.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-[10px] text-amber-950">
          <span>SO terakhir disimpan oleh: <b>${escHtml(lastSoLog.picName)}</b></span>
          <span>${escHtml(lastSoLog.updatedAt || mKey)}</span>
        </div>
      ` : ''}

      <div class="relative flex items-center">
        <input id="monthlySearchInput" type="text" value="${escHtml(STATE.monthlySearch)}"
          oninput="STATE.monthlySearch=this.value; updateMonthlyListOnly();"
          placeholder="Cari nama bahan baku..."
          class="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white text-xs focus:border-amber-600 focus:outline-none" />
        <button type="button" onclick="STATE.monthlySearch=''; const el=document.getElementById('monthlySearchInput'); if(el) el.value=''; updateMonthlyListOnly();"
          class="absolute right-2.5 text-stone-400 text-xs font-bold">✕</button>
      </div>

      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        ${['ALL', ...SUB_CATEGORIES].map(cat => `
          <button onclick="STATE.monthlyCatFilter='${cat}'; renderCurrentTab();"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
              STATE.monthlyCatFilter === cat ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }">
            ${cat === 'ALL' ? 'Semua' : cat}
          </button>
        `).join('')}
      </div>
    </section>

    <section id="monthlyListContainer" class="space-y-2.5 mb-3">
      ${buildMonthlyListHtml()}
    </section>

    <!-- Verifikasi PIC + PIN & Simpan Stock Opname -->
    <section class="bg-white p-3.5 rounded-2xl shadow-md border border-stone-200 space-y-2.5 mb-2">
      ${renderPicPinBoxHtml('monthlyAuth', 'PIC Penginput Stock Opname (SO)')}
      <button onclick="submitMonthlyAuditBatch()"
        class="w-full py-3 rounded-2xl bg-stone-900 text-white font-extrabold text-xs shadow-md active:scale-95">
        💾 Simpan Stock Opname (${mKey})
      </button>
    </section>
  `;
}

async function submitMonthlyAuditBatch() {
  const auth = getPicPinValues('monthlyAuth');
  if (!auth) return;

  const mKey = STATE.selectedDate.slice(0, 7);
  const summaryMap = getMonthlySummaryMap(mKey);
  const entries = [];

  STATE.ingredients.forEach(ing => {
    const s = summaryMap[ing.id] || { soQty: '', pemakaianBar: 0 };
    const draft = STATE.draftMonthly[`${mKey}__${ing.id}`];
    const finalSo = draft && draft.soQty !== undefined ? draft.soQty : s.soQty;

    if (draft !== undefined || (finalSo !== '' && finalSo !== null && finalSo !== undefined) || s.pemakaianBar > 0) {
      entries.push({
        ingId: ing.id,
        soQty: finalSo === '' ? '' : Number(finalSo),
        pemakaianBar: Number(s.pemakaianBar) || 0
      });
    }
  });

  const ok = await postToBackend({
    action: 'saveMonthlyAudit',
    monthKey: mKey,
    picName: auth.picName,
    pin: auth.pin,
    entries
  }, `Stock Opname ${mKey} disimpan oleh ${auth.picName}!`);

  if (ok) {
    const prefix = `${mKey}__`;
    Object.keys(STATE.draftMonthly).forEach(k => {
      if (k.startsWith(prefix)) delete STATE.draftMonthly[k];
    });
    renderCurrentTab();
  }
}
