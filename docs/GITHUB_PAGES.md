# Publicar o Orion no GitHub Pages

Esta cópia está preparada para um repositório chamado **`orion-clube`**. O build de publicação usa `/orion-clube/` como caminho-base; os builds locais e do Capacitor continuam usando `/`. Se mudar o nome do repositório, ajuste `base` em `vite.config.ts` e o caminho em `package.json`/documentação conforme necessário.

## Publicação pelo navegador (sem instalar Git)

1. Extraia o ZIP do Orion em uma pasta do computador.
2. No GitHub, crie um repositório novo chamado `orion-clube`.
3. Para usar GitHub Free com GitHub Pages, deixe o repositório **Public**. Não use dados reais de associados, senhas ou comprovantes nesta demonstração.
4. No repositório, use **Add file → Upload files** e envie o conteúdo da pasta extraída (incluindo a pasta oculta `.github`). Faça o commit na branch `main`.
5. Abra **Settings → Pages** e, em **Build and deployment → Source**, selecione **GitHub Actions**.
6. Abra a aba **Actions**. O workflow `Deploy Orion to GitHub Pages` deve executar automaticamente após o commit. Aguarde a execução ficar verde.
7. Volte a **Settings → Pages** e abra **Visit site**. O endereço será `https://SEU-USUARIO.github.io/orion-clube/`.

## Atualizar o site

Depois de alterar arquivos e enviar um novo commit para `main`, o GitHub Actions executará o build e publicará a versão atualizada automaticamente.

## O que esta publicação demonstra — e o que não demonstra

- O site é uma demonstração pública da interface. Qualquer pessoa que tenha o endereço pode acessá-lo.
- Os dados ficam no navegador de cada visitante (`localStorage`/IndexedDB). Não existe compartilhamento ou sincronização entre os computadores do grupo.
- O seletor de perfil administrativo/associado é apenas uma simulação visual, sem login nem autorização real.
- Não cadastre dados pessoais reais, não envie comprovantes reais e não coloque chaves ou segredos em arquivos do repositório.
- O frontend ainda não está conectado ao Supabase. A publicação no Pages não cria backend, autenticação ou banco de dados.

## Se o workflow falhar

Abra **Actions**, selecione a execução em vermelho e consulte o primeiro passo com erro. O build roda `npm install` e `npm run build:pages`; um erro TypeScript/dependência precisa ser corrigido antes da publicação.
