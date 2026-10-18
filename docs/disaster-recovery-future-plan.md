# Plano Futuro de Recuperacao Operacional

Data: 2026-08-23

## Estado atual

A etapa atual entrega contrato local, testes em memoria, UI local de preview/download e restore dry-run. Ela nao implementa backup gerenciado em nuvem, restore real no cliente, Cloud Functions, Admin SDK, deploy ou execucao contra Firebase real.

## Proximas etapas recomendadas

1. Criar runner com Firebase Emulator para exportar/restaurar massa sintetica por usuario.
2. Ampliar a UI local com cenarios visuais emulados para arquivos grandes, conflito multiplo e troca simultanea de usuario.
3. Criar backend confiavel para restore real com Admin SDK, logs server-side e permissao administrativa explicita.
4. Definir retencao, criptografia em repouso, rotacao e armazenamento externo.
5. Criar runbook de incidente com validacao de checksum, restauracao parcial e aprovacao manual.
6. Medir restore com base grande e registrar limites de tamanho.

## Guardrails

- Nunca restaurar diretamente de arquivo sem `ValidateFinanceBackupSnapshot`.
- Nunca sobrescrever conflito automaticamente.
- Nunca usar backup para burlar `accountStatus`, owner, role ou Rules.
- Nunca incluir telefone/WhatsApp como chave de autoridade.
- Nunca misturar auditoria/receipts com dados financeiros restauraveis.
