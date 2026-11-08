import { esc } from '../../noyau/outils.js';
import { TERRAINS } from '../contenu/terrains.js';
import { nomCote } from '../reglages.js';

/* Dessine le terrain et sa grille de 18 zones ; cellule(z) fournit le HTML de chaque zone. */
export function terrain(match, cellule) {
  const { svg, cadre } = TERRAINS[match.apsa];
  const [x, y, l, h] = cadre;
  const position = `left:${x}%;top:${y / 1.6}%;width:${l}%;height:${h / 1.6}%`;
  const zones = Array.from({ length: 18 }, (_, z) => cellule(z)).join('');
  return `<div class="terrain">
    <svg viewBox="0 0 100 160" aria-hidden="true">${svg}</svg>
    <div class="terrain-nom" style="top:${y / 1.6 + 0.8}%">${esc(nomCote(match, 0))}</div>
    <div class="terrain-nom" style="bottom:${(160 - y - h) / 1.6 + 0.8}%">${esc(nomCote(match, 1))}</div>
    <div class="terrain-zones" style="${position}">${zones}</div>
  </div>`;
}
