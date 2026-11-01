# Orion — matriz de requisitos e estado da entrega

Esta matriz distingue o que já funciona no protótipo local do que depende de backend, configuração externa ou implementação nativa.

| Área | Requisito | Estado V0.3.2 | Observações / próximo trabalho |
|---|---|---|---|
| Perfis | Associado, administrador geral, financeiro e atividades | Demonstração funcional | Seletor de perfil é apenas simulador; a autorização real será no Supabase Auth + RLS. |
| Permissões | Menus diferentes por papel | Parcial no protótipo | Financeiro vê painel e validação; atividades vê agenda/conteúdo; admin geral vê todas as áreas. Não é segurança de backend. |
| Associados | Pesquisar, cadastrar, editar e ativar/desativar membros | Funciona localmente | Cadastro ainda não cria usuário/convite no Auth. Exclusão definitiva não é oferecida na interface; deve seguir política de retenção e LGPD. |
| Perfil | Editar nome, e-mail e telefone | Funciona localmente | Ainda não altera `auth.users` nem executa validação de e-mail. |
| Atividades | Criar, editar e remover atividade esporádica ou série própria | Funciona localmente | Inclui título, descrição, categoria, data, horário, local e capacidade opcional; edição e remoção estão na área administrativa de notícias e atividades. |
| Recorrência | Diária, semanal, quinzenal e mensal; intervalo e data final | Funciona no calendário e agenda do associado | Agenda do associado desdobra encontros futuros em IDs locais individuais; banco separa série e ocorrência. Produção precisa Edge Function/cron para materializar ocorrências e uma rotina de reconciliação segura ao editar séries já materializadas. |
| Capacidade | Limite numérico ou “Sem limite de inscritos” | Funciona como demonstração | No produto final a capacidade é por ocorrência, com confirmação transacional pelo RPC incluído na migration. |
| Inscrições | Associado inscreve/cancela e vê vagas; administração acompanha ocupação | Funciona localmente por ocorrência | A visão administrativa exibe a inscrição do perfil simulado e os números-base fictícios; cada encontro recorrente recebe chave própria e limite independente. Não há concorrência real entre usuários; produção usa RPC transacional com bloqueio de linha. Lista de espera avançada e políticas de cancelamento não estão incluídas. |
| Calendário | Visão mensal administrativa e navegação por mês | Funciona | Recorrências aparecem nos dias calculados; edição é feita pela lista administrativa, não por arrastar/soltar no calendário. |
| Notícias | Publicar notícia/comunicado com imagem e prévia | Funciona localmente | Imagens pequenas em Data URL no navegador; no produto final devem ir para Storage público de mídia com validação no servidor. |
| Feed | Timeline de posts em ordem cronológica | Funciona localmente | Compartilhamento usa a API do dispositivo quando disponível; comentários, reações e feed em tempo real não incluídos. |
| Financeiro | Envio de comprovante PIX/transferência | Funciona localmente | PDF/JPG/PNG até 10 MB; o arquivo é salvo em IndexedDB e reaberto após refresh. Ainda não é Storage privado nem sincroniza entre usuários. |
| Financeiro | Aprovar ou rejeitar com justificativa | Funciona localmente | Aprova/rejeita com motivo e auditoria local; atualização do título financeiro real depende da RPC Supabase. |
| Financeiro | Mensalidade e vencimento configuráveis | Funciona localmente | Valor, vencimento e chave PIX configuráveis; associado vê e pode copiar a chave. A tela financeira lista situação por associado derivada dos comprovantes da competência. A migration inclui RPC para criar títulos mensais e função para vencidos, mas ainda requer cron/Edge Function. |
| Auditoria | Histórico de ações administrativas/financeiras | Parcial funcional | Log local no protótipo; migration contém tabela e auditoria server-side para mudanças de comprovante. |
| Persistência | Não perder alterações ao atualizar o navegador | Funciona localmente | Usa `localStorage`; não sincroniza dispositivos e não é adequado para dados pessoais ou documentos reais. |
| Supabase | Schema, papéis, tabelas e RLS | Migration inicial criada | Inclui RLS, RPCs para cobrança mensal, vencidos, recorrência, inscrição/cancelamento e revisão financeira; sem aplicação/teste num projeto Supabase. |
| Mobile | Preparação React + Capacitor | Base existente | Ainda não foram gerados/compilados projetos Android e iOS nesta sessão. |
| Share Sheet | Receber comprovante via Compartilhar do Android/iOS | Não implementado | Existe contrato/adaptador de referência; falta instalar plugin compatível, configurar intents Android e Share Extension iOS e testar aparelhos reais. |
| LGPD | Privacidade, retenção, direitos do titular e incidentes | Checklist documentado | Não declarar conformidade. Exige decisões do clube, processos, controles técnicos e revisão jurídica. |
| Marca | Usar identidade visual oficial | Parcial | Site oficial localizado; não foi encontrado um arquivo de logotipo isolado e verificável para incorporar. O símbolo “O” continua provisório. |

## Critério de aceite para próxima versão integrada

1. Criar projeto Supabase e aplicar a migration em ambiente de teste.
2. Implementar login, recuperação de senha, convite de associado e vínculo seguro entre Auth e perfil.
3. Executar testes negativos de RLS com contas distintas (associado, financeiro, atividades, admin geral).
4. Implementar Storage privado de comprovantes e Storage de mídia, validação de tipo/tamanho e URLs assinadas.
5. Gerar ocorrências recorrentes de forma programada; testar limites concorrentes em duas contas.
6. Executar build web; gerar APK/AAB e build iOS; testar compartilhamento nativo em dispositivos.
7. Aprovar a política de privacidade, retenção e processo de atendimento aos titulares antes de uso real.
