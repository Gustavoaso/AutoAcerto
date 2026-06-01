const urlApiDespesas = montarUrlApi("/despesas");
const urlApiViagens = montarUrlApi("/viagens");
const urlApiVeiculos = montarUrlApi("/veiculos");

const botaoSalvar = document.getElementById("botaoSalvarDespesa");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
let tipoDespesaSelecionado = "viagem";
const paramsDespesa = new URLSearchParams(window.location.search);
const viagemPreSelecionada = paramsDespesa.get("viagemId");
const usuarioLogado = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
let anexoCupomAtual = null;

async function carregarViagens() {
  try {
    const response = await fetch(urlApiViagens, {
      headers: cabecalhosAutenticados()
    });

    if (!response.ok) return;

    const resultado = await response.json();
    // Suporta resposta paginada ou array direto
    let viagens = resultado.dados || resultado;
    if (typeof filtrarListaPorTransportadoraMaster === "function") {
      viagens = filtrarListaPorTransportadoraMaster(viagens);
    }

    const selectViagem = document.getElementById("viagemId");
    selectViagem.innerHTML = '<option value="">Selecione</option>';

    viagens.forEach(function (viagem) {
      const opcao = document.createElement("option");
      opcao.value = viagem.id;
      opcao.textContent = viagem.origem + " -> " + viagem.destino;
      selectViagem.appendChild(opcao);
    });

    if (viagemPreSelecionada) {
      selectViagem.value = viagemPreSelecionada;
    }
  } catch (erro) {
    console.error("Erro ao carregar viagens:", erro);
  }
}

async function carregarVeiculos() {
  try {
    const response = await fetch(urlApiVeiculos, {
      headers: cabecalhosAutenticados()
    });

    if (!response.ok) return;

    const resultado = await response.json();
    // Suporta resposta paginada ou array direto
    let veiculos = resultado.dados || resultado;
    if (typeof filtrarListaPorTransportadoraMaster === "function") {
      veiculos = filtrarListaPorTransportadoraMaster(veiculos);
    }

    const selectVeiculo = document.getElementById("veiculoId");
    selectVeiculo.innerHTML = '<option value="">Selecione</option>';

    veiculos
      .filter(function (veiculo) { return veiculo.status === "ativo"; })
      .forEach(function (veiculo) {
        const opcao = document.createElement("option");
        opcao.value = veiculo.id;
        opcao.textContent = veiculo.modelo + " - " + veiculo.placa;
        selectVeiculo.appendChild(opcao);
      });
  } catch (erro) {
    console.error("Erro ao carregar veiculos:", erro);
  }
}

function alternarTipoDespesa(tipo) {
  tipoDespesaSelecionado = tipo;

  const despesaViagem = tipo === "viagem";
  document.getElementById("grupoViagemDespesa").classList.toggle("oculto", !despesaViagem);
  document.getElementById("grupoVeiculoDespesa").classList.toggle("oculto", despesaViagem);
  document.getElementById("viagemId").required = despesaViagem;
  document.getElementById("veiculoId").required = !despesaViagem;

  if (despesaViagem) {
    document.getElementById("veiculoId").value = "";
  } else {
    document.getElementById("viagemId").value = "";
  }

  document.querySelectorAll("[data-tipo-despesa]").forEach(function (botao) {
    botao.classList.toggle("ativo", botao.dataset.tipoDespesa === tipo);
  });
}

function configurarTipoDespesa() {
  document.querySelectorAll("[data-tipo-despesa]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      alternarTipoDespesa(botao.dataset.tipoDespesa);
    });
  });
}

function abrirSeletorCupom(modo) {
  const input = document.getElementById("inputCupomFiscal");
  if (!input) return;

  if (modo === "camera") {
    input.setAttribute("capture", "environment");
  } else {
    input.removeAttribute("capture");
  }

  input.click();
}

function renderizarPreviewCupom() {
  const preview = document.getElementById("previewCupomFiscal");
  const imagem = document.getElementById("imagemCupomFiscal");
  const nome = document.getElementById("nomeCupomFiscal");

  if (!preview || !imagem || !nome) return;

  if (!anexoCupomAtual) {
    preview.classList.add("oculto");
    imagem.removeAttribute("src");
    nome.textContent = "Nenhum arquivo selecionado";
    return;
  }

  imagem.src = anexoCupomAtual.base64;
  nome.textContent = anexoCupomAtual.nome;
  preview.classList.remove("oculto");
}

function limparAnexoCupom() {
  anexoCupomAtual = null;
  const input = document.getElementById("inputCupomFiscal");
  if (input) input.value = "";
  renderizarPreviewCupom();
}

function redimensionarImagemArquivo(arquivo) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      const imagem = new Image();
      imagem.onload = function () {
        const larguraMaxima = 1600;
        const alturaMaxima = 1600;
        let largura = imagem.width;
        let altura = imagem.height;

        if (largura > larguraMaxima || altura > alturaMaxima) {
          const escala = Math.min(larguraMaxima / largura, alturaMaxima / altura);
          largura = Math.round(largura * escala);
          altura = Math.round(altura * escala);
        }

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;

        const contexto = canvas.getContext("2d");
        contexto.drawImage(imagem, 0, 0, largura, altura);

        const mime = arquivo.type === "image/png" ? "image/png" : "image/jpeg";
        const qualidade = mime === "image/png" ? undefined : 0.82;
        const base64 = canvas.toDataURL(mime, qualidade);

        resolve({
          nome: arquivo.name || "cupom-fiscal",
          tipo: mime,
          base64: base64
        });
      };

      imagem.onerror = function () {
        reject(new Error("imagem-invalida"));
      };

      imagem.src = reader.result;
    };

    reader.onerror = function () {
      reject(new Error("leitura-invalida"));
    };

    reader.readAsDataURL(arquivo);
  });
}

function configurarAnexoCupom() {
  const botaoFoto = document.getElementById("botaoFotoCupom");
  const botaoGaleria = document.getElementById("botaoGaleriaCupom");
  const botaoRemover = document.getElementById("botaoRemoverCupom");
  const input = document.getElementById("inputCupomFiscal");

  if (botaoFoto) {
    botaoFoto.addEventListener("click", function () {
      abrirSeletorCupom("camera");
    });
  }

  if (botaoGaleria) {
    botaoGaleria.addEventListener("click", function () {
      abrirSeletorCupom("galeria");
    });
  }

  if (botaoRemover) {
    botaoRemover.addEventListener("click", limparAnexoCupom);
  }

  if (input) {
    input.addEventListener("change", async function () {
      const arquivo = input.files && input.files[0];
      if (!arquivo) return;

      try {
        anexoCupomAtual = await redimensionarImagemArquivo(arquivo);
        renderizarPreviewCupom();
      } catch (erro) {
        console.error("Erro ao processar cupom:", erro);
        alert("Nao foi possivel processar a imagem do cupom.");
        limparAnexoCupom();
      }
    });
  }
}

function configurarTelaPorPerfil() {
  if (!usuarioLogado || usuarioLogado.perfil !== "motorista") return;

  document.querySelectorAll('[data-tipo-despesa="veiculo"]').forEach(function (botao) {
    botao.classList.add("oculto");
  });

  alternarTipoDespesa("viagem");
}

function configurarFormularioDespesa() {
  botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro({
      mensagemErro: "Selecione a transportadora no topo para definir o escopo deste cadastro."
    })) {
      return;
    }

    const valorNum = window.AutoAcertoMascaras
      ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valor").value)
      : parseFloat(document.getElementById("valor").value);
    if (valorNum === undefined || isNaN(valorNum) || valorNum <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    let dados = {
      tipoDespesa: tipoDespesaSelecionado,
      viagemId: tipoDespesaSelecionado === "viagem" ? document.getElementById("viagemId").value : null,
      veiculoId: tipoDespesaSelecionado === "veiculo" ? document.getElementById("veiculoId").value : null,
      descricao: document.getElementById("descricao").value,
      categoria: document.getElementById("categoria").value,
      dataDespesa: document.getElementById("dataDespesa").value,
      valor: valorNum
    };

    if (anexoCupomAtual) {
      dados.anexoCupomNome = anexoCupomAtual.nome;
      dados.anexoCupomTipo = anexoCupomAtual.tipo;
      dados.anexoCupomBase64 = anexoCupomAtual.base64;
    }

    if (typeof anexarTransportadoraIdSeMaster === "function") {
      dados = anexarTransportadoraIdSeMaster(dados);
    }

    try {
      const response = await fetch(urlApiDespesas, {
        method: "POST",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        const erro = await response.json();
        alert(erro.mensagem || "Erro ao cadastrar despesa.");
        return;
      }

      modal.classList.remove("oculto");
    } catch (erro) {
      console.error("Erro geral:", erro);
      alert("Erro de conexao com a API.");
    }
  });

  botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "despesas.html";
  });

  botaoLimpar.addEventListener("click", function () {
    alternarTipoDespesa("viagem");
    document.getElementById("viagemId").value = "";
    document.getElementById("veiculoId").value = "";
    document.getElementById("descricao").value = "";
    document.getElementById("categoria").value = "";
    document.getElementById("dataDespesa").value = "";
    document.getElementById("valor").value = "";
    limparAnexoCupom();
  });
}

function iniciarPaginaCadastroDespesa() {
  const usuario = exigirAutenticacao();
  if (!usuario) return;
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();

  document.addEventListener("autoacerto-master-transportadora", function () {
    carregarViagens();
    carregarVeiculos();
  });

  configurarTipoDespesa();
  configurarTelaPorPerfil();
  configurarAnexoCupom();
  if (viagemPreSelecionada) {
    alternarTipoDespesa("viagem");
  }
  configurarFormularioDespesa();
  carregarViagens();
  carregarVeiculos();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaCadastroDespesa);
