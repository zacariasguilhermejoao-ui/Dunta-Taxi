# DUNTA TAXI — Android GPS em segundo plano

Esta pasta contém a versão Android nativa preparada para manter o motorista online em segundo plano.

## O que foi implementado
- Foreground Service Android para localização contínua do motorista.
- GPS de alta precisão, atualização aproximadamente a cada 10 segundos.
- Envio da localização para `drivers_locations` no Supabase.
- Atualização do token Supabase usando o `refresh_token` quando necessário.
- Verificação periódica de novos `ride_requests`.
- Notificação local de alta prioridade quando chega um novo pedido compatível.
- O motorista pode sair da tela do DUNTA e continuar online enquanto o serviço estiver ativo.
- Ao tocar em Offline, o serviço é encerrado.

## Permissões
No primeiro uso, permita localização e notificações. Em aparelhos que possuem otimização agressiva de bateria, permita que o DUNTA rode sem restrições de bateria.

## Build
Abra a pasta `android` no Android Studio e faça o build do módulo `app`.
O ambiente desta sessão não possui Gradle/Android SDK, portanto o APK/AAB não foi compilado aqui.

## Supabase
O projeto usa o mesmo projeto Supabase já configurado no `index.html`. A tabela `drivers_locations` e as políticas/realtime do `supabase_schema.sql` precisam estar aplicadas.
