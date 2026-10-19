# Dataset Detective ◈

Universal data quality profiler, cleaning studio, and multi-format dataset converter. 100% private and client-side (no data leaves your machine).

## Supported Formats

- **Excel (`.xlsx`, `.xls`)**: Import spreadsheets with multi-sheet inspection and export auto-sized columns.
- **SQL Dumps (`.sql`)**: Parse table data directly from `INSERT INTO` queries, export `CREATE TABLE` and batch `INSERT` scripts (MySQL, PostgreSQL, SQLite).
- **JSON (`.json`)**: Import & export structured dataset objects.
- **CSV (`.csv`)**: Comma-separated values with UTF-8 BOM.
- **TSV (`.tsv`, `.tab`)**: Tab-separated datasets.

## Key Features

- **Health Score & Quality Profiling**: Completeness, duplicate row detection, column data typing.
- **Anomaly Validation**: Email pattern verification, numeric inconsistency checks, negative value detection.
- **Smart Remediation**: Imputation with Mean, Median, Mode, N/A, Null, or Row-dropping.
- **Light & Dark Theme**: Universal cyber-indigo design system with instant toggle.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```
