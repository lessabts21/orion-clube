# Recebimento de comprovantes pelo menu Compartilhar (Android/iOS)

## Estado

O frontend mantém um contrato em `src/lib/share-intent.ts`, mas o recebimento nativo **ainda não está implementado**. Um `<input type="file">` no navegador não equivale a registrar o app como destino no Share Sheet do Android ou na folha de compartilhamento do iOS.

## Caminho técnico avaliado

Foi avaliado o plugin open-source `@capgo/capacitor-share-target`:

- Projeto: https://github.com/Cap-go/capacitor-share-target
- O plugin documenta recepção de texto/arquivos e evento `shareReceived`.
- Android exige filtros de intent para `SEND` e `SEND_MULTIPLE` e os MIME types aceitos.
- iOS exige um target de Share Extension, App Group compartilhado com o app principal e configuração de entrega/armazenamento dos anexos.
- O projeto atual usa Capacitor 7. A documentação do plugin sinaliza suporte da linha v7 sob manutenção “on demand”; a linha v8 é voltada a Capacitor 8. Não se deve instalar a major v8 neste projeto sem antes atualizar Capacitor.

Antes de fixar uma versão, confira a compatibilidade da release específica do plugin com o Capacitor instalado. A configuração iOS também depende do Bundle ID e App Group definitivos do clube e de macOS/Xcode; por isso esses artefatos nativos não podem ser gerados/testados neste ambiente.

## Fluxo de implementação recomendado

1. Confirmar o identificador final do app e a versão-alvo do Capacitor.
2. Fixar uma versão compatível do plugin e sincronizar Capacitor.
3. Configurar no Android filtros de compartilhamento para PDF, JPEG e PNG; aceitar `SEND` e `SEND_MULTIPLE` sem assumir que a URI terá permissões permanentes.
4. Criar iOS Share Extension e App Group. Copiar o anexo para armazenamento do grupo e transferir referência segura ao app principal.
5. Adaptar `shareReceived` para a interface `ShareIntentBridge`, validar nome, MIME, tamanho (máx. 10 MB) e URI, depois copiar o conteúdo para o fluxo de upload do comprovante.
6. Nunca confiar em nome/MIME informados pelo app externo: validar conteúdo no backend/Storage e limitar o tamanho também no servidor.
7. Abrir a tela de envio com o arquivo já selecionado, mas exigir que o associado confirme a competência antes de enviar.
8. Testar com Android e iOS reais, incluindo app fechado, execução em segundo plano, múltiplos arquivos, arquivo grande, MIME incorreto, URI expirada e cancelamento.

## Decisão desta versão

Não foi adicionada dependência nativa especulativa nem declarado suporte de Share Sheet. Falta escolher/fixar a release compatível, gerar os projetos Android/iOS, configurar intent filters/Share Extension e testar em dispositivos físicos.
