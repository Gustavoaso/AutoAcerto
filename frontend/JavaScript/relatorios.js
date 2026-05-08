const urlApiViagens = "http://localhost:3000/viagens";
const urlApiDespesas = "http://localhost:3000/despesas";

let viagens = [];
let despesas = [];
let periodoAtivo = 30;
let dataInicioFiltro = null;
let dataFimFiltro = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  inicializarFiltrosPeriodo();
  inicializarFiltroData();
  carregarDadosRelatorio();
});

function inicializarFiltrosPeriodo() {
  const botoesPeriodo = document.querySelectorAll(".botao-periodo");

  botoesPeriodo.forEach(function (botao) {
    botao.addEventListener("click", function () {
      botoesPeriodo.forEach(function (b) {
        b.classList.remove("ativo");
      });

      botao.classList.add("ativo");
      periodoAtivo = Number(botao.dataset.periodo);

      document.getElementById("filtroDataInicio").value = "";
      document.getElementById("filtroDataFim").value = "";
      dataInicioFiltro = null;
      dataFimFiltro = null;

      aplicarFiltrosEAtualizar();
    });
  });
}

function inicializarFiltroData() {
  document.getElementById("botaoAplicarFiltro").addEventListener("click", function () {
    const dataInicio = document.getElementById("filtroDataInicio").value;
    const dataFim = document.getElementById("filtroDataFim").value;

    if (dataInicio && dataFim) {
      dataInicioFiltro = new Date(dataInicio + "T00:00:00");
      dataFimFiltro = new Date(dataFim + "T23:59:59");

      document.querySelectorAll(".botao-periodo").forEach(function (b) {
        b.classList.remove("ativo");
      });

      periodoAtivo = null;
      aplicarFiltrosEAtualizar();
    }
  });

  document.getElementById("botaoExportarCSV").addEventListener("click", exportarCSV);
}

// ============================================================
// CARREGAMENTO DE DADOS
// ============================================================

async function carregarDadosRelatorio() {
  try {
    const respostas = await Promise.all([
      fetch(urlApiViagens),
      fetch(urlApiDespesas)
    ]);

    if (!respostas[0].ok || !respostas[1].ok) {
      console.error("Erro ao buscar dados da API.");
      return;
    }

    viagens = await respostas[0].json();
    despesas = await respostas[1].json();

    aplicarFiltrosEAtualizar();
  } catch (erro) {
    console.error("Erro de conexão com a API:", erro);
  }
}

// ============================================================
// FILTRAGEM
// ============================================================

function filtrarViagensPorPeriodo() {
  if (dataInicioFiltro && dataFimFiltro) {
    return viagens.filter(function (viagem) {
      if (!viagem.data_saida) return false;
      const dataSaida = new Date(viagem.data_saida);
      return dataSaida >= dataInicioFiltro && dataSaida <= dataFimFiltro;
    });
  }

  if (!periodoAtivo || periodoAtivo === 0) {
    return viagens;
  }

  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - periodoAtivo);

  return viagens.filter(function (viagem) {
    if (!viagem.data_saida) return false;
    const dataSaida = new Date(viagem.data_saida);
    return dataSaida >= dataCorte;
  });
}

function filtrarDespesasDasViagens(viagensFiltradas) {
  const idsViagens = new Set(viagensFiltradas.map(function (v) {
    return v.id;
  }));

  return despesas.filter(function (despesa) {
    return idsViagens.has(despesa.viagem_id);
  });
}

function aplicarFiltrosEAtualizar() {
  const viagensFiltradas = filtrarViagensPorPeriodo();
  const despesasFiltradas = filtrarDespesasDasViagens(viagensFiltradas);

  atualizarMetricas(viagensFiltradas, despesasFiltradas);
  renderizarTabelaCategorias(despesasFiltradas);
  renderizarTopMotoristas(viagensFiltradas, despesasFiltradas);
  renderizarTabelaViagens(viagensFiltradas, despesasFiltradas);
}

// ============================================================
// MÉTRICAS
// ============================================================

function atualizarMetricas(viagensFiltradas, despesasFiltradas) {
  const receita = viagensFiltradas.reduce(function (soma, viagem) {
    return soma + Number(viagem.valor_frete || 0);
  }, 0);

  const totalDespesas = despesasFiltradas.reduce(function (soma, despesa) {
    return soma + Number(despesa.valor || 0);
  }, 0);

  const lucro = receita - totalDespesas;
  const qtdViagens = viagensFiltradas.length;

  document.getElementById("metricaReceita").textContent = formatarMoeda(receita);
  document.getElementById("metricaDespesas").textContent = formatarMoeda(totalDespesas);
  document.getElementById("metricaLucro").textContent = formatarMoeda(lucro);
  document.getElementById("metricaViagens").textContent = qtdViagens;

  const elementoLucro = document.getElementById("metricaLucro");
  elementoLucro.style.color = lucro >= 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)";

  document.getElementById("variacaoReceita").textContent = qtdViagens + " viagem(ns) no período";
  document.getElementById("variacaoDespesas").textContent = despesasFiltradas.length + " lançamento(s)";
  document.getElementById("variacaoLucro").textContent = lucro >= 0 ? "Resultado positivo" : "Resultado negativo";
  document.getElementById("variacaoViagens").textContent = viagensFiltradas.filter(function (v) {
    return v.status === "finalizada";
  }).length + " finalizada(s)";
}

// ============================================================
// TABELA DE CATEGORIAS
// ============================================================

function renderizarTabelaCategorias(despesasFiltradas) {
  const corpoTabela = document.getElementById("corpoTabelaCategorias");
  const totalGeral = despesasFiltradas.reduce(function (soma, d) {
    return soma + Number(d.valor || 0);
  }, 0);

  const agrupado = {};

  despesasFiltradas.forEach(function (despesa) {
    const categoria = despesa.categoria || "Outros";

    if (!agrupado[categoria]) {
      agrupado[categoria] = { quantidade: 0, total: 0 };
    }

    agrupado[categoria].quantidade += 1;
    agrupado[categoria].total += Number(despesa.valor || 0);
  });

  const categorias = Object.keys(agrupado).sort(function (a, b) {
    return agrupado[b].total - agrupado[a].total;
  });

  if (categorias.length === 0) {
    corpoTabela.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 32px; color: var(--cor-texto-fraco);">
          Nenhuma despesa encontrada no período.
        </td>
      </tr>
    `;

    document.getElementById("totalQtdCategorias").textContent = "0";
    document.getElementById("totalValorCategorias").textContent = formatarMoeda(0);
    return;
  }

  corpoTabela.innerHTML = categorias.map(function (categoria) {
    const dados = agrupado[categoria];
    const percentual = totalGeral > 0 ? ((dados.total / totalGeral) * 100).toFixed(1) : "0.0";

    return `
      <tr class="linha-tabela">
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="selo-categoria">${categoria}</span>
          </div>
        </td>
        <td>${dados.quantidade}</td>
        <td>${formatarMoeda(dados.total)}</td>
        <td>
          <div class="barra-percentual-container">
            <div class="barra-percentual" style="width: ${percentual}%"></div>
            <span>${percentual}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const totalQtd = despesasFiltradas.length;
  document.getElementById("totalQtdCategorias").textContent = totalQtd;
  document.getElementById("totalValorCategorias").textContent = formatarMoeda(totalGeral);
}

// ============================================================
// TOP MOTORISTAS
// ============================================================

function renderizarTopMotoristas(viagensFiltradas, despesasFiltradas) {
  const container = document.getElementById("listaTopMotoristas");

  const agrupado = {};

  viagensFiltradas.forEach(function (viagem) {
    const nome = viagem.motorista_nome || "Não informado";

    if (!agrupado[nome]) {
      agrupado[nome] = { viagens: 0, receita: 0, despesas: 0 };
    }

    agrupado[nome].viagens += 1;
    agrupado[nome].receita += Number(viagem.valor_frete || 0);
  });

  despesasFiltradas.forEach(function (despesa) {
    const nome = despesa.motorista_nome || "Não informado";

    if (agrupado[nome]) {
      agrupado[nome].despesas += Number(despesa.valor || 0);
    }
  });

  const motoristas = Object.keys(agrupado).sort(function (a, b) {
    return agrupado[b].receita - agrupado[a].receita;
  }).slice(0, 5);

  if (motoristas.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 32px; color: var(--cor-texto-fraco);">
        Nenhuma viagem no período.
      </div>
    `;
    return;
  }

  container.innerHTML = motoristas.map(function (nome, indice) {
    const dados = agrupado[nome];
    const lucro = dados.receita - dados.despesas;
    const iniciais = nome.split(" ").slice(0, 2).map(function (p) {
      return p[0];
    }).join("").toUpperCase();

    return `
      <div class="item-top-motorista">
        <div class="posicao-motorista">${indice + 1}º</div>
        <div class="avatar-motorista">${iniciais}</div>
        <div class="info-motorista">
          <div class="nome-motorista">${nome}</div>
          <div class="sub-motorista">${dados.viagens} viagem(ns) · ${formatarMoeda(dados.receita)}</div>
        </div>
        <div class="lucro-motorista" style="color: ${lucro >= 0 ? 'var(--cor-sucesso)' : 'var(--cor-perigo)'}">
          ${formatarMoeda(lucro)}
        </div>
      </div>
    `;
  }).join("");
}

// ============================================================
// TABELA DE VIAGENS
// ============================================================

function renderizarTabelaViagens(viagensFiltradas, despesasFiltradas) {
  const corpoTabela = document.getElementById("corpoTabelaRelatorio");
  const contagemEl = document.getElementById("contagemViagens");

  contagemEl.textContent = viagensFiltradas.length + " viagem(ns)";

  if (viagensFiltradas.length === 0) {
    corpoTabela.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--cor-texto-fraco);">
          Nenhuma viagem encontrada no período.
        </td>
      </tr>
    `;

    document.getElementById("totalFrete").textContent = formatarMoeda(0);
    document.getElementById("totalDespesasTabela").textContent = formatarMoeda(0);
    document.getElementById("totalResultado").textContent = formatarMoeda(0);
    return;
  }

  let somaFrete = 0;
  let somaDespesas = 0;

  corpoTabela.innerHTML = viagensFiltradas.map(function (viagem) {
    const despesasDaViagem = despesasFiltradas.filter(function (d) {
      return d.viagem_id === viagem.id;
    });

    const totalDespesaViagem = despesasDaViagem.reduce(function (soma, d) {
      return soma + Number(d.valor || 0);
    }, 0);

    const frete = Number(viagem.valor_frete || 0);
    const resultado = frete - totalDespesaViagem;

    somaFrete += frete;
    somaDespesas += totalDespesaViagem;

    return `
      <tr class="linha-tabela">
        <td>
          <div class="bloco-rota">
            <div class="texto-rota">${viagem.origem} → ${viagem.destino}</div>
            <div class="texto-secundario">Reg. #${viagem.id}</div>
          </div>
        </td>
        <td>${viagem.motorista_nome || "—"}</td>
        <td>${viagem.veiculo_placa || viagem.veiculo_modelo || "—"}</td>
        <td>${formatarData(viagem.data_saida)}</td>
        <td>${formatarData(viagem.data_chegada)}</td>
        <td>${formatarMoeda(frete)}</td>
        <td>${formatarMoeda(totalDespesaViagem)}</td>
        <td style="color: ${resultado >= 0 ? 'var(--cor-sucesso)' : 'var(--cor-perigo)'}; font-weight: 600;">
          ${formatarMoeda(resultado)}
        </td>
        <td>${criarSeloStatusViagem(viagem.status)}</td>
      </tr>
    `;
  }).join("");

  const totalResultado = somaFrete - somaDespesas;
  document.getElementById("totalFrete").textContent = formatarMoeda(somaFrete);
  document.getElementById("totalDespesasTabela").textContent = formatarMoeda(somaDespesas);

  const elResultado = document.getElementById("totalResultado");
  elResultado.textContent = formatarMoeda(totalResultado);
  elResultado.style.color = totalResultado >= 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)";
}

// ============================================================
// EXPORTAR CSV
// ============================================================

function exportarCSV() {
  const viagensFiltradas = filtrarViagensPorPeriodo();
  const despesasFiltradas = filtrarDespesasDasViagens(viagensFiltradas);

  const cabecalho = ["ID", "Rota", "Motorista", "Veículo", "Data Saída", "Data Chegada", "Frete", "Despesas", "Resultado", "Status"];

  const linhas = viagensFiltradas.map(function (viagem) {
    const despesasDaViagem = despesasFiltradas.filter(function (d) {
      return d.viagem_id === viagem.id;
    });

    const totalDespesaViagem = despesasDaViagem.reduce(function (soma, d) {
      return soma + Number(d.valor || 0);
    }, 0);

    const frete = Number(viagem.valor_frete || 0);
    const resultado = frete - totalDespesaViagem;

    return [
      viagem.id,
      (viagem.origem || "") + " -> " + (viagem.destino || ""),
      viagem.motorista_nome || "",
      viagem.veiculo_placa || viagem.veiculo_modelo || "",
      formatarData(viagem.data_saida),
      formatarData(viagem.data_chegada),
      frete.toFixed(2).replace(".", ","),
      totalDespesaViagem.toFixed(2).replace(".", ","),
      resultado.toFixed(2).replace(".", ","),
      viagem.status || ""
    ].join(";");
  });

  const conteudoCSV = [cabecalho.join(";"), ...linhas].join("\n");
  const blob = new Blob(["\uFEFF" + conteudoCSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-autoacerto-" + new Date().toISOString().slice(0, 10) + ".csv";
  link.click();

  URL.revokeObjectURL(url);
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarData(dataISO) {
  if (!dataISO) return "—";
  const data = new Date(dataISO);
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  return dia + "/" + mes + "/" + ano;
}

function criarSeloStatusViagem(status) {
  if (status === "em andamento") {
    return '<span class="selo-status selo-andamento">Em andamento</span>';
  }

  if (status === "finalizada") {
    return '<span class="selo-status selo-finalizada">Finalizada</span>';
  }

  return '<span class="selo-status selo-cancelada">Cancelada</span>';
}