# Fase 5: Remocao De Handlers Inline Do HTML

## Resultado

O `index.html` estatico nao contem mais atributos inline:

- `onclick=`
- `onchange=`
- `onsubmit=`

Os eventos estaticos da tela estao centralizados em `src/ui/legacy-events.js`.

## Eventos ja centralizados

`legacy-events.js` cobre os principais fluxos estaticos:

- autenticacao
- navegacao lateral
- troca de abas
- filtros do dashboard
- filtros de listas
- abertura de lancamentos
- formulario principal
- modais de pessoa, macro, hora extra, salario, controle de horas e exclusoes

## Trava automatica

Foi criado o teste `tests/architecture/no-inline-html-handlers.test.js`.

Ele le `index.html` e falha se qualquer um destes atributos voltar:

```txt
onclick=
onchange=
onsubmit=
```

## Observacao importante

Ainda existem handlers inline dentro de strings HTML geradas por scripts legados, principalmente em `src/legacy/inline/part-03.js` e outros `part-*`.

Esses nao sao atributos do `index.html` estatico. Eles devem ser tratados nas proximas fases, quando cada renderer legado for migrado para modulo ou quando os eventos dinamicos passarem para delegacao centralizada.
