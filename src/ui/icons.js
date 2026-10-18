import createLucideElement from 'lucide/dist/esm/createElement.js';

const iconFrameByRoot = new WeakMap();

function toPascalCase(value = '') {
  return String(value)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function renderIconsInContainer(root = document, lucideInstance = globalThis.lucide) {
  if (!root?.querySelectorAll || !lucideInstance?.icons) return 0;
  const placeholders = root.querySelectorAll('i[data-lucide]:not(.lucide)');
  let replaced = 0;

  placeholders.forEach((element) => {
    const iconName = element.getAttribute('data-lucide');
    const componentName = toPascalCase(iconName);
    const iconNode = lucideInstance.icons?.[componentName];
    if (!iconNode) return;

    const attrs = Array.from(element.attributes).reduce((result, attr) => {
      result[attr.name] = attr.value;
      return result;
    }, {});
    const classNames = ['lucide', `lucide-${iconName}`];
    if (attrs.class) classNames.push(attrs.class);
    const svg = createLucideElement(iconNode, {
      ...attrs,
      class: classNames.join(' ').trim(),
      'aria-hidden': attrs['aria-label'] ? undefined : 'true'
    });
    element.parentNode?.replaceChild(svg, element);
    replaced += 1;
  });

  return replaced;
}

export function scheduleIconRender(root = document, lucideInstance = globalThis.lucide) {
  if (!root?.querySelectorAll || !lucideInstance?.icons) return;
  const previousFrame = iconFrameByRoot.get(root);
  if (previousFrame) cancelAnimationFrame(previousFrame);
  const frame = requestAnimationFrame(() => {
    iconFrameByRoot.delete(root);
    renderIconsInContainer(root, lucideInstance);
  });
  iconFrameByRoot.set(root, frame);
}
