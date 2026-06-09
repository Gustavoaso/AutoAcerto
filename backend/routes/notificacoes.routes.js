const express = require("express");
const banco = require("../banco");
const { autenticar } = require("../middlewares/autenticacao");

const router = express.Router();

router.get("/", autenticar, async (requisicao, resposta) => {
  try {
    const limite = Math.min(Math.max(parseInt(requisicao.query.limite || "10", 10) || 10, 1), 50);

    const [lista, pendentes] = await Promise.all([
      banco.query(
        `SELECT id, tipo, titulo, mensagem, url, email_enviado_em, email_erro, lida_em, dados, data_cadastro
         FROM notificacoes
         WHERE usuario_id = $1
         ORDER BY data_cadastro DESC
         LIMIT $2`,
        [requisicao.usuario.id, limite]
      ),
      banco.query(
        `SELECT COUNT(*)::int AS total
         FROM notificacoes
         WHERE usuario_id = $1
           AND lida_em IS NULL`,
        [requisicao.usuario.id]
      )
    ]);

    return resposta.json({
      dados: lista.rows,
      nao_lidas: pendentes.rows[0] ? pendentes.rows[0].total : 0
    });
  } catch (erro) {
    console.error("Erro ao listar notificacoes:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel carregar as notificacoes." });
  }
});

router.patch("/:id/lida", autenticar, async (requisicao, resposta) => {
  try {
    const resultado = await banco.query(
      `UPDATE notificacoes
       SET lida_em = COALESCE(lida_em, CURRENT_TIMESTAMP)
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [requisicao.params.id, requisicao.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Notificacao nao encontrada." });
    }

    return resposta.json({ mensagem: "Notificacao marcada como lida." });
  } catch (erro) {
    console.error("Erro ao marcar notificacao como lida:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel atualizar a notificacao." });
  }
});

router.patch("/marcar-todas-lidas", autenticar, async (requisicao, resposta) => {
  try {
    await banco.query(
      `UPDATE notificacoes
       SET lida_em = COALESCE(lida_em, CURRENT_TIMESTAMP)
       WHERE usuario_id = $1 AND lida_em IS NULL`,
      [requisicao.usuario.id]
    );

    return resposta.json({ mensagem: "Notificacoes marcadas como lidas." });
  } catch (erro) {
    console.error("Erro ao marcar notificacoes como lidas:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel atualizar as notificacoes." });
  }
});

module.exports = router;
