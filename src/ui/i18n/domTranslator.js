/**
 * Aplica o idioma escolhido nas telas.
 *
 * Percorre o DOM e troca textos (e placeholder/title/aria-label) que tenham traducao no
 * dicionario do idioma atual. Um MutationObserver traduz o que as telas desenham depois.
 * Em pt-BR nada e observado e os textos originais sao restaurados.
 *
 * Conteudo do usuario (descricoes, categorias, nomes) nao deve ser traduzido: marque o
 * elemento com `data-i18n-skip` ou `translate="no"`.
 */
import { getLocale, onLocaleChange, translateText, DEFAULT_LOCALE } from '../../core/i18n.js';

const ATTRIBUTES = Object.freeze(['placeholder', 'title', 'aria-label']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG']);

export function installDomTranslator(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef?.body || target.financeApp?.domTranslator?.installed) return target?.financeApp?.domTranslator || null;

  // Texto original (portugues) de cada no/atributo traduzido, para poder voltar.
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  let observer = null;
  let applying = false;

  function skipped(element) {
    for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-i18n-skip') || el.getAttribute('translate') === 'no') return true;
      if (el.isContentEditable) return true;
    }
    return false;
  }

  function translateTextNode(node, locale) {
    const parent = node.parentElement;
    if (!parent || skipped(parent)) return;
    const source = originalText.has(node) && originalText.get(node).shown === node.data
      ? originalText.get(node).source
      : node.data;
    if (locale === DEFAULT_LOCALE) {
      if (originalText.has(node) && node.data !== source) node.data = source;
      return;
    }
    const translated = translateText(source, locale);
    if (translated !== source) {
      originalText.set(node, { source, shown: translated });
      if (node.data !== translated) node.data = translated;
    }
  }

  function translateAttributes(element, locale) {
    if (skipped(element)) return;
    let saved = originalAttrs.get(element);
    for (const name of ATTRIBUTES) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      const known = saved?.[name];
      const source = known && known.shown === current ? known.source : current;
      if (locale === DEFAULT_LOCALE) {
        if (known && current !== source) element.setAttribute(name, source);
        continue;
      }
      const translated = translateText(source, locale);
      if (translated !== source) {
        saved = saved || {};
        saved[name] = { source, shown: translated };
        originalAttrs.set(element, saved);
        if (current !== translated) element.setAttribute(name, translated);
      }
    }
  }

  function translateTree(root, locale = getLocale()) {
    if (!root) return;
    applying = true;
    try {
      if (root.nodeType === 3) {
        translateTextNode(root, locale);
        return;
      }
      if (root.nodeType !== 1 && root.nodeType !== 9) return;
      const start = root.nodeType === 9 ? root.body : root;
      if (!start) return;
      if (start.nodeType === 1) translateAttributes(start, locale);
      const walker = documentRef.createTreeWalker(start, 1 | 4);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 3) translateTextNode(node, locale);
        else translateAttributes(node, locale);
      }
    } finally {
      applying = false;
    }
  }

  function observe(locale) {
    if (locale === DEFAULT_LOCALE) {
      observer?.disconnect();
      observer = null;
      return;
    }
    if (observer || typeof target.MutationObserver !== 'function') return;
    observer = new target.MutationObserver((records) => {
      if (applying) return;
      const current = getLocale();
      for (const record of records) {
        if (record.type === 'characterData') translateTree(record.target, current);
        else if (record.type === 'attributes') translateTree(record.target, current);
        else record.addedNodes.forEach((node) => translateTree(node, current));
      }
    });
    observer.observe(documentRef.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES]
    });
  }

  function apply(locale = getLocale()) {
    documentRef.documentElement.lang = locale;
    translateTree(documentRef, locale);
    observe(locale);
  }

  const unsubscribe = onLocaleChange((locale) => apply(locale));
  apply(getLocale());

  const app = target.financeApp || {};
  target.financeApp = app;
  app.domTranslator = { installed: true, apply, translateTree, uninstall: () => { unsubscribe(); observer?.disconnect(); } };
  return app.domTranslator;
}
