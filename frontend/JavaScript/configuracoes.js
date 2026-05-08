// ============================================================
// NAVEGAÇÃO ENTRE SEÇÕES
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  inicializarNavegacaoConfig();
  inicializarBotoesSalvar();
  inicializarBotaoPerigo();
  carregarPreferencias();
});

function inicializarNavegacaoConfig() {
  const itensMenu = document.querySelectorAll(".item-menu-config");

  itensMenu.forEach(function (item) {
    item.addEventListener("click", function () {
      const secaoAlvo = item.dataset.secao;

      itensMenu.forEach(function (i) {
        i.classList.remove("ativo");
      });

      item.classList.add("ativo");

      document.querySelectorAll(".secao-config").forEach(function (secao) {
        secao.style.display = "none";
      });

      const secaoEl = document.getElementById("secao-" + secaoAlvo);

      if (secaoEl) {
        secaoEl.style.display = "flex";
      }
    });
  });
}

// ============================================================
// PREFERÊNCIAS (armazenadas em memória)
// ============================================================

const preferencias = {
  perfil: {
    nome: "",
    email: "",
    telefone: "",
    cargo: ""
  },
  empresa: {
    nomeEmpresa: "",
    cnpj: "",
    endereco: "",
    telefoneEmpresa: "",
    emailEmpresa: ""
  },
  notificacoes: {
    viazemFinalizada: true,
    novaDespesa: false,
    cnh: true,
    resumoSemanal: true
  },
  sistema: {
    moeda: "BRL",
    formatoData: "dd/mm/aaaa",
    itensPagina: "25",
    modoCompacto: false
  }
};

function carregarPreferencias() {
  // Perfil
  document.getElementById("configNome").value = preferencias.perfil.nome;
  document.getElementById("configEmail").value = preferencias.perfil.email;
  document.getElementById("configTelefone").value = preferencias.perfil.telefone;
  document.getElementById("configCargo").value = preferencias.perfil.cargo;

  // Empresa
  document.getElementById("configNomeEmpresa").value = preferencias.empresa.nomeEmpresa;
  document.getElementById("configCnpj").value = preferencias.empresa.cnpj;
  document.getElementById("configEndereco").value = preferencias.empresa.endereco;
  document.getElementById("configTelefoneEmpresa").value = preferencias.empresa.telefoneEmpresa;
  document.getElementById("configEmailEmpresa").value = preferencias.empresa.emailEmpresa;

  // Notificações
  document.getElementById("notifViagemFinalizada").checked = preferencias.notificacoes.viazemFinalizada;
  document.getElementById("notifNovaDespesa").checked = preferencias.notificacoes.novaDespesa;
  document.getElementById("notifCnh").checked = preferencias.notificacoes.cnh;
  document.getElementById("notifResumoSemanal").checked = preferencias.notificacoes.resumoSemanal;

  // Sistema
  document.getElementById("configMoeda").value = preferencias.sistema.moeda;
  document.getElementById("configFormataData").value = preferencias.sistema.formatoData;
  document.getElementById("configItensPagina").value = preferencias.sistema.itensPagina;
  document.getElementById("modoCompacto").checked = preferencias.sistema.modoCompacto;
}

// ============================================================
// BOTÕES DE SALVAR
// ============================================================

function inicializarBotoesSalvar() {
  document.getElementById("botaoSalvarPerfil").addEventListener("click", function () {
    preferencias.perfil.nome = document.getElementById("configNome").value.trim();
    preferencias.perfil.email = document.getElementById("configEmail").value.trim();
    preferencias.perfil.telefone = document.getElementById("configTelefone").value.trim();
    preferencias.perfil.cargo = document.getElementById("configCargo").value.trim();

    exibirMensagemSucesso("mensagemPerfil", "Perfil salvo com sucesso.");
  });

  document.getElementById("botaoSalvarEmpresa").addEventListener("click", function () {
    preferencias.empresa.nomeEmpresa = document.getElementById("configNomeEmpresa").value.trim();
    preferencias.empresa.cnpj = document.getElementById("configCnpj").value.trim();
    preferencias.empresa.endereco = document.getElementById("configEndereco").value.trim();
    preferencias.empresa.telefoneEmpresa = document.getElementById("configTelefoneEmpresa").value.trim();
    preferencias.empresa.emailEmpresa = document.getElementById("configEmailEmpresa").value.trim();

    exibirMensagemSucesso("mensagemEmpresa", "Dados da empresa salvos com sucesso.");
  });

  document.getElementById("botaoSalvarNotificacoes").addEventListener("click", function () {
    preferencias.notificacoes.viazemFinalizada = document.getElementById("notifViagemFinalizada").checked;
    preferencias.notificacoes.novaDespesa = document.getElementById("notifNovaDespesa").checked;
    preferencias.notificacoes.cnh = document.getElementById("notifCnh").checked;
    preferencias.notificacoes.resumoSemanal = document.getElementById("notifResumoSemanal").checked;

    exibirMensagemSucesso("mensagemNotificacoes", "Preferências de notificação salvas.");
  });

  document.getElementById("botaoAlterarSenha").addEventListener("click", function () {
    const senhaAtual = document.getElementById("senhaAtual").value;
    const novaSenha = document.getElementById("novaSenha").value;
    const confirmarSenha = document.getElementById("confirmarSenha").value;

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      exibirMensagemErro("mensagemSeguranca", "Preencha todos os campos de senha.");
      return;
    }

    if (novaSenha.length < 8) {
      exibirMensagemErro("mensagemSeguranca", "A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      exibirMensagemErro("mensagemSeguranca", "As senhas não coincidem.");
      return;
    }

    document.getElementById("senhaAtual").value = "";
    document.getElementById("novaSenha").value = "";
    document.getElementById("confirmarSenha").value = "";

    exibirMensagemSucesso("mensagemSeguranca", "Senha alterada com sucesso.");
  });

  document.getElementById("botaoSalvarSistema").addEventListener("click", function () {
    preferencias.sistema.moeda = document.getElementById("configMoeda").value;
    preferencias.sistema.formatoData = document.getElementById("configFormataData").value;
    preferencias.sistema.itensPagina = document.getElementById("configItensPagina").value;
    preferencias.sistema.modoCompacto = document.getElementById("modoCompacto").checked;

    exibirMensagemSucesso("mensagemSistema", "Preferências do sistema salvas.");
  });
}

// ============================================================
// ZONA DE PERIGO
// ============================================================

function inicializarBotaoPerigo() {
  document.getElementById("botaoLimparDados").addEventListener("click", function () {
    const confirmacao = confirm(
      "Tem certeza que deseja apagar todos os dados?\n" +
      "Esta ação não pode ser desfeita."
    );

    if (!confirmacao) return;

    const segundaConfirmacao = confirm(
      "ATENÇÃO: Esta é sua última chance.\n" +
      "Todos os motoristas, veículos, viagens e despesas serão removidos permanentemente.\n" +
      "Confirmar exclusão?"
    );

    if (!segundaConfirmacao) return;

    alert("Funcionalidade de limpeza de dados requer integração com o backend para executar as exclusões.");
  });
}

// ============================================================
// UTILITÁRIOS DE MENSAGEM
// ============================================================

function exibirMensagemSucesso(idElemento, texto) {
  const elemento = document.getElementById(idElemento);

  elemento.textContent = texto;
  elemento.className = "mensagem-config mensagem-sucesso";

  setTimeout(function () {
    elemento.textContent = "";
    elemento.className = "mensagem-config";
  }, 3500);
}

function exibirMensagemErro(idElemento, texto) {
  const elemento = document.getElementById(idElemento);

  elemento.textContent = texto;
  elemento.className = "mensagem-config mensagem-erro";

  setTimeout(function () {
    elemento.textContent = "";
    elemento.className = "mensagem-config";
  }, 3500);
}