# DUNTA TAXI — Push nativo real via Firebase Cloud Messaging

A aplicação Android já obtém e grava o token FCM em `public.push_tokens`. Esta etapa acrescenta o envio **servidor → FCM → Android**.

## 1. Edge Function

A função está em:

`supabase/functions/send-ride-push/index.ts`

Ela:
- recebe o evento de `ride_requests`;
- no INSERT de uma corrida pendente procura motoristas online num raio de 15 km e compatíveis com o tipo de veículo;
- envia FCM de alta prioridade em formato data-only, para que o serviço nativo controle o canal e a notificação;
- no UPDATE envia ao passageiro avisos de aceite, conclusão ou cancelamento;
- desativa tokens FCM inválidos/desregistados.

## 2. Secrets no Supabase

No projeto Supabase, configure estes secrets para a Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `DUNTA_WEBHOOK_SECRET`

`FIREBASE_SERVICE_ACCOUNT_JSON` deve ser a **chave privada de uma Service Account do Firebase/Google Cloud**, em JSON. Não use o `google-services.json` do Android como credencial do servidor.

## 3. Deploy

Com Supabase CLI autenticado:

```bash
supabase functions deploy send-ride-push --no-verify-jwt
```

A função usa `DUNTA_WEBHOOK_SECRET` para proteger a entrada do webhook.

## 4. Database Webhook

No Supabase Dashboard:

**Database → Webhooks → Create webhook**

Crie um webhook para:

- tabela: `public.ride_requests`
- eventos: `INSERT` e `UPDATE`
- método: `POST`
- URL: `https://SEU-PROJETO.supabase.co/functions/v1/send-ride-push`
- header: `x-dunta-webhook-secret: VALOR_DO_DUNTA_WEBHOOK_SECRET`
- `Content-Type: application/json`

O payload precisa manter `record`, `old_record` e o tipo do evento. O formato normal do webhook do Supabase já é compatível com a função.

## 5. Teste

1. Instale o APK Android.
2. Faça login como motorista.
3. Confirme que aparece uma linha em `push_tokens` para o utilizador.
4. Deixe o motorista online.
5. Faça um pedido como passageiro dentro do raio de 15 km.
6. O Android deve receber uma notificação nativa mesmo com o DUNTA fora do primeiro plano.

## Segurança

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` ou `FIREBASE_SERVICE_ACCOUNT_JSON` no `index.html`, APK ou qualquer ficheiro público. O `google-services.json` é configuração do cliente Android; a Service Account é segredo do servidor.
