const STATUS_ATIVOS = new Set(["active", "trialing"]);
const STATUS_PENDENTES_PAGAMENTO = new Set(["past_due", "incomplete"]);
const STATUS_BLOQUEADOS = new Set(["canceled", "unpaid", "incomplete_expired", "paused"]);

const DIAS_TOLERANCIA_PAGAMENTO = Number(process.env.ASSINATURA_DIAS_TOLERANCIA_PAGAMENTO || 7);

function normalizarStatusAssinatura(status) {
  return String(status || "").trim().toLowerCase();
}

function somarDias(data, dias) {
  const base = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(base.getTime())) return null;

  const copia = new Date(base.getTime());
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function assinaturaEstaAtiva(assinatura) {
  if (!assinatura) return false;

  const status = normalizarStatusAssinatura(assinatura.status);
  if (!STATUS_ATIVOS.has(status)) return false;

  if (!assinatura.cancel_at_period_end) return true;
  if (!assinatura.proxima_cobranca_em) return true;

  return new Date(assinatura.proxima_cobranca_em).getTime() > Date.now();
}

function obterDataLimiteRegularizacao(assinatura) {
  if (!assinatura) return null;

  const status = normalizarStatusAssinatura(assinatura.status);
  if (!STATUS_PENDENTES_PAGAMENTO.has(status)) return null;

  return somarDias(
    assinatura.pagamento_pendente_em || assinatura.data_atualizacao || assinatura.data_cadastro || new Date(),
    DIAS_TOLERANCIA_PAGAMENTO
  );
}

function assinaturaEmToleranciaPagamento(assinatura) {
  const limite = obterDataLimiteRegularizacao(assinatura);
  return Boolean(limite && limite.getTime() > Date.now());
}

function assinaturaPermiteMutacao(assinatura) {
  if (!assinatura) {
    return {
      permitido: false,
      codigo: "assinatura_ausente",
      mensagem: "Assinatura nao encontrada. Regularize sua assinatura para criar ou alterar dados."
    };
  }

  const status = normalizarStatusAssinatura(assinatura.status);

  if (assinaturaEstaAtiva(assinatura)) {
    return { permitido: true };
  }

  if (STATUS_PENDENTES_PAGAMENTO.has(status) && assinaturaEmToleranciaPagamento(assinatura)) {
    return { permitido: true };
  }

  if (STATUS_PENDENTES_PAGAMENTO.has(status)) {
    return {
      permitido: false,
      codigo: "pagamento_pendente",
      mensagem: "Sua assinatura esta com pagamento pendente. Regularize a cobranca para criar ou alterar dados.",
      data_limite_regularizacao: obterDataLimiteRegularizacao(assinatura)
    };
  }

  if (STATUS_BLOQUEADOS.has(status)) {
    return {
      permitido: false,
      codigo: "assinatura_bloqueada",
      mensagem: "Sua assinatura nao esta ativa. Reative ou regularize a assinatura para criar ou alterar dados."
    };
  }

  return {
    permitido: false,
    codigo: "assinatura_inativa",
    mensagem: "Sua assinatura precisa estar ativa para criar ou alterar dados."
  };
}

function montarResumoAssinatura(assinatura) {
  if (!assinatura) {
    return {
      status_operacional: "sem_assinatura",
      pode_alterar_dados: false,
      data_limite_regularizacao: null
    };
  }

  const decisao = assinaturaPermiteMutacao(assinatura);
  const status = normalizarStatusAssinatura(assinatura.status);
  let statusOperacional = "bloqueada";

  if (assinaturaEstaAtiva(assinatura)) {
    statusOperacional = assinatura.cancel_at_period_end ? "ativa_cancelamento_agendado" : "ativa";
  } else if (STATUS_PENDENTES_PAGAMENTO.has(status) && assinaturaEmToleranciaPagamento(assinatura)) {
    statusOperacional = "pagamento_pendente_tolerancia";
  } else if (STATUS_PENDENTES_PAGAMENTO.has(status)) {
    statusOperacional = "pagamento_pendente_bloqueada";
  }

  return {
    status_operacional: statusOperacional,
    pode_alterar_dados: decisao.permitido,
    bloqueio_codigo: decisao.codigo || null,
    bloqueio_mensagem: decisao.mensagem || null,
    data_limite_regularizacao: obterDataLimiteRegularizacao(assinatura)
  };
}

module.exports = {
  DIAS_TOLERANCIA_PAGAMENTO,
  normalizarStatusAssinatura,
  assinaturaEstaAtiva,
  assinaturaPermiteMutacao,
  montarResumoAssinatura
};
