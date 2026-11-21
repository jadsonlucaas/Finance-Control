# Rollback Supabase → Firebase

Firebase permanece íntegro e disponível durante a janela de segurança. Antes de dual-write, rollback é troca do provider para Firebase. Depois de qualquer escrita exclusiva em Supabase, rollback exige delta reconciliado e auditado; sem isso, writes paralelos são proibidos.

Gatilhos: falha RLS, diferença de owner, parity <100%, divergência monetária, Auth inválida ou erro crítico sem telemetria. Congelar writes, preservar checkpoints, voltar provider, executar smoke e reconciliar antes de reabrir.

Nunca excluir Firebase imediatamente após cutover. Retenção mínima proposta: 30 dias após paridade e encerramento formal.
