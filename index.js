const express = require("express");
const bodyParser = require("body-parser");
const db = require("./db"); // banco SQLite já configurado
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.post("/whatsapp", (req, res) => {
  const mensagem = (req.body.Body || "").trim().toLowerCase();
  const usuario = req.body.From;
  let resposta = "🤖 Envie '<valor> <categoria>', 'total' ou 'limpar'.";

  // Registrar gasto: ex "20 mercado" ou "50 fast food"
  const regexGasto = /^(\d+(\.\d{1,2})?)\s+(.+)$/;
  const match = mensagem.match(regexGasto);

  if (match) {
    const valor = parseFloat(match[1]);
    const categoria = match[3];

    db.run(
      "INSERT INTO gastos (usuario, valor, categoria, descricao) VALUES (?, ?, ?, ?)",
      [usuario, valor, categoria, mensagem]
    );

    resposta = `💰 Gasto registrado: R$ ${valor.toFixed(2)} em ${categoria}`;
  }
  // Mostrar total
  else if (mensagem.includes("total")) {
    // Primeiro, pega a data da primeira inserção
    db.get(
      "SELECT MIN(data) as primeira_data FROM gastos WHERE usuario = ?",
      [usuario],
      (err, primeiraRow) => {
        if (err || !primeiraRow || !primeiraRow.primeira_data) {
          resposta = "📊 Nenhum gasto registrado.";
          const twiml = `<Response><Message>${resposta}</Message></Response>`;
          res.set("Content-Type", "text/xml");
          return res.send(twiml);
        }

        const dataFormatada = new Date(
          primeiraRow.primeira_data
        ).toLocaleDateString("pt-BR");

        // Agora pega total por categoria
        db.all(
          "SELECT categoria, SUM(valor) as total FROM gastos WHERE usuario = ? GROUP BY categoria ORDER BY total DESC",
          [usuario],
          (err, rows) => {
            if (err || !rows || rows.length === 0) {
              resposta = "📊 Nenhum gasto registrado.";
            } else {
              let totalGeral = 0;
              let texto = `📊 Total de gastos (desde ${dataFormatada}):\n`;
              rows.forEach((row) => {
                texto += `- ${row.categoria}: R$ ${row.total.toFixed(2)}\n`;
                totalGeral += row.total;
              });
              texto += `Total geral: R$ ${totalGeral.toFixed(2)}`;
              resposta = texto;
            }

            const twiml = `<Response><Message>${resposta}</Message></Response>`;
            res.set("Content-Type", "text/xml");
            return res.send(twiml);
          }
        );
      }
    );
    return;
  }
  // Limpar gastos do usuário
  else if (mensagem.includes("limpar")) {
    db.run("DELETE FROM gastos WHERE usuario = ?", [usuario], (err) => {
      let resp = "❌ Erro ao limpar gastos.";
      if (!err) resp = "✅ Seus gastos foram apagados!";
      const twiml = `<Response><Message>${resp}</Message></Response>`;
      res.set("Content-Type", "text/xml");
      return res.send(twiml);
    });
    return;
  }

  // Resposta padrão
  const twiml = `<Response><Message>${resposta}</Message></Response>`;
  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

// Logs de requisições para depuração
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Iniciar servidor
app.listen(3000, () => console.log("Bot rodando na porta 3000"));
