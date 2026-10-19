# Dataset Detective ◈

[![Deploy to GitHub Pages](https://github.com/GaryFaldi/dataset-detective/actions/workflows/deploy.yml/badge.svg)](https://github.com/GaryFaldi/dataset-detective/actions/workflows/deploy.yml)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-10B981)](#-privasi--keamanan-data)

> **Dataset Detective** adalah platform web modern untuk profiling kualitas data, pembersihan (*data cleansing & remediation*), serta konversi multi-format dataset. Semua proses berjalan **100% di browser Anda** (*zero server upload*), menjamin keamanan dan privasi data secara penuh.

---

## 🌟 Fitur Utama

### 1. 📁 Dukungan Multi-Format Fleksibel (Import & Export)
Dataset Detective tidak hanya bekerja pada CSV, tetapi mendukung berbagai format data tabular populer:
- **Excel (`.xlsx`, `.xls`)**: Baca multi-sheet workbook, pilih sheet yang ingin dianalisis, dan ekspor kembali dengan auto-column width yang rapi.
- **SQL Dumps (`.sql`)**: Ekstraksi struktur tabel dari query `CREATE TABLE` dan parsing baris data dari batch query `INSERT INTO` maupun PostgreSQL `COPY`.
- **JSON (`.json`)**: Parsing otomatis array of objects maupun struktur data bertingkat.
- **CSV (`.csv`)**: Auto-detect delimiter (koma, titik koma, pipa, tab), dukungan quote escaping, dan UTF-8 BOM encoding.
- **TSV (`.tsv`, `.tab`)**: Tab-separated value untuk dataset bioinformatika atau log machine learning.

### 2. 🛡️ Penanganan Data Tanpa Header & Pergeseran Kolom (*Anomaly Handling*)
Seringkali dataset mentah tidak memiliki header (misalnya baris pertama langsung berisi angka/timestamp seperti dataset e-commerce/transaksi), atau memiliki kolom dummy (seperti nilai `0` untuk produk tanpa brand):
- **Auto-Detection Headerless**: Sistem secara cerdas mendeteksi jika baris pertama adalah data mentah (misal >35% angka/timestamp) dan otomatis membuat header virtual (`col_1`, `col_2`, ...) tanpa membuang baris pertama.
- **Manual Header Toggle**: Bebas beralih dalam 1 klik antara mode *"Baris pertama adalah header"* dan *"Baris pertama adalah data"*.
- **Rename Kolom Cepat**: Klik ikon pensil (`✎`) pada nama kolom untuk mengubah header secara langsung.
- **Drop & Restore Kolom**: Hapus kolom yang tidak diinginkan (`✕ Drop Column`) dengan fitur pemulihan (*restore drawer*).
- **Strategi Zero-to-Null**: Opsi otomatis untuk mengonversi angka dummy `"0"` menjadi *null / empty cell* agar tidak mengacaukan statistik mean/median.

### 3. 🔍 Data Profiling & Health Scoring
- **Skor Kesehatan Dataset (0–100%)**: Metrik gabungan yang menghitung tingkat kelengkapan (*completeness*), baris duplikat, dan integritas format.
- **Statistik Kolom Otomatis**: Deteksi tipe data (Numerik, Teks, Tanggal, Boolean), nilai unik (*distinct values*), missing values, nilai minimum, maksimum, dan rata-rata (*mean*).
- **Deteksi Anomali Cerdas**:
  - Validasi format email (menemukan email tidak valid).
  - Peringatan nilai numerik negatif pada kolom yang seharusnya positif.
  - Deteksi inkonsistensi tipe data di setiap kolom.

### 4. 🧹 Remediasi & Pembersihan Data (*Smart Cleaning Studio*)
- **Penanganan Missing Values**:
  - Imputasi statistik: Mean, Median, Mode.
  - Imputasi nilai konstan: Kustom teks, `"N/A"`, atau `"Null"`.
  - Hapus baris yang mengandung sel kosong.
- **Deduplikasi Baris**: Deteksi dan bersihkan baris identik secara instan.
- **Trim & Normalisasi**: Otomatis membersihkan spasi berlebih (*leading/trailing whitespace*).

### 5. 💾 Multi-Format Export Studio
Setelah dibersihkan, data dapat langsung diekspor ke berbagai format sesuai kebutuhan:
- **CSV**: Encoding UTF-8 dengan BOM untuk kompatibilitas sempurna dengan Microsoft Excel.
- **Excel (`.xlsx`)**: File Excel rapi siap presentasi.
- **SQL Dumps (`.sql`)**: Menghasilkan script `CREATE TABLE` + batch `INSERT INTO` siap pakai dengan pilihan dialek:
  - **MySQL / MariaDB** (menggunakan backticks `` `table` ``)
  - **PostgreSQL** (menggunakan double quotes `"table"`)
  - **SQLite** (menggunakan square brackets `[table]`)
  - Nama tabel SQL dapat dikustomisasi secara dinamis.
- **JSON**: Output JSON array yang diformat rapi (*indented*) atau ringkas.
- **TSV**: Tab-delimited file.

### 6. 🎨 Desain Modern & Responsif
- **Cyber-Indigo Theme**: Antarmuka futuristik, bersih, dan profesional dengan palet warna slate & indigo.
- **Mode Terang & Gelap (Light / Dark Mode)**: Dilengkapi toggle tema instan yang menyimpan preferensi Anda di browser.
- **Quick Sample Loader**: Tombol demo cepat untuk menguji dataset sampel (CSV, Excel, SQL, JSON) tanpa perlu upload file sendiri.

---

## 🔒 Privasi & Keamanan Data

> **Data Anda tidak pernah meninggalkan perangkat Anda.**

- **0% Server Processing**: Seluruh operasi parsing, profiling, kalkulasi statistik, pembersihan, dan ekspor dilakukan sepenuhnya di memori browser (Client-side JavaScript/Wasm).
- **Aman untuk Data Sensitif**: Tidak ada koneksi internet yang mengirimkan data file Anda ke server mana pun. Sangat aman untuk data internal, data keuangan, log server, maupun data rahasia perusahaan.

---

## 📊 Ringkasan Format File

| Format | Ekstensi | Fitur Import | Fitur Export |
| :--- | :--- | :--- | :--- |
| **Excel** | `.xlsx`, `.xls` | Membaca multi-sheet workbook, auto-inferensi tipe data | Format `.xlsx` dengan auto-width kolom |
| **SQL** | `.sql` | Parser sintaks `CREATE TABLE`, `INSERT INTO`, dan `COPY` | Script `CREATE TABLE` + batch `INSERT` (MySQL, PG, SQLite) |
| **CSV** | `.csv` | Auto-detect delimiter (`,` `;` `\|`), escaping quotes | UTF-8 dengan BOM (kompatibel Excel & tools data) |
| **JSON** | `.json` | Array of objects, nested object flattening | File `.json` terstruktur dan diformat rapi |
| **TSV** | `.tsv`, `.tab` | Tab delimiter support | Tab-separated dataset |

---

## 🚀 Panduan Penggunaan (*Workflow*)

```mermaid
graph LR
    A[Upload File] --> B[Auto-Profile & Health Score]
    B --> C[Periksa Anomali & Header]
    C --> D[Pilih Remediasi / Drop Kolom]
    D --> E[Preview Hasil Pembersihan]
    E --> F[Ekspor ke CSV / Excel / SQL / JSON]
```

1. **Upload Dataset**: Tarik (*drag-and-drop*) file `.csv`, `.xlsx`, `.sql`, `.json`, atau `.tsv` ke area upload, atau klik tombol **Load Sample Data**.
2. **Review Health Score & Anomali**: Periksa skor kesehatan data, anomali email/angka negatif, dan distribusi tipe kolom.
3. **Atur Header & Kolom**:
   - Jika baris pertama bukan header, aktifkan mode **Headerless**.
   - Ganti nama kolom dengan klik tombol **✎**.
   - Hapus kolom yang tidak relevan dengan tombol **✕ Drop Column**.
4. **Pilih Metode Pembersihan**:
   - Tentukan perlakuan nilai kosong (Mean, Median, Mode, Zero-to-Null, atau Drop).
   - Aktifkan opsi pembersihan duplikat jika diperlukan.
5. **Ekspor**: Pilih format target (CSV, Excel, SQL dengan dialek pilihan, JSON, atau TSV) lalu klik **Download Dataset**.

---

## 💻 Panduan Instalasi & Pengembangan Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau lebih baru.
- npm atau pnpm.

### Menjalankan di Komputer Lokal

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/GaryFaldi/dataset-detective.git
   cd dataset-detective
   ```

2. **Instal dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan development server:**
   ```bash
   npm run dev
   ```
   Buka browser di `http://localhost:5173` untuk melihat aplikasi.

4. **Menjalankan pengujian (Unit Tests):**
   ```bash
   npm test
   ```

5. **Linting kode:**
   ```bash
   npm run lint
   ```

6. **Membangun bundle produksi (*production build*):**
   ```bash
   npm run build
   ```
   File hasil kompilasi akan tersedia di direktori `dist/`.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Data Parsing & Processing Engine**:
  - [PapaParse](https://www.papaparse.com/) (High-performance streaming CSV/TSV parser)
  - [SheetJS / xlsx](https://sheetjs.com/) (Excel spreadsheet parsing & generation)
  - Custom In-Browser SQL Dialect Parser & Serializer
- **Testing**: [Vitest](https://vitest.dev/) (22 unit tests untuk parser, inferensi tipe data, dan remediasi)
- **Code Linter**: [Oxlint](https://oxc.rs/)
- **Styling**: Vanilla CSS modern dengan CSS Custom Properties, Glassmorphism, dan fluid typography (*Plus Jakarta Sans* & *JetBrains Mono*).

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT License](LICENSE). Bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan pribadi maupun komersial.
