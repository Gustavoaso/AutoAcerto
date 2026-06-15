const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Stripe = require("stripe");
const banco = require("../banco");
const { normalizarEmail, emailValido, cnpjValido } = require("../validacoes");
const { exigirAdmin } = require("../middlewares/autenticacao");
const { obterIdTransportadora } = require("../helpers/escopo");
const { montarResumoAssinatura } = require("../helpers/assinaturas");
const { FRONTEND_URL, diagnosticarMailer, mailerConfigurado, enviarEmail, montarEmailBoasVindasAssinatura } = require("../helpers/mailer");

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const URL_FRONTEND = (process.env.FRONTEND_URL || FRONTEND_URL).replace(/\/+$/, "");

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const PLANOS_ASSINATURA = {
  essencial: {
    codigo: "essencial",
    nome: "Plano Essencial",
    valor: 129.9,
    descricao: "Ideal para operacoes menores e em fase de organizacao.",
    limiteVeiculos: 10,
    stripePriceId: process.env.STRIPE_PRICE_ESSENCIAL || ""
  },
  profissional: {
    codigo: "profissional",
    nome: "Plano Profissional",
    valor: 249.9,
    descricao: "Estrutura principal para a maioria das transportadoras.",
    limiteVeiculos: 20,
    stripePriceId: process.env.STRIPE_PRICE_PROFISSIONAL || ""
  },
  escala: {
    codigo: "escala",
    nome: "Plano Escala",
    valor: 499.9,
    descricao: "Mais capacidade operacional para estruturas maiores.",
    limiteVeiculos: null,
    stripePriceId: process.env.STRIPE_PRICE_ESCALA || ""
  }
};

function obterPlano(codigo) {
  return PLANOS_ASSINATURA[String(codigo || "").trim().toLowerCase()] || null;
}

function obterPlanoPorStripePriceId(priceId) {
  const priceTratado = String(priceId || "").trim();
  return Object.values(PLANOS_ASSINATURA).find(function (plano) {
    return plano.stripePriceId && plano.stripePriceId === priceTratado;
  }) || null;
}

function stripeConfigurado() {
  return Boolean(stripe && STRIPE_WEBHOOK_SECRET);
}

function gerarReferenciaExterna() {
  return "aa_" + crypto.randomBytes(12).toString("hex");
}

function statusAssinaturaAtiva(status) {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

function normalizarStatusStripe(status) {
  return String(status || "").trim().toLowerCase() || "pending";
}

function resumirErroEmail(erro) {
  if (!erro) return null;
  return String(erro.message || erro).trim().slice(0, 500) || "Falha ao enviar o e-mail.";
}

async function enviarEmailBoasVindas(pendencia) {
  if (!mailerConfigurado()) {
    const diagnostico = diagnosticarMailer();
    throw new Error("Brevo API nao configurada no backend. Campos ausentes: " + diagnostico.faltando.join(", "));
  }

  const info = await enviarEmail(
    pendencia.email_admin,
    "AutoAcerto | Assinatura confirmada",
    montarEmailBoasVindasAssinatura({
      nomeAdmin: pendencia.nome_admin,
      nomeTransportadora: pendencia.nome_transportadora,
      emailAdmin: pendencia.email_admin,
      linkLogin: URL_FRONTEND + "/login.html",
      planoNome: pendencia.plano_nome
    })
  );

  if (info && Array.isArray(info.rejected) && info.rejected.length > 0) {
    throw new Error("O provedor de e-mail rejeitou o destinatario do e-mail de boas-vindas.");
  }

  return info;
}

async function registrarResultadoEmailBoasVindas({ pendenciaId, erro }) {
  if (!pendenciaId) return;

  if (erro) {
    await banco.query(
      `UPDATE assinaturas_pendentes
       SET boas_vindas_email_erro = $1,
           data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [resumirErroEmail(erro), pendenciaId]
    );
    return;
  }

  await banco.query(
    `UPDATE assinaturas_pendentes
     SET boas_vindas_email_enviado_em = CURRENT_TIMESTAMP,
         boas_vindas_email_erro = NULL,
         data_atualizacao = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [pendenciaId]
  );
}

async function tentarEnviarEmailBoasVindasSePendente(pendencia, opcoes = {}) {
  if (!pendencia || !pendencia.id || !pendencia.provisionado_em) return false;
  if (pendencia.boas_vindas_email_enviado_em) return false;
  if (pendencia.boas_vindas_email_erro && !opcoes.forcar) return false;

  try {
    await enviarEmailBoasVindas(pendencia);
    await registrarResultadoEmailBoasVindas({ pendenciaId: pendencia.id });
  } catch (erroEmail) {
    console.error("Erro ao reenviar e-mail de boas-vindas:", erroEmail.message);
    await registrarResultadoEmailBoasVindas({ pendenciaId: pendencia.id, erro: erroEmail });
  }

  return true;
}

async function registrarAssinaturaAtiva({ cliente, pendencia, assinaturaStripe, transportadoraId }) {
  const itemPrincipal = assinaturaStripe.items && assinaturaStripe.items.data && assinaturaStripe.items.data[0]
    ? assinaturaStripe.items.data[0]
    : null;
  const priceIdAtual = itemPrincipal && itemPrincipal.price ? itemPrincipal.price.id : null;
  const planoAtual = obterPlanoPorStripePriceId(priceIdAtual) || obterPlano(pendencia.plano_codigo) || {
    codigo: pendencia.plano_codigo,
    nome: pendencia.plano_nome,
    valor: pendencia.valor
  };
  const statusAtual = normalizarStatusStripe(assinaturaStripe.status);

  await cliente.query(
    `INSERT INTO assinaturas
      (transportadora_id, plano_codigo, plano_nome, gateway, gateway_assinatura_id, referencia_externa, status, valor,
       stripe_customer_id, stripe_price_id, proxima_cobranca_em, cancel_at_period_end, email_pagador,
       pagamento_pendente_em, bloqueada_em, cancelada_em, ultimo_payload, data_atualizacao)
     VALUES ($1, $2, $3, 'stripe', $4, $5, $6, $7, $8, $9, to_timestamp($10), $11, $12,
       CASE WHEN $6 IN ('past_due', 'unpaid', 'incomplete') THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN $6 IN ('unpaid', 'incomplete_expired', 'paused') THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN $6 = 'canceled' THEN CURRENT_TIMESTAMP ELSE NULL END,
       $13::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (gateway_assinatura_id)
     DO UPDATE SET
      plano_codigo = EXCLUDED.plano_codigo,
      plano_nome = EXCLUDED.plano_nome,
      status = EXCLUDED.status,
      valor = EXCLUDED.valor,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_price_id = EXCLUDED.stripe_price_id,
      proxima_cobranca_em = EXCLUDED.proxima_cobranca_em,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      email_pagador = EXCLUDED.email_pagador,
      pagamento_pendente_em = CASE
        WHEN EXCLUDED.status IN ('past_due', 'unpaid', 'incomplete') THEN COALESCE(assinaturas.pagamento_pendente_em, CURRENT_TIMESTAMP)
        ELSE NULL
      END,
      bloqueada_em = CASE
        WHEN EXCLUDED.status IN ('unpaid', 'incomplete_expired', 'paused') THEN COALESCE(assinaturas.bloqueada_em, CURRENT_TIMESTAMP)
        ELSE NULL
      END,
      cancelada_em = CASE
        WHEN EXCLUDED.status = 'canceled' THEN COALESCE(assinaturas.cancelada_em, CURRENT_TIMESTAMP)
        ELSE NULL
      END,
      ultimo_payload = EXCLUDED.ultimo_payload,
      data_atualizacao = CURRENT_TIMESTAMP`,
    [
      transportadoraId,
      planoAtual.codigo,
      planoAtual.nome,
      assinaturaStripe.id,
      pendencia.referencia_externa,
      statusAtual,
      planoAtual.valor,
      String(assinaturaStripe.customer || pendencia.stripe_customer_id || ""),
      priceIdAtual,
      assinaturaStripe.current_period_end || null,
      Boolean(assinaturaStripe.cancel_at_period_end),
      pendencia.email_admin,
      JSON.stringify(assinaturaStripe)
    ]
  );
}

async function provisionarPendenciaPorReferencia(referenciaExterna, assinaturaStripe) {
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");

    const resultadoPendente = await cliente.query(
      `SELECT *
       FROM assinaturas_pendentes
       WHERE referencia_externa = $1
       FOR UPDATE`,
      [referenciaExterna]
    );

    if (resultadoPendente.rows.length === 0) {
      await cliente.query("ROLLBACK");
      return { ok: false, motivo: "pendencia_nao_encontrada" };
    }

    const pendencia = resultadoPendente.rows[0];
    const statusStripe = normalizarStatusStripe(assinaturaStripe.status);

    if (pendencia.transportadora_id && pendencia.usuario_admin_id) {
      await registrarAssinaturaAtiva({
        cliente,
        pendencia,
        assinaturaStripe,
        transportadoraId: pendencia.transportadora_id
      });

      await cliente.query(
        `UPDATE assinaturas_pendentes
         SET status = $1,
             stripe_customer_id = COALESCE($2, stripe_customer_id),
             stripe_subscription_id = COALESCE($3, stripe_subscription_id),
             ultimo_payload = $4::jsonb,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          statusStripe,
          assinaturaStripe.customer ? String(assinaturaStripe.customer) : null,
          assinaturaStripe.id,
          JSON.stringify(assinaturaStripe),
          pendencia.id
        ]
      );

      await cliente.query("COMMIT");
      return { ok: true, provisionado: false, status: statusStripe };
    }

    if (!statusAssinaturaAtiva(statusStripe)) {
      await cliente.query(
        `UPDATE assinaturas_pendentes
         SET status = $1,
             stripe_customer_id = COALESCE($2, stripe_customer_id),
             stripe_subscription_id = COALESCE($3, stripe_subscription_id),
             ultimo_payload = $4::jsonb,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          statusStripe,
          assinaturaStripe.customer ? String(assinaturaStripe.customer) : null,
          assinaturaStripe.id,
          JSON.stringify(assinaturaStripe),
          pendencia.id
        ]
      );
      await cliente.query("COMMIT");
      return { ok: true, provisionado: false, status: statusStripe };
    }

    const existenteEmail = await cliente.query("SELECT id FROM usuarios WHERE email = $1", [pendencia.email_admin]);
    if (existenteEmail.rows.length > 0) {
      throw new Error("Ja existe um usuario cadastrado com o e-mail da assinatura.");
    }

    const resultadoTransportadora = await cliente.query(
      `INSERT INTO transportadoras (nome, cnpj, ativo)
       VALUES ($1, $2, TRUE)
       RETURNING id`,
      [pendencia.nome_transportadora, pendencia.cnpj]
    );

    const transportadoraId = resultadoTransportadora.rows[0].id;

    const resultadoUsuario = await cliente.query(
      `INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
       VALUES ($1, $2, $3, $4, 'admin', NULL, TRUE)
       RETURNING id`,
      [transportadoraId, pendencia.nome_admin, pendencia.email_admin, pendencia.senha_hash_admin]
    );

    const usuarioAdminId = resultadoUsuario.rows[0].id;

    await registrarAssinaturaAtiva({
      cliente,
      pendencia,
      assinaturaStripe,
      transportadoraId
    });

    await cliente.query(
      `UPDATE assinaturas_pendentes
       SET status = $1,
           stripe_customer_id = COALESCE($2, stripe_customer_id),
           stripe_subscription_id = COALESCE($3, stripe_subscription_id),
           transportadora_id = $4,
           usuario_admin_id = $5,
           provisionado_em = CURRENT_TIMESTAMP,
           ultimo_payload = $6::jsonb,
           data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        statusStripe,
        assinaturaStripe.customer ? String(assinaturaStripe.customer) : null,
        assinaturaStripe.id,
        transportadoraId,
        usuarioAdminId,
        JSON.stringify(assinaturaStripe),
        pendencia.id
      ]
    );

    await cliente.query("COMMIT");

    try {
      await enviarEmailBoasVindas({
        ...pendencia,
        transportadora_id: transportadoraId,
        usuario_admin_id: usuarioAdminId
      });
      await registrarResultadoEmailBoasVindas({ pendenciaId: pendencia.id });
    } catch (erroEmail) {
      console.error("Erro ao enviar e-mail de boas-vindas:", erroEmail.message);
      await registrarResultadoEmailBoasVindas({ pendenciaId: pendencia.id, erro: erroEmail });
    }

    return { ok: true, provisionado: true, status: statusStripe };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

async function sincronizarAssinaturaStripePorId(subscriptionId) {
  const assinaturaStripe = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"]
  });

  const referenciaExterna = String((assinaturaStripe.metadata && assinaturaStripe.metadata.referencia_externa) || "").trim();
  if (!referenciaExterna) {
    return { ok: false, motivo: "sem_referencia_externa", assinaturaStripe };
  }

  const resultado = await provisionarPendenciaPorReferencia(referenciaExterna, assinaturaStripe);
  return { ...resultado, assinaturaStripe, referenciaExterna };
}

async function sincronizarCheckoutStripePorSessionId(sessionId) {
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"]
  });

  const referenciaExterna = String((checkoutSession.metadata && checkoutSession.metadata.referencia_externa) || "").trim();
  if (!referenciaExterna) {
    return { ok: false, motivo: "sem_referencia_externa", checkoutSession };
  }

  await banco.query(
    `UPDATE assinaturas_pendentes
     SET stripe_customer_id = COALESCE($1, stripe_customer_id),
         stripe_subscription_id = COALESCE($2, stripe_subscription_id),
         status = $3,
         ultimo_payload = $4::jsonb,
         data_atualizacao = CURRENT_TIMESTAMP
     WHERE referencia_externa = $5`,
    [
      checkoutSession.customer ? String(checkoutSession.customer) : null,
      checkoutSession.subscription
        ? String(typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : checkoutSession.subscription.id)
        : null,
      checkoutSession.status === "complete" ? "checkout_concluido" : "checkout_criado",
      JSON.stringify(checkoutSession),
      referenciaExterna
    ]
  );

  const subscriptionId = checkoutSession.subscription
    ? String(typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : checkoutSession.subscription.id)
    : "";

  if (subscriptionId) {
    return sincronizarAssinaturaStripePorId(subscriptionId);
  }

  return {
    ok: true,
    provisionado: false,
    status: checkoutSession.status === "complete" ? "checkout_concluido" : "checkout_criado",
    referenciaExterna,
    checkoutSession
  };
}

async function atualizarAssinaturaExistentePorStripe(assinaturaStripe) {
  const itemPrincipal = assinaturaStripe.items && assinaturaStripe.items.data && assinaturaStripe.items.data[0]
    ? assinaturaStripe.items.data[0]
    : null;
  const priceIdAtual = itemPrincipal && itemPrincipal.price ? itemPrincipal.price.id : null;
  const planoAtual = obterPlanoPorStripePriceId(priceIdAtual);
  const statusAtual = normalizarStatusStripe(assinaturaStripe.status);

  if (!planoAtual) {
    await banco.query(
      `UPDATE assinaturas
       SET status = $1,
           stripe_price_id = COALESCE($2, stripe_price_id),
           proxima_cobranca_em = to_timestamp($3),
           cancel_at_period_end = $4,
           pagamento_pendente_em = CASE
             WHEN $1 IN ('past_due', 'unpaid', 'incomplete') THEN COALESCE(pagamento_pendente_em, CURRENT_TIMESTAMP)
             ELSE NULL
           END,
           bloqueada_em = CASE
             WHEN $1 IN ('unpaid', 'incomplete_expired', 'paused') THEN COALESCE(bloqueada_em, CURRENT_TIMESTAMP)
             ELSE NULL
           END,
           cancelada_em = CASE
             WHEN $1 = 'canceled' THEN COALESCE(cancelada_em, CURRENT_TIMESTAMP)
             ELSE NULL
           END,
           ultimo_payload = $5::jsonb,
           data_atualizacao = CURRENT_TIMESTAMP
       WHERE gateway = 'stripe' AND gateway_assinatura_id = $6`,
      [
        statusAtual,
        priceIdAtual,
        assinaturaStripe.current_period_end || null,
        Boolean(assinaturaStripe.cancel_at_period_end),
        JSON.stringify(assinaturaStripe),
        assinaturaStripe.id
      ]
    );
    return;
  }

  await banco.query(
    `UPDATE assinaturas
     SET plano_codigo = $1,
         plano_nome = $2,
         status = $3,
         valor = $4,
         stripe_price_id = $5,
         proxima_cobranca_em = to_timestamp($6),
         cancel_at_period_end = $7,
         pagamento_pendente_em = CASE
           WHEN $3 IN ('past_due', 'unpaid', 'incomplete') THEN COALESCE(pagamento_pendente_em, CURRENT_TIMESTAMP)
           ELSE NULL
         END,
         bloqueada_em = CASE
           WHEN $3 IN ('unpaid', 'incomplete_expired', 'paused') THEN COALESCE(bloqueada_em, CURRENT_TIMESTAMP)
           ELSE NULL
         END,
         cancelada_em = CASE
           WHEN $3 = 'canceled' THEN COALESCE(cancelada_em, CURRENT_TIMESTAMP)
           ELSE NULL
         END,
         ultimo_payload = $8::jsonb,
         data_atualizacao = CURRENT_TIMESTAMP
     WHERE gateway = 'stripe' AND gateway_assinatura_id = $9`,
    [
      planoAtual.codigo,
      planoAtual.nome,
      statusAtual,
      planoAtual.valor,
      priceIdAtual,
      assinaturaStripe.current_period_end || null,
      Boolean(assinaturaStripe.cancel_at_period_end),
      JSON.stringify(assinaturaStripe),
      assinaturaStripe.id
    ]
  );
}

router.get("/public/planos", (requisicao, resposta) => {
  return resposta.json(Object.values(PLANOS_ASSINATURA).map(function (plano) {
    return {
      codigo: plano.codigo,
      nome: plano.nome,
      valor: plano.valor,
      descricao: plano.descricao,
      limiteVeiculos: plano.limiteVeiculos
    };
  }));
});

router.get("/minha", exigirAdmin, async (requisicao, resposta) => {
  try {
    const transportadoraId = obterIdTransportadora(requisicao);
    if (!transportadoraId) {
      return resposta.status(400).json({ mensagem: "Transportadora nao identificada para consultar a assinatura." });
    }

    const [assinaturaResultado, veiculosResultado] = await Promise.all([
      banco.query(
        `SELECT id, plano_codigo, plano_nome, status, valor, gateway, gateway_assinatura_id,
                stripe_customer_id, stripe_price_id, proxima_cobranca_em, cancel_at_period_end,
                pagamento_pendente_em, bloqueada_em, cancelada_em, data_cadastro, data_atualizacao
         FROM assinaturas
         WHERE transportadora_id = $1
         ORDER BY data_atualizacao DESC, id DESC
         LIMIT 1`,
        [transportadoraId]
      ),
      banco.query(
        "SELECT COUNT(*)::int AS total FROM veiculos WHERE transportadora_id = $1",
        [transportadoraId]
      )
    ]);

    const assinatura = assinaturaResultado.rows[0] || null;
    const plano = assinatura ? obterPlano(assinatura.plano_codigo) : null;

    return resposta.json({
      assinatura,
      operacional: montarResumoAssinatura(assinatura),
      plano: plano ? {
        codigo: plano.codigo,
        nome: plano.nome,
        valor: plano.valor,
        descricao: plano.descricao,
        limiteVeiculos: plano.limiteVeiculos
      } : null,
      uso: {
        veiculos: veiculosResultado.rows[0] ? veiculosResultado.rows[0].total : 0
      },
      planos: Object.values(PLANOS_ASSINATURA).map(function (item) {
        return {
          codigo: item.codigo,
          nome: item.nome,
          valor: item.valor,
          descricao: item.descricao,
          limiteVeiculos: item.limiteVeiculos
        };
      })
    });
  } catch (erro) {
    console.error("Erro ao consultar assinatura atual:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel carregar a assinatura." });
  }
});

router.post("/portal", exigirAdmin, async (requisicao, resposta) => {
  if (!stripe) {
    return resposta.status(500).json({ mensagem: "Stripe ainda nao configurado no backend." });
  }

  try {
    const transportadoraId = obterIdTransportadora(requisicao);
    if (!transportadoraId) {
      return resposta.status(400).json({ mensagem: "Transportadora nao identificada para gerenciar a assinatura." });
    }

    const resultado = await banco.query(
      `SELECT stripe_customer_id
       FROM assinaturas
       WHERE transportadora_id = $1
         AND gateway = 'stripe'
       ORDER BY data_atualizacao DESC, id DESC
       LIMIT 1`,
      [transportadoraId]
    );

    if (resultado.rows.length === 0 || !resultado.rows[0].stripe_customer_id) {
      return resposta.status(404).json({ mensagem: "Nao encontramos uma assinatura Stripe ativa para esta transportadora." });
    }

    const sessao = await stripe.billingPortal.sessions.create({
      customer: resultado.rows[0].stripe_customer_id,
      return_url: URL_FRONTEND + "/configuracoes.html"
    });

    return resposta.json({ url: sessao.url });
  } catch (erro) {
    console.error("Erro ao criar portal Stripe:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel abrir o gerenciamento da assinatura." });
  }
});

router.post("/public/contratar", async (requisicao, resposta) => {
  if (!stripeConfigurado()) {
    return resposta.status(500).json({ mensagem: "Stripe ainda nao configurado no backend." });
  }

  const plano = obterPlano(requisicao.body.plano);
  const nomeTransportadora = String(requisicao.body.nomeTransportadora || "").trim();
  const cnpj = String(requisicao.body.cnpj || "").trim() || null;
  const nomeAdmin = String(requisicao.body.nomeAdmin || "").trim();
  const emailAdmin = normalizarEmail(requisicao.body.emailAdmin);
  const senhaAdmin = String(requisicao.body.senhaAdmin || "");

  if (!plano || !nomeTransportadora || !nomeAdmin || !emailAdmin || !senhaAdmin) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios para iniciar a assinatura." });
  }

  if (!plano.stripePriceId) {
    return resposta.status(500).json({ mensagem: "O plano selecionado nao esta vinculado a um price do Stripe." });
  }

  if (!emailValido(emailAdmin)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido para o administrador inicial." });
  }

  if (cnpj && !cnpjValido(cnpj)) {
    return resposta.status(400).json({ mensagem: "CNPJ informado e invalido." });
  }

  if (senhaAdmin.length < 8) {
    return resposta.status(400).json({ mensagem: "A senha inicial deve ter pelo menos 8 caracteres." });
  }

  try {
    const emailExistente = await banco.query("SELECT id FROM usuarios WHERE email = $1", [emailAdmin]);
    if (emailExistente.rows.length > 0) {
      return resposta.status(400).json({ mensagem: "Ja existe uma conta cadastrada com esse e-mail." });
    }

    const referenciaExterna = gerarReferenciaExterna();
    const senhaHashAdmin = await bcrypt.hash(senhaAdmin, 10);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: URL_FRONTEND + "/assinatura-status.html?referencia=" + encodeURIComponent(referenciaExterna),
      cancel_url: URL_FRONTEND + "/assinar.html?cancelado=1",
      customer_email: emailAdmin,
      line_items: [
        {
          price: plano.stripePriceId,
          quantity: 1
        }
      ],
      metadata: {
        referencia_externa: referenciaExterna,
        plano_codigo: plano.codigo,
        nome_transportadora: nomeTransportadora,
        email_admin: emailAdmin
      },
      subscription_data: {
        metadata: {
          referencia_externa: referenciaExterna,
          plano_codigo: plano.codigo
        }
      }
    });

    await banco.query(
      `INSERT INTO assinaturas_pendentes
        (referencia_externa, gateway, plano_codigo, plano_nome, valor, nome_transportadora, cnpj, nome_admin, email_admin, senha_hash_admin, stripe_checkout_session_id, status, ultimo_payload, data_atualizacao)
       VALUES ($1, 'stripe', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'checkout_criado', $11::jsonb, CURRENT_TIMESTAMP)`,
      [
        referenciaExterna,
        plano.codigo,
        plano.nome,
        plano.valor,
        nomeTransportadora,
        cnpj,
        nomeAdmin,
        emailAdmin,
        senhaHashAdmin,
        session.id,
        JSON.stringify(session)
      ]
    );

    return resposta.status(201).json({
      mensagem: "Checkout criado com sucesso.",
      referencia_externa: referenciaExterna,
      checkout_url: session.url,
      session_id: session.id
    });
  } catch (erro) {
    console.error("Erro ao iniciar checkout Stripe:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel iniciar o checkout agora." });
  }
});

router.get("/public/status/:referencia", async (requisicao, resposta) => {
  try {
    const referencia = String(requisicao.params.referencia || "").trim();
    const forcarReenvioEmail = String(requisicao.query.reenviar_email || "") === "1";
    const resultado = await banco.query(
      `SELECT id, referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
              stripe_checkout_session_id, stripe_subscription_id, status, provisionado_em, boas_vindas_email_enviado_em,
              boas_vindas_email_erro, transportadora_id, usuario_admin_id, data_cadastro
       FROM assinaturas_pendentes
       WHERE referencia_externa = $1`,
      [referencia]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Assinatura nao encontrada." });
    }

    const pendencia = resultado.rows[0];

    if (pendencia.stripe_subscription_id && !pendencia.provisionado_em && stripe) {
      try {
        await sincronizarAssinaturaStripePorId(pendencia.stripe_subscription_id);
      } catch (erro) {
        console.error("Erro ao sincronizar assinatura Stripe:", erro.message);
      }
    } else if (pendencia.stripe_checkout_session_id && !pendencia.provisionado_em && stripe) {
      try {
        await sincronizarCheckoutStripePorSessionId(pendencia.stripe_checkout_session_id);
      } catch (erro) {
        console.error("Erro ao sincronizar checkout Stripe:", erro.message);
      }
    }

    const atualizado = await banco.query(
      `SELECT id, referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
              stripe_checkout_session_id, stripe_subscription_id, status, provisionado_em, boas_vindas_email_enviado_em,
              boas_vindas_email_erro, transportadora_id, usuario_admin_id, data_cadastro
       FROM assinaturas_pendentes
       WHERE referencia_externa = $1`,
      [referencia]
    );

    const pendenciaAtualizada = atualizado.rows[0];
    const reenviado = await tentarEnviarEmailBoasVindasSePendente(pendenciaAtualizada, { forcar: forcarReenvioEmail });

    if (reenviado) {
      const resultadoFinal = await banco.query(
        `SELECT id, referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
                stripe_checkout_session_id, stripe_subscription_id, status, provisionado_em, boas_vindas_email_enviado_em,
                boas_vindas_email_erro, transportadora_id, usuario_admin_id, data_cadastro
         FROM assinaturas_pendentes
         WHERE referencia_externa = $1`,
        [referencia]
      );

      return resposta.json(resultadoFinal.rows[0]);
    }

    return resposta.json(pendenciaAtualizada);
  } catch (erro) {
    console.error("Erro ao consultar status da assinatura:", erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel consultar o status da assinatura." });
  }
});

router.post("/stripe/webhook", async (requisicao, resposta) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return resposta.status(500).json({ mensagem: "Webhook Stripe nao configurado." });
  }

  let evento;

  try {
    evento = stripe.webhooks.constructEvent(
      requisicao.rawBody || "",
      requisicao.headers["stripe-signature"],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (erro) {
    console.error("Assinatura do webhook Stripe invalida:", erro.message);
    return resposta.status(400).json({ mensagem: "Webhook invalido." });
  }

  try {
    if (evento.type === "checkout.session.completed") {
      const session = evento.data.object;

      if (session.mode === "subscription" && session.subscription) {
        const referenciaExterna = String((session.metadata && session.metadata.referencia_externa) || "").trim();

        await banco.query(
          `UPDATE assinaturas_pendentes
           SET stripe_customer_id = COALESCE($1, stripe_customer_id),
               stripe_subscription_id = COALESCE($2, stripe_subscription_id),
               status = 'checkout_concluido',
               ultimo_payload = $3::jsonb,
               data_atualizacao = CURRENT_TIMESTAMP
           WHERE referencia_externa = $4`,
          [
            session.customer ? String(session.customer) : null,
            session.subscription ? String(session.subscription) : null,
            JSON.stringify(session),
            referenciaExterna
          ]
        );

        await sincronizarAssinaturaStripePorId(String(session.subscription));
      }
    }

    if (evento.type === "customer.subscription.updated" || evento.type === "customer.subscription.created") {
      const subscription = evento.data.object;
      const resultado = await sincronizarAssinaturaStripePorId(subscription.id);
      if (!resultado.ok) {
        await atualizarAssinaturaExistentePorStripe(subscription);
      }
    }

    if (evento.type === "customer.subscription.deleted") {
      const subscription = evento.data.object;
      await banco.query(
        `UPDATE assinaturas
         SET status = $1,
             cancel_at_period_end = FALSE,
             cancelada_em = COALESCE(cancelada_em, CURRENT_TIMESTAMP),
             bloqueada_em = COALESCE(bloqueada_em, CURRENT_TIMESTAMP),
             ultimo_payload = $2::jsonb,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE gateway = 'stripe' AND gateway_assinatura_id = $3`,
        ["canceled", JSON.stringify(subscription), subscription.id]
      );

      await banco.query(
        `UPDATE assinaturas_pendentes
         SET status = $1,
             ultimo_payload = $2::jsonb,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $3`,
        ["canceled", JSON.stringify(subscription), subscription.id]
      );
    }

    if (evento.type === "invoice.payment_failed") {
      const invoice = evento.data.object;
      const subscriptionId = invoice.subscription ? String(invoice.subscription) : "";

      if (subscriptionId) {
        await banco.query(
          `UPDATE assinaturas
           SET status = 'past_due',
               pagamento_pendente_em = COALESCE(pagamento_pendente_em, CURRENT_TIMESTAMP),
               ultimo_payload = $1::jsonb,
               data_atualizacao = CURRENT_TIMESTAMP
           WHERE gateway = 'stripe' AND gateway_assinatura_id = $2`,
          [JSON.stringify(invoice), subscriptionId]
        );
      }
    }

    if (evento.type === "invoice.payment_succeeded" || evento.type === "invoice.paid") {
      const invoice = evento.data.object;
      const subscriptionId = invoice.subscription ? String(invoice.subscription) : "";

      if (subscriptionId) {
        try {
          const resultado = await sincronizarAssinaturaStripePorId(subscriptionId);
          if (!resultado.ok && resultado.assinaturaStripe) {
            await atualizarAssinaturaExistentePorStripe(resultado.assinaturaStripe);
          }
        } catch {
          await banco.query(
            `UPDATE assinaturas
             SET status = 'active',
                 pagamento_pendente_em = NULL,
                 bloqueada_em = NULL,
                 ultimo_payload = $1::jsonb,
                 data_atualizacao = CURRENT_TIMESTAMP
             WHERE gateway = 'stripe' AND gateway_assinatura_id = $2`,
            [JSON.stringify(invoice), subscriptionId]
          );
        }
      }
    }
    return resposta.status(200).json({ recebido: true });
  } catch (erro) {
    console.error("Erro ao processar evento Stripe:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao processar webhook Stripe." });
  }
});

module.exports = router;
