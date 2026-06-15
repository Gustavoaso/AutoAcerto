# Varredura do Banco de Dados - AutoAcerto

Data da varredura: 2026-06-11

## Escopo

Esta varredura foi feita a partir do schema definido em `backend/banco.js` e dos usos encontrados no backend/frontend. O Postgres real nao foi consultado porque nao ha `DATABASE_URL` configurada neste shell.

Tambem existe um arquivo `backend/banco.db` no projeto. Ele tem assinatura `SQLite format 3`, mas o backend atual usa PostgreSQL via `pg.Pool` e nao referencia esse arquivo em nenhum lugar do codigo. Ele parece ser legado/residuo.

## Onde ficam os assinantes

Os assinantes ficam na tabela `assinaturas`.

Principais campos:

- `transportadora_id`: empresa assinante.
- `plano_codigo` e `plano_nome`: plano local.
- `gateway`: hoje usado como `stripe`.
- `gateway_assinatura_id`: ID da subscription na Stripe, geralmente `sub_...`.
- `stripe_customer_id`: ID do cliente na Stripe.
- `status`: status da assinatura vindo da Stripe, como `active`, `past_due`, `canceled`.
- `valor`: valor do plano no sistema.
- `proxima_cobranca_em`: fim do periodo/ciclo atual.
- `cancel_at_period_end`: cancelamento agendado para o fim do ciclo.
- `pagamento_pendente_em`, `bloqueada_em`, `cancelada_em`: datas operacionais do AutoAcerto.

A tabela `assinaturas_pendentes` guarda o processo antes/de durante o checkout e provisionamento.

## Query para ver assinantes ativos

```sql
SELECT
  a.id,
  t.nome AS transportadora,
  t.cnpj,
  a.plano_nome,
  a.status,
  a.valor,
  a.gateway_assinatura_id AS stripe_subscription_id,
  a.stripe_customer_id,
  a.proxima_cobranca_em,
  a.cancel_at_period_end,
  a.data_atualizacao
FROM assinaturas a
JOIN transportadoras t ON t.id = a.transportadora_id
WHERE a.status IN ('active', 'trialing')
ORDER BY a.data_atualizacao DESC;
```

## Query para ver tudo relacionado a assinaturas

```sql
SELECT
  t.id AS transportadora_id,
  t.nome AS transportadora,
  a.plano_nome,
  a.status,
  a.valor,
  a.gateway_assinatura_id,
  a.stripe_customer_id,
  a.proxima_cobranca_em,
  a.cancel_at_period_end,
  a.pagamento_pendente_em,
  a.bloqueada_em,
  a.cancelada_em,
  a.data_atualizacao
FROM transportadoras t
LEFT JOIN LATERAL (
  SELECT *
  FROM assinaturas a
  WHERE a.transportadora_id = t.id
  ORDER BY a.data_atualizacao DESC, a.id DESC
  LIMIT 1
) a ON TRUE
ORDER BY t.id DESC;
```

## Pontos corrigidos nesta varredura

1. A tela/API de Transportadoras agora expõe a última assinatura local de cada transportadora.
2. A página de detalhes da transportadora agora mostra plano, status, próxima cobrança e ID da assinatura Stripe.
3. O frontend de despesas lia/enviava `observacoes`, mas a tabela/rota não persistiam esse campo. Foi adicionada a coluna `despesas.observacoes` e suporte nas rotas.

## Campos/tabelas que parecem fazer sentido manter

- `assinaturas`: necessário para aplicar regras de acesso no AutoAcerto sem depender de consultar a Stripe a cada request.
- `assinaturas_pendentes`: necessário para checkout, provisionamento e reenvio/diagnóstico do e-mail de boas-vindas.
- `ultimo_payload` em assinaturas: útil para auditoria/debug de eventos Stripe. Pode crescer, mas ajuda muito em suporte.
- `notificacoes`: usada pelo topo do sistema e por eventos como despesa/viagem.
- `recuperacao_senha`: usada para tokens temporários de reset.

## Pontos que parecem legado ou merecem limpeza futura

1. `backend/banco.db`
   - Arquivo SQLite antigo.
   - Nao é usado pelo backend atual.
   - Recomendação: remover apenas depois de confirmar que não há dados históricos necessários.

2. `mercado_pago_preapproval_id`
   - Campo de legado do Mercado Pago.
   - O fluxo atual está em Stripe.
   - Recomendação: manter por enquanto se existe chance de migração/histórico; remover em uma migração planejada se a Stripe for definitiva.

3. `gateway` com default `mercado_pago`
   - Hoje o fluxo novo usa `stripe`, mas o default ainda é `mercado_pago`.
   - Recomendação: mudar o default para `stripe` em uma migration futura se Mercado Pago não voltar.

4. `limiteVeiculos` nos planos
   - O bloqueio por limite foi removido conforme regra atual.
   - Ainda aparece como informação comercial em `/assinaturas/public/planos` e na tela de assinatura.
   - Recomendação: manter se for só texto comercial; remover se você não quiser comunicar limite nenhum.

## Observações importantes

- Se `assinaturas` estiver vazia no banco real, o motivo mais provável é webhook Stripe não chegando ou checkout não concluído/provisionado.
- A assinatura ativa só é gravada quando `registrarAssinaturaAtiva` roda, normalmente via `checkout.session.completed`, `customer.subscription.created` ou `customer.subscription.updated`.
- Para validar o webhook, confira se a Stripe está apontando para `/assinaturas/stripe/webhook` e se `STRIPE_WEBHOOK_SECRET` está configurado no backend.
