/* Apenas paleta quente; núcleo e métodos originais preservados. */
NuvemCore.COLORS.splice(0, NuvemCore.COLORS.length,
  '#76523f', '#a45f46', '#926b32', '#887044', '#875762', '#665046', '#aa7045');
// Expressões ficam na mesma paleta quente na janela e no SVG gravado.
NuvemCore.colorOf = (word, index) => NuvemCore.COLORS[index % NuvemCore.COLORS.length];
const originalNuvemSVG = NuvemCore.svg;
NuvemCore.svg = function(...args) {
  const result = originalNuvemSVG.apply(this, args);
  // Troca somente o atributo de cor original das expressões; metadados não são alterados.
  result.content = result.content.replace(/fill="#b3261e"/g, 'fill="#76523f"');
  return result;
};
