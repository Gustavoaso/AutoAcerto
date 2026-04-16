const despesas = [
  {
    id: 1,
    descricao: "Abastecimento em Betim",
    viagem: "Betim - MG → São Paulo - SP",
    motorista: "Carlos Silva",
    veiculo: "Volvo FH 540",
    categoria: "combustível",
    data: "01/04/2026",
    valor: 1850
  },
  {
    id: 2,
    descricao: "Pedágio Rodovia Fernão Dias",
    viagem: "Betim - MG → São Paulo - SP",
    motorista: "Carlos Silva",
    veiculo: "Volvo FH 540",
    categoria: "pedágio",
    data: "02/04/2026",
    valor: 240
  },
  {
    id: 3,
    descricao: "Almoço durante a viagem",
    viagem: "Contagem - MG → Curitiba - PR",
    motorista: "Ana Souza",
    veiculo: "Scania R 450",
    categoria: "alimentação",
    data: "26/03/2026",
    valor: 75
  },
  {
    id: 4,
    descricao: "Troca emergencial de mangueira",
    viagem: "Belo Horizonte - MG → Goiânia - GO",
    motorista: "João Pereira",
    veiculo: "Mercedes-Benz Actros",
    categoria: "manutenção",
    data: "21/03/2026",
    valor: 420
  },
  {
    id: 5,
    descricao: "Estacionamento noturno",
    viagem: "Sete Lagoas - MG → Vitória - ES",
    motorista: "Gustavo Lima",
    veiculo: "Iveco S-Way",
    categoria: "outros",
    data: "03/04/2026",
    valor: 95
  },
  {
    id: 6,
    descricao: "Abastecimento em Contagem",
    viagem: "Contagem - MG → Curitiba - PR",
    motorista: "Ana Souza",
    veiculo: "Scania R 450",
    categoria: "combustível",
    data: "25/03/2026",
    valor: 2100
  }
];

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function criarIconeCategoria(categoria) {
  if (categoria === "combustível") return "⛽";
  if (categoria === "pedágio") return "🛣️";
  if (categoria === "alimentação") return "🍽️";
  if (categoria === "manutenção") return "🔧";
  return "📌";
}

function criarSeloCategoria(categoria) {
  if (categoria === "combustível") {
    return '<span class="selo-categoria selo-combustivel">Combustível</span>';
  }

  if (categoria === "pedágio") {
    return '<span class="selo-categoria selo-pedagio">Pedágio</span>';
  }

  if (categoria === "alimentação") {
    return '<span class="selo-categoria selo-alimentacao">Alimentação</span>';
  }

  if (categoria === "manutenção") {
    return '<span class="selo-categoria selo-manutencao">Manutenção</span>';
  }

  return '<span class="selo-categoria selo-outros">Outros</span>';
}

function renderizarTabelaDespesas(listaDespesas) {
  const corpoTabelaDespesas = document.getElementById("corpoTabelaDespesas");
  corpoTabelaDespesas.innerHTML = "";

  listaDespesas.forEach(function (despesa) {
    const linha = document.createElement("tr");
    linha.classList.add("linha-tabela");

    linha.innerHTML = `
      <td>
        <div class="bloco-despesa">
          <div class="avatar-despesa">${criarIconeCategoria(despesa.categoria)}</div>
          <div>
            <div class="nome-despesa">${despesa.descricao}</div>
            <div class="texto-secundario">Registro #${despesa.id}</div>
          </div>
        </div>
      </td>
      <td>${despesa.viagem}</td>
      <td>${despesa.motorista}</td>
      <td>${despesa.veiculo}</td>
      <td>${criarSeloCategoria(despesa.categoria)}</td>
      <td>${despesa.data}</td>
      <td class="valor-despesa">${formatarMoeda(despesa.valor)}</td>
      <td>
        <div class="grupo-acoes">
          <button class="botao-acao">Ver</button>
          <button class="botao-acao">Editar</button>
        </div>
      </td>
    `;

    corpoTabelaDespesas.appendChild(linha);
  });
}

function descobrirMaiorCategoria() {
  const totaisPorCategoria = {};

  despesas.forEach(function (despesa) {
    if (!totaisPorCategoria[despesa.categoria]) {
      totaisPorCategoria[despesa.categoria] = 0;
    }

    totaisPorCategoria[despesa.categoria] += despesa.valor;
  });

  let categoriaMaior = "";
  let valorMaior = 0;

  for (const categoria in totaisPorCategoria) {
    if (totaisPorCategoria[categoria] > valorMaior) {
      valorMaior = totaisPorCategoria[categoria];
      categoriaMaior = categoria;
    }
  }

  if (categoriaMaior === "combustível") return "Combustível";
  if (categoriaMaior === "pedágio") return "Pedágio";
  if (categoriaMaior === "alimentação") return "Alimentação";
  if (categoriaMaior === "manutenção") return "Manutenção";
  return "Outros";
}

function atualizarResumoDespesas() {
  const totalDespesas = despesas.length;
  const valorTotalDespesas = despesas.reduce((acumulador, despesa) => acumulador + despesa.valor, 0);
  const viagensUnicas = new Set(despesas.map(despesa => despesa.viagem));

  document.getElementById("totalDespesas").textContent = totalDespesas;
  document.getElementById("valorTotalDespesas").textContent = formatarMoeda(valorTotalDespesas);
  document.getElementById("maiorCategoriaDespesa").textContent = descobrirMaiorCategoria();
  document.getElementById("totalViagensComDespesa").textContent = viagensUnicas.size;
}

function aplicarFiltrosDespesas() {
  const valorPesquisa = document.getElementById("campoPesquisaDespesa").value.toLowerCase().trim();
  const valorCategoria = document.getElementById("filtroCategoriaDespesa").value;

  const listaFiltrada = despesas.filter(function (despesa) {
    const correspondePesquisa =
      despesa.descricao.toLowerCase().includes(valorPesquisa) ||
      despesa.motorista.toLowerCase().includes(valorPesquisa) ||
      despesa.categoria.toLowerCase().includes(valorPesquisa) ||
      despesa.veiculo.toLowerCase().includes(valorPesquisa);

    const correspondeCategoria =
      valorCategoria === "todas" || despesa.categoria === valorCategoria;

    return correspondePesquisa && correspondeCategoria;
  });

  renderizarTabelaDespesas(listaFiltrada);
}

function configurarEventosDespesas() {
  document
    .getElementById("campoPesquisaDespesa")
    .addEventListener("input", aplicarFiltrosDespesas);

  document
    .getElementById("filtroCategoriaDespesa")
    .addEventListener("change", aplicarFiltrosDespesas);

  document
    .getElementById("botaoNovaDespesa")
    .addEventListener("click", function () {
      alert("Abrir formulário para cadastrar nova despesa.");
    });

  document
    .querySelector(".botao-sair")
    .addEventListener("click", function () {
      alert("Saindo do sistema...");
    });
}

function iniciarPaginaDespesas() {
  atualizarResumoDespesas();
  renderizarTabelaDespesas(despesas);
  configurarEventosDespesas();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaDespesas);