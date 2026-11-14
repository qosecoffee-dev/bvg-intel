const SUB_CATEGORIES = [
  'Powder', 'Sirup', 'Mocktail', 'Mixtura', 'Milk', 'Beer',
  'Beans', 'Artisan Tea', 'Cup', 'Other Topping', 'Other Base',
  'Spice', 'Frozen Fruit', 'Frozen Fruit Prep', 'Ice Cream',
  'Tier 1', 'Tier 2', 'Preparation'
];

const _nowInit = new Date();
const STATE = {
  apiUrl: '',
  activeTab: 'home',
  poSubTab: 'po',
  masterSubTab: 'ingredients',
  selectedDate: _nowInit.toISOString().slice(0, 10),
  parSearch: '',
  dailySearch: '',
  dailyCatFilter: 'ALL',
  masterSearch: '',
  masterEditMode: false,
  recipeSearch: '',
  recipeCatFilter: 'ALL',
  poDate: _nowInit.toISOString().slice(0, 10),
  vendorSearch: '',
  menuEngMonth: String(_nowInit.getMonth() + 1).padStart(2, '0'),
  menuEngYear: String(_nowInit.getFullYear()),
  ingredients: [],
  recipes: [],
  invDaily: [],
  invMonthly: [],
  purchaseOrders: [],
  vendors: [],
  draftDaily: {},
  draftMonthly: {},
  draftPar: {},
  isSyncing: false,
  lastSyncInfo: null
};

function detectSavedApiUrl() {
  const direct = localStorage.getItem('bvg_intel_api_url');
  if (direct && direct.startsWith('https://script.google.com/')) return direct;
  for (let i = 0; i < localStorage.length; i++) {
    const val = localStorage.getItem(localStorage.key(i)) || '';
    if (val.startsWith('https://script.google.com/macros/s/')) {
      localStorage.setItem('bvg_intel_api_url', val);
      return val;
    }
  }
  return '';
}

function loadLastSyncInfo() {
  try {
    const raw = JSON.parse(localStorage.getItem('bvg_intel_last_sync') || 'null');
    if (raw && raw.timestamp) STATE.lastSyncInfo = raw;
  } catch (e) {}
}

function recordSyncInfo(success) {
  STATE.lastSyncInfo = {
    success: !!success,
    timestamp: new Date().toISOString()
  };
  try {
    localStorage.setItem('bvg_intel_last_sync', JSON.stringify(STATE.lastSyncInfo));
  } catch (e) {}
}

function formatSyncTimestamp(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '-';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tgl = String(d.getDate()).padStart(2, '0');
  const bln = bulan[d.getMonth()];
  const thn = d.getFullYear();
  const jam = String(d.getHours()).padStart(2, '0');
  const mnt = String(d.getMinutes()).padStart(2, '0');
  const dtk = String(d.getSeconds()).padStart(2, '0');
  return `${tgl} ${bln} ${thn} • Pukul ${jam}:${mnt}:${dtk}`;
}

function formatRp(num) {
  const n = Math.round(Number(num) || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatNum(num) {
  const n = Number(num) || 0;
  return Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function showToast(msg) {
  const el = document.getElementById('toastBox');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const ov = document.getElementById('modalOverlay');
  ov.classList.remove('hidden');
  ov.classList.add('flex');
}

function closeModal() {
  const ov = document.getElementById('modalOverlay');
  ov.classList.add('hidden');
  ov.classList.remove('flex');
}

function normalizeIngredient(raw, idx) {
  const id = String(raw.id || raw.ID || ('ing_' + idx));
  const name = String(raw.name || raw['Nama Bahan'] || '').trim();
  const subCatRaw = String(raw.subCategory || raw.category || raw['Kategori'] || 'Other Base').trim();
  const matchedCat = SUB_CATEGORIES.find(c => c.toLowerCase() === subCatRaw.toLowerCase()) || subCatRaw || 'Other Base';
  const price = Number(raw.price !== '' && raw.price !== undefined ? raw.price : (raw['Harga Beli'] || 0)) || 0;
  const packSize = Number(raw.packSize !== '' && raw.packSize !== undefined ? raw.packSize : (raw['Ukuran'] || 1)) || 1;
  const unit = String(raw.unit || raw['Satuan'] || 'gram').trim();
  let unitCost = Number(raw.unitCost !== '' && raw.unitCost !== undefined ? raw.unitCost : (raw['Unit Cost'] || 0)) || 0;
  if (!unitCost && price > 0 && packSize > 0) unitCost = price / packSize;
  const sortOrder = (raw.sortOrder !== '' && raw.sortOrder !== undefined && !isNaN(Number(raw.sortOrder)))
    ? Number(raw.sortOrder) : (idx + 1);
  const minStock = Number(raw.minStock || 0) || 0;

  return {
    ...raw,
    id, ID: id,
    name, 'Nama Bahan': name,
    category: matchedCat, 'Kategori': matchedCat,
    subCategory: matchedCat,
    price, 'Harga Beli': price,
    packSize, 'Ukuran': packSize,
    unit, 'Satuan': unit,
    unitCost, 'Unit Cost': unitCost,
    sortOrder,
    minStock
  };
}

function getSortedIngredients() {
  return [...STATE.ingredients].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const catA = SUB_CATEGORIES.indexOf(a.subCategory);
    const catB = SUB_CATEGORIES.indexOf(b.subCategory);
    if (catA !== catB) return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB);
    return a.name.localeCompare(b.name);
  });
}

// ==================== REUSABLE FAST INGREDIENT AUTOCOMPLETE (iOS KEYBOARD SAFE) ====================
window._acCallbacks = {};

function renderIngAutocompleteHtml(prefix, selectedIngId = '', placeholder = 'Ketik nama bahan baku...') {
  const sorted = getSortedIngredients();
  const sel = selectedIngId ? sorted.find(x => String(x.id) === String(selectedIngId)) : null;
  const displayVal = sel ? `${sel.name} (${formatRp(sel.unitCost)}/${sel.unit})` : '';

  return `
    <div class="relative" id="${prefix}_wrapper">
      <input type="hidden" id="${prefix}_val" value="${escHtml(sel ? sel.id : '')}" />
      <div class="relative flex items-center">
        <input
          type="text"
          id="${prefix}_input"
          value="${escHtml(displayVal)}"
          placeholder="${escHtml(placeholder)}"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          onfocus="openIngAutocomplete('${prefix}')"
          oninput="filterIngAutocomplete('${prefix}', this.value)"
          class="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-300 text-xs bg-white font-semibold focus:border-amber-600 focus:outline-none"
        />
        <button type="button" onclick="clearIngAutocomplete('${prefix}')"
          class="absolute right-2 w-5 h-5 rounded-full bg-stone-200 text-stone-600 text-[10px] font-bold flex items-center justify-center">
          ✕
        </button>
      </div>
      <div id="${prefix}_list" class="hidden mt-1 max-h-48 overflow-y-auto rounded-xl border border-stone-300 bg-white shadow-lg divide-y divide-stone-100 z-30"></div>
    </div>
  `;
}

function openIngAutocomplete(prefix) {
  const input = document.getElementById(prefix + '_input');
  const hidden = document.getElementById(prefix + '_val');
  const q = (hidden && hidden.value) ? '' : (input ? input.value : '');
  filterIngAutocomplete(prefix, q);
}

function clearIngAutocomplete(prefix) {
  const input = document.getElementById(prefix + '_input');
  const hidden = document.getElementById(prefix + '_val');
  if (hidden) hidden.value = '';
  if (input) {
    input.value = '';
    input.focus();
  }
  filterIngAutocomplete(prefix, '');
}

function filterIngAutocomplete(prefix, query) {
  const listEl = document.getElementById(prefix + '_list');
  if (!listEl) return;
  const q = String(query || '').trim().toLowerCase();
  const sorted = getSortedIngredients();
  const matches = q
    ? sorted.filter(ing => ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q))
    : sorted;

  if (matches.length === 0) {
    listEl.innerHTML = `<div class="px-3 py-2.5 text-[11px] text-stone-400 text-center">Bahan tidak ditemukan</div>`;
  } else {
    listEl.innerHTML = matches.slice(0, 60).map(ing => `
      <button type="button" onclick="selectIngAutocomplete('${prefix}', '${escHtml(ing.id)}')"
        class="w-full text-left px-3 py-2 hover:bg-amber-50 active:bg-amber-100 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs font-bold text-stone-800 truncate">${escHtml(ing.name)}</p>
          <p class="text-[10px] text-stone-400">${escHtml(ing.subCategory)} • Satuan: ${escHtml(ing.unit)}</p>
        </div>
        <span class="text-[10px] font-bold text-amber-800 shrink-0">${formatRp(ing.unitCost)}/${escHtml(ing.unit)}</span>
      </button>
    `).join('');
  }
  listEl.classList.remove('hidden');
}

function selectIngAutocomplete(prefix, ingId) {
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  const input = document.getElementById(prefix + '_input');
  const hidden = document.getElementById(prefix + '_val');
  const listEl = document.getElementById(prefix + '_list');
  if (hidden) hidden.value = ing ? ing.id : '';
  if (input && ing) input.value = `${ing.name} (${formatRp(ing.unitCost)}/${ing.unit})`;
  if (listEl) listEl.classList.add('hidden');
  if (typeof window._acCallbacks[prefix] === 'function' && ing) {
    window._acCallbacks[prefix](ing);
  }
}

// ==================== MONTHLY SUMMARY & CALCULATIONS ====================
function getMonthKey(dateStr) {
  return (dateStr || STATE.selectedDate).slice(0, 7);
}

function getMonthlySummaryMap(monthKey) {
  const mKey = monthKey || getMonthKey(STATE.selectedDate);
  const map = {};
  STATE.invMonthly.filter(r => String(r.monthKey) === mKey).forEach(r => {
    map[String(r.ingId)] = { ...r };
  });

  const dailyAgg = {};
  STATE.invDaily.filter(r => String(r.monthKey) === mKey).forEach(r => {
    const id = String(r.ingId);
    if (!dailyAgg[id]) dailyAgg[id] = { totalIn: 0, totalOut: 0 };
    dailyAgg[id].totalIn += Number(r.inQty) || 0;
    dailyAgg[id].totalOut += Number(r.outQty) || 0;
  });

  STATE.ingredients.forEach(ing => {
    const id = String(ing.id);
    const base = map[id] || {};
    const agg = dailyAgg[id] || {
      totalIn: Number(base.totalIn) || 0,
      totalOut: Number(base.totalOut) || 0
    };
    const totalCl = agg.totalIn - agg.totalOut;
    const hasSo = base.soQty !== '' && base.soQty !== null && base.soQty !== undefined;
    const soQty = hasSo ? Number(base.soQty) : '';
    const selisih = hasSo ? (soQty - totalCl) : 0;

    const pemakaianBarRp = agg.totalOut * (Number(ing.unitCost) || 0);
    const valueSo = hasSo ? (soQty * (Number(ing.unitCost) || 0)) : 0;

    map[id] = {
      ingId: id,
      monthKey: mKey,
      totalIn: agg.totalIn,
      totalOut: agg.totalOut,
      totalCl,
      soQty,
      selisih,
      pemakaianBar: pemakaianBarRp,
      valueSo
    };
  });

  return map;
}

function getCurrentStock(ingId) {
  const curMonth = new Date().toISOString().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  if (mMap[String(ingId)]) return Number(mMap[String(ingId)].totalCl) || 0;
  return 0;
}

function getLowStockItems() {
  const curMonth = new Date().toISOString().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  return getSortedIngredients().filter(ing => {
    if (!ing.minStock || ing.minStock <= 0) return false;
    const current = mMap[ing.id] ? mMap[ing.id].totalCl : 0;
    return current <= ing.minStock;
  }).map(ing => ({
    ...ing,
    currentStock: mMap[ing.id] ? mMap[ing.id].totalCl : 0
  }));
}

function saveLocalCache() {
  try {
    localStorage.setItem('bvg_intel_cache_v3', JSON.stringify({
      ingredients: STATE.ingredients,
      recipes: STATE.recipes,
      invDaily: STATE.invDaily,
      invMonthly: STATE.invMonthly,
      purchaseOrders: STATE.purchaseOrders,
      vendors: STATE.vendors
    }));
  } catch (e) {}
}

function loadLocalCache() {
  try {
    const raw = JSON.parse(localStorage.getItem('bvg_intel_cache_v3') || 'null');
    if (!raw) return;
    STATE.ingredients = (raw.ingredients || []).map(normalizeIngredient);
    STATE.recipes = raw.recipes || [];
    STATE.invDaily = raw.invDaily || [];
    STATE.invMonthly = raw.invMonthly || [];
    STATE.purchaseOrders = raw.purchaseOrders || [];
    STATE.vendors = raw.vendors || [];
  } catch (e) {}
}

function applyServerState(data) {
  if (!data || data.status !== 'success') return;
  STATE.ingredients = (data.ingredients || []).map(normalizeIngredient);
  STATE.recipes = data.recipes || [];
  STATE.invDaily = data.invDaily || [];
  STATE.invMonthly = data.invMonthly || [];
  STATE.purchaseOrders = data.purchaseOrders || [];
  STATE.vendors = data.vendors || [];
  saveLocalCache();
}

function updateSyncBadge(statusText, isError) {
  const badge = document.getElementById('syncStatusBadge');
  if (!badge) return;
  badge.textContent = statusText;
  badge.className = isError
    ? 'text-[11px] px-2.5 py-1 rounded-full bg-rose-600/20 text-rose-300 border border-rose-500/40 font-semibold active:scale-95'
    : 'text-[11px] px-2.5 py-1 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-semibold active:scale-95';
}

async function syncAllData(manual = false) {
  if (!STATE.apiUrl) {
    updateSyncBadge('● Set URL', true);
    renderCurrentTab();
    return;
  }
  STATE.isSyncing = true;
  updateSyncBadge('↻ Syncing...', false);
  try {
    const res = await fetch(STATE.apiUrl + '?t=' + Date.now());
    const data = await res.json();
    applyServerState(data);
    recordSyncInfo(true);
    updateSyncBadge('● Synced', false);
    if (manual) showToast('Data tersinkron dengan Google Sheets');
  } catch (err) {
    recordSyncInfo(false);
    updateSyncBadge('● Offline', true);
    if (manual) showToast('Gagal sinkronisasi, cek koneksi');
  } finally {
    STATE.isSyncing = false;
    renderCurrentTab();
  }
}

async function postToBackend(payload, successMsg, silent = false) {
  if (!STATE.apiUrl) {
    if (!silent) openSettingsModal();
    return false;
  }
  updateSyncBadge('↻ Saving...', false);
  try {
    const res = await fetch(STATE.apiUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      applyServerState(data);
      recordSyncInfo(true);
      updateSyncBadge('● Synced', false);
      if (successMsg) showToast(successMsg);
      if (!silent) renderCurrentTab();
      return true;
    } else {
      throw new Error(data.message || 'Server error');
    }
  } catch (err) {
    recordSyncInfo(false);
    updateSyncBadge('● Error', true);
    if (!silent) showToast('Gagal menyimpan ke server');
    return false;
  }
}

function openSettingsModal() {
  openModal('Pengaturan Koneksi Database', `
    <div class="space-y-3">
      <p class="text-xs text-stone-600">Tempelkan <b>URL Aplikasi Web</b> dari Google Apps Script agar seluruh tim dan manajemen tersinkron otomatis.</p>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Web App URL</label>
        <input id="inputApiUrl" type="url" value="${escHtml(STATE.apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec"
          class="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-amber-600" />
      </div>
      <button onclick="saveApiUrlSetting()" class="w-full py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs active:scale-95">
        Simpan &amp; Sinkronkan Sekarang
      </button>
    </div>
  `);
}

function saveApiUrlSetting() {
  const val = (document.getElementById('inputApiUrl')?.value || '').trim();
  if (!val.startsWith('https://script.google.com/')) {
    showToast('URL Apps Script tidak valid');
    return;
  }
  STATE.apiUrl = val;
  localStorage.setItem('bvg_intel_api_url', val);
  closeModal();
  syncAllData(true);
}

function switchTab(tab) {
  STATE.activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.className = isActive
      ? 'nav-btn flex flex-col items-center py-1 rounded-lg text-amber-700 font-bold'
      : 'nav-btn flex flex-col items-center py-1 rounded-lg text-stone-500';
  });
  renderCurrentTab();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentTab() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  if (STATE.activeTab === 'home') renderHomeTab(main);
  else if (STATE.activeTab === 'daily' && typeof renderDailyTab === 'function') renderDailyTab(main);
  else if (STATE.activeTab === 'parstock' && typeof renderParStockTab === 'function') renderParStockTab(main);
  else if (STATE.activeTab === 'po' && typeof renderPoVendorTab === 'function') renderPoVendorTab(main);
  else if (STATE.activeTab === 'master' && typeof renderMasterTab === 'function') renderMasterTab(main);
}

function renderHomeTab(main) {
  const lowItems = getLowStockItems();
  const curMonth = new Date().toISOString().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  const totalSoValue = Object.values(mMap).reduce((sum, x) => sum + (Number(x.valueSo) || 0), 0);
  const isOverLimit = totalSoValue > 20000000;

  const syncInfo = STATE.lastSyncInfo;
  const syncStatusHtml = syncInfo
    ? (syncInfo.success
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">● Success</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">● Gagal / Offline</span>`)
    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold text-[10px]">● Belum Sync</span>`;
  const syncTimeText = syncInfo ? formatSyncTimestamp(syncInfo.timestamp) : 'Belum ada riwayat sinkronisasi';

  const urlBanner = !STATE.apiUrl ? `
    <div class="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 mb-3 flex items-center justify-between gap-2">
      <div>
        <p class="text-xs font-bold text-amber-900">Hubungkan Google Sheets</p>
        <p class="text-[11px] text-amber-700">Masukkan URL Apps Script untuk memuat 108+ data bahan.</p>
      </div>
      <button onclick="openSettingsModal()" class="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0">Atur URL</button>
    </div>
  ` : '';

  const lowListHtml = lowItems.length === 0
    ? `<div class="text-center py-6 text-xs text-emerald-700 bg-emerald-50/70 rounded-xl border border-emerald-200">
         Semua stok bahan baku masih di atas batas minimum Par Stock.
       </div>`
    : `<div class="space-y-2 max-h-80 overflow-y-auto pr-1">
        ${lowItems.map(item => `
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 border border-rose-200">
            <div>
              <p class="text-xs font-bold text-stone-800">${escHtml(item.name)}</p>
              <p class="text-[10px] text-stone-500">${escHtml(item.subCategory)} • Min: <b>${formatNum(item.minStock)} ${escHtml(item.unit)}</b></p>
            </div>
            <div class="text-right">
              <span class="inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                Sisa: ${formatNum(item.currentStock)} ${escHtml(item.unit)}
              </span>
              <button onclick="quickOrderFromAlert('${escHtml(item.id)}')" class="block ml-auto mt-1 text-[10px] font-bold text-amber-800 underline">
                + Buat PO
              </button>
            </div>
          </div>
        `).join('')}
      </div>`;

  main.innerHTML = `
    ${urlBanner}

    <div class="bg-white px-3.5 py-2.5 rounded-2xl shadow-sm border border-stone-200 mb-3 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Status Sinkronisasi:</span>
          ${syncStatusHtml}
        </div>
        <p class="text-[11px] font-semibold text-stone-700 mt-0.5 truncate">${syncTimeText}</p>
      </div>
      <button onclick="syncAllData(true)" class="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold shrink-0 active:scale-95">
        ↻ Sync
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-3">
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
        <p class="text-[11px] text-stone-500 font-medium">Total Raw Material</p>
        <p class="text-xl font-extrabold text-stone-900 mt-0.5">${STATE.ingredients.length} <span class="text-xs font-normal text-stone-400">items</span></p>
      </div>
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
        <p class="text-[11px] text-stone-500 font-medium">Waktunya Order</p>
        <p class="text-xl font-extrabold ${lowItems.length > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-0.5">${lowItems.length} <span class="text-xs font-normal text-stone-400">bahan</span></p>
      </div>
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
        <p class="text-[11px] text-stone-500 font-medium">Total Value SO (${curMonth})</p>
        <p class="text-sm font-extrabold ${isOverLimit ? 'text-rose-600' : 'text-emerald-700'} mt-1">${formatRp(totalSoValue)}</p>
      </div>
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
        <p class="text-[11px] text-stone-500 font-medium">Total PO Tercatat</p>
        <p class="text-xl font-extrabold text-amber-700 mt-0.5">${STATE.purchaseOrders.length} <span class="text-xs font-normal text-stone-400">order</span></p>
      </div>
    </div>

    <section class="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 mb-3">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-sm font-bold text-stone-900">⚠️ Pengingat Order (Lewat Batas Minimum)</h2>
          <p class="text-[11px] text-stone-500">Otomatis membandingkan sisa Daily Inventory vs Par Stock</p>
        </div>
        <button onclick="switchTab('parstock')" class="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
          Atur Par
        </button>
      </div>
      ${lowListHtml}
    </section>

    <section class="grid grid-cols-2 gap-2.5">
      <button onclick="switchTab('daily')" class="p-3.5 rounded-2xl bg-stone-900 text-white text-left shadow-sm active:scale-95">
        <span class="text-lg">📦</span>
        <p class="text-xs font-bold mt-1">Input Daily Inventory</p>
        <p class="text-[10px] text-stone-400">Catat IN / OUT &amp; cetak PDF</p>
      </button>
      <button onclick="switchTab('po')" class="p-3.5 rounded-2xl bg-amber-600 text-white text-left shadow-sm active:scale-95">
        <span class="text-lg">🛒</span>
        <p class="text-xs font-bold mt-1">Purchasing Order</p>
        <p class="text-[10px] text-amber-100">Ajukan order &amp; cek vendor</p>
      </button>
    </section>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  STATE.apiUrl = detectSavedApiUrl();
  loadLastSyncInfo();
  loadLocalCache();
  renderCurrentTab();
  if (STATE.apiUrl) syncAllData(false);
});
