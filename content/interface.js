/* Tradução explícita, compatível com documento XHTML/XML do Zotero.
   Não usa document.body nem substitui os eventos de geração/salvamento. */
(() => {
  const root = document.getElementById('nuvem-interface-root');
  const trigger = document.getElementById('interface-language');
  const picker = document.getElementById('language-picker');
  const choicesPanel = document.getElementById('language-options');
  const currentLanguage = document.getElementById('current-language');
  if (!root || !trigger || !picker || !choicesPanel || !currentLanguage) { console.error('[Nuvem] Interface de idiomas não encontrada.'); return; }
  const languageNames = {'pt-BR':'Português', en:'English', es:'Español', fr:'Français', de:'Deutsch', 'zh-CN':'简体中文', ja:'日本語'};
  const languageButtons = Array.from(choicesPanel.querySelectorAll('[data-language]'));
  const available = ['pt-BR', 'en', 'es', 'fr', 'de', 'zh-CN', 'ja'];
  const pref = 'extensions.nuvem-palavras.interfaceLanguage';
  let language = 'pt-BR';
  let prefs;
  try { prefs = Services.prefs; language = prefs.getStringPref(pref, 'pt-BR'); } catch (_) {}
  if (!available.includes(language)) language = 'pt-BR';
  const dynamicSources = new WeakMap();
  const templates = {
    en: ['{0} words in analyzed text · {1} terms after filters · {2} words in cloud','File saved to: ','Could not complete: ','Error generating cloud: ','Could not save to Zotero: '],
    es: ['{0} palabras en el texto analizado · {1} términos tras los filtros · {2} palabras en la nube','Archivo guardado en: ','No se pudo completar: ','Error al generar la nube: ','No se pudo guardar en Zotero: '],
    fr: ['{0} mots analysés · {1} termes après filtrage · {2} mots dans le nuage','Fichier enregistré : ','Impossible de terminer : ','Erreur de génération : ','Impossible d’enregistrer dans Zotero : '],
    de: ['{0} Wörter im Text · {1} Begriffe nach Filtern · {2} Wörter in der Wolke','Datei gespeichert unter: ','Vorgang fehlgeschlagen: ','Fehler beim Erstellen: ','Speichern in Zotero fehlgeschlagen: '],
    'zh-CN': ['分析文本中有 {0} 个词语 · 筛选后有 {1} 个词条 · 词云中有 {2} 个词语','文件已保存至：','无法完成：','生成词云时出错：','无法保存到 Zotero：'],
    ja: ['分析テキスト内 {0} 語 · フィルター後 {1} 項目 · クラウド内 {2} 語','保存先：','処理を完了できません：','クラウド生成エラー：','Zotero に保存できません：']
  };
  function translate(text) {
    if (language === 'pt-BR') return text;
    const entry = NuvemTranslations[text];
    if (entry) return entry[language] || entry.en || text;
    const template = templates[language];
    const status = text.match(/^([\d.,]+) palavras no texto analisado · ([\d.,]+) termos após os filtros · (\d+) palavras na nuvem$/);
    if (status) return template[0].replace(/\{([0-2])\}/g, (_, n) => status[Number(n) + 1]);
    const prefixes = ['Arquivo salvo em: ', 'Não foi possível concluir: ', 'Erro ao gerar a nuvem: ', 'Não foi possível gravar no Zotero: '];
    for (let i = 0; i < prefixes.length; i++) if (text.startsWith(prefixes[i])) return template[i + 1] + text.slice(prefixes[i].length);
    // Os avisos podem conter mais de uma frase; substitui apenas mensagens conhecidas.
    let output = text;
    for (const [source, translations] of Object.entries(NuvemTranslations)) {
      if (source.length > 70 && output.includes(source)) output = output.replace(source, translations[language] || translations.en);
    }
    return output;
  }
  function setText(el, value) { if (el.textContent !== value) el.textContent = value; }
  function updateDynamic(el) {
    const raw = el.textContent;
    const previous = dynamicSources.get(el);
    const source = previous && raw === previous.output ? previous.source : raw;
    const output = translate(source);
    dynamicSources.set(el, {source, output});
    setText(el, output);
  }
  const dynamic = ['status','export-message','error','notice','save-zotero','suggestions'];
  const observer = new MutationObserver(() => { update(); });
  function update() {
    observer.disconnect();
    try {
      setText(currentLanguage, languageNames[language]);
      for (const button of languageButtons) button.setAttribute('aria-pressed', String(button.getAttribute('data-language') === language));
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:lang', language);
      for (const el of root.querySelectorAll('[data-i18n]')) {
        // O botão de salvar tem texto temporário durante a gravação.
        if (el.id !== 'save-zotero') setText(el, translate(el.getAttribute('data-i18n')));
      }
      for (const attr of ['title','placeholder','aria-label']) {
        for (const el of root.querySelectorAll('[data-i18n-' + attr + ']')) {
          const value = translate(el.getAttribute('data-i18n-' + attr));
          if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
        }
      }
      for (const id of dynamic) {
        const el = document.getElementById(id);
        if (el && (id !== 'suggestions' || !el.children.length)) updateDynamic(el);
      }
    } catch (error) { console.error('[Nuvem] Erro na tradução da interface', error); }
    finally {
      for (const id of dynamic) {
        const el = document.getElementById(id);
        if (el) observer.observe(el, {subtree:true, childList:true, characterData:true});
      }
    }
  }
  function changeLanguage(chosen) {
    if (!available.includes(chosen)) return;
    language = chosen;
    try { prefs?.setStringPref(pref, language); } catch (error) { console.error('[Nuvem] Não foi possível guardar o idioma', error); }
    update();
    window.dispatchEvent(new CustomEvent('nuvem-languagechange'));
  }
  function closeLanguages(restoreFocus = false) {
    choicesPanel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }
  trigger.addEventListener('click', () => {
    const opening = choicesPanel.hidden;
    choicesPanel.hidden = !opening;
    trigger.setAttribute('aria-expanded', String(opening));
    if (opening) {
      const selected = languageButtons.find(button => button.getAttribute('data-language') === language);
      (selected || languageButtons[0])?.focus();
    }
  });
  for (const button of languageButtons) {
    button.addEventListener('click', () => {
      changeLanguage(button.getAttribute('data-language'));
      closeLanguages(true);
    });
  }
  document.addEventListener('click', event => {
    if (!picker.contains(event.target)) closeLanguages();
  });
  document.addEventListener('keydown', event => {
    if (!choicesPanel.hidden && event.key === 'Escape') {
      event.preventDefault();
      closeLanguages(true);
    }
  });
  const panel = document.getElementById('about-panel');
  document.getElementById('about-open').addEventListener('click', () => {
    panel.hidden = false; panel.scrollIntoView({block:'nearest'});
    document.getElementById('about-close').focus();
  });
  document.getElementById('about-close').addEventListener('click', () => {
    panel.hidden = true; document.getElementById('about-open').focus();
  });
  update();
})();
