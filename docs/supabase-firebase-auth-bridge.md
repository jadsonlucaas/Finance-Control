# Bridge Firebase Auth → Supabase

Na fase de dados, Firebase Auth continua como autoridade. O gateway valida o JWT Firebase server-side e projeta `firebase_uid` em um JWT curto aceito pelo Postgres/Supabase. Nunca confiar em UID enviado pelo cliente sem validação criptográfica.

Migração Auth futura deve exportar UID, email, disabled, metadata e parâmetros de password hash em artefato criptografado fora do Git. Preencher `identity_mappings`, testar login/recovery e definir forced re-login. Hash config, chaves e service role nunca são versionados.
