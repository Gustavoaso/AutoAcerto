const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname); // frontend directory

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            // Ignore subdirectories for now, all 26 htmls seem to be in frontend/
            continue;
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Substituir o conteudo do aside
            const asideRegex = /<aside class="barra-lateral">([\s\S]*?)<\/aside>/i;
            if (asideRegex.test(content)) {
                content = content.replace(asideRegex, '<aside class="barra-lateral"></aside>');
                modified = true;
            }

            // Inserir os scripts se não existirem
            if (!content.includes('navbar.js')) {
                const scriptsHtml = `
  <script src="/JavaScript/utils/navbar.js"></script>
  <script src="/JavaScript/utils/formatar.js"></script>
  <script src="/JavaScript/config.js"></script>`;
                
                // Procurar por <script src="/JavaScript/config.js"></script> para substituir e incluir os novos
                if (content.includes('<script src="/JavaScript/config.js"></script>')) {
                     content = content.replace('<script src="/JavaScript/config.js"></script>', scriptsHtml.trim());
                } else if (content.includes('</body>')) {
                     content = content.replace('</body>', scriptsHtml + '\n</body>');
                }
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${file}`);
            }
        }
    }
}

processDirectory(directoryPath);
