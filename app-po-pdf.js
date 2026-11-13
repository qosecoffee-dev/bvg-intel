// ==================== PO & VENDOR DIRECTORY TAB ====================
function setPoDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const maxDay = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(day)), maxDay);
  STATE.poDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  renderCurrentTab();
}

function quickOrderFromAlert(ingId) {
  STATE.activeTab = 'po';
  STATE.poSubTab = 'po';
  STATE.poDate = new Date().toISOString().slice(0, 10);
  renderCurrentTab();
  setTimeout(() => openPurchaseOrderModal(null, ingId), 80);
}

function renderPoVendorTab(main) {
  const isPo = STATE.poSubTab === 'po';
  const [yStr, mStr, dStr] = STATE.poDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const dailyOrders = STATE.purchaseOrders.filter(o => String(o.poDate) === STATE.poDate);
  const filteredVendors = STATE.vendors.filter(v => {
    const q = STATE.vendorSearch.toLowerCase();
    return !q ||
      String(v.ingName || '').toLowerCase().includes(q) ||
      String(v.supplier1 || '').toLowerCase().includes(q) ||
      String(v.supplier2 || '').toLowerCase().includes(q) ||
      String(v.supplier3 || '').toLowerCase().includes(q);
  });

  main.innerHTML = `
    <div class="grid grid-cols-2 gap-1.5 p-1 bg-stone-200 rounded-xl mb-3">
      <button onclick="STATE.poSubTab='po'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold ${isPo ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
        🛒 Purchasing Order (${dailyOrders.length})
      </button>
      <button onclick="STATE.poSubTab='vendor'; renderCurrentTab();"
        class="py-2 rounded-lg text-xs font-bold ${!isPo ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}">
        🚚 Vendor Directory (${STATE.vendors.length})
      </button>
    </div>

    ${isPo ? `
      <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-stone-900">Purchasing Order Bar</h2>
            <p class="text-[11px] text-stone-500">Order tersimpan otomatis sesuai tanggal pengajuan</p>
          </div>
          <button onclick="openPurchaseOrderModal()" class="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-[11px] font-bold shrink-0 active:scale-95">
            + Order Bahan Baku Bar
          </button>
        </div>

        <div class="grid grid-cols-3 gap-1.5">
          <select onchange="setPoDateParts('${yStr}', '${mStr}', this.value)" class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
            ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
              const val = String(d).padStart(2, '0');
              return `<option value="${val}" ${val === dStr ? 'selected' : ''}>Tgl ${d}</option>`;
            }).join('')}
          </select>
          <select onchange="setPoDateParts('${yStr}', this.value, '${dStr}')" class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
            ${months.map((lbl, idx) => {
              const val = String(idx + 1).padStart(2, '0');
              return `<option value="${val}" ${val === mStr ? 'selected' : ''}>${lbl}</option>`;
            }).join('')}
          </select>
          <select onchange="setPoDateParts(this.value, '${mStr}', '${dStr}')" class="px-2 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold">
            ${[2025, 2026, 2027, 2028].map(yr => `<option value="${yr}" ${String(yr) === yStr ? 'selected' : ''}>${yr}</option>`).join('')}
          </select>
        </div>

        <button onclick="downloadPoPdf()" class="w-full py-2 rounded-xl bg-stone-900 text-white text-xs font-bold active:scale-95">
          📄 Download PDF Purchasing Order (${dStr}/${mStr}/${yStr})
        </button>
      </section>

      <section class="space-y-2.5">
        ${dailyOrders.length === 0 ? `
          <div class="bg-white p-8 rounded-2xl text-center border border-stone-200">
            <p class="text-xs font-semibold text-stone-500">Belum ada Purchasing Order pada tanggal ${STATE.poDate}.</p>
            <button onclick="openPurchaseOrderModal()" class="mt-2.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">
              + Buat Order Pertama
            </button>
          </div>
        ` : dailyOrders.map(po => `
          <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">${escHtml(po.subCategory || 'Bahan Bar')}</span>
                <h3 class="text-xs font-bold text-stone-900 mt-1">${escHtml(po.ingName)}</h3>
              </div>
              <div class="flex gap-1">
                <button onclick='openPurchaseOrderModal(${JSON.stringify(po).replace(/'/g, "&#39;")})' class="w-7 h-7 rounded-lg bg-stone-100 text-xs">✏️</button>
                <button onclick="deletePoAction('${escHtml(po.poId)}')" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 text-xs">🗑️</button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-stone-100 text-[11px]">
              <div>
                <span class="text-stone-400 block text-[10px]">Sisa Stock</span>
                <b>${formatNum(po.sisaStock)} ${escHtml(po.unit)}</b>
              </div>
              <div>
                <span class="text-stone-400 block text-[10px]">Jumlah Order</span>
                <b class="text-amber-700">${formatNum(po.qtyOrder)} ${escHtml(po.unit)}</b>
              </div>
              <div>
                <span class="text-stone-400 block text-[10px]">Tgl Dibutuhkan</span>
                <b>${escHtml(po.neededDate || '-')}</b>
              </div>
            </div>
            ${po.notes ? `<p class="mt-2 text-[11px] text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg">Ket: ${escHtml(po.notes)}</p>` : ''}
          </div>
        `).join('')}
      </section>
    ` : `
      <section class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200 mb-3 space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-stone-900">Vendor Directory</h2>
            <p class="text-[11px] text-stone-500">Daftar supplier utama &amp; cadangan per bahan</p>
          </div>
          <button onclick="openAddVendorModal()" class="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold shrink-0 active:scale-95">
            + Supplier
          </button>
        </div>
        <div class="flex gap-2">
          <input type="text" value="${escHtml(STATE.vendorSearch)}" oninput="STATE.vendorSearch=this.value; renderCurrentTab();"
            placeholder="Cari bahan atau nama supplier..." class="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs" />
          <button onclick="downloadVendorPdf()" class="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shrink-0">
            📄 PDF
          </button>
        </div>
      </section>

      <section class="space-y-2.5">
        ${filteredVendors.length === 0 ? `
          <div class="bg-white p-8 rounded-2xl text-center border border-stone-200 text-xs text-stone-500">
            Belum ada data supplier. Ketuk <b>+ Supplier</b> untuk menambahkan.
          </div>
        ` : filteredVendors.map(v => `
          <div class="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <p class="text-xs font-bold text-stone-900">${escHtml(v.ingName)}</p>
                <p class="text-[10px] text-stone-400">${escHtml(v.subCategory || '')}</p>
              </div>
              <div class="flex gap-1">
                <button onclick='openAddVendorModal(${JSON.stringify(v).replace(/'/g, "&#39;")})' class="w-7 h-7 rounded-lg bg-stone-100 text-xs">✏️</button>
                <button onclick="deleteVendorAction('${escHtml(v.vendorId)}')" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 text-xs">🗑️</button>
              </div>
            </div>
            <div class="space-y-1 text-[11px]">
              <div class="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                <b>Supplier 1:</b> ${escHtml(v.supplier1 || '-')}
              </div>
              ${v.supplier2 ? `<div class="px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200"><b>Supplier 2:</b> ${escHtml(v.supplier2)}</div>` : ''}
              ${v.supplier3 ? `<div class="px-2.5 py-1.5 rounded-lg bg-stone-50 border border-stone-200"><b>Supplier 3:</b> ${escHtml(v.supplier3)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </section>
    `}
  `;
}

function openPurchaseOrderModal(editPo = null, preselectIngId = null) {
  const sorted = getSortedIngredients();
  const targetIngId = editPo ? editPo.ingId : (preselectIngId || (sorted[0] ? sorted[0].id : ''));
  const selectedIng = sorted.find(x => String(x.id) === String(targetIngId)) || sorted[0] || { id: '', name: '', unit: 'gram', subCategory: '' };
  const autoStock = editPo ? editPo.sisaStock : getCurrentStock(selectedIng.id);

  openModal(editPo ? 'Edit Order Bahan Baku' : '+ Order Bahan Baku Bar', `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Nama Bahan Baku</label>
        <select id="poIngSelect" onchange="onPoIngredientSelectChange()" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white font-semibold">
          ${sorted.map(ing => `
            <option value="${escHtml(ing.id)}" ${String(ing.id) === String(selectedIng.id) ? 'selected' : ''}>
              ${escHtml(ing.name)} (${escHtml(ing.subCategory)} - ${escHtml(ing.unit)})
            </option>
          `).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Sisa Stock (<span id="poUnitLabel1">${escHtml(selectedIng.unit)}</span>)</label>
          <input id="poSisaStock" type="number" step="any" value="${autoStock}"
            class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-stone-50 font-bold" />
        </div>
        <div>
          <label class="block text-xs font-bold text-stone-700 mb-1">Jumlah Order (<span id="poUnitLabel2">${escHtml(selectedIng.unit)}</span>)</label>
          <input id="poQtyOrder" type="number" step="any" value="${editPo ? editPo.qtyOrder : ''}" placeholder="Masukkan jumlah"
            class="w-full px-3 py-2 rounded-xl border border-amber-400 text-xs font-bold focus:outline-none" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Tanggal yang Dibutuhkan</label>
        <input id="poNeededDate" type="date" value="${editPo ? (editPo.neededDate || STATE.poDate) : STATE.poDate}"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white" />
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Keterangan</label>
        <textarea id="poNotes" rows="2" placeholder="Catatan kemasan, merk, atau urgensi..."
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs">${escHtml(editPo ? (editPo.notes || '') : '')}</textarea>
      </div>
      <button onclick="submitPurchaseOrderForm('${editPo ? escHtml(editPo.poId) : ''}')"
        class="w-full py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs active:scale-95">
        💾 Save Order (${STATE.poDate})
      </button>
    </div>
  `);
}

function onPoIngredientSelectChange() {
  const ingId = document.getElementById('poIngSelect')?.value;
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  if (!ing) return;
  const stockEl = document.getElementById('poSisaStock');
  if (stockEl) stockEl.value = getCurrentStock(ing.id);
  const u1 = document.getElementById('poUnitLabel1');
  const u2 = document.getElementById('poUnitLabel2');
  if (u1) u1.textContent = ing.unit;
  if (u2) u2.textContent = ing.unit;
}

async function submitPurchaseOrderForm(editPoId) {
  const ingId = document.getElementById('poIngSelect')?.value || '';
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  const sisaStock = Number(document.getElementById('poSisaStock')?.value) || 0;
  const qtyOrder = Number(document.getElementById('poQtyOrder')?.value) || 0;
  const neededDate = document.getElementById('poNeededDate')?.value || '';
  const notes = (document.getElementById('poNotes')?.value || '').trim();

  if (!ing || qtyOrder <= 0) {
    showToast('Pilih bahan dan isi jumlah order > 0');
    return;
  }
  closeModal();

  await postToBackend({
    action: 'savePurchaseOrder',
    order: {
      poId: editPoId || ('po_' + Date.now()),
      poDate: STATE.poDate,
      ingId: ing.id,
      ingName: ing.name,
      subCategory: ing.subCategory,
      unit: ing.unit,
      sisaStock,
      qtyOrder,
      neededDate,
      notes
    }
  }, `Order ${ing.name} tersimpan!`);
}

async function deletePoAction(poId) {
  await postToBackend({ action: 'deletePurchaseOrder', poId }, 'Item order dihapus');
}

function openAddVendorModal(editVendor = null) {
  const sorted = getSortedIngredients();
  const selId = editVendor ? editVendor.ingId : (sorted[0] ? sorted[0].id : '');

  openModal(editVendor ? 'Edit Supplier Bahan' : '+ Tambah Supplier Bahan', `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Nama Bahan</label>
        <select id="vndIngSelect" class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white font-semibold">
          ${sorted.map(ing => `
            <option value="${escHtml(ing.id)}" ${String(ing.id) === String(selId) ? 'selected' : ''}>
              ${escHtml(ing.name)} (${escHtml(ing.subCategory)})
            </option>
          `).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Supplier 1 (Utama)</label>
        <input id="vndSup1" type="text" value="${escHtml(editVendor ? (editVendor.supplier1 || '') : '')}" placeholder="Nama supplier / toko / kontak WA"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Supplier 2 (Opsional)</label>
        <input id="vndSup2" type="text" value="${escHtml(editVendor ? (editVendor.supplier2 || '') : '')}" placeholder="Supplier cadangan 1 (opsional)"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <div>
        <label class="block text-xs font-bold text-stone-700 mb-1">Supplier 3 (Opsional)</label>
        <input id="vndSup3" type="text" value="${escHtml(editVendor ? (editVendor.supplier3 || '') : '')}" placeholder="Supplier cadangan 2 (opsional)"
          class="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs" />
      </div>
      <button onclick="submitVendorForm('${editVendor ? escHtml(editVendor.vendorId) : ''}')"
        class="w-full py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs active:scale-95">
        💾 Simpan Supplier
      </button>
    </div>
  `);
}

async function submitVendorForm(editVendorId) {
  const ingId = document.getElementById('vndIngSelect')?.value || '';
  const ing = STATE.ingredients.find(x => String(x.id) === String(ingId));
  const supplier1 = (document.getElementById('vndSup1')?.value || '').trim();
  const supplier2 = (document.getElementById('vndSup2')?.value || '').trim();
  const supplier3 = (document.getElementById('vndSup3')?.value || '').trim();

  if (!ing || !supplier1) {
    showToast('Nama bahan dan Supplier 1 wajib diisi');
    return;
  }
  closeModal();

  await postToBackend({
    action: 'saveVendor',
    vendor: {
      vendorId: editVendorId || ('vnd_' + Date.now()),
      ingId: ing.id,
      ingName: ing.name,
      subCategory: ing.subCategory,
      supplier1,
      supplier2,
      supplier3
    }
  }, `Supplier untuk ${ing.name} disimpan!`);
}

async function deleteVendorAction(vendorId) {
  await postToBackend({ action: 'deleteVendor', vendorId }, 'Data supplier dihapus');
}

// ==================== PDF GENERATORS ====================
function createPdfDoc(orientation = 'p') {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Modul PDF sedang dimuat, coba sesaat lagi');
    return null;
  }
  return new window.jspdf.jsPDF(orientation, 'mm', 'a4');
}

function downloadDailyPdf() {
  const doc = createPdfDoc('p');
  if (!doc) return;
  const dateStr = STATE.selectedDate;
  const sorted = getSortedIngredients();

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('QOSE COFFEE — DAILY INVENTORY BAR', 14, 15);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Tanggal Laporan: ${dateStr}   |   Rumus: CL = IN - OUT`, 14, 21);

  const body = sorted.map((ing, idx) => {
    const rec = getDailyRecord(dateStr, ing.id);
    const cl = rec.inQty - rec.outQty;
    return [
      idx + 1,
      ing.name,
      ing.subCategory,
      ing.unit,
      formatNum(rec.inQty),
      formatNum(rec.outQty),
      formatNum(cl)
    ];
  });

  doc.autoTable({
    startY: 25,
    head: [['No', 'Nama Bahan', 'Sub Kategori', 'Satuan', 'IN', 'OUT', 'CL']],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 58 },
      2: { cellWidth: 34 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
    }
  });

  doc.save(`Daily-Inventory-Qose-${dateStr}.pdf`);
  showToast('PDF Harian berhasil diunduh');
}

function downloadMonthlyPdf() {
  const doc = createPdfDoc('l');
  if (!doc) return;
  const [yStr, mStr] = STATE.selectedDate.split('-');
  const mKey = `${yStr}-${mStr}`;
  const sorted = getSortedIngredients();
  const summaryMap = getMonthlySummaryMap(mKey);

  // Lookup daily entries per ingredient & day (1..31)
  const dayMap = {};
  STATE.invDaily.filter(r => String(r.monthKey) === mKey).forEach(r => {
    dayMap[`${r.ingId}__${Number(r.day)}`] = {
      i: Number(r.inQty) || 0,
      o: Number(r.outQty) || 0,
      c: Number(r.clQty) !== undefined ? Number(r.clQty) : ((Number(r.inQty) || 0) - (Number(r.outQty) || 0))
    };
  });

  let grandTotalValueSo = 0;

  // PAGE 1+: Monthly Summary + SO + Selisih + Pemakaian Bar + Value SO + Grand Total Rupiah
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(`QOSE COFFEE — REKAP BULANAN INVENTORY & STOCK OPNAME (${mKey})`, 10, 13);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  doc.text('Bagian 1: Rekap Total IN / OUT / CL, Stock Opname (SO), Selisih, Data Pemakaian Bar & Valuasi Stok', 10, 18.5);

  const summaryBody = sorted.map((ing, idx) => {
    const s = summaryMap[ing.id] || { totalIn: 0, totalOut: 0, totalCl: 0, soQty: '', selisih: 0, pemakaianBar: '', valueSo: 0 };
    const draft = STATE.draftMonthly[mKey + '__' + ing.id] || {};
    const soVal = draft.soQty !== undefined ? draft.soQty : s.soQty;
    const barVal = draft.pemakaianBar !== undefined ? draft.pemakaianBar : s.pemakaianBar;
    const hasSo = soVal !== '' && soVal !== null && soVal !== undefined;
    const selisih = hasSo ? (Number(soVal) - Number(s.totalCl || 0)) : 0;
    const valSo = hasSo ? (Number(soVal) * ing.unitCost) : 0;
    grandTotalValueSo += valSo;

    return [
      idx + 1,
      ing.name,
      ing.subCategory,
      ing.unit,
      formatNum(s.totalIn),
      formatNum(s.totalOut),
      formatNum(s.totalCl),
      hasSo ? formatNum(soVal) : '-',
      hasSo ? formatNum(selisih) : '-',
      barVal !== '' && barVal !== undefined ? String(barVal) : '-',
      formatRp(valSo)
    ];
  });

  doc.autoTable({
    startY: 22,
    margin: { left: 10, right: 10 },
    head: [['No', 'Nama Bahan', 'Sub Kategori', 'Satuan', 'Total IN', 'Total OUT', 'Total CL', 'SO', 'Selisih', 'Data Pemakaian Bar', 'Data Value SO']],
    body: summaryBody,
    foot: [['', 'TOTAL NILAI RUPIAH STOCK (VALUE SO)', '', '', '', '', '', '', '', '', formatRp(grandTotalValueSo)]],
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [254, 243, 199], textColor: [120, 53, 15], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 15, halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'center' },
      10: { halign: 'right', fontStyle: 'bold' }
    }
  });

  // NEXT PAGES: Daily Breakdown Tanggal 1 - 31 split into 3 clean blocks (1-11, 12-21, 22-31)
  const dayRanges = [
    { start: 1, end: 11, label: 'Tanggal 1 – 11' },
    { start: 12, end: 21, label: 'Tanggal 12 – 21' },
    { start: 22, end: 31, label: 'Tanggal 22 – 31' }
  ];

  dayRanges.forEach(range => {
    doc.addPage('a4', 'l');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`QOSE COFFEE — RINCIAN HARIAN IN / OUT / CL (${mKey} • ${range.label})`, 10, 12);

    const headRow1 = [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Nama Bahan', rowSpan: 2, styles: { valign: 'middle' } },
      { content: 'Sub Kategori', rowSpan: 2, styles: { valign: 'middle' } }
    ];
    const headRow2 = [];

    for (let d = range.start; d <= range.end; d++) {
      headRow1.push({ content: `Tgl ${d}`, colSpan: 3, styles: { halign: 'center', fillColor: d % 2 === 0 ? [55, 48, 45] : [28, 25, 23] } });
      headRow2.push(
        { content: 'IN', styles: { halign: 'center', fontSize: 5.5 } },
        { content: 'OUT', styles: { halign: 'center', fontSize: 5.5 } },
        { content: 'CL', styles: { halign: 'center', fontSize: 5.5 } }
      );
    }

    const rangeBody = sorted.map((ing, idx) => {
      const row = [idx + 1, ing.name, ing.subCategory];
      for (let d = range.start; d <= range.end; d++) {
        const cell = dayMap[`${ing.id}__${d}`];
        row.push(
          cell && cell.i ? formatNum(cell.i) : '-',
          cell && cell.o ? formatNum(cell.o) : '-',
          cell && (cell.i || cell.o) ? formatNum(cell.c) : '-'
        );
      }
      return row;
    });

    doc.autoTable({
      startY: 16,
      margin: { left: 8, right: 8 },
      head: [headRow1, headRow2],
      body: rangeBody,
      styles: { fontSize: 5.8, cellPadding: 0.9, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
      headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold', fontSize: 6.2 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'left' }
      }
    });
  });

  doc.save(`Laporan-Bulanan-Inventory-Qose-${mKey}.pdf`);
  showToast('PDF Bulanan Lengkap berhasil diunduh');
}

function downloadParStockPdf() {
  const doc = createPdfDoc('p');
  if (!doc) return;
  const curMonth = new Date().toISOString().slice(0, 7);
  const mMap = getMonthlySummaryMap(curMonth);
  const sorted = getSortedIngredients();

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('QOSE COFFEE — DAFTAR PAR STOCK & MINIMUM ORDER', 14, 15);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Periode Stok: ${curMonth}   |   Tanggal Cetak: ${new Date().toISOString().slice(0, 10)}`, 14, 21);

  const body = sorted.map((ing, idx) => {
    const cur = mMap[ing.id] ? mMap[ing.id].totalCl : 0;
    const min = Number(ing.minStock) || 0;
    const status = (min > 0 && cur <= min) ? 'PERLU ORDER' : 'AMAN';
    return [idx + 1, ing.name, ing.subCategory, ing.unit, formatNum(cur), formatNum(min), status];
  });

  doc.autoTable({
    startY: 25,
    head: [['No', 'Nama Bahan', 'Sub Kategori', 'Satuan', 'Sisa Stock', 'Min Stock', 'Status']],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255 },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === 'PERLU ORDER') {
        data.cell.styles.textColor = [190, 18, 60];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  doc.save(`Par-Stock-Qose-${new Date().toISOString().slice(0, 10)}.pdf`);
  showToast('PDF Par Stock berhasil diunduh');
}

function downloadPoPdf() {
  const doc = createPdfDoc('p');
  if (!doc) return;
  const dailyOrders = STATE.purchaseOrders.filter(o => String(o.poDate) === STATE.poDate);

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('QOSE COFFEE — PURCHASING ORDER (PO) BAR', 14, 15);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Tanggal Pengajuan PO: ${STATE.poDate}   |   Total Item: ${dailyOrders.length}`, 14, 21);

  const body = dailyOrders.map((po, idx) => [
    idx + 1,
    po.ingName,
    po.subCategory || '-',
    po.unit || '-',
    formatNum(po.sisaStock),
    formatNum(po.qtyOrder),
    po.neededDate || '-',
    po.notes || '-'
  ]);

  doc.autoTable({
    startY: 26,
    head: [['No', 'Nama Bahan Baku', 'Sub Kategori', 'Satuan', 'Sisa Stock', 'Jumlah Order', 'Tgl Dibutuhkan', 'Keterangan']],
    body: body.length ? body : [['-', 'Tidak ada item order pada tanggal ini', '', '', '', '', '', '']],
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold' }
  });

  const finalY = (doc.lastAutoTable?.finalY || 80) + 16;
  doc.setFontSize(8.5);
  doc.text('Dibuat Oleh (Head Bar),', 20, finalY);
  doc.text('Disetujui Oleh (SPV / Manajemen),', 130, finalY);
  doc.text('( ______________________ )', 18, finalY + 18);
  doc.text('( ______________________ )', 128, finalY + 18);

  doc.save(`Purchasing-Order-Qose-${STATE.poDate}.pdf`);
  showToast('PDF Purchasing Order berhasil diunduh');
}

function downloadVendorPdf() {
  const doc = createPdfDoc('p');
  if (!doc) return;

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('QOSE COFFEE — VENDOR DIRECTORY BAHAN BAKU BAR', 14, 15);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total Bahan Terdaftar: ${STATE.vendors.length}   |   Dicetak: ${new Date().toISOString().slice(0, 10)}`, 14, 21);

  const body = STATE.vendors.map((v, idx) => [
    idx + 1,
    v.ingName,
    v.subCategory || '-',
    v.supplier1 || '-',
    v.supplier2 || '-',
    v.supplier3 || '-'
  ]);

  doc.autoTable({
    startY: 25,
    head: [['No', 'Nama Bahan', 'Sub Kategori', 'Supplier 1 (Utama)', 'Supplier 2', 'Supplier 3']],
    body: body.length ? body : [['-', 'Belum ada data supplier', '', '', '', '']],
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' }
  });

  doc.save(`Vendor-Directory-Qose-${new Date().toISOString().slice(0, 10)}.pdf`);
  showToast('PDF Vendor Directory berhasil diunduh');
}
