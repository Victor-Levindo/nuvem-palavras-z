# Nuvem de Palavras Z 0.10.0

Esta versão preserva a nuvem de texto dos PDFs e acrescenta duas formas de explorar os termos dos itens do Zotero.

## Novidades em relação à 0.9.4

- **Tags manuais:** opção separada no botão direito para criar nuvens a partir de itens ou coleções, sem exigir PDFs. Tags automáticas são excluídas.
- **Palavras-chave dos autores:** nova aba preenchida automaticamente a partir das listas declaradas nos PDFs, também na análise de coleções e subcoleções.
- **Duas contagens:** artigos que declaram cada palavra-chave e ocorrências nos textos analisados. As ocorrências incluem a lista de palavras-chave e também artigos que usam o termo sem declará-lo.
- **Origem dos termos:** artigo/PDF, lista declarada, contagens individuais, botão Ver no Zotero e exportação CSV.

Consulta por artigo, expressões compostas, sugestões, filtros, salvamento e exportações já existiam na 0.9.4 e continuam disponíveis.

## Instalação

Baixe `nuvem-palavras-z-0.10.0.xpi`, instale em **Ferramentas → Plugins** no Zotero e reinicie o aplicativo. Mantenha a extensão `.xpi`; os ZIPs de código-fonte não são o instalador.

## Compatibilidade e verificação

Manifesto: Zotero 10.0.x. Referência de desenvolvimento: Windows 64-bit, Zotero 10.0.1.

Integridade do XPI, manifesto e sintaxe JavaScript conferidos. Sete testes automatizados passaram com DOM/APIs do Zotero simulados, incluindo tags manuais, palavras-chave, contagens e origem/CSV. A instalação e a interface nativa ainda precisam de verificação no Zotero desktop.

A detecção de palavras-chave depende do texto extraível e da identificação das listas nos PDFs; documentos em imagem precisam de OCR. Atualizações são instaladas manualmente.

## English

Version 0.10.0 adds manual-tag clouds and an automatic tab for author-declared keywords detected in PDF text. It includes declaring-article counts, text occurrences, per-PDF origins, Zotero source navigation and CSV exports. Existing PDF word clouds and article lookup remain available. Download the XPI and install through Zotero's plugin manager. The manifest targets Zotero 10.0.x; automated tests use simulated Zotero APIs.

