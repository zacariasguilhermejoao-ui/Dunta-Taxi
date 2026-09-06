# DUNTA TAXI — Checklist de ativação do Push real

Projeto Supabase usado pelo Android:
`https://keonvsakkkzxnxxduacz.supabase.co`

## 1. Secrets

No Supabase Dashboard → Edge Functions → Secrets, criar:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON da Service Account com acesso ao Firebase Cloud Messaging.
- `DUNTA_WEBHOOK_SECRET`: uma string aleatória forte.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` podem ser disponibilizados pelo ambiente da Edge Function; se a instalação exigir, configure-os também como secrets.

## 2. Deploy

```bash
supabase functions deploy send-ride-push --no-verify-jwt
```

## 3. Webhook

Database → Webhooks → Create webhook:

- Table: `public.ride_requests`
- Events: `INSERT`, `UPDATE`
- Method: `POST`
- URL: `https://keonvsakkkzxnxxduacz.supabase.co/functions/v1/send-ride-push`
- Header: `x-dunta-webhook-secret: <mesmo valor de DUNTA_WEBHOOK_SECRET>`
- Header: `Content-Type: application/json`

O payload deve conter `type`, `record` e `old_record`.

## 4. Validar tokens

No SQL Editor:

```sql
select user_id, platform, enabled, updated_at
from public.push_tokens
order by updated_at desc;
```

Deve aparecer o token do Android depois do login.

## 5. Teste ponta a ponta

1. Android do motorista com notificações permitidas.
2. Motorista autenticado e online.
3. Passageiro autenticado em localização próxima.
4. Criar corrida `pending`.
5. Confirmar execução da Edge Function nos logs.
6. Confirmar notificação `Novo pedido DUNTA` no Android.
7. Aceitar a corrida e confirmar `Motorista encontrado` no passageiro.

## Segurança

Nunca colocar Service Account JSON ou `SUPABASE_SERVICE_ROLE_KEY` no APK, `index.html`, Git público ou qualquer ficheiro cliente.
