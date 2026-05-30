const urlApiMotoristas = montarUrlApi("/motoristas");
const urlApiVeiculos = montarUrlApi("/veiculos");
const urlApiViagens = montarUrlApi("/viagens");
const urlApiDespesas = montarUrlApi("/despesas");

async function buscarDados(url) {
  const resposta = await fetch(url,{ headers: cabecalhosAutenticados() });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(texto || "HTTP " + resposta.status);
  }
  return resposta.json();
}

let motoristas = [];
let veiculos = [];
let viagens = [];
let despesas = [];
let periodoDashboard = {
  tipo: "0",
  dataInicio: "",
  dataFim: ""
};

async function carregarDadosDashboard() {
  try {
    const respostas = await Promise.allSettled([
      buscarDados(urlApiMotoristas),
      buscarDados(urlApiVeiculos),
      buscarDados(urlApiViagens),
      buscarDados(urlApiDespesas)
    ]);

    // Extrair dados considerando resposta paginada ou array direto
    motoristas = respostas[0].status === "fulfilled" 
      ? (respostas[0].value.dados || respostas[0].value) 
      : [];
    
    veiculos = respostas[1].status === "fulfilled" 
      ? (respostas[1].value.dados || respostas[1].value) 
      : [];
    
    viagens = respostas[2].status === "fulfilled" 
      ? (respostas[2].value.dados || respostas[2].value) 
      : [];
    
    despesas = respostas[3].status === "fulfilled" 
      ? (respostas[3].value.dados || respostas[3].value) 
      : [];

    atualizarDashboard();

    respostas.forEach(function (resposta, indice) {
      if (resposta.status === "rejected") {
        const endpoints = ["motoristas", "veiculos", "viagens", "despesas"];
        console.error("Falha ao carregar dados de " + endpoints[indice] + " no dashboard:", resposta.reason);
      }
    });
  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
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



function obterDataLocal(dataISO) {
  if (!dataISO) return null;

  const dataTexto = String(dataISO).slice(0, 10);
  const partes = dataTexto.split("-");

  if (partes.length !== 3) return null;

  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
}

function formatarDataCampo(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return ano + "-" + mes + "-" + dia;
}

function obterChaveDia(data) {
  return formatarDataCampo(data);
}

function obterRotuloDia(chaveDia) {
  const data = obterDataLocal(chaveDia);
  if (!data) return chaveDia;

  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");

  return dia + "/" + mes;
}

function obterIntervaloDashboard() {
  if (periodoDashboard.tipo === "0") return null;

  if (periodoDashboard.tipo === "customizado") {
    let inicioCustomizado = obterDataLocal(periodoDashboard.dataInicio);
    let fimCustomizado = obterDataLocal(periodoDashboard.dataFim);

    if (inicioCustomizado && fimCustomizado && inicioCustomizado > fimCustomizado) {
      const dataTemporaria = inicioCustomizado;
      inicioCustomizado = fimCustomizado;
      fimCustomizado = dataTemporaria;
    }

    return {
      inicio: inicioCustomizado,
      fim: fimCustomizado
    };
  }

  const dias = Number(periodoDashboard.tipo);
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - (dias - 1));

  return {
    inicio: inicio,
    fim: fim
  };
}

function dataEstaNoPeriodo(dataISO) {
  const intervalo = obterIntervaloDashboard();
  if (!intervalo) return true;

  const data = obterDataLocal(dataISO);
  if (!data) return false;

  if (intervalo.inicio && data < intervalo.inicio) return false;
  if (intervalo.fim && data > intervalo.fim) return false;

  return true;
}

function obterViagensPeriodo() {
  return viagens.filter(function (viagem) {
    return dataEstaNoPeriodo(viagem.data_saida);
  });
}

function obterDespesasPeriodo() {
  return despesas.filter(function (despesa) {
    return dataEstaNoPeriodo(despesa.data_despesa);
  });
}

function atualizarRotuloPeriodoDashboard() {
  const rotuloPeriodoPainel = document.getElementById("rotuloPeriodoPainel");
  if (!rotuloPeriodoPainel) return;

  if (periodoDashboard.tipo === "0") {
    rotuloPeriodoPainel.textContent = "Tudo";
    return;
  }

  if (periodoDashboard.tipo === "customizado") {
    const inicio = periodoDashboard.dataInicio ? obterRotuloDia(periodoDashboard.dataInicio) : "Início";
    const fim = periodoDashboard.dataFim ? obterRotuloDia(periodoDashboard.dataFim) : "Fim";
    rotuloPeriodoPainel.textContent = inicio + " até " + fim;
    return;
  }

  if (periodoDashboard.tipo === "365") {
    rotuloPeriodoPainel.textContent = "Últimos 12 meses";
    return;
  }

  rotuloPeriodoPainel.textContent = "Últimos " + periodoDashboard.tipo + " dias";
}

function atualizarDashboard() {
  atualizarRotuloPeriodoDashboard();
  atualizarCardsResumo();
  atualizarResumoFinanceiro();
  carregarViagensEmAndamento();
  carregarGraficoFinanceiro();
}

function atualizarCardsResumo() {
  const totalMotoristas = motoristas.length;
  const totalVeiculosAtivos = veiculos.filter(function (veiculo) {
    return veiculo.status === "ativo";
  }).length;
  const viagensPeriodo = obterViagensPeriodo();
  const despesasPeriodo = obterDespesasPeriodo();
  const totalViagens = viagensPeriodo.length;
  const valorTotalDespesasPeriodo = despesasPeriodo.reduce(function (acumulador, despesa) {
    return acumulador + obterValorDespesa(despesa);
  }, 0);

  document.getElementById("quantidadeMotoristas").textContent = totalMotoristas;
  document.getElementById("quantidadeVeiculos").textContent = totalVeiculosAtivos;
  document.getElementById("quantidadeViagens").textContent = totalViagens;
  document.getElementById("valorDespesas").textContent = formatarMoeda(valorTotalDespesasPeriodo);
}

function atualizarResumoFinanceiro() {
  const viagensPeriodo = obterViagensPeriodo();
  const despesasPeriodo = obterDespesasPeriodo();

  const receitaTotal = viagensPeriodo
    .filter(function (viagem) {
      return viagem.status !== "cancelada";
    })
    .reduce(function (acumulador, viagem) {
      return acumulador + obterValorFrete(viagem);
    }, 0);

  const despesasTotal = despesasPeriodo.reduce(function (acumulador, despesa) {
    return acumulador + obterValorDespesa(despesa);
  }, 0);

  const lucroLiquido = receitaTotal - despesasTotal;

  document.getElementById("valorReceita").textContent = formatarMoeda(receitaTotal);
  document.getElementById("valorResumoDespesas").textContent = formatarMoeda(despesasTotal);
  document.getElementById("valorLucro").textContent = formatarMoeda(lucroLiquido);
  document.getElementById("valorLucroCard").textContent = formatarMoeda(lucroLiquido);
}

function carregarViagensEmAndamento() {
  const listaViagens = document.getElementById("listaViagens");
  listaViagens.innerHTML = "";

  const viagensEmAndamento = obterViagensPeriodo()
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
    const origemViagem = window.AutoAcertoHtml.texto(viagem.origem, "-");
    const destinoViagem = window.AutoAcertoHtml.texto(viagem.destino, "-");
    const motoristaViagem = window.AutoAcertoHtml.texto(viagem.motorista_nome, "-");

    itemViagem.innerHTML = `
      <div class="icone-viagem-andamento">
        <svg viewBox="0 0 24 24">
          <path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      </div>
      <div>
        <div class="rota-viagem">${origemViagem} -> ${destinoViagem}</div>
        <div class="nome-motorista">${motoristaViagem}</div>
      </div>
      <div class="meta-viagem">
        <span class="data-viagem">${formatarData(viagem.data_saida)}</span>
        <span class="selo-status selo-andamento">Em andamento</span>
      </div>
    `;

    listaViagens.appendChild(itemViagem);
  });
}

function montarFinanceiroMensal() {
  const mapaMeses = {};
  const intervalo = obterIntervaloDashboard();
  const viagensPeriodo = obterViagensPeriodo();
  const despesasPeriodo = obterDespesasPeriodo();
  const datasLancamentos = [];

  viagensPeriodo.forEach(function (viagem) {
    const dataViagem = obterDataLocal(viagem.data_saida);
    if (dataViagem) datasLancamentos.push(dataViagem);
  });

  despesasPeriodo.forEach(function (despesa) {
    const dataDespesa = obterDataLocal(despesa.data_despesa);
    if (dataDespesa) datasLancamentos.push(dataDespesa);
  });

  const menorData = datasLancamentos.length ? new Date(Math.min.apply(null, datasLancamentos)) : null;
  const maiorData = datasLancamentos.length ? new Date(Math.max.apply(null, datasLancamentos)) : null;
  const diferencaDias = menorData && maiorData ? Math.round((maiorData - menorData) / 86400000) : 0;
  const usarPeriodoDiario = periodoDashboard.tipo !== "365" && (Boolean(intervalo) || diferencaDias <= 90);

  viagensPeriodo.forEach(function (viagem) {
    if (viagem.status === "cancelada") return;

    const dataViagem = obterDataLocal(viagem.data_saida);
    const chave = usarPeriodoDiario && dataViagem ? obterChaveDia(dataViagem) : obterMesAno(viagem.data_saida);
    if (!chave) return;

    if (!mapaMeses[chave]) {
      mapaMeses[chave] = { receita: 0, despesas: 0, lucro: 0 };
    }

    mapaMeses[chave].receita += obterValorFrete(viagem);
  });

  despesasPeriodo.forEach(function (despesa) {
    const dataDespesa = obterDataLocal(despesa.data_despesa);
    const chave = usarPeriodoDiario && dataDespesa ? obterChaveDia(dataDespesa) : obterMesAno(despesa.data_despesa);
    if (!chave) return;

    if (!mapaMeses[chave]) {
      mapaMeses[chave] = { receita: 0, despesas: 0, lucro: 0 };
    }

    mapaMeses[chave].despesas += obterValorDespesa(despesa);
  });

  return Object.keys(mapaMeses)
    .sort()
    .slice(-12)
    .map(function (chave) {
      const item = mapaMeses[chave];
      item.lucro = item.receita - item.despesas;
      return {
        mes: usarPeriodoDiario ? obterRotuloDia(chave) : obterRotuloMes(chave),
        receita: item.receita,
        despesas: item.despesas,
        lucro: item.lucro
      };
    })
    .reduce(function (lista, item, indice, origem) {
      if (origem.length === 1 && usarPeriodoDiario) {
        const dataPonto = obterDataLocal(Object.keys(mapaMeses).sort()[0]);
        if (dataPonto) {
          dataPonto.setDate(dataPonto.getDate() - 1);
          lista.push({
            mes: obterRotuloDia(formatarDataCampo(dataPonto)),
            receita: 0,
            despesas: 0,
            lucro: 0
          });
        }
      }

      lista.push(item);
      return lista;
    }, []);
}

function criarPathLinha(dados, chave, escalaY, inicioX, espacamento) {
  return dados.map(function (item, indice) {
    const x = inicioX + indice * espacamento;
    const y = escalaY(item[chave]);
    return (indice === 0 ? "M" : "L") + x + " " + y;
  }).join(" ");
}

function mostrarTooltipGrafico(evento, item, serie) {
  const tooltip = document.getElementById("tooltipGraficoFinanceiro");
  const areaGrafico = document.querySelector(".grafico-linha-financeiro");

  if (!tooltip || !areaGrafico) return;

  const nomesSeries = {
    receita: "Receita",
    despesas: "Despesas",
    lucro: "Lucro líquido"
  };
  const limites = areaGrafico.getBoundingClientRect();

  tooltip.innerHTML = "<span>" + item.mes + " - " + nomesSeries[serie] + "</span>" + formatarMoeda(item[serie]);
  tooltip.style.left = (evento.clientX - limites.left) + "px";
  tooltip.style.top = (evento.clientY - limites.top) + "px";
  tooltip.classList.remove("oculto");
}

function esconderTooltipGrafico() {
  const tooltip = document.getElementById("tooltipGraficoFinanceiro");
  if (tooltip) {
    tooltip.classList.add("oculto");
  }
}

function carregarGraficoFinanceiro() {
  const svg = document.getElementById("graficoLinhaFinanceiro");
  if (!svg) return;

  const dados = montarFinanceiroMensal();
  const rotulos = document.getElementById("rotulosGraficoFinanceiro");
  const pontos = document.getElementById("pontosGraficoFinanceiro");
  rotulos.innerHTML = "";
  pontos.innerHTML = "";

  if (dados.length === 0) {
    document.getElementById("linhaReceita").setAttribute("d", "");
    document.getElementById("linhaLucro").setAttribute("d", "");
    document.getElementById("linhaDespesas").setAttribute("d", "");
    return;
  }

  const inicioX = 44;
  const largura = 656;
  const topo = 30;
  const base = 230;
  const espacamento = dados.length === 1 ? 0 : largura / (dados.length - 1);
  const valores = [];

  dados.forEach(function (item) {
    valores.push(item.receita, item.despesas, item.lucro);
  });

  const maior = Math.max(...valores, 1);
  const menor = Math.min(...valores, 0);
  const amplitude = maior - menor || 1;

  function escalaY(valor) {
    return base - ((valor - menor) / amplitude) * (base - topo);
  }

  document.getElementById("linhaReceita").setAttribute("d", criarPathLinha(dados, "receita", escalaY, inicioX, espacamento));
  document.getElementById("linhaLucro").setAttribute("d", criarPathLinha(dados, "lucro", escalaY, inicioX, espacamento));
  document.getElementById("linhaDespesas").setAttribute("d", criarPathLinha(dados, "despesas", escalaY, inicioX, espacamento));

  dados.forEach(function (item, indice) {
    const x = inicioX + indice * espacamento;
    const texto = document.createElementNS("http://www.w3.org/2000/svg", "text");
    texto.setAttribute("x", x);
    texto.setAttribute("y", 252);
    texto.setAttribute("text-anchor", "middle");
    texto.setAttribute("class", "rotulo-grafico");
    texto.textContent = item.mes;
    rotulos.appendChild(texto);

    [
      { chave: "receita", cor: "#22c55e" },
      { chave: "lucro", cor: "#2563eb" },
      { chave: "despesas", cor: "#f43f5e" }
    ].forEach(function (serie) {
      const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circulo.setAttribute("cx", x);
      circulo.setAttribute("cy", escalaY(item[serie.chave]));
      circulo.setAttribute("r", 4);
      circulo.setAttribute("fill", serie.cor);
      circulo.setAttribute("class", "ponto-grafico");
      circulo.addEventListener("mouseenter", function (evento) {
        mostrarTooltipGrafico(evento, item, serie.chave);
      });
      circulo.addEventListener("mousemove", function (evento) {
        mostrarTooltipGrafico(evento, item, serie.chave);
      });
      circulo.addEventListener("mouseleave", esconderTooltipGrafico);
      pontos.appendChild(circulo);
    });
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
    window.location.href = "viagens.html";
  });

  document.getElementById("botaoLancarDespesa").addEventListener("click", function () {
    window.location.href = "despesas.html";
  });

  document.getElementById("botaoVerRelatorio").addEventListener("click", function () {
    window.location.href = "relatorios.html";
  });
}

function configurarPeriodoDashboard() {
  const filtroPeriodo = document.getElementById("filtroPeriodoDashboard");
  const datasPeriodo = document.getElementById("datasPeriodoDashboard");
  const dataInicio = document.getElementById("dataInicioDashboard");
  const dataFim = document.getElementById("dataFimDashboard");

  if (!filtroPeriodo) return;

  filtroPeriodo.value = periodoDashboard.tipo;

  filtroPeriodo.addEventListener("change", function () {
    periodoDashboard.tipo = filtroPeriodo.value;

    if (datasPeriodo) {
      datasPeriodo.classList.toggle("oculto", periodoDashboard.tipo !== "customizado");
    }

    if (periodoDashboard.tipo === "customizado") {
      if (!periodoDashboard.dataInicio || !periodoDashboard.dataFim) {
        const fim = new Date();
        const inicio = new Date();
        inicio.setDate(fim.getDate() - 29);

        periodoDashboard.dataInicio = formatarDataCampo(inicio);
        periodoDashboard.dataFim = formatarDataCampo(fim);

        if (dataInicio) dataInicio.value = periodoDashboard.dataInicio;
        if (dataFim) dataFim.value = periodoDashboard.dataFim;
      }
    }

    atualizarDashboard();
  });

  if (dataInicio) {
    dataInicio.addEventListener("change", function () {
      periodoDashboard.dataInicio = dataInicio.value;
      atualizarDashboard();
    });
  }

  if (dataFim) {
    dataFim.addEventListener("change", function () {
      periodoDashboard.dataFim = dataFim.value;
      atualizarDashboard();
    });
  }
}

function iniciarTela() {
  adicionarEventosBotoes();
  configurarPeriodoDashboard();
  carregarDadosDashboard();
}

document.addEventListener("DOMContentLoaded", iniciarTela);
