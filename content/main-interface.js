/* Tradução adicional dos rótulos dos menus, sem alterar suas ações. */
(() => {
  const labels = {
    'Criar nuvem de palavras': {en:'Create word cloud',es:'Crear nube de palabras',fr:'Créer un nuage de mots',de:'Wortwolke erstellen','zh-CN':'创建词云',ja:'ワードクラウドを作成'},
    'Criar nuvem da coleção': {en:'Create collection word cloud',es:'Crear nube de la colección',fr:'Créer un nuage de la collection',de:'Wortwolke der Sammlung erstellen','zh-CN':'创建分类词云',ja:'コレクションのワードクラウドを作成'},
    'Criar nuvem dos itens selecionados': {en:'Create cloud from selected items',es:'Crear nube de los elementos seleccionados',fr:'Créer un nuage des éléments sélectionnés',de:'Wortwolke ausgewählter Einträge erstellen','zh-CN':'为所选条目创建词云',ja:'選択したアイテムのワードクラウドを作成'},
    'Abrir ferramenta da nuvem…': {en:'Open word cloud tool…',es:'Abrir herramienta de nube…',fr:'Ouvrir l’outil de nuage…',de:'Wortwolkenwerkzeug öffnen…','zh-CN':'打开词云工具…',ja:'ワードクラウドツールを開く…'}
  };
  const addWindow = NuvemZotero.addWindow;
  NuvemZotero.addWindow = function(win) {
    const alreadyAdded = this.windows.has(win);
    addWindow.call(this, win);
    if (alreadyAdded) return;
    const state = this.windows.get(win);
    for (const [parentID, suffix] of [['menu_ToolsPopup','tools'],['zotero-itemmenu','context'],['zotero-collectionmenu','collection']]) {
      const parent = win.document.getElementById(parentID);
      const node = win.document.getElementById('nuvem-zotero-' + suffix);
      if (!parent || !node) continue;
      const translate = () => {
        const language = Services.prefs.getStringPref('extensions.nuvem-palavras.interfaceLanguage', 'pt-BR');
        const current = node.getAttribute('label');
        const source = Object.keys(labels).find(k => k === current || Object.values(labels[k]).includes(current));
        if (source) node.setAttribute('label', labels[source][language] || source);
      };
      parent.addEventListener('popupshowing', translate);
      state.listeners.push([parent, 'popupshowing', translate]);
      translate();
    }
  };
})();
