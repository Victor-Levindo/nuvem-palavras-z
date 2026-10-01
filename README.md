# Nuvem de Palavras Z

**Plugin para Zotero: nuvens de palavras e consulta de ocorrências por artigo.**

Autor: **Victor Hugo Levindo** · Versão **0.9.4**.

Crie uma visão do vocabulário de um ou mais PDFs, investigue palavras e expressões em cada artigo e guarde os ajustes numa nuvem vinculada ao Zotero.

![Exemplo de nuvem com texto fictício](docs/images/exemplo-nuvem.png)

*Imagem ilustrativa gerada pelo plugin com texto fictício; não é uma captura da interface.*

## Instalar

1. Baixe o [instalador nuvem-palavras-z-0.9.4.xpi](https://github.com/vhloliveirapucsp-hub/nuvem-palavras-z/releases/download/v0.9.4/nuvem-palavras-z-0.9.4.xpi) na [página da versão 0.9.4](https://github.com/vhloliveirapucsp-hub/nuvem-palavras-z/releases/tag/v0.9.4).
2. No Zotero, abra **Ferramentas → Plugins** e instale o arquivo `.xpi` a partir do gerenciador de plugins.
3. Reinicie o Zotero.

O instalador deve manter a extensão `.xpi`. O ZIP do código-fonte é destinado à consulta e ao desenvolvimento.

## Recursos

- Geração de nuvens de um artigo, de vários itens ou de uma coleção com PDFs disponíveis.
- Janela de ajuste dentro do Zotero e nuvem guardada como anexo SVG.
- Quantidade ajustável de 15 a 150 palavras e filtros de comprimento e frequência.
- Palavras ignoradas, remoção da seção de referências e agrupamento opcional de singular e plural.
- Consulta de palavra ou expressão por artigo, incluindo artigos analisados com zero ocorrências.
- Sugestões de expressões frequentes abaixo da busca e inclusão de expressões na nuvem.
- Exportação JPG, PNG, SVG e CSV de frequências ou contagens por artigo.
- Interface em português, inglês, espanhol, francês, alemão, chinês e japonês. O idioma da interface é separado dos filtros linguísticos.

## Como usar

Selecione um ou mais artigos e escolha **Criar nuvem de palavras** no menu de contexto. Em um único artigo, a nuvem é anexada ao registro; com vários itens, a ferramenta abre para análise e permite salvar pelo botão **Salvar no Zotero**.

Na seção **Consulta por artigo**, escreva uma palavra, como `dados`, ou uma expressão, como `proteção de dados`. A consulta preserva a lista de expressões da nuvem. Para acrescentar a expressão à imagem, use **Incluir expressão na nuvem**.

As expressões já cadastradas ficam em **Expressões incluídas na nuvem**. Edite a lista e use **Aplicar expressões**. **Salvar no Zotero** grava os ajustes; **Salvar como padrão** define os ajustes das próximas nuvens.

## Regra do `+`

Sem `+`, a expressão segue a sequência escrita. Com `+`, aceita zero ou mais conectores reconhecidos, mantendo a ordem dos termos.

| Consulta | Exemplos de correspondência |
| --- | --- |
| `direito + memória` | `direito à memória`, `direito de memória` |
| `proteção + dados` | `proteção de dados`, `proteção dos dados`, `proteção para os dados` |

A lista inclui preposições, artigos e contrações do português, como `a`, `à`, `às`, `o`, `os`, `de`, `das`, `dos`, `com`, `para`, `pelo` e `sobre`, além dos conectores ingleses já usados pelo plugin. O `+` mantém a ordem e não atravessa pontuação, palavras de conteúdo ou limites entre PDFs.

## Compatibilidade e estado dos testes

O manifesto declara **Zotero 10.0.x**. A referência de desenvolvimento fornecida pelo autor é **Windows 64-bit com Zotero 10.0.1**.

Na versão 0.9.4, passaram os testes automatizados de carregamento, contagem, consulta, metadados, envio dos dados de salvamento e troca de idioma. O DOM e as APIs do Zotero são simulados nesses testes; não equivalem a validação nativa da versão em todos os sistemas. A versão 0.9.3 tinha uma falha de ordem de carregamento, corrigida na 0.9.4.

- PDFs em imagem precisam conter texto reconhecido por OCR para a análise.
- Somente PDFs efetivamente analisados entram nas contagens.
- As consultas seguem os filtros atuais. A frequência mínima e o limite visual da nuvem não ocultam contagens de zero ou uma ocorrência por artigo.
- Nuvens geradas antes da 0.9.0 precisam ser recriadas para consulta por artigo.
- A frequência oferece pistas sobre o vocabulário; o contexto depende da leitura dos artigos.

Atualizações do plugin são instaladas manualmente.

## Relatar problemas

Abra uma **Issue** com a versão do plugin, versão do Zotero, sistema operacional, ação executada, resultado esperado e mensagem de erro. Uma captura da interface ou um pequeno texto de exemplo pode ajudar a reproduzir a falha.

## Desenvolvimento

O código do plugin está na raiz e em `content/`. Os arquivos publicados em `dist/` são instaladores. Para gerar o XPI a partir da fonte:

```bash
python3 scripts/build.py
```

Os testes locais e suas dependências estão descritos em [docs/TESTES.md](docs/TESTES.md). O código completo também pode ser lido em [um único TXT](docs/CODIGO-COMPLETO-0.9.4.txt).

---

## English

**Nuvem de Palavras Z** creates word clouds from one or more PDFs in Zotero and lets users look up term or expression counts by article. It includes phrase suggestions, optional phrase grouping in the cloud, an internal cloud-adjustment window, and JPG/PNG/SVG/CSV exports.

Download the `.xpi` installer above, install it through Zotero's plugin manager, and restart Zotero. The manifest targets Zotero 10.0.x. The development reference is Windows 64-bit with Zotero 10.0.1. Automated tests use simulated Zotero APIs and do not establish native compatibility on every platform.

The `+` operator accepts supported connectors between terms in their original order. For example, `proteção + dados` matches `proteção de dados` and `proteção dos dados`. Interface languages are Portuguese, English, Spanish, French, German, Chinese and Japanese; linguistic filters are configured separately.

Please report issues with your Zotero version, operating system, plugin version, steps to reproduce and any error message.
