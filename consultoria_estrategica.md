# Consultoria Estratégica SaaS: AutoAcerto (Foco: Parceiros SADA / Cegonheiros)

> [!NOTE]
> Este documento apresenta uma análise profunda do AutoAcerto direcionada exclusivamente para transportadoras e frotistas que possuem "vaga na SADA". O modelo de negócio do **Cegonheiro** tem dinâmicas únicas (cargas de alto valor, tabela de frete pré-definida, risco altíssimo de avarias) que exigem um software altamente especializado.

## 0. O Cenário Atual (Dores do Parceiro SADA)

Ter uma vaga na SADA garante demanda, mas exige um rigor operacional brutal. 

**Quais são as maiores dores hoje?**
- **Avarias nos veículos transportados:** Um simples arranhão ao carregar/descarregar um carro zero km pode engolir o lucro da viagem inteira. A disputa de quem causou a avaria (montadora, motorista ou concessionária) é constante.
- **Manutenção específica (e cara):** Diferente de um baú normal, a cegonha tem pranchas móveis, sistemas hidráulicos, cabos e dezenas de cintas de amarração que desgastam rápido.
- **Tempo de pátio e filas:** O caminhão perde dias aguardando carregamento nos pátios da SADA/Montadoras. Esse tempo ocioso destrói a rentabilidade mensal.
- **Dificuldade de cruzar o acerto com a tabela SADA:** O frete é pago pela SADA com base em tabelas e regras estritas. Se a transportadora não tiver controle absoluto do que gastou vs. o que a SADA vai pagar, ela roda no escuro.

**O que faria o dono pensar: "Esse sistema se paga sozinho"?**
O sistema precisa provar que **evitou o pagamento de uma avaria injusta** ou que **identificou um custo oculto na manutenção da cegonha**. Se o AutoAcerto salvar o transportador de pagar R$ 3.000 por um arranhão que já estava no carro antes de carregar, o sistema estará pago por mais de um ano.

---

## 1. Novas Funcionalidades (Específicas para Cegonheiros)

- **Vistoria Digital de Carga (Checklist Anti-Avaria):** Uma interface mobile onde o motorista, ao carregar a cegonha, fotografa cada veículo (Laterais, Teto, Rodas) e marca avarias pré-existentes em um "carrinho virtual" na tela. Isso gera um laudo PDF com geolocalização e data/hora. É a prova definitiva contra cobranças indevidas de avaria.
- **Auditoria de Tabela SADA (Conciliação):** Um módulo onde o gestor insere o valor que a SADA depositou no mês, e o sistema cruza automaticamente com as viagens realizadas para encontrar divergências ("glosas" ou valores não pagos).
- **Controle de Insumos de Amarração (Cintas e Catracas):** Uma cegonha usa dezenas de cintas. Elas sumirem ou arrebentarem é um custo constante. O sistema deve rastrear quando cada motorista recebeu um kit novo e descontar no acerto em caso de perda irresponsável.
- **Gestão de Manutenção Hidráulica e Estrutural:** Controle específico não só do cavalo mecânico, mas da carreta (lubrificação de pranchas, pistões hidráulicos, cabos de aço).

---

## 2. KPIs e Dashboards (Visão do Cegonheiro)

O dashboard precisa refletir o dia a dia de quem puxa carro zero.

> [!IMPORTANT]
> A margem no transporte de veículos é estreita e sensível ao tempo. O foco é eficiência e mitigação de riscos.

**KPIs Críticos Sugeridos:**
*   **Índice de Avarias por Motorista:** Qual motorista gera mais desconto no frete por danificar veículos?
*   **Tempo de Fila/Pátio (Lead Time):** Quantos dias o caminhão ficou parado aguardando carga na SADA vs. Dias rodando.
*   **Rentabilidade por Rota (Ex: Betim-MG -> Suape-PE):** A tabela dessa rota paga a conta do diesel e pedágio dessa viagem específica? 
*   **Vida Útil de Cintas e Pneus da Carreta:** As carretas rebaixadas (cegonha) gastam pneus menores de forma mais agressiva. O controle de CPK (Custo por Km) do pneu da carreta é vital.
*   **Glosas SADA:** Percentual do faturamento retido pela SADA por problemas de documentação ou SLA.

---

## 3. Integrações de Alto Impacto

*   **EDI SADA (Se disponível):**
    *   *Por que:* O Santo Graal. Se o AutoAcerto conseguir ler os arquivos EDI ou PDFs de romaneios da SADA para criar as viagens e os carros transportados (chassis) automaticamente, o dono da frota assina o sistema no mesmo dia.
*   **Sem Parar / ConectCar:**
    *   *Por que:* Cegonhas pagam tarifas de pedágio altas (eixos multiplicados). Importar a fatura automaticamente evita fraudes onde o motorista desvia da rota ou tenta superfaturar o vale-pedágio.
*   **APIs de Seguradoras e Gerenciadoras de Risco (Buonny, Pamcary):**
    *   *Por que:* O transporte de carros zero km tem altíssimo risco de roubo e incêndio. Integrar com o rastreador para garantir que o caminhão parou apenas em "Postos Homologados" evita perda de cobertura do seguro.

---

## 4. Diferenciais Competitivos

Como fazer o cliente dizer: *"Finalmente um sistema que entende o meu negócio!"*?

- **Posicionamento de Nicho:** A maioria dos TMS (Sistemas de Transporte) são genéricos para "Carga Seca". O AutoAcerto será vendido como **"O Sistema do Cegonheiro"**. Toda a linguagem visual e textual deve falar a língua dele (Chassi, Prancha, Vaga, Avaria, Romaneio).
- **Relatório Automático de Defesa de Avaria:** Com um clique, o sistema compila o histórico de um chassi específico (fotos do carregamento, hora, local) e formata um e-mail pronto para enviar à seguradora ou à SADA refutando a culpa da transportadora.

---

## 5. Recursos Baseados em IA (Inteligência Artificial)

> [!TIP]
> A IA aqui deve atuar principalmente como um inspetor de qualidade e otimizador financeiro.

- **Detecção de Avarias por IA (Computer Vision):** O motorista tira a foto do carro zero km e a IA aponta: *"Possível arranhão no para-choque detectado"*, obrigando o motorista a registrar no romaneio antes de sair do pátio.
- **Leitura Inteligente de Romaneios (OCR):** O usuário faz o upload da folha de romaneio da SADA e a IA extrai automaticamente os 11 chassis transportados, Origem, Destino e motorista designado.
- **Predição de Desgaste (Manutenção):** *"Com base na quilometragem e na rota (muita serra), os freios da carreta e do cavalo devem ser revisados nas próximas duas viagens."*

---

## 6. Oportunidades de Monetização (Cross-sell / Upsell)

1.  **Venda de Kits de Amarração/Peças:** Parcerias com fornecedores de cintas, catracas e óleo hidráulico dentro da plataforma. O cliente compra pelo AutoAcerto com desconto.
2.  **Antecipação de Recebíveis SADA:** Como a SADA tem prazos de pagamento estendidos, integrar um fundo (FIDC) no AutoAcerto para o cegonheiro antecipar o frete a uma taxa de juros, dividindo o lucro com você.
3.  **Seguro de Carga / RC (Responsabilidade Civil) Embutido:** Corretoras adorariam acessar uma base de cegonheiros com baixo índice de avaria.

---

## 7. Funcionalidades "Uau"

- **Visualizador 3D de Carga (Plano de Carga):** Uma interface interativa (arrastar e soltar) onde o gestor planeja qual carro (ex: Toro, Strada, Argo) vai em qual posição (berço) da prancha da cegonha, otimizando o peso e facilitando a ordem de descarga na rota.
- **Aviso Automático para Concessionária:** Quando a viagem inicia, o AutoAcerto manda um WhatsApp automático para a concessionária destino: *"A Cegonha placa ABC-1234 com 3 veículos da sua loja acaba de sair da fábrica e tem previsão de chegada amanhã às 14h."* (A SADA adora esse nível de serviço).

---

## 8. Análise de Mercado (Nicho)

**Concorrentes:** A maioria dos cegonheiros usa Excel ou sistemas antigos e pesados que não conversam com o motorista.
*   **O que falta neles:** Mobilidade na pista. O problema da cegonha acontece na hora de carregar e amarrar o carro no pátio, sob sol e chuva. Se o motorista não tiver um PWA (app) rápido para bater fotos e lançar despesas, a informação chega corrompida no escritório dias depois.
*   **Onde existe oportunidade:** Ser o sistema mais fácil para o motorista cegonheiro usar no pátio e o mais rápido para o dono no escritório fechar a conta do frete vs. desconto de combustível/avarias.

---

## 9. Roadmap de Produto (Priorização SADA)

### Fase 1: MVP (Curto Prazo - Estancar Sangramento)
- **Vistoria Digital de Avaria (App do Motorista):** O essencial para evitar descontos injustos.
- Lançamento de Viagem com foco em preenchimento rápido (Placa, Rota, Valor SADA, Custo Combustível).
- Fechamento de Acerto de Motorista digital.

### Fase 2: Alta Prioridade (Médio Prazo)
- Leitura de PDFs/Romaneios SADA por OCR para criação automática de viagens.
- Controle rigoroso de estoque de cintas e catracas por caminhão.
- Gestão de Pneus focada nas medidas de cegonha.

### Fase 3: Visão de Futuro (Média/Baixa Prioridade)
- Simulador 3D de arrumação de carga na prancha.
- Antecipação de Recebíveis e integração bancária.
- Detecção de riscos por IA nas fotos dos carros.

---

## 10. Análise de ROI (Retorno sobre o Investimento)

| Funcionalidade | Problema Resolvido | Benefício para a Transportadora | Impacto / ROI para o Cliente |
| :--- | :--- | :--- | :--- |
| **Vistoria Digital (Fotos + GPS)** | Desconto no frete por avaria que a transportadora não causou. | Isenção de culpa na entrega. | **Alto.** Evitar uma única avaria de R$ 2.000 já paga o sistema por 1 ano. Retenção garantida. |
| **OCR de Romaneio SADA** | Digitação chata e demorada de chassis e rotas. | Ganho de produtividade no escritório. | **Tempo é dinheiro.** O que demorava 20 min agora leva 10 segundos. |
| **Controle de Cintas/Catracas** | Motorista perde ou vende cintas e o dono repõe sem cobrar. | Responsabilização no acerto. | Redução direta de custo de insumos, aumentando o lucro da viagem. |
| **Dashboard de Rentabilidade da Rota** | "Rodar por rodar" sem saber se a tabela da SADA cobre o diesel. | Identifica rotas "podres" para renegociar ou recusar. | Traz visibilidade cirúrgica. Se uma rota dá R$ 500 de prejuízo, o gestor atua imediatamente. |

> [!CAUTION]
> **Conclusão:** O mercado de cegonheiros é uma irmandade. Eles conversam muito nos pátios das montadoras. Se o AutoAcerto se provar excelente para um parceiro SADA (provando que acabou com descontos injustos de avarias e organizou os acertos), o boca-a-boca trará dezenas de clientes com custo de aquisição zero. O foco **não é ser um sistema de logística genérico**, é ser a ferramenta definitiva de quem puxa carro.
