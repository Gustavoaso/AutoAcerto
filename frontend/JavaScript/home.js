const viagensEmAndamento = [
  {
    rota: "Betim → São Paulo",
    motorista: "Carlos Silva"
  },
  {
    rota: "Contagem → Curitiba",
    motorista: "Ana Souza"
  },
  {
    rota: "Belo Horizonte → Goiânia",
    motorista: "João Pereira"
  }
];

const dadosLucroMensal = [
  { mes: "Jan", valor: 90 },
  { mes: "Fev", valor: 120 },
  { mes: "Mar", valor: 180 },
  { mes: "Abr", valor: 140 },
  { mes: "Mai", valor: 200 },
  { mes: "Jun", valor: 260 },
  { mes: "Jul", valor: 220 }
];

function carregarViagens() {
  const listaViagens = document.getElementById("listaViagens");

  viagensEmAndamento.forEach(function (viagem) {
    const itemViagem = document.createElement("div");
    itemViagem.classList.add("item-viagem");

    itemViagem.innerHTML = `
      <div>
        <div class="rota-viagem">${viagem.rota}</div>
        <div class="nome-motorista">${viagem.motorista}</div>
      </div>
      <div>🚛</div>
    `;

    listaViagens.appendChild(itemViagem);
  });
}

function carregarGraficoBarras() {
  const graficoBarras = document.getElementById("graficoBarras");
  const maiorValor = Math.max(...dadosLucroMensal.map(item => item.valor));

  dadosLucroMensal.forEach(function (item) {
    const colunaGrafico = document.createElement("div");
    colunaGrafico.classList.add("coluna-grafico");

    const barraGrafico = document.createElement("div");
    barraGrafico.classList.add("barra-grafico");
    barraGrafico.style.height = `${(item.valor / maiorValor) * 220}px`;
    barraGrafico.title = `R$ ${item.valor.toFixed(2).replace(".", ",")}`;

    const rotuloColuna = document.createElement("span");
    rotuloColuna.classList.add("rotulo-coluna");
    rotuloColuna.textContent = item.mes;

    colunaGrafico.appendChild(barraGrafico);
    colunaGrafico.appendChild(rotuloColuna);
    graficoBarras.appendChild(colunaGrafico);
  });
}

function adicionarEventosBotoes() {
  const botoesCard = document.querySelectorAll(".botao-card");

  botoesCard.forEach(function (botao) {
    botao.addEventListener("click", function () {
      alert(`Você clicou em: ${botao.textContent}`);
    });
  });

  const botaoSair = document.querySelector(".botao-sair");

  botaoSair.addEventListener("click", function () {
    alert("Saindo do sistema...");
  });
}

function iniciarTela() {
  carregarViagens();
  carregarGraficoBarras();
  adicionarEventosBotoes();
}

document.addEventListener("DOMContentLoaded", iniciarTela);