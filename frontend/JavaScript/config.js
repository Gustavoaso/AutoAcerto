// =============================================================
// AUTOACERTO - CONFIGURACAO GLOBAL
// =============================================================

(function () {
    "use strict";

    function obterApiBase() {
        if (window.AUTOACERTO_API_BASE_URL && String(window.AUTOACERTO_API_BASE_URL).trim()) {
            return String(window.AUTOACERTO_API_BASE_URL).trim();
        } 
        else{ return window.location.origin;}
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
