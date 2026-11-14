// Mostra o texto no idioma pedido (?lang=es) ou no do navegador; pt-BR e o padrao.
(function () {
  var params = new URLSearchParams(window.location.search);
  var wanted = params.get('lang');
  var lang = wanted === 'es' || wanted === 'pt'
    ? wanted
    : (String(navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'pt');
  document.documentElement.lang = lang === 'es' ? 'es-ES' : 'pt-BR';
  document.querySelectorAll('[data-lang]').forEach(function (el) {
    el.hidden = el.getAttribute('data-lang') !== lang;
  });
  document.querySelectorAll('.lang a').forEach(function (a) {
    a.setAttribute('aria-current', a.getAttribute('data-set') === lang ? 'true' : 'false');
  });
  var title = document.querySelector('[data-title-' + lang + ']');
  if (title) document.title = title.getAttribute('data-title-' + lang);
})();
