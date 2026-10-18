export function appendChildren(parent, children = []) {
  if (!parent) return parent;
  const items = Array.isArray(children) ? children : [children];
  parent.append(...items.filter(Boolean));
  return parent;
}

export function createElement(tagName, options = {}) {
  const documentRef = options.document || globalThis.document;
  const element = documentRef?.createElement?.(tagName);
  if (!element) return null;

  if (options.className) element.className = options.className;
  if (options.text !== undefined && options.text !== null) {
    element.textContent = String(options.text);
  }
  if (options.html !== undefined && options.html !== null) {
    element.innerHTML = String(options.html);
  }

  if (options.attrs && typeof options.attrs === 'object') {
    Object.entries(options.attrs).forEach(([name, value]) => {
      if (value === undefined || value === null || value === false) return;
      element.setAttribute(name, value === true ? '' : String(value));
    });
  }

  if (options.dataset && typeof options.dataset === 'object') {
    Object.entries(options.dataset).forEach(([name, value]) => {
      if (value === undefined || value === null) return;
      element.dataset[name] = String(value);
    });
  }

  if (options.style && typeof options.style === 'object') {
    Object.assign(element.style, options.style);
  }

  if (options.listeners && typeof options.listeners === 'object') {
    Object.entries(options.listeners).forEach(([eventName, listener]) => {
      if (typeof listener === 'function') {
        element.addEventListener(eventName, listener);
      }
    });
  }

  appendChildren(element, options.children);
  return element;
}

export function createFragment(children = [], documentRef = globalThis.document) {
  const fragment = documentRef?.createDocumentFragment?.();
  if (!fragment) return null;
  appendChildren(fragment, children);
  return fragment;
}

export function installCreateElementGlobals(target = globalThis) {
  target.financeDomHelpers = {
    appendChildren,
    createElement: (tagName, options = {}) => createElement(tagName, { document: target.document, ...options }),
    createFragment: (children = []) => createFragment(children, target.document)
  };
  return target.financeDomHelpers;
}
