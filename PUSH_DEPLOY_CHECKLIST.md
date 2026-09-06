# DUNTA TAXI — Checklist de ativação do Push real

Projeto Supabase usado pelo Android:
`https://keonvsakkkzxnxxduacz.supabase.co`

## Secrets
Criar `FIREBASE_SERVICE_ACCOUNT_JSON` e `DUNTA_WEBHOOK_SECRET`. Nunca colocar Service Account JSON ou `SUPABASE_SERVICE_ROLE_KEY` no APK, index.html ou Git público.

## Deploy
```bash
supabase functions deploy send-ride-push --no-verify-jwt
```

## Webhook
Table: `public.ride_requests`; Events: `INSERT`, `UPDATE`; Method: `POST`; URL da função; header `x-dunta-webhook-secret` com o mesmo valor de `DUNTA_WEBHOOK_SECRET`.

## Validar tokens
```sql
select user_id, platform, enabled, updated_at from public.push_tokens order by updated_at desc;
```

## Teste ponta a ponta
Android do motorista com notificações permitidas, motorista online, passageiro próximo, criar corrida `pending`, verificar Edge Function e notificação nativa, aceitar e confirmar aviso no passageiro.