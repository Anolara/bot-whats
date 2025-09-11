const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Conexão com Supabase (URL vem da variável de ambiente no Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ex: postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres?sslmode=require
  ssl: { rejectUnauthorized: false },
});

// Garante que a tabela existe
(async () => {
  try {
    await pool.query(`
      create table if not exists gastos (
        id serial primary key,
        categoria text,
        valor numeric,
        data timestamp default now()
      )
    `);
    console.log("✅ Tabela pronta");
  } catch (err) {
    console.error("❌ Erro criando tabela:", err);
  }
})();

// Webhook Twilio
app.post("/webhook", async (req, res) => {
  const mensagem = req.body.Body?.trim() || "";
  let resposta = "❓ Não entendi. Envie no formato: 20 mercado";

  try {
    if (/^\d+(\.\d{1,2})?\s+\w+/.test(mensagem)) {
      // Ex: "20 mercado"
      const [valorStr, ...catArr] = mensagem.split(" ");
      const valor = parseFloat(valorStr);
      const categoria = catArr.join(" ");

      await pool.query(
        "insert into gastos (categoria, valor) values ($1, $2)",
        [categoria, valor]
      );

      resposta = `✅ Gasto de R$ ${valor.toFixed(
        2
      )} em "${categoria}" registrado com sucesso!`;
    } else if (mensagem.toLowerCase() === "total") {
      const result = await pool.query(`
        select categoria, sum(valor) as total, min(data) as primeira_data
        from gastos
        group by categoria
      `);

      if (result.rows.length === 0) {
        resposta = "📭 Nenhum gasto registrado ainda.";
      } else {
        // Data mais antiga geral
        const todasDatas = result.rows.map((r) => r.primeira_data);
        const primeiraInsercao = new Date(
          Math.min(...todasDatas.map((d) => new Date(d)))
        );

        resposta = `💰 Total de gastos (desde ${primeiraInsercao.toLocaleDateString()}):`;
        result.rows.forEach((r) => {
          resposta += `\n- ${r.categoria}: R$ ${parseFloat(r.total).toFixed(
            2
          )}`;
        });
      }
    } else if (mensagem.toLowerCase() === "limpar") {
      await pool.query("delete from gastos");
      resposta = "🗑️ Todos os gastos foram apagados!";
    }
  } catch (err) {
    console.error("❌ Erro no webhook:", err);
    resposta = "⚠️ Erro ao processar sua mensagem.";
  }

  const twiml = `<Response><Message>${resposta}</Message></Response>`;
  res.type("text/xml").send(twiml);
});

// Endpoint de status para teste/ping
app.get("/", (req, res) => {
  res.send("Bot online ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot rodando na porta ${PORT}`));
