/* Organização visual: reutiliza os botões e handlers existentes de exportação. */
(() => {
  const el = id => document.getElementById(id);
  const picker = el('export-picker'), button = el('export-open'), options = el('export-options');
  function closeExports(restoreFocus = false) {
    options.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
  button.addEventListener('click', () => {
    const opening = options.hidden;
    options.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    if (opening) Array.from(options.querySelectorAll('button')).find(node => !node.disabled)?.focus();
  });
  for (const choice of options.querySelectorAll('button')) choice.addEventListener('click', () => closeExports());
  document.addEventListener('click', event => {
    if (!picker.contains(event.target)) closeExports();
  });
  document.addEventListener('keydown', event => {
    if (!options.hidden && event.key === 'Escape') { event.preventDefault(); closeExports(true); }
  });
  const help = el('help-panel');
  el('help-open').addEventListener('click', () => {
    help.hidden = false; help.scrollIntoView({block:'nearest'}); el('help-close').focus();
  });
  el('help-close').addEventListener('click', () => {
    help.hidden = true; el('help-open').focus();
  });
})();
