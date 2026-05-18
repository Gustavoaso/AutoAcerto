// =============================================================
// AUTOACERTO — TRANSPORTADORAS
// Cadastro de transportadoras e administrador inicial.
// =============================================================

const urlApiTransportadoras = montarUrlApi("/transportadoras");

let transportadoras = [];
let transportadorasVisiveis = [];
let exclusaoTransportadoras = null;

function criarIconeTransportadoraLista() {
    return '<svg viewBox="0 0 24 24">' +
        '<rect x="3" y="4" width="18" height="16" rx="2" />' +
        '<path d="M7 8h10" />' +
        '<path d="M7 12h10" />' +
        '<path d="M7 16h6" />' +
    '</svg>';
}

function criarIconeVer() {
    return '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>';
}

function criarIconeEditar() {
    return '<svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>';
}

function obterIniciaisTransportadora(nome) {
    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(function (parte) { return parte[0].toUpperCase(); })
        .join("");
}

function formatarDataTransportadora(dataISO) {
    if (!dataISO) return "—";
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

function exibirToastTransportadora(mensagem, tipo) {
    const toast = document.getElementById("toastTransportadora");
    if (!toast) return;

    toast.textContent = mensagem;
    toast.className = "toast-configuracao ativo toast-" + tipo;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
        toast.classList.remove("ativo");
    }, 3500);
}

async function carregarTransportadoras() {
    try {
        const resposta = await fetch(urlApiTransportadoras, { headers: cabecalhosAutenticados() });

        if (!resposta.ok) {
            console.error("Erro ao buscar transportadoras.");
            return;
        }

        transportadoras = await resposta.json();
        renderizarTabelaTransportadoras(transportadoras);
    } catch (erro) {
        console.error("Erro ao carregar transportadoras:", erro.message);
    }
}

function renderizarTabelaTransportadoras(lista) {
    const corpo = document.getElementById("corpoTabelaTransportadoras");
    if (!corpo) return;

    corpo.innerHTML = "";
    transportadorasVisiveis = lista;

    if (lista.length === 0) {
        corpo.innerHTML = '<tr><td colspan="6" class="celula-vazia">Nenhuma transportadora cadastrada.</td></tr>';
        if (exclusaoTransportadoras) exclusaoTransportadoras.aposRender([]);
        return;
    }

    lista.forEach(function (transportadora) {
        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        const seloStatus = transportadora.ativo
            ?'<span class="selo-status selo-ativo">Ativa</span>'
            : '<span class="selo-status selo-inativo">Inativa</span>';

        linha.innerHTML = `
            ${exclusaoTransportadoras ? exclusaoTransportadoras.colunaLinha(transportadora.id) : ""}
            <td>
                <div class="bloco-transportadora">
                    <div class="avatar-transportadora">${criarIconeTransportadoraLista()}</div>
                    <div>
                        <div class="nome-transportadora">${transportadora.nome}</div>
                        <div class="texto-secundario">Criada em ${formatarDataTransportadora(transportadora.data_cadastro)}</div>
                    </div>
                </div>
            </td>
            <td>${transportadora.cnpj || "—"}</td>
            <td>${transportadora.total_admins || 0}</td>
            <td>${seloStatus}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-transportadora.html?id=${transportadora.id}'">${criarIconeVer()}Ver</button>
                    <button class="botao-acao" onclick="window.location.href='editar-transportadora.html?id=${transportadora.id}'">${criarIconeEditar()}Editar</button>
                </div>
            </td>
        `;

        corpo.appendChild(linha);
    });

    if (exclusaoTransportadoras) exclusaoTransportadoras.aposRender(lista);
}

function configurarFormularioTransportadora() {
    const formulario = document.getElementById("formularioTransportadora");
    const botao = document.getElementById("botaoSalvarTransportadora");
    if (!formulario || !botao) return;

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const dados = {
            nomeTransportadora: document.getElementById("campoNomeTransportadora").value.trim(),
            cnpj: document.getElementById("campoCnpjTransportadora").value.trim(),
            nomeUsuario: document.getElementById("campoNomeAdmin").value.trim(),
            emailUsuario: document.getElementById("campoEmailAdmin").value.trim(),
            senhaUsuario: document.getElementById("campoSenhaAdmin").value
        };

        if (!dados.nomeTransportadora || !dados.nomeUsuario || !dados.emailUsuario || !dados.senhaUsuario) {
            exibirToastTransportadora("Preencha todos os campos obrigatórios.", "erro");
            return;
        }

        if (dados.senhaUsuario.length < 8) {
            exibirToastTransportadora("A senha inicial deve ter pelo menos 8 caracteres.", "erro");
            return;
        }

        botao.disabled = true;
        botao.textContent = "Cadastrando...";

        try {
            const resposta = await fetch(urlApiTransportadoras, {
                method: "POST",
                headers: cabecalhosAutenticados(),
                body: JSON.stringify(dados)
            });

            const retorno = await resposta.json();

            if (!resposta.ok) {
                exibirToastTransportadora(retorno.mensagem || "Erro ao cadastrar transportadora.", "erro");
                return;
            }

            exibirToastTransportadora(retorno.mensagem, "sucesso");
            formulario.reset();
            carregarTransportadoras();
        } catch (erro) {
            console.error("Erro ao cadastrar transportadora:", erro.message);
            exibirToastTransportadora("Erro de conexão com o servidor.", "erro");
        } finally {
            botao.disabled = false;
            botao.textContent = "Cadastrar transportadora";
        }
    });
}

function iniciarPaginaTransportadoras() {
    const usuario = exigirAutenticacao();
    if (!usuario) return;
    preencherInfoUsuario();
    configurarBotaoSair();
    marcarItemMenuLateralAtivo();
    configurarExclusaoTransportadoras();
    configurarFormularioTransportadora();
    carregarTransportadoras();
}

function configurarExclusaoTransportadoras() {
    if (!window.AutoAcertoExclusao) return;

    exclusaoTransportadoras = window.AutoAcertoExclusao.criarGerenciadorExclusao({
        urlApi: urlApiTransportadoras,
        seletorTabela: "table",
        seletorLinhas: "[data-selecionar-id]",
        seletorSelecionarTodos: "[data-selecionar-todos-transportadoras]",
        singular: "transportadora",
        plural: "transportadoras",
        renderizarAtual: function () { renderizarTabelaTransportadoras(transportadorasVisiveis); },
        aoExcluir: carregarTransportadoras
    });
}

document.addEventListener("DOMContentLoaded", iniciarPaginaTransportadoras);
