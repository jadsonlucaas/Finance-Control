/**
 * Cadastro: sugere o pais pelo navegador e pelo DDI do WhatsApp.
 *
 * - Ao abrir a tela, o campo "Pais" ja vem com o pais provavel (fuso/idioma do navegador).
 * - Se a pessoa digitar o telefone com DDI (+55, +34, +351), o pais acompanha.
 * - Depois que a pessoa escolhe o pais na mao, nada mais muda sozinho.
 */
import { browserLocaleContext, suggestPreferences } from '../../core/userPreferences.js';

export function installSignupSuggestions(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || documentRef.documentElement.dataset.financeSignupSuggestionsBound) return null;
  const context = browserLocaleContext(target);
  let chosenByUser = false;

  const select = () => documentRef.getElementById('auth-country');
  function suggest(phone = '') {
    const field = select();
    if (!field || chosenByUser) return;
    const { country } = suggestPreferences({ ...context, phone });
    if (field.value !== country) field.value = country;
  }

  documentRef.addEventListener('change', (event) => {
    if (event.target?.id === 'auth-country') chosenByUser = true;
  });
  documentRef.addEventListener('input', (event) => {
    if (event.target?.id === 'auth-phone') suggest(event.target.value);
  });

  suggest();
  documentRef.documentElement.dataset.financeSignupSuggestionsBound = 'true';
  return { suggest, isChosenByUser: () => chosenByUser };
}
