# Validação do backup Firebase

Executar fora do repositório:

```text
npm run backup:production:verify -- --backup-dir <diretorio-absoluto-externo>
```

O manifest deve registrar project ID, data, arquivos, contagens e SHA-256. O verificador falha em arquivo ausente, JSONL inválido, ID duplicado, contagem divergente ou checksum inválido e não imprime payloads.

Critérios adicionais manuais/automatizados:

- Auth users = 6 e metadados/hash parameters preservados em artefato criptografado separado;
- document paths, timestamps Firestore e typed values preservados;
- owner UID preservado sem remapeamento;
- contagens iguais ao snapshot de origem;
- Rules/indexes e hashes arquivados como metadata;
- restore somente em staging/projeto temporário/Supabase sandbox;
- validação funcional de registros, parcelas, recorrências, horas, settings, auditoria e referências.

Estado atual em 31/10/2026: **BACKUP BLOCKED** por `RESOURCE_EXHAUSTED` durante
o inventário application-level. Cobertura Firestore, export Auth, criptografia,
cópia secundária, restore isolado e parity não foram declarados nem prosseguidos.
A tentativa bloqueada não produziu dump. P5 permanece bloqueado até
`BACKUP VERIFIED` e `RESTORE VERIFIED`.
