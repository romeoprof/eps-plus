/* Menu principal : toutes les activités, rangées par famille. */
import { APSA } from '../champ4/contenu/apsa.js';
import { FAMILLES } from '../contenu/familles.js';
import { esc } from '../noyau/outils.js';

function tuile(activite, couleur) {
  const icone = activite.icone || APSA[activite.nom]?.icone || '';
  if (activite.bientot) {
    return `<div class="tuile-apsa ${couleur} inactive" aria-disabled="true">
      <span class="tuile-icone">${icone}</span>${esc(activite.nom)}<small>Bientôt intégré</small></div>`;
  }
  if (activite.module) {
    return `<button class="tuile-apsa ${couleur}" data-action="ouvrir-module" data-module="${esc(activite.module)}">
      <span class="tuile-icone">${icone}</span>${esc(activite.nom)}</button>`;
  }
  return `<button class="tuile-apsa ${couleur}" data-action="choisir-apsa" data-apsa="${esc(activite.nom)}">
    <span class="tuile-icone">${icone}</span>${esc(activite.nom)}</button>`;
}

export const vueAccueil = () => `
  <div class="accueil-titre">
    <h2>Que souhaites-tu faire aujourd'hui ?</h2>
    <p>Choisis une activité pour commencer</p>
  </div>
  ${FAMILLES.map(
    (famille) => `<section class="carte"><h2 class="carte-titre">${esc(famille.titre)}</h2>
      <div class="grille-apsa">${famille.activites.map((a) => tuile(a, famille.couleur)).join('')}</div>
    </section>`,
  ).join('')}`;
