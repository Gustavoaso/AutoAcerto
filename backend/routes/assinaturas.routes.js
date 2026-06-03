const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const banco = require("../banco");
const { normalizarEmail, emailValido, cnpjValido } = require("../validacoes");
const { FRONTEND_URL, mailerConfigurado, enviarEmail, montarEmailBoasVindasAssinatura } = require("../helpers/mailer");

const router = express.Router();

const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
const API_MERCADO_PAGO = "https://api.mercadopago.com";
const URL_RETORNO_ASSINATURA = (process.env.FRONTEND_URL || FRONTEND_URL).replace(/\/+$/, "") + "/assinatura-status.html";

const PLANOS_ASSINATURA = {
  essencial: {
    codigo: "essencial",
    nome: "Plano Essencial",
    valor: 129.9,
    descricao: "Ideal para operacoes menores e em fase de organizacao."
  },
  profissional: {
    codigo: "profissional",
    nome: "Plano Profissional",
    valor: 249.9,
    descricao: "Estrutura principal para a maioria das transportadoras."
  },
  escala: {
    codigo: "escala",
    nome: "Plano Escala",
    valor: 499.9,
    descricao: "Mais capacidade operacional para estruturas maiores."
  }
};

function obterPlano(codigo) {
  return PLANOS_ASSINATURA[String(codigo || "").trim().toLowerCase()] || null;
}

function referenciaExternaAssinatura() {
  return "aa_" + crypto.randomBytes(12).toString("hex");
}

function dataIsoFutura(dias) {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString();
}

function normalizarStatusAssinatura(status) {
  return String(status || "").trim().toLowerCase() || "aguardando_pagamento";
}

function credenciaisMercadoPagoConfiguradas() {
  return Boolean(MERCADO_PAGO_ACCESS_TOKEN);
}

async function requisicaoMercadoPago(caminho, opcoes) {
  const resposta = await fetch(API_MERCADO_PAGO + caminho, {
    ...opcoes,
    headers: {
      Authorization: "Bearer " + MERCADO_PAGO_ACCESS_TOKEN,
      "Content-Type": "application/json",
      ...(opcoes && opcoes.headers ? opcoes.headers : {})
    }
  });

  const texto = await resposta.text();
  let dados = null;

  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = { bruto: texto };
  }

  if (!resposta.ok) {
    const erro = new Error("Falha na comunicacao com o Mercado Pago.");
    erro.status = resposta.status;
    erro.payload = dados;
    throw erro;
  }

  return dados;
}

async function consultarAssinaturaMercadoPago(preapprovalId) {
  return requisicaoMercadoPago("/preapproval/" + encodeURIComponent(preapprovalId), {
    method: "GET"
  });
}

async function registrarAssinaturaAtiva({ cliente, pendencia, assinaturaMercadoPago, transportadoraId }) {
  await cliente.query(
    `INSERT INTO assinaturas
      (transportadora_id, plano_codigo, plano_nome, gateway, gateway_assinatura_id, referencia_externa, status, valor, proxima_cobranca_em, email_pagador, ultimo_payload, data_atualizacao)
     VALUES ($1, $2, $3, 'mercado_pago', $4, $5, $6, $7, $8, $9, $10::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (gateway_assinatura_id)
     DO UPDATE SET
      status = EXCLUDED.status,
      proxima_cobranca_em = EXCLUDED.proxima_cobranca_em,
      email_pagador = EXCLUDED.email_pagador,
      ultimo_payload = EXCLUDED.ultimo_payload,
      data_atualizacao = CURRENT_TIMESTAMP`,
    [
      transportadoraId,
      pendencia.plano_codigo,
      pendencia.plano_nome,
      assinaturaMercadoPago.id,
      pendencia.referencia_externa,
      normalizarStatusAssinatura(assinaturaMercadoPago.status),
      pendencia.valor,
      assinaturaMercadoPago.next_payment_date || null,
      assinaturaMercadoPago.payer_email || pendencia.email_admin,
      JSON.stringify(assinaturaMercadoPago)
    ]
  );
}

async function enviarEmailBoasVindas(pendencia) {
  if (!mailerConfigurado()) return;

  await enviarEmail(
    pendencia.email_admin,
    "AutoAcerto | Assinatura confirmada",
    montarEmailBoasVindasAssinatura({
      nomeAdmin: pendencia.nome_admin,
      nomeTransportadora: pendencia.nome_transportadora,
      emailAdmin: pendencia.email_admin,
      linkLogin: FRONTEND_URL + "/login.html",
      planoNome: pendencia.plano_nome
    })
  );
}

async function provisionarPendentePorReferencia(referenciaExterna, assinaturaMercadoPago) {
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
    const statusAssinatura = normalizarStatusAssinatura(assinaturaMercadoPago.status);

    if (pendencia.transportadora_id && pendencia.usuario_admin_id) {
      await registrarAssinaturaAtiva({
        cliente,
        pendencia,
        assinaturaMercadoPago,
        transportadoraId: pendencia.transportadora_id
      });

      await cliente.query(
        `UPDATE assinaturas_pendentes
         SET status = $1,
             mercado_pago_preapproval_id = COALESCE($2, mercado_pago_preapproval_id),
             ultimo_payload = $3::jsonb,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [statusAssinatura, assinaturaMercadoPago.id || null, JSON.stringify(assinaturaMercadoPago), pendencia.id]
      );

      await cliente.query("COMMIT");
      return { ok: true, provisionado: false, status: statusAssinatura };
    }

    if (statusAssinatura !== "authorized") {
      await cliente.query(
        `UPDATE assinaturas_pendentes
         SET status = $1,
             mercado_pago_preapproval_id = COALESCE($2, mercado_pago_preapproval_id),
             ultimo_payload = $3::jsonb,
             data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [statusAssinatura, assinaturaMercadoPago.id || null, JSON.stringify(assinaturaMercadoPago), pendencia.id]
      );
      await cliente.query("COMMIT");
      return { ok: true, provisionado: false, status: statusAssinatura };
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
      assinaturaMercadoPago,
      transportadoraId
    });

    await cliente.query(
      `UPDATE assinaturas_pendentes
       SET status = $1,
           mercado_pago_preapproval_id = COALESCE($2, mercado_pago_preapproval_id),
           transportadora_id = $3,
           usuario_admin_id = $4,
           provisionado_em = CURRENT_TIMESTAMP,
           ultimo_payload = $5::jsonb,
           data_atualizacao = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [statusAssinatura, assinaturaMercadoPago.id || null, transportadoraId, usuarioAdminId, JSON.stringify(assinaturaMercadoPago), pendencia.id]
    );

    await cliente.query("COMMIT");

    try {
      await enviarEmailBoasVindas({
        ...pendencia,
        transportadora_id: transportadoraId,
        usuario_admin_id: usuarioAdminId
      });
    } catch (erroEmail) {
      console.error("Erro ao enviar e-mail de boas-vindas:", erroEmail.message);
    }

    return { ok: true, provisionado: true, status: statusAssinatura };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

async function sincronizarAssinaturaPorPreapprovalId(preapprovalId) {
  const assinaturaMercadoPago = await consultarAssinaturaMercadoPago(preapprovalId);
  const referenciaExterna = String(assinaturaMercadoPago.external_reference || "").trim();

  if (!referenciaExterna) {
    return { ok: false, motivo: "sem_referencia_externa", assinaturaMercadoPago };
  }

  const resultado = await provisionarPendentePorReferencia(referenciaExterna, assinaturaMercadoPago);
  return { ...resultado, assinaturaMercadoPago, referenciaExterna };
}

router.get("/public/planos", (requisicao, resposta) => {
  return resposta.json(Object.values(PLANOS_ASSINATURA));
});

router.post("/public/contratar", async (requisicao, resposta) => {
  if (!credenciaisMercadoPagoConfiguradas()) {
    return resposta.status(500).json({ mensagem: "Gateway de pagamento ainda nao configurado." });
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

    const referenciaExterna = referenciaExternaAssinatura();
    const senhaHashAdmin = await bcrypt.hash(senhaAdmin, 10);

    const payloadMercadoPago = {
      reason: plano.nome + " - AutoAcerto",
      external_reference: referenciaExterna,
      payer_email: emailAdmin,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        start_date: new Date().toISOString(),
        end_date: dataIsoFutura(3650),
        transaction_amount: plano.valor,
        currency_id: "BRL"
      },
      back_url: URL_RETORNO_ASSINATURA + "?referencia=" + encodeURIComponent(referenciaExterna),
      status: "pending"
    };

    const assinaturaMercadoPago = await requisicaoMercadoPago("/preapproval", {
      method: "POST",
      body: JSON.stringify(payloadMercadoPago)
    });

    await banco.query(
      `INSERT INTO assinaturas_pendentes
        (referencia_externa, gateway, plano_codigo, plano_nome, valor, nome_transportadora, cnpj, nome_admin, email_admin, senha_hash_admin, mercado_pago_preapproval_id, status, ultimo_payload, data_atualizacao)
       VALUES ($1, 'mercado_pago', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, CURRENT_TIMESTAMP)`,
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
        assinaturaMercadoPago.id || null,
        normalizarStatusAssinatura(assinaturaMercadoPago.status),
        JSON.stringify(assinaturaMercadoPago)
      ]
    );

    return resposta.status(201).json({
      mensagem: "Assinatura iniciada com sucesso.",
      referencia_externa: referenciaExterna,
      checkout_url: assinaturaMercadoPago.init_point,
      preapproval_id: assinaturaMercadoPago.id
    });
  } catch (erro) {
    console.error("Erro ao iniciar assinatura:", erro.payload || erro.message);
    return resposta.status(500).json({ mensagem: "Nao foi possivel iniciar a assinatura agora." });
  }
});

router.get("/public/status/:referencia", async (requisicao, resposta) => {
  try {
    const referencia = String(requisicao.params.referencia || "").trim();
    const resultado = await banco.query(
      `SELECT referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
              mercado_pago_preapproval_id, status, provisionado_em, transportadora_id, usuario_admin_id, data_cadastro
       FROM assinaturas_pendentes
       WHERE referencia_externa = $1`,
      [referencia]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Assinatura nao encontrada." });
    }

    const pendencia = resultado.rows[0];

    if (pendencia.mercado_pago_preapproval_id && !pendencia.provisionado_em) {
      try {
        await sincronizarAssinaturaPorPreapprovalId(pendencia.mercado_pago_preapproval_id);
      } catch (erro) {
        console.error("Erro ao sincronizar assinatura pendente:", erro.message);
      }
    }

    const atualizado = await banco.query(
      `SELECT referencia_externa, plano_codigo, plano_nome, valor, nome_transportadora, nome_admin, email_admin,
              mercado_pago_preapproval_id, status, provisionado_em, transportadora_id, usuario_admin_id, data_cadastro
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

router.post("/mercado-pago/webhook", async (requisicao, resposta) => {
  resposta.status(200).json({ recebido: true });

  try {
    const tipo = String(requisicao.body.type || requisicao.body.topic || "").trim();
    const preapprovalId = String(
      (requisicao.body.data && requisicao.body.data.id) ||
      requisicao.body["data.id"] ||
      requisicao.query.id ||
      ""
    ).trim();

    if (tipo !== "subscription_preapproval" || !preapprovalId) {
      return;
    }

    await sincronizarAssinaturaPorPreapprovalId(preapprovalId);
  } catch (erro) {
    console.error("Erro ao processar webhook do Mercado Pago:", erro.payload || erro.message);
  }
});

module.exports = router;
