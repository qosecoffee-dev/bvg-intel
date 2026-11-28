// ==================== PASTRY & CAKE DISPLAY TRACKER + ALERT SETTINGS ====================
if (typeof SUB_CATEGORIES !== 'undefined' && Array.isArray(SUB_CATEGORIES)) {
  if (!SUB_CATEGORIES.includes('Pastry & Bakery')) {
    SUB_CATEGORIES.push('Pastry & Bakery');
  }
}

STATE.pastryDisplay = STATE.pastryDisplay || JSON.parse(localStorage.getItem('bvg_intel_pastry_cache') || '[]');
STATE.serverSettings = STATE.serverSettings || JSON.parse(localStorage.getItem('bvg_intel_settings_cache') || '{}');
STATE.pastryFilter = STATE.pastryFilter || 'ACTIVE';

// Tangkap otomatis data pastryDisplay & settings setiap kali syncAllData() berjalan
(function interceptGasSync() {
  if (window._pastryFetchHooked) return;
  window._pastryFetchHooked = true;
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = String(args[0] || '');
      const opts = args[1] || {};
      if ((!opts.method || opts.method.toUpperCase() === 'GET') && url.includes('script.google.com')) {
        res.clone().json().then(data => {
          if (data && data.status === 'ok') {
            STATE.pastryDisplay = Array.isArray(data.pastryDisplay) ? data.pastryDisplay : (STATE.pastryDisplay || []);
            STATE.serverSettings = data.settings || STATE.serverSettings || {};
            localStorage.setItem('bvg_intel_pastry_cache', JSON.stringify(STATE.pastryDisplay));
            localStorage.setItem('bvg_intel_settings_cache', JSON.stringify(STATE.serverSettings));
            if (typeof renderCurrentTab === 'function') renderCurrentTab();
          }
        }).catch(() => {});
      }
    } catch (e) {}
    return res;
  };
})();

function parseWibLocal(str) {
  if (!str) return null;
  const s = String(str).trim().replace('T', ' ');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0)
  );
}

function getNowWibInputStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function evaluatePastryBatch(batch) {
  const now = Date.now();
  const expDt = parseWibLocal(batch.expiresAt);
  const yelDt = parseWibLocal(batch.yellowAt);
  const expMs = expDt ? expDt.getTime() : now + 86400000;
  const yelMs = yelDt ? yelDt.getTime() : expMs;

  const diffMs = expMs - now;
  const absHours = Math.max(1, Math.round(Math.abs(diffMs) / 3600000));
  const absDays = Math.floor(absHours / 24);
  const remHours = absHours % 24;
  const timeText = absDays > 0 ? `${absDays} hr ${remHours} jam` : `${absHours} jam`;

  if (now >= expMs) {
    return {
      level: 'RED',
      priority: 1,
      badge: '🔴 EXPIRED • WAJIB TARIK',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      cardClass: 'bg-rose-50/70 border-rose-300',
      hintText: `Lewat batas ${timeText} lalu (${batch.expiresAt}). Segera cek fisik & tarik ke Waste!`
    };
  }
  if (now >= yelMs) {
    return {
      level: 'YELLOW',
      priority: 2,
      badge: '🟡 PROMO B1G1',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      cardClass: 'bg-amber-50/70 border-amber-300',
      hintText: `Sisa ±${timeText} sebelum expired (${batch.expiresAt}). Tawarkan promo Buy 1 Get 1 hari ini!`
    };
  }
  return {
    level: 'GREEN',
    priority: 3,
    badge: '🟢 FRESH DISPLAY',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cardClass: 'bg-white border-stone-200',
    hintText: `Aman • Sisa waktu ±${timeText} (Batas: ${batch.expiresAt})`
  };
}

function getPastryItemsMaster() {
  const list = (STATE.ingredients || []).filter(ing =>
    String(ing.subCategory || '').toLowerCase().includes('pastry') ||
    String(ing.subCategory || '').toLowerCase().includes('bakery') ||
    Number(ing.maxDisplay || 0) > 0
  );
  return list.length > 0 ? list : (STATE.ingredients || []);
}

function buildHomePastrySectionHtml() {
  const allBatches = Array.isArray(STATE.pastryDisplay) ? STATE.pastryDisplay : [];
  const activeBatches = allBatches
    .filter(b => String(b.status || '').toUpperCase() === 'ACTIVE' && Number(b.qtyRemaining || 0) > 0)
    .map(b => ({ ...b, eval: evaluatePastryBatch(b) }))
    .sort((a, b) => a.eval.priority - b.eval.priority);

  const redCount = activeBatches.filter(b => b.eval.level === 'RED').length;
  const yelCount = activeBatches.filter(b => b.eval.level === 'YELLOW').length;
  const grnCount = activeBatches.filter(b => b.eval.level === 'GREEN').length;
  const totalPcs = activeBatches.reduce((s, b) => s + (Number(b.qtyRemaining) || 0), 0);

  return `
    <section id="homePastrySection" class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-extrabold text-stone-900">🥐 Pastry &amp; Cake Display</h2>
          <p class="text-[11px] text-stone-500">Pantauan umur display, promo B1G1 &amp; tarik Waste</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="openPastryManagerModal('history')" class="px-2.5 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-[11px] font-bold active:scale-95">
            📋 Riwayat
          </button>
          <button onclick="openAddPastryBatchModal()" class="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-[11px] font-bold shadow-sm active:scale-95">
            + Display
          </button>
        </div>
      </div>

      <!-- Ringkasan Status Display -->
      <div class="grid grid-cols-4 gap-1.5 text-center">
        <div class="p-2 rounded-xl bg-rose-50 border border-rose-200">
          <div class="text-xs font-extrabold text-rose-700">🔴 ${redCount}</div>
          <div class="text-[9px] font-bold text-rose-900">Expired</div>
        </div>
        <div class="p-2 rounded-xl bg-amber-50 border border-amber-200">
          <div class="text-xs font-extrabold text-amber-800">🟡 ${yelCount}</div>
          <div class="text-[9px] font-bold text-amber-950">Promo B1G1</div>
        </div>
        <div class="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
          <div class="text-xs font-extrabold text-emerald-700">🟢 ${grnCount}</div>
          <div class="text-[9px] font-bold text-emerald-900">Aman</div>
        </div>
        <div class="p-2 rounded-xl bg-stone-100 border border-stone-200">
          <div class="text-xs font-extrabold text-stone-900">${formatNum(totalPcs)} pcs</div>
          <div class="text-[9px] font-bold text-stone-600">Di Etalase</div>
        </div>
      </div>

      ${activeBatches.length === 0 ? `
        <div class="p-4 rounded-xl bg-stone-50 border border-dashed border-stone-300 text-center space-y-2">
          <p class="text-xs text-stone-500">Belum ada batch pastry/cake aktif di etalase saat ini.</p>
          <div class="flex justify-center gap-2">
            <button onclick="openAddPastryBatchModal()" class="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-bold">
              + Catat Pastry Keluar Display
            </button>
            <button onclick="openPastryManagerModal('config')" class="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-800 text-[11px] font-bold">
              ⚙️ Atur Durasi Item
            </button>
          </div>
        </div>
      ` : `
        <div class="space-y-2">
          ${activeBatches.map(b => `
            <div class="p-3 rounded-xl border ${b.eval.cardClass} space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[10px] px-2 py-0.5 rounded-full border font-extrabold ${b.eval.badgeClass}">${b.eval.badge}</span>
                    <span class="text-[10px] text-stone-500 font-semibold">👤 ${escHtml(b.picInput || '-')}</span>
                  </div>
                  <h3 class="text-xs font-extrabold text-stone-900 mt-1">${escHtml(b.ingName)}</h3>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-sm font-extrabold text-stone-900">${formatNum(b.qtyRemaining)}</span>
                  <span class="text-[10px] text-stone-500 font-bold">/ ${formatNum(b.qtyInitial)} pcs</span>
                </div>
              </div>

              <p class="text-[11px] font-medium ${b.eval.level === 'RED' ? 'text-rose-800' : (b.eval.level === 'YELLOW' ? 'text-amber-900' : 'text-stone-600')}">
                ${escHtml(b.eval.hintText)}
              </p>

              ${b.notes ? `<p class="text-[10px] text-stone-500 italic">Catatan: ${escHtml(b.notes)}</p>` : ''}

              <div class="grid grid-cols-4 gap-1 pt-1 border-t border-stone-200/70">
                <button onclick="openUpdatePastryModal('${escHtml(b.batchId)}', 'PARTIAL')"
                  class="py-1.5 px-1 rounded-lg bg-stone-100 text-stone-800 text-[10px] font-bold active:scale-95">
                  - Terjual
                </button>
                <button onclick="openUpdatePastryModal('${escHtml(b.batchId)}', 'SOLD')"
                  class="py-1.5 px-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold active:scale-95">
                  ✓ Habis
                </button>
                <button onclick="openUpdatePastryModal('${escHtml(b.batchId)}', 'B1G1')"
                  class="py-1.5 px-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold active:scale-95">
                  🏷️ B1G1
                </button>
                <button onclick="openUpdatePastryModal('${escHtml(b.batchId)}', 'WASTE')"
                  class="py-1.5 px-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold active:scale-95">
                  🗑️ Waste
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      <div class="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px]">
        <button onclick="openPastryManagerModal('config')" class="font-bold text-amber-800 underline">
          ⚙️ Atur Durasi Display &amp; Item Pastry
        </button>
        <button onclick="openEmailAlertSettingsModal()" class="font-bold text-stone-600 underline">
          📧 Email Alert (10.00 WIB)
        </button>
      </div>
    </section>
  `;
}

// ==================== MODAL: TAMBAH BATCH PASTRY KE DISPLAY ====================
function openAddPastryBatchModal() {
  const items = getPastryItemsMaster();
  openModal('🥐 Keluarkan Pastry / Cake ke Display', `
    <div class="space-y-3">
      <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950">
        <span>Item pastry belum ada?</span>
        <button type="button" onclick="openPastryManagerModal('config')" class="font-extrabold underline text-amber-800">
          + Tambah / Atur Durasi
        </button>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Pilih Item Pastry / Cake</label>
        <select id="pstSelectIng" onchange="onPastryItemSelectChange(this.value)"
          class="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-bold">
          <option value="">-- Pilih Item Pastry --</option>
          ${items.map(it => {
            const maxD = Number(it.maxDisplay || 0);
            const uD = it.displayUnit || 'Hari';
            const yL = Number(it.yellowLead || 0);
            const info = maxD > 0 ? ` (${maxD} ${uD}, B1G1 -${yL} ${uD})` : ' (Belum diatur durasi)';
            return `<option value="${escHtml(it.id)}">${escHtml(it.name)}${info}</option>`;
          }).join('')}
        </select>
      </div>

      <div id="pstRulePreview" class="hidden px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-700"></div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Jumlah Keluar (pcs)</label>
          <input id="pstQtyInput" type="number" inputmode="numeric" placeholder="Contoh: 6"
            class="w-full px-3 py-2 rounded-xl border border-amber-400 text-xs font-extrabold focus:outline-none" />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Waktu Mulai Display</label>
          <input id="pstStartInput" type="datetime-local" value="${getNowWibInputStr()}"
            class="w-full px-2 py-2 rounded-xl border border-stone-300 text-[11px] bg-white" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Catatan (Opsional)</label>
        <input id="pstNotesInput" type="text" placeholder="Contoh: Kloter pagi etalase atas"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>

      ${renderPicPinBoxHtml('pstAddAuth', 'PIC Pengeluar Display')}

      <button onclick="submitAddPastryBatch()"
        class="w-full py-3 rounded-xl bg-amber-600 text-white font-extrabold text-xs shadow-md active:scale-95">
        💾 Catat ke Display Sekarang
      </button>
    </div>
  `);
}

function onPastryItemSelectChange(ingId) {
  const el = document.getElementById('pstRulePreview');
  if (!el) return;
  const ing = (STATE.ingredients || []).find(x => String(x.id) === String(ingId));
  if (!ing) {
    el.classList.add('hidden');
    return;
  }
  const maxD = Number(ing.maxDisplay || 0) || 1;
  const uD = ing.displayUnit || 'Hari';
  const yL = Number(ing.yellowLead || 0);
  el.classList.remove('hidden');
  el.innerHTML = `⏱️ <b>Aturan Item:</b> Maksimal display <b>${maxD} ${escHtml(uD)}</b> • Alert Kuning (B1G1) mulai <b>${yL} ${escHtml(uD)}</b> sebelum expired.`;
}

async function submitAddPastryBatch() {
  const ingId = document.getElementById('pstSelectIng')?.value || '';
  const qty = Number(document.getElementById('pstQtyInput')?.value) || 0;
  const startedAt = document.getElementById('pstStartInput')?.value || '';
  const notes = (document.getElementById('pstNotesInput')?.value || '').trim();

  if (!ingId || qty <= 0) {
    showToast('Pilih item pastry dan isi jumlah pcs > 0');
    return;
  }
  const auth = getPicPinValues('pstAddAuth');
  if (!auth) return;

  closeModal();
  await postToBackend({
    action: 'addPastryBatch',
    ingId,
    qty,
    startedAt,
    notes,
    picName: auth.picName,
    pin: auth.pin
  }, 'Pastry berhasil dicatat ke display!');
}

// ==================== MODAL: UPDATE STATUS / SISA BATCH PASTRY ====================
function openUpdatePastryModal(batchId, mode) {
  const batch = (STATE.pastryDisplay || []).find(b => String(b.batchId) === String(batchId));
  if (!batch) return;

  const titles = {
    PARTIAL: 'Catat Penjualan Sebagian (Partial)',
    SOLD: 'Konfirmasi Habis Terjual (Normal)',
    B1G1: 'Konfirmasi Terjual Promo B1G1',
    WASTE: 'Tarik Sisa Display ke Waste'
  };
  const btnColors = {
    PARTIAL: 'bg-stone-900',
    SOLD: 'bg-emerald-600',
    B1G1: 'bg-amber-600',
    WASTE: 'bg-rose-600'
  };

  openModal(titles[mode] || 'Update Status Pastry', `
    <div class="space-y-3">
      <div class="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
        <div class="font-extrabold text-stone-900">${escHtml(batch.ingName)}</div>
        <div class="text-[11px] text-stone-600">Sisa di etalase saat ini: <b>${formatNum(batch.qtyRemaining)} pcs</b> (Awal: ${formatNum(batch.qtyInitial)} pcs)</div>
        <div class="text-[11px] text-stone-500">Batas Expired: <b>${escHtml(batch.expiresAt)}</b></div>
      </div>

      ${mode === 'PARTIAL' ? `
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Jumlah Terjual Sekarang (pcs)</label>
          <input id="pstSoldQtyInput" type="number" inputmode="numeric" max="${batch.qtyRemaining}" min="1" placeholder="1 - ${batch.qtyRemaining}"
            class="w-full px-3 py-2 rounded-xl border border-amber-400 text-xs font-extrabold" />
        </div>
      ` : `
        <p class="text-xs text-stone-700 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl">
          Seluruh sisa <b>${formatNum(batch.qtyRemaining)} pcs</b> akan ditutup dengan status <b>${mode}</b>.
        </p>
      `}

      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Keterangan (Opsional)</label>
        <input id="pstUpdNote" type="text" placeholder="Contoh: Promo B1G1 shift sore / berjamur"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>

      ${renderPicPinBoxHtml('pstUpdAuth', 'PIC Konfirmasi Update')}

      <button onclick="submitUpdatePastryBatch('${escHtml(batch.batchId)}', '${mode}')"
        class="w-full py-3 rounded-xl ${btnColors[mode] || 'bg-stone-900'} text-white font-extrabold text-xs shadow-md active:scale-95">
        💾 Simpan Update Status
      </button>
    </div>
  `);
}

async function submitUpdatePastryBatch(batchId, mode) {
  const soldQty = mode === 'PARTIAL' ? (Number(document.getElementById('pstSoldQtyInput')?.value) || 0) : 0;
  if (mode === 'PARTIAL' && soldQty <= 0) {
    showToast('Masukkan jumlah pcs terjual > 0');
    return;
  }
  const notes = (document.getElementById('pstUpdNote')?.value || '').trim();
  const auth = getPicPinValues('pstUpdAuth');
  if (!auth) return;

  closeModal();
  await postToBackend({
    action: 'updatePastryBatch',
    batchId,
    mode,
    soldQty,
    notes,
    picName: auth.picName,
    pin: auth.pin
  }, 'Status display pastry diperbarui!');
}

// ==================== MODAL: ATUR DURASI ITEM & RIWAYAT PASTRY ====================
function openPastryManagerModal(tab = 'config') {
  const pastryItems = (STATE.ingredients || []).filter(ing =>
    String(ing.subCategory || '').toLowerCase().includes('pastry') ||
    String(ing.subCategory || '').toLowerCase().includes('bakery') ||
    Number(ing.maxDisplay || 0) > 0
  );
  const historyList = [...(STATE.pastryDisplay || [])].reverse();

  openModal('🥐 Manajemen & Aturan Display Pastry', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-1 p-1 bg-stone-200 rounded-xl">
        <button onclick="openPastryManagerModal('config')"
          class="py-1.5 rounded-lg text-xs font-bold ${tab === 'config' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
          ⚙️ Aturan Durasi (${pastryItems.length})
        </button>
        <button onclick="openPastryManagerModal('history')"
          class="py-1.5 rounded-lg text-xs font-bold ${tab === 'history' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
          📋 Riwayat Display (${historyList.length})
        </button>
      </div>

      ${tab === 'config' ? `
        <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
          <p class="text-[11px] font-bold text-amber-950">+ Tambah Item Pastry Baru ke Master</p>
          <input id="newPstName" type="text" placeholder="Nama Pastry / Cake (misal: Butter Croissant)"
            class="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs" />
          <div class="grid grid-cols-3 gap-1.5">
            <div>
              <label class="block text-[9px] font-bold text-stone-500">Max Display</label>
              <input id="newPstMax" type="number" value="5"
                class="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold" />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-stone-500">Satuan</label>
              <select id="newPstUnit" class="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold">
                <option value="Hari">Hari</option>
                <option value="Jam">Jam</option>
              </select>
            </div>
            <div>
              <label class="block text-[9px] font-bold text-stone-500">Alert B1G1 (-)</label>
              <input id="newPstYel" type="number" value="1"
                class="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold" />
            </div>
          </div>
          <button onclick="submitNewPastryMasterItem()"
            class="w-full py-2 rounded-xl bg-stone-900 text-white text-xs font-bold active:scale-95">
            + Simpan Item Pastry Baru
          </button>
        </div>

        <div class="space-y-2 max-h-72 overflow-y-auto">
          ${pastryItems.length === 0 ? `
            <p class="text-xs text-stone-500 text-center py-4">Belum ada item kategori Pastry &amp; Bakery. Tambahkan di form atas.</p>
          ` : pastryItems.map(it => `
            <div class="p-2.5 rounded-xl border border-stone-200 bg-white space-y-2">
              <div class="text-xs font-extrabold text-stone-900">${escHtml(it.name)}</div>
              <div class="grid grid-cols-4 gap-1.5 items-end">
                <div>
                  <label class="block text-[9px] text-stone-400">Max</label>
                  <input id="cfgMax_${escHtml(it.id)}" type="number" value="${Number(it.maxDisplay) || 5}"
                    class="w-full px-2 py-1 rounded-lg border border-stone-300 text-xs font-bold" />
                </div>
                <div>
                  <label class="block text-[9px] text-stone-400">Satuan</label>
                  <select id="cfgUnit_${escHtml(it.id)}" class="w-full px-1.5 py-1 rounded-lg border border-stone-300 text-xs font-bold">
                    <option value="Hari" ${(it.displayUnit || 'Hari') === 'Hari' ? 'selected' : ''}>Hari</option>
                    <option value="Jam" ${it.displayUnit === 'Jam' ? 'selected' : ''}>Jam</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[9px] text-stone-400">B1G1 (-)</label>
                  <input id="cfgYel_${escHtml(it.id)}" type="number" value="${Number(it.yellowLead) || 1}"
                    class="w-full px-2 py-1 rounded-lg border border-stone-300 text-xs font-bold" />
                </div>
                <button onclick="saveExistingPastryConfig('${escHtml(it.id)}')"
                  class="py-1.5 px-2 rounded-lg bg-amber-600 text-white text-[10px] font-bold">
                  Simpan
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <button onclick="downloadPastryHistoryPdf()" class="w-full py-2 rounded-xl bg-stone-900 text-white text-xs font-bold">
          📄 Download PDF Laporan Display Pastry
        </button>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          ${historyList.length === 0 ? `
            <p class="text-xs text-stone-500 text-center py-6">Belum ada riwayat display pastry.</p>
          ` : historyList.map(h => `
            <div class="p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-[11px] space-y-1">
              <div class="flex items-center justify-between">
                <b class="text-stone-900">${escHtml(h.ingName)}</b>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-stone-200 text-stone-800">${escHtml(h.status)}</span>
              </div>
              <div class="text-stone-600">Awal: <b>${h.qtyInitial} pcs</b> • Sisa: <b>${h.qtyRemaining} pcs</b> • PIC: ${escHtml(h.picUpdate || h.picInput || '-')}</div>
              <div class="text-[10px] text-stone-400">Mulai: ${escHtml(h.startedAt)} • Exp: ${escHtml(h.expiresAt)}</div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `);
}

async function submitNewPastryMasterItem() {
  const name = (document.getElementById('newPstName')?.value || '').trim();
  const maxDisplay = Number(document.getElementById('newPstMax')?.value) || 5;
  const displayUnit = document.getElementById('newPstUnit')?.value || 'Hari';
  const yellowLead = Number(document.getElementById('newPstYel')?.value) || 1;
  if (!name) {
    showToast('Isi nama item pastry terlebih dahulu');
    return;
  }
  closeModal();
  await postToBackend({
    action: 'saveIngredient',
    ingredient: {
      id: 'ing_' + Date.now(),
      name,
      subCategory: 'Pastry & Bakery',
      buyPrice: 0,
      packSize: 1,
      unit: 'pcs',
      unitCost: 0,
      minStock: 0,
      maxDisplay,
      displayUnit,
      yellowLead
    }
  }, `Item ${name} ditambahkan!`);
}

async function saveExistingPastryConfig(ingId) {
  const maxDisplay = Number(document.getElementById('cfgMax_' + ingId)?.value) || 1;
  const displayUnit = document.getElementById('cfgUnit_' + ingId)?.value || 'Hari';
  const yellowLead = Number(document.getElementById('cfgYel_' + ingId)?.value) || 0;
  await postToBackend({
    action: 'savePastryConfig',
    ingId,
    maxDisplay,
    displayUnit,
    yellowLead
  }, 'Aturan durasi display diperbarui!');
}

function downloadPastryHistoryPdf() {
  const doc = typeof createPdfDoc === 'function' ? createPdfDoc('l') : null;
  if (!doc) return;
  const rows = (STATE.pastryDisplay || []).map((b, idx) => [
    idx + 1,
    b.ingName,
    `${b.qtyInitial} pcs`,
    `${b.qtyRemaining} pcs`,
    b.startedAt,
    b.expiresAt,
    b.status,
    b.picInput || '-',
    b.picUpdate || '-',
    b.notes || '-'
  ]);

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('QOSE COFFEE — LAPORAN DISPLAY PASTRY & CAKE', 12, 14);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  doc.text(`Dicetak: ${getLocalTodayStr()}   |   Total Batch Tercatat: ${rows.length}`, 12, 20);

  doc.autoTable({
    startY: 24,
    margin: { left: 10, right: 10 },
    head: [['No', 'Nama Pastry / Cake', 'Awal', 'Sisa', 'Waktu Mulai', 'Batas Expired', 'Status', 'PIC Awal', 'PIC Update', 'Catatan']],
    body: rows.length ? rows : [['-', 'Belum ada data display pastry', '', '', '', '', '', '', '', '']],
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' }
  });

  doc.save(`Laporan-Pastry-Display-Qose-${getLocalTodayStr()}.pdf`);
  showToast('PDF Display Pastry berhasil diunduh');
}

// ==================== MODAL: PENGATURAN 4 EMAIL ALERT (10.00 WIB) ====================
function openEmailAlertSettingsModal() {
  const s = STATE.serverSettings || {};
  const enabled = String(s.ALERT_ENABLED || 'TRUE').toUpperCase() !== 'FALSE';

  openModal('📧 Pengaturan Email Alert Otomatis (10.00 WIB)', `
    <div class="space-y-3">
      <p class="text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
        Setiap pukul <b>10.00 WIB</b>, sistem mengirim 1 email gabungan berisi daftar <b>Pastry B1G1 / Expired</b> dan <b>Par Stock kritis</b> ke maksimal 4 email berikut (tidak mengirim jika semua aman).
      </p>

      <label class="flex items-center gap-2 text-xs font-bold text-stone-800">
        <input id="setAlertEnabled" type="checkbox" ${enabled ? 'checked' : ''} class="w-4 h-4 accent-amber-600" />
        Aktifkan Notifikasi Email Pagi (10.00 WIB)
      </label>

      <div>
        <label class="block text-[11px] font-bold text-stone-700 mb-1">Email Penerima 1 (Head Bar / Utama)</label>
        <input id="setEmail1" type="email" value="${escHtml(s.ALERT_EMAIL_1 || 'qosecoffeeinventory@gmail.com')}"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div>
        <label class="block text-[11px] font-bold text-stone-700 mb-1">Email Penerima 2 (SPV / Manager)</label>
        <input id="setEmail2" type="email" value="${escHtml(s.ALERT_EMAIL_2 || '')}" placeholder="opsional@gmail.com"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div>
        <label class="block text-[11px] font-bold text-stone-700 mb-1">Email Penerima 3 (Owner / Manajemen)</label>
        <input id="setEmail3" type="email" value="${escHtml(s.ALERT_EMAIL_3 || '')}" placeholder="opsional@gmail.com"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div>
        <label class="block text-[11px] font-bold text-stone-700 mb-1">Email Penerima 4 (Cadangan / Outlet)</label>
        <input id="setEmail4" type="email" value="${escHtml(s.ALERT_EMAIL_4 || '')}" placeholder="opsional@gmail.com"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>

      <button onclick="submitEmailAlertSettings()"
        class="w-full py-3 rounded-xl bg-stone-900 text-white font-extrabold text-xs active:scale-95">
        💾 Simpan 4 Penerima Email Alert
      </button>
    </div>
  `);
}

async function submitEmailAlertSettings() {
  const payloadSettings = {
    ALERT_ENABLED: document.getElementById('setAlertEnabled')?.checked ? 'TRUE' : 'FALSE',
    ALERT_EMAIL_1: (document.getElementById('setEmail1')?.value || '').trim(),
    ALERT_EMAIL_2: (document.getElementById('setEmail2')?.value || '').trim(),
    ALERT_EMAIL_3: (document.getElementById('setEmail3')?.value || '').trim(),
    ALERT_EMAIL_4: (document.getElementById('setEmail4')?.value || '').trim()
  };
  closeModal();
  const ok = await postToBackend({
    action: 'saveSettings',
    settings: payloadSettings
  }, 'Pengaturan 4 email alert berhasil disimpan!');
  if (ok) {
    STATE.serverSettings = { ...(STATE.serverSettings || {}), ...payloadSettings };
    localStorage.setItem('bvg_intel_settings_cache', JSON.stringify(STATE.serverSettings));
  }
}

// ==================== HOOK KE DASHBOARD HOME & PENGATURAN ====================
(function attachPastryToHomeAndSettings() {
  const origRenderHome = window.renderHomeTab;
  window.renderHomeTab = function (main) {
    if (typeof origRenderHome === 'function') {
      origRenderHome(main);
    }
    if (main && !document.getElementById('homePastrySection')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildHomePastrySectionHtml();
      const firstChild = main.firstElementChild;
      if (firstChild && firstChild.nextSibling) {
        main.insertBefore(wrapper.firstElementChild, firstChild.nextSibling);
      } else {
        main.appendChild(wrapper.firstElementChild);
      }
    }
  };

  const origOpenSettings = window.openSettingsModal;
  window.openSettingsModal = function () {
    if (typeof origOpenSettings === 'function') origOpenSettings();
    const body = document.getElementById('modalBody');
    if (body && !document.getElementById('btnOpenEmailAlertsFromSettings')) {
      const btn = document.createElement('button');
      btn.id = 'btnOpenEmailAlertsFromSettings';
      btn.type = 'button';
      btn.className = 'w-full py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs mt-2';
      btn.textContent = '📧 Atur 4 Penerima Email Alert (10.00 WIB)';
      btn.onclick = () => openEmailAlertSettingsModal();
      body.appendChild(btn);
    }
  };
})();
