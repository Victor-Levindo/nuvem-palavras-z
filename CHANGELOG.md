# Alterações

## 0.10.0 — publicação em 2026-10-20 (entrega inicial em 2026-10-06)

**Disponibilidade:** código-fonte e instalador XPI publicados na [release v0.10.0](https://github.com/Victor-Levindo/nuvem-palavras-z/releases/tag/v0.10.0). A release 0.9.4 permanece no histórico.

### Adicionado em relação à 0.9.4

- Opção separada no menu do botão direito para criar nuvens com **tags inseridas manualmente** no Zotero, a partir de itens ou coleções, sem exigir PDFs. Tags automáticas ficam excluídas.
- Aba de **palavras-chave declaradas pelos autores nos PDFs**, preenchida automaticamente ao gerar a nuvem, também para coleções e subcoleções.
- Duas medidas para as palavras-chave: **artigos declarantes** e **ocorrências no texto**.
- Identificação do artigo/PDF de origem, lista declarada por documento, contagem individual, ação **Ver no Zotero** e exportação CSV.

### Regras de contagem

- Um artigo conta uma vez como declarante de cada termo, mesmo que o termo se repita em sua lista de palavras-chave.
- As ocorrências incluem a própria lista declarada e podem incluir artigos que usam o termo sem declará-lo como palavra-chave.
- A identificação das palavras-chave depende do texto extraível e do reconhecimento da lista no PDF. Documentos somente em imagem precisam de OCR.

### Recursos preservados

A nuvem do texto dos PDFs, a consulta por artigo, as expressões compostas, as sugestões de expressões, os filtros, o salvamento e as exportações já existiam na 0.9.4. Não são novidades da 0.10.0.

### Verificações antes da publicação

- Integridade do arquivo XPI e manifesto 0.10.0.
- Sintaxe de todos os scripts JavaScript do pacote.
- Sete testes automatizados: contagens, conectores, payload do plugin, consulta por artigo, controles, carregamento real dos scripts do XHTML e análise de tags/palavras-chave (deduplicação por artigo, ocorrências, origem e CSV).
- Os testes usam DOM/APIs do Zotero simulados. A instalação e a interface nativa ainda precisam de verificação no Zotero desktop.
- Os testes da 0.9.4 foram adaptados para carregar o módulo novo e simular os métodos DOM adicionais; o código de execução do instalador entregue foi preservado.

## 0.9.4 — 2026-10-01

Corrige a falha de inicialização da 0.9.3: o campo interno de texto agora existe antes da execução dos scripts que geram a nuvem. Mantém a reorganização da interface, as sugestões abaixo da busca e a regra ampliada de conectores do `+`.

Inclui um teste que carrega o XHTML e os scripts reais na ordem de leitura, com DOM e APIs do Zotero simulados, verificando desenho inicial, consulta, inclusão de expressão, envio dos ajustes pelo salvamento original e idioma.

