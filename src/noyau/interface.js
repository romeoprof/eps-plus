/* Navigation, actions des boutons, messages et demandes de confirmation. */
import { esc } from './outils.js';

export const vue = { ecran: 'accueil', onglet: 'match', ongletDF: 'coureurs' };

let dessiner = () => {};
export const definirDessin = (fonction) => {
  dessiner = fonction;
};
/* Les écrans qui gardent un élément vivant (vidéo de la caméra) le replacent après chaque dessin. */
const suites = [];
export const apresDessin = (fonction) => suites.push(fonction);
export const rafraichir = () => {
  dessiner();
  suites.forEach((f) => f());
};

/* Les écrans déclarent leurs actions ; le HTML les appelle avec
   data-action (clic), data-saisie (frappe) ou data-choix (changement). */
const actions = {};
export const declarerActions = (liste) => Object.assign(actions, liste);

function brancher(evenement, attribut) {
  document.addEventListener(evenement, (e) => {
    const cible = e.target.closest?.(`[${attribut}]`);
    if (!cible || cible.disabled) return;
    actions[cible.getAttribute(attribut)]?.(cible.dataset, cible);
  });
}

export function brancherEvenements() {
  brancher('click', 'data-action');
  brancher('input', 'data-saisie');
  brancher('change', 'data-choix');
}

let minuteurMessage;
export function notifier(texte) {
  const bulle = document.querySelector('#message');
  bulle.textContent = texte;
  bulle.classList.add('visible');
  clearTimeout(minuteurMessage);
  minuteurMessage = setTimeout(() => bulle.classList.remove('visible'), 2800);
}

/* Fenêtre de confirmation : renvoie une promesse vrai / faux. */
export function demander({ titre, texte, confirmer = 'Confirmer', danger = false }) {
  return new Promise((resoudre) => {
    const fond = document.createElement('div');
    fond.className = 'fenetre-fond';
    fond.innerHTML = `<div class="fenetre" role="dialog" aria-modal="true" aria-label="${esc(titre)}">
      <h2>${esc(titre)}</h2><p>${esc(texte)}</p>
      <div class="rangee fin">
        <button class="btn secondaire" data-reponse="non">Annuler</button>
        <button class="btn ${danger ? 'danger' : ''}" data-reponse="oui">${esc(confirmer)}</button>
      </div></div>`;
    fond.addEventListener('click', (e) => {
      const reponse = e.target.dataset?.reponse;
      if (!reponse) return;
      e.stopPropagation();
      fond.remove();
      resoudre(reponse === 'oui');
    });
    document.body.appendChild(fond);
  });
}
