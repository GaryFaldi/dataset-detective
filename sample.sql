-- Sample SQL Dump for Dataset Detective
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY,
  name VARCHAR(50),
  age INT,
  department VARCHAR(50),
  salary DECIMAL(10,2)
);

INSERT INTO employees (id, name, age, department, salary) VALUES
  (1, 'Andi Prasetyo', 21, 'IT', 7500000),
  (2, 'Budi Santoso', NULL, 'Finance', 8200000),
  (3, 'Citra Lestari', 22, 'IT', 7900000),
  (4, 'Andi Prasetyo', 21, 'IT', 7500000),
  (5, 'Dewi Kartika', 24, NULL, 6800000);
