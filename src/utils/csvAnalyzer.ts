export type CsvRow = Record<string, string>;

export function countMissingValues(
  rows: CsvRow[],
  headers: string[]
) {
  return headers.map((header) => ({
    header,
    missing: rows.filter(
      (row) => !(row[header] ?? "").trim()
    ).length,
  }));
}

export function countDuplicateRows(
  rows: CsvRow[],
  headers: string[]
) {
  const uniqueRows = new Set(
    rows.map((row) =>
      JSON.stringify(headers.map((header) => row[header] ?? ""))
    )
  );

  return rows.length - uniqueRows.size;
}

export function calculateQualityScore(
  rows: CsvRow[],
  headers: string[]
) {
  if (rows.length === 0 || headers.length === 0) return 100;

  const totalCells = rows.length * headers.length;
  const missing = countMissingValues(rows, headers).reduce(
    (sum, column) => sum + column.missing,
    0
  );
  const duplicates = countDuplicateRows(rows, headers);

  const completeness = ((totalCells - missing) / totalCells) * 100;
  const uniqueness = ((rows.length - duplicates) / rows.length) * 100;

  return Math.round(completeness * 0.7 + uniqueness * 0.3);
}

export type MissingStrategy =
  | "keep"
  | "mean"
  | "median"
  | "mode"
  | "na"
  | "null"
  | "zero-to-null"
  | "remove-row";

export type DuplicateStrategy =
  | "keep-all"
  | "keep-first"
  | "keep-last";

export function cleanRows(
  rows: CsvRow[],
  headers: string[],
  missingStrategies: Record<string, MissingStrategy>,
  duplicateStrategy: DuplicateStrategy,
  droppedColumns: string[] = []
): CsvRow[] {
  const activeHeaders = headers.filter((h) => !droppedColumns.includes(h));

  const strategies = activeHeaders.map((header) => {
    const strategy = missingStrategies[header] ?? "keep";

    const values = rows
      .map((row) => (row[header] ?? "").trim())
      .filter((v) => v !== "" && (strategy !== "zero-to-null" || v !== "0"));

    const numeric = values.length > 0 &&
      values.every((value) => /^-?\d+(\.\d+)?$/.test(value));

    let replacement = "";

    if (strategy === "mean" && numeric) {
      replacement = String(
        values.reduce((sum, value) => sum + Number(value), 0) /
          values.length
      );
    }

    if (strategy === "median" && numeric) {
      const sorted = values.map(Number).sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);

      replacement = String(
        sorted.length % 2
          ? sorted[middle]
          : (sorted[middle - 1] + sorted[middle]) / 2
      );
    }

    if (strategy === "mode") {
      const counts = new Map<string, number>();

      values.forEach((value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });

      let bestValue = "";
      let bestCount = 0;

      counts.forEach((count, value) => {
        if (count > bestCount) {
          bestValue = value;
          bestCount = count;
        }
      });

      replacement = bestValue;
    }

    if (strategy === "na") replacement = "N/A";

    return { header, strategy, replacement };
  });

  let result = rows.map((row) => {
    const copy: CsvRow = {};

    activeHeaders.forEach((h) => {
      copy[h] = row[h] ?? "";
    });

    strategies.forEach(({ header, strategy, replacement }) => {
      let val = (copy[header] ?? "").trim();

      if (strategy === "zero-to-null" && val === "0") {
        copy[header] = "";
        val = "";
      }

      const missing = !val;

      if (!missing) return;

      if (strategy === "remove-row") return;

      if (
        strategy === "mean" ||
        strategy === "median" ||
        strategy === "mode" ||
        strategy === "na"
      ) {
        if (replacement !== "") {
          copy[header] = replacement;
        }
      }

      if (strategy === "null" || strategy === "keep") {
        copy[header] = "";
      }
    });

    return copy;
  });

  // Remove rows only when a configured column requests it.
  result = result.filter((row) =>
    !strategies.some(
      ({ header, strategy }) =>
        strategy === "remove-row" &&
        !(row[header] ?? "").trim()
    )
  );

  if (duplicateStrategy === "keep-first") {
    const seen = new Set<string>();

    result = result.filter((row) => {
      const key = JSON.stringify(headers.map((header) => row[header] ?? ""));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (duplicateStrategy === "keep-last") {
    const seen = new Set<string>();

    result = [...result]
      .reverse()
      .filter((row) => {
        const key = JSON.stringify(headers.map((header) => row[header] ?? ""));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .reverse();
  }

  return result;
}

export type ValidationIssue = {
  column: string;
  type: "Invalid email" | "Inconsistent number" | "Negative value";
  count: number;
  rows: number[];
  message: string;
};

export function validateData(
  rows: CsvRow[],
  headers: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const numericKeywords =
    /\b(age|price|cost|amount|quantity|qty|salary|weight|height|count|total|balance|score|duration|hours|rate|revenue|profit|stock|number|num|year)\b/i;

  headers.forEach((header) => {
    const values = rows.map((row, index) => ({
      value: (row[header] ?? "").trim(),
      row: index + 1,
    }));

    const nonEmpty = values.filter(({ value }) => value !== "");

    // 1. Validate email format
    if (/email|e-mail/i.test(header)) {
      const invalid = nonEmpty.filter(
        ({ value }) =>
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      );

      if (invalid.length > 0) {
        issues.push({
          column: header,
          type: "Invalid email",
          count: invalid.length,
          rows: invalid.map(({ row }) => row),
          message: `${invalid.length} invalid email value(s).`,
        });
      }
    }

    // 2. Detect non-numeric values in likely numeric columns
    if (numericKeywords.test(header)) {
      const numericPattern = /^-?\d+(\.\d+)?$/;

      const invalidNumbers = nonEmpty.filter(
        ({ value }) => !numericPattern.test(value)
      );

      if (invalidNumbers.length > 0) {
        issues.push({
          column: header,
          type: "Inconsistent number",
          count: invalidNumbers.length,
          rows: invalidNumbers.map(({ row }) => row),
          message: `${invalidNumbers.length} non-numeric value(s) in a likely numeric column.`,
        });
      }

      // 3. Detect negative values in likely non-negative columns
      const negativeValues = nonEmpty.filter(({ value }) => {
        if (!numericPattern.test(value)) return false;
        return Number(value) < 0;
      });

      if (negativeValues.length > 0) {
        issues.push({
          column: header,
          type: "Negative value",
          count: negativeValues.length,
          rows: negativeValues.map(({ row }) => row),
          message: `${negativeValues.length} negative value(s) found. Review whether they are valid.`,
        });
      }
    }
  });

  return issues;
}

