const urlApi = "http://localhost:3000/veiculos";

let veiculosTodos = [];

function criarSeloStatusVeiculo(status) {
  if (status === "ativo")       return '<span class="selo-status selo-ativo">Ativo</span>';
  if (status === "em viagem")   return '<span class="selo-status selo-em-viagem">Em viagem</span>';
  if (status === "manutenção")  return '<span class="selo-status selo-manutencao">Manutenção</span>';
  return '<span class="selo-status selo-inativo">Inativo</span>';
}

function renderizarTabelaVeiculos(lista) {
  const corpo = document.getElementById("corpoTabelaVeiculos");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#6b7280;">Nenhum veículo encontrado.</td></tr>';
    return;
  }

  lista.forEach(function (veiculo) {
    const linha = document.createElement("tr");
    linha.classList.add("linha-tabela");

    linha.innerHTML =
      '<td>' +
        '<div class="bloco-veiculo">' +
          '<div class="avatar-veiculo">🚛</div>' +
          '<div>' +
            '<div class="nome-veiculo">' + veiculo.modelo + '</div>' +
            '<div class="texto-secundario">Registro #' + veiculo.id + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' + veiculo.placa + '</td>' +
      '<td>' + veiculo.proprietario + '</td>' +
      '<td>' + (veiculo.ano || '—') + '</td>' +
      '<td>' + criarSeloStatusVeiculo(veiculo.status) + '</td>' +
      '<td>' +
        '<div class="grupo-acoes">' +
          '<button class="botao-acao" onclick="irParaVerVeiculo(' + veiculo.id + ')">Ver</button>' +
          '<button class="botao-acao" onclick="irParaEditarVeiculo(' + veiculo.id + ')">Editar</button>' +
        '</div>' +
      '</td>';

    corpo.appendChild(linha);
  });
}

function atualizarResumoVeiculos(lista) {
  document.getElementById("totalVeiculos").textContent = lista.length;
  document.getElementById("totalVeiculosAtivos").textContent =
    lista.filter(function(v) { return v.status === "ativo"; }).length;
  document.getElementById("totalEmViagem").textContent =
    lista.filter(function(v) { return v.status === "em viagem"; }).length;
  document.getElementById("totalEmManutencao").textContent =
    lista.filter(function(v) { return v.status === "manutenção"; }).length;
}

function aplicarFiltros() {
  var pesquisa = document.getElementById("campoPesquisaVeiculo").value.toLowerCase().trim();
  var statusSelecionado = document.getElementById("filtroStatusVeiculo").value;

  var listaFiltrada = veiculosTodos.filter(function (veiculo) {
    var correspondePesquisa =
      (veiculo.placa        || "").toLowerCase().includes(pesquisa) ||
      (veiculo.modelo       || "").toLowerCase().includes(pesquisa) ||
      (veiculo.proprietario || "").toLowerCase().includes(pesquisa);

    var correspondeStatus =
      statusSelecionado === "todos" || veiculo.status === statusSelecionado;

    return correspondePesquisa && correspondeStatus;
  });

  renderizarTabelaVeiculos(listaFiltrada);
}

function irParaVerVeiculo(id) {
  window.location.href = "ver-veiculo.html?id=" + id;
}

function irParaEditarVeiculo(id) {
  window.location.href = "editar-veiculo.html?id=" + id;
}

async function carregarVeiculos() {
  try {
    var response = await fetch(urlApi);
    if (!response.ok) throw new Error("Erro na API");
    veiculosTodos = await response.json();
    atualizarResumoVeiculos(veiculosTodos);
    renderizarTabelaVeiculos(veiculosTodos);
  } catch (erro) {
    console.error("Erro ao carregar veículos:", erro);
    document.getElementById("corpoTabelaVeiculos").innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:40px;color:#dc2626;">Erro ao conectar com o servidor. Verifique se o backend está em execução.</td></tr>';
  }
}

document.addEventListener("DOMContentLoaded", function () {
  carregarVeiculos();

  document.getElementById("campoPesquisaVeiculo").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroStatusVeiculo").addEventListener("change", aplicarFiltros);

  document.getElementById("botaoNovoVeiculo").addEventListener("click", function () {
    window.location.href = "cadastro-veiculo.html";
  });

  document.querySelector(".botao-sair").addEventListener("click", function () {
    alert("Saindo do sistema...");
  });
});