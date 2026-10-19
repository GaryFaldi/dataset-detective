# Dataset Detective ◈

[![Deploy to GitHub Pages](https://github.com/GaryFaldi/dataset-detective/actions/workflows/deploy.yml/badge.svg)](https://github.com/GaryFaldi/dataset-detective/actions/workflows/deploy.yml)

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-10B981)](#-privacy--data-security)

**Dataset Detective** is a modern web application for data quality profiling, data cleansing and remediation, and multi-format dataset conversion. All processing takes place **100% in your browser**, with no server-side file uploads, helping protect your data privacy.

---

## 🌟 Key Features

### 1. 📁 Flexible Multi-Format Support (Import & Export)

Dataset Detective supports several popular tabular data formats:

- **Excel (`.xlsx`, `.xls`)**: Read multi-sheet workbooks, select sheets for analysis, and export files with automatically adjusted column widths.
- **SQL Dumps (`.sql`)**: Extract table structures from `CREATE TABLE` statements and parse data from `INSERT INTO` batches and PostgreSQL `COPY` statements.
- **JSON (`.json`)**: Automatically parse arrays of objects and nested data structures.
- **CSV (`.csv`)**: Automatically detect delimiters (comma, semicolon, pipe, or tab), support escaped quotes, and handle UTF-8 BOM encoding.
- **TSV (`.tsv`, `.tab`)**: Support tab-separated values commonly used in bioinformatics datasets and machine learning logs.

### 2. 🛡️ Headerless Data & Column Shift Handling

Raw datasets may not have headers, such as transaction data where the first row contains numbers or timestamps. Some datasets may also contain placeholder columns, such as `0` values representing products without a brand.

- **Automatic Headerless Detection**: Detects when the first row appears to contain raw data (e.g., more than 35% numbers or timestamps) and generates virtual headers (`col_1`, `col_2`, etc.) without discarding the first row.
- **Manual Header Toggle**: Switch between “First row is header” and “First row is data” with one click.
- **Quick Column Renaming**: Rename column headers directly using the pencil icon (`✎`).
- **Drop & Restore Columns**: Remove unwanted columns with the `✕ Drop Column` feature and restore them using the restore drawer.
- **Zero-to-Null Strategy**: Optionally convert placeholder values such as `"0"` into `null` or empty cells to prevent them from distorting mean and median calculations.

### 3. 🔍 Data Profiling & Health Scoring

- **Dataset Health Score (0–100%)**: A combined metric that evaluates data completeness, duplicate rows, and format integrity.
- **Automatic Column Statistics**: Detect data types (numeric, text, date, and Boolean), distinct values, missing values, minimum and maximum values, and mean.
- **Smart Anomaly Detection**:
  - Validate email formats and identify invalid email addresses.
  - Flag negative numeric values in columns expected to contain positive values.
  - Detect data type inconsistencies within columns.

### 4. 🧹 Smart Cleaning Studio

- **Missing Value Handling**:
  - Statistical imputation: Mean, Median, and Mode.
  - Constant-value imputation: Custom text, `"N/A"`, or `"Null"`.
  - Remove rows containing empty cells.
- **Row Deduplication**: Instantly detect and remove identical rows.
- **Trimming & Normalization**: Automatically remove leading and trailing whitespace.

### 5. 💾 Multi-Format Export Studio

Export cleaned datasets into the format that best suits your workflow:

- **CSV**: UTF-8 encoding with BOM for improved compatibility with Microsoft Excel.
- **Excel (`.xlsx`)**: Export neatly formatted Excel files ready for presentation.
- **SQL Dumps (`.sql`)**: Generate `CREATE TABLE` and batch `INSERT INTO` scripts with support for:
  - **MySQL / MariaDB** using backticks (`` `table` ``).
  - **PostgreSQL** using double quotes (`"table"`).
  - **SQLite** using square brackets (`[table]`).
  - Customizable SQL table names.
- **JSON**: Export structured, indented or compact JSON arrays.
- **TSV**: Export tab-delimited files.

### 6. 🎨 Modern & Responsive Design

- **Cyber-Indigo Theme**: A clean, futuristic interface featuring slate and indigo colors.
- **Light & Dark Modes**: Switch themes instantly, with preferences saved in your browser.
- **Quick Sample Loader**: Test the application using sample CSV, Excel, SQL, and JSON datasets without uploading your own files.

---

## 🔒 Privacy & Data Security

> **Your data never leaves your device.**

- **0% Server-Side Processing**: Parsing, profiling, statistical calculations, cleaning, and exporting are performed entirely in browser memory using client-side JavaScript/Wasm.
- **Designed for Sensitive Data**: Files are not uploaded to a server for processing, making the application suitable for internal datasets, financial data, server logs, and confidential business information.

---

## 📊 Supported File Formats

| Format | Extensions | Import Features | Export Features |
|---|---|---|---|
| **Excel** | `.xlsx`, `.xls` | Multi-sheet workbook reading and automatic type inference | `.xlsx` export with automatic column widths |
| **SQL** | `.sql` | `CREATE TABLE`, `INSERT INTO`, and `COPY` parsing | `CREATE TABLE` and batch `INSERT` scripts for MySQL, PostgreSQL, and SQLite |
| **CSV** | `.csv` | Automatic delimiter detection, including comma, semicolon, and pipe; quote escaping | UTF-8 with BOM for compatibility with Excel and data tools |
| **JSON** | `.json` | Arrays of objects and nested object flattening | Structured, formatted JSON files |
| **TSV** | `.tsv`, `.tab` | Tab-delimiter support | Tab-separated datasets |

---

## 🚀 How to Use

1. **Upload a Dataset**: Drag and drop a `.csv`, `.xlsx`, `.sql`, `.json`, or `.tsv` file into the upload area, or click **Load Sample Data**.
2. **Review Health Scores & Anomalies**: Check the dataset health score, email and negative-number anomalies, and column data type distributions.
3. **Configure Headers & Columns**:
   - Enable **Headerless** mode if the first row contains data rather than headers.
   - Rename columns using the pencil icon (`✎`).
   - Remove irrelevant columns using `✕ Drop Column`.
4. **Choose a Cleaning Method**:
   - Select a missing-value strategy: Mean, Median, Mode, Zero-to-Null, or Drop.
   - Enable duplicate removal when needed.
5. **Export the Results**: Select a target format (CSV, Excel, SQL with your preferred dialect, JSON, or TSV), then click **Download Dataset**.

---

## 💻 Local Installation & Development

### Prerequisites

- [Node.js](https://nodejs.org/) version 18 or later.
- npm or pnpm.

### Run Locally

1. **Clone the repository:**

   ```bash
   git clone https://github.com/GaryFaldi/dataset-detective.git
   cd dataset-detective
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173` in your browser.

4. **Run unit tests:**

   ```bash
   npm test
   ```

5. **Run the linter:**

   ```bash
   npm run lint
   ```

6. **Build for production:**

   ```bash
   npm run build
   ```

   The production build will be available in the `dist/` directory.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Data Parsing & Processing**:
  - [PapaParse](https://www.papaparse.com/) — high-performance streaming CSV/TSV parsing.
  - [SheetJS / xlsx](https://sheetjs.com/) — Excel spreadsheet parsing and generation.
  - Custom in-browser SQL dialect parser and serializer.
- **Testing**: [Vitest](https://vitest.dev/) — 22 unit tests covering parsing, type inference, and remediation.
- **Code Linter**: [Oxlint](https://oxc.rs/)
- **Styling**: Modern vanilla CSS with CSS custom properties, glassmorphism, and fluid typography using Plus Jakarta Sans and JetBrains Mono.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute it for personal or commercial purposes.
