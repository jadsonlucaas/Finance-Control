# Orçamento de Bundle e Bootstrap

Executado em: 23/08/2026

`scripts/bundle-budget.mjs` valida o build gerado em `dist`.

## Limites

- Entry JS menor ou igual a 420 KiB.
- Maior chunk menor ou igual a 560 KiB.
- Chunk `services-firebase` menor ou igual a 560 KiB.
- `services-firebase` nao pode aparecer no HTML como bootstrap.
- Runtime XLSX, runtime jsPDF, Firebase Admin SDK e providers externos nao podem estar no entry chunk.

## Resultado atual

- `npm run bundle:budget`: aprovado.
- Entry: `dist/assets/app-u98FG2UQ.js`, 411442 bytes.
- Firebase: `dist/assets/services-firebase-CKXkwsgm.js`, 167138 bytes.
- Maior chunk: `dist/assets/services-firestore-BWq7wxDa.js`, 449417 bytes.
- Violacoes: nenhuma.

Observacao: referencias textuais a campos como `whatsapp_phone` sao contratos de dados e nao significam provider carregado.
Observacao: Firestore fica em chunk lazy separado de `services-firebase` para evitar que consultas administrativas aumentem o bootstrap.

Atualizacao em 03/09/2026: a elevacao temporaria de Entry JS de 420 KiB para 422 KiB foi revertida. O limite oficial volta a ser o baseline aprovado de 420 KiB (`430080` bytes), protegido por `docs/bundle-budget-baseline.json`.

Regra anti-moving-goalposts: o budget nao pode ser aumentado no mesmo prompt apenas porque uma feature excedeu o limite. Qualquer aumento futuro exige diagnostico, justificativa, comparacao antes/depois e aprovacao explicita em etapa propria. Features devem priorizar lazy loading, code splitting, remocao de import eager desnecessario e deduplicacao; `scripts/bundle-budget.mjs` nao pode autoajustar limite a partir do build atual.

Resultado corretivo 5.4B: `src/ui/hours/hourControlActiveUi.js`, controller, presenter e read model de Controle de Horas sairam do bootstrap e carregam sob demanda ao abrir a aba. `src/ui/records/parcelamentosRenderer.js` tambem saiu do entry por ser uma tela secundaria. O entry final ficou em `411442` bytes, com headroom de `18638` bytes sobre o budget oficial e abaixo da meta recomendada de `425000` bytes.

Resultado corretivo 5.6A em 05/09/2026: Configuracoes manteve o budget oficial em `430080` bytes. A composicao settings-only saiu do entry e passou para chunks assincronos. Entry medido: `dist/assets/app-B4p44E06.js`, `420552` bytes; headroom: `9528` bytes (`2.22%`). `scripts/bundle-budget.mjs` agora falha se o budget oficial divergir de `430080` ou se evidencias estaveis de Configuracoes ativa aparecerem no entry.

## Budget corretivo

Executado em: 23/08/2026

- Historicos Firestore persistidos: listagens administrativas e operacionais devem usar `limit` e cursor opaco quando houver `db`.
- Dashboard: proibido calcular KPI a partir de pagina parcial.
- Subscriptions: troca de owner deve encerrar o listener anterior antes de abrir o seguinte.
- Benchmarks locais devem retornar `wrote=false`.
- Dashboard/read models: `npm run dashboard-modernization:check` deve retornar `ok=true`, `wrote=false`, APIs globais <= 58, scripts classicos <= 33 e eval executado <= 33.

Validacoes adicionais:

- `npm run bootstrap:benchmark`
- `npm run dashboard:benchmark`
- `npm run import:benchmark`
- `npm run backup:benchmark`
- `npx firebase emulators:exec --only firestore "npm.cmd run firestore:pagination:benchmark"`

## Governanca do Bootstrap - 11/09/2026

O budget oficial permanece `430080` bytes. A observabilidade deterministica de bootstrap adicionou marcas leves da Performance API e o entry medido ficou em `374009` bytes, com headroom de `56071` bytes.

`npm run bootstrap:benchmark` nao usa mais `document_load_ms` como gate principal. O gate usa `vite preview` e compara apenas metricas controlaveis contra `docs/bootstrap-performance-baseline.json`:

- `app_bootstrap_ms`
- `first_screen_ready_ms`

Metricas informativas:

- `document_load_ms`
- `environment_overhead_ms`
- comparacao em Vite dev

Thresholds:

- warning: baseline +10%;
- falha: baseline +20%;
- baseline nao e autoatualizado pelo benchmark.
