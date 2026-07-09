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

function diferencaDiasEntreDatas(inicio, fim) {
  if (!inicio || !fim) return 0;
  return Math.round((fim - inicio) / 86400000);
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

function obterIdsViagensPeriodo() {
  return obterViagensPeriodo().map(function (viagem) {
    return String(viagem.id);
  });
}

function obterDespesasRelacionadasAsViagensDoPeriodo() {
  const idsViagensPeriodo = obterIdsViagensPeriodo();

  return despesas.filter(function (despesa) {
    return idsViagensPeriodo.includes(String(despesa.viagem_id));
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
  ativarAnimacoesDashboard();
}

function ativarAnimacoesDashboard() {
  const seletores = [
    ".secao-boas-vindas",
    ".card-resumo",
    ".painel-financeiro",
    ".painel-viagens"
  ];

  seletores.forEach(function (seletor, indiceBase) {
    const elementos = document.querySelectorAll(seletor);
    elementos.forEach(function (elemento, indice) {
      if (!elemento.classList.contains("dash-entrada")) {
        elemento.classList.add("dash-entrada");
        elemento.style.animationDelay = (indiceBase * 0.06 + indice * 0.04) + "s";
      }
    });
  });
}

function atualizarCardsResumo() {
  const totalMotoristas = motoristas.length;
  const totalVeiculosAtivos = veiculos.filter(function (veiculo) {
    return veiculo.status === "ativo";
  }).length;
  const viagensPeriodo = obterViagensPeriodo();
  const despesasPeriodo = obterDespesasRelacionadasAsViagensDoPeriodo();
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
  const despesasPeriodo = obterDespesasRelacionadasAsViagensDoPeriodo();

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
      <div class="estado-vazio-viagens">
        <div class="icone-estado-vazio-viagens">
          <svg viewBox="0 0 24 24">
            <path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
        <div class="rota-viagem">Nenhuma viagem em andamento</div>
        <div class="nome-motorista">Assim que uma viagem for iniciada, ela aparece aqui.</div>
        <button class="botao-secundario" type="button" id="botaoCadastrarPrimeiraViagem">Cadastrar viagem</button>
      </div>
    `;

    const botaoCadastro = document.getElementById("botaoCadastrarPrimeiraViagem");
    if (botaoCadastro) {
      botaoCadastro.addEventListener("click", function () {
        window.location.href = "cadastro-viagem.html";
      });
    }

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
  const despesasRelacionadas = obterDespesasRelacionadasAsViagensDoPeriodo();
  const datasLancamentos = [];

  viagensPeriodo.forEach(function (viagem) {
    const dataViagem = obterDataLocal(viagem.data_saida);
    if (dataViagem) datasLancamentos.push(dataViagem);
  });

  const menorData = datasLancamentos.length ? new Date(Math.min.apply(null, datasLancamentos)) : null;
  const maiorData = datasLancamentos.length ? new Date(Math.max.apply(null, datasLancamentos)) : null;
  const diferencaDias = diferencaDiasEntreDatas(menorData, maiorData);
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

  despesasRelacionadas.forEach(function (despesa) {
    const viagemRelacionada = viagensPeriodo.find(function (viagem) {
      return String(viagem.id) === String(despesa.viagem_id);
    });
    if (!viagemRelacionada) return;

    const dataViagem = obterDataLocal(viagemRelacionada.data_saida);
    const chave = usarPeriodoDiario && dataViagem ? obterChaveDia(dataViagem) : obterMesAno(viagemRelacionada.data_saida);
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

function carregarGraficoFinanceiro() {
  const container = document.querySelector("#graficoDashboard");
  if (!container) return;

  const dados = montarFinanceiroMensal();
  container.innerHTML = "";

  if (dados.length === 0) {
    container.innerHTML = '<div class="grafico-vazio">Nenhum dado financeiro para o período.</div>';
    return;
  }

  const opcoesGrafico = {
    series: [
      { name: "Receita", data: dados.map(function(i) { return i.receita; }) },
      { name: "Lucro Líquido", data: dados.map(function(i) { return i.lucro; }) },
      { name: "Despesas", data: dados.map(function(i) { return i.despesas; }) }
    ],
    chart: {
      type: 'bar',
      height: 250,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        dynamicAnimation: { enabled: true, speed: 350 }
      }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '70%',
        dataLabels: { position: 'top' }
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: dados.map(function(i) { return i.mes; }),
      labels: {
        style: { colors: '#6b7280', fontSize: '11px', fontWeight: 500 },
        formatter: function (val) {
          return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0
          }).format(val);
        }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#374151', fontSize: '12px', fontWeight: 600 }
      }
    },
    colors: ['#4f8cff', '#14b8a6', '#fb7185'],
    fill: { opacity: 1 },
    grid: {
      borderColor: '#f3f4f6',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      markers: { radius: 12 },
      itemMargin: { horizontal: 10, vertical: 0 }
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: function (val) {
          return formatarMoeda(val);
        }
      }
    }
  };

  const grafico = new ApexCharts(container, opcoesGrafico);
  grafico.render();
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
  const filtroPeriodo = document.getElementById("opcoesPeriodoDashboard");
  const datasPeriodo = document.getElementById("datasPeriodoDashboard");
  const dataInicio = document.getElementById("dataInicioDashboard");
  const dataFim = document.getElementById("dataFimDashboard");

  if (!filtroPeriodo) return;

  const botaAtivo = document.querySelector("#opcoesPeriodoDashboard .botao-segmentado[data-valor='" + periodoDashboard.tipo + "']");
  if (botaAtivo) {
    document.querySelectorAll("#opcoesPeriodoDashboard .botao-segmentado").forEach(b => b.classList.remove("ativo"));
    botaAtivo.classList.add("ativo");
  }

  document.querySelectorAll(".botao-toggle-filtro").forEach(function (botaoToggle) {
    botaoToggle.addEventListener("click", function () {
      const estaAberto = botaoToggle.getAttribute("aria-expanded") === "true";
      const idControles = botaoToggle.getAttribute("aria-controls");
      const containerOpcoes = document.getElementById(idControles);

      botaoToggle.setAttribute("aria-expanded", String(!estaAberto));
      if (containerOpcoes) {
        containerOpcoes.classList.toggle("filtro-segmentado-fechado", estaAberto);
      }
    });
  });

  document.querySelectorAll(".grupo-filtro-segmentado").forEach(function (container) {
    container.addEventListener("click", function (evento) {
      const botao = evento.target.closest(".botao-segmentado");
      if (!botao) return;

      const paiFiltro = botao.closest(".filtro-segmentado");
      paiFiltro.querySelectorAll(".botao-segmentado").forEach(function (b) {
        b.classList.remove("ativo");
      });

      botao.classList.add("ativo");
      
      periodoDashboard.tipo = botao.dataset.valor;

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
