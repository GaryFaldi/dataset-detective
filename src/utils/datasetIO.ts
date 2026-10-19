import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { CsvRow } from "./csvAnalyzer";

export type SupportedFormat = "csv" | "excel" | "sql" | "json" | "tsv";

export type Dialect = "mysql" | "postgres" | "sqlite";

export type ParsedDataset = {
  fileName: string;
  fileType: SupportedFormat;
  headers: string[];
  rows: CsvRow[];
  sheetNames?: string[];
  activeSheet?: string;
  rawWorkbook?: XLSX.WorkBook;
  isAutoHeaderGenerated?: boolean;
};

export type ParseDatasetOptions = {
  activeSheetName?: string;
  hasHeaders?: boolean;
};

/**
 * Clean & sanitize a name into a valid database table name or identifier
 */
export function sanitizeIdentifier(name: string, fallback = "cleaned_dataset"): string {
  const sanitized = name
    .trim()
    .replace(/\.[^/.]+$/, "") // strip extension
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");

  return sanitized || fallback;
}

/**
 * Infer SQL column type from values in the column
 */
export function inferSqlType(values: string[]): string {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "VARCHAR(255)";

  const isInteger = nonEmpty.every((v) => /^-?\d+$/.test(v));
  if (isInteger) return "INT";

  const isDecimal = nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v));
  if (isDecimal) return "DECIMAL(12, 4)";

  const isBoolean = nonEmpty.every((v) => /^(true|false|0|1)$/i.test(v));
  if (isBoolean) return "BOOLEAN";

  const isDate = nonEmpty.every(
    (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
  );
  if (isDate) return "DATE";

  const maxLength = Math.max(...nonEmpty.map((v) => v.length));
  if (maxLength <= 50) return "VARCHAR(50)";
  if (maxLength <= 255) return "VARCHAR(255)";
  return "TEXT";
}

/**
 * Detect whether a row of cells looks like a header or raw data.
 * Returns true if likely a header row, false if likely raw data records.
 */
export function isLikelyHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return true;
  let dataLikeCount = 0;

  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!trimmed) {
      dataLikeCount += 1;
      continue;
    }

    // Number check: pure numbers (0, 1924719191579951782, 561.51, -42)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      dataLikeCount += 1;
      continue;
    }

    // ISO timestamp or date check: e.g. 2018-12-01 11:40:29 UTC
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      dataLikeCount += 1;
      continue;
    }

    // Email check
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      dataLikeCount += 1;
      continue;
    }
  }

  // If 35% or more of the cells look like typical data values, it's NOT a header row
  return (dataLikeCount / cells.length) < 0.35;
}

/**
 * Parse SQL INSERT and COPY statements to extract table rows
 */
export function parseSqlDump(sqlText: string): { headers: string[]; rows: CsvRow[] } {
  // 1. Look for CREATE TABLE columns to have proper headers if INSERT has no column list
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?\s*\(([\s\S]+?)\)\s*(?:ENGINE|DEFAULT|;)/gi;
  let schemaHeaders: string[] = [];
  let createMatch: RegExpExecArray | null;
  while ((createMatch = createTableRegex.exec(sqlText)) !== null) {
    const colDefs = createMatch[2];
    const defLines = colDefs.split(/\r?\n/);
    for (const line of defLines) {
      const trimmed = line.trim().replace(/,$/, "");
      if (!trimmed || /^(PRIMARY\s+KEY|KEY|UNIQUE|CONSTRAINT|FOREIGN\s+KEY|INDEX|CHECK)\b/i.test(trimmed)) {
        continue;
      }
      const colMatch = /^[`"']?([a-zA-Z0-9_]+)[`"']?\s+[A-Za-z]/i.exec(trimmed);
      if (colMatch && colMatch[1]) {
        schemaHeaders.push(colMatch[1]);
      }
    }
  }

  // 2. Regex to match INSERT INTO statement
  // Matches: INSERT INTO `table` (`col1`, `col2`) VALUES (...)
  const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]+?);/gi;

  let headers: string[] = [];
  const rows: CsvRow[] = [];

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sqlText)) !== null) {
    const rawCols = match[2];
    const rawValuesBlock = match[3];

    let currentHeaders: string[] = [];
    if (rawCols) {
      currentHeaders = rawCols
        .split(",")
        .map((c) => c.trim().replace(/^[`"']|[`"']$/g, ""));
    } else if (schemaHeaders.length > 0) {
      currentHeaders = schemaHeaders;
    }

    // Split value tuples: e.g. ('val1', 2), ('val2', 3)
    const tuples: string[][] = [];
    let inTuple = false;
    let inString = false;
    let stringChar = "";
    let isEscaped = false;
    let currentTuple: string[] = [];
    let currentVal = "";

    for (let i = 0; i < rawValuesBlock.length; i++) {
      const char = rawValuesBlock[i];

      if (isEscaped) {
        currentVal += char;
        isEscaped = false;
        continue;
      }

      if (char === "\\") {
        isEscaped = true;
        continue;
      }

      if (inString) {
        if (char === stringChar) {
          if (rawValuesBlock[i + 1] === stringChar) {
            currentVal += stringChar;
            i++;
          } else {
            inString = false;
          }
        } else {
          currentVal += char;
        }
        continue;
      }

      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === "(" && !inTuple) {
        inTuple = true;
        currentTuple = [];
        currentVal = "";
        continue;
      }

      if (char === ")" && inTuple) {
        inTuple = false;
        currentTuple.push(currentVal.trim());
        tuples.push(currentTuple);
        currentTuple = [];
        currentVal = "";
        continue;
      }

      if (char === "," && inTuple) {
        currentTuple.push(currentVal.trim());
        currentVal = "";
        continue;
      }

      if (inTuple) {
        currentVal += char;
      }
    }

    if (tuples.length > 0) {
      if (currentHeaders.length === 0) {
        const maxLen = Math.max(...tuples.map((t) => t.length));
        currentHeaders = Array.from({ length: maxLen }, (_, idx) => `col_${idx + 1}`);
      }

      if (headers.length === 0) {
        headers = currentHeaders;
      }

      for (const tuple of tuples) {
        const row: CsvRow = {};
        headers.forEach((h, idx) => {
          let val = tuple[idx] ?? "";
          if (val.toUpperCase() === "NULL") {
            val = "";
          }
          row[h] = val;
        });
        rows.push(row);
      }
    }
  }

  // 3. Support PostgreSQL COPY table (cols) FROM stdin; ... \.
  const copyRegex = /COPY\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*(?:\(([^)]+)\))?\s*FROM\s+stdin;([\s\S]+?)\\\./gi;
  let copyMatch: RegExpExecArray | null;
  while ((copyMatch = copyRegex.exec(sqlText)) !== null) {
    const rawCols = copyMatch[2];
    const dataBlock = copyMatch[3].trim();
    let copyHeaders: string[] = [];
    if (rawCols) {
      copyHeaders = rawCols.split(",").map((c) => c.trim().replace(/^[`"']|[`"']$/g, ""));
    } else if (schemaHeaders.length > 0) {
      copyHeaders = schemaHeaders;
    }

    const lines = dataBlock.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const delimiter = line.includes("\t") ? "\t" : ",";
      const parts = line.split(delimiter);
      if (copyHeaders.length === 0) {
        copyHeaders = Array.from({ length: parts.length }, (_, idx) => `col_${idx + 1}`);
      }
      if (headers.length === 0) {
        headers = copyHeaders;
      }
      const row: CsvRow = {};
      headers.forEach((h, idx) => {
        let val = parts[idx] ?? "";
        if (val === "\\N" || val.toUpperCase() === "NULL") val = "";
        row[h] = val;
      });
      rows.push(row);
    }
  }

  if (headers.length === 0 || rows.length === 0) {
    throw new Error("No valid INSERT INTO statements with records found in the SQL file.");
  }

  return { headers, rows };
}

/**
 * Parse an Excel file ArrayBuffer into headers and rows
 */
export function parseExcelBuffer(
  buffer: ArrayBuffer,
  sheetIndexOrName?: number | string
): { headers: string[]; rows: CsvRow[]; sheetNames: string[]; activeSheet: string; workbook: XLSX.WorkBook } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error("The Excel workbook contains no sheets.");
  }

  let activeSheet = sheetNames[0];
  if (typeof sheetIndexOrName === "number" && sheetNames[sheetIndexOrName]) {
    activeSheet = sheetNames[sheetIndexOrName];
  } else if (typeof sheetIndexOrName === "string" && sheetNames.includes(sheetIndexOrName)) {
    activeSheet = sheetIndexOrName;
  }

  const sheet = workbook.Sheets[activeSheet];
  if (!sheet) {
    throw new Error(`Sheet "${activeSheet}" could not be found.`);
  }

  // Convert sheet to json array of objects with raw strings
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    // Check if there are header cells even without rows
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const extractedHeaders: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c });
      const cell = sheet[cellAddress];
      if (cell && cell.v !== undefined) {
        extractedHeaders.push(String(cell.v).trim());
      }
    }
    return {
      headers: extractedHeaders,
      rows: [],
      sheetNames,
      activeSheet,
      workbook,
    };
  }

  // Find all distinct header keys across rows to avoid missing columns
  const headerSet = new Set<string>();
  rawRows.forEach((r) => {
    Object.keys(r).forEach((k) => headerSet.add(k.trim()));
  });

  const headers = Array.from(headerSet);

  const rows: CsvRow[] = rawRows.map((r) => {
    const row: CsvRow = {};
    headers.forEach((h) => {
      const val = r[h];
      row[h] = val !== undefined && val !== null ? String(val).trim() : "";
    });
    return row;
  });

  return {
    headers,
    rows,
    sheetNames,
    activeSheet,
    workbook,
  };
}

/**
 * Parse a JSON dataset file (array of records or nested data objects)
 */
export function parseJsonDataset(jsonText: string): { headers: string[]; rows: CsvRow[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid JSON file format: ${err instanceof Error ? err.message : String(err)}`);
  }

  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.data)) items = obj.data;
    else if (Array.isArray(obj.rows)) items = obj.rows;
    else if (Array.isArray(obj.records)) items = obj.records;
    else if (Array.isArray(obj.items)) items = obj.items;
    else {
      // Single object record
      items = [obj];
    }
  }

  if (items.length === 0) {
    throw new Error("No data records found in the JSON file.");
  }

  // Extract keys
  const headerSet = new Set<string>();
  items.forEach((item) => {
    if (item && typeof item === "object") {
      Object.keys(item as Record<string, unknown>).forEach((k) => headerSet.add(k.trim()));
    }
  });

  const headers = Array.from(headerSet);
  if (headers.length === 0) {
    throw new Error("No valid keys found to generate columns from JSON data.");
  }

  const rows: CsvRow[] = items.map((item) => {
    const row: CsvRow = {};
    const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    headers.forEach((h) => {
      const v = obj[h];
      row[h] = v !== undefined && v !== null ? (typeof v === "object" ? JSON.stringify(v) : String(v).trim()) : "";
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Parse any dataset file by checking extension
 */
export async function parseDatasetFile(
  file: File,
  options?: ParseDatasetOptions
): Promise<ParsedDataset> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const activeSheetName = options?.activeSheetName;

  // Excel
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const result = parseExcelBuffer(buffer, activeSheetName);
    return {
      fileName,
      fileType: "excel",
      headers: result.headers,
      rows: result.rows,
      sheetNames: result.sheetNames,
      activeSheet: result.activeSheet,
      rawWorkbook: result.workbook,
    };
  }

  // SQL dump
  if (lowerName.endsWith(".sql")) {
    const text = await file.text();
    const { headers, rows } = parseSqlDump(text);
    return {
      fileName,
      fileType: "sql",
      headers,
      rows,
    };
  }

  // JSON
  if (lowerName.endsWith(".json")) {
    const text = await file.text();
    const { headers, rows } = parseJsonDataset(text);
    return {
      fileName,
      fileType: "json",
      headers,
      rows,
    };
  }

  // TSV or CSV
  const isTsv = lowerName.endsWith(".tsv") || lowerName.endsWith(".tab");
  const delimiter = isTsv ? "\t" : ",";
  const text = await file.text();

  // Preview first row to auto-detect whether headers exist
  const preview = Papa.parse<string[]>(text, {
    header: false,
    preview: 5,
    skipEmptyLines: "greedy",
    delimiter,
  });

  const firstRow = preview.data[0] ?? [];
  const detectedHasHeaders = isLikelyHeaderRow(firstRow);
  const useHeader = options?.hasHeaders !== undefined ? options.hasHeaders : detectedHasHeaders;

  if (useHeader) {
    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      delimiter,
    });
    const headers = parsed.meta.fields ?? [];
    if (headers.length === 0) {
      throw new Error(`No column headers found in ${isTsv ? "TSV" : "CSV"} file.`);
    }
    return {
      fileName,
      fileType: isTsv ? "tsv" : "csv",
      headers,
      rows: parsed.data,
      isAutoHeaderGenerated: false,
    };
  } else {
    // Headerless CSV or TSV
    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: "greedy",
      delimiter,
    });

    const maxCols = Math.max(...parsed.data.map((r) => r.length), 0);
    const headers = Array.from({ length: maxCols }, (_, i) => `col_${i + 1}`);
    const rows: CsvRow[] = parsed.data.map((rowArr) => {
      const obj: CsvRow = {};
      headers.forEach((h, i) => {
        obj[h] = rowArr[i] ?? "";
      });
      return obj;
    });

    return {
      fileName,
      fileType: isTsv ? "tsv" : "csv",
      headers,
      rows,
      isAutoHeaderGenerated: true,
    };
  }
}

/**
 * Trigger browser file download helper
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV (.csv)
 */
export function exportToCsv(
  rows: CsvRow[],
  headers: string[],
  baseFileName = "cleaned-dataset"
): void {
  const csv = Papa.unparse(rows, { columns: headers });
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const safeName = `${sanitizeIdentifier(baseFileName, "cleaned_data")}.csv`;
  triggerBrowserDownload(blob, safeName);
}

/**
 * Export data to Excel (.xlsx)
 */
export function exportToExcel(
  rows: CsvRow[],
  headers: string[],
  baseFileName = "cleaned-dataset",
  sheetName = "Cleaned Data"
): void {
  // Map rows with headers order
  const formattedRows = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h) => {
      const val = r[h] ?? "";
      // Auto-cast numbers for Excel math functions
      if (/^-?\d+(\.\d+)?$/.test(val) && val.length < 16) {
        obj[h] = Number(val);
      } else {
        obj[h] = val;
      }
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedRows, { header: headers });

  // Auto-width columns for nice appearance
  const colWidths = headers.map((header) => {
    let max = header.length;
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const cellVal = String(rows[i][header] ?? "");
      if (cellVal.length > max) max = cellVal.length;
    }
    return { wch: Math.min(Math.max(max + 3, 10), 40) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeName = `${sanitizeIdentifier(baseFileName, "cleaned_data")}.xlsx`;
  triggerBrowserDownload(blob, safeName);
}

/**
 * Export data to SQL (.sql) with CREATE TABLE and INSERT INTO
 */
export function generateSqlScript(
  rows: CsvRow[],
  headers: string[],
  tableName = "cleaned_dataset",
  dialect: Dialect = "mysql"
): string {
  const safeTable = sanitizeIdentifier(tableName, "cleaned_dataset");

  // Determine column definitions
  const quoteCol = (name: string) => {
    const safeCol = sanitizeIdentifier(name, "col");
    if (dialect === "postgres") return `"${safeCol}"`;
    return `\`${safeCol}\``;
  };

  const colDefinitions = headers.map((header) => {
    const colValues = rows.map((r) => r[header] ?? "");
    const sqlType = inferSqlType(colValues);
    return `  ${quoteCol(header)} ${sqlType}`;
  });

  const lines: string[] = [];
  lines.push(`-- ==========================================================`);
  lines.push(`-- Dataset Detective SQL Export`);
  lines.push(`-- Table: ${safeTable}`);
  lines.push(`-- Total records: ${rows.length}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Dialect: ${dialect.toUpperCase()}`);
  lines.push(`-- ==========================================================`);
  lines.push("");

  // CREATE TABLE
  lines.push(`CREATE TABLE IF NOT EXISTS ${quoteCol(safeTable)} (`);
  lines.push(`  ${quoteCol("id")} INT PRIMARY KEY ${dialect === "postgres" ? "GENERATED ALWAYS AS IDENTITY" : "AUTO_INCREMENT"},`);
  lines.push(colDefinitions.join(",\n"));
  lines.push(`);`);
  lines.push("");

  if (rows.length === 0) {
    return lines.join("\n");
  }

  // INSERT INTO statements in chunks of 500
  const CHUNK_SIZE = 500;
  const colList = headers.map(quoteCol).join(", ");

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    lines.push(`INSERT INTO ${quoteCol(safeTable)} (${colList}) VALUES`);

    const valueTuples = chunk.map((row) => {
      const values = headers.map((header) => {
        const val = (row[header] ?? "").trim();
        if (val === "" || val.toLowerCase() === "null") {
          return "NULL";
        }

        // Numbers
        if (/^-?\d+(\.\d+)?$/.test(val)) {
          return val;
        }

        // Booleans
        if (/^(true|false)$/i.test(val)) {
          return val.toUpperCase();
        }

        // Escape single quotes for SQL strings
        const escaped = val.replace(/'/g, "''").replace(/\\/g, "\\\\");
        return `'${escaped}'`;
      });

      return `  (${values.join(", ")})`;
    });

    lines.push(`${valueTuples.join(",\n")};`);
    lines.push("");
  }

  return lines.join("\n");
}

export function exportToSql(
  rows: CsvRow[],
  headers: string[],
  baseFileName = "cleaned-dataset",
  dialect: Dialect = "mysql"
): void {
  const sql = generateSqlScript(rows, headers, baseFileName, dialect);
  const blob = new Blob([sql], { type: "text/plain;charset=utf-8;" });
  const safeName = `${sanitizeIdentifier(baseFileName, "cleaned_data")}.sql`;
  triggerBrowserDownload(blob, safeName);
}

/**
 * Export data to JSON (.json)
 */
export function exportToJson(
  rows: CsvRow[],
  headers: string[],
  baseFileName = "cleaned-dataset",
  pretty = true
): void {
  // Format each row with exact header order
  const formatted = rows.map((r) => {
    const item: Record<string, unknown> = {};
    headers.forEach((h) => {
      const v = r[h] ?? "";
      if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 16) {
        item[h] = Number(v);
      } else {
        item[h] = v;
      }
    });
    return item;
  });

  const jsonStr = pretty ? JSON.stringify(formatted, null, 2) : JSON.stringify(formatted);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
  const safeName = `${sanitizeIdentifier(baseFileName, "cleaned_data")}.json`;
  triggerBrowserDownload(blob, safeName);
}

/**
 * Export data to TSV (.tsv)
 */
export function exportToTsv(
  rows: CsvRow[],
  headers: string[],
  baseFileName = "cleaned-dataset"
): void {
  const tsv = Papa.unparse(rows, { columns: headers, delimiter: "\t" });
  const blob = new Blob(["\uFEFF", tsv], { type: "text/tab-separated-values;charset=utf-8;" });
  const safeName = `${sanitizeIdentifier(baseFileName, "cleaned_data")}.tsv`;
  triggerBrowserDownload(blob, safeName);
}
