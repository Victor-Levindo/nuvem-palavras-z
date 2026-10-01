var NuvemPlugin;
var NuvemScope;
var NuvemChromeHandle;

function install() {}
function uninstall() {}

async function startup({ rootURI, id }) {
  await Zotero.initializationPromise;
  await Zotero.unlockPromise;
  await Zotero.uiReadyPromise;

  // Versão de instalação manual: sem atualização automática.
  try {
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const addon = await AddonManager.getAddonByID(id || "nuvem-palavras@victor-levindo.local");
    if (addon) addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DISABLE;
  } catch (error) { Zotero.logError(error); }

  // Registra chrome://nuvem-palavras/content/ -> pasta "content" do plugin.
  // É isso que permite abrir a ferramenta numa janela com permissões totais.
  const aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(Ci.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  NuvemChromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "nuvem-palavras", rootURI + "content/"]
  ]);

  NuvemScope = { Zotero, Services, Cc, Ci, ChromeUtils, IOUtils };
  Services.scriptloader.loadSubScript(rootURI + "content/core.js", NuvemScope);
  Services.scriptloader.loadSubScript(rootURI + "content/article-analysis.js", NuvemScope);
  Services.scriptloader.loadSubScript(rootURI + "content/theme.js", NuvemScope);
  Services.scriptloader.loadSubScript(rootURI + "plugin.js", NuvemScope);
  Services.scriptloader.loadSubScript(rootURI + "content/main-interface.js", NuvemScope);
  NuvemPlugin = NuvemScope.NuvemZotero;
  NuvemPlugin.iconURI = rootURI + "icon.svg";
  NuvemPlugin.installOpenHandler();
  for (let win of Zotero.getMainWindows()) NuvemPlugin.addWindow(win);
  Zotero.debug("[Nuvem] 0.9.4 iniciado");
}

function onMainWindowLoad({ window }) { NuvemPlugin?.addWindow(window); }
function onMainWindowUnload({ window }) { NuvemPlugin?.removeWindow(window); }

function shutdown() {
  NuvemPlugin?.shutdown();
  try { NuvemChromeHandle?.destruct(); } catch (error) { Zotero.logError(error); }
  NuvemChromeHandle = undefined;
  NuvemPlugin = undefined;
  NuvemScope = undefined;
}
