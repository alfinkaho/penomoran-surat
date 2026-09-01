/**
 * ============================================================================
 * FRONTEND LOGIC - PENOMORAN SURAT MULTI-KESATUAN (RE-SELLABLE)
 * ============================================================================
 */

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwKDkKVVeT_N-8s1gt_GJC5cr_R-q-Cv6P-upRyMzR0doZh-FkiVfiS_ZTkyQqrhPClsQ/exec";

// Global App State
let currentUser = null;
let masterSettings = {
    namaKesatuan: "POLSEK POLEN",
    singkatan: "Polsek Polen",
    subHeader: "Sistem Penomoran Surat Otomatis"
};
let masterCategories = [];
let masterKlasifikasi = [];
let masterHistory = [];
let masterUsers = [];

// Inisialisasi Aplikasi saat Load (Optimasi Instant Render 0ms)
document.addEventListener('DOMContentLoaded', () => {
    initDefaultDate();
    loadSession();
    loadCachedData(); // Render data lokal seketika (0ms)
    fetchData();      // Lakukan sync data fresh dari server di background
    setupEventListeners();
});

// Set default tanggal surat ke hari ini (YYYY-MM-DD)
function initDefaultDate() {
    const dateInput = document.getElementById('tanggalSurat');
    if (dateInput && !dateInput.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

// Check Local Storage Session
function loadSession() {
    const savedUser = localStorage.getItem('polsek_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
        } catch (e) {
            currentUser = null;
        }
    }
    updateAuthUI();
}
// Load Data dari Cache LocalStorage (Instant Render 0ms)
function loadCachedData() {
    try {
        const cached = localStorage.getItem('penomoran_surat_cache');
        if (cached) {
            const result = JSON.parse(cached);
            if (result.settings) {
                masterSettings = result.settings;
                applyInstitutionalSettings(masterSettings);
            }
            masterCategories = result.categories || [];
            masterKlasifikasi = result.klasifikasi || [];
            masterHistory = result.history || [];
            masterUsers = result.users || [];

            renderCategories(masterCategories);
            renderKlasifikasi(masterKlasifikasi);
            renderPembuatDropdown(masterUsers);
            renderHistoryTable(masterHistory);
            updateAutocompleteDatalists();
            populateExistingCategorySelect();
            updateLivePreview();
        }
    } catch (e) {
        console.warn('Cache lokal belum tersedia:', e);
    }
}

// Update Tampilan UI Berdasarkan Status Autentikasi & Role
function updateAuthUI() {
    const loginModal = document.getElementById('loginModal');
    const userProfileWidget = document.getElementById('userProfileWidget');
    const manualLoginBtn = document.getElementById('manualLoginBtn');
    const userNameEl = document.getElementById('userNameEl');
    const userRoleBadge = document.getElementById('userRoleBadge');
    const adminTabBtn = document.getElementById('adminTabBtn');

    if (currentUser) {
        if (loginModal) loginModal.classList.add('hidden');
        if (userProfileWidget) userProfileWidget.classList.remove('hidden');
        if (manualLoginBtn) manualLoginBtn.classList.add('hidden');
        if (userNameEl) userNameEl.innerText = `${currentUser.pangkat} ${currentUser.nama}`;
        
        if (userRoleBadge) {
            userRoleBadge.innerText = currentUser.role.toUpperCase();
            if (currentUser.role === 'Admin') {
                userRoleBadge.className = "inline-block px-1 py-0.2 text-[8px] sm:text-[9px] font-bold bg-amber-400 text-blue-950 rounded uppercase mt-0.5 shadow-sm";
            } else {
                userRoleBadge.className = "inline-block px-1 py-0.2 text-[8px] sm:text-[9px] font-bold bg-blue-700 text-blue-100 rounded uppercase mt-0.5 shadow-sm";
            }
        }

        if (adminTabBtn) {
            if (currentUser.role === 'Admin') {
                adminTabBtn.classList.remove('hidden');
            } else {
                adminTabBtn.classList.add('hidden');
            }
        }

        autoSelectPembuat();

    } else {
        if (userProfileWidget) userProfileWidget.classList.add('hidden');
        if (manualLoginBtn) manualLoginBtn.classList.remove('hidden');
        if (adminTabBtn) adminTabBtn.classList.add('hidden');

        const pembuatSelect = document.getElementById('pembuatSelect');
        if (pembuatSelect && pembuatSelect.selectedIndex > 0) {
            pembuatSelect.selectedIndex = 0;
        }
    }

    renderHistoryTable(masterHistory);
}

function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.classList.remove('hidden');
}

function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.classList.add('hidden');
}

// Handle Form Login NRP
async function handleLogin(e) {
    e.preventDefault();
    const nrpInput = document.getElementById('loginNrp').value.trim();
    const passInput = document.getElementById('loginPassword').value.trim();
    const btn = document.getElementById('loginBtn');
    const spinner = document.getElementById('loginSpinner');

    if (!nrpInput || !passInput) {
        showToast("Error", "Harap isi NRP dan Password!", "error");
        return;
    }

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'login',
                nrp: nrpInput,
                password: passInput
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            currentUser = result.user;
            localStorage.setItem('polsek_user', JSON.stringify(currentUser));
            updateAuthUI();
            showToast("Berhasil Login", `Selamat datang, ${currentUser.pangkat} ${currentUser.nama}`, "success");
            document.getElementById('loginForm').reset();
        } else {
            showToast("Gagal Login", result.message, "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Koneksi Error", "Gagal menghubungkan ke server. Cek internet.", "error");
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
}

// Handle Logout
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('polsek_user');
    sessionStorage.clear();

    // Tutup semua modal yang terbuka
    closeAdminModal();
    closeEditSuratModal();

    // Reset form penomoran
    const suratForm = document.getElementById('suratForm');
    if (suratForm) suratForm.reset();

    updateAuthUI();

    // Paksa reload penuh halaman aplikasi secara langsung
    window.location.href = window.location.origin + window.location.pathname;
}

// Fetch Data Master (Settings, Categories, Klasifikasi, History, Users)
async function fetchData() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.classList.add('animate-spin');

    if (!GAS_API_URL || GAS_API_URL.includes("GANTI_") || !GAS_API_URL.startsWith("http")) {
        if (refreshBtn) refreshBtn.classList.remove('animate-spin');
        showAlert("error", "URL API Belum Disetel", "Silakan atur variabel GAS_API_URL pada file app.js.");
        return;
    }

    try {
        const response = await fetch(GAS_API_URL);
        if (!response.ok) throw new Error("Gagal mengambil data dari server");
        const result = await response.json();

        if (result.status === "success") {
            // Simpan ke cache lokal untuk instant render berikutnya (0ms)
            try {
                localStorage.setItem('penomoran_surat_cache', JSON.stringify(result));
            } catch (e) {}

            if (result.settings) {
                masterSettings = result.settings;
                applyInstitutionalSettings(masterSettings);
            }
            masterCategories = result.categories || [];
            masterKlasifikasi = result.klasifikasi || [];
            masterHistory = result.history || [];
            masterUsers = result.users || [];

            renderCategories(masterCategories);
            renderKlasifikasi(masterKlasifikasi);
            renderPembuatDropdown(masterUsers);
            renderHistoryTable(masterHistory);
            updateAutocompleteDatalists();
            populateExistingCategorySelect();
            updateLivePreview();
        } else {
            showToast("Error Load Data", result.message, "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Koneksi Bermasalah", "Pastikan GAS_API_URL sudah benar dan terhubung internet.", "error");
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('animate-spin');
    }
}

// Terapkan Identitas Kesatuan Dinamis ke DOM
function applyInstitutionalSettings(settings) {
    const headerTitle = document.getElementById('headerTitle');
    const headerSubTitle = document.getElementById('headerSubTitle');
    const loginTitle = document.getElementById('loginInstansiTitle');

    if (headerTitle) headerTitle.innerText = settings.namaKesatuan || "POLSEK POLEN";
    if (headerSubTitle) headerSubTitle.innerText = settings.subHeader || "Sistem Penomoran Surat Otomatis";
    if (loginTitle) loginTitle.innerText = `Login ${settings.namaKesatuan || 'Polsek Polen'}`;
    
    document.title = `Sistem Penomoran Surat - ${settings.namaKesatuan || 'Polsek Polen'}`;

    const setNama = document.getElementById('settingNamaKesatuan');
    const setSingk = document.getElementById('settingSingkatan');
    const setSub = document.getElementById('settingSubHeader');

    if (setNama) setNama.value = settings.namaKesatuan || '';
    if (setSingk) setSingk.value = settings.singkatan || '';
    if (setSub) setSub.value = settings.subHeader || '';
}

// Render Dropdown Kategori Surat
function renderCategories(categories) {
    const select = document.getElementById('kodeSurat');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>-- Pilih Jenis / Kode Surat --</option>';

    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.kode;
        opt.text = `${cat.kode} - ${cat.nama || cat.kode}`;
        opt.dataset.pattern = (cat.pattern && cat.pattern !== "undefined") ? cat.pattern : "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}";
        opt.dataset.klasifikasi = cat.butuhKlasifikasi ? "true" : "false";
        opt.dataset.nomorterakhir = cat.nomorTerakhir || 0;
        select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
}

// Render Dropdown Klasifikasi Baku
function renderKlasifikasi(klasifikasiList) {
    const select = document.getElementById('klasifikasiSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Pilih Kode Klasifikasi Baku --</option>';

    klasifikasiList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.kode;
        opt.text = `${k.kode} (${k.keterangan})`;
        select.appendChild(opt);
    });

    const optCustom = document.createElement('option');
    optCustom.value = "CUSTOM";
    optCustom.text = "+ Input Kode Klasifikasi Manual / Lainnya";
    select.appendChild(optCustom);
}

// Render Dropdown Pembuat Surat (Personil)
function renderPembuatDropdown(usersList) {
    const select = document.getElementById('pembuatSelect');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>-- Pilih Personil Pembuat Surat --</option>';

    usersList.forEach(u => {
        const opt = document.createElement('option');
        const formattedName = `${u.pangkat} ${u.nama} (${u.nrp})`;
        opt.value = formattedName;
        opt.text = formattedName;
        opt.dataset.nrp = u.nrp;
        select.appendChild(opt);
    });

    autoSelectPembuat();
}

// Auto-fill & Kunci Pembuat Surat dari Current Logged-in User
function autoSelectPembuat() {
    if (!currentUser) return;
    const select = document.getElementById('pembuatSelect');
    if (!select) return;

    const myName = `${currentUser.pangkat} ${currentUser.nama} (${currentUser.nrp})`;
    let found = false;

    for (let opt of select.options) {
        if (opt.dataset && opt.dataset.nrp === currentUser.nrp) {
            select.value = opt.value;
            found = true;
            break;
        }
    }

    if (!found && currentUser.nama) {
        const opt = document.createElement('option');
        opt.value = myName;
        opt.text = myName;
        opt.dataset.nrp = currentUser.nrp;
        select.appendChild(opt);
        select.value = myName;
    }

    // KUNCI DROPDOWN PEMBUAT AGAR TIDAK BISA DIEDIT KARENA MEMBACA LOGGED IN USER
    select.disabled = true;
    select.classList.add('bg-slate-200', 'cursor-not-allowed', 'text-slate-700', 'font-semibold');
}

// Live Preview Penomoran Surat
function updateLivePreview() {
    const kodeSelect = document.getElementById('kodeSurat');
    const dateInput = document.getElementById('tanggalSurat');
    const klasSelect = document.getElementById('klasifikasiSelect');
    const klasInput = document.getElementById('klasifikasiCustomInput');
    const klasContainer = document.getElementById('klasifikasiContainer');
    const livePreviewText = document.getElementById('livePreviewText');

    if (!kodeSelect || !livePreviewText) return;

    const selectedOption = kodeSelect.options[kodeSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        livePreviewText.innerHTML = `<span class="text-blue-300 italic">Pilih jenis surat di bawah...</span>`;
        if (klasContainer) klasContainer.classList.add('hidden');
        return;
    }

    const kode = selectedOption.value;
    let pattern = selectedOption.dataset.pattern;
    if (!pattern || pattern === "undefined") {
        pattern = "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}";
    }
    const butuhKlasifikasi = selectedOption.dataset.klasifikasi === "true";
    const nomorTerakhir = parseInt(selectedOption.dataset.nomorterakhir) || 0;

    if (klasContainer) {
        if (butuhKlasifikasi) {
            klasContainer.classList.remove('hidden');
        } else {
            klasContainer.classList.add('hidden');
        }
    }

    let klasifikasiVal = "";
    if (butuhKlasifikasi) {
        if (klasSelect.value === "CUSTOM") {
            klasInput.classList.remove('hidden');
            klasifikasiVal = klasInput.value.trim();
        } else {
            klasInput.classList.add('hidden');
            klasifikasiVal = klasSelect.value;
        }
    }

    const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const d = dateInput.value ? new Date(dateInput.value) : new Date();
    const bulanRomawi = romanMonths[d.getMonth()];
    const tahun = d.getFullYear();

    const nextUrut = (nomorTerakhir + 1).toString().padStart(2, '0');
    const singkatanKesatuan = masterSettings.singkatan || "Polsek Polen";

    let previewStr = pattern
        .replace(/{JENIS}/g, kode)
        .replace(/{NO}/g, nextUrut)
        .replace(/{BULAN_ROMAWI}/g, bulanRomawi)
        .replace(/{KLASIFIKASI}/g, klasifikasiVal || '---')
        .replace(/{KESATUAN}/g, singkatanKesatuan)
        .replace(/{TAHUN}/g, tahun);

    previewStr = previewStr.replace(/\/+/g, '/').replace(/\/ \//g, '/').trim();

    livePreviewText.innerText = previewStr;
}

// Utility Debounce untuk Mencegah Lag / Thrashing saat Pengguna Mengetik
function debounce(func, wait = 150) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Setup Dynamic Event Listeners (dengan Debouncing)
function setupEventListeners() {
    const kodeSelect = document.getElementById('kodeSurat');
    const dateInput = document.getElementById('tanggalSurat');
    const klasSelect = document.getElementById('klasifikasiSelect');
    const klasInput = document.getElementById('klasifikasiCustomInput');
    const searchInput = document.getElementById('searchInput');

    if (kodeSelect) kodeSelect.addEventListener('change', updateLivePreview);
    if (dateInput) dateInput.addEventListener('change', updateLivePreview);
    if (klasSelect) {
        klasSelect.addEventListener('change', () => {
            const klasInput = document.getElementById('klasifikasiCustomInput');
            if (klasSelect.value === "CUSTOM") {
                klasInput.classList.remove('hidden');
            } else {
                klasInput.classList.add('hidden');
            }
            updateLivePreview();
        });
    }
    if (klasInput) klasInput.addEventListener('input', updateLivePreview);
    if (searchInput) searchInput.addEventListener('input', debounce(filterHistory, 150));
}

// Helper: Sisipkan tag variabel ke input pattern di Panel Admin (EKSPLISIT ATTACH TO WINDOW)
window.insertVariableTag = function(tag) {
    const input = document.getElementById('catPattern');
    if (!input) return;

    let currentVal = input.value.trim();
    if (currentVal.length === 0) {
        input.value = tag;
    } else {
        if (currentVal.endsWith('/')) {
            currentVal = currentVal.substring(0, currentVal.length - 1).trim();
        }
        input.value = currentVal + ' / ' + tag;
    }
    input.focus();
};

// Submit Form Penomoran Surat Baru
async function submitSurat(e) {
    e.preventDefault();

    if (!currentUser) {
        showToast("Akses Ditolak", "Silakan login terlebih dahulu!", "error");
        openLoginModal();
        return;
    }

    const kodeSurat = document.getElementById('kodeSurat').value;
    const tanggalSurat = document.getElementById('tanggalSurat').value;
    const pembuat = document.getElementById('pembuatSelect').value;
    const uraian = document.getElementById('uraian').value.trim();
    const keperluan = document.getElementById('keperluan').value.trim();
    
    const klasSelect = document.getElementById('klasifikasiSelect');
    const klasInput = document.getElementById('klasifikasiCustomInput');
    let klasifikasi = "";

    if (klasSelect.value === "CUSTOM") {
        klasifikasi = klasInput.value.trim();
    } else {
        klasifikasi = klasSelect.value;
    }

    if (!kodeSurat || !uraian || !pembuat) {
        showToast("Form Tidak Lengkap", "Harap isi semua bidang formulir!", "error");
        return;
    }

    const btn = document.getElementById('submitBtn');
    const spinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');

    btn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.innerText = "Memproses...";

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'createSurat',
                kodeSurat: kodeSurat,
                klasifikasi: klasifikasi,
                uraian: uraian,
                keperluan: keperluan,
                tanggalSurat: tanggalSurat,
                pembuat: pembuat,
                userNrp: currentUser.nrp
            })
        });

        const result = await response.json();

        if (result.status === "success") {
            const finalNum = result.nomorSurat || result.nomor || "Nomor Surat Diterbitkan";
            showResultModal(finalNum);
            document.getElementById('suratForm').reset();
            initDefaultDate();
            autoSelectPembuat();
            fetchData();
        } else {
            showToast("Gagal Tersimpan", result.message, "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error Jaringan", "Gagal mengirim data. Periksa koneksi internet.", "error");
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
        btnText.innerText = "Generate Nomor Surat";
    }
}

// Render Table History (Super Fast String Batching untuk UI Ultra Responsif)
function renderHistoryTable(historyList) {
    const tbody = document.getElementById('historyTable');
    const thAction = document.getElementById('thAction');
    if (!tbody) return;

    const isAdmin = currentUser && currentUser.role === 'Admin';
    if (thAction) {
        if (isAdmin) thAction.classList.remove('hidden');
        else thAction.classList.add('hidden');
    }

    if (!historyList || historyList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}" class="px-4 py-6 text-center text-gray-400 italic">Belum ada riwayat penomoran surat.</td></tr>`;
        return;
    }

    // Tampilkan 100 riwayat pertama untuk kecepatan render maksimal (0ms lag)
    const displayList = historyList.length > 100 ? historyList.slice(0, 100) : historyList;

    let html = '';
    for (let i = 0; i < displayList.length; i++) {
        const item = displayList[i];
        const numEsc = escapeHtml(item.nomorLengkap || '');
        const uraianEsc = escapeHtml(item.uraian || '');
        const pembuatEsc = escapeHtml(item.pembuat || '');
        const waktuEsc = escapeHtml(item.tanggalSurat || item.timestamp || '');
        const rowIdx = item.rowIndex || i;

        html += `
            <tr class="hover:bg-blue-50/50 transition-colors border-b border-gray-100 group">
                <td class="px-4 py-3 font-semibold text-blue-900 whitespace-nowrap flex items-center justify-between">
                    <span>${numEsc}</span>
                    <button onclick="copyToClipboard('${numEsc}')" title="Salin Nomor Surat" class="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition px-2 py-1 bg-blue-100 rounded text-xs">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </td>
                <td class="px-4 py-3 text-gray-700 text-sm max-w-xs truncate" title="${uraianEsc}">${uraianEsc}</td>
                <td class="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">${pembuatEsc}</td>
                <td class="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">${waktuEsc}</td>
                ${isAdmin ? `
                <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button onclick="openEditSuratByIndex(${rowIdx})" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs mr-1 shadow-sm transition" title="Edit Data Surat">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="handleDeleteSuratByIndex(${rowIdx})" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs shadow-sm transition" title="Hapus Data Surat">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
                ` : ''}
            </tr>
        `;
    }

    if (historyList.length > 100) {
        html += `
            <tr>
                <td colspan="${isAdmin ? 5 : 4}" class="px-4 py-3 text-center text-slate-500 bg-slate-50 font-medium text-xs">
                    Menampilkan 100 dari ${historyList.length} riwayat (Gunakan kolom Cari / Filter untuk mempersempit hasil).
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
}

// Helper Handler Edit/Delete By Index untuk Kecepatan Loop Render Table
window.openEditSuratByIndex = function(rowIdx) {
    const item = masterHistory.find(h => h.rowIndex === rowIdx) || masterHistory[rowIdx];
    if (item) openEditSuratModal(item);
};

window.handleDeleteSuratByIndex = function(rowIdx) {
    const item = masterHistory.find(h => h.rowIndex === rowIdx) || masterHistory[rowIdx];
    if (item) handleDeleteSurat(item);
};

// Modal Edit Data Surat (Khusus Admin)
function openEditSuratModal(item) {
    if (!currentUser || currentUser.role !== 'Admin') return;
    
    document.getElementById('editRowIndex').value = item.rowIndex || '';
    document.getElementById('editNomorLengkap').value = item.nomorLengkap || '';
    document.getElementById('editUraian').value = item.uraian || '';
    document.getElementById('editKeperluan').value = item.keperluan || '';
    document.getElementById('editPembuat').value = item.pembuat || '';
    document.getElementById('editTanggalSurat').value = item.tanggalSurat || '';

    const modal = document.getElementById('editSuratModal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditSuratModal() {
    const modal = document.getElementById('editSuratModal');
    if (modal) modal.classList.add('hidden');
}

// Handler Submit Update Data Surat (Khusus Admin)
async function handleUpdateSurat(e) {
    e.preventDefault();
    const btn = document.getElementById('editSuratBtn');
    const spinner = document.getElementById('editSuratSpinner');
    const btnText = document.getElementById('editSuratBtnText');

    const rowIndex = document.getElementById('editRowIndex').value;
    const nomorLengkap = document.getElementById('editNomorLengkap').value.trim();
    const uraian = document.getElementById('editUraian').value.trim();
    const keperluan = document.getElementById('editKeperluan').value.trim();
    const pembuat = document.getElementById('editPembuat').value.trim();
    const tanggalSurat = document.getElementById('editTanggalSurat').value.trim();

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.innerText = "Menyimpan...";

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateSurat',
                rowIndex, nomorLengkap, uraian, keperluan, pembuat, tanggalSurat
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast("Berhasil Edit", result.message, "success");
            closeEditSuratModal();
            fetchData();
        } else {
            showToast("Gagal", result.message, "error");
        }
    } catch (err) {
        showToast("Error", "Gagal memperbarui data surat.", "error");
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.innerText = "Simpan Perubahan";
    }
}

// Handler Delete Data Surat (Khusus Admin)
async function handleDeleteSurat(item) {
    if (!confirm(`Hapus data surat "${item.nomorLengkap}"?`)) return;

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'deleteSurat',
                rowIndex: item.rowIndex
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast("Berhasil Hapus", result.message, "info");
            fetchData();
        } else {
            showToast("Gagal Hapus", result.message, "error");
        }
    } catch (err) {
        showToast("Error", "Gagal menghapus data surat.", "error");
    }
}

// Autocomplete Datalist Generator dari Data Riwayat
function updateAutocompleteDatalists() {
    const uraianDl = document.getElementById('uraianDatalist');
    const keperluanDl = document.getElementById('keperluanDatalist');
    if (!uraianDl && !keperluanDl) return;

    const uniqueUraian = new Set();
    const uniqueKeperluan = new Set();

    masterHistory.forEach(item => {
        if (item.uraian && item.uraian.trim()) uniqueUraian.add(item.uraian.trim());
        if (item.keperluan && item.keperluan.trim()) uniqueKeperluan.add(item.keperluan.trim());
    });

    if (uraianDl) {
        uraianDl.innerHTML = Array.from(uniqueUraian)
            .map(val => `<option value="${escapeHtml(val)}"></option>`)
            .join('');
    }

    if (keperluanDl) {
        keperluanDl.innerHTML = Array.from(uniqueKeperluan)
            .map(val => `<option value="${escapeHtml(val)}"></option>`)
            .join('');
    }
}

// Live Filter & Sort Riwayat Surat (Terbaru, Terlama, A-Z, Z-A)
function filterHistory() {
    const searchEl = document.getElementById('searchInput');
    const sortEl = document.getElementById('sortSelect');
    
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const sortVal = sortEl ? sortEl.value : 'terbaru';

    let result = [...masterHistory];

    if (query) {
        result = result.filter(item => {
            return (item.nomorLengkap && item.nomorLengkap.toLowerCase().includes(query)) ||
                   (item.uraian && item.uraian.toLowerCase().includes(query)) ||
                   (item.pembuat && item.pembuat.toLowerCase().includes(query)) ||
                   (item.keperluan && item.keperluan.toLowerCase().includes(query));
        });
    }

    // Urutkan Data berdasarkan Pilihan
    result.sort((a, b) => {
        if (sortVal === 'terbaru') {
            return (b.rowIndex || 0) - (a.rowIndex || 0);
        } else if (sortVal === 'terlama') {
            return (a.rowIndex || 0) - (b.rowIndex || 0);
        } else if (sortVal === 'az') {
            return String(a.nomorLengkap || '').localeCompare(String(b.nomorLengkap || ''));
        } else if (sortVal === 'za') {
            return String(b.nomorLengkap || '').localeCompare(String(a.nomorLengkap || ''));
        } else if (sortVal === 'uraian_az') {
            return String(a.uraian || '').localeCompare(String(b.uraian || ''));
        } else if (sortVal === 'uraian_za') {
            return String(b.uraian || '').localeCompare(String(a.uraian || ''));
        }
        return 0;
    });

    renderHistoryTable(result);
}

// Toggle Sort dari Klik Header Tabel
window.toggleSortColumn = function(colName) {
    const sortEl = document.getElementById('sortSelect');
    if (!sortEl) return;

    if (colName === 'nomor') {
        sortEl.value = (sortEl.value === 'az') ? 'za' : 'az';
    } else if (colName === 'uraian') {
        sortEl.value = (sortEl.value === 'uraian_az') ? 'uraian_za' : 'uraian_az';
    } else if (colName === 'tanggal') {
        sortEl.value = (sortEl.value === 'terbaru') ? 'terlama' : 'terbaru';
    }
    filterHistory();
};

// Modal Result Generator & Copy Button
function showResultModal(nomorSurat) {
    const resultModal = document.getElementById('resultModal');
    const resultText = document.getElementById('resultNomorText');
    if (resultText) resultText.innerText = nomorSurat;
    if (resultModal) resultModal.classList.remove('hidden');
}

function closeResultModal() {
    const resultModal = document.getElementById('resultModal');
    if (resultModal) resultModal.classList.add('hidden');
}

function copyResultNumber() {
    const resultText = document.getElementById('resultNomorText').innerText;
    copyToClipboard(resultText);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Tersalin!", `Nomor "${text}" berhasil disalin ke clipboard.`, "success");
    }).catch(err => {
        console.error(err);
        showToast("Gagal Salin", "Terjadi kesalahan saat menyalin ke clipboard.", "error");
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(title, message, type = "info") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    let bg = "bg-blue-900 border-blue-700 text-white";
    let icon = `<i class="fa-solid fa-circle-info text-blue-300 mr-2"></i>`;

    if (type === "success") {
        bg = "bg-emerald-800 border-emerald-600 text-white";
        icon = `<i class="fa-solid fa-circle-check text-emerald-300 mr-2"></i>`;
    } else if (type === "error") {
        bg = "bg-rose-900 border-rose-700 text-white";
        icon = `<i class="fa-solid fa-circle-exclamation text-rose-300 mr-2"></i>`;
    }

    toast.className = `${bg} border rounded-lg shadow-lg px-4 py-3 text-sm flex items-center justify-between transition-all duration-300 transform translate-y-2 opacity-0 mb-2`;
    toast.innerHTML = `
        <div class="flex items-center">
            ${icon}
            <div>
                <strong class="block font-semibold">${escapeHtml(title)}</strong>
                <span class="text-xs text-opacity-90">${escapeHtml(message)}</span>
            </div>
        </div>
        <button onclick="this.parentElement.remove()" class="ml-4 text-gray-300 hover:text-white">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Modal Admin Control & Tabs
function openAdminModal(tabName = 'katTab') {
    if (!currentUser || currentUser.role !== 'Admin') {
        showToast("Ditolak", "Hanya Admin yang dapat mengakses menu ini.", "error");
        return;
    }
    const adminModal = document.getElementById('adminModal');
    if (adminModal) adminModal.classList.remove('hidden');
    switchAdminTab(tabName);
}

function closeAdminModal() {
    const adminModal = document.getElementById('adminModal');
    if (adminModal) adminModal.classList.add('hidden');
}

function switchAdminTab(tabName) {
    const katTab = document.getElementById('adminKatContent');
    const userTab = document.getElementById('adminUserContent');
    const setTab = document.getElementById('adminSettingContent');
    
    const btnKat = document.getElementById('tabKatBtn');
    const btnUser = document.getElementById('tabUserBtn');
    const btnSet = document.getElementById('tabSetBtn');

    if (katTab) katTab.classList.add('hidden');
    if (userTab) userTab.classList.add('hidden');
    if (setTab) setTab.classList.add('hidden');

    if (btnKat) btnKat.className = "px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700";
    if (btnUser) btnUser.className = "px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700";
    if (btnSet) btnSet.className = "px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700";

    if (tabName === 'katTab') {
        if (katTab) katTab.classList.remove('hidden');
        if (btnKat) btnKat.className = "px-4 py-2.5 text-sm font-semibold border-b-2 border-blue-600 text-blue-600";
        renderAdminCategories();
    } else if (tabName === 'userTab') {
        if (userTab) userTab.classList.remove('hidden');
        if (btnUser) btnUser.className = "px-4 py-2.5 text-sm font-semibold border-b-2 border-blue-600 text-blue-600";
        renderAdminUsers();
    } else if (tabName === 'settingTab') {
        if (setTab) setTab.classList.remove('hidden');
        if (btnSet) btnSet.className = "px-4 py-2.5 text-sm font-semibold border-b-2 border-blue-600 text-blue-600";
    }
}

// Save Institutional Settings (Admin)
async function handleSaveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('settingBtn');
    const spinner = document.getElementById('settingSpinner');
    const btnText = document.getElementById('settingBtnText');

    const namaKesatuan = document.getElementById('settingNamaKesatuan').value.trim();
    const singkatan = document.getElementById('settingSingkatan').value.trim();
    const subHeader = document.getElementById('settingSubHeader').value.trim();

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.innerText = "Menyimpan...";

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveSettings',
                namaKesatuan, singkatan, subHeader
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast("Berhasil", result.message, "success");
            masterSettings = { namaKesatuan, singkatan, subHeader };
            applyInstitutionalSettings(masterSettings);
            updateLivePreview();
        } else {
            showToast("Gagal", result.message, "error");
        }
    } catch (err) {
        showToast("Error", "Gagal menyimpan pengaturan instansi.", "error");
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.innerText = "Simpan Pengaturan Instansi";
    }
}

// Searchable Combobox & Dropdown Handler untuk Kategori Admin
window.handleCategorySearchInput = function(query) {
    showCatDropdown();

    const q = (query || '').toLowerCase().trim();
    const matches = masterCategories.filter(c => 
        String(c.kode).toLowerCase().includes(q) || 
        String(c.nama || '').toLowerCase().includes(q)
    );

    const isExactMatch = masterCategories.find(c => String(c.kode).trim().toLowerCase() === q);

    if (isExactMatch) {
        window.editCategoryInForm(isExactMatch.kode);
    } else {
        const kodeInput = document.getElementById('catKode');
        if (kodeInput) {
            kodeInput.value = (query || '').trim().toUpperCase();
            kodeInput.readOnly = false;
            kodeInput.classList.remove('bg-gray-100');
        }
        const btnText = document.getElementById('catBtnText');
        if (btnText) btnText.innerText = "Simpan Kategori Baru";
    }

    renderCatDropdownItems(matches, query);
};

window.showCatDropdown = function() {
    const list = document.getElementById('catDropdownList');
    if (list) {
        list.classList.remove('hidden');
        const searchInput = document.getElementById('catSearchInput');
        const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const matches = masterCategories.filter(c => 
            String(c.kode).toLowerCase().includes(q) || 
            String(c.nama || '').toLowerCase().includes(q)
        );
        renderCatDropdownItems(matches, q);
    }
};

window.hideCatDropdown = function() {
    setTimeout(() => {
        const list = document.getElementById('catDropdownList');
        if (list) list.classList.add('hidden');
    }, 200);
};

function renderCatDropdownItems(categories, query) {
    const list = document.getElementById('catDropdownList');
    if (!list) return;

    list.innerHTML = '';

    // Item 1: Option Tambah Kategori Baru
    const newItem = document.createElement('div');
    newItem.className = "px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold cursor-pointer flex items-center justify-between";
    newItem.onclick = () => {
        resetCatFormToNew(query ? query.toUpperCase() : '');
        hideCatDropdown();
    };
    newItem.innerHTML = `<span>+ Tambah Kategori Baru ${query ? `("${escapeHtml(query.toUpperCase())}")` : ''}</span>`;
    list.appendChild(newItem);

    // Items: Matching Existing Categories
    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = "px-3 py-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between text-slate-800";
        item.onclick = () => {
            const searchInput = document.getElementById('catSearchInput');
            if (searchInput) searchInput.value = `${cat.kode} - ${cat.nama || cat.kode}`;
            window.editCategoryInForm(cat.kode);
            hideCatDropdown();
        };
        item.innerHTML = `
            <div>
                <strong class="text-blue-900 font-bold">${escapeHtml(cat.kode)}</strong> 
                <span class="text-slate-600 ml-1">- ${escapeHtml(cat.nama || cat.kode)}</span>
            </div>
            <span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">EKSIS</span>
        `;
        list.appendChild(item);
    });
}

window.resetCatFormToNew = function(customKode = '') {
    const searchInput = document.getElementById('catSearchInput');
    if (searchInput) searchInput.value = customKode;

    const kodeInput = document.getElementById('catKode');
    if (kodeInput) {
        kodeInput.value = customKode;
        kodeInput.readOnly = false;
        kodeInput.classList.remove('bg-gray-100');
    }

    document.getElementById('catNama').value = '';
    document.getElementById('catPattern').value = '{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}';
    document.getElementById('catKlasifikasiCheck').checked = false;
    document.getElementById('catNomorTerakhir').value = 0;

    const btnText = document.getElementById('catBtnText');
    if (btnText) btnText.innerText = "Simpan Kategori Baru";

    hideCatDropdown();
};

// Live Filter Daftar Pattern Kategori Aktif
window.filterAdminCategories = function(query) {
    const q = (query || '').toLowerCase().trim();
    const items = document.querySelectorAll('#adminKatList > div');
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
};

function populateExistingCategorySelect() {
    // Dipanggil saat data master di-fetch untuk merefresh dropdown jika terbuka
    const searchInput = document.getElementById('catSearchInput');
    if (searchInput && searchInput.value) {
        handleCategorySearchInput(searchInput.value);
    }
}

// Click to Edit Category in Form Above
window.editCategoryInForm = function(kode) {
    const cat = masterCategories.find(c => String(c.kode).trim() === String(kode).trim());
    if (!cat) return;

    const searchInput = document.getElementById('catSearchInput');
    if (searchInput) searchInput.value = `${cat.kode} - ${cat.nama || cat.kode}`;

    const kodeInput = document.getElementById('catKode');
    if (kodeInput) {
        kodeInput.value = cat.kode || '';
        kodeInput.readOnly = true;
        kodeInput.classList.add('bg-gray-100');
    }

    document.getElementById('catNama').value = cat.nama || '';
    document.getElementById('catPattern').value = (cat.pattern && cat.pattern !== "undefined") ? cat.pattern : "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}";
    document.getElementById('catKlasifikasiCheck').checked = cat.butuhKlasifikasi || false;
    document.getElementById('catNomorTerakhir').value = cat.nomorTerakhir || 0;

    const btnText = document.getElementById('catBtnText');
    if (btnText) btnText.innerText = `Update Kategori (${cat.kode})`;

    const catForm = document.getElementById('catForm');
    if (catForm) {
        catForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        catForm.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => catForm.classList.remove('ring-2', 'ring-amber-400'), 1500);
    }
    showToast("Mode Edit Kategori", `Data "${cat.kode}" dimuat ke formulir di atas.`, "info");
};

// Click to Edit User in Form Above
window.editUserInForm = function(nrp) {
    const u = masterUsers.find(user => String(user.nrp).trim() === String(nrp).trim());
    if (!u) return;

    document.getElementById('userNrpInput').value = u.nrp || '';
    document.getElementById('userPassInput').value = '';
    document.getElementById('userNamaInput').value = u.nama || '';
    document.getElementById('userPangkatInput').value = u.pangkat || '';
    document.getElementById('userJabatanInput').value = u.jabatan || '';
    document.getElementById('userRoleSelect').value = u.role || 'Operator';

    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        userForm.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => userForm.classList.remove('ring-2', 'ring-amber-400'), 1500);
    }
    showToast("Mode Edit Personil", `Data NRP "${u.nrp}" dimuat ke formulir di atas.`, "info");
};

// Admin Category Management Render
function renderAdminCategories() {
    const list = document.getElementById('adminKatList');
    if (!list) return;

    list.innerHTML = '';
    masterCategories.forEach(cat => {
        const item = document.createElement('div');
        item.className = "p-3 bg-gray-50 hover:bg-blue-50/60 border rounded-lg flex justify-between items-center text-xs mb-2 transition cursor-pointer group";
        const displayPattern = (cat.pattern && cat.pattern !== "undefined") ? cat.pattern : "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}";
        
        item.onclick = (e) => {
            if (e.target.closest('.btn-delete-cat')) return;
            window.editCategoryInForm(cat.kode);
        };

        item.innerHTML = `
            <div>
                <div class="flex items-center gap-1.5 mb-1">
                    <strong class="text-sm font-bold text-blue-900 group-hover:text-blue-700">${escapeHtml(cat.kode)}</strong> 
                    <span class="text-gray-600">- ${escapeHtml(cat.nama || cat.kode)}</span>
                    <span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-pen text-[9px] mr-1"></i>Klik untuk Edit</span>
                </div>
                <code class="text-gray-600 bg-white px-1.5 py-0.5 rounded border">${escapeHtml(displayPattern)}</code><br>
                <span class="text-gray-500 mt-1 block">Nomor Terakhir (Baseline): <b class="text-blue-700">${cat.nomorTerakhir || 0}</b></span>
            </div>
            <div class="flex gap-1.5">
                <button onclick="window.editCategoryInForm('${escapeHtml(cat.kode)}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded shadow-sm" title="Edit Kategori"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteCategory('${escapeHtml(cat.kode)}')" class="btn-delete-cat px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-sm" title="Hapus Kategori"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Admin Users Management Render
function renderAdminUsers() {
    const list = document.getElementById('adminUserList');
    if (!list) return;

    list.innerHTML = '';
    masterUsers.forEach(u => {
        const item = document.createElement('div');
        item.className = "p-3 bg-gray-50 hover:bg-blue-50/60 border rounded-lg flex justify-between items-center text-xs mb-2 transition cursor-pointer group";
        
        item.onclick = (e) => {
            if (e.target.closest('.btn-delete-user')) return;
            window.editUserInForm(u.nrp);
        };

        item.innerHTML = `
            <div>
                <div class="flex items-center gap-1.5 mb-0.5">
                    <strong class="text-sm font-bold text-gray-900 group-hover:text-blue-700">${escapeHtml(u.pangkat)} ${escapeHtml(u.nama)}</strong> 
                    <span class="text-gray-500">(${escapeHtml(u.nrp)})</span>
                    <span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-pen text-[9px] mr-1"></i>Klik untuk Edit</span>
                </div>
                <span class="text-gray-600">Jabatan: ${escapeHtml(u.jabatan)}</span> | <span class="font-bold text-blue-700">${escapeHtml(u.role)}</span>
            </div>
            <div class="flex gap-1.5">
                <button onclick="window.editUserInForm('${escapeHtml(u.nrp)}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded shadow-sm" title="Edit Personil"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteUser('${escapeHtml(u.nrp)}')" class="btn-delete-user px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-sm" title="Hapus Personil"><i class="fa-solid fa-user-xmark"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Save Category Admin
async function handleSaveCategory(e) {
    e.preventDefault();
    const btn = document.getElementById('catBtn');
    const spinner = document.getElementById('catSpinner');
    const btnText = document.getElementById('catBtnText');

    const kodeInput = document.getElementById('catKode');
    const isEditMode = kodeInput ? kodeInput.readOnly : false;
    const kode = kodeInput ? kodeInput.value.trim() : '';
    const nama = document.getElementById('catNama').value.trim();
    const pattern = document.getElementById('catPattern').value.trim();
    const butuhKlasifikasi = document.getElementById('catKlasifikasiCheck').checked;
    const nomorTerakhir = parseInt(document.getElementById('catNomorTerakhir').value) || 0;

    if (!kode || !nama) {
        showToast("Form Tidak Lengkap", "Harap isi Kode Surat dan Nama Kategori!", "error");
        return;
    }

    // Guard Anti-Duplikat (Mencegah pembuatan kode baru yang sudah pernah ada)
    if (!isEditMode) {
        const duplicate = masterCategories.find(c => String(c.kode).trim().toLowerCase() === kode.toLowerCase());
        if (duplicate) {
            showToast("Guard Anti Duplikat", `Kode Surat "${kode}" sudah pernah dibuat! Gunakan dropdown "Pilih Kategori Eksis" di atas untuk mengeditnya.`, "error");
            return;
        }
    }

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.innerText = "Menyimpan...";

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveCategory',
                kode, nama, pattern, butuhKlasifikasi, nomorTerakhir
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast("Berhasil", result.message, "success");
            document.getElementById('catForm').reset();
            if (kodeInput) {
                kodeInput.readOnly = false;
                kodeInput.classList.remove('bg-gray-100');
            }
            const searchInput = document.getElementById('catSearchInput');
            if (searchInput) searchInput.value = "";
            fetchData();
        } else {
            showToast("Gagal", result.message, "error");
        }
    } catch (err) {
        showToast("Error", "Gagal menyimpan kategori.", "error");
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.innerText = isEditMode ? `Update Kategori (${kode})` : "Simpan Kategori Baru";
    }
}

// Save User Admin
async function handleSaveUser(e) {
    e.preventDefault();
    const btn = document.getElementById('userBtn');
    const spinner = document.getElementById('userSpinner');
    const btnText = document.getElementById('userBtnText');

    const nrp = document.getElementById('userNrpInput').value.trim();
    const password = document.getElementById('userPassInput').value.trim();
    const nama = document.getElementById('userNamaInput').value.trim();
    const pangkat = document.getElementById('userPangkatInput').value.trim();
    const jabatan = document.getElementById('userJabatanInput').value.trim();
    const role = document.getElementById('userRoleSelect').value;

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.innerText = "Menyimpan...";

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveUser',
                nrp, password, nama, pangkat, jabatan, role, status: 'Aktif'
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast("Berhasil", result.message, "success");
            document.getElementById('userForm').reset();
            fetchData();
        } else {
            showToast("Gagal", result.message, "error");
        }
    } catch (err) {
        showToast("Error", "Gagal menyimpan user.", "error");
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.innerText = "Simpan Personil";
    }
}

// Delete Operations Admin
async function deleteCategory(kode) {
    if (!confirm(`Hapus kategori "${kode}"?`)) return;
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteCategory', kode })
        });
        const result = await response.json();
        showToast("Hapus Kategori", result.message, "info");
        fetchData();
    } catch (err) {
        showToast("Error", "Gagal menghapus.", "error");
    }
}

async function deleteUser(nrp) {
    if (!confirm(`Hapus personil NRP "${nrp}"?`)) return;
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteUser', nrp })
        });
        const result = await response.json();
        showToast("Hapus Personil", result.message, "info");
        fetchData();
    } catch (err) {
        showToast("Error", "Gagal menghapus.", "error");
    }
}

// Toggle Visibility Password Input dengan Icon Google Material Symbols Standard
function togglePasswordVisibility(inputId, btnEl, event) {
    if (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }
    const input = document.getElementById(inputId);
    if (!input) return;

    const currentType = input.getAttribute('type') || input.type;
    const isPassword = currentType === 'password';
    const newType = isPassword ? 'text' : 'password';

    input.type = newType;
    input.setAttribute('type', newType);

    const btn = btnEl || (event ? event.currentTarget : null);
    if (btn) {
        const icon = btn.querySelector('.material-symbols-outlined') || btn.querySelector('span') || btn.querySelector('i');
        if (icon) {
            icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            icon.innerText = isPassword ? 'visibility_off' : 'visibility';
        }
        btn.setAttribute('title', isPassword ? 'Sembunyikan Password' : 'Tampilkan Password');
    }
}

window.togglePasswordVisibility = togglePasswordVisibility;
window.deleteCategory = deleteCategory;
window.deleteUser = deleteUser;
window.handleLogout = handleLogout;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.switchAdminTab = switchAdminTab;
window.handleSaveSettings = handleSaveSettings;
window.handleSaveCategory = handleSaveCategory;
window.handleSaveUser = handleSaveUser;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.handleLogin = handleLogin;
window.submitSurat = submitSurat;
window.openEditSuratModal = openEditSuratModal;
window.closeEditSuratModal = closeEditSuratModal;
window.handleUpdateSurat = handleUpdateSurat;
window.handleDeleteSurat = handleDeleteSurat;
window.fetchData = fetchData;
window.copyResultNumber = copyResultNumber;
window.closeResultModal = closeResultModal;
window.copyToClipboard = copyToClipboard;

// Open Export Modal & Populate Category Options
window.openExportModal = function() {
    const modal = document.getElementById('exportModal');
    const select = document.getElementById('exportKodeSelect');
    if (!modal) return;

    if (select) {
        select.innerHTML = '<option value="ALL">-- SEMUA KATEGORI / KODE SURAT --</option>';
        masterCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.kode;
            opt.text = `${cat.kode} - ${cat.nama || cat.kode}`;
            select.appendChild(opt);
        });
    }

    modal.classList.remove('hidden');
};

window.closeExportModal = function() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.add('hidden');
};

// Helper: Filter history dataset based on export modal fields
function getFilteredExportData() {
    const kodeSelect = document.getElementById('exportKodeSelect');
    const dateStart = document.getElementById('exportDateStart');
    const dateEnd = document.getElementById('exportDateEnd');
    const queryEl = document.getElementById('exportQuery');

    const kodeVal = kodeSelect ? kodeSelect.value : 'ALL';
    const startVal = dateStart ? dateStart.value : '';
    const endVal = dateEnd ? dateEnd.value : '';
    const qVal = queryEl ? queryEl.value.toLowerCase().trim() : '';

    return masterHistory.filter(item => {
        // Filter Kode Kategori
        if (kodeVal !== 'ALL') {
            const num = (item.nomorLengkap || '').toLowerCase();
            const targetKode = kodeVal.toLowerCase();
            const itemKode = (item.kodeSurat || '').toLowerCase();
            if (itemKode !== targetKode && !num.includes(targetKode)) {
                return false;
            }
        }

        // Filter Rentang Tanggal (YYYY-MM-DD)
        if (startVal || endVal) {
            let itemDateStr = item.tanggalSurat || item.timestamp;
            if (itemDateStr) {
                let parsedDate = null;
                if (itemDateStr.includes('/')) {
                    const parts = itemDateStr.split('/');
                    if (parts.length === 3) {
                        parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                    }
                } else {
                    parsedDate = new Date(itemDateStr);
                }

                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    if (startVal && parsedDate < new Date(startVal)) return false;
                    if (endVal && parsedDate > new Date(endVal + 'T23:59:59')) return false;
                }
            }
        }

        // Filter Kata Kunci
        if (qVal) {
            const matchesText = 
                (item.nomorLengkap && item.nomorLengkap.toLowerCase().includes(qVal)) ||
                (item.uraian && item.uraian.toLowerCase().includes(qVal)) ||
                (item.pembuat && item.pembuat.toLowerCase().includes(qVal)) ||
                (item.keperluan && item.keperluan.toLowerCase().includes(qVal));
            if (!matchesText) return false;
        }

        return true;
    });
}

// Generate Official Kop Header String
function getOfficialKopHTML(filterCategoryTitle) {
    const instansi = masterSettings.namaKesatuan || "POLSEK POLEN";
    
    return `
        <div style="text-align: center; margin-bottom: 20px; font-family: Arial, sans-serif;">
            <h4 style="margin:0; padding:0; text-transform:uppercase; font-size:12px; font-weight:bold; letter-spacing:1px;">KEPOLISIAN NEGARA REPUBLIK INDONESIA</h4>
            <h4 style="margin:0; padding:0; text-transform:uppercase; font-size:12px; font-weight:bold; letter-spacing:1px;">DAERAH NUSA TENGGARA TIMUR</h4>
            <h3 style="margin:2px 0 0 0; padding:0; text-transform:uppercase; font-size:14px; font-weight:bold; letter-spacing:1px;">RESOR TIMOR TENGAH SELATAN</h3>
            <h2 style="margin:2px 0 6px 0; padding:0; text-transform:uppercase; font-size:16px; font-weight:800; color:#1e3a8a; letter-spacing:1px;">${escapeHtml(instansi)}</h2>
            <div style="border-bottom: 3px double #000; margin-bottom: 15px;"></div>
            <h3 style="margin:5px 0 2px 0; text-transform:uppercase; font-size:14px; font-weight:bold;">LAPORAN REKAPITULASI PENOMORAN SURAT</h3>
            <p style="margin:0; font-size:11px; color:#475569;">Kategori / Filter: <b>${escapeHtml(filterCategoryTitle)}</b> | Tanggal Cetak: <b>${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</b></p>
        </div>
    `;
}

// Execute Export Ke Excel (.xls)
window.executeExportExcel = function() {
    const filteredData = getFilteredExportData();
    if (filteredData.length === 0) {
        showToast("Data Kosong", "Tidak ada data surat yang sesuai dengan filter pilihan Anda.", "error");
        return;
    }

    const kodeSelect = document.getElementById('exportKodeSelect');
    const catLabel = kodeSelect ? kodeSelect.options[kodeSelect.selectedIndex].text : 'SEMUA KATEGORI';

    let tableHTML = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Laporan Surat</x:Name>
                            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; }
                table { border-collapse: collapse; width: 100%; margin-top: 10px; }
                th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #000000; padding: 8px; text-align: center; }
                td { border: 1px solid #000000; padding: 6px 8px; vertical-align: top; }
                .text-center { text-align: center; }
                .text-bold { font-weight: bold; }
                tr:nth-child(even) { background-color: #f8fafc; }
            </style>
        </head>
        <body>
            ${getOfficialKopHTML(catLabel)}
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">NO</th>
                        <th>NOMOR SURAT LENGKAP</th>
                        <th>URAIAN PERIHAL / TENTANG</th>
                        <th>KEPERLUAN / TUJUAN</th>
                        <th>PEMBUAT SURAT</th>
                        <th>TANGGAL SURAT</th>
                    </tr>
                </thead>
                <tbody>
    `;

    filteredData.forEach((item, index) => {
        tableHTML += `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="text-bold">${escapeHtml(item.nomorLengkap || '')}</td>
                <td>${escapeHtml(item.uraian || '')}</td>
                <td>${escapeHtml(item.keperluan || '')}</td>
                <td>${escapeHtml(item.pembuat || '')}</td>
                <td class="text-center">${escapeHtml(item.tanggalSurat || item.timestamp || '')}</td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
            <br><br>
            <table style="border:none; margin-top:20px;">
                <tr style="border:none;">
                    <td style="border:none; width:60%;"></td>
                    <td style="border:none; text-align:center;">
                        ${escapeHtml(masterSettings.namaKesatuan || 'POLSEK POLEN')}, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
                        <b>KAPOLSEK / ANOTA</b><br><br><br><br>
                        <u><b>________________________</b></u>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filenameKode = (kodeSelect ? kodeSelect.value : 'ALL').replace(/[^a-zA-Z0-9]/g, '_');
    a.href = url;
    a.download = `Laporan_Surat_${filenameKode}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Export Berhasil", "Laporan Excel berhasil diunduh.", "success");
    closeExportModal();
};

// Execute Print Laporan (A4 Printable View with Kop)
window.executePrintReport = function() {
    const filteredData = getFilteredExportData();
    if (filteredData.length === 0) {
        showToast("Data Kosong", "Tidak ada data surat yang sesuai dengan filter pilihan Anda.", "error");
        return;
    }

    const kodeSelect = document.getElementById('exportKodeSelect');
    const catLabel = kodeSelect ? kodeSelect.options[kodeSelect.selectedIndex].text : 'SEMUA KATEGORI';

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast("Popup Ditolak", "Izinkan popup browser untuk membuka halaman cetak.", "error");
        return;
    }

    let rowsHTML = '';
    filteredData.forEach((item, index) => {
        rowsHTML += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td style="font-weight: bold;">${escapeHtml(item.nomorLengkap || '')}</td>
                <td>${escapeHtml(item.uraian || '')}</td>
                <td>${escapeHtml(item.keperluan || '')}</td>
                <td>${escapeHtml(item.pembuat || '')}</td>
                <td style="text-align: center;">${escapeHtml(item.tanggalSurat || item.timestamp || '')}</td>
            </tr>
        `;
    });

    const fullPrintHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cetak Laporan Penomoran Surat</title>
            <style>
                @page { size: A4 portrait; margin: 15mm; }
                body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
                .kop-container { text-align: center; margin-bottom: 15px; }
                .kop-instansi { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 0; }
                .kop-title { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 3px 0 0 0; }
                .kop-sub { font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 3px 0 5px 0; }
                .kop-line { border-bottom: 3px double #000; margin-bottom: 15px; }
                .report-title { text-align: center; font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
                .report-sub { text-align: center; font-size: 10pt; margin-bottom: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
                th { border: 1px solid #000; padding: 6px; background-color: #e2e8f0; font-weight: bold; text-align: center; text-transform: uppercase; }
                td { border: 1px solid #000; padding: 6px; vertical-align: top; }
                .footer-sign { width: 100%; margin-top: 30px; border: none; font-size: 11pt; }
                .footer-sign td { border: none; }
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="background:#1e3a8a; color:#fff; padding:10px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <span><b>Pratinjau Cetak Laporan Penomoran Surat</b></span>
                <button onclick="window.print()" style="background:#f59e0b; color:#000; font-weight:bold; border:none; padding:8px 16px; border-radius:5px; cursor:pointer;">Cetak Sekarang (Print / PDF)</button>
            </div>

            <div class="kop-container">
                <div class="kop-instansi">KEPOLISIAN NEGARA REPUBLIK INDONESIA</div>
                <div class="kop-instansi">DAERAH NUSA TENGGARA TIMUR</div>
                <div class="kop-title">RESOR TIMOR TENGAH SELATAN</div>
                <div class="kop-sub">${escapeHtml(masterSettings.namaKesatuan || 'POLSEK POLEN')}</div>
                <div class="kop-line"></div>
            </div>

            <div class="report-title">LAPORAN REKAPITULASI PENOMORAN SURAT</div>
            <div class="report-sub">Kategori: <b>${escapeHtml(catLabel)}</b> | Tanggal: <b>${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</b></div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">NO</th>
                        <th>NOMOR SURAT LENGKAP</th>
                        <th>URAIAN PERIHAL / TENTANG</th>
                        <th>KEPERLUAN / TUJUAN</th>
                        <th>PEMBUAT SURAT</th>
                        <th>TANGGAL SURAT</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>

            <table class="footer-sign">
                <tr>
                    <td style="width: 60%;"></td>
                    <td style="text-align: center;">
                        ${escapeHtml(masterSettings.namaKesatuan || 'POLSEK POLEN')}, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
                        <b>KAPOLSEK / ANOTA</b><br><br><br><br><br>
                        <u><b>________________________</b></u>
                    </td>
                </tr>
            </table>

            <script>
                window.onload = function() {
                    setTimeout(() => window.print(), 500);
                };
            </script>
        </body>
        </html>
    `;

    printWin.document.write(fullPrintHTML);
    printWin.document.close();

    closeExportModal();
};

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.log('SW Registration failed:', err));
    });
}
