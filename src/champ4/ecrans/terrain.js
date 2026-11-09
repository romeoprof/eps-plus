import { esc } from '../../noyau/outils.js';
import { TERRAINS } from '../contenu/terrains.js';
import { nomCote } from '../reglages.js';

/* Terrain horizontal : le côté A à gauche, le côté B à droite, le filet au milieu.
   Le dessin d'origine (100 × 160, vertical) est tourné d'un quart de tour.
   cellule(z) fournit le HTML de chaque zone (0 à 17). */
export function terrain(match, cellule) {
  const { svg, cadre } = TERRAINS[match.apsa];
  const [x, y, l, h] = cadre;
  const position = `left:${y / 1.6}%;top:${100 - x - l}%;width:${h / 1.6}%;height:${l}%`;
  /* La grille se remplit colonne par colonne, de haut en bas : mêmes zones qu'avant la rotation. */
  const zones = [];
  for (let rangee = 0; rangee < 6; rangee += 1) {
    for (let colonne = 2; colonne >= 0; colonne -= 1) {
      zones.push(cellule(rangee * 3 + colonne));
    }
  }
  return `<div class="terrain">
    <svg viewBox="0 0 160 100" aria-hidden="true"><g transform="translate(0,100) rotate(-90)">${svg}</g></svg>
    <div class="terrain-nom gauche">${esc(nomCote(match, 0))}</div>
    <div class="terrain-nom droite">${esc(nomCote(match, 1))}</div>
    <div class="terrain-zones" style="${position}">${zones.join('')}</div>
  </div>`;
}
