const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Stripe = require("stripe");
const banco = require("../banco");
const { normalizarEmail, emailValido, cnpjValido } = require("../validacoes");
const { FRONTEND_URL, mailerConfigurado, enviarEmail, montarEmailBoasVindasAssinatura } = require("../helpers/mailer");

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
    throw new Error("SMTP nao configurado no backend.");
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
    throw new Error("O servidor SMTP rejeitou o destinatario do e-mail de boas-vindas.");
  }

  return info;
}

async function registrarAssinaturaAtiva({ cliente, pendencia, assinaturaStripe, transportadoraId }) {
  const itemPrincipal = assinaturaStripe.items && assinaturaStripe.items.data && assinaturaStripe.items.data[0]
    ? assinaturaStripe.items.data[0]
    : null;

  await cliente.query(
    `INSERT INTO assinaturas
      (transportadora_id, plano_codigo, plano_nome, gateway, gateway_assinatura_id, referencia_externa, status, valor, stripe_customer_id, stripe_price_id, proxima_cobranca_em, cancel_at_period_end, email_pagador, ultimo_payload, data_atualizacao)
     VALUES ($1, $2, $3, 'stripe', $4, $5, $6, $7, $8, $9, to_timestamp($10), $11, $12, $13::jsonb, CURRENT_TIMESTAMP)
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
      ultimo_payload = EXCLUDED.ultimo_payload,
      data_atualizacao = CURRENT_TIMESTAMP`,
    [
      transportadoraId,
      pendencia.plano_codigo,
      pendencia.plano_nome,
      assinaturaStripe.id,
      pendencia.referencia_externa,
      normalizarStatusStripe(assinaturaStripe.status),
      pendencia.valor,
      String(assinaturaStripe.customer || pendencia.stripe_customer_id || ""),
      itemPrincipal && itemPrincipal.price ? itemPrincipal.price.id : null,
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

      await banco.query(
        `UPDATE assinaturas_pendentes
         SET boas_vindas_email_enviado_em = CURRENT_TIMESTAMP,
             boas_vindas_email_erro = NULL,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [pendencia.id]
      );
    } catch (erroEmail) {
      console.error("Erro ao enviar e-mail de boas-vindas:", erroEmail.message);

      await banco.query(
        `UPDATE assinaturas_pendentes
         SET boas_vindas_email_erro = $1,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [resumirErroEmail(erroEmail), pendencia.id]
      );
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
    const resultado = await banco.query(
      `SELECT referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
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
    }

    const atualizado = await banco.query(
      `SELECT referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
              stripe_checkout_session_id, stripe_subscription_id, status, provisionado_em, boas_vindas_email_enviado_em,
              boas_vindas_email_erro, transportadora_id, usuario_admin_id, data_cadastro
       FROM assinaturas_pendentes
       WHERE referencia_externa = $1`,
      [referencia]
    );

    return resposta.json(atualizado.rows[0]);
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

  resposta.status(200).json({ recebido: true });

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
      await sincronizarAssinaturaStripePorId(subscription.id);
    }

    if (evento.type === "customer.subscription.deleted") {
      const subscription = evento.data.object;
      await banco.query(
        `UPDATE assinaturas
         SET status = $1,
             cancel_at_period_end = FALSE,
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
               ultimo_payload = $1::jsonb,
               data_atualizacao = CURRENT_TIMESTAMP
           WHERE gateway = 'stripe' AND gateway_assinatura_id = $2`,
          [JSON.stringify(invoice), subscriptionId]
        );
      }
    }
  } catch (erro) {
    console.error("Erro ao processar evento Stripe:", erro.message);
  }
});

module.exports = router;
