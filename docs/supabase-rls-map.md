# Mapa RLS Supabase

- anon: nenhum grant em dados privados;
- active: CRUD somente quando `owner_id = firebase_uid()`;
- pending/inactive: sem acesso financeiro;
- ownership imutável por `WITH CHECK`;
- admin/owner: apenas caminhos explicitamente definidos;
- referências globais: active lê, admin escreve;
- audit: select próprio e insert próprio, sem update/delete;
- `service_role`: somente servidor, nunca frontend.

Os testes pgTAP em `supabase/tests/rls.sql` verificam RLS, policies, ausência de FK em `parent_id`, indexes e grants anon. Antes de cutover, ampliar com JWTs sintéticos active/pending/inactive/admin e executar `supabase test db`.
