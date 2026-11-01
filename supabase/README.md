# Supabase — preparação do Orion

> Esta estrutura é um ponto de partida técnico. A migration ainda precisa ser aplicada e validada em um projeto Supabase de desenvolvimento antes de qualquer uso real.

## Ordem recomendada

1. Crie um projeto Supabase exclusivo para desenvolvimento.
2. No SQL Editor, execute `migrations/202610310001_initial_schema.sql` em um banco vazio.
3. Crie o primeiro usuário administrador em **Authentication → Users** (convite ou criação controlada).
4. Execute o bloco abaixo no SQL Editor, substituindo o e-mail. Não use `raw_user_meta_data` para conceder papel administrativo.
5. Configure as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend. Nunca coloque `service_role` no navegador.
6. Crie testes com contas separadas para associado, financeiro, atividades e administrador geral e valide permissões positivas e negativas.

## Promover o primeiro administrador

```sql
-- Execute somente no SQL Editor, como proprietário do projeto.
-- Substitua pelo e-mail exato do usuário já criado em Supabase Auth.
insert into public.user_roles(user_id, role)
select id, 'admin_general'
from auth.users
where lower(email) = lower('ADMIN_EMAIL@DOMINIO.COM')
on conflict (user_id, role) do nothing;

update public.profiles
set membership_status = 'active', joined_at = coalesce(joined_at, current_date)
where id = (
  select id from auth.users
  where lower(email) = lower('ADMIN_EMAIL@DOMINIO.COM')
);
```

O trigger de cadastro já atribui o papel básico `associado`. O papel administrativo é adicionado separadamente pelo bloco acima. Confirme que o `SELECT` encontrou exatamente um usuário antes de executar em produção.

## Papéis previstos

| Papel | Acesso funcional |
|---|---|
| `admin_general` | Gestão de associados, papéis, configurações, atividades, publicações e visão administrativa. |
| `financeiro` | Consulta de associados necessários à conferência, títulos e comprovantes; revisão de pagamentos. |
| `atividades` | Gestão de séries, ocorrências, inscrições e publicações. |
| `associado` | Consulta de conteúdo publicado, perfil próprio, inscrições próprias, títulos e comprovantes próprios. |

## RPCs e responsabilidades

- `update_own_profile(...)`: atualiza apenas nome e telefone do próprio perfil.
- `generate_monthly_dues(date)`: cria os títulos mensais dos associados ativos com o valor/dia definidos em `club_settings`. Não duplica a competência já existente. Chamável por financeiro/admin ou por uma rotina `service_role` protegida.
- `mark_overdue_dues()`: marca títulos vencidos ainda abertos como `overdue`; deve ser executada diariamente por rotina confiável.
- `generate_activity_occurrences(uuid,date,date)`: materializa os encontros de uma série no intervalo solicitado. Chamar após criar a série e periodicamente para manter a agenda futura. **A reconciliação de ocorrências existentes após editar data, horário ou regra de repetição ainda precisa ser implementada no backend**: ocorrências antigas devem ser canceladas sem apagar histórico/inscrições, e capacidades futuras devem ser sincronizadas.
- `join_activity_occurrence(uuid)` / `leave_activity_occurrence(uuid)`: controlam inscrição e cancelamento individualmente, com bloqueio transacional por encontro.
- `review_payment_submission(uuid,text,text)`: aprova ou rejeita comprovante pendente. A rejeição exige motivo com pelo menos cinco caracteres.

A migration removeu escrita direta do cliente em `activity_signups` e `payment_submissions` após o envio, e não concede `UPDATE` direto de `member_dues`; essas mudanças passam pelas RPCs/triggers e alimentam `audit_logs`.

## Storage

- `payment-proofs`: bucket privado, PDF/JPEG/PNG até 10 MB, com pasta inicial igual ao UUID do associado. Somente o próprio associado e financeiro/admin podem ler comprovantes.
- `club-media`: bucket público para imagens de publicações; upload/alteração/exclusão restritos a admin geral e equipe de atividades.

Não publique documentos pessoais no bucket de mídia. Use URLs assinadas de curta duração para comprovantes quando o frontend estiver conectado.

## Pendências antes de produção

- Aplicar a migration num projeto real e corrigir qualquer diferença de versão/extensão.
- Executar uma matriz de testes RLS incluindo tentativas de ler, inserir, alterar e excluir dados de outro associado.
- Testar concorrência de inscrições simultâneas e múltiplos comprovantes para a mesma cobrança.
- Implementar Edge Functions/cron para `generate_monthly_dues`, `mark_overdue_dues` e geração periódica de ocorrências.
- Implementar onboarding/convites e recuperação de senha pelo Supabase Auth.
- Revisar índices, backups, retenção, observabilidade, política de privacidade e resposta a incidentes.
- Fazer revisão independente das políticas e funções `SECURITY DEFINER`. A migration é uma proposta inicial, não uma certificação de segurança ou LGPD.
