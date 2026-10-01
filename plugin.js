/* Somente o PDF selecionado é lido. Nenhuma chamada HTTP é realizada. */
var NuvemZotero = {
  windows: new Map(),   // janelas principais do Zotero
  tools: new Map(),     // janelas da ferramenta, por anexo
  active: true,
  iconPatches: new Map(),

  TOOL_URL: "chrome://nuvem-palavras/content/cloud.xhtml",
  PREF: "extensions.nuvem-palavras.defaults",

  selectedCollections(win) {
    try {
      return (win.ZoteroPane?.getSelectedCollections?.() || []).filter(c => c && typeof c.getChildItems === "function");
    } catch (error) { Zotero.logError(error); return []; }
  },

  loadOptions() {
    let saved = null;
    try { const s = Services.prefs.getStringPref(this.PREF, ""); if (s) saved = JSON.parse(s); } catch (error) { Zotero.logError(error); }
    return NuvemCore.mergeOptions(saved);
  },

  installOpenHandler() {
    if (this.openWrapper) return;
    if (typeof Zotero.FileHandlers?.open !== "function") throw new Error("O Zotero não disponibilizou o manipulador de abertura de anexos.");
    const plugin = this;
    this.originalOpen = Zotero.FileHandlers.open;
    this.openWrapper = async function (item, ...args) {
      if (plugin.active && plugin.isCloud(item)) {
        const win = Zotero.getMainWindow() || Array.from(plugin.windows.keys())[0];
        return plugin.openTool(win, item);
      }
      return plugin.originalOpen.call(this, item, ...args);
    };
    Zotero.FileHandlers.open = this.openWrapper;
  },

  addWindow(win) {
    if (this.windows.has(win)) return;
    this.installAttachmentIcon(win);
    const doc = win.document;
    const state = { nodes: [], listeners: [], busy: false };
    this.windows.set(win, state);
    const defs = [
      ["menu_ToolsPopup", "tools", "items"],
      ["zotero-itemmenu", "context", "items"],
      ["zotero-collectionmenu", "collection", "collection"]
    ];
    for (const [parentID, suffix, kind] of defs) {
      const parent = doc.getElementById(parentID);
      if (!parent) continue;
      const node = doc.createXULElement("menuitem");
      node.id = "nuvem-zotero-" + suffix;
      node.setAttribute("class", "menuitem-iconic");
      node.setAttribute("image", this.iconURI);
      node.setAttribute("label", kind === "collection" ? "Criar nuvem da coleção" : "Criar nuvem de palavras");
      const run = () => {
        if (kind === "collection") return this.runCollection(win);
        const selection = win.ZoteroPane?.getSelectedItems() || [];
        if (selection.length === 1 && this.isCloud(selection[0])) this.openTool(win, selection[0]);
        else this.run(win);
      };
      const update = () => {
        if (kind === "collection") {
          node.disabled = state.busy || this.selectedCollections(win).length === 0;
          return;
        }
        const selection = (win.ZoteroPane?.getSelectedItems() || []).filter(i => !i.isNote());
        node.disabled = state.busy || selection.length === 0;
        node.setAttribute("label",
          selection.length === 1 && this.isCloud(selection[0]) ? "Abrir ferramenta da nuvem…"
          : selection.length > 1 ? "Criar nuvem dos itens selecionados"
          : "Criar nuvem de palavras");
      };
      node.addEventListener("command", run);
      parent.addEventListener("popupshowing", update);
      state.listeners.push([node, "command", run], [parent, "popupshowing", update]);
      parent.appendChild(node);
      state.nodes.push(node);
    }
  },

  removeWindow(win) {
    const state = this.windows.get(win);
    if (!state) return;
    for (const [node, name, handler] of state.listeners) node.removeEventListener(name, handler);
    for (const node of state.nodes) node.remove();
    this.windows.delete(win);
  },

  shutdown() {
    this.active = false;
    if (Zotero.FileHandlers?.open === this.openWrapper) Zotero.FileHandlers.open = this.originalOpen;
    for (const w of Array.from(this.tools.values())) {
      try { if (!w.closed) w.close(); } catch (error) { Zotero.logError(error); }
    }
    this.tools.clear();
    for (const [proto, patch] of this.iconPatches) if (proto.getIcon === patch.wrapper) proto.getIcon = patch.original;
    this.iconPatches.clear();
    for (const win of Array.from(this.windows.keys())) this.removeWindow(win);
  },

  installAttachmentIcon(win) {
    try {
      const proto = win.require('zotero/itemTreeRow').ZoteroItemTreeRow.prototype;
      if (this.iconPatches.has(proto)) return;
      const original = proto.getIcon, plugin = this;
      const wrapper = function (...args) {
        const icon = original.apply(this, args);
        if (!plugin.active || !plugin.isCloud(this.ref)) return icon;
        const svg = icon.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 64 64');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('aria-label', 'Nuvem de palavras');
        svg.style.cssText = 'width:20px;height:20px;flex-shrink:0;overflow:hidden;mask:none;background:none';
        svg.innerHTML = "<path d=\"M15 55C1 55 0 30 13 26C14 3 41 1 47 22C63 20 69 52 51 55Z\" fill=\"white\" stroke=\"#7e8b99\" stroke-width=\"2\"/><path d=\"M24 26H43V30L30 42H43V47H23V43L36 31H24Z\" fill=\"#c62828\"/>";
        return svg;
      };
      proto.getIcon = wrapper;
      this.iconPatches.set(proto, { original, wrapper });
      win.ZoteroPane?.itemsView?.refresh();
    } catch (error) { Zotero.logError(error); }
  },

  async selectPDF(win, item) {
    if (item.isAttachment()) {
      if (item.attachmentContentType !== "application/pdf") {
        throw new Error("Selecione um artigo com PDF anexado ou selecione diretamente o anexo PDF.");
      }
      return item;
    }
    if (!item.isRegularItem()) throw new Error("Selecione um artigo ou um anexo PDF na lista central do Zotero.");
    const attachments = await Zotero.Items.getAsync(item.getAttachments());
    const pdfs = attachments.filter(a => a.attachmentContentType === "application/pdf");
    if (!pdfs.length) throw new Error("Este registro não possui um PDF anexado. Anexe o PDF do artigo e tente novamente.");
    if (pdfs.length === 1) return pdfs[0];
    const choice = { value: 0 };
    const labels = pdfs.map(p => p.attachmentFilename || p.getField("title") || p.key);
    const ok = Services.prompt.select(win, "Escolher PDF", "Este artigo tem mais de um PDF. Qual deseja analisar?", labels.length, labels, choice);
    return ok ? pdfs[choice.value] : null;
  },

  async extractText(pdf) {
    let text, coverage;
    if (typeof Zotero.PDFWorker?.getFullText === "function") {
      const result = await Zotero.PDFWorker.getFullText(pdf.id, null);
      text = result.text;
      coverage = Number.isFinite(result.totalPages) && Number.isFinite(result.extractedPages)
        ? `Texto extraído de ${result.extractedPages} de ${result.totalPages} páginas do PDF.`
        : "Texto extraído do PDF; o Zotero não informou a contagem de páginas.";
    } else {
      text = await pdf.attachmentText;
      coverage = "Texto disponibilizado pelo Zotero. Nesta versão não foi possível confirmar a cobertura de todas as páginas.";
    }
    return { text, coverage };
  },

  async buildPayload(win, selection) {
    if (selection.length !== 1) throw new Error("Selecione apenas um artigo ou PDF por vez.");
    const pdf = await this.selectPDF(win, selection[0]);
    if (!pdf) return null;
    if (!(await pdf.getFilePathAsync())) {
      throw new Error("O PDF não está disponível neste computador. Abra ou baixe o anexo no Zotero antes de gerar a nuvem.");
    }
    const article = pdf.parentID ? await Zotero.Items.getAsync(pdf.parentID) : pdf;
    const { text, coverage } = await this.extractText(pdf);
    if (!text || !text.trim()) {
      throw new Error("Não foi possível extrair texto deste PDF. Ele pode estar digitalizado como imagem ou protegido. PDFs em imagem precisam de OCR antes da análise.");
    }
    const payload = {
      title: article.getField("title") || "Artigo selecionado",
      pdf: pdf.attachmentFilename || pdf.getField("title") || "PDF",
      text,
      documents: [NuvemArticleAnalysis.sourceRecord(article, pdf, text, 0)],
      coverage,
      generatedAt: new Date().toISOString(),
      options: this.loadOptions()
    };
    return { payload, article };
  },

  // Vários itens: lê o primeiro PDF local de cada um e junta tudo (separado por \f).
  async buildMultiPayload(win, items, title) {
    const pdfs = new Map();
    let withoutPDF = 0;
    for (const it of items) {
      if (it.isNote()) continue;
      let found = null;
      if (it.isAttachment()) {
        if (it.attachmentContentType === "application/pdf") found = it;
      } else if (it.isRegularItem()) {
        for (const a of await Zotero.Items.getAsync(it.getAttachments())) {
          if (a.attachmentContentType === "application/pdf" && await a.getFilePathAsync()) { found = a; break; }
        }
      }
      if (found && await found.getFilePathAsync()) pdfs.set(found.id, found);
      else withoutPDF++;
    }
    const list = Array.from(pdfs.values());
    if (!list.length) throw new Error("Nenhum dos itens tem PDF disponível neste computador.");
    if (list.length > 30 && !Services.prompt.confirm(win, "Nuvem de palavras", `Serão lidos ${list.length} PDFs. Isso pode levar alguns minutos. Continuar?`)) return null;
    const texts = [];
    const documents = [];
    let textOffset = 0;
    let failed = 0;
    for (const pdf of list) {
      try {
        const { text } = await this.extractText(pdf);
        if (text && text.trim()) {
          let article = pdf;
          try { if (pdf.parentID) article = await Zotero.Items.getAsync(pdf.parentID) || pdf; }
          catch (error) { Zotero.logError(error); }
          documents.push(NuvemArticleAnalysis.sourceRecord(article, pdf, text, textOffset));
          texts.push(text);
          textOffset += text.length + 1; // um \f entre os PDFs, como na base
        } else failed++;
      } catch (error) { Zotero.logError(error); failed++; }
    }
    if (!texts.length) throw new Error("Não foi possível extrair texto de nenhum dos PDFs. PDFs em imagem precisam de OCR.");
    const notes = [];
    if (withoutPDF) notes.push(`${withoutPDF} item(ns) sem PDF local ignorado(s)`);
    if (failed) notes.push(`${failed} PDF(s) sem texto extraível ignorado(s)`);
    const first = items.find(i => !i.isNote());
    return {
      title,
      pdf: `${texts.length} PDFs`,
      text: texts.join("\f"),
      documents,
      coverage: `Texto de ${texts.length} PDFs reunidos.` + (notes.length ? " " + notes.join("; ") + "." : ""),
      generatedAt: new Date().toISOString(),
      options: this.loadOptions(),
      libraryID: first.libraryID
    };
  },

  isCloud(item) {
    return !!item && item.isAttachment() && item.attachmentContentType === "image/svg+xml"
      && (item.attachmentFilename || "").startsWith("nuvem-palavras");
  },

  // Abre a ferramenta numa janela própria do plugin (sem actors, sem processo remoto).
  // ctx = { item, libraryID, collectionID }: onde "Salvar no Zotero" grava.
  openWindow(win, payload, ctx, key) {
    const arg = {
      json: JSON.stringify(payload),
      save: json => this.persistCloud(win, ctx, JSON.parse(json))
    };
    const tool = win.openDialog(this.TOOL_URL, "", "chrome,dialog=no,resizable=yes,centerscreen,width=1280,height=900", arg);
    this.tools.set(key, tool);
    return tool;
  },

  async openTool(win, item) {
    const key = item.libraryID + ":" + item.key;
    const existing = this.tools.get(key);
    if (existing && !existing.closed) {
      existing.focus();
      return true;
    }
    try {
      const path = await item.getFilePathAsync();
      if (!path) throw new Error("Baixe o anexo da nuvem antes de abrir a ferramenta.");
      const source = await Zotero.File.getContentsAsync(path);
      const xml = new win.DOMParser().parseFromString(source, "image/svg+xml");
      const data = xml.querySelector('metadata[id="nuvem-zotero-data"]');
      if (!data) throw new Error("Este anexo não contém os dados da ferramenta.");
      const payload = JSON.parse(data.textContent);
      if (payload.schema !== "nuvem-zotero/v1" || typeof payload.text !== "string") throw new Error("Dados da nuvem inválidos.");
      this.openWindow(win, payload, { item }, key);
      return true;
    } catch (error) {
      Zotero.logError(error);
      Services.prompt.alert(win, "Nuvem de palavras", error.message || String(error));
      return false;
    }
  },

  // Grava a nuvem atual no Zotero: atualiza o anexo existente ou cria um anexo novo.
  async persistCloud(win, ctx, payload) {
    try {
      Zotero.debug("[Nuvem] gravando no Zotero; anexo existente: " + !!ctx.item);
      const owner = (win && !win.closed) ? win : Zotero.getMainWindow();
      const cloud = NuvemCore.svg(payload, owner.document);
      const summary = `${cloud.words.length} palavras, ${Math.round(cloud.content.length / 1024)} KB`;
      if (ctx.item) {
        const library = Zotero.Libraries?.get(ctx.item.libraryID);
        if (library && (!library.editable || !library.filesEditable)) throw new Error("Esta biblioteca não permite alterar anexos.");
        const path = await ctx.item.getFilePathAsync();
        if (!path) throw new Error("O arquivo do anexo não está disponível neste computador.");
        await Zotero.File.putContentsAsync(path, cloud.content);
        const check = await Zotero.File.getContentsAsync(path);
        if (!String(check).includes("nuvem-zotero-data")) throw new Error("A gravação não foi confirmada: o arquivo não contém os dados esperados.");
        try { Zotero.Notifier.trigger("refresh", "item", [ctx.item.id]); } catch (error) { Zotero.logError(error); }
        try { if (!owner.closed) await owner.ZoteroPane.selectItem(ctx.item.id); } catch (error) { Zotero.logError(error); }
        Zotero.debug("[Nuvem] anexo atualizado: " + path);
        return `Anexo atualizado no Zotero (${summary}).`;
      }
      const file = Zotero.getTempDirectory();
      file.append("nuvem-palavras.svg");
      file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
      try {
        await Zotero.File.putContentsAsync(file.path, cloud.content);
        const params = { file: file.path, libraryID: ctx.libraryID, title: "Nuvem de palavras — " + payload.title, contentType: "image/svg+xml" };
        if (ctx.collectionID) params.collections = [ctx.collectionID];
        ctx.item = await Zotero.Attachments.importFromFile(params);
        try { if (!owner.closed) await owner.ZoteroPane.selectItem(ctx.item.id); } catch (error) { Zotero.logError(error); }
        Zotero.debug("[Nuvem] anexo criado, id " + ctx.item.id);
        return `Nuvem salva no Zotero como anexo (${summary}).`;
      } finally {
        if (file.exists()) file.remove(false);
      }
    } catch (error) {
      Zotero.logError(error);
      throw error;
    }
  },

  async saveCloud(win, result) {
    if (!result.article.isRegularItem()) throw new Error("Crie um item pai para este PDF no Zotero e tente novamente. A nuvem precisa ficar vinculada a um artigo.");
    const library = Zotero.Libraries?.get(result.article.libraryID);
    if (library && (!library.editable || !library.filesEditable)) throw new Error("Esta biblioteca não permite adicionar anexos.");
    const cloud = NuvemCore.svg(result.payload, win.document);
    const file = Zotero.getTempDirectory();
    file.append("nuvem-palavras.svg");
    file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
    try {
      await Zotero.File.putContentsAsync(file.path, cloud.content);
      const attachment = await Zotero.Attachments.importFromFile({
        file: file.path,
        parentItemID: result.article.id,
        title: "Nuvem de palavras — " + result.payload.title,
        contentType: "image/svg+xml"
      });
      if (this.active && this.windows.has(win)) await win.ZoteroPane.selectItem(attachment.id);
      return attachment;
    } finally {
      if (file.exists()) file.remove(false);
    }
  },

  async withBusy(win, fn) {
    const state = this.windows.get(win);
    if (!state || state.busy) return;
    state.busy = true;
    for (const node of state.nodes) node.disabled = true;
    try {
      await fn();
    } catch (error) {
      Zotero.logError(error);
      if (this.active && this.windows.has(win)) Services.prompt.alert(win, "Nuvem de palavras", error.message || String(error));
    } finally {
      state.busy = false;
      for (const node of state.nodes) node.disabled = false;
    }
  },

  // Um item: cria o anexo SVG no artigo e já abre a ferramenta.
  // Vários itens selecionados: abre a ferramenta direto (grava só se você clicar em "Salvar no Zotero").
  async run(win) {
    await this.withBusy(win, async () => {
      const selection = (win.ZoteroPane.getSelectedItems() || []).filter(i => !i.isNote());
      if (selection.length > 1) {
        const payload = await this.buildMultiPayload(win, selection, `${selection.length} itens selecionados`);
        if (!payload || !this.active) return;
        const cols = this.selectedCollections(win);
        this.openWindow(win, payload, { item: null, libraryID: payload.libraryID, collectionID: cols.length === 1 ? cols[0].id : null }, "multi:" + Date.now());
        return;
      }
      const result = await this.buildPayload(win, selection);
      if (!result || !this.active || !this.windows.has(win)) return;
      const attachment = await this.saveCloud(win, result);
      if (this.active) await this.openTool(win, attachment);
    });
  },

  async runCollection(win) {
    await this.withBusy(win, async () => {
      const cols = this.selectedCollections(win);
      if (!cols.length) throw new Error("Selecione uma coleção.");
      const items = new Map();
      for (const root of cols) {
        for (const c of [root, ...Zotero.Collections.getByParent(root.id, true)]) {
          for (const it of c.getChildItems()) items.set(it.id, it);
        }
      }
      const list = Array.from(items.values()).filter(i => i.isRegularItem() || (i.isAttachment() && i.attachmentContentType === "application/pdf"));
      if (!list.length) throw new Error("Esta coleção não tem itens com PDF.");
      const title = cols.length === 1 ? "Coleção: " + cols[0].name : `${cols.length} coleções`;
      const payload = await this.buildMultiPayload(win, list, title);
      if (!payload || !this.active) return;
      this.openWindow(win, payload, { item: null, libraryID: cols[0].libraryID, collectionID: cols.length === 1 ? cols[0].id : null }, "multi:" + Date.now());
    });
  }
};
