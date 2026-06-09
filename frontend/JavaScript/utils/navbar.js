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
        const paginaAtual = caminhoAtual.substring(caminhoAtual.lastIndexOf('/') + 1) || 'index.html';

        function verificarAtivo(pagina) {
            return paginaAtual === pagina ? ' ativo' : '';
        }

        const menuHtml = `
            <div class="icone-logo">
                <img src="/Imagens/logo nova.png" alt="" class="imagem-logo">
                <span class="texto-logo"><span class="texto-logo-auto">Auto</span><span class="texto-logo-acerto">Acerto</span></span>
            </div>
            <nav class="menu-lateral">
                <a href="index.html" class="item-menu${verificarAtivo('index.html')}">
                    <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Dashboard
                </a>
                <a href="motoristas.html" class="item-menu${verificarAtivo('motoristas.html')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    Motoristas
                </a>
                <a href="veiculos.html" class="item-menu${verificarAtivo('veiculos.html')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M10 17h4V5H2v12h3" />
                        <path d="M14 8h4l4 4v5h-3" />
                        <circle cx="7.5" cy="17.5" r="2.5" />
                        <circle cx="16.5" cy="17.5" r="2.5" />
                    </svg>
                    Veículos
                </a>
                <a href="viagens.html" class="item-menu${verificarAtivo('viagens.html')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z" />
                        <circle cx="12" cy="9" r="2.5" />
                    </svg>
                    Viagens
                </a>
                <a href="despesas.html" class="item-menu${verificarAtivo('despesas.html')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M4 7h16v12H4z" />
                        <path d="M16 7V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" />
                        <path d="M8 13h8" />
                    </svg>
                    Despesas
                </a>
                <a href="relatorios.html" class="item-menu${verificarAtivo('relatorios.html')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M3 17l6-6 4 4 8-8" />
                        <path d="M14 7h7v7" />
                    </svg>
                    Relatórios
                </a>
                <a href="transportadoras.html" class="item-menu${verificarAtivo('transportadoras.html')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M4 19V5h16v14" />
                        <path d="M8 9h8M8 13h8M8 17h4" />
                    </svg>
                    Transportadoras
                </a>
                <a href="configuracoes.html" class="item-menu${verificarAtivo('configuracoes.html')}">
                    <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V22a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                    </svg>
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
    }

    // Injetar logo no carregamento do DOM
    document.addEventListener('DOMContentLoaded', function () {
        garantirFavicon();
        injetarMenuLateral();
    });
})();
