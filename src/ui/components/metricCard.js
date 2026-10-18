import { createElement } from '../dom/createElement.js';

export function createMetricCard({
  label = '',
  value = '',
  caption = '',
  className = 'rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3',
  valueClassName = 'text-lg font-semibold mt-1',
  labelClassName = 'text-xs text-textSecondary',
  captionClassName = 'text-xs text-textSecondary mt-1',
  document
} = {}) {
  return createElement('div', {
    document,
    className,
    children: [
      createElement('p', { document, className: labelClassName, text: label }),
      createElement('p', { document, className: valueClassName, text: value }),
      caption ? createElement('p', { document, className: captionClassName, text: caption }) : null
    ]
  });
}

export function installMetricCardGlobals(target = globalThis) {
  target.financeUiComponents ||= {};
  target.financeUiComponents.createMetricCard = (options = {}) => createMetricCard({ document: target.document, ...options });
  return target.financeUiComponents;
}
