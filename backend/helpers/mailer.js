const nodemailer = require("nodemailer");

function obterEnv(...nomes) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }
  return "";
}

const SMTP_URL = obterEnv("SMTP_URL", "MAIL_URL", "EMAIL_URL");
const SMTP_HOST = obterEnv("SMTP_HOST", "MAIL_HOST", "EMAIL_HOST");
const SMTP_PORT_BRUTA = obterEnv("SMTP_PORT", "MAIL_PORT", "EMAIL_PORT") || "465";
const SMTP_PORT = parseInt(SMTP_PORT_BRUTA, 10);
const SMTP_USER = obterEnv("SMTP_USER", "MAIL_USER", "EMAIL_USER");
const SMTP_PASS = obterEnv("SMTP_PASS", "MAIL_PASS", "EMAIL_PASS", "SMTP_PASSWORD", "MAIL_PASSWORD", "EMAIL_PASSWORD");
const SMTP_FROM = obterEnv("SMTP_FROM", "MAIL_FROM", "EMAIL_FROM") || SMTP_USER || "no-reply@autoacerto.com";
const SMTP_SECURE_BRUTO = obterEnv("SMTP_SECURE", "MAIL_SECURE", "EMAIL_SECURE");
const SUPORTE_EMAIL = obterEnv("SUPORTE_EMAIL", "SUPPORT_EMAIL") || SMTP_FROM;
const FRONTEND_URL = (process.env.FRONTEND_URL || "https://autoacerto.com.br").replace(/\/+$/, "");

let transportadorMemo = null;

function interpretarBoolean(valor) {
  const texto = String(valor || "").trim().toLowerCase();
  if (!texto) return null;
  if (["1", "true", "yes", "sim"].includes(texto)) return true;
  if (["0", "false", "no", "nao", "não"].includes(texto)) return false;
  return null;
}

function diagnosticarMailer() {
  const faltando = [];

  if (!SMTP_URL) {
    if (!SMTP_HOST) faltando.push("SMTP_HOST/MAIL_HOST");
    if (!Number.isInteger(SMTP_PORT) || SMTP_PORT <= 0) faltando.push("SMTP_PORT/MAIL_PORT");
    if (!SMTP_USER) faltando.push("SMTP_USER/MAIL_USER");
    if (!SMTP_PASS) faltando.push("SMTP_PASS/MAIL_PASS");
  }

  return {
    configurado: faltando.length === 0,
    usandoUrl: Boolean(SMTP_URL),
    faltando,
    from: SMTP_FROM,
    host: SMTP_HOST,
    port: Number.isInteger(SMTP_PORT) ? SMTP_PORT : null
  };
}

function mailerConfigurado() {
  return diagnosticarMailer().configurado;
}

function obterConfiguracaoTransportador() {
  if (SMTP_URL) {
    return SMTP_URL;
  }

  const secureInterpretado = interpretarBoolean(SMTP_SECURE_BRUTO);

  return {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: secureInterpretado == null ? SMTP_PORT === 465 : secureInterpretado,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  };
}

function obterTransportador() {
  const diagnostico = diagnosticarMailer();

  if (!diagnostico.configurado) {
    throw new Error("SMTP nao configurado no backend. Campos ausentes: " + diagnostico.faltando.join(", "));
  }

  if (!transportadorMemo) {
    transportadorMemo = nodemailer.createTransport(obterConfiguracaoTransportador());
  }

  return transportadorMemo;
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

async function enviarEmail(destinatario, assunto, html) {
  const transportador = obterTransportador();
  return transportador.sendMail({
    from: SMTP_FROM,
    to: destinatario,
    subject: assunto,
    html
  });
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

module.exports = {
  FRONTEND_URL,
  SUPORTE_EMAIL,
  diagnosticarMailer,
  mailerConfigurado,
  enviarEmail,
  montarEmailRecuperacaoSenha,
  montarEmailContato,
  montarEmailBoasVindasAssinatura
};
