export function byId(id, root = document) {
  return root.getElementById(id);
}

export function setHidden(element, hidden) {
  element?.classList?.toggle('hidden', Boolean(hidden));
}

export function setHtml(element, html) {
  if (element) element.innerHTML = String(html || '');
}

export function setNodes(element, nodes = []) {
  if (!element) return;
  element.replaceChildren(...nodes.filter(Boolean));
}

export function setText(element, text) {
  if (element) element.textContent = String(text || '');
}

export function renderListState({
  list,
  empty,
  meta,
  pagination,
  html = '',
  nodes = null,
  hasItems = false,
  metaHtml = null,
  metaText = null,
  showPagination = false
} = {}) {
  if (Array.isArray(nodes)) setNodes(list, nodes);
  else setHtml(list, html);
  setHidden(empty, hasItems);
  if (metaHtml !== null) setHtml(meta, metaHtml);
  if (metaText !== null) setText(meta, metaText);
  if (pagination) setHidden(pagination, !showPagination);
}
