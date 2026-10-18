export function openModal(element) {
  element?.classList?.remove('hidden');
}

export function closeModal(element) {
  element?.classList?.add('hidden');
}

export function moveModalToAppRoot(element, appRoot) {
  if (element && appRoot && element.parentElement !== appRoot) {
    appRoot.appendChild(element);
  }
  return element;
}

export function openOverlay(element, appRoot) {
  moveModalToAppRoot(element, appRoot);
  openModal(element);
}
