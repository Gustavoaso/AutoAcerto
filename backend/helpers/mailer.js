const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function obterEnv(...nomes) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }
  return "";
}

const BREVO_API_KEY = obterEnv("BREVO_API_KEY", "SENDINBLUE_API_KEY");
const BREVO_FROM = obterEnv("BREVO_FROM", "MAIL_FROM", "EMAIL_FROM") || "AutoAcerto <no-reply@autoacerto.com>";
const SUPORTE_EMAIL = obterEnv("SUPORTE_EMAIL", "SUPPORT_EMAIL") || parseRemetente(BREVO_FROM).email;
const FRONTEND_URL = (process.env.FRONTEND_URL || "https://autoacerto.com.br").replace(/\/+$/, "");

function parseRemetente(remetente) {
  const texto = String(remetente || "").trim();
  const combinado = texto.match(/^(.*?)\s*<([^>]+)>$/);

  if (combinado) {
    return {
      name: combinado[1].trim().replace(/^"|"$/g, "") || "AutoAcerto",
      email: combinado[2].trim()
    };
  }

  return {
    name: "AutoAcerto",
    email: texto
  };
}

function diagnosticarMailer() {
  const faltando = [];
  const remetente = parseRemetente(BREVO_FROM);

  if (!BREVO_API_KEY) faltando.push("BREVO_API_KEY");
  if (!remetente.email) faltando.push("BREVO_FROM/MAIL_FROM/EMAIL_FROM");

  return {
    configurado: faltando.length === 0,
    provedor: "brevo_api",
    faltando,
    from: BREVO_FROM,
    sender: remetente.email
  };
}

function mailerConfigurado() {
  return diagnosticarMailer().configurado;
}

function resumirRespostaBrevo(retorno) {
  if (!retorno) return "Falha ao enviar e-mail pela API Brevo.";
  if (retorno.message) return String(retorno.message);
  if (retorno.code) return String(retorno.code);
  if (retorno.bruto) return String(retorno.bruto).slice(0, 500);
  return "Falha ao enviar e-mail pela API Brevo.";
}

async function enviarEmail(destinatario, assunto, html) {
  const diagnostico = diagnosticarMailer();

  if (!diagnostico.configurado) {
    throw new Error("Brevo API nao configurada. Campos ausentes: " + diagnostico.faltando.join(", "));
  }

  const resposta = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: parseRemetente(BREVO_FROM),
      to: [{ email: destinatario }],
      subject: assunto,
      htmlContent: html
    })
  });

  const texto = await resposta.text();
  let retorno = null;

  try {
    retorno = texto ? JSON.parse(texto) : null;
  } catch {
    retorno = { bruto: texto };
  }

  if (!resposta.ok) {
    throw new Error(resumirRespostaBrevo(retorno));
  }

  return {
    provider: "brevo_api",
    messageId: retorno && retorno.messageId ? retorno.messageId : null,
    response: retorno
  };
}

function criarLayoutEmail({ titulo, subtitulo, conteudoHtml, rodapeHtml }) {
  return `
    <div style="margin:0;padding:32px;background:#eef4ff;font-family:Arial,sans-serif;color:#14213d;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d9e4f7;border-radius:20px;overflow:hidden;box-shadow:0 18px 45px rgba(20,33,61,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(180deg,#f8fbff 0%,#eef4ff 100%);border-bottom:1px solid #d9e4f7;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
            <img src="${FRONTEND_URL}/Imagens/logo%20nova.png" alt="AutoAcerto" style="width:42px;height:42px;object-fit:contain;" />
            <div style="font-size:28px;font-weight:800;color:#14213d;line-height:1;">AutoAcerto</div>
          </div>
          <div style="font-size:28px;font-weight:800;line-height:1.15;color:#14213d;">${titulo}</div>
          ${subtitulo ? `<div style="margin-top:10px;font-size:15px;line-height:1.6;color:#5f7197;">${subtitulo}</div>` : ""}
        </div>
        <div style="padding:32px;">
          ${conteudoHtml}
        </div>
        <div style="padding:20px 32px;border-top:1px solid #e5edf9;font-size:13px;line-height:1.7;color:#6b7ea5;background:#fbfdff;">
          ${rodapeHtml || "Se voce nao reconhece esta solicitacao, ignore este e-mail e revise a seguranca da sua conta."}
        </div>
      </div>
    </div>
  `;
}

function montarEmailRecuperacaoSenha({ nome, linkRedefinicao }) {
  return criarLayoutEmail({
    titulo: "Recuperacao de senha",
    subtitulo: `Recebemos um pedido para redefinir a senha da conta ${nome || "AutoAcerto"}.`,
    conteudoHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#30476d;">
        Clique no botao abaixo para criar uma nova senha. Este link expira em 1 hora.
      </p>
      <div style="margin:28px 0;">
        <a href="${linkRedefinicao}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
          Redefinir senha
        </a>
      </div>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#5f7197;">
        Se o botao nao abrir, copie e cole este endereco no navegador:<br />
        <span style="color:#1d4ed8;word-break:break-all;">${linkRedefinicao}</span>
      </p>
    `
  });
}

function montarEmailContato({ nome, email, mensagem }) {
  return criarLayoutEmail({
    titulo: "Novo contato pelo site",
    subtitulo: "Uma nova mensagem foi enviada a partir da tela de login.",
    conteudoHtml: `
      <div style="display:grid;gap:12px;">
        <div style="padding:14px 16px;border:1px solid #d9e4f7;border-radius:12px;background:#f8fbff;">
          <strong style="display:block;font-size:13px;color:#5f7197;margin-bottom:6px;">Nome</strong>
          <span style="font-size:15px;color:#14213d;">${nome}</span>
        </div>
        <div style="padding:14px 16px;border:1px solid #d9e4f7;border-radius:12px;background:#f8fbff;">
          <strong style="display:block;font-size:13px;color:#5f7197;margin-bottom:6px;">E-mail</strong>
          <span style="font-size:15px;color:#14213d;">${email}</span>
        </div>
        <div style="padding:14px 16px;border:1px solid #d9e4f7;border-radius:12px;background:#f8fbff;">
          <strong style="display:block;font-size:13px;color:#5f7197;margin-bottom:6px;">Mensagem</strong>
          <div style="font-size:15px;line-height:1.7;color:#14213d;white-space:pre-wrap;">${mensagem}</div>
        </div>
      </div>
    `,
    rodapeHtml: "Esta mensagem foi enviada pelo formulario publico de contato do AutoAcerto."
  });
}

function montarEmailBoasVindasAssinatura({ nomeAdmin, nomeTransportadora, emailAdmin, linkLogin, planoNome }) {
  return criarLayoutEmail({
    titulo: "Assinatura confirmada",
    subtitulo: `A conta da transportadora ${nomeTransportadora} foi criada com sucesso no AutoAcerto.`,
    conteudoHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#30476d;">
        Ola ${nomeAdmin || "cliente"}, sua assinatura do plano <strong>${planoNome}</strong> foi confirmada e o acesso inicial ja esta pronto.
      </p>
      <div style="display:grid;gap:12px;margin:20px 0;">
        <div style="padding:14px 16px;border:1px solid #d9e4f7;border-radius:12px;background:#f8fbff;">
          <strong style="display:block;font-size:13px;color:#5f7197;margin-bottom:6px;">Transportadora</strong>
          <span style="font-size:15px;color:#14213d;">${nomeTransportadora}</span>
        </div>
        <div style="padding:14px 16px;border:1px solid #d9e4f7;border-radius:12px;background:#f8fbff;">
          <strong style="display:block;font-size:13px;color:#5f7197;margin-bottom:6px;">Administrador inicial</strong>
          <span style="font-size:15px;color:#14213d;">${nomeAdmin} (${emailAdmin})</span>
        </div>
      </div>
      <div style="margin:28px 0;">
        <a href="${linkLogin}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
          Acessar AutoAcerto
        </a>
      </div>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#5f7197;">
        Caso precise de apoio para os primeiros passos, basta responder este e-mail.
      </p>
    `,
    rodapeHtml: "Este e-mail confirma a ativacao da assinatura e a criacao automatica da sua conta no AutoAcerto."
  });
}

function montarEmailNotificacao({ titulo, mensagem, linkAcao, textoAcao }) {
  return criarLayoutEmail({
    titulo,
    subtitulo: mensagem,
    conteudoHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#30476d;">
        ${mensagem}
      </p>
      ${linkAcao ? `
        <div style="margin:28px 0;">
          <a href="${linkAcao}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
            ${textoAcao || "Abrir no AutoAcerto"}
          </a>
        </div>
      ` : ""}
    `,
    rodapeHtml: "Esta notificacao foi enviada automaticamente pelo AutoAcerto."
  });
}

module.exports = {
  FRONTEND_URL,
  SUPORTE_EMAIL,
  diagnosticarMailer,
  mailerConfigurado,
  enviarEmail,
  montarEmailRecuperacaoSenha,
  montarEmailContato,
  montarEmailBoasVindasAssinatura,
  montarEmailNotificacao
};
