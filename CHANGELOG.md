# Alterações

## 0.10.0 — entrega registrada em 2026-10-06

**Disponibilidade:** entregue separadamente. Ainda não publicada como release neste repositório, cujo código-fonte, manifesto e download continuam na 0.9.4.

### Adicionado em relação à 0.9.4

- Opção separada no menu do botão direito para criar nuvens com **tags inseridas manualmente** no Zotero, a partir de itens ou coleções, sem exigir PDFs. Tags automáticas ficam excluídas.
- Aba de **palavras-chave declaradas pelos autores nos PDFs**, preenchida automaticamente ao gerar a nuvem, também para coleções e subcoleções.
- Duas medidas para as palavras-chave: **artigos declarantes** e **ocorrências no texto**.
- Identificação do artigo/PDF de origem, lista declarada por documento, contagem individual, ação **Ver no Zotero** e exportação CSV.

### Regras de contagem

- Um artigo conta uma vez como declarante de cada termo, mesmo que o termo se repita em sua lista de palavras-chave.
- As ocorrências no texto podem incluir artigos que usam o termo sem declará-lo como palavra-chave.
- A identificação das palavras-chave depende do texto extraível e do reconhecimento da lista no PDF. Documentos somente em imagem precisam de OCR.

### Recursos preservados

A nuvem do texto dos PDFs, a consulta por artigo, as expressões compostas, as sugestões de expressões, os filtros, o salvamento e as exportações já existiam na 0.9.4. Não são novidades da 0.10.0.

### Validação registrada na entrega

Foram registrados testes de contagem, controles, salvamento, exportação CSV e fluxos com ambiente/APIs do Zotero simulados. A instalação e a interface nativa ainda precisam de verificação no Zotero desktop. Esta atualização do histórico não realizou uma nova validação do instalador.

## 0.9.4 — 2026-10-01

Corrige a falha de inicialização da 0.9.3: o campo interno de texto agora existe antes da execução dos scripts que geram a nuvem. Mantém a reorganização da interface, as sugestões abaixo da busca e a regra ampliada de conectores do `+`.

Inclui um teste que carrega o XHTML e os scripts reais na ordem de leitura, com DOM e APIs do Zotero simulados, verificando desenho inicial, consulta, inclusão de expressão, envio dos ajustes pelo salvamento original e idioma.
