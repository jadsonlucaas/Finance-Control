# Validação de restore Firebase isolado

Status: **NOT RUN — BLOCKED BY BACKUP/BILLING**.

Nenhum restore foi executado. Quando o backup estiver verificado, o restore deverá usar projeto Firebase isolado, nunca production ou staging homologado, e comparar contagens, document paths, hashes, ownership e tipos sem expor payloads.
