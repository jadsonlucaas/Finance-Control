import { userMessageForError } from '../application/resilience/errorNormalization.js';

let toastContainer = null;

export function getToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'fixed bottom-4 right-4 z-[200] flex flex-col gap-2';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, isError = false) {
  const container = getToastContainer();
  const el = document.createElement('div');
  el.className = `px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all transform translate-y-2 opacity-0 ${isError ? 'bg-danger text-white' : 'bg-success text-bg'}`;
  el.textContent = typeof message === 'object' && message
    ? userMessageForError(message)
    : String(message || '');
  
  container.appendChild(el);
  
  // trigger animation
  requestAnimationFrame(() => {
    el.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    el.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (container.contains(el)) container.removeChild(el);
    }, 300);
  }, 3000);
}

// Override legacy toast globally
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
