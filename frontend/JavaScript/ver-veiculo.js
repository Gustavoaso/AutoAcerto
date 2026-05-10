const urlApi = "http://localhost:3000/veiculos";

const params = new URLSearchParams(window.location.search);
const idVeiculo = params.get("id");

function formatarPlacaExibicao(placa) {
  if (!placa) return "—";
  if (window.AutoAcertoMascaras) {
    return window.AutoAcertoMascaras.aplicarPlaca(String(placa).replace(/-/g, ""));
  }
  const u = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (u.length <= 3) return u || "—";
  return u.slice(0, 3) + "-" + u.slice(3);
}

function formatarDataHora(dataISO) {
  if (!dataISO) return "—";
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return dia + "/" + mes + "/" + ano + " " + hora + ":" + minuto;
}

async function carregarVeiculo() {
  if (!idVeiculo) {
    alert("Veículo não encontrado.");
    window.location.href = "veiculos.html";
    return;
  }

  try {
    const response = await fetch(urlApi + "/" + idVeiculo);

    if (!response.ok) {
      alert("Veículo não encontrado.");
      window.location.href = "veiculos.html";
      return;
    }

    const veiculo = await response.json();

    const placaFmt = formatarPlacaExibicao(veiculo.placa);
    document.getElementById("detalheModelo").textContent = veiculo.modelo;
    document.getElementById("detalhePlacaTopo").textContent = placaFmt;
    document.getElementById("detalheModeloGrid").textContent = veiculo.modelo;
    document.getElementById("detalhePlaca").textContent = placaFmt;
    document.getElementById("detalheAno").textContent = veiculo.ano || "—";
    document.getElementById("detalheObservacoes").textContent = veiculo.observacoes || "—";
    document.getElementById("detalheDataCadastro").textContent = formatarDataHora(veiculo.data_cadastro);

    const statusEl = document.getElementById("detalheStatus");
    const statusMap = {
      "ativo":      ["selo-ativo",      "Ativo"],
      "em viagem":  ["selo-em-viagem",  "Em viagem"],
      "manutenção": ["selo-manutencao", "Manutenção"],
      "inativo":    ["selo-inativo",    "Inativo"]
    };
    const [classe, texto] = statusMap[veiculo.status] || ["selo-inativo", veiculo.status];
    statusEl.innerHTML = '<span class="selo-status ' + classe + '">' + texto + '</span>';

  } catch (error) {
    console.error("Erro ao carregar veículo:", error);
    alert("Erro de conexão com o servidor.");
  }
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
  window.location.href = "veiculos.html";
});

document.getElementById("botaoEditar").addEventListener("click", function () {
  window.location.href = "editar-veiculo.html?id=" + idVeiculo;
});

document.querySelector(".botao-sair").addEventListener("click", function () {
  alert("Saindo do sistema...");
});

carregarVeiculo();