const urlApi = montarUrlApi("/veiculos");

let veiculosTodos = [];
let veiculosVisiveis = [];
let exclusaoVeiculos = null;

function criarIconeVeiculoLista() {
  return '<svg viewBox="0 0 24 24">' +
    '<path d="M10 17h4V5H2v12h3" />' +
    '<path d="M14 8h4l4 4v5h-3" />' +
    '<circle cx="7.5" cy="17.5" r="2.5" />' +
    '<circle cx="16.5" cy="17.5" r="2.5" />' +
  '</svg>';
}

function criarIconeVer() {
  return '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>';
}

function criarIconeEditar() {
  return '<svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>';
}

function criarSeloStatusVeiculo(status) {
  if (status === "ativo")       return '<span class="selo-status selo-ativo">Ativo</span>';
  if (status === "em viagem")   return '<span class="selo-status selo-em-viagem">Em viagem</span>';
  if (status === "manutenção")  return '<span class="selo-status selo-manutencao">Manutenção</span>';
  return '<span class="selo-status selo-inativo">Inativo</span>';
}

function formatarPlacaExibicao(placa) {
  if (!placa) return "—";
  if (window.AutoAcertoMascaras) {
    return window.AutoAcertoMascaras.aplicarPlaca(String(placa).replace(/-/g, ""));
  }
  const u = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (u.length <= 3) return u;
  return u.slice(0, 3) + "-" + u.slice(3);
}

function renderizarTabelaVeiculos(lista) {
  const corpo = document.getElementById("corpoTabelaVeiculos");
  corpo.innerHTML = "";
  veiculosVisiveis = lista;

  if (lista.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#6b7280;">Nenhum veículo encontrado.</td></tr>';
    if (exclusaoVeiculos) exclusaoVeiculos.aposRender([]);
    return;
  }

  lista.forEach(function (veiculo) {
    const linha = document.createElement("tr");
    linha.classList.add("linha-tabela");

    linha.innerHTML =
      (exclusaoVeiculos ? exclusaoVeiculos.colunaLinha(veiculo.id) : "") +
      '<td>' +
        '<div class="bloco-veiculo">' +
          '<div class="avatar-veiculo">' + criarIconeVeiculoLista() + '</div>' +
          '<div>' +
            '<div class="nome-veiculo">' + veiculo.modelo + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' + formatarPlacaExibicao(veiculo.placa) + '</td>' +
      '<td>' + (veiculo.ano || '—') + '</td>' +
      '<td>' + criarSeloStatusVeiculo(veiculo.status) + '</td>' +
      '<td>' +
        '<div class="grupo-acoes">' +
          '<button class="botao-acao" onclick="irParaVerVeiculo(' + veiculo.id + ')">' + criarIconeVer() + 'Ver</button>' +
          '<button class="botao-acao" onclick="irParaEditarVeiculo(' + veiculo.id + ')">' + criarIconeEditar() + 'Editar</button>' +
        '</div>' +
      '</td>';

    corpo.appendChild(linha);
  });

  if (exclusaoVeiculos) exclusaoVeiculos.aposRender(lista);
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
      (veiculo.observacoes  || "").toLowerCase().includes(pesquisa);

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
    var response = await fetch(urlApi, { headers: cabecalhosAutenticados() });
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
  const usuario = exigirAutenticacao();
  if (!usuario) return;
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();
  configurarExclusaoVeiculos();
  carregarVeiculos();

  document.getElementById("campoPesquisaVeiculo").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroStatusVeiculo").addEventListener("change", aplicarFiltros);

  document.getElementById("botaoNovoVeiculo").addEventListener("click", function () {
    window.location.href = "cadastro-veiculo.html";
  });
});

function configurarExclusaoVeiculos() {
  if (!window.AutoAcertoExclusao) return;

  exclusaoVeiculos = window.AutoAcertoExclusao.criarGerenciadorExclusao({
    urlApi: urlApi,
    seletorTabela: ".tabela-veiculos",
    seletorLinhas: "[data-selecionar-id]",
    seletorSelecionarTodos: "[data-selecionar-todos-veiculos]",
    singular: "veículo",
    plural: "veículos",
    renderizarAtual: function () { renderizarTabelaVeiculos(veiculosVisiveis); },
    aoExcluir: carregarVeiculos
  });
}
