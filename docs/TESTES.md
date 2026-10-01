# Testes locais

Execute na raiz do projeto com Node.js:

```bash
node tests/counts.cjs
node tests/connectors.cjs
node tests/plugin-payload.cjs
node tests/comparison-ui.cjs
node tests/simple-interface.cjs
node tests/window-load.cjs
```

O teste de carregamento completo exige os pacotes `xml-js` e `@napi-rs/canvas`. O teste de contagem usa `@napi-rs/canvas` para conferir o SVG; sem ele, só essa etapa é indicada como ignorada. Os testes usam DOM e APIs do Zotero simulados. O carregamento lê o XHTML e os scripts reais em ordem de leitura, com canvas real para medir o texto.

A instalação, abertura e exportação no Zotero precisam ser verificadas no aplicativo. Use PDFs com texto e teste um item e vários itens, consulta com palavra e expressão, inclusão de expressão, salvar/reabrir, exportar e trocar idioma.
