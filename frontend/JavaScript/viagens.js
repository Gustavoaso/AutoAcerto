const viagens = [
  {
    id: 1,
    origem: "Betim - MG",
    destino: "São Paulo - SP",
    motorista: "Carlos Silva",
    veiculo: "Volvo FH 540",
    placa: "QWE-1234",
    dataSaida: "01/04/2026",
    dataChegada: "03/04/2026",
    valorFrete: 5800,
    status: "em andamento"
  },
  {
    id: 2,
    origem: "Contagem - MG",
    destino: "Curitiba - PR",
    motorista: "Ana Souza",
    veiculo: "Scania R 450",
    placa: "RTY-5678",
    dataSaida: "25/03/2026",
    dataChegada: "29/03/2026",
    valorFrete: 7200,
    status: "finalizada"
  },
  {
    id: 3,
    origem: "Belo Horizonte - MG",
    destino: "Goiânia - GO",
    motorista: "João Pereira",
    veiculo: "Mercedes-Benz Actros",
    placa: "UIO-9012",
    dataSaida: "20/03/2026",
    dataChegada: "23/03/2026",
    valorFrete: 4900,
    status: "cancelada"
  },
  {
    id: 4,
    origem: "Betim - MG",
    destino: "Rio de Janeiro - RJ",
    motorista: "Marcos Oliveira",
    veiculo: "DAF XF 480",
    placa: "ASD-3456",
    dataSaida: "30/03/2026",
    dataChegada: "31/03/2026",
    valorFrete: 3600,
    status: "finalizada"
  },
  {
    id: 5,
    origem: "Sete Lagoas - MG",
    destino: "Vitória - ES",
    motorista: "Gustavo Lima",
    veiculo: "Iveco S-Way",
    placa: "FGH-7890",
    dataSaida: "02/04/2026",
    dataChegada: "04/04/2026",
    valorFrete: 6100,
    status: "em andamento"
  }
];

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
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

function renderizarTabelaViagens(listaViagens) {
  const corpoTabelaViagens = document.getElementById("corpoTabelaViagens");
  corpoTabelaViagens.innerHTML = "";

  listaViagens.forEach(function (viagem) {
    const linha = document.createElement("tr");
    linha.classList.add("linha-tabela");

    linha.innerHTML = `
      <td>
        <div class="bloco-viagem">
          <div class="avatar-viagem">📍</div>
          <div>
            <div class="nome-rota">${viagem.origem} → ${viagem.destino}</div>
            <div class="texto-secundario">Registro #${viagem.id}</div>
          </div>
        </div>
      </td>
      <td>${viagem.motorista}</td>
      <td>${viagem.veiculo} <br><span class="texto-secundario">${viagem.placa}</span></td>
      <td>${viagem.dataSaida}</td>
      <td>${viagem.dataChegada}</td>
      <td>${formatarMoeda(viagem.valorFrete)}</td>
      <td>${criarSeloStatusViagem(viagem.status)}</td>
      <td>
        <div class="grupo-acoes">
          <button class="botao-acao">Ver</button>
          <button class="botao-acao">Editar</button>
        </div>
      </td>
    `;

    corpoTabelaViagens.appendChild(linha);
  });
}

function atualizarResumoViagens() {
  const totalViagens = viagens.length;
  const totalEmAndamento = viagens.filter(viagem => viagem.status === "em andamento").length;
  const totalFinalizadas = viagens.filter(viagem => viagem.status === "finalizada").length;
  const valorTotalFretes = viagens.reduce((acumulador, viagem) => acumulador + viagem.valorFrete, 0);

  document.getElementById("totalViagens").textContent = totalViagens;
  document.getElementById("totalEmAndamento").textContent = totalEmAndamento;
  document.getElementById("totalFinalizadas").textContent = totalFinalizadas;
  document.getElementById("valorTotalFretes").textContent = formatarMoeda(valorTotalFretes);
}

function aplicarFiltrosViagens() {
  const valorPesquisa = document.getElementById("campoPesquisaViagem").value.toLowerCase().trim();
  const valorStatus = document.getElementById("filtroStatusViagem").value;

  const listaFiltrada = viagens.filter(function (viagem) {
    const correspondePesquisa =
      viagem.origem.toLowerCase().includes(valorPesquisa) ||
      viagem.destino.toLowerCase().includes(valorPesquisa) ||
      viagem.motorista.toLowerCase().includes(valorPesquisa) ||
      viagem.veiculo.toLowerCase().includes(valorPesquisa) ||
      viagem.placa.toLowerCase().includes(valorPesquisa);

    const correspondeStatus =
      valorStatus === "todos" || viagem.status === valorStatus;

    return correspondePesquisa && correspondeStatus;
  });

  renderizarTabelaViagens(listaFiltrada);
}

function configurarEventosViagens() {
  document
    .getElementById("campoPesquisaViagem")
    .addEventListener("input", aplicarFiltrosViagens);

  document
    .getElementById("filtroStatusViagem")
    .addEventListener("change", aplicarFiltrosViagens);

  document
    .getElementById("botaoNovaViagem")
    .addEventListener("click", function () {
      alert("Abrir formulário para cadastrar nova viagem.");
    });

  document
    .querySelector(".botao-sair")
    .addEventListener("click", function () {
      alert("Saindo do sistema...");
    });
}

function iniciarPaginaViagens() {
  atualizarResumoViagens();
  renderizarTabelaViagens(viagens);
  configurarEventosViagens();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaViagens);