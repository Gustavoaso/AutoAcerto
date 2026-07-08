(function () {
    "use strict";

    function garantirFavicon() {
        const hrefFavicon = "/Imagens/logo nova.png";
        let linkFavicon = document.querySelector("link[rel='icon']");

        if (!linkFavicon) {
            linkFavicon = document.createElement("link");
            linkFavicon.rel = "icon";
            document.head.appendChild(linkFavicon);
        }

        linkFavicon.type = "image/png";
        linkFavicon.href = hrefFavicon;
    }

    function injetarMenuLateral() {
        const aside = document.querySelector('aside.barra-lateral');
        if (!aside) return;
        
        // Obter o caminho atual para destacar a página ativa
        const caminhoAtual = window.location.pathname;
        let paginaAtual = caminhoAtual.split('/').pop().split('?')[0].split('#')[0];
        
        if (!paginaAtual || paginaAtual === "" || paginaAtual === "/") {
            paginaAtual = 'dashboard.html';
        }
        
        // Garante que a comparação funcione mesmo se o servidor ocultar o .html da URL
        if (!paginaAtual.endsWith('.html')) {
            paginaAtual += '.html';
        }

        function verificarAtivo(pagina) {
            return paginaAtual === pagina ? ' ativo' : '';
        }

        const menuHtml = `
            <div class="icone-logo">
                <img src="/Imagens/logo nova.png" alt="" class="imagem-logo">
                <span class="texto-logo"><span class="texto-logo-auto">Auto</span><span class="texto-logo-acerto">Acerto</span></span>
            </div>
            <nav class="menu-lateral">
                <a href="dashboard.html" class="item-menu${verificarAtivo('dashboard.html')}">
                    <i data-lucide="layout-dashboard"></i>
                    Dashboard
                </a>
                <a href="motoristas.html" class="item-menu${verificarAtivo('motoristas.html')}">
                    <i data-lucide="users"></i>
                    Motoristas
                </a>
                <a href="veiculos.html" class="item-menu${verificarAtivo('veiculos.html')}">
                    <i data-lucide="truck"></i>
                    Veículos
                </a>
                <a href="viagens.html" class="item-menu${verificarAtivo('viagens.html')}">
                    <i data-lucide="map-pin"></i>
                    Viagens
                </a>
                <a href="despesas.html" class="item-menu${verificarAtivo('despesas.html')}">
                    <i data-lucide="receipt"></i>
                    Despesas
                </a>
                <a href="relatorios.html" class="item-menu${verificarAtivo('relatorios.html')}">
                    <i data-lucide="bar-chart-2"></i>
                    Relatórios
                </a>
                <a href="transportadoras.html" class="item-menu${verificarAtivo('transportadoras.html')}" data-apenas-dono>
                    <i data-lucide="briefcase"></i>
                    Transportadoras
                </a>
                <a href="configuracoes.html" class="item-menu${verificarAtivo('configuracoes.html')}">
                    <i data-lucide="settings"></i>
                    Configurações
                </a>
            </nav>
            <div class="rodape-barra">
                <div class="cartao-plano-lateral">
                    <strong id="nomePlanoLateral">Carregando plano...</strong>
                    <span id="resumoPlanoLateral">Seu plano atual</span>
                    <button type="button" id="botaoGerenciarAssinatura">Gerenciar assinatura</button>
                </div>
                <button class="botao-sair">Sair</button>
            </div>
        `;

        // Substituir todo o conteúdo do aside pelo menu injetado
        aside.innerHTML = menuHtml;

        // Adicionar listener ao botão sair recém-injetado
        const botaoSair = aside.querySelector('.botao-sair');
        if (botaoSair && window.encerrarSessao) {
            botaoSair.addEventListener('click', window.encerrarSessao);
        }

        // Renderizar ícones do Lucide de forma robusta
        function renderizarIcones() {
            if (window.lucide) {
                window.lucide.createIcons();
            } else {
                setTimeout(renderizarIcones, 50);
            }
        }
        renderizarIcones();
    }

    // Injetar logo no carregamento do DOM
    document.addEventListener('DOMContentLoaded', function () {
        garantirFavicon();
        injetarMenuLateral();

        // Fechar filtros expansíveis ao clicar fora
        document.addEventListener("click", function(evento) {
            const clicouDentroFiltro = evento.target.closest(".grupo-filtro-segmentado") || evento.target.closest(".grupo-periodo-relatorio");
            
            if (!clicouDentroFiltro) {
                document.querySelectorAll(".botao-toggle-filtro, .botao-toggle-periodo").forEach(function(botaoToggle) {
                    if (botaoToggle.getAttribute("aria-expanded") === "true") {
                        botaoToggle.setAttribute("aria-expanded", "false");
                        const idControles = botaoToggle.getAttribute("aria-controls");
                        if (idControles) {
                            const containerOpcoes = document.getElementById(idControles);
                            if (containerOpcoes) {
                                containerOpcoes.classList.add("filtro-segmentado-fechado", "filtro-periodo-fechado");
                            }
                        }
                    }
                });
            }
        });
    });
})();
