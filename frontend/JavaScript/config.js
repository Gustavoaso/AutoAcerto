// =============================================================
// AUTOACERTO - CONFIGURACAO GLOBAL
// =============================================================

(function () {
    "use strict";

    // Substitua esta URL pela base do seu backend Railway em produção.
    const API_BASE_URL= "https://autoacerto-production-4174.up.railway.app";

    function obterApiBase() {
        return API_BASE_URL;
    }

    window.montarUrlApi = function (endpoint) {
        const base = obterApiBase();
        const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
        return base + path;
    };

    window.obterApiBase = obterApiBase;
    window.obterApiBaseUrl = obterApiBase;

    console.log(
        "%cAutoAcerto Config carregado -> API Base: " + obterApiBase(),
        "color: #10b981; font-weight: 600;"
    );
})();
