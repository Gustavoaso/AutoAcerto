const veiculos = [
  {
    id: 1,
    placa: "QWE-1234",
    modelo: "Volvo FH 540",
    tipo: "Cegonha",
    capacidade: "11 veículos",
    proprietario: "Carlos Silva",
    status: "ativo",
    ultimaViagem: "01/04/2026"
  },
  {
    id: 2,
    placa: "RTY-5678",
    modelo: "Scania R 450",
    tipo: "Cegonha",
    capacidade: "10 veículos",
    proprietario: "Ana Souza",
    status: "em viagem",
    ultimaViagem: "03/04/2026"
  },
  {
    id: 3,
    placa: "UIO-9012",
    modelo: "Mercedes-Benz Actros",
    tipo: "Caminhão",
    capacidade: "8 veículos",
    proprietario: "João Pereira",
    status: "manutenção",
    ultimaViagem: "20/03/2026"
  },
  {
    id: 4,
    placa: "ASD-3456",
    modelo: "DAF XF 480",
    tipo: "Cegonha",
    capacidade: "11 veículos",
    proprietario: "Marcos Oliveira",
    status: "inativo",
    ultimaViagem: "10/02/2026"
  },
  {
    id: 5,
    placa: "FGH-7890",
    modelo: "Iveco S-Way",
    tipo: "Cegonha",
    capacidade: "9 veículos",
    proprietario: "Gustavo Soares",
    status: "ativo",
    ultimaViagem: "28/03/2026"
  }
];

function criarSeloStatusVeiculo(status) {
  if (status === "ativo") {
    return '<span class="selo-status selo-ativo">Ativo</span>';
  }

  if (status === "em viagem") {
    return '<span class="selo-status selo-em-viagem">Em viagem</span>';
  }

  if (status === "manutenção") {
    return '<span class="selo-status selo-manutencao">Manutenção</span>';
  }

  return '<span class="selo-status selo-inativo">Inativo</span>';
}

function criarIconeTipoVeiculo(tipo) {
  if (tipo.toLowerCase() === "cegonha") {
    return "🚛";
  }

  return "🚚";
}

function renderizarTabelaVeiculos(listaVeiculos) {
  const corpoTabelaVeiculos = document.getElementById("corpoTabelaVeiculos");
  corpoTabelaVeiculos.innerHTML = "";

  listaVeiculos.forEach(function (veiculo) {
    const linha = document.createElement("tr");
    linha.classList.add("linha-tabela");

    linha.innerHTML = `
      <td>
        <div class="bloco-veiculo">
          <div class="avatar-veiculo">${criarIconeTipoVeiculo(veiculo.tipo)}</div>
          <div>
            <div class="nome-veiculo">${veiculo.modelo}</div>
            <div class="texto-secundario">Registro #${veiculo.id}</div>
          </div>
        </div>
      </td>
      <td>${veiculo.placa}</td>
      <td>${veiculo.tipo}</td>
      <td>${veiculo.capacidade}</td>
      <td>${veiculo.proprietario}</td>
      <td>${criarSeloStatusVeiculo(veiculo.status)}</td>
      <td>${veiculo.ultimaViagem}</td>
      <td>
        <div class="grupo-acoes">
          <button class="botao-acao">Ver</button>
          <button class="botao-acao">Editar</button>
        </div>
      </td>
    `;

    corpoTabelaVeiculos.appendChild(linha);
  });
}

function atualizarResumoVeiculos() {
  const totalVeiculos = veiculos.length;
  const totalVeiculosAtivos = veiculos.filter(veiculo => veiculo.status === "ativo").length;
  const totalEmViagem = veiculos.filter(veiculo => veiculo.status === "em viagem").length;
  const totalEmManutencao = veiculos.filter(veiculo => veiculo.status === "manutenção").length;

  document.getElementById("totalVeiculos").textContent = totalVeiculos;
  document.getElementById("totalVeiculosAtivos").textContent = totalVeiculosAtivos;
  document.getElementById("totalEmViagem").textContent = totalEmViagem;
  document.getElementById("totalEmManutencao").textContent = totalEmManutencao;
}

function aplicarFiltrosVeiculos() {
  const valorPesquisa = document.getElementById("campoPesquisaVeiculo").value.toLowerCase().trim();
  const valorStatus = document.getElementById("filtroStatusVeiculo").value;

  const listaFiltrada = veiculos.filter(function (veiculo) {
    const correspondePesquisa =
      veiculo.placa.toLowerCase().includes(valorPesquisa) ||
      veiculo.modelo.toLowerCase().includes(valorPesquisa) ||
      veiculo.proprietario.toLowerCase().includes(valorPesquisa) ||
      veiculo.tipo.toLowerCase().includes(valorPesquisa);

    const correspondeStatus =
      valorStatus === "todos" || veiculo.status === valorStatus;

    return correspondePesquisa && correspondeStatus;
  });

  renderizarTabelaVeiculos(listaFiltrada);
}

function configurarEventosVeiculos() {
  document
    .getElementById("campoPesquisaVeiculo")
    .addEventListener("input", aplicarFiltrosVeiculos);

  document
    .getElementById("filtroStatusVeiculo")
    .addEventListener("change", aplicarFiltrosVeiculos);

  document
    .getElementById("botaoNovoVeiculo")
    .addEventListener("click", function () {
      alert("Abrir formulário para cadastrar novo veículo.");
    });

  document
    .querySelector(".botao-sair")
    .addEventListener("click", function () {
      alert("Saindo do sistema...");
    });
}

function iniciarPaginaVeiculos() {
  atualizarResumoVeiculos();
  renderizarTabelaVeiculos(veiculos);
  configurarEventosVeiculos();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaVeiculos);