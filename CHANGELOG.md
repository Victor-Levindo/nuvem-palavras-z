# Alterações

## 0.9.4 — 2026-10-01

Corrige a falha de inicialização da 0.9.3: o campo interno de texto agora existe antes da execução dos scripts que geram a nuvem. Mantém a reorganização da interface, as sugestões abaixo da busca e a regra ampliada de conectores do `+`.

Inclui um teste que carrega o XHTML e os scripts reais na ordem de leitura, com DOM e APIs do Zotero simulados, verificando desenho inicial, consulta, inclusão de expressão, envio dos ajustes pelo salvamento original e idioma.
