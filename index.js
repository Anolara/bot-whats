const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();

// Configura body-parser para JSON e URL encoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Conexão com PostgreSQL Railway (ou outro serviço)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Cria tabela se não existir
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        categoria TEXT,
        valor NUMERIC,
        data TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela pronta");
  } catch (err) {
    console.error("❌ Erro criando tabela:", err);
  }
})();

app.post("/whatsapp", async (req, res) => {
  console.log("📩 Requisição recebida:", req.body); // VERIFICAR O QUE CHEGOU

  const mensagem = req.body.Body?.trim() || "";
  let resposta = "❓ Não entendi. Envie no formato: 20 mercado";

  try {
    // Inserção de gasto
    if (/^\d+(\.\d{1,2})?\s+.+/.test(mensagem)) {
      const [valorStr, ...catArr] = mensagem.split(" ");
      const valor = parseFloat(valorStr);
      const categoria = catArr.join(" ");

      await pool.query(
        "INSERT INTO gastos (categoria, valor) VALUES ($1, $2)",
        [categoria, valor]
      );

      resposta = `✅ Gasto de R$ ${valor.toFixed(
        2
      )} em "${categoria}" registrado!`;
    } else if (mensagem.toLowerCase() === "total") {
      const result = await pool.query(`
        SELECT categoria, SUM(valor) AS total, MIN(data) AS primeira_data
        FROM gastos
        GROUP BY categoria
      `);

      if (result.rows.length === 0) {
        resposta = "📭 Nenhum gasto registrado ainda.";
      } else {
        const todasDatas = result.rows.map((r) => r.primeira_data);
        const primeiraInsercao = new Date(
          Math.min(...todasDatas.map((d) => new Date(d)))
        );

        resposta = `💰 Total de gastos (desde ${primeiraInsercao.toLocaleDateString(
          "pt-BR"
        )}):`;
        result.rows.forEach((r) => {
          resposta += `\n- ${r.categoria}: R$ ${parseFloat(r.total).toFixed(
            2
          )}`;
        });
      }
    } else if (mensagem.toLowerCase() === "limpar") {
      await pool.query("DELETE FROM gastos");
      resposta = "🗑️ Todos os gastos foram apagados!";
    }
  } catch (err) {
    console.error("❌ Erro processando mensagem:", err);
    resposta = "⚠️ Ocorreu um erro ao processar sua mensagem.";
  }

  // Sempre responde pro Twilio/Thunder Client
  const twiml = `<Response><Message>${resposta}</Message></Response>`;
  res.type("text/xml").send(twiml);
});

// Endpoint de teste/ping
app.get("/", (req, res) => {
  res.send("Bot online ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot rodando na porta ${PORT}`));
