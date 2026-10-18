# Contrato futuro de identidade externa

Este documento e apenas conceitual. Nenhuma colecao Firestore, storage, telefone, webhook, provedor de mensagem ou identificador externo foi implementado nesta etapa.

## ExternalIdentityReference

Campos planejados:

| Campo | Descricao |
| --- | --- |
| `provider` | Provedor externo futuro, sem enum definido nesta etapa |
| `externalSubjectId` | Identificador opaco do sujeito no provedor |
| `userUid` | UID interno do usuario ja aprovado/autorizado |
| `status` | Estado da vinculacao externa |
| `verifiedAt` | Data de verificacao da vinculacao |
| `createdAt` | Data de criacao do vinculo |
| `updatedAt` | Data da ultima atualizacao |

## Politica

- Identidade externa nao entra em `finance_records`.
- Telefone nao e chave primaria financeira.
- Canal externo nao cria usuario, nao aprova conta e nao concede permissao.
- Qualquer backend futuro deve resolver identidade externa para um `userUid` interno antes de chamar `ApplicationCommandGateway`.
- Esta etapa nao define provider real, mensagem, webhook ou formato de conversa.
