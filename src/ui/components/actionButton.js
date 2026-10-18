import { createElement } from '../dom/createElement.js';

export function createActionButton({
  label = '',
  className = '',
  title = '',
  dataset = {},
  icon = '',
  iconClassName = 'w-4 h-4',
  document
} = {}) {
  const button = createElement('button', {
    document,
    className,
    attrs: {
      type: 'button',
      title: title || null
    },
    dataset
  });
  if (!button) return null;

  if (icon) {
    button.appendChild(createElement('i', {
      document,
      className: iconClassName,
      attrs: { 'data-lucide': icon }
    }));
  }

  if (label) {
    button.appendChild(createElement('span', {
      document,
      className: icon ? 'inline-flex items-center' : '',
      text: label
    }));
  }

  return button;
}

export function installActionButtonGlobals(target = globalThis) {
  target.financeUiComponents ||= {};
  target.financeUiComponents.createActionButton = (options = {}) => createActionButton({ document: target.document, ...options });
  return target.financeUiComponents;
}
