import { describe, it, expect } from "vitest";
import {
  countMissingValues,
  countDuplicateRows,
  calculateQualityScore,
  cleanRows,
  validateData,
  type CsvRow,
} from "./csvAnalyzer";

const headers = ["name", "age", "department"];

const sampleRows: CsvRow[] = [
  { name: "Andi", age: "21", department: "IT" },
  { name: "Budi", age: "", department: "Finance" },
  { name: "Citra", age: "22", department: "IT" },
  { name: "Andi", age: "21", department: "IT" },
  { name: "Dewi", age: "24", department: "" },
];

describe("Dataset Detective analyzer", () => {
  it("counts missing values by column", () => {
    expect(countMissingValues(sampleRows, headers)).toEqual([
      { header: "name", missing: 0 },
      { header: "age", missing: 1 },
      { header: "department", missing: 1 },
    ]);
  });

  it("detects duplicate rows", () => {
    expect(countDuplicateRows(sampleRows, headers)).toBe(1);
  });

  it("calculates a quality score", () => {
    // 13/15 cells complete, 4/5 rows unique.
    // 70% completeness + 30% uniqueness = 85.
    expect(calculateQualityScore(sampleRows, headers)).toBe(85);
  });

  it("removes duplicates but keeps incomplete rows by default", () => {
    const result = cleanRows(sampleRows, headers, {}, "keep-first");

    expect(result).toHaveLength(4);
    expect(result.some((row) => row.name === "Budi")).toBe(true);
    expect(result.some((row) => row.name === "Dewi")).toBe(true);
  });

  it("removes rows with missing values when requested", () => {
    const result = cleanRows(
      sampleRows,
      headers,
      { age: "remove-row", department: "remove-row" },
      "keep-first"
    );

    expect(result).toHaveLength(2);
    expect(result.map((row) => row.name)).toEqual(["Andi", "Citra"]);
  });

  it("fills missing values with specified strategies", () => {
    const result = cleanRows(
      sampleRows,
      headers,
      { age: "median", department: "na" },
      "keep-first"
    );

    expect(result).toHaveLength(4);
    const budi = result.find((row) => row.name === "Budi");
    const dewi = result.find((row) => row.name === "Dewi");
    expect(budi?.age).toBe("21.5");
    expect(dewi?.department).toBe("N/A");
  });

  it("handles duplicate strategies", () => {
    expect(cleanRows(sampleRows, headers, {}, "keep-all")).toHaveLength(5);
    expect(cleanRows(sampleRows, headers, {}, "keep-first")).toHaveLength(4);
    expect(cleanRows(sampleRows, headers, {}, "keep-last")).toHaveLength(4);
  });

  it("handles an empty dataset", () => {
    expect(countDuplicateRows([], headers)).toBe(0);
    expect(calculateQualityScore([], headers)).toBe(100);
    expect(cleanRows([], headers, {}, "keep-first")).toEqual([]);
  });
});

describe("Dataset Detective validation", () => {
  it("detects invalid email addresses", () => {
    const rows = [
      { email: "gary@example.com" },
      { email: "not-an-email" },
    ];

    const issues = validateData(rows, ["email"]);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("Invalid email");
    expect(issues[0].count).toBe(1);
    expect(issues[0].rows).toEqual([2]);
  });

  it("detects inconsistent numeric values", () => {
    const rows = [
      { age: "20" },
      { age: "unknown" },
      { age: "25" },
    ];

    const issues = validateData(rows, ["age"]);

    expect(
      issues.some((issue) => issue.type === "Inconsistent number")
    ).toBe(true);
  });

  it("flags negative values for likely non-negative fields", () => {
    const rows = [
      { quantity: "10" },
      { quantity: "-5" },
    ];

    const issues = validateData(rows, ["quantity"]);

    expect(
      issues.some((issue) => issue.type === "Negative value")
    ).toBe(true);
  });
});

