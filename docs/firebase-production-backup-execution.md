# Execução do backup Firebase production

Data: 31/10/2026

## Tentativa application-level sem billing

O caminho sem billing usa Firebase Admin SDK somente em Node, com a ADC oficial
do Firebase CLI fora do repositório. O projeto fica fixado em
`finance-control-cce4f`, exige confirmação explícita de leitura e não contém
operações de escrita.

A primeira tentativa de inventário recursivo foi interrompida antes de concluir
a passagem 1 quando o Firestore retornou `RESOURCE_EXHAUSTED`. Nenhum dump foi
emitido e nenhum dado de produção foi alterado. Como cobertura e reconciliação
temporal em duas passagens não foram concluídas, o resultado é **BACKUP BLOCKED**.

O exportador foi limitado à profundidade documentada pelo repositório (coleções
raiz e subcoleções diretas), com concorrência controlada. A retomada requer uma
janela de quota disponível e duas passagens completas consecutivas idênticas.

## Resultado

**NO BILLING ACTION WILL BE USED**

**BACKUP BLOCKED BEFORE FIRST CLOUD MUTATION**

Nenhum billing, bucket, export, restore, Rules, indexes, Hosting, Auth provider ou dado foi alterado.

## Fase 0 — evidências sanitizadas

| Item | Evidência |
| --- | --- |
| Conta Google | autenticada e confirmada; email omitido do Git |
| Project ID | `finance-control-cce4f` |
| Project number | `1050867234579` |
| Project lifecycle | `ACTIVE` |
| Firestore database | `(default)`, `FIRESTORE_NATIVE` |
| Firestore region | `southamerica-east1` |
| Baseline sanitizada | 6 users; 4.965 finance records; 17.350 audit logs; 18 local storage; 22 categories; 3 macros; 5 legacy; 6 Auth users |
| Billing inicial | desabilitado |
| Billing accounts abertas/acessíveis | 0 |
| Buckets GCS existentes | 0 |
| Rules SHA-256 | `BDC1F8D8B5D3FFCF399483BF72A6A6531757BD607351EADA1981C2D979BAD5F9` |
| Indexes SHA-256 | `229167F1A944093DE01CE65DB86F591BA56B1C6756909D53016EA2E584825DE5` |
| Hosting live anterior | nenhuma release disponível |
| Commit | `298a230e857ae977816ec0a6453723dd54b515c6` |
| Governança | Issue #21 e PR draft #22 |

## Bloqueio

A API Cloud Billing não retornou billing account aberta acessível à conta autenticada. Associar uma conta inexistente ou escolher outra identidade seria inseguro e violaria a instrução de não inventar billing account.

O owner deve, no Google Cloud Console:

1. criar ou disponibilizar uma Cloud Billing Account válida;
2. confirmar método de pagamento e permissões de associação de billing ao projeto;
3. associar exclusivamente o projeto `finance-control-cce4f`, ou informar a billing account explicitamente;
4. confirmar que `billingEnabled=true` na página Billing do projeto.

Após a confirmação, retomar pela validação read-only do vínculo. Antes do export serão configurados budget/alertas quando suportado, lembrando que budget não bloqueia cobrança automaticamente.

## Operações não iniciadas

- criação do bucket privado;
- managed export Firestore;
- export Auth;
- JSONL portátil;
- checksums/manifest reais;
- restore isolado;
- Supabase local/sandbox;
- migration, RLS e parity.
