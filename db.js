const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./gastos.db"); // arquivo físico no projeto

// cria tabela de gastos
db.serialize(() => {
  db.run(`
    CREATE TABLE gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT,
      valor REAL,
      categoria TEXT,
      descricao TEXT,
      data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
