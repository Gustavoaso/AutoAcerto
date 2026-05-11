// =============================================================
// AUTOACERTO — CONFIGURAÇÃO GLOBAL (Vercel + Produção)
// =============================================================

(function () {
    "use strict";

    /**
     * Retorna a URL base da API respeitando prioridades
     * 1. Variável global (Vercel / Produção)
     * 2. Meta tag no HTML
     * 3. localStorage (teste rápido)
     * 4. window.location.origin (desenvolvimento local)
     */
    function obterApiBase() {
        // Prioridade 1: Definida via Vercel (Environment Variable)
        if (window.AUTOACERTO_API_BASE_URL && String(window.AUTOACERTO_API_BASE_URL).trim()) {
            return String(window.AUTOACERTO_API_BASE_URL).trim().replace(/\/+$/, "");
        }

        // Prioridade 2: Meta tag no <head> da página
        const metaApi = document.querySelector('meta[name="autoacerto-api-base"]');
        if (metaApi && metaApi.getAttribute("content")) {
            return metaApi.getAttribute("content").trim().replace(/\/+$/, "");
        }

        // Prioridade 3: Salvo no localStorage (útil para testes)
        const salva = localStorage.getItem("AUTOACERTO_API_BASE_URL");
        if (salva && String(salva).trim()) {
            return String(salva).trim().replace(/\/+$/, "");
        }

        // Prioridade 4: Fallback para desenvolvimento local
        return window.location.origin.replace(/\/+$/, "");
    }

    /**
     * Função principal usada em TODO o sistema
     * Substitui todas as implementações anteriores de montarUrlApi
     */
    window.montarUrlApi = function (endpoint) {
        const base = obterApiBase();
        const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
        return base + path;
    };

    // Expõe também a função base caso precise em algum lugar específico
    window.obterApiBase = obterApiBase;

    // Log informativo (útil para debug)
    console.log(
        "%c✅ AutoAcerto Config carregado → API Base: " + obterApiBase(),
        "color: #10b981; font-weight: 600;"
    );
})();