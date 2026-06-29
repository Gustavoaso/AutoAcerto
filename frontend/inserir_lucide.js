const sistemaArquivos = require('fs');
const caminho = require('path');

const diretorioProjeto = caminho.join(__dirname);

function processarDiretorio(caminhoDiretorio) {
    const arquivos = sistemaArquivos.readdirSync(caminhoDiretorio);
    
    for (const arquivo of arquivos) {
        const caminhoCompleto = caminho.join(caminhoDiretorio, arquivo);
        
        if (sistemaArquivos.statSync(caminhoCompleto).isDirectory()) {
            if (arquivo === 'JavaScript') {
                processarDiretorio(caminhoCompleto);
            }
        } else if (caminhoCompleto.endsWith('.html')) {
            let conteudoHTML = sistemaArquivos.readFileSync(caminhoCompleto, 'utf8');
            let conteudoOriginal = conteudoHTML;

            // Inserir script do Lucide Icons caso ainda não exista
            if (!conteudoHTML.includes('lucide@latest')) {
                if (conteudoHTML.includes('</head>')) {
                    conteudoHTML = conteudoHTML.replace('</head>', '  <script src="https://unpkg.com/lucide@latest"></script>\n</head>');
                }
            }

            if (conteudoHTML !== conteudoOriginal) {
                sistemaArquivos.writeFileSync(caminhoCompleto, conteudoHTML, 'utf8');
                console.log(`Atualizado com sucesso: ${arquivo}`);
            }
        }
    }
}

processarDiretorio(diretorioProjeto);
