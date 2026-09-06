# DUNTA TAXI — Supabase Push integrado

## O que já foi integrado

- Edge Function `send-ride-push` publicada no projeto Supabase.
- A função usa `drivers_locations` para localizar motoristas online.
- Filtra por tipo de veículo e raio de até 15 km.
- Busca os tokens FCM em `push_tokens`.
- Envia push para motorista quando uma corrida entra como `pending`.
- Envia push ao passageiro quando a corrida é `accepted` ou `completed`.
- Envia push aos envolvidos quando a corrida é `cancelled`.
- Tokens FCM inválidos são desativados.
- JWT obrigatório da função foi desligado porque o disparo vem do webhook do banco; a função usa `DUNTA_WEBHOOK_SECRET` como autenticação própria.
- O trigger do banco `trg_dunta_ride_push` foi criado para `ride_requests`.

## Falta configurar no Supabase

Na área de Secrets da Edge Function, adicionar:

1. `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Deve ser o JSON da Service Account do Firebase que tem permissão para Firebase Cloud Messaging.
   - Nunca coloque esse JSON no HTML, GitHub ou código público.

2. `DUNTA_WEBHOOK_SECRET`
   - Deve ser uma senha aleatória longa.
   - O mesmo valor precisa estar disponível para o webhook/trigger do banco.

O projeto já possui `SUPABASE_URL` e a chave de serviço necessárias para a função.

## Estrutura esperada

- `public.ride_requests`
- `public.drivers_locations`
- `public.push_tokens`
- `public.profiles`

## Importante

O arquivo `google-services.json` do Android não substitui a Service Account privada do Firebase. Ele é configuração do aplicativo Android. Para o envio FCM server-side é necessária uma credencial de servidor guardada somente como Secret no Supabase.
