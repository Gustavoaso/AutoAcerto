(function () {
    "use strict";

    // Formatador de Moeda (BRL)
    function formatarMoeda(valor) {
        if (valor === undefined || valor === null || isNaN(valor)) return "R$ 0,00";
        return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Formatador de Data (DD/MM/YYYY)
    function formatarData(dataIso) {
        if (!dataIso) return "-";
        try {
            const data = new Date(dataIso);
            // Ajustar o timezone offset se for string (YYYY-MM-DD)
            if (dataIso.length === 10) {
                data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
            }
            return data.toLocaleDateString('pt-BR');
        } catch (e) {
            return dataIso;
        }
    }

    // Formatador de Data/Hora (DD/MM/YYYY HH:MM)
    function formatarDataHora(dataIso) {
        if (!dataIso) return "-";
        try {
            const data = new Date(dataIso);
            return data.toLocaleString('pt-BR');
        } catch (e) {
            return dataIso;
        }
    }

    // Helpers para formatação de status de diversas entidades
    function corStatus(status) {
        const mapa = {
            'ativo': '#10b981',
            'inativo': '#ef4444',
            'em andamento': '#3b82f6',
            'em viagem': '#f59e0b',
            'finalizada': '#10b981',
            'cancelada': '#ef4444',
            'manutencao': '#f59e0b',
            'manutenção': '#f59e0b'
        };
        return mapa[String(status).toLowerCase()] || '#6b7280';
    }

    function formatarStatus(status) {
        if (!status) return '-';
        const str = String(status);
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function renderizarBadgeStatus(status) {
        const cor = corStatus(status);
        const texto = formatarStatus(status);
        return `<span style="background-color: ${cor}15; color: ${cor}; padding: 4px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: inline-block;">${texto}</span>`;
    }

    // Tornar funções acessíveis globalmente
    window.formatarMoeda = formatarMoeda;
    window.formatarData = formatarData;
    window.formatarDataHora = formatarDataHora;
    window.renderizarBadgeStatus = renderizarBadgeStatus;
    window.formatarStatus = formatarStatus;

})();
