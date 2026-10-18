# Smoke pos-deploy de staging

Executado em: 19/09/2026

Este documento descreve a validacao futura em staging. Nesta etapa nada foi publicado.

## Pre-condicoes

- Projeto Firebase staging isolado.
- Build criado com configuracao staging revisada.
- Regras e indices aplicados no projeto staging por processo aprovado.
- Usuarios ficticios criados.
- Nenhuma variavel de Emulator ativa no build publicado.

## Jornada minima

1. Login de usuario ativo.
2. Troca de usuario A -> B -> A sem vazamento de dados.
3. Usuario inativo bloqueado.
4. Dashboard abre com filtros e sem erro fatal.
5. Criar e editar saida.
6. Criar parcelamento e marcar parcela como paga.
7. Criar recorrencia mensal.
8. Consolidar entrada mensal.
9. Confirmar que outras receitas aparecem separadas da base salario/H.E/DSR.
10. Criar controle de horas e conferir hora extra/banco de horas.
11. Importar XLSX sintetico e reimportar para validar duplicidade.
12. Configuracoes pessoais e globais respeitam escopo/permissao.
13. Administracao de usuarios bloqueia usuario comum e permite admin autorizado.
14. Backup dry-run e restore dry-run sem escrita real.
15. Exportacao PDF.
16. Logout.

## Evidencias minimas

- URL de staging.
- Commit e manifest.
- Usuario ficticio usado em cada jornada.
- Resultado de cada passo.
- Capturas apenas com dados sinteticos.
- Lista de bloqueadores e decisao GO/NO-GO.
