// ==================== CORE STATE & CONFIG ====================
const EXACT_GAS_URL = 'https://script.google.com/macros/s/AKfycbynC9P-Hvdg3JnWz9ppqF7dw-iNz4fHFUc78yaBEsZ-PlwsDB0k-TCt52baRJJyvf-qSw/exec';

// Pastikan URL di localStorage selalu sinkron otomatis dengan URL deployment aktif
(function initApiUrl() {
  if (EXACT_GAS_URL && EXACT_GAS_URL.startsWith('https://script.google.com/')) {
    const saved = localStorage.getItem('bvg_intel_api_url') || '';
    if (saved !== EXACT_GAS_URL) {
      localStorage.setItem('bvg_intel_api_url', EXACT_GAS_URL);
    }
  }
})();

function getLocalTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getFormattedNowId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function parseLogTimestamp(val) {
  if (!val) return 0;
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0)
    ).getTime();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatShortLogTime(val) {
  if (!val) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) {
    const day = Number(m[3]);
    const mon = months[Number(m[2]) - 1] || m[2];
    return m[4] ? `${day} ${mon} • ${m[4]}:${m[5]}` : `${day} ${mon}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = d.getDate();
    const mon = months[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} • ${hh}:${mm}`;
  }
  return s.slice(0, 16);
}

const savedSyncMeta = (() => {
  try {
    return JSON.parse(localStorage.getItem('bvg_last_sync_meta') || 'null') || { time: '-', ok: null, msg: 'Belum pernah sync' };
  } catch (e) {
    return { time: '-', ok: null, msg: 'Belum pernah sync' };
  }
})();

const STATE = {
  gasUrl: (EXACT_GAS_URL && EXACT_GAS_URL.startsWith('https://script.google.com/'))
    ? EXACT_GAS_URL
    : (localStorage.getItem('bvg_intel_api_url') || EXACT_GAS_URL),
  activeTab: 'home',
  parSubTab: 'monthly',
  masterSubTab: 'ingredients',
  poSubTab: 'po',
  selectedDate: getLocalTodayStr(),
  homeLogDate: getLocalTodayStr(),
  poDate: getLocalTodayStr(),
  poSearch: '',
  vendorSearch: '',
  ingSearch: '',
  ingCatFilter: 'ALL',
  recipeSearch: '',
  recipeCatFilter: 'ALL',
  dailySearch: '',
  dailyCatFilter: 'ALL',
  monthlySearch: '',
  monthlyCatFilter: 'ALL',
  parSearch: '',
  menuEngMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
  menuEngYear: String(new Date().getFullYear()),
  menuEngCat: 'ALL',
  menuEngQuad: 'ALL',
  selectedPic: localStorage.getItem('qose_last_pic') || '',
  lastSyncTime: savedSyncMeta.time,
  lastSyncOk: savedSyncMeta.ok,
  lastSyncMsg: savedSyncMeta.msg,
  ingredients: [],
  recipes: [],
  invDaily: [],
  invMonthly: [],
  purchaseOrders: [],
  vendors: [],
  teamBar: [],
  draftDaily: {},
  draftMonthly: {},
  draftPar: {},
  isLoading: false
};

window._acCallbacks = window._acCallbacks || {};

const SUB_CATEGORIES = [
  'Coffee Beans',
  'Milk & Dairy',
  'Syrup & Sauce',
  'Powder & Matcha',
  'Tea & Herbs',
  'Fruit & Puree',
  'Packaging & Cup',
  'Other Base'
];

// ==================== FORMATTERS & HELPERS ====================
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const escapeHtml = escHtml;

function formatNum(val) {
  const n = Number(val);
  if (isNaN(n)) return '0';
  return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const formatNumber = formatNum;

function formatRp(val) {
  const n = Math.round(Number(val) || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
}
const formatCurrency = formatRp;

function showToast(msg, duration = 2600) {
  const box = document.getElementById('toastBox');
  if (box) {
    box.textContent = msg;
    box.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      box.classList.add('hidden');
    }, duration);
    return;
  }
  let el = document.getElementById('globalToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalToast';
    el.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-semibold shadow-lg pointer-events-none';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, duration);
}

function openModal(title, bodyHtml) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  if (overlay && titleEl && bodyEl) {
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    return;
  }
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
}

function isHeadBarRole(jabatan) {
  const role = String(jabatan || '').toLowerCase();
  return role.includes('head') || role.includes('spv') || role.includes('manager') || role.includes('admin') || role.includes('owner');
}

function openSettingsModal() {
  const adminList = STATE.teamBar.filter(t => isHeadBarRole(t.jabatan));
  const picSource = adminList.length > 0 ? adminList : STATE.teamBar;
  const picOptions = picSource.map((t, idx) =>
    `<option value="${escHtml(t.nama)}" ${idx === 0 ? 'selected' : ''}>${escHtml(t.nama)} (${escHtml(t.jabatan)})</option>`
  ).join('');

  openModal('⚙️ Pengaturan Koneksi Google Sheets', `
    <div class="space-y-3">
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-bold text-stone-700">URL Web App Google Apps Script</label>
          <span id="urlLockBadge" class="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-bold">
            🔒 Terkunci Otomatis
          </span>
        </div>
        <textarea id="settingsGasUrl" rows="3" readonly disabled
          class="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-100 text-stone-500 text-xs font-mono cursor-not-allowed select-none">${escHtml(STATE.gasUrl)}</textarea>
      </div>

      <div class="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-600">
        <b>Status Terakhir:</b> ${escHtml(STATE.lastSyncMsg)} (${escHtml(STATE.lastSyncTime)})
      </div>

      <!-- Panel Verifikasi PIN Head Bar untuk Buka Kunci URL -->
      <div id="urlUnlockSection" class="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2">
        <p class="text-[11px] font-extrabold text-amber-950">🔐 Buka Kunci Edit URL (Khusus Head Bar)</p>
        <p class="text-[10px] text-stone-600">URL terpasang otomatis. Masukkan PIN dari sheet <b>Tim_Bar</b> jika ingin mengubah URL server.</p>
        <div class="grid grid-cols-5 gap-2">
          <div class="col-span-3">
            <select id="unlockAdminPic" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900">
              ${picOptions || '<option value="">-- Data Tim Kosong --</option>'}
            </select>
          </div>
          <div class="col-span-2">
            <input id="unlockAdminPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="PIN ••••"
              class="w-full px-2.5 py-2 rounded-xl border border-amber-400 bg-white text-xs font-extrabold text-center tracking-widest text-stone-900" />
          </div>
        </div>
        <button type="button" onclick="unlockSettingsUrl()" class="w-full py-2 rounded-xl bg-stone-900 text-white font-bold text-xs active:scale-95">
          🔓 Buka Kunci URL
        </button>
      </div>

      <!-- Tombol Edit (Tersembunyi sampai PIN benar) -->
      <div id="urlActionButtons" class="hidden grid grid-cols-2 gap-2">
        <button type="button" onclick="resetDefaultGasUrl()" class="py-2.5 rounded-xl bg-stone-200 text-stone-800 font-bold text-xs">
          Reset Default
        </button>
        <button type="button" onclick="saveSettingsGasUrl()" class="py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs">
          Simpan &amp; Sync
        </button>
      </div>
    </div>
  `);
}

function unlockSettingsUrl() {
  const picName = (document.getElementById('unlockAdminPic')?.value || '').trim();
  const pin = (document.getElementById('unlockAdminPin')?.value || '').trim();

  if (!picName) {
    showToast('Pilih akun Head Bar terlebih dahulu!');
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    showToast('Masukkan 4 digit angka PIN!');
    return;
  }

  const member = STATE.teamBar.find(t => String(t.nama || '').trim().toLowerCase() === picName.toLowerCase());
  if (!member) {
    showToast('Data PIC tidak ditemukan di sheet Tim_Bar!');
    return;
  }
  if (!isHeadBarRole(member.jabatan)) {
    showToast('⛔ Hanya PIN Head Bar / Admin yang diizinkan!');
    return;
  }

  const sheetPin = String(member.pin ?? '').trim();
  if (!sheetPin || sheetPin !== pin) {
    showToast('❌ PIN salah! Periksa PIN di sheet Tim_Bar.');
    return;
  }

  const urlBox = document.getElementById('settingsGasUrl');
  const badge = document.getElementById('urlLockBadge');
  const unlockSec = document.getElementById('urlUnlockSection');
  const actionBtns = document.getElementById('urlActionButtons');

  if (urlBox) {
    urlBox.removeAttribute('readonly');
    urlBox.removeAttribute('disabled');
    urlBox.className = 'w-full px-3 py-2 rounded-xl border-2 border-amber-500 bg-white text-stone-900 text-xs font-mono focus:outline-none';
  }
  if (badge) {
    badge.textContent = '🔓 Kunci Terbuka';
    badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold';
  }
  if (unlockSec) unlockSec.classList.add('hidden');
  if (actionBtns) actionBtns.classList.remove('hidden');

  showToast('🔓 Kunci URL berhasil dibuka!');
}

function resetDefaultGasUrl() {
  const el = document.getElementById('settingsGasUrl');
  if (el && !el.disabled) el.value = EXACT_GAS_URL;
}

async function saveSettingsGasUrl() {
  const el = document.getElementById('settingsGasUrl');
  if (!el || el.disabled) {
    showToast('🔒 Buka kunci URL dengan PIN terlebih dahulu!');
    return;
  }
  const val = (el.value || '').trim();
  if (!val.startsWith('https://script.google.com/')) {
    showToast('URL harus berawalan https://script.google.com/');
    return;
  }
  STATE.gasUrl = val;
  localStorage.setItem('bvg_intel_api_url', val);
  closeModal();
  await syncAllData(true);
}

// ==================== PIC & 4-DIGIT PIN COMPONENT ====================
function renderPicPinBoxHtml(prefix, subtitle = 'Verifikasi Penanggung Jawab (Wajib)') {
  const options = STATE.teamBar.map(t => {
    const isSel = STATE.selectedPic && STATE.selectedPic.toLowerCase() === t.nama.toLowerCase();
    return `<option value="${escHtml(t.nama)}" ${isSel ? 'selected' : ''}>${escHtml(t.nama)} (${escHtml(t.jabatan)})</option>`;
  }).join('');

  return `
    <div class="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-extrabold text-amber-950">🔐 ${escHtml(subtitle)}</span>
        <span class="text-[10px] text-amber-700 font-semibold">${STATE.teamBar.length} Tim Terdaftar</span>
      </div>
      <div class="grid grid-cols-5 gap-2">
        <div class="col-span-3">
          <label class="block text-[10px] font-bold text-stone-600 mb-1">Nama PIC</label>
          <select id="${prefix}_pic" onchange="STATE.selectedPic=this.value; localStorage.setItem('qose_last_pic', this.value);"
            class="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none">
            <option value="">-- Pilih Nama --</option>
            ${options}
          </select>
        </div>
        <div class="col-span-2">
          <label class="block text-[10px] font-bold text-stone-600 mb-1">PIN 4 Digit</label>
          <input id="${prefix}_pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••"
            class="w-full px-2.5 py-2 rounded-xl border border-amber-400 bg-white text-xs font-extrabold text-center tracking-widest text-stone-900 focus:border-amber-600 focus:outline-none" />
        </div>
      </div>
    </div>
  `;
}

function getPicPinValues(prefix) {
  const picEl = document.getElementById(`${prefix}_pic`);
  const pinEl = document.getElementById(`${prefix}_pin`);
  const picName = (picEl?.value || '').trim();
  const pin = (pinEl?.value || '').trim();

  if (!picName) {
    showToast('Pilih Nama PIC terlebih dahulu!');
    if (picEl) picEl.focus();
    return null;
  }
  if (!/^\d{4}$/.test(pin)) {
    showToast('Masukkan 4 digit angka PIN kamu!');
    if (pinEl) pinEl.focus();
    return null;
  }
  STATE.selectedPic = picName;
  localStorage.setItem('qose_last_pic', picName);
  return { picName, pin };
}

// ==================== AUTOCOMPLETE BAHAN BAKU ====================
function renderIngAutocompleteHtml(prefix, selectedIngId = '', placeholder = 'Ketik nama bahan...') {
  const sorted = getSortedIngredients();
  const sel = selectedIngId ? sorted.find(x => String(x.id) === String(selectedIngId)) : null;
  const initLabel = sel ? `${sel.name} (${sel.unit})` : '';

  return `
    <div class="relative">
      <input type="hidden" id="${prefix}_val" value="${escHtml(selectedIngId)}" />
      <input type="text" id="${prefix}_txt" value="${escHtml(initLabel)}" placeholder="${escHtml(placeholder)}" autocomplete="off"
        onfocus="filterIngAc('${prefix}', this.value)"
        oninput="document.getElementById('${prefix}_val').value=''; filterIngAc('${prefix}', this.value)"
        class="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold focus:border-amber-600 focus:outline-none" />
      <div id="${prefix}_list" class="hidden absolute left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto bg-white border border-stone-300 rounded-xl shadow-lg z-50 divide-y divide-stone-100"></div>
    </div>
  `;
}

function filterIngAc(prefix, query) {
  const listEl = document.getElementById(`${prefix}_list`);
  if (!listEl) return;
  const q = String(query || '').trim().toLowerCase();
  const matches = getSortedIngredients()
    .filter(x => !q || x.name.toLowerCase().includes(q) || x.subCategory.toLowerCase().includes(q))
    .slice(0, 25);

  if (matches.length === 0) {
    listEl.innerHTML = `<div class="px-3 py-2 text-[11px] text-stone-400">Bahan tidak ditemukan</div>`;
  } else {
    listEl.innerHTML = matches.map(ing => `
      <button type="button" onclick="selectIngAc('${prefix}', '${escHtml(ing.id)}')"
        class="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center justify-between text-xs">
        <span class="font-bold text-stone-900">${escHtml(ing.name)}</span>
        <span class="text-[10px] text-stone-500">${escHtml(ing.subCategory)} • ${escHtml(ing.unit)}</span>
      </button>
    `).join('');
  }
  listEl.classList.remove('hidden');
}

function selectIngAc(prefix, ingId) {
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  const valEl = document.getElementById(`${prefix}_val`);
  const txtEl = document.getElementById(`${prefix}_txt`);
  const listEl = document.getElementById(`${prefix}_list`);
  if (valEl) valEl.value = ing ? ing.id : '';
  if (txtEl) txtEl.value = ing ? `${ing.name} (${ing.unit})` : '';
  if (listEl) listEl.classList.add('hidden');
  if (ing && window._acCallbacks && typeof window._acCallbacks[prefix] === 'function') {
    window._acCallbacks[prefix](ing);
  }
}

// ==================== CORE INVENTORY CALCULATIONS ====================
function getSortedIngredients() {
  return [...STATE.ingredients].sort((a, b) => {
    const oa = Number(a.sortOrder) || 9999;
    const ob = Number(b.sortOrder) || 9999;
    if (oa !== ob) return oa - ob;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function getIngUnitCost(ing) {
  if (!ing) return 0;
  const price = Number(ing.price) || 0;
  const pack = Number(ing.packSize) || 1;
  if (price > 0 && pack > 0) return price / pack;
  return Number(ing.unitCost) || 0;
}

function getDailyRecord(dateStr, ingId) {
  const draftKey = `${dateStr}__${ingId}`;
  const saved = STATE.invDaily.find(r => String(r.date) === String(dateStr) && String(r.ingId) === String(ingId));
  const draft = STATE.draftDaily[draftKey];

  const inQty = draft && draft.inQty !== undefined ? Number(draft.inQty) || 0 : (saved ? Number(saved.inQty) || 0 : 0);
  const outQty = draft && draft.outQty !== undefined ? Number(draft.outQty) || 0 : (saved ? Number(saved.outQty) || 0 : 0);
  const wasteQty = draft && draft.wasteQty !== undefined ? Number(draft.wasteQty) || 0 : (saved ? Number(saved.wasteQty) || 0 : 0);
  const clQty = inQty - outQty - wasteQty;

  return {
    inQty,
    outQty,
    wasteQty,
    clQty,
    picName: saved ? (saved.picName || '') : '',
    updatedAt: saved ? (saved.updatedAt || '') : '',
    isDirty: Boolean(draft)
  };
}

function getMonthlySummaryMap(mKey) {
  const map = {};
  STATE.ingredients.forEach(ing => {
    map[ing.id] = {
      ingId: ing.id,
      totalIn: 0,
      totalOut: 0,
      totalWaste: 0,
      totalCl: 0,
      soQty: '',
      selisih: 0,
      pemakaianBar: 0,
      wasteCost: 0,
      valueSo: 0,
      picName: '',
      updatedAt: ''
    };
  });

  STATE.invDaily.forEach(r => {
    const rMonth = r.monthKey || String(r.date || '').slice(0, 7);
    if (rMonth !== mKey) return;
    if (!map[r.ingId]) {
      map[r.ingId] = {
        ingId: r.ingId, totalIn: 0, totalOut: 0, totalWaste: 0, totalCl: 0,
        soQty: '', selisih: 0, pemakaianBar: 0, wasteCost: 0, valueSo: 0, picName: '', updatedAt: ''
      };
    }
    map[r.ingId].totalIn += Number(r.inQty) || 0;
    map[r.ingId].totalOut += Number(r.outQty) || 0;
    map[r.ingId].totalWaste += Number(r.wasteQty) || 0;
  });

  STATE.invMonthly.forEach(m => {
    if (String(m.monthKey) !== mKey) return;
    if (!map[m.ingId]) return;
    if (m.soQty !== '' && m.soQty !== null && m.soQty !== undefined) {
      map[m.ingId].soQty = Number(m.soQty);
    }
    map[m.ingId].picName = m.picName || '';
    map[m.ingId].updatedAt = m.updatedAt || '';
  });

  STATE.ingredients.forEach(ing => {
    const s = map[ing.id];
    const unitCost = getIngUnitCost(ing);
    s.totalCl = s.totalIn - s.totalOut - s.totalWaste;
    s.pemakaianBar = s.totalOut * unitCost;
    s.wasteCost = s.totalWaste * unitCost;

    const draft = STATE.draftMonthly[`${mKey}__${ing.id}`];
    const activeSo = draft && draft.soQty !== undefined ? draft.soQty : s.soQty;
    if (activeSo !== '' && activeSo !== null && activeSo !== undefined) {
      const soNum = Number(activeSo) || 0;
      s.selisih = soNum - s.totalCl;
      s.valueSo = soNum * unitCost;
    } else {
      s.selisih = 0;
      s.valueSo = 0;
    }
  });

  return map;
}

function getCurrentStock(ingId) {
  const curMonth = getLocalTodayStr().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  return mMap[ingId] ? mMap[ingId].totalCl : 0;
}

function normalizeRecipe(raw, idx = 0) {
  let items = [];
  try {
    items = typeof raw.ingredients === 'string' ? JSON.parse(raw.ingredients || '[]') : (raw.ingredients || []);
  } catch (e) {
    items = [];
  }
  items = items.map(it => {
    const master = STATE.ingredients.find(x => String(x.id) === String(it.ingId));
    const unitCost = master ? getIngUnitCost(master) : (Number(it.unitCost) || 0);
    return {
      ingId: String(it.ingId || ''),
      name: master ? master.name : String(it.name || 'Bahan'),
      unit: master ? master.unit : String(it.unit || 'gram'),
      qty: Number(it.qty) || 0,
      unitCost
    };
  });
  const hpp = items.reduce((sum, it) => sum + (it.qty * it.unitCost), 0);
  const sellingPrice = Number(raw.sellingPrice) || 0;
  const margin = sellingPrice > 0 ? (((sellingPrice - hpp) / sellingPrice) * 100) : 0;

  return {
    id: String(raw.id || ('rcp_' + idx)),
    name: String(raw.name || 'Menu'),
    category: String(raw.category || 'Signature'),
    sellingPrice,
    items,
    hpp,
    margin,
    notes: String(raw.notes || ''),
    salesQty: Number(raw.salesQty) || 0,
    salesByMonth: raw.salesByMonth || {}
  };
}
const getNormalizedRecipes = () => STATE.recipes.map(normalizeRecipe);

// ==================== API SYNC & BACKEND POST ====================
function saveCacheToLocal() {
  try {
    localStorage.setItem('qose_inv_cache_v3', JSON.stringify({
      ingredients: STATE.ingredients,
      recipes: STATE.recipes,
      invDaily: STATE.invDaily,
      invMonthly: STATE.invMonthly,
      purchaseOrders: STATE.purchaseOrders,
      vendors: STATE.vendors,
      teamBar: STATE.teamBar
    }));
  } catch (e) {}
}

function loadCacheFromLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem('qose_inv_cache_v3') || 'null');
    if (!raw) return false;
    STATE.ingredients = raw.ingredients || [];
    STATE.recipes = raw.recipes || [];
    STATE.invDaily = raw.invDaily || [];
    STATE.invMonthly = raw.invMonthly || [];
    STATE.purchaseOrders = raw.purchaseOrders || [];
    STATE.vendors = raw.vendors || [];
    STATE.teamBar = raw.teamBar || [];
    return true;
  } catch (e) {
    return false;
  }
}

function updateSyncIndicator(loading, okState = null) {
  const btn = document.getElementById('syncStatusBadge');
  if (!btn) return;
  if (loading) {
    btn.textContent = '↻ Syncing...';
    btn.className = 'text-[11px] px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold';
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  if (okState === false) {
    btn.textContent = '● Gagal Sync';
    btn.className = 'text-[11px] px-2.5 py-1 rounded-full bg-rose-600/25 text-rose-300 border border-rose-500/40 font-semibold active:scale-95';
  } else {
    btn.textContent = '● Synced';
    btn.className = 'text-[11px] px-2.5 py-1 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-semibold active:scale-95';
  }
}

async function loadAllData(silent = false) {
  const url = STATE.gasUrl || EXACT_GAS_URL;
  STATE.isLoading = true;
  updateSyncIndicator(true);
  const nowStr = getFormattedNowId();

  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { redirect: 'follow' });
    const data = await res.json();
    if (data.status === 'ok') {
      STATE.ingredients = data.ingredients || [];
      STATE.recipes = data.recipes || [];
      STATE.invDaily = data.invDaily || [];
      STATE.invMonthly = data.invMonthly || [];
      STATE.purchaseOrders = data.purchaseOrders || [];
      STATE.vendors = data.vendors || [];
      STATE.teamBar = data.teamBar || [];
      STATE.lastSyncTime = nowStr;
      STATE.lastSyncOk = true;
      STATE.lastSyncMsg = `Berhasil (${STATE.ingredients.length} bahan, ${STATE.teamBar.length} PIC)`;
      localStorage.setItem('bvg_last_sync_meta', JSON.stringify({ time: nowStr, ok: true, msg: STATE.lastSyncMsg }));
      saveCacheToLocal();
      updateSyncIndicator(false, true);
      if (!silent) showToast(`✅ Sync berhasil (${STATE.ingredients.length} bahan)`);
    } else {
      STATE.lastSyncTime = nowStr;
      STATE.lastSyncOk = false;
      STATE.lastSyncMsg = 'Gagal: ' + (data.message || 'Error server');
      localStorage.setItem('bvg_last_sync_meta', JSON.stringify({ time: nowStr, ok: false, msg: STATE.lastSyncMsg }));
      updateSyncIndicator(false, false);
      if (!silent) showToast('❌ ' + STATE.lastSyncMsg);
    }
  } catch (err) {
    STATE.lastSyncTime = nowStr;
    STATE.lastSyncOk = false;
    STATE.lastSyncMsg = 'Gagal terhubung ke Google Sheets';
    localStorage.setItem('bvg_last_sync_meta', JSON.stringify({ time: nowStr, ok: false, msg: STATE.lastSyncMsg }));
    updateSyncIndicator(false, false);
    if (!silent) showToast('❌ Gagal terhubung ke Google Sheets');
  } finally {
    STATE.isLoading = false;
    renderCurrentTab();
  }
}

function syncAllData(showNotice = true) {
  return loadAllData(!showNotice);
}

async function postToBackend(payload, successMsg = 'Tersimpan!', silent = false) {
  const url = STATE.gasUrl || EXACT_GAS_URL;
  updateSyncIndicator(true);
  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status !== 'ok') {
      showToast('❌ ' + (data.message || 'Gagal menyimpan data'), 3500);
      updateSyncIndicator(false, false);
      return false;
    }
    await loadAllData(true);
    if (!silent && successMsg) showToast('✅ ' + successMsg);
    return true;
  } catch (err) {
    showToast('❌ Koneksi gagal: ' + err.message, 3200);
    updateSyncIndicator(false, false);
    return false;
  }
}

// ==================== HOME DASHBOARD TAB ====================
function togglePicLogCard(idx) {
  const detailEl = document.getElementById(`picLogDetail_${idx}`);
  const arrowEl = document.getElementById(`picLogArrow_${idx}`);
  if (!detailEl) return;
  const isHidden = detailEl.classList.toggle('hidden');
  if (arrowEl) {
    arrowEl.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}

function renderPicLogsListHtml() {
  const targetDate = String(STATE.homeLogDate || getLocalTodayStr()).slice(0, 10);

  // Filter berdasarkan tanggal yang dipilih lalu kelompokkan per Nama PIC
  const filteredLogs = STATE.invDaily
    .filter(r => String(r.picName || '').trim() !== '' && String(r.date || '').slice(0, 10) === targetDate)
    .sort((a, b) => parseLogTimestamp(b.updatedAt || b.date) - parseLogTimestamp(a.updatedAt || a.date));

  const picGroupsMap = new Map();
  filteredLogs.forEach(log => {
    const rawName = String(log.picName || '').trim();
    const key = rawName.toLowerCase();
    if (!picGroupsMap.has(key)) {
      picGroupsMap.set(key, {
        picName: rawName,
        latestTimeRaw: log.updatedAt || log.date,
        items: []
      });
    }
    picGroupsMap.get(key).items.push(log);
  });
  const picGroups = Array.from(picGroupsMap.values());

  if (picGroups.length === 0) {
    return `<p class="text-[11px] text-stone-400 bg-stone-50 px-3 py-2.5 rounded-xl">Tidak ada catatan input PIC pada tanggal <b>${escHtml(targetDate)}</b>.</p>`;
  }

  return `
    <div class="space-y-1.5">
      ${picGroups.map((grp, idx) => {
        const initial = grp.picName.charAt(0).toUpperCase();
        return `
          <div class="rounded-xl bg-stone-50 border border-stone-200/80 overflow-hidden">
            <button type="button" onclick="togglePicLogCard(${idx})"
              class="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left active:bg-stone-100">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-6 h-6 rounded-full bg-stone-900 text-amber-300 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  ${escHtml(initial)}
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <b class="text-xs text-stone-900 truncate">${escHtml(grp.picName)}</b>
                    <span class="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[9px] font-bold shrink-0">
                      ${grp.items.length} bahan
                    </span>
                  </div>
                  <p class="text-[9px] text-stone-400">Ketuk untuk lihat rincian</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] font-semibold text-stone-500">${escHtml(formatShortLogTime(grp.latestTimeRaw))}</span>
                <span id="picLogArrow_${idx}" class="text-[10px] text-stone-400 transition-transform duration-150">▼</span>
              </div>
            </button>

            <div id="picLogDetail_${idx}" class="hidden px-2.5 pb-2 pt-1.5 border-t border-stone-200/70 bg-white space-y-1 max-h-44 overflow-y-auto">
              ${grp.items.map(item => `
                <div class="flex items-center justify-between gap-2 text-[10px] py-1 border-b border-stone-100 last:border-b-0">
                  <div class="min-w-0">
                    <span class="font-bold text-stone-800 block truncate">${escHtml(item.ingName)}</span>
                    <span class="text-[9px] text-stone-400">${escHtml(formatShortLogTime(item.updatedAt))}</span>
                  </div>
                  <span class="text-[9px] font-semibold text-stone-600 shrink-0 bg-stone-100 px-1.5 py-0.5 rounded">
                    IN ${formatNum(item.inQty)} • OUT ${formatNum(item.outQty)} • Wst ${formatNum(item.wasteQty)}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderHomeTab(main) {
  const curMonth = getLocalTodayStr().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  const sorted = getSortedIngredients();

  let totalValueSo = 0;
  let totalPemakaianBar = 0;
  let totalWasteRp = 0;
  const lowStockList = [];

  sorted.forEach(ing => {
    const s = mMap[ing.id];
    if (!s) return;
    totalValueSo += s.valueSo;
    totalPemakaianBar += s.pemakaianBar;
    totalWasteRp += s.wasteCost;
    const min = Number(ing.minStock) || 0;
    if (min > 0 && s.totalCl <= min) {
      lowStockList.push({ ing, cur: s.totalCl, min });
    }
  });

  const isOverLimit = totalValueSo > 20000000;
  const syncBadgeClass = STATE.lastSyncOk === true
    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
    : (STATE.lastSyncOk === false ? 'bg-rose-500/20 border-rose-400/30 text-rose-300' : 'bg-white/10 border-white/15 text-stone-300');
  const syncIcon = STATE.lastSyncOk === true ? '✅' : (STATE.lastSyncOk === false ? '❌' : '⏳');

  main.innerHTML = `
    <section class="bg-stone-900 text-white p-4 rounded-3xl shadow-md mb-3 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <span class="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Qose Coffee • Bar Control</span>
          <h2 class="text-base font-extrabold">Ringkasan Periode ${curMonth}</h2>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold shrink-0">${STATE.teamBar.length} PIC • ${STATE.ingredients.length} Bahan</span>
      </div>

      <!-- Status Sinkronisasi Tanggal & Jam -->
      <div class="p-2.5 rounded-2xl border ${syncBadgeClass} flex items-center justify-between gap-2">
        <div class="text-[11px]">
          <p class="font-bold">${syncIcon} Sync: ${escHtml(STATE.lastSyncMsg)}</p>
          <p class="text-[10px] opacity-80">Waktu: ${escHtml(STATE.lastSyncTime)}</p>
        </div>
        <button onclick="syncAllData(true)" class="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold shrink-0 active:scale-95">
          🔄 Sync
        </button>
      </div>

      <div class="p-3 rounded-2xl bg-white/10 border border-white/10">
        <div class="flex items-center justify-between text-[11px] text-stone-300">
          <span>Total Value Stok Fisik (SO)</span>
          <span>Batas: Rp 20.000.000</span>
        </div>
        <div class="text-lg font-extrabold mt-0.5 ${isOverLimit ? 'text-rose-400' : 'text-emerald-400'}">
          ${formatRp(totalValueSo)}
        </div>
        <p class="text-[10px] mt-1 ${isOverLimit ? 'text-rose-300' : 'text-stone-300'}">
          ${isOverLimit ? '⚠️ Melebihi batas acuan stok Rp 20 juta' : '✓ Aman di bawah batas maksimal Rp 20 juta'}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/10">
          <span class="text-[10px] text-stone-400 block">Pemakaian Bar (OUT)</span>
          <b class="text-xs text-amber-300">${formatRp(totalPemakaianBar)}</b>
        </div>
        <div class="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-400/20">
          <span class="text-[10px] text-rose-200 block">Total Waste Bar</span>
          <b class="text-xs text-rose-300">${formatRp(totalWasteRp)}</b>
        </div>
      </div>
    </section>

    <!-- Alert Par Stock -->
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-extrabold text-stone-900">🚨 Alert Par Stock (${lowStockList.length})</h3>
        <button onclick="downloadParStockPdf()" class="text-[10px] font-bold text-amber-700 underline">PDF Par Stock</button>
      </div>
      ${lowStockList.length === 0 ? `
        <p class="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl font-semibold">✓ Semua stok bahan baku aman di atas batas minimum.</p>
      ` : `
        <div class="space-y-1.5 max-h-52 overflow-y-auto">
          ${lowStockList.map(item => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-rose-50 border border-rose-200 text-xs">
              <div>
                <p class="font-bold text-stone-900">${escHtml(item.ing.name)}</p>
                <p class="text-[10px] text-rose-700">Sisa: <b>${formatNum(item.cur)}</b> / Min: ${formatNum(item.min)} ${escHtml(item.ing.unit)}</p>
              </div>
              <button onclick="quickOrderFromAlert('${escHtml(item.ing.id)}')"
                class="px-2.5 py-1.5 rounded-xl bg-amber-600 text-white text-[10px] font-bold shrink-0">
                + PO
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </section>

    <!-- Jejak Input Terakhir PIC (Filter Tanggal + Tumpuk per Nama) -->
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <h3 class="text-xs font-extrabold text-stone-900">🕵️ Jejak Penginput Terakhir</h3>
        <input type="date" value="${escHtml(STATE.homeLogDate)}"
          onchange="STATE.homeLogDate=this.value || getLocalTodayStr(); const box=document.getElementById('picLogsListContainer'); if(box) box.innerHTML=renderPicLogsListHtml();"
          class="px-2.5 py-1 rounded-xl border border-stone-300 bg-stone-50 text-[11px] font-bold text-stone-800 focus:border-amber-600 focus:outline-none" />
      </div>
      <div id="picLogsListContainer">
        ${renderPicLogsListHtml()}
      </div>
    </section>
  `;
}

// ==================== GABUNGAN REKAP BULANAN, SO & PAR STOCK TAB ====================
function renderParStockListHtml() {
  const sorted = getSortedIngredients();
  const q = String(STATE.parSearch || '').trim().toLowerCase();
  const filtered = sorted.filter(ing => !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q));
  const curMonth = getLocalTodayStr().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);

  if (filtered.length === 0) {
    return `<div class="bg-white p-4 rounded-2xl border border-stone-200 text-center text-xs text-stone-400">Tidak ada bahan baku yang cocok dengan pencarian.</div>`;
  }

  return filtered.map(ing => {
    const curCl = mMap[ing.id] ? mMap[ing.id].totalCl : 0;
    const val = STATE.draftPar[ing.id] !== undefined ? STATE.draftPar[ing.id] : (Number(ing.minStock) || 0);
    const isLow = val > 0 && curCl <= val;
    return `
      <div class="bg-white p-3 rounded-2xl shadow-sm border ${isLow ? 'border-rose-300 bg-rose-50/30' : 'border-stone-200'} flex items-center justify-between gap-2">
        <div>
          <span class="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-bold">${escHtml(ing.subCategory)}</span>
          <h3 class="text-xs font-bold text-stone-900 mt-1">${escHtml(ing.name)}</h3>
          <p class="text-[11px] ${isLow ? 'text-rose-700 font-bold' : 'text-stone-500'}">
            Sisa Bulan Ini: ${formatNum(curCl)} ${escHtml(ing.unit)}
          </p>
        </div>
        <div class="w-24 shrink-0">
          <label class="block text-[9px] font-bold text-stone-500 text-right mb-0.5">Min (${escHtml(ing.unit)})</label>
          <input type="number" step="any" value="${val}"
            oninput="STATE.draftPar['${escHtml(ing.id)}']=Number(this.value)||0;"
            class="w-full px-2 py-1.5 rounded-xl border border-amber-400 text-xs font-extrabold text-right bg-white" />
        </div>
      </div>
    `;
  }).join('');
}

function renderParStockAndMonthlyTab(main) {
  const isMonthly = STATE.parSubTab !== 'par';

  if (isMonthly && typeof renderMonthlyTab === 'function') {
    renderMonthlyTab(main);
    const switcher = document.createElement('div');
    switcher.className = 'grid grid-cols-2 gap-1.5 p-1 bg-stone-200 rounded-xl mb-3';
    switcher.innerHTML = `
      <button onclick="STATE.parSubTab='monthly'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold bg-white text-stone-900 shadow-sm">
        📊 Rekap Bulanan &amp; SO
      </button>
      <button onclick="STATE.parSubTab='par'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold text-stone-600">
        ⚠️ Batas Par Stock
      </button>
    `;
    main.insertBefore(switcher, main.firstChild);
    return;
  }

  main.innerHTML = `
    <div class="grid grid-cols-2 gap-1.5 p-1 bg-stone-200 rounded-xl mb-3">
      <button onclick="STATE.parSubTab='monthly'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold text-stone-600">
        📊 Rekap Bulanan &amp; SO
      </button>
      <button onclick="STATE.parSubTab='par'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold bg-white text-stone-900 shadow-sm">
        ⚠️ Batas Par Stock
      </button>
    </div>

    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-extrabold text-stone-900">⚠️ Pengaturan Batas Par Stock</h2>
          <p class="text-[11px] text-stone-500">Alert muncul otomatis jika sisa CL &le; Min Stock</p>
        </div>
        <button onclick="downloadParStockPdf()" class="px-2.5 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold">
          📄 PDF
        </button>
      </div>
      <input id="parSearchInput" type="text" value="${escHtml(STATE.parSearch)}"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        oninput="STATE.parSearch=this.value; const box=document.getElementById('parListContainer'); if(box) box.innerHTML=renderParStockListHtml();"
        placeholder="Cari nama bahan baku..." class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:border-amber-600 focus:outline-none" />
    </section>

    <section id="parListContainer" class="space-y-2 mb-3">
      ${renderParStockListHtml()}
    </section>

    <button onclick="submitParStockUpdates()" class="w-full py-3 rounded-2xl bg-amber-600 text-white font-extrabold text-xs shadow-md">
      💾 Simpan Batas Par Stock
    </button>
  `;
}

async function submitParStockUpdates() {
  const updates = Object.keys(STATE.draftPar).map(id => ({ id, minStock: STATE.draftPar[id] }));
  if (updates.length === 0) {
    showToast('Belum ada angka Par Stock yang diubah');
    return;
  }
  const ok = await postToBackend({ action: 'saveParStock', updates }, 'Batas Par Stock diperbarui!');
  if (ok) STATE.draftPar = {};
}

// ==================== MASTER & RECIPES TAB ====================
function renderMasterTab(main) {
  const isIng = STATE.masterSubTab !== 'recipes';

  main.innerHTML = `
    <div class="grid grid-cols-2 gap-1.5 p-1 bg-stone-200 rounded-xl mb-3">
      <button onclick="STATE.masterSubTab='ingredients'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold ${isIng ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
        🧪 Master (${STATE.ingredients.length})
      </button>
      <button onclick="STATE.masterSubTab='recipes'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold ${!isIng ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
        ☕ Resep (${STATE.recipes.length})
      </button>
    </div>

    ${isIng ? renderMasterIngredientsHtml() : renderMasterRecipesHtml()}
  `;
}

function renderMasterIngredientsListHtml() {
  const sorted = getSortedIngredients();
  const q = String(STATE.ingSearch || '').trim().toLowerCase();
  const filtered = sorted.filter(ing => {
    const matchCat = STATE.ingCatFilter === 'ALL' || ing.subCategory === STATE.ingCatFilter;
    const matchQ = !q || ing.name.toLowerCase().includes(q) || ing.subCategory.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (filtered.length === 0) {
    return `<div class="bg-white p-4 rounded-2xl border border-stone-200 text-center text-xs text-stone-400">Tidak ada bahan baku yang cocok dengan pencarian.</div>`;
  }

  return filtered.map(ing => {
    const uCost = getIngUnitCost(ing);
    return `
      <div class="bg-white p-3 rounded-2xl shadow-sm border border-stone-200 flex items-center justify-between gap-2">
        <div>
          <span class="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-bold">${escHtml(ing.subCategory)}</span>
          <h3 class="text-xs font-bold text-stone-900 mt-1">${escHtml(ing.name)}</h3>
          <p class="text-[11px] text-stone-500">
            ${formatRp(ing.price)} / ${formatNum(ing.packSize)} ${escHtml(ing.unit)}
            • <b class="text-amber-800">${formatRp(uCost)}/${escHtml(ing.unit)}</b>
            • Min: ${formatNum(ing.minStock)}
          </p>
        </div>
        <div class="flex gap-1 shrink-0">
          <button onclick="openIngredientModal('${escHtml(ing.id)}')" class="w-8 h-8 rounded-xl bg-stone-100 text-xs">✏️</button>
          <button onclick="deleteIngredientAction('${escHtml(ing.id)}')" class="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 text-xs">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderMasterIngredientsHtml() {
  return `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-stone-900">Master Bahan Baku Bar</h2>
          <p class="text-[11px] text-stone-500">Harga satuan terkecil &amp; batas Par Stock</p>
        </div>
        <button onclick="openIngredientModal()" class="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0">
          + Bahan
        </button>
      </div>
      <input id="ingSearchInput" type="text" value="${escHtml(STATE.ingSearch)}"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        oninput="STATE.ingSearch=this.value; const box=document.getElementById('masterIngListContainer'); if(box) box.innerHTML=renderMasterIngredientsListHtml();"
        placeholder="Cari nama bahan..." class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:border-amber-600 focus:outline-none" />
      <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        ${['ALL', ...SUB_CATEGORIES].map(cat => `
          <button onclick="STATE.ingCatFilter='${cat}'; renderCurrentTab();"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${STATE.ingCatFilter === cat ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}">
            ${cat === 'ALL' ? 'Semua' : cat}
          </button>
        `).join('')}
      </div>
    </section>

    <section id="masterIngListContainer" class="space-y-2">
      ${renderMasterIngredientsListHtml()}
    </section>
  `;
}

function openIngredientModal(editId = '') {
  const ing = editId ? STATE.ingredients.find(x => String(x.id) === String(editId)) : null;
  openModal(ing ? 'Edit Bahan Baku' : '+ Tambah Bahan Baku', `
    <div class="space-y-2.5">
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Nama Bahan</label>
        <input id="ingFormName" type="text" value="${escHtml(ing ? ing.name : '')}" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Sub Kategori</label>
          <select id="ingFormCat" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white">
            ${SUB_CATEGORIES.map(c => `<option value="${c}" ${ing && ing.subCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Satuan Terkecil</label>
          <select id="ingFormUnit" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white">
            ${['gram', 'ml', 'pcs', 'shot', 'scoop'].map(u => `<option value="${u}" ${ing && ing.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Harga Beli (Rp)</label>
          <input id="ingFormPrice" type="number" value="${ing ? ing.price : ''}" placeholder="20000" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Isi Kemasan</label>
          <input id="ingFormPack" type="number" value="${ing ? ing.packSize : ''}" placeholder="1000" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Batas Minimum / Par Stock</label>
        <input id="ingFormMin" type="number" value="${ing ? ing.minStock : 0}" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <button onclick="submitIngredientForm('${escHtml(editId)}')" class="w-full py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs">
        💾 Simpan Bahan Baku
      </button>
    </div>
  `);
}

async function submitIngredientForm(editId) {
  const name = (document.getElementById('ingFormName')?.value || '').trim();
  const subCategory = document.getElementById('ingFormCat')?.value || 'Other Base';
  const unit = document.getElementById('ingFormUnit')?.value || 'gram';
  const price = Number(document.getElementById('ingFormPrice')?.value) || 0;
  const packSize = Number(document.getElementById('ingFormPack')?.value) || 1;
  const minStock = Number(document.getElementById('ingFormMin')?.value) || 0;
  const unitCost = packSize > 0 ? (price / packSize) : 0;

  if (!name) { showToast('Nama bahan wajib diisi'); return; }
  closeModal();

  const updated = [...STATE.ingredients];
  if (editId) {
    const idx = updated.findIndex(x => String(x.id) === String(editId));
    if (idx >= 0) updated[idx] = { ...updated[idx], name, subCategory, unit, price, packSize, unitCost, minStock };
  } else {
    updated.push({ id: 'ing_' + Date.now(), name, subCategory, unit, price, packSize, unitCost, minStock, sortOrder: updated.length + 1 });
  }
  await postToBackend({ action: 'saveMasterIngredients', ingredients: updated }, `Bahan ${name} disimpan!`);
}

async function deleteIngredientAction(id) {
  const updated = STATE.ingredients.filter(x => String(x.id) !== String(id));
  await postToBackend({ action: 'saveMasterIngredients', ingredients: updated }, 'Bahan dihapus');
}

function renderMasterRecipesListHtml() {
  const recipes = STATE.recipes.map(normalizeRecipe);
  const q = String(STATE.recipeSearch || '').trim().toLowerCase();
  const filtered = recipes.filter(r => !q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));

  if (filtered.length === 0) {
    return `<div class="bg-white p-4 rounded-2xl border border-stone-200 text-center text-xs text-stone-400">Tidak ada resep menu yang cocok dengan pencarian.</div>`;
  }

  return filtered.map(r => {
    const cogsPct = r.sellingPrice > 0 ? ((r.hpp / r.sellingPrice) * 100).toFixed(1) : '0.0';
    return `
      <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">${escHtml(r.category)}</span>
            <h3 class="text-sm font-bold text-stone-900 mt-1">${escHtml(r.name)}</h3>
          </div>
          <div class="flex gap-1">
            <button onclick="openRecipeModal('${escHtml(r.id)}')" class="w-7 h-7 rounded-lg bg-stone-100 text-xs">✏️</button>
            <button onclick="deleteRecipeAction('${escHtml(r.id)}')" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 text-xs">🗑️</button>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-stone-100 text-[11px]">
          <div><span class="text-stone-400 block text-[10px]">Harga Jual</span><b>${formatRp(r.sellingPrice)}</b></div>
          <div><span class="text-stone-400 block text-[10px]">HPP (${cogsPct}%)</span><b class="text-amber-800">${formatRp(r.hpp)}</b></div>
          <div><span class="text-stone-400 block text-[10px]">Margin</span><b class="text-emerald-700">${r.margin.toFixed(1)}%</b></div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2.5">
          <button onclick="downloadSingleRecipeHppPdf('${escHtml(r.id)}')" class="py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold">📄 PDF HPP</button>
          <button onclick="downloadSingleRecipeSopPdf('${escHtml(r.id)}')" class="py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] font-bold">📋 PDF SOP</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderMasterRecipesHtml() {
  return `
    <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-bold text-stone-900">Resep, HPP &amp; SOP Bar</h2>
          <p class="text-[11px] text-stone-500">Kalkulasi otomatis COGS &amp; ekspor PDF</p>
        </div>
        <button onclick="openRecipeModal()" class="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0">
          + Resep
        </button>
      </div>
      <input id="recipeSearchInput" type="text" value="${escHtml(STATE.recipeSearch)}"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        oninput="STATE.recipeSearch=this.value; const box=document.getElementById('masterRecipeListContainer'); if(box) box.innerHTML=renderMasterRecipesListHtml();"
        placeholder="Cari nama menu..." class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:border-amber-600 focus:outline-none" />
    </section>

    <section id="masterRecipeListContainer" class="space-y-2.5">
      ${renderMasterRecipesListHtml()}
    </section>
  `;
}
const renderRecipesHtml = renderMasterRecipesHtml;
const renderMasterRecipesTab = renderMasterRecipesHtml;
const renderRecipesSubTab = renderMasterRecipesHtml;

function openRecipeModal(editId = '') {
  const existing = editId ? normalizeRecipe(STATE.recipes.find(x => String(x.id) === String(editId)) || {}) : null;
  window._recipeDraftItems = existing ? existing.items.map(x => ({ ...x })) : [];

  window._acCallbacks['rcpAc'] = (ing) => {
    window._recipeDraftItems.push({ ingId: ing.id, name: ing.name, unit: ing.unit, qty: 0, unitCost: getIngUnitCost(ing) });
    document.getElementById('rcpAc_txt').value = '';
    document.getElementById('rcpAc_val').value = '';
    renderRecipeDraftRows();
  };

  openModal(existing ? 'Edit Resep Menu' : '+ Tambah Resep Menu', `
    <div class="space-y-2.5">
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Nama Menu</label>
        <input id="rcpName" type="text" value="${escHtml(existing ? existing.name : '')}" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Kategori</label>
          <select id="rcpCat" class="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-xs bg-white">
            ${['Signature', 'Coffee', 'Non-Coffee', 'Matcha & Tea', 'Mocktail', 'Seasonal'].map(c =>
              `<option value="${c}" ${existing && existing.category === c ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Harga Jual (Rp)</label>
          <input id="rcpSell" type="number" value="${existing ? existing.sellingPrice : ''}" oninput="recalcRecipeModalSummary()"
            class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">+ Tambah Komposisi Bahan</label>
        ${renderIngAutocompleteHtml('rcpAc', '', 'Ketik nama bahan untuk dimasukkan...')}
      </div>
      <div id="rcpDraftRows" class="space-y-1.5 max-h-40 overflow-y-auto"></div>
      <div id="rcpModalSummary" class="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1"></div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Catatan / Langkah SOP Penyajian</label>
        <textarea id="rcpNotes" rows="2" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs">${escHtml(existing ? existing.notes : '')}</textarea>
      </div>
      <button onclick="submitRecipeForm('${escHtml(editId)}')" class="w-full py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs">
        💾 Simpan Resep &amp; HPP
      </button>
    </div>
  `);
  renderRecipeDraftRows();
}

function renderRecipeDraftRows() {
  const box = document.getElementById('rcpDraftRows');
  if (!box) return;
  box.innerHTML = window._recipeDraftItems.map((it, idx) => `
    <div class="flex items-center gap-1.5 p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs">
      <span class="flex-1 font-bold text-stone-800 truncate">${escHtml(it.name)}</span>
      <input type="number" step="any" value="${it.qty || ''}" placeholder="0"
        oninput="window._recipeDraftItems[${idx}].qty=Number(this.value)||0; recalcRecipeModalSummary();"
        class="w-16 px-2 py-1 rounded-lg border border-amber-400 text-right font-bold text-xs" />
      <span class="text-[10px] text-stone-500 w-9">${escHtml(it.unit)}</span>
      <button type="button" onclick="window._recipeDraftItems.splice(${idx},1); renderRecipeDraftRows();" class="text-rose-600 font-bold px-1">✕</button>
    </div>
  `).join('');
  recalcRecipeModalSummary();
}

function recalcRecipeModalSummary() {
  const sumBox = document.getElementById('rcpModalSummary');
  if (!sumBox) return;
  const sellPrice = Number(document.getElementById('rcpSell')?.value) || 0;
  const totalHpp = (window._recipeDraftItems || []).reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.unitCost) || 0)), 0);
  const profit = sellPrice - totalHpp;
  const marginPct = sellPrice > 0 ? ((profit / sellPrice) * 100).toFixed(1) : '0.0';
  sumBox.innerHTML = `
    <div class="flex justify-between"><span class="text-stone-600">Total HPP:</span><b class="text-stone-900">${formatRp(totalHpp)}</b></div>
    <div class="flex justify-between"><span class="text-stone-600">Gross Profit:</span><b class="${profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}">${formatRp(profit)} (${marginPct}%)</b></div>
  `;
}

async function submitRecipeForm(editRecipeId) {
  const name = (document.getElementById('rcpName')?.value || '').trim();
  const category = document.getElementById('rcpCat')?.value || 'Signature';
  const sellingPrice = Number(document.getElementById('rcpSell')?.value) || 0;
  const notes = (document.getElementById('rcpNotes')?.value || '').trim();
  const items = window._recipeDraftItems || [];
  const hpp = items.reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.unitCost) || 0)), 0);
  const margin = sellingPrice > 0 ? (((sellingPrice - hpp) / sellingPrice) * 100) : 0;

  if (!name) { showToast('Nama menu wajib diisi'); return; }
  closeModal();

  await postToBackend({
    action: 'saveRecipe',
    recipe: { id: editRecipeId || ('rcp_' + Date.now()), name, category, sellingPrice, ingredients: items, hpp, margin, notes }
  }, `Resep ${name} disimpan!`);
}

async function deleteRecipeAction(recipeId) {
  await postToBackend({ action: 'deleteRecipe', recipeId }, 'Resep dihapus');
}

// ==================== ROUTER & INIT ====================
function switchTab(tab) {
  STATE.activeTab = tab;
  renderCurrentTab();
}

function renderCurrentTab() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.getAttribute('data-tab') === STATE.activeTab;
    btn.className = active
      ? 'nav-btn flex flex-col items-center py-1 rounded-lg text-amber-700 font-bold'
      : 'nav-btn flex flex-col items-center py-1 rounded-lg text-stone-500';
  });

  const main = document.getElementById('mainContent');
  if (!main) return;

  if (STATE.activeTab === 'home') renderHomeTab(main);
  else if (STATE.activeTab === 'daily' && typeof renderDailyTab === 'function') renderDailyTab(main);
  else if (STATE.activeTab === 'parstock' || STATE.activeTab === 'monthly') renderParStockAndMonthlyTab(main);
  else if (STATE.activeTab === 'po' && typeof renderPoVendorTab === 'function') renderPoVendorTab(main);
  else if (STATE.activeTab === 'master') renderMasterTab(main);
}

window.addEventListener('DOMContentLoaded', () => {
  loadCacheFromLocal();
  renderCurrentTab();
  loadAllData(false);
});
