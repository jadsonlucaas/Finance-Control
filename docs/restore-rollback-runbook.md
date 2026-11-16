# Restauração e rollback (stack atual)

Etapa 5, item 7. Este runbook vale para a stack de hoje:

- **Dashboard:** na Vercel.
- **whatsapp-api:** no Portainer, com imagem do GHCR.
- **n8n:** no Portainer.
- **Firebase:** Auth + Firestore, plano Blaze.

Ele substitui a parte operacional de `production-rollback.md` e `staging-rollback-rehearsal.md`, que foram escritos para Firebase Hosting.

Cada peça volta sozinha. Uma não reverte a outra. Volte só o que mudou e anote horário e versão.

## Quadro

| Peça | Como voltar | Tempo | Dado é afetado? |
| --- | --- | --- | --- |
| Dashboard (Vercel) | Vercel → projeto `finance-control` → Deployments → deploy anterior → **Instant Rollback** | 1 min | Não |
| whatsapp-api | Portainer → stack `financecontrol_whatsapp_api_dev` → trocar `:latest` por `:sha-<commit anterior>` → Update (com Re-pull) | 2 min | Não |
| n8n (um workflow) | Workflow → histórico de versões → publicar a versão anterior (cada mudança registra o rollback na memória do projeto) | 1 min | Não |
| Regras do Firestore | Console → Firestore → Regras → histórico → versão anterior → Publicar | 1 min | Não |
| Índices do Firestore | Console → Índices (criar/remover); o repo guarda `firestore.indexes.json` | minutos | Não |
| Variável da stack (ex.: limite diário) | Portainer → editar a variável → Update | 1 min | Não |
| **Dados do Firestore** | Recuperação de desastres (PITR/backup) → restaurar **num banco novo** e copiar o necessário | 30–60 min | **Sim** |

### whatsapp-api: achar a imagem anterior

Cada merge na `main` gera `ghcr.io/jadsonlucaas/finance-control-whatsapp-api:sha-<commit do merge>`.

Para achar o commit anterior:

1. Abra GitHub → Actions → "whatsapp-api image".
2. Pegue o commit do penúltimo build verde, ou o do merge anterior na `main`.

Volte para `:latest` só depois de corrigir a falha na `main`.

### Ordem quando várias peças mudaram juntas

1. Se a mudança alterou o formato dos dados, volte primeiro a peça que **lê** (API e Dashboard) e só depois as regras.
2. Regras novas que exigem um campo novo voltam **depois** do código que grava esse campo.

## Dados: backup e restauração

Até 16/11/2026 não havia backup do banco no servidor. O "backup" do Dashboard (Configurações) gera um arquivo por usuário, e a restauração pelo app só **simula** (dry-run), por política.

Configuração em uso desde 16/11/2026 (plano Blaze):

1. **PITR (point-in-time recovery):**
   - Onde: Console → Firestore → Recuperação de desastres.
   - Guarda 7 dias de histórico, com recuperação ao minuto.
2. **Backup diário agendado:**
   - Onde: mesma tela → Backups programados → lápis. Marque só **Diário** (o Semanal sem dia escolhido trava o Salvar).
   - Retenção: 14 dias.
   - Equivalente por linha de comando:

   ```
   gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d
   ```

O custo é de centavos por mês para o tamanho atual do banco. O orçamento de R$ 25 continua avisando.

### Restaurar sem tocar na produção

1. Restaurar o backup (ou o PITR) num banco novo, por exemplo `restore-teste`. Nunca sobrescrever o `(default)`.
2. No console, abrir `restore-teste` → Dados e conferir:
   - quantidade de `users`;
   - os `finance_records` de uma conta de teste (ex.: test@gmail.com), comparando com o Dashboard;
   - `billing_subscriptions` e `whatsapp_links`.
3. Se for incidente real: copiar só os documentos perdidos para o `(default)`, com aprovação explícita, e registrar o que foi copiado.
4. Apagar o `restore-teste` depois. Ele também é cobrado.

## Ensaio (fazer uma vez agora e a cada 3 meses)

| # | Ensaio | Esperado | Volta |
| --- | --- | --- | --- |
| 1 | Restaurar o backup de ontem em `restore-teste` e conferir os itens acima | Contagens iguais às da produção de ontem | Apagar `restore-teste` |
| 2 | whatsapp-api: Update com `:sha-<commit anterior>` | WhatsApp responde (sem a função mais nova) | Update com `:latest` |
| 3 | n8n principal: publicar a versão anterior e depois a atual | WhatsApp responde nas duas | Publicar a atual |
| 4 | Vercel: Instant Rollback para o deploy anterior | app.financecontrol.tech abre e loga | Promover o deploy atual |
| 5 | Regras: abrir o histórico e localizar a versão anterior (não publicar) | Versão e data visíveis | — |

Registrar data, quem fez, o tempo de cada passo e o que deu errado.

## Registro dos ensaios

### 16/11/2026 (Jadson; horários de Manaus, UTC-4)

| # | O que foi feito | Resultado | Tempo |
| --- | --- | --- | --- |
| — | PITR ligado (versão mais antiga 16/11 12:02) e backup diário com retenção de 14 dias, sem semanal (13:19) | OK | ~5 min |
| 2 | whatsapp-api: imagem `:sha-4bc86325…` (#120) às 13:11, depois `:latest` às 13:14 | WhatsApp respondeu nas duas | ~3 min |
| 3 | n8n principal: publicada 3d819256 às 13:19, depois 64211711 às 13:21 | WhatsApp respondeu nas duas | ~2 min |
| 4 | Vercel: Instant Rollback para `fd02752` (#122) às 13:28, depois Promote de `154312f` (#124) às 13:30 | app.financecontrol.tech abriu logado nas duas | ~2 min |
| 1 | Restaurar o primeiro backup em `restore-teste` | pendente: o primeiro backup sai em até 24 h | — |

Aprendizados:

- O backup semanal marcado sem dia trava o botão Salvar. Deixe só o diário.
- Na Vercel, o rollback troca os dois domínios (`app.financecontrol.tech` e `finance-control-new.vercel.app`). O Promote do deploy mais novo desfaz o rollback.
- Na volta para `:latest`, o Portainer precisa de Re-pull. Sem ele, o serviço segue na imagem da tag fixa.

## O que os testes automatizados já cobrem

- **Backup e restauração por usuário (casos de uso):** `tests/application/backup/financeBackupUseCases.test.js`, com 76 testes. Cobrem:
  - checksum;
  - validação;
  - conflito sem sobrescrever;
  - repetição sem duplicar;
  - rollback do restore;
  - isolamento entre contas.
- **Backup no navegador com emulador:** `tests/playwright/integration-local-backup-restore.spec.js`.
- **Retomada após queda na API** (recibo e evento Stripe em andamento): `tests/services/whatsappApi/recovery.test.js`.
- **Indisponibilidade:** veja `docs/outage-runbook.md`.
