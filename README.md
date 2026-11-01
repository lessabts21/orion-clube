# Orion Clube — protótipo evolutivo V0.3.2

Aplicação web mobile-first em React + TypeScript + Vite, preparada para evoluir para Android/iOS com Capacitor e backend Supabase.

## O que foi ampliado na V0.3.2

- Dados principais persistem após atualizar a página, usando `localStorage` do navegador.
- Cadastro de associados com nome, e-mail, telefone e situação; pesquisa, edição e ativação/desativação (sem criar credencial Supabase).
- Perfil do associado com edição local de nome, e-mail e telefone.
- Atividades únicas ou recorrentes (diária, semanal, quinzenal ou mensal), com intervalo, data final, categoria, horário, local e capacidade definida ou ilimitada; séries próprias podem ser editadas/removidas.
- Calendário mensal alimentado pelo cadastro de atividades e com navegação entre meses.
- A agenda do associado desdobra recorrências em encontros individuais futuros; inscrição/cancelamento demonstrativos são persistidos por ocorrência, cada encontro com sua própria capacidade.
- Publicações no feed com categoria, imagem, pré-visualização, persistência local e opção de remover na área administrativa.
- Área financeira do associado com situação da competência atual, histórico de comprovantes e retorno de rejeição; envio PDF/JPG/PNG até 10 MB. O arquivo passa a ser salvo em IndexedDB local e pode ser reaberto após recarregar a página. A fila administrativa recebe o envio e permite aprovação/rejeição com motivo obrigatório.
- Configuração local de valor, dia de vencimento e chave PIX; o associado vê a chave e pode copiá-la. A tela financeira administrativa mostra o quadro de situação mensal por associado (visão derivada da demonstração).
- Trilha de auditoria local de ações administrativas e financeiras.
- Menus administrativos diferentes para administrador geral, financeiro e responsável por atividades.
- Migration Supabase em `supabase/migrations/202610310001_initial_schema.sql`, com RLS, papéis, séries/ocorrências, inscrições, feed, títulos financeiros, comprovantes, storage, auditoria e RPCs transacionais. Inclui geração de mensalidades, marcação de vencidas, inscrições e revisão financeira.
- Contrato inicial para integração de arquivos compartilhados em `src/lib/share-intent.ts`.
- Matriz requisito por requisito em `docs/requirements-matrix.md`, instruções de provisionamento inicial em `supabase/README.md` e decisão técnica do Share Sheet em `docs/native-share-sheet.md`.

## Roteiro para demonstrar o fluxo completo

1. Comece como **Associado**. Abra **Atividades** e faça uma inscrição; confira a quantidade de vagas e depois veja a mesma inscrição refletida na visão administrativa local.
2. Troque para **Responsável por atividades** ou **Administrador geral**. Em **Calendário**, crie uma atividade única ou recorrente, configure o intervalo e escolha um número de vagas ou “Sem limite de inscritos”. Em **Notícias e atividades**, também é possível editar/remover séries próprias.
3. Ainda como equipe, crie uma publicação com imagem, abra a prévia e publique. Volte ao perfil **Associado** e consulte a publicação no **Feed**.
4. Como **Associado**, abra **Financeiro** e envie um comprovante PDF/JPG/PNG. O arquivo fica no IndexedDB local. Mude para **Responsável financeiro**, abra a fila, visualize o arquivo e aprove ou rejeite (com justificativa). Volte ao associado para conferir o status e eventual motivo da rejeição.
5. Como **Administrador geral**, abra **Associados** para pesquisar, cadastrar, editar e ativar/desativar membros. Em **Configurações**, ajuste valor, vencimento e chave PIX; volte ao financeiro do associado para ver os dados.

Os dados iniciais são demonstrativos. Apenas o perfil local simulado participa das inscrições no navegador; as contagens iniciais também incluem números fictícios de exemplo. As linhas de comprovantes pré-carregadas não têm arquivos anexados — para testar “Ver arquivo”, envie um comprovante novo pelo perfil associado.

## Limites importantes

**Esta versão ainda é um protótipo local, não uma implantação conectada.** `localStorage` e IndexedDB não sincronizam usuários ou dispositivos, não implementam autenticação ou controle de acesso e não devem receber dados reais de associados nem comprovantes reais. Os comprovantes novos são mantidos em IndexedDB deste navegador para demonstrar a persistência do arquivo, mas isso não equivale a armazenamento privado de servidor.

A migration Supabase foi criada, mas **não foi aplicada nem testada** em um projeto. A autenticação, Storage privado, políticas RLS, notificações e sincronização em tempo real não estão conectados ao frontend. As RPCs para gerar cobranças e ocorrências existem no SQL, mas ainda precisam de Edge Functions/cron e integração no cliente. A migration é uma base inicial que ainda exige revisão e testes de segurança antes de produção.

O recebimento de comprovantes pelo menu nativo “Compartilhar” também não está ativado: exige plugin/ponte Capacitor, configuração de intents Android e Share Extension/App Group no iOS, além de testes em aparelhos. O contrato está em `src/lib/share-intent.ts`; a análise de compatibilidade e o plano estão em `docs/native-share-sheet.md`.

O seletor “Visualizar como” permite simular os papéis na demonstração e **não representa autorização**. A autorização real deve ser aplicada no servidor, nunca confiada ao frontend.

## Identidade oficial do clube

O site oficial localizado é [crorion.com.br](https://crorion.com.br/). Ele identifica a entidade como Clube Recreativo Orion, apresenta o endereço na Av. Brasil, 146, Monte Castelo, São José dos Campos, e informa a fundação em 3 de fevereiro de 1956. Não foi localizado, nesta etapa, um arquivo isolado do logotipo com qualidade e origem verificáveis; por isso o “O” estilizado da interface continua provisório e não deve ser tratado como marca oficial.

## Executar localmente

Requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev
```

## Publicar uma demonstração na internet (GitHub Pages)

Esta cópia inclui o workflow `.github/workflows/deploy.yml` e o comando `npm run build:pages`. Crie um repositório **público** chamado `orion-clube`, envie todos os arquivos (incluindo `.github`) para a branch `main`, e em **Settings → Pages → Build and deployment → Source** selecione **GitHub Actions**. O workflow fará o build e publicará o site automaticamente. O endereço será `https://SEU-USUARIO.github.io/orion-clube/`.

O passo a passo e os limites desta demonstração estão em [`docs/GITHUB_PAGES.md`](docs/GITHUB_PAGES.md). Importante: o site publicado é público; não use dados reais de associados ou comprovantes. Cada visitante terá dados locais próprios, sem sincronização, pois o Supabase ainda não está conectado.

## Build web

```bash
npm run build
npm run preview
```

## Capacitor

Depois de instalar dependências:

```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android
npx cap open ios
```

Android exige Android Studio e SDK. iOS exige macOS e Xcode. Os projetos nativos ainda não foram gerados/compilados nesta entrega.

## Supabase

1. Criar projeto Supabase de desenvolvimento.
2. Revisar e aplicar a migration em `supabase/migrations/202610310001_initial_schema.sql`.
3. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` conforme `.env.example`; nunca inserir `service_role` no cliente.
4. Conectar frontend com Supabase Auth, tabelas e Storage.
5. Testar RLS com pelo menos duas contas por perfil e cenários de acesso negado.
6. Implementar Edge Functions/cron para cobranças mensais, geração de ocorrências e envio de notificações.

### Modelos de recorrência e financeiro

Uma `activity_series` guarda a regra de repetição e `activity_occurrences` representa cada encontro real. As inscrições são vinculadas à ocorrência, permitindo que cada encontro tenha seu próprio limite. A função `generate_activity_occurrences(...)` materializa uma janela de datas; `join_activity_occurrence(...)` trava a ocorrência e verifica capacidade antes de confirmar, reduzindo o risco de excesso de inscrições simultâneas.

No financeiro, `member_dues` representa uma cobrança por associado e competência. `generate_monthly_dues(...)` cria as mensalidades dos associados ativos de forma idempotente; `mark_overdue_dues()` atualiza cobranças vencidas. A revisão de comprovantes é realizada por `review_payment_submission(...)`, e os triggers ajustam a situação do título e registram auditoria. Consulte `supabase/README.md` para provisionamento e operação.

## LGPD e segurança

Antes de produção, o clube precisa definir finalidade e base legal para cada dado, transparência e consentimento quando cabíveis, minimização, prazo de retenção, canal para solicitações dos titulares, processo de exclusão/retificação, controle de acessos, backups e resposta a incidentes. Comprovantes devem ficar em bucket privado, com acesso próprio e URLs assinadas de curta duração. A existência de RLS não significa, isoladamente, conformidade LGPD.

## Verificação realizada nesta entrega

- A sintaxe TSX/TypeScript foi verificada com o transpiler do TypeScript; foi feita também uma checagem tipada parcial com declarações temporárias de ambiente. Isso não substitui a compilação com as dependências reais.
- Testes rápidos da expansão de recorrência passaram para frequências diária, semanal, quinzenal e mensal, incluindo o caso de início no dia 31.
- `npm run build` foi tentado, mas não pôde completar porque `react`, `lucide-react` e os tipos de React não estão instalados no ambiente; a instalação de dependências não conseguiu acessar o registry nesta sessão.
- A migration SQL não foi executada contra um banco Supabase nesta sessão; não há credenciais de projeto disponíveis.

## Estrutura

```text
orion-v0.3.2/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── lib/share-intent.ts
├── supabase/
│   ├── migrations/202610310001_initial_schema.sql
│   └── README.md
├── docs/
│   ├── requirements-matrix.md
│   └── native-share-sheet.md
├── .env.example
├── capacitor.config.ts
├── package.json
└── README.md
```
