/* Espace enseignant → Observables par APSA → Arts du cirque : les listes proposées aux élèves. */
import { etat, sauver } from '../noyau/etat.js';
import { declarerActions, notifier, rafraichir } from '../noyau/interface.js';
import { esc } from '../noyau/outils.js';
import { LISTES_CIRQUE } from './contenu.js';
import { listeCirque } from './calculs.js';

declarerActions({
  'cqr-liste': ({ liste }, champ) => {
    const lignes = champ.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    etat.reglages.cirque = { ...(etat.reglages.cirque || {}), [liste]: [...new Set(lignes)] };
    sauver();
  },
  'cqr-origine': ({ liste }) => {
    if (etat.reglages.cirque) delete etat.reglages.cirque[liste];
    sauver();
    rafraichir();
    notifier("Liste d'origine rétablie ✔");
  },
});

export const vueReglagesCirque = () => `
  <div class="carte"><h2 class="carte-titre">🎪 Arts du cirque</h2>
    <p class="aide">Une ligne par élément. Les élèves peuvent aussi ajouter leurs propres éléments dans leur troupe ou leur carnet. Les changements s'appliquent tout de suite ; pour les autres tablettes, exporte la configuration.</p>
    <div class="grille-reglages">${LISTES_CIRQUE.map(
      (l) => `<div><label class="etiquette" for="cqr-${l.id}">${l.titre}</label>
        <textarea id="cqr-${l.id}" rows="7" data-saisie="cqr-liste" data-liste="${l.id}">${esc(listeCirque(etat.reglages, l.id).join('\n'))}</textarea>
        ${etat.reglages.cirque?.[l.id] ? `<button class="btn-mini" data-action="cqr-origine" data-liste="${l.id}">Revenir à l'origine</button>` : ''}</div>`,
    ).join('')}</div>
  </div>`;
