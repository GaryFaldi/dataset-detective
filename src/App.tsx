import { useState, useEffect } from "react";
import {
  countMissingValues,
  countDuplicateRows,
  calculateQualityScore,
  cleanRows,
  validateData,
  type MissingStrategy,
  type DuplicateStrategy,
} from "./utils/csvAnalyzer";
import {
  parseDatasetFile,
  exportToCsv,
  exportToExcel,
  exportToSql,
  exportToJson,
  exportToTsv,
  sanitizeIdentifier,
  type SupportedFormat,
  type Dialect,
} from "./utils/datasetIO";
import "./App.css";

type CsvRow = Record<string, string>;

function App() {
  const [fileName, setFileName] = useState("");
  const [detectedFormat, setDetectedFormat] = useState<SupportedFormat>("csv");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [exportNotice, setExportNotice] = useState("");

  // Column management states
  const [droppedColumns, setDroppedColumns] = useState<string[]>([]);
  const [isAutoHeader, setIsAutoHeader] = useState(false);
  const [hasHeaderOverride, setHasHeaderOverride] = useState<boolean | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [editHeaderInput, setEditHeaderInput] = useState("");

  // Theme: light / dark with persistence & system preference fallback
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("dataset_detective_theme");
    if (saved === "dark" || saved === "light") return saved;
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dataset_detective_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("keep-first");
  const [missingStrategies, setMissingStrategies] =
    useState<Record<string, MissingStrategy>>({});

  // Export settings
  const [exportFormat, setExportFormat] = useState<SupportedFormat>("csv");
  const [sqlTableName, setSqlTableName] = useState("cleaned_dataset");
  const [sqlDialect, setSqlDialect] = useState<Dialect>("mysql");

  const [activeSection, setActiveSection] = useState<
    "overview" | "data-quality" | "data-preview"
  >("overview");

  const navigateTo = (
    section: "overview" | "data-quality" | "data-preview"
  ) => {
    setActiveSection(section);

    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const analyzeFile = async (
    file?: File,
    targetSheet?: string,
    overrideHeaderMode?: boolean
  ) => {
    if (!file) return;

    setLoading(true);
    setError("");
    setExportNotice("");

    try {
      const parsed = await parseDatasetFile(file, {
        activeSheetName: targetSheet,
        hasHeaders: overrideHeaderMode !== undefined ? overrideHeaderMode : (hasHeaderOverride ?? undefined),
      });

      setRawFile(file);
      setFileName(parsed.fileName);
      setDetectedFormat(parsed.fileType);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setSheetNames(parsed.sheetNames ?? []);
      setActiveSheet(parsed.activeSheet ?? "");
      setSqlTableName(sanitizeIdentifier(parsed.fileName, "cleaned_dataset"));
      setIsAutoHeader(Boolean(parsed.isAutoHeaderGenerated));
      setDroppedColumns([]);

      // Set default export format to match original input
      if (parsed.fileType === "excel") {
        setExportFormat("excel");
      } else if (parsed.fileType === "sql") {
        setExportFormat("sql");
      } else if (parsed.fileType === "json") {
        setExportFormat("json");
      } else if (parsed.fileType === "tsv") {
        setExportFormat("tsv");
      } else {
        setExportFormat("csv");
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the dataset file.");
      setLoading(false);
    }
  };

  const handleSheetChange = async (sheet: string) => {
    if (!rawFile) return;
    await analyzeFile(rawFile, sheet);
  };

  const toggleHeaderMode = async () => {
    if (!rawFile) return;
    const nextForceHeader = isAutoHeader;
    setHasHeaderOverride(nextForceHeader);
    await analyzeFile(rawFile, activeSheet, nextForceHeader);
    setExportNotice(
      nextForceHeader
        ? "Switched: Row 1 is now used as column headers."
        : "Switched: Row 1 is treated as raw data (columns auto-named col_1...)."
    );
  };

  const dropColumn = (col: string) => {
    setDroppedColumns((prev) => (prev.includes(col) ? prev : [...prev, col]));
    setExportNotice(`Column "${col}" removed from output dataset.`);
  };

  const restoreColumn = (col: string) => {
    setDroppedColumns((prev) => prev.filter((c) => c !== col));
    setExportNotice(`Column "${col}" restored to dataset.`);
  };

  const startEditHeader = (col: string) => {
    setEditingHeader(col);
    setEditHeaderInput(col);
  };

  const saveEditHeader = (oldName: string) => {
    const trimmed = editHeaderInput.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingHeader(null);
      return;
    }
    setHeaders((prev) => prev.map((h) => (h === oldName ? trimmed : h)));
    setRows((prev) =>
      prev.map((row) => {
        const copy = { ...row };
        copy[trimmed] = copy[oldName] ?? "";
        delete copy[oldName];
        return copy;
      })
    );
    setEditingHeader(null);
    setExportNotice(`Column "${oldName}" renamed to "${trimmed}".`);
  };

  // Active columns (excluding dropped ones)
  const activeHeaders = headers.filter((h) => !droppedColumns.includes(h));

  const missingByColumn = countMissingValues(rows, activeHeaders);

  const totalMissing = missingByColumn.reduce(
    (sum, column) => sum + column.missing,
    0
  );

  const duplicateCount = countDuplicateRows(rows, activeHeaders);
  const qualityScore = calculateQualityScore(rows, activeHeaders);

  const issueColumns = missingByColumn.filter(
    (column) => column.missing > 0
  );

  const validationIssues = validateData(rows, activeHeaders);

  const filteredRows = rows.filter((row) => {
    const matchesSearch = activeHeaders.some((header) =>
      (row[header] ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );

    const hasMissingValue = activeHeaders.some(
      (header) => !(row[header] ?? "").trim()
    );

    return (
      matchesSearch &&
      (!missingOnly || hasMissingValue)
    );
  });

  const cleanedRows = cleanRows(
    rows,
    headers,
    missingStrategies,
    duplicateStrategy,
    droppedColumns
  );

  const getDataType = (header: string) => {
    const values = rows
      .map((row) => row[header]?.trim() ?? "")
      .filter(Boolean);

    if (values.length === 0) return "Empty";
    if (values.every((value) => /^-?\d+(\.\d+)?$/.test(value))) {
      return "Number";
    }
    if (
      values.every(
        (value) =>
          /^(true|false)$/i.test(value)
      )
    ) {
      return "Boolean";
    }
    if (
      values.every(
        (value) =>
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value))
      )
    ) {
      return "Date";
    }
    return "Text";
  };

  const downloadReport = () => {
    const report = {
      generator: "Dataset Detective",
      fileName,
      detectedFormat,
      totalRows: rows.length,
      totalColumns: activeHeaders.length,
      droppedColumns,
      totalMissingValues: totalMissing,
      duplicateRows: duplicateCount,
      qualityScore,
      columns: missingByColumn.map(({ header, missing }) => ({
        name: header,
        type: getDataType(header),
        missingValues: missing,
      })),
      cleaningSummary: {
        originalRows: rows.length,
        cleanedRows: cleanedRows.length,
        rowsRemoved: rows.length - cleanedRows.length,
      },
    };

    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeIdentifier(fileName || "dataset")}_quality_report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (activeHeaders.length === 0) return;

    const baseName = fileName.replace(/\.[^/.]+$/, "") || "cleaned_dataset";

    switch (exportFormat) {
      case "excel":
        exportToExcel(cleanedRows, activeHeaders, baseName, activeSheet || "Cleaned Data");
        setExportNotice("Exported to Excel (.xlsx) successfully!");
        break;
      case "sql":
        exportToSql(cleanedRows, activeHeaders, sqlTableName || baseName, sqlDialect);
        setExportNotice(`Exported to SQL (.sql) for ${sqlDialect.toUpperCase()} successfully!`);
        break;
      case "json":
        exportToJson(cleanedRows, activeHeaders, baseName, true);
        setExportNotice("Exported to JSON (.json) successfully!");
        break;
      case "tsv":
        exportToTsv(cleanedRows, activeHeaders, baseName);
        setExportNotice("Exported to TSV (.tsv) successfully!");
        break;
      case "csv":
      default:
        exportToCsv(cleanedRows, activeHeaders, baseName);
        setExportNotice("Exported to CSV (.csv) successfully!");
        break;
    }

    setTimeout(() => {
      setExportNotice("");
    }, 4500);
  };

  const getFormatBadgeLabel = (format: SupportedFormat) => {
    switch (format) {
      case "excel":
        return "EXCEL";
      case "sql":
        return "SQL";
      case "json":
        return "JSON";
      case "tsv":
        return "TSV";
      case "csv":
      default:
        return "CSV";
    }
  };

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon-wrapper">
            <span className="brand-icon-glyph">◈</span>
          </div>
          <div className="brand-text">
            <span className="brand-title">Dataset Detective</span>
            <span className="brand-subtitle">UNIVERSAL DATA STUDIO</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <button
          type="button"
          className={`nav-item ${activeSection === "overview" ? "active" : ""}`}
          onClick={() => navigateTo("overview")}
        >
          <span className="nav-icon">▦</span>
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeSection === "data-quality" ? "active" : ""}`}
          onClick={() => navigateTo("data-quality")}
        >
          <span className="nav-icon">⌕</span>
          <span>Data Quality</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeSection === "data-preview" ? "active" : ""}`}
          onClick={() => navigateTo("data-preview")}
        >
          <span className="nav-icon">▤</span>
          <span>Data Preview</span>
        </button>

        <div className="sidebar-bottom">
          <div className="status-badge">
            <div className="status-dot" />
            <span>Local & Private Engine</span>
          </div>

          <button
            type="button"
            className="sidebar-theme-toggle"
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            <span>{theme === "light" ? "🌙 Switch to Dark" : "☀️ Switch to Light"}</span>
          </button>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <span className="breadcrumb-root">Dataset Detective</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Studio Workspace</span>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="theme-button"
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            <span className="privacy-badge">🔒 100% Client-Side Private</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading" id="overview">
            <div>
              <p className="eyebrow">UNIVERSAL DATA PROFILER & STUDIO</p>
              <h1>Dataset Detective</h1>
              <p className="subtitle">
                Inspect, clean, and convert datasets across CSV, Excel (.xlsx/.xls), SQL dumps, JSON, and TSV with instant client-side execution.
              </p>
            </div>
          </div>

          <section
            className={`upload-card ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) analyzeFile(file);
            }}
          >
            <div className="upload-icon">
              <span>⇪</span>
            </div>
            <h2>Ingest your dataset file</h2>
            <p>
              Drop or choose any dataset to profile schema, detect duplicate records,
              and fix data anomalies.
            </p>

            <div className="format-chips">
              <span className="format-chip chip-csv">CSV (.csv)</span>
              <span className="format-chip chip-excel">Excel (.xlsx, .xls)</span>
              <span className="format-chip chip-sql">SQL Dump (.sql)</span>
              <span className="format-chip chip-json">JSON (.json)</span>
              <span className="format-chip chip-tsv">TSV (.tsv)</span>
            </div>

            <label className="upload-button">
              {loading ? "Analyzing dataset..." : "Choose dataset file"}
              <input
                type="file"
                accept=".csv, .xlsx, .xls, .sql, .json, .tsv, .tab, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/json, text/plain"
                disabled={loading}
                onChange={(event) =>
                  analyzeFile(event.target.files?.[0])
                }
              />
            </label>

            <span className="upload-hint">
              Drop file here or browse · Processed locally inside your browser (zero data leaves your device)
            </span>

            {fileName && (
              <div className="file-info-container">
                <div className="file-info">
                  <span className={`format-tag ${detectedFormat}`}>
                    {getFormatBadgeLabel(detectedFormat)}
                  </span>
                  <span className="file-name" title={fileName}>📄 {fileName}</span>
                  <span className="success-text">Ready</span>
                </div>

                {/* Auto-detected headerless banner & toggle */}
                {isAutoHeader && (
                  <div className="header-alert-box">
                    <div className="alert-content">
                      <span className="alert-icon">ℹ️</span>
                      <div>
                        <strong>Headerless dataset auto-detected</strong>
                        <p>Row 1 contains raw data/timestamps/numbers (like 0), so columns were auto-named <code>col_1, col_2...</code></p>
                      </div>
                    </div>
                    <button type="button" className="alert-action-btn" onClick={toggleHeaderMode}>
                      Force Row 1 as Column Names
                    </button>
                  </div>
                )}

                {/* Manual toggle if headers are present */}
                {!isAutoHeader && (
                  <div className="header-mode-bar">
                    <span>First row is used as column headers.</span>
                    <button type="button" className="subtle-link-btn" onClick={toggleHeaderMode}>
                      Treat Row 1 as Data Record
                    </button>
                  </div>
                )}

                {sheetNames.length > 1 && (
                  <div className="sheet-selector-box">
                    <label htmlFor="sheet-select">Active Excel Sheet:</label>
                    <select
                      id="sheet-select"
                      className="sheet-select"
                      value={activeSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                    >
                      {sheetNames.map((sheet) => (
                        <option key={sheet} value={sheet}>
                          {sheet}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {error && <p className="error-message">{error}</p>}
          </section>

          <div className="section-heading">
            <h2>Data overview</h2>
            <span>{fileName ? `File: ${fileName}` : "Waiting for a dataset"}</span>
          </div>

          <section className="quality-score-card" id="data-quality">
            <div>
              <p className="score-label">OVERALL DATA HEALTH SCORE</p>
              <h2>{qualityScore}<span>/100</span></h2>
              <p className="score-description">
                {activeHeaders.length === 0
                  ? "Upload a dataset file to calculate its health score."
                  : qualityScore >= 90
                    ? "Excellent! Your dataset has high integrity."
                    : qualityScore >= 70
                      ? "Moderate quality. Review detected anomalies below."
                      : "Action required. Missing values and duplicates found."}
              </p>
            </div>

            <div className="score-track">
              <div
                className="score-fill"
                style={{ width: `${qualityScore}%` }}
              />
            </div>
          </section>

          <div className="stats-grid">
            <StatCard
              label="Total Rows"
              value={rows.length.toLocaleString()}
              description="Records detected"
              icon="▤"
            />
            <StatCard
              label="Active Columns"
              value={activeHeaders.length.toString()}
              description={droppedColumns.length > 0 ? `${droppedColumns.length} dropped` : "Fields in dataset"}
              icon="▥"
            />
            <StatCard
              label="Missing Values"
              value={totalMissing.toLocaleString()}
              description="Empty cells found"
              icon="◌"
            />
            <StatCard
              label="Duplicate Rows"
              value={duplicateCount.toLocaleString()}
              description="Repeated records"
              icon="⧉"
            />
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Detected issues</h2>
                <p>Potential data quality problems found in your file</p>
              </div>

              <span className="issue-count">
                {issueColumns.length + (duplicateCount > 0 ? 1 : 0)} issue types
              </span>
            </div>

            {activeHeaders.length === 0 ? (
              <div className="empty-state">
                Upload a dataset to detect quality issues.
              </div>
            ) : issueColumns.length === 0 && duplicateCount === 0 ? (
              <div className="issue-row">
                <span className="issue-indicator clean" />
                <div>
                  <strong>No missing values or duplicate rows</strong>
                  <p>All basic hygiene checks passed successfully.</p>
                </div>
              </div>
            ) : (
              <>
                {issueColumns.map(({ header, missing }) => (
                  <div className="issue-row" key={header}>
                    <span className="issue-indicator" />
                    <div>
                      <strong>Missing values in {header}</strong>
                      <p>{missing} empty cells detected.</p>
                    </div>
                  </div>
                ))}

                {duplicateCount > 0 && (
                  <div className="issue-row">
                    <span className="issue-indicator" />
                    <div>
                      <strong>Duplicate rows detected</strong>
                      <p>{duplicateCount} repeated records found.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Validation checks</h2>
                <p>
                  Anomalous and suspicious values flagged for review
                </p>
              </div>

              <span className="issue-count">
                {validationIssues.length} issue types
              </span>
            </div>

            {activeHeaders.length === 0 ? (
              <div className="empty-state">
                Upload a dataset to validate its data.
              </div>
            ) : validationIssues.length === 0 ? (
              <div className="issue-row">
                <span className="issue-indicator clean" />
                <div>
                  <strong>No validation issues detected</strong>
                  <p>
                    No suspicious patterns found in emails or numeric columns.
                  </p>
                </div>
              </div>
            ) : (
              validationIssues.map((issue, index) => (
                <div className="issue-row" key={`${issue.column}-${issue.type}-${index}`}>
                  <span className="issue-indicator" />
                  <div>
                    <strong>
                      {issue.type} — {issue.column}
                    </strong>
                    <p>{issue.message}</p>
                    <p className="issue-row-numbers">
                      Affected row(s): {issue.rows.slice(0, 10).join(", ")}
                      {issue.rows.length > 10 ? ", ..." : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Column schema & management</h2>
                <p>Manage schema, drop unwanted columns (like 0 or junk columns), or rename headers.</p>
              </div>
              {rows.length > 0 && (
                <button className="secondary-button" onClick={downloadReport}>
                  Download Audit Report (JSON) ↓
                </button>
              )}
            </div>

            {droppedColumns.length > 0 && (
              <div className="dropped-columns-bar">
                <span className="dropped-label">Excluded columns ({droppedColumns.length}):</span>
                <div className="dropped-tags-list">
                  {droppedColumns.map((col) => (
                    <span key={col} className="dropped-pill">
                      <span>{col}</span>
                      <button type="button" onClick={() => restoreColumn(col)} title="Restore this column">
                        + Restore
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeHeaders.length === 0 ? (
              <div className="empty-state">
                <span>▤</span>
                <p>Your column analysis will appear here.</p>
                <small>Upload a dataset to get started.</small>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Column name</th>
                      <th>Data type</th>
                      <th>Missing values</th>
                      <th>Completeness</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingByColumn.map(({ header, missing }) => {
                      const completeness =
                        rows.length === 0
                          ? 100
                          : Math.round(
                            ((rows.length - missing) / rows.length) * 100
                          );

                      return (
                        <tr key={header}>
                          <td className="column-name">
                            {editingHeader === header ? (
                              <div className="col-rename-form">
                                <input
                                  type="text"
                                  className="col-rename-input"
                                  value={editHeaderInput}
                                  onChange={(e) => setEditHeaderInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditHeader(header);
                                    if (e.key === "Escape") setEditingHeader(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className="col-save-btn"
                                  onClick={() => saveEditHeader(header)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="col-cancel-btn"
                                  onClick={() => setEditingHeader(null)}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="col-name-display">
                                <span>{header}</span>
                                <button
                                  type="button"
                                  className="col-icon-btn"
                                  onClick={() => startEditHeader(header)}
                                  title="Rename column"
                                >
                                  ✎
                                </button>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="type-badge">
                              {getDataType(header)}
                            </span>
                          </td>
                          <td className="missing-val-cell">{missing.toLocaleString()}</td>
                          <td>
                            <div className="completeness">
                              <div className="progress-track">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${completeness}%` }}
                                />
                              </div>
                              <span>{completeness}%</span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="col-drop-btn"
                              onClick={() => dropColumn(header)}
                              title="Drop/Exclude this column from the dataset"
                            >
                              ✕ Drop Column
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Data Cleaning & Multi-Format Converter</h2>
                <p>Configure cleaning strategies and download in Excel, SQL, JSON, CSV, or TSV.</p>
              </div>
            </div>

            <div className="cleaning-content">
              <label className="cleaning-option">
                <span>
                  <strong>Duplicate row handling</strong>
                  <small>Choose which repeated records to retain.</small>
                </span>
                <select
                  className="cleaning-select"
                  value={duplicateStrategy}
                  onChange={(event) =>
                    setDuplicateStrategy(event.target.value as DuplicateStrategy)
                  }
                >
                  <option value="keep-all">Keep all duplicates</option>
                  <option value="keep-first">Keep first occurrence</option>
                  <option value="keep-last">Keep last occurrence</option>
                </select>
              </label>

              <div className="missing-settings-title">
                <strong>Missing value treatment</strong>
                <small>Choose a remediation strategy individually for each column.</small>
              </div>

              {activeHeaders.map((header) => {
                const values = rows
                  .map((row) => (row[header] ?? "").trim())
                  .filter(Boolean);

                const isNumeric =
                  values.length > 0 &&
                  values.every((value) => /^-?\d+(\.\d+)?$/.test(value));

                return (
                  <label className="cleaning-option" key={header}>
                    <span>
                      <strong>{header}</strong>
                      <small>
                        {rows.filter((row) => !(row[header] ?? "").trim()).length}
                        {" "}missing value(s) · {isNumeric ? "Numeric" : "Text / other"}
                      </small>
                    </span>

                    <select
                      className="cleaning-select"
                      value={missingStrategies[header] ?? "keep"}
                      onChange={(event) =>
                        setMissingStrategies((previous) => ({
                          ...previous,
                          [header]: event.target.value as MissingStrategy,
                        }))
                      }
                    >
                      <option value="keep">Keep original</option>
                      {isNumeric && (
                        <>
                          <option value="mean">Fill with mean</option>
                          <option value="median">Fill with median</option>
                        </>
                      )}
                      <option value="mode">Fill with mode</option>
                      <option value="na">Fill with N/A</option>
                      <option value="null">Keep as null / empty</option>
                      <option value="zero-to-null">Treat "0" as null / empty</option>
                      <option value="remove-row">Remove affected row</option>
                    </select>
                  </label>
                );
              })}

              <div className="cleaning-summary">
                <div>
                  <span>Original records</span>
                  <strong>{rows.length.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Records after cleaning</span>
                  <strong>{cleanedRows.length.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Records pruned</span>
                  <strong>{(rows.length - cleanedRows.length).toLocaleString()}</strong>
                </div>
              </div>

              {/* Multi-Format Export Card */}
              <div className="export-control-panel">
                <div className="export-header">
                  <div>
                    <strong>Select Output Format</strong>
                    <p>Choose which dataset format to generate from your cleaned data.</p>
                  </div>
                </div>

                <div className="format-button-group">
                  <button
                    type="button"
                    className={`format-toggle-btn fmt-csv ${exportFormat === "csv" ? "active" : ""}`}
                    onClick={() => setExportFormat("csv")}
                  >
                    <span className="format-toggle-icon">📄</span>
                    <span className="format-toggle-text">CSV</span>
                    <span className="format-toggle-ext">.csv</span>
                  </button>

                  <button
                    type="button"
                    className={`format-toggle-btn fmt-excel ${exportFormat === "excel" ? "active" : ""}`}
                    onClick={() => setExportFormat("excel")}
                  >
                    <span className="format-toggle-icon">📊</span>
                    <span className="format-toggle-text">Excel</span>
                    <span className="format-toggle-ext">.xlsx</span>
                  </button>

                  <button
                    type="button"
                    className={`format-toggle-btn fmt-sql ${exportFormat === "sql" ? "active" : ""}`}
                    onClick={() => setExportFormat("sql")}
                  >
                    <span className="format-toggle-icon">🗄️</span>
                    <span className="format-toggle-text">SQL Script</span>
                    <span className="format-toggle-ext">.sql</span>
                  </button>

                  <button
                    type="button"
                    className={`format-toggle-btn fmt-json ${exportFormat === "json" ? "active" : ""}`}
                    onClick={() => setExportFormat("json")}
                  >
                    <span className="format-toggle-icon">💻</span>
                    <span className="format-toggle-text">JSON</span>
                    <span className="format-toggle-ext">.json</span>
                  </button>

                  <button
                    type="button"
                    className={`format-toggle-btn fmt-tsv ${exportFormat === "tsv" ? "active" : ""}`}
                    onClick={() => setExportFormat("tsv")}
                  >
                    <span className="format-toggle-icon">📑</span>
                    <span className="format-toggle-text">TSV</span>
                    <span className="format-toggle-ext">.tsv</span>
                  </button>
                </div>

                {/* SQL Configuration Settings */}
                {exportFormat === "sql" && (
                  <div className="sql-config-card">
                    <div className="sql-config-field">
                      <label htmlFor="sql-table-input">Database Table Name:</label>
                      <input
                        id="sql-table-input"
                        type="text"
                        className="sql-input"
                        value={sqlTableName}
                        onChange={(e) => setSqlTableName(e.target.value)}
                        placeholder="e.g. users_cleaned"
                      />
                    </div>

                    <div className="sql-config-field">
                      <label htmlFor="sql-dialect-select">SQL Dialect:</label>
                      <select
                        id="sql-dialect-select"
                        className="cleaning-select"
                        value={sqlDialect}
                        onChange={(e) => setSqlDialect(e.target.value as Dialect)}
                      >
                        <option value="mysql">MySQL / MariaDB</option>
                        <option value="postgres">PostgreSQL</option>
                        <option value="sqlite">SQLite</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="export-action-row">
                  <button
                    className="clean-button"
                    onClick={handleExport}
                    disabled={activeHeaders.length === 0}
                  >
                    Download Cleaned {getFormatBadgeLabel(exportFormat)} (.{exportFormat === "excel" ? "xlsx" : exportFormat}) ↓
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={downloadReport}
                    disabled={activeHeaders.length === 0}
                  >
                    Download Audit Report (JSON)
                  </button>
                </div>

                {exportNotice && (
                  <div className="export-notice-banner">
                    <span>✓</span> {exportNotice}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel" id="data-preview">
            <div className="panel-heading preview-heading">
              <div>
                <h2>Data preview</h2>
                <p>Showing {Math.min(filteredRows.length, 10)} of {filteredRows.length} matching records</p>
              </div>

              <div className="preview-controls">
                <input
                  className="search-input"
                  type="search"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />

                <label className="filter-label">
                  <input
                    type="checkbox"
                    checked={missingOnly}
                    onChange={(event) => setMissingOnly(event.target.checked)}
                  />
                  Missing values only
                </label>
              </div>
            </div>

            {activeHeaders.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {activeHeaders.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {activeHeaders.map((header) => (
                          <td key={header}>
                            {row[header] || (
                              <span className="missing-cell">Empty</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No data to preview yet.</p>
              </div>
            )}
          </section>

          <footer>
            Dataset Detective · Universal Data Profiler & Cleansing Studio · 100% Client-Side Privacy
          </footer>
        </div>
      </section>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  icon: string;
};

function StatCard({ label, value, description, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

export default App;