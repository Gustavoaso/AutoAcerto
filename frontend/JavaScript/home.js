const urlApiMotoristas = "http://localhost:3000/motoristas";
const urlApiVeiculos = "http://localhost:3000/veiculos";
const urlApiViagens = "http://localhost:3000/viagens";
const urlApiDespesas = "http://localhost:3000/despesas";

let motoristas = [];
let veiculos = [];
let viagens = [];
let despesas = [];

async function buscarDados(urlApi) {
  const response = await fetch(urlApi);

  if (!response.ok) {
    throw new Error("Erro ao buscar dados da API.");
  }

  return response.json();
}

async function carregarDadosDashboard() {
  try {
    const respostas = await Promise.all([
      buscarDados(urlApiMotoristas),
      buscarDados(urlApiVeiculos),
      buscarDados(urlApiViagens),
      buscarDados(urlApiDespesas)
    ]);

    motoristas = respostas[0];
    veiculos = respostas[1];
    viagens = respostas[2];
    despesas = respostas[3];

    atualizarCardsResumo();
    atualizarResumoFinanceiro();
    carregarViagensEmAndamento();
    carregarGraficoCategorias();
    carregarGraficoBarras();
  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function obterValorDespesa(despesa) {
  return Number(despesa.valor || 0);
}

function obterValorFrete(viagem) {
  return Number(viagem.valor_frete || 0);
}

function obterMesAno(dataISO) {
  if (!dataISO) return "";

  const data = new Date(dataISO);
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();

  return ano + "-" + mes;
}

function obterRotuloMes(chaveMes) {
  const partes = chaveMes.split("-");
  const mes = Number(partes[1]);

  const nomesMeses = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez"
  ];

  return nomesMeses[mes - 1] || chaveMes;
}

function atualizarCardsResumo() {
  const totalMotoristas = motoristas.length;
  const totalVeiculosAtivos = veiculos.filter(function (veiculo) {
    return veiculo.status === "ativo";
  }).length;
  const totalViagensEmAndamento = viagens.filter(function (viagem) {
    return viagem.status === "em andamento";
  }).length;
  const valorTotalDespesas = despesas.reduce(function (acumulador, despesa) {
    return acumulador + obterValorDespesa(despesa);
  }, 0);

  document.getElementById("quantidadeMotoristas").textContent = totalMotoristas;
  document.getElementById("quantidadeVeiculos").textContent = totalVeiculosAtivos;
  document.getElementById("quantidadeViagens").textContent = totalViagensEmAndamento;
  document.getElementById("valorDespesas").textContent = formatarMoeda(valorTotalDespesas);
}

function atualizarResumoFinanceiro() {
  const receitaTotal = viagens
    .filter(function (viagem) {
      return viagem.status !== "cancelada";
    })
    .reduce(function (acumulador, viagem) {
      return acumulador + obterValorFrete(viagem);
    }, 0);

  const despesasTotal = despesas.reduce(function (acumulador, despesa) {
    return acumulador + obterValorDespesa(despesa);
  }, 0);

  const lucroLiquido = receitaTotal - despesasTotal;

  document.getElementById("valorReceita").textContent = formatarMoeda(receitaTotal);
  document.getElementById("valorResumoDespesas").textContent = formatarMoeda(despesasTotal);
  document.getElementById("valorLucro").textContent = formatarMoeda(lucroLiquido);
}

function carregarViagensEmAndamento() {
  const listaViagens = document.getElementById("listaViagens");
  listaViagens.innerHTML = "";

  const viagensEmAndamento = viagens
    .filter(function (viagem) {
      return viagem.status === "em andamento";
    })
    .slice(0, 3);

  if (viagensEmAndamento.length === 0) {
    listaViagens.innerHTML = `
      <div class="item-viagem">
        <div>
          <div class="rota-viagem">Nenhuma viagem em andamento</div>
          <div class="nome-motorista">Cadastre ou atualize uma viagem</div>
        </div>
      </div>
    `;
    return;
  }

  viagensEmAndamento.forEach(function (viagem) {
    const itemViagem = document.createElement("div");
    itemViagem.classList.add("item-viagem");

    itemViagem.innerHTML = `
      <div>
        <div class="rota-viagem">${viagem.origem} -> ${viagem.destino}</div>
        <div class="nome-motorista">${viagem.motorista_nome || "-"}</div>
      </div>
      <div>ðŸš›</div>
    `;

    listaViagens.appendChild(itemViagem);
  });
}

function calcularDespesasPorCategoria() {
  const totais = {
    combustivel: 0,
    pedagio: 0,
    alimentacao: 0,
    manutencao: 0,
    outros: 0
  };

  despesas.forEach(function (despesa) {
    const categoria = despesa.categoria || "outros";

    if (!totais[categoria]) {
      totais[categoria] = 0;
    }

    totais[categoria] += obterValorDespesa(despesa);
  });

  return totais;
}

function carregarGraficoCategorias() {
  const graficoCategorias = document.getElementById("graficoCategorias");
  const totais = calcularDespesasPorCategoria();

  const totalGeral =
    totais.combustivel +
    totais.pedagio +
    totais.alimentacao +
    totais.manutencao +
    totais.outros;

  if (totalGeral === 0) {
    graficoCategorias.style.background = "#e5e7eb";

    document.getElementById("legendaCombustivel").textContent = "Combustivel: R$ 0,00";
    document.getElementById("legendaPedagio").textContent = "Pedagio: R$ 0,00";
    document.getElementById("legendaAlimentacao").textContent = "Alimentacao: R$ 0,00";
    document.getElementById("legendaOutros").textContent = "Outros: R$ 0,00";
    return;
  }

  const percentualCombustivel = (totais.combustivel / totalGeral) * 100;
  const percentualPedagio = percentualCombustivel + (totais.pedagio / totalGeral) * 100;
  const percentualAlimentacao = percentualPedagio + (totais.alimentacao / totalGeral) * 100;
  const percentualOutros = 100;

  graficoCategorias.style.background = `
    conic-gradient(
      #2563eb 0% ${percentualCombustivel}%,
      #ef4444 ${percentualCombustivel}% ${percentualPedagio}%,
      #22c55e ${percentualPedagio}% ${percentualAlimentacao}%,
      #fbbf24 ${percentualAlimentacao}% ${percentualOutros}%
    )
  `;

  document.getElementById("legendaCombustivel").textContent = "Combustivel: " + formatarMoeda(totais.combustivel);
  document.getElementById("legendaPedagio").textContent = "Pedagio: " + formatarMoeda(totais.pedagio);
  document.getElementById("legendaAlimentacao").textContent = "Alimentacao: " + formatarMoeda(totais.alimentacao);
  document.getElementById("legendaOutros").textContent =
    "Outros: " + formatarMoeda(totais.manutencao + totais.outros);
}

function montarLucroMensal() {
  const mapaMeses = {};

  viagens.forEach(function (viagem) {
    if (viagem.status === "cancelada") return;

    const chaveMes = obterMesAno(viagem.data_saida);

    if (!chaveMes) return;

    if (!mapaMeses[chaveMes]) {
      mapaMeses[chaveMes] = {
        receita: 0,
        despesas: 0
      };
    }

    mapaMeses[chaveMes].receita += obterValorFrete(viagem);
  });

  despesas.forEach(function (despesa) {
    const chaveMes = obterMesAno(despesa.data_despesa);

    if (!chaveMes) return;

    if (!mapaMeses[chaveMes]) {
      mapaMeses[chaveMes] = {
        receita: 0,
        despesas: 0
      };
    }

    mapaMeses[chaveMes].despesas += obterValorDespesa(despesa);
  });

  return Object.keys(mapaMeses)
    .sort()
    .slice(-7)
    .map(function (chaveMes) {
      return {
        mes: obterRotuloMes(chaveMes),
        valor: mapaMeses[chaveMes].receita - mapaMeses[chaveMes].despesas
      };
    });
}

function carregarGraficoBarras() {
  const graficoBarras = document.getElementById("graficoBarras");
  graficoBarras.innerHTML = "";

  const dadosLucroMensal = montarLucroMensal();

  if (dadosLucroMensal.length === 0) {
    graficoBarras.innerHTML = `
      <div style="width: 100%; text-align: center; color: #6b7280; padding: 40px 0;">
        Nenhum dado financeiro encontrado.
      </div>
    `;
    return;
  }

  const maiorValor = Math.max(...dadosLucroMensal.map(function (item) {
    return Math.abs(item.valor);
  }));

  dadosLucroMensal.forEach(function (item) {
    const colunaGrafico = document.createElement("div");
    colunaGrafico.classList.add("coluna-grafico");

    const barraGrafico = document.createElement("div");
    barraGrafico.classList.add("barra-grafico");

    const altura = maiorValor === 0 ? 8 : (Math.abs(item.valor) / maiorValor) * 220;
    barraGrafico.style.height = altura + "px";
    barraGrafico.title = formatarMoeda(item.valor);

    if (item.valor < 0) {
      barraGrafico.style.background = "linear-gradient(180deg, #f87171 0%, #dc2626 100%)";
    }

    const rotuloColuna = document.createElement("span");
    rotuloColuna.classList.add("rotulo-coluna");
    rotuloColuna.textContent = item.mes;

    colunaGrafico.appendChild(barraGrafico);
    colunaGrafico.appendChild(rotuloColuna);
    graficoBarras.appendChild(colunaGrafico);
  });
}

function adicionarEventosBotoes() {
  document.getElementById("botaoVerMotoristas").addEventListener("click", function () {
    window.location.href = "motoristas.html";
  });

  document.getElementById("botaoVerVeiculos").addEventListener("click", function () {
    window.location.href = "veiculos.html";
  });

  document.getElementById("botaoLancarViagem").addEventListener("click", function () {
    window.location.href = "cadastro-viagem.html";
  });

  document.getElementById("botaoLancarDespesa").addEventListener("click", function () {
    window.location.href = "cadastro-despesa.html";
  });

  document.querySelector(".botao-sair").addEventListener("click", function () {
    alert("Saindo do sistema...");
  });
}

function iniciarTela() {
  adicionarEventosBotoes();
  carregarDadosDashboard();
}

document.addEventListener("DOMContentLoaded", iniciarTela);
