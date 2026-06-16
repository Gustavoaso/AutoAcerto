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

function criarPathLinha(dados, chave, escalaY, inicioX, espacamento) {
  return dados.map(function (item, indice) {
    const x = inicioX + indice * espacamento;
    const y = escalaY(item[chave]);
    return (indice === 0 ? "M" : "L") + x + " " + y;
  }).join(" ");
}

function obterPosicaoXGrafico(indice, totalItens, inicioX, largura) {
  if (totalItens <= 1) {
    return inicioX + (largura / 2);
  }

  const espacamento = largura / (totalItens - 1);
  return inicioX + indice * espacamento;
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
  const barras = document.getElementById("barrasGraficoFinanceiro");
  const pontos = document.getElementById("pontosGraficoFinanceiro");
  rotulos.innerHTML = "";
  barras.innerHTML = "";
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

  document.getElementById("linhaReceita").setAttribute("d", "");
  document.getElementById("linhaLucro").setAttribute("d", "");
  document.getElementById("linhaDespesas").setAttribute("d", "");

  const espacamentoGrupos = dados.length <= 1 ? largura : largura / (dados.length - 1);
  const larguraGrupo = Math.max(Math.min(espacamentoGrupos * 0.6, 52), 24);
  const larguraBarra = Math.max((larguraGrupo - 8) / 3, 6);
  const deslocamentoInicial = larguraGrupo / 2;
  const yZero = escalaY(0);
  const series = [
    { chave: "receita", cor: "#22c55e", preenchimento: "rgba(34, 197, 94, 0.22)" },
    { chave: "despesas", cor: "#f43f5e", preenchimento: "rgba(244, 63, 94, 0.22)" },
    { chave: "lucro", cor: "#2563eb", preenchimento: "rgba(37, 99, 235, 0.22)" }
  ];

  dados.forEach(function (item, indice) {
    const centroX = obterPosicaoXGrafico(indice, dados.length, inicioX, largura);

    series.forEach(function (serie, serieIndice) {
      const valor = item[serie.chave];
      const yValor = escalaY(valor);
      const altura = Math.max(Math.abs(yValor - yZero), 2);
      const y = valor >= 0 ? Math.min(yValor, yZero) : yZero;
      const x = centroX - deslocamentoInicial + (serieIndice * larguraBarra) + (serieIndice * 4);
      const barra = document.createElementNS("http://www.w3.org/2000/svg", "rect");

      barra.setAttribute("x", x);
      barra.setAttribute("y", y);
      barra.setAttribute("width", larguraBarra);
      barra.setAttribute("height", altura);
      barra.setAttribute("rx", Math.min(larguraBarra / 2, 5));
      barra.setAttribute("fill", serie.preenchimento);
      barra.setAttribute("stroke", serie.cor);
      barra.setAttribute("stroke-width", "1.2");
      barra.setAttribute("class", "barra-grafico");
      barra.addEventListener("mouseenter", function (evento) {
        mostrarTooltipGrafico(evento, item, serie.chave);
      });
      barra.addEventListener("mousemove", function (evento) {
        mostrarTooltipGrafico(evento, item, serie.chave);
      });
      barra.addEventListener("mouseleave", esconderTooltipGrafico);
      barras.appendChild(barra);
    });
  });

  dados.forEach(function (item, indice) {
    const x = obterPosicaoXGrafico(indice, dados.length, inicioX, largura);
    const texto = document.createElementNS("http://www.w3.org/2000/svg", "text");
    texto.setAttribute("x", x);
    texto.setAttribute("y", 252);
    texto.setAttribute("text-anchor", "middle");
    texto.setAttribute("class", "rotulo-grafico");
    texto.textContent = item.mes;
    rotulos.appendChild(texto);
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
