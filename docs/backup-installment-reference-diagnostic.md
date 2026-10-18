# Diagnóstico de referência de parcelamento no backup

`parent_id` é o identificador lógico compartilhado pela série de parcelas; não é uma foreign key para um documento pai persistido. O validador genérico produzia `ORPHAN_REFERENCE` incorretamente e a fixture escondia o erro criando um registro artificial `is_installment_parent`.

A validação agora agrupa a série por `parent_id` e verifica completude, titularidade e totais coerentes. Referências reais, como `percentage_rule_id`, continuam sujeitas à detecção de órfãos. A fixture artificial foi removida, sem mudança no payload financeiro nem nas regras financeiras.

Evidências locais: testes focados verdes, E2E de backup/restore verde, `backup:dry-run` com `wrote=false`, e benchmark de 100/1.000/5.000 registros verde. Restore real permaneceu indisponível.
