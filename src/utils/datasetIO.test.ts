import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  sanitizeIdentifier,
  inferSqlType,
  isLikelyHeaderRow,
  parseSqlDump,
  parseJsonDataset,
  parseExcelBuffer,
  generateSqlScript,
} from "./datasetIO";

describe("datasetIO", () => {
  describe("sanitizeIdentifier", () => {
    it("converts filenames and special characters to valid SQL identifiers", () => {
      expect(sanitizeIdentifier("My Raw Data (2024).csv")).toBe("my_raw_data_2024");
      expect(sanitizeIdentifier("users.xlsx")).toBe("users");
      expect(sanitizeIdentifier("123_test")).toBe("123_test");
      expect(sanitizeIdentifier("")).toBe("cleaned_dataset");
    });
  });

  describe("inferSqlType", () => {
    it("detects INT, DECIMAL, DATE, BOOLEAN, and VARCHAR types", () => {
      expect(inferSqlType(["1", "20", "-5"])).toBe("INT");
      expect(inferSqlType(["1.5", "20.99", "0.0"])).toBe("DECIMAL(12, 4)");
      expect(inferSqlType(["true", "false", "TRUE"])).toBe("BOOLEAN");
      expect(inferSqlType(["2024-01-01", "2024-12-31"])).toBe("DATE");
      expect(inferSqlType(["Jakarta", "Surabaya"])).toBe("VARCHAR(50)");
    });
  });

  describe("isLikelyHeaderRow", () => {
    it("returns true for typical column header names", () => {
      const headers = ["event_time", "order_id", "product_id", "quantity", "category_code", "brand", "price"];
      expect(isLikelyHeaderRow(headers)).toBe(true);
    });

    it("returns false for raw data rows containing timestamps and numbers", () => {
      const dataRow = [
        "2018-12-01 11:40:29 UTC",
        "1924719191579951782",
        "1842195256808833386",
        "1",
        "1806829201890738522",
        "jewelry.earring",
        "0",
        "561.51",
        "1515915625207851155",
        "",
        "red",
        "gold",
        "diamond",
      ];
      expect(isLikelyHeaderRow(dataRow)).toBe(false);
    });
  });

  describe("parseSqlDump", () => {
    it("extracts headers and rows from SQL INSERT statements", () => {
      const sql = `
        CREATE TABLE users (id INT, name VARCHAR(50), age INT);
        INSERT INTO users (id, name, age) VALUES (1, 'Budi Santoso', 25), (2, 'Siti Nurhaliza', 30);
      `;

      const result = parseSqlDump(sql);
      expect(result.headers).toEqual(["id", "name", "age"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ id: "1", name: "Budi Santoso", age: "25" });
      expect(result.rows[1]).toEqual({ id: "2", name: "Siti Nurhaliza", age: "30" });
    });

    it("extracts headers from CREATE TABLE when INSERT INTO has no column list", () => {
      const sql = `
        CREATE TABLE products (
          product_id BIGINT,
          category VARCHAR(50),
          brand VARCHAR(50),
          price DECIMAL(10,2)
        );
        INSERT INTO products VALUES (1842195, 'jewelry.earring', '0', 561.51);
      `;

      const result = parseSqlDump(sql);
      expect(result.headers).toEqual(["product_id", "category", "brand", "price"]);
      expect(result.rows[0]).toEqual({
        product_id: "1842195",
        category: "jewelry.earring",
        brand: "0",
        price: "561.51",
      });
    });

    it("handles NULL and escaped quotes in SQL", () => {
      const sql = `
        INSERT INTO items (code, note) VALUES ('A1', NULL), ('B2', 'It''s fine');
      `;

      const result = parseSqlDump(sql);
      expect(result.headers).toEqual(["code", "note"]);
      expect(result.rows[0]).toEqual({ code: "A1", note: "" });
      expect(result.rows[1]).toEqual({ code: "B2", note: "It's fine" });
    });
  });

  describe("parseJsonDataset", () => {
    it("parses array of objects into headers and string rows", () => {
      const json = JSON.stringify([
        { id: 1, name: "Alice", active: true },
        { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      const result = parseJsonDataset(json);
      expect(result.headers).toEqual(["id", "name", "active", "email"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].id).toBe("1");
      expect(result.rows[0].email).toBe("");
      expect(result.rows[1].email).toBe("bob@example.com");
    });

    it("parses wrapped data object with items key", () => {
      const json = JSON.stringify({
        data: [{ score: 95, grade: "A" }],
      });

      const result = parseJsonDataset(json);
      expect(result.headers).toEqual(["score", "grade"]);
      expect(result.rows[0]).toEqual({ score: "95", grade: "A" });
    });
  });

  describe("parseExcelBuffer", () => {
    it("reads worksheets from Excel buffer into headers and rows", () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([
        { City: "Jakarta", Population: 10000000 },
        { City: "Bandung", Population: 2500000 },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const result = parseExcelBuffer(buffer);

      expect(result.sheetNames).toEqual(["Sheet1"]);
      expect(result.headers).toContain("City");
      expect(result.headers).toContain("Population");
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].City).toBe("Jakarta");
    });
  });

  describe("generateSqlScript", () => {
    it("creates CREATE TABLE and INSERT INTO query with proper types and escaping", () => {
      const headers = ["name", "score"];
      const rows = [
        { name: "John O'Connor", score: "98.5" },
        { name: "Jane", score: "" },
      ];

      const sql = generateSqlScript(rows, headers, "students", "mysql");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS `students`");
      expect(sql).toContain("`name` VARCHAR(50)");
      expect(sql).toContain("`score` DECIMAL(12, 4)");
      expect(sql).toContain("INSERT INTO `students` (`name`, `score`) VALUES");
      expect(sql).toContain("('John O''Connor', 98.5)");
      expect(sql).toContain("('Jane', NULL)");
    });
  });
});
