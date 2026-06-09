const banco = require("../banco");
const { FRONTEND_URL, mailerConfigurado, enviarEmail, montarEmailNotificacao } = require("./mailer");

function resumirErro(erro) {
  return String((erro && erro.message) || erro || "Falha ao enviar e-mail.").slice(0, 500);
}

async function listarAdministradoresTransportadora(transportadoraId) {
  const resultado = await banco.query(
    `SELECT id, nome, email
     FROM usuarios
     WHERE transportadora_id = $1
       AND perfil = 'admin'
       AND ativo = TRUE`,
    [transportadoraId]
  );

  return resultado.rows;
}

async function criarNotificacaoParaUsuario({ usuario, transportadoraId, tipo, titulo, mensagem, url, dados }) {
  const resultado = await banco.query(
    `INSERT INTO notificacoes
      (transportadora_id, usuario_id, tipo, titulo, mensagem, url, dados)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [
      transportadoraId,
      usuario.id,
      tipo,
      titulo,
      mensagem,
      url || null,
      JSON.stringify(dados || {})
    ]
  );

  const notificacaoId = resultado.rows[0].id;

  if (!mailerConfigurado() || !usuario.email) {
    return notificacaoId;
  }

  try {
    await enviarEmail(
      usuario.email,
      "AutoAcerto | " + titulo,
      montarEmailNotificacao({
        titulo,
        mensagem,
        linkAcao: url ? FRONTEND_URL + "/" + url.replace(/^\/+/, "") : FRONTEND_URL + "/index.html",
        textoAcao: "Ver no AutoAcerto"
      })
    );

    await banco.query(
      "UPDATE notificacoes SET email_enviado_em = CURRENT_TIMESTAMP, email_erro = NULL WHERE id = $1",
      [notificacaoId]
    );
  } catch (erro) {
    console.error("Erro ao enviar e-mail de notificacao:", erro.message);
    await banco.query(
      "UPDATE notificacoes SET email_erro = $1 WHERE id = $2",
      [resumirErro(erro), notificacaoId]
    );
  }

  return notificacaoId;
}

async function notificarAdministradoresTransportadora({ transportadoraId, tipo, titulo, mensagem, url, dados }) {
  if (!transportadoraId) return [];

  const administradores = await listarAdministradoresTransportadora(transportadoraId);
  const ids = [];

  for (const usuario of administradores) {
    const id = await criarNotificacaoParaUsuario({
      usuario,
      transportadoraId,
      tipo,
      titulo,
      mensagem,
      url,
      dados
    });
    ids.push(id);
  }

  return ids;
}

module.exports = {
  notificarAdministradoresTransportadora
};
