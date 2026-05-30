// =============================================================
// AUTOACERTO - UI HELPERS
// Utilitários para melhorar a experiência do usuário
// =============================================================

(function() {
    'use strict';

    // =============================================================
    // TOAST NOTIFICATIONS
    // =============================================================
    
    const AutoAcertoToast = {
        container: null,
        
        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
        },
        
        show(mensagem, tipo = 'info', duracao = 4000) {
            this.init();
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${tipo} fade-in`;
            
            const icone = this.getIcone(tipo);
            
            toast.innerHTML = `
                <div class="toast-icon">${icone}</div>
                <div class="toast-content">
                    <div class="toast-message">${mensagem}</div>
                </div>
                <button class="toast-close" onclick="this.parentElement.remove()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            
            this.container.appendChild(toast);
            
            if (duracao > 0) {
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(400px)';
                    setTimeout(() => toast.remove(), 300);
                }, duracao);
            }
            
            return toast;
        },
        
        getIcone(tipo) {
            const icones = {
                success: '<svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
                error: '<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
                warning: '<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                info: '<svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
            };
            return icones[tipo] || icones.info;
        },
        
        success(mensagem, duracao) {
            return this.show(mensagem, 'success', duracao);
        },
        
        error(mensagem, duracao) {
            return this.show(mensagem, 'error', duracao);
        },
        
        warning(mensagem, duracao) {
            return this.show(mensagem, 'warning', duracao);
        },
        
        info(mensagem, duracao) {
            return this.show(mensagem, 'info', duracao);
        }
    };
    
    // =============================================================
    // VALIDAÇÃO DE FORMULÁRIOS
    // =============================================================
    
    const AutoAcertoValidacao = {
        
        validarCampo(input) {
            const valor = input.value.trim();
            const tipo = input.type;
            const obrigatorio = input.hasAttribute('required');
            
            // Limpar mensagens anteriores
            this.limparErro(input);
            
            // Campo obrigatório vazio
            if (obrigatorio && !valor) {
                this.mostrarErro(input, 'Este campo é obrigatório');
                return false;
            }
            
            // Validações específicas por tipo
            if (valor) {
                if (tipo === 'email' && !this.validarEmail(valor)) {
                    this.mostrarErro(input, 'Email inválido');
                    return false;
                }
                
                if (input.name === 'cpf' && !this.validarCPF(valor)) {
                    this.mostrarErro(input, 'CPF inválido');
                    return false;
                }
                
                if (input.name === 'cnpj' && !this.validarCNPJ(valor)) {
                    this.mostrarErro(input, 'CNPJ inválido');
                    return false;
                }
                
                const minLength = input.getAttribute('minlength');
                if (minLength && valor.length < parseInt(minLength)) {
                    this.mostrarErro(input, `Mínimo de ${minLength} caracteres`);
                    return false;
                }
            }
            
            // Campo válido
            input.classList.remove('campo-erro');
            input.classList.add('campo-sucesso');
            return true;
        },
        
        mostrarErro(input, mensagem) {
            input.classList.add('campo-erro');
            input.classList.remove('campo-sucesso');
            
            let mensagemErro = input.parentElement.querySelector('.mensagem-erro');
            if (!mensagemErro) {
                mensagemErro = document.createElement('div');
                mensagemErro.className = 'mensagem-erro';
                input.parentElement.appendChild(mensagemErro);
            }
            
            mensagemErro.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                ${mensagem}
            `;
        },
        
        limparErro(input) {
            input.classList.remove('campo-erro', 'campo-sucesso');
            const mensagemErro = input.parentElement.querySelector('.mensagem-erro');
            if (mensagemErro) {
                mensagemErro.remove();
            }
        },
        
        validarEmail(email) {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(email);
        },
        
        validarCPF(cpf) {
            cpf = cpf.replace(/[^\d]/g, '');
            if (cpf.length !== 11) return false;
            if (/^(\d)\1{10}$/.test(cpf)) return false;
            
            let soma = 0;
            for (let i = 0; i < 9; i++) {
                soma += parseInt(cpf.charAt(i)) * (10 - i);
            }
            let resto = 11 - (soma % 11);
            let digito1 = resto >= 10 ? 0 : resto;
            
            if (digito1 !== parseInt(cpf.charAt(9))) return false;
            
            soma = 0;
            for (let i = 0; i < 10; i++) {
                soma += parseInt(cpf.charAt(i)) * (11 - i);
            }
            resto = 11 - (soma % 11);
            let digito2 = resto >= 10 ? 0 : resto;
            
            return digito2 === parseInt(cpf.charAt(10));
        },
        
        validarCNPJ(cnpj) {
            cnpj = cnpj.replace(/[^\d]/g, '');
            if (cnpj.length !== 14) return false;
            if (/^(\d)\1{13}$/.test(cnpj)) return false;
            
            let tamanho = cnpj.length - 2;
            let numeros = cnpj.substring(0, tamanho);
            let digitos = cnpj.substring(tamanho);
            let soma = 0;
            let pos = tamanho - 7;
            
            for (let i = tamanho; i >= 1; i--) {
                soma += numeros.charAt(tamanho - i) * pos--;
                if (pos < 2) pos = 9;
            }
            
            let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
            if (resultado != digitos.charAt(0)) return false;
            
            tamanho = tamanho + 1;
            numeros = cnpj.substring(0, tamanho);
            soma = 0;
            pos = tamanho - 7;
            
            for (let i = tamanho; i >= 1; i--) {
                soma += numeros.charAt(tamanho - i) * pos--;
                if (pos < 2) pos = 9;
            }
            
            resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
            return resultado == digitos.charAt(1);
        },
        
        validarFormulario(form) {
            const inputs = form.querySelectorAll('input, textarea, select');
            let valido = true;
            
            inputs.forEach(input => {
                if (!this.validarCampo(input)) {
                    valido = false;
                }
            });
            
            return valido;
        }
    };
    
    // =============================================================
    // CONFIRMAÇÃO DE AÇÕES
    // =============================================================
    
    const AutoAcertoConfirm = {
        
        show(titulo, mensagem, onConfirm, onCancel) {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay fade-in';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            const modal = document.createElement('div');
            modal.className = 'modal-conteudo slide-in-right';
            modal.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            `;
            
            modal.innerHTML = `
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #111827;">${titulo}</h3>
                <p style="margin: 0 0 24px 0; color: #6b7280; line-height: 1.6;">${mensagem}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancelar" style="padding: 10px 20px; border: 1px solid #e5e7eb; background: white; color: #6b7280; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        Cancelar
                    </button>
                    <button class="btn-confirmar" style="padding: 10px 20px; border: none; background: #dc2626; color: white; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        Confirmar
                    </button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const fechar = () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 200);
            };
            
            modal.querySelector('.btn-cancelar').onclick = () => {
                fechar();
                if (onCancel) onCancel();
            };
            
            modal.querySelector('.btn-confirmar').onclick = () => {
                fechar();
                if (onConfirm) onConfirm();
            };
            
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    fechar();
                    if (onCancel) onCancel();
                }
            };
        }
    };
    
    // =============================================================
    // DEBOUNCE (para pesquisas)
    // =============================================================
    
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // =============================================================
    // EXPORTAR PARA WINDOW
    // =============================================================
    
    window.AutoAcertoToast = AutoAcertoToast;
    window.AutoAcertoValidacao = AutoAcertoValidacao;
    window.AutoAcertoConfirm = AutoAcertoConfirm;
    window.debounce = debounce;
    
    console.log('%cAutoAcerto UI Helpers carregado', 'color: #10b981; font-weight: 600;');
    
})();
