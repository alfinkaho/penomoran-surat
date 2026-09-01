/**
 * ============================================================================
 * BACKEND API - PENOMORAN SURAT MULTI-KESATUAN (RE-SELLABLE BRANDING)
 * ============================================================================
 */

// SPREADSHEET ID
const SPREADSHEET_ID = "1IqVv0A9OEsi4_QXteotHM2b9EF_kBoAKYaDU4YrOU"; 

const SHEET_DATA = "Data_Surat";
const SHEET_KAT = "Kategori";
const SHEET_KLAS = "Klasifikasi";
const SHEET_USER = "Users";
const SHEET_SETTING = "Pengaturan";

function getSpreadsheet() {
  let ss = null;

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId()) return ss;
  } catch(e) {}

  if (SPREADSHEET_ID && SPREADSHEET_ID.trim().length > 5) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
      if (ss && ss.getId()) return ss;
    } catch(e) {}
  }

  try {
    const files = DriveApp.getFilesByName("penomoran surat");
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        ss = SpreadsheetApp.openById(file.getId());
        if (ss && ss.getId()) return ss;
      }
    }
  } catch(e) {}

  throw new Error("Gagal membuka file Spreadsheet.");
}

function testConnection() {
  const ss = getSpreadsheet();
  Logger.log("BERHASIL TERHUBUNG! Nama Spreadsheet: " + ss.getName() + " | ID: " + ss.getId());
  setupDatabase();
  Logger.log("SETUP DATABASE BERHASIL!");
}

// Inisialisasi Database Spreadsheet Otomatis
function setupDatabase() {
  const ss = getSpreadsheet();
  
  if (!ss.getSheetByName(SHEET_DATA)) {
    const sh = ss.insertSheet(SHEET_DATA);
    sh.appendRow(["Timestamp", "Nomor Urut", "Kode Surat", "Nomor Surat Lengkap", "Uraian", "Keperluan", "Tahun", "Pembuat", "Tanggal Surat", "User NRP"]);
    sh.getRange("A1:J1").setFontWeight("bold").setBackground("#e2e8f0");
  }

  if (!ss.getSheetByName(SHEET_KAT)) {
    const sh = ss.insertSheet(SHEET_KAT);
    sh.appendRow(["Kode Surat", "Nama Jenis", "Pattern Template", "Butuh Klasifikasi", "Nomor Terakhir"]);
    sh.appendRow(["B", "Surat Biasa", "{JENIS}/ {NO} / {BULAN_ROMAWI} / {KLASIFIKASI} /{TAHUN}", "Ya", 0]);
    sh.appendRow(["BA", "Berita Acara", "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}", "Tidak", 0]);
    sh.appendRow(["Sprin", "Surat Perintah", "{JENIS}/ {NO} / {BULAN_ROMAWI} / {KLASIFIKASI} / {TAHUN}", "Ya", 0]);
    sh.appendRow(["Sp.Gas", "Surat Perintah Tugas", "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN} / {KESATUAN}", "Tidak", 0]);
    sh.appendRow(["SP2HP", "SP2HP", "{JENIS}/ {NO} / {BULAN_ROMAWI} / {KLASIFIKASI} / {TAHUN}", "Ya", 0]);
    sh.appendRow(["Sket", "Surat Keterangan SPKT", "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN} / SPKT", "Tidak", 0]);
    sh.getRange("A1:E1").setFontWeight("bold").setBackground("#e2e8f0");
  } else {
    // Pastikan Header Kategori lengkap
    const sh = ss.getSheetByName(SHEET_KAT);
    const lastCol = sh.getLastColumn();
    if (lastCol < 5) {
      sh.getRange("C1:E1").setValues([["Pattern Template", "Butuh Klasifikasi", "Nomor Terakhir"]]).setFontWeight("bold").setBackground("#e2e8f0");
    }
  }

  if (!ss.getSheetByName(SHEET_KLAS)) {
    const sh = ss.insertSheet(SHEET_KLAS);
    sh.appendRow(["Kode Klasifikasi", "Keterangan"]);
    sh.appendRow(["SIP.1.1.", "Laporan / Informasi"]);
    sh.appendRow(["HUK.6.6.", "Hukum / Operasional"]);
    sh.appendRow(["RES.1.24.", "Reserse Kriminal"]);
    sh.appendRow(["INTEL.2.1.", "Intelijen & Keamanan"]);
    sh.appendRow(["BINKAR.1.", "SDM & Pembinaan"]);
    sh.appendRow(["HUMAS.3.", "Hubungan Masyarakat"]);
    sh.getRange("A1:B1").setFontWeight("bold").setBackground("#e2e8f0");
  }

  if (!ss.getSheetByName(SHEET_USER)) {
    const sh = ss.insertSheet(SHEET_USER);
    sh.appendRow(["NRP", "Password", "Nama", "Pangkat", "Jabatan", "Role", "Status"]);
    sh.appendRow(["admin", "admin123", "ADMINISTRATOR POLSEK", "AIPDA", "KA SPKT / ADMINISTRATOR", "Admin", "Aktif"]);
    sh.appendRow(["78010203", "123456", "BUDI SANTOSO", "BRIPKA", "BANUM SPKT", "Operator", "Aktif"]);
    sh.getRange("A1:G1").setFontWeight("bold").setBackground("#e2e8f0");
  }

  if (!ss.getSheetByName(SHEET_SETTING)) {
    const sh = ss.insertSheet(SHEET_SETTING);
    sh.appendRow(["Key", "Value"]);
    sh.appendRow(["Nama_Kesatuan", "POLSEK POLEN"]);
    sh.appendRow(["Singkatan_Kesatuan", "Polsek Polen"]);
    sh.appendRow(["Sub_Header", "Sistem Penomoran Surat Otomatis"]);
    sh.getRange("A1:B1").setFontWeight("bold").setBackground("#e2e8f0");
  }
}

// Handler GET - Fetch Master Data, Settings & Riwayat Surat
function doGet(e) {
  try {
    setupDatabase();
    const ss = getSpreadsheet();
    
    // 1. Fetch Pengaturan Kesatuan
    const setSheet = ss.getSheetByName(SHEET_SETTING);
    const setRows = setSheet ? setSheet.getDataRange().getValues() : [];
    setRows.shift();
    
    let settings = {
      namaKesatuan: "POLSEK POLEN",
      singkatan: "Polsek Polen",
      subHeader: "Sistem Penomoran Surat Otomatis"
    };

    setRows.forEach(r => {
      const key = String(r[0]).trim();
      const val = String(r[1]).trim();
      if (key === "Nama_Kesatuan") settings.namaKesatuan = val;
      if (key === "Singkatan_Kesatuan") settings.singkatan = val;
      if (key === "Sub_Header") settings.subHeader = val;
    });

    // 2. Fetch Kategori & Pattern
    const catData = ss.getSheetByName(SHEET_KAT).getDataRange().getValues();
    catData.shift();
    const categories = catData.map(r => ({
      kode: String(r[0]),
      nama: r[1] ? String(r[1]) : String(r[0]),
      pattern: (r[2] && String(r[2]).trim() !== "") ? String(r[2]).trim() : "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}",
      butuhKlasifikasi: String(r[3]) === "Ya",
      nomorTerakhir: parseInt(r[4]) || 0
    })).filter(c => c.kode !== "");

    // 3. Fetch Kode Klasifikasi Baku
    const klasData = ss.getSheetByName(SHEET_KLAS).getDataRange().getValues();
    klasData.shift();
    const klasifikasi = klasData.map(r => ({
      kode: String(r[0]),
      keterangan: String(r[1])
    })).filter(k => k.kode !== "");

    // 4. Fetch Riwayat Surat Terakhir dengan rowIndex
    const dbData = ss.getSheetByName(SHEET_DATA).getDataRange().getValues();
    dbData.shift();
    
    let history = dbData.map((r, index) => ({
      rowIndex: index + 2,
      timestamp: String(r[0]),
      nomorUrut: r[1],
      kodeSurat: String(r[2]),
      nomorLengkap: String(r[3]),
      uraian: String(r[4]),
      keperluan: String(r[5]),
      tahun: String(r[6]),
      pembuat: String(r[7]),
      tanggalSurat: r[8] ? String(r[8]) : "",
      userNrp: r[9] ? String(r[9]) : ""
    })).reverse().slice(0, 50);

    // 5. Fetch User List
    const userData = ss.getSheetByName(SHEET_USER).getDataRange().getValues();
    userData.shift();
    const users = userData.map(r => ({
      nrp: String(r[0]),
      nama: String(r[2]),
      pangkat: String(r[3]),
      jabatan: String(r[4]),
      role: String(r[5]),
      status: String(r[6])
    })).filter(u => u.nrp !== "" && u.status === "Aktif");

    return jsonResponse({
      status: "success",
      settings: settings,
      categories: categories,
      klasifikasi: klasifikasi,
      history: history,
      users: users
    });

  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

// Handler POST - Auth, Create/Update/Delete Surat, Admin Operations
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    setupDatabase();
    const ss = getSpreadsheet();
    
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    
    const action = payload.action || "createSurat";

    // ==========================================
    // ACTION: LOGIN
    // ==========================================
    if (action === "login") {
      const { nrp, password } = payload;
      const userSheet = ss.getSheetByName(SHEET_USER);
      const userData = userSheet.getDataRange().getValues();
      userData.shift();
      
      const found = userData.find(r => String(r[0]).trim().toLowerCase() === String(nrp).trim().toLowerCase());
      if (!found) {
        return jsonResponse({ status: "error", message: "NRP '" + nrp + "' tidak terdaftar!" });
      }
      
      if (String(found[1]) !== String(password)) {
        return jsonResponse({ status: "error", message: "Password salah!" });
      }
      
      if (String(found[6]) !== "Aktif") {
        return jsonResponse({ status: "error", message: "Akun Anda dinonaktifkan. Hubungi Admin." });
      }

      return jsonResponse({
        status: "success",
        user: {
          nrp: String(found[0]),
          nama: String(found[2]),
          pangkat: String(found[3]),
          jabatan: String(found[4]),
          role: String(found[5])
        }
      });
    }

    // ==========================================
    // ACTION: CREATE SURAT (PENOMORAN OTOMATIS)
    // ==========================================
    if (action === "createSurat") {
      const { kodeSurat, klasifikasi, uraian, keperluan, tanggalSurat, pembuat, userNrp } = payload;
      
      if (!kodeSurat || !uraian || !pembuat) {
        return jsonResponse({ status: "error", message: "Formulir tidak lengkap!" });
      }

      let singkatanKesatuan = "Polsek Polen";
      const setSheet = ss.getSheetByName(SHEET_SETTING);
      if (setSheet) {
        const setRows = setSheet.getDataRange().getValues();
        setRows.shift();
        const found = setRows.find(r => String(r[0]).trim() === "Singkatan_Kesatuan");
        if (found && found[1]) singkatanKesatuan = String(found[1]).trim();
      }

      const dateObj = tanggalSurat ? new Date(tanggalSurat) : new Date();
      const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
      const bulanRomawi = romanMonths[dateObj.getMonth()];
      const tahun = dateObj.getFullYear();

      const catSheet = ss.getSheetByName(SHEET_KAT);
      const catRows = catSheet.getDataRange().getValues();
      catRows.shift();
      
      const catObj = catRows.find(r => String(r[0]).trim() === String(kodeSurat).trim());
      let pattern = "{JENIS}/ {NO} / {BULAN_ROMAWI} / {TAHUN}";
      let baselineUrut = 0;
      
      if (catObj) {
        if (catObj[2] && String(catObj[2]).trim() !== "") {
          pattern = String(catObj[2]).trim();
        }
        if (catObj[4]) {
          baselineUrut = parseInt(catObj[4]) || 0;
        }
      }

      const dataSheet = ss.getSheetByName(SHEET_DATA);
      const dataRows = dataSheet.getDataRange().getValues();
      dataRows.shift();

      let maxUrutInDb = 0;
      const dataFiltered = dataRows.filter(r => String(r[2]).trim() === String(kodeSurat).trim() && String(r[6]).trim() === String(tahun).trim());
      
      if (dataFiltered.length > 0) {
        maxUrutInDb = Math.max(0, ...dataFiltered.map(r => parseInt(r[1]) || 0));
      }

      const urutBaru = Math.max(maxUrutInDb, baselineUrut) + 1;
      const urutFormat = urutBaru.toString().padStart(2, '0');

      let nomorSuratLengkap = pattern
        .replace(/{JENIS}/g, kodeSurat)
        .replace(/{NO}/g, urutFormat)
        .replace(/{BULAN_ROMAWI}/g, bulanRomawi)
        .replace(/{KLASIFIKASI}/g, klasifikasi || '')
        .replace(/{KESATUAN}/g, singkatanKesatuan)
        .replace(/{TAHUN}/g, tahun);

      nomorSuratLengkap = nomorSuratLengkap.replace(/\/+/g, '/').replace(/\/ \//g, '/').trim();

      const timestamp = Utilities.formatDate(new Date(), 'Asia/Makassar', 'dd/MM/yyyy HH:mm:ss');
      const tglFormatted = Utilities.formatDate(dateObj, 'Asia/Makassar', 'dd/MM/yyyy');

      dataSheet.appendRow([
        timestamp,
        urutBaru,
        kodeSurat,
        nomorSuratLengkap,
        uraian,
        keperluan,
        tahun,
        pembuat,
        tglFormatted,
        userNrp || ''
      ]);

      SpreadsheetApp.flush();

      return jsonResponse({
        status: "success",
        nomorSurat: nomorSuratLengkap,
        urutBaru: urutBaru
      });
    }

    // ==========================================
    // ACTION: ADMIN - EDIT / UPDATE DATA SURAT
    // ==========================================
    if (action === "updateSurat") {
      const { rowIndex, nomorLengkap, uraian, keperluan, pembuat, tanggalSurat } = payload;
      const dataSheet = ss.getSheetByName(SHEET_DATA);
      
      if (rowIndex && parseInt(rowIndex) > 1) {
        const row = parseInt(rowIndex);
        if (nomorLengkap) dataSheet.getRange(row, 4).setValue(nomorLengkap);
        if (uraian) dataSheet.getRange(row, 5).setValue(uraian);
        if (keperluan) dataSheet.getRange(row, 6).setValue(keperluan);
        if (pembuat) dataSheet.getRange(row, 8).setValue(pembuat);
        if (tanggalSurat) dataSheet.getRange(row, 9).setValue(tanggalSurat);
        
        SpreadsheetApp.flush();
        return jsonResponse({ status: "success", message: "Data surat berhasil diperbarui!" });
      }

      return jsonResponse({ status: "error", message: "Row data tidak ditemukan!" });
    }

    // ==========================================
    // ACTION: ADMIN - DELETE DATA SURAT
    // ==========================================
    if (action === "deleteSurat") {
      const { rowIndex } = payload;
      const dataSheet = ss.getSheetByName(SHEET_DATA);
      
      if (rowIndex && parseInt(rowIndex) > 1) {
        dataSheet.deleteRow(parseInt(rowIndex));
        SpreadsheetApp.flush();
        return jsonResponse({ status: "success", message: "Data surat berhasil dihapus!" });
      }

      return jsonResponse({ status: "error", message: "Row data tidak ditemukan!" });
    }

    // ==========================================
    // ACTION: ADMIN - KELOLA PENGATURAN KESATUAN
    // ==========================================
    if (action === "saveSettings") {
      const { namaKesatuan, singkatan, subHeader } = payload;
      const setSheet = ss.getSheetByName(SHEET_SETTING);
      const rows = setSheet.getDataRange().getValues();
      
      const updateKey = (key, val) => {
        let foundIndex = -1;
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]).trim() === key) {
            foundIndex = i + 1;
            break;
          }
        }
        if (foundIndex > 0) {
          setSheet.getRange(foundIndex, 2).setValue(val);
        } else {
          setSheet.appendRow([key, val]);
        }
      };

      if (namaKesatuan) updateKey("Nama_Kesatuan", namaKesatuan);
      if (singkatan) updateKey("Singkatan_Kesatuan", singkatan);
      if (subHeader) updateKey("Sub_Header", subHeader);

      SpreadsheetApp.flush();
      return jsonResponse({ status: "success", message: "Identitas Kesatuan berhasil diperbarui!" });
    }

    // ==========================================
    // ACTION: ADMIN - KELOLA KATEGORI & BASELINE
    // ==========================================
    if (action === "saveCategory") {
      const { kode, nama, pattern, butuhKlasifikasi, nomorTerakhir } = payload;
      const catSheet = ss.getSheetByName(SHEET_KAT);
      const rows = catSheet.getDataRange().getValues();
      
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(kode).trim()) {
          foundIndex = i + 1;
          break;
        }
      }

      if (foundIndex > 0) {
        catSheet.getRange(foundIndex, 2, 1, 4).setValues([[nama, pattern, butuhKlasifikasi ? "Ya" : "Tidak", parseInt(nomorTerakhir) || 0]]);
      } else {
        catSheet.appendRow([kode, nama, pattern, butuhKlasifikasi ? "Ya" : "Tidak", parseInt(nomorTerakhir) || 0]);
      }
      SpreadsheetApp.flush();
      return jsonResponse({ status: "success", message: "Kategori berhasil disimpan!" });
    }

    if (action === "deleteCategory") {
      const { kode } = payload;
      const catSheet = ss.getSheetByName(SHEET_KAT);
      const rows = catSheet.getDataRange().getValues();
      
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(kode).trim()) {
          catSheet.deleteRow(i + 1);
          break;
        }
      }
      SpreadsheetApp.flush();
      return jsonResponse({ status: "success", message: "Kategori dihapus!" });
    }

    // ==========================================
    // ACTION: ADMIN - KELOLA USER & PERSONIL
    // ==========================================
    if (action === "saveUser") {
      const { nrp, password, nama, pangkat, jabatan, role, status } = payload;
      const userSheet = ss.getSheetByName(SHEET_USER);
      const rows = userSheet.getDataRange().getValues();
      
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(nrp).trim()) {
          foundIndex = i + 1;
          break;
        }
      }

      if (foundIndex > 0) {
        const currentPass = rows[foundIndex - 1][1];
        const newPass = password ? password : currentPass;
        userSheet.getRange(foundIndex, 2, 1, 6).setValues([[newPass, nama, pangkat, jabatan, role, status || "Aktif"]]);
      } else {
        userSheet.appendRow([nrp, password || "123456", nama, pangkat, jabatan, role || "Operator", status || "Aktif"]);
      }
      SpreadsheetApp.flush();
      return jsonResponse({ status: "success", message: "Data personil/user berhasil disimpan!" });
    }

    if (action === "deleteUser") {
      const { nrp } = payload;
      const userSheet = ss.getSheetByName(SHEET_USER);
      const rows = userSheet.getDataRange().getValues();
      
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(nrp).trim()) {
          userSheet.deleteRow(i + 1);
          break;
        }
      }
      SpreadsheetApp.flush();
      return jsonResponse({ status: "success", message: "Personil dihapus!" });
    }

    return jsonResponse({ status: "error", message: "Action tidak dikenal!" });

  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}