# DUNTA TAXI — Push nativo real via Firebase Cloud Messaging

A aplicação Android já obtém e grava o token FCM em `public.push_tokens`. Esta etapa acrescenta o envio servidor → FCM → Android.

## Edge Function
A função está em `supabase/functions/send-ride-push/index.ts`.

Ela recebe eventos de `ride_requests`, procura motoristas online num raio de 15 km compatíveis com o veículo, envia FCM de alta prioridade e desativa tokens inválidos.

## Secrets no Supabase
Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` e `DUNTA_WEBHOOK_SECRET`.

`FIREBASE_SERVICE_ACCOUNT_JSON` deve ser a chave privada de uma Service Account do Firebase/Google Cloud. Não use o `google-services.json` do Android como credencial do servidor.

## Deploy
```bash
supabase functions deploy send-ride-push --no-verify-jwt
```

## Database Webhook
Tabela `public.ride_requests`, eventos `INSERT` e `UPDATE`, método `POST`, URL da Edge Function e header `x-dunta-webhook-secret`.

## Segurança
Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` ou `FIREBASE_SERVICE_ACCOUNT_JSON` no `index.html`, APK ou qualquer ficheiro público.