/* Fiche individuelle à imprimer ou à enregistrer en PDF. */
import { declarerActions } from '../../noyau/interface.js';
import { esc } from '../../noyau/outils.js';
import { NIVEAUX_FICHE, NIVEAUX_PROJET } from '../contenu/apsa.js';
import { score } from '../calculs/match.js';
import { indicateurs } from '../calculs/stats.js';
import { nomCote } from '../reglages.js';

const fenetre = () => document.querySelector('#impression');

declarerActions({
  'fiche-imprimer': () => window.print(),
  'fiche-fermer': () => {
    fenetre().hidden = true;
  },
});

export function afficherFiche(m, cote) {
  if (!m) return;
  const moi = esc(nomCote(m, cote));
  const autre = esc(nomCote(m, 1 - cote));
  const bilan = Object.entries(m.bilanProjet[cote]);
  const fiche = Object.entries(m.fiche[cote]);
  const projet = m.projets[cote];
  const conseil = m.conseils[cote];
  fenetre().innerHTML = `
    <div class="rangee non-imprime">
      <button class="btn" data-action="fiche-imprimer">Imprimer / PDF</button>
      <button class="btn secondaire" data-action="fiche-fermer">Fermer</button>
    </div>
    <h2>${moi} · ${esc(m.apsa)}</h2>
    <p>Contre ${autre} — score ${score(m, cote)}–${score(m, 1 - cote)}</p>
    <table>
      <tr><th>Indicateur</th><th>${moi}</th><th>${autre}</th></tr>
      ${indicateurs(m).map((l) => `<tr><td>${esc(l[0])}</td><td>${esc(l[1 + cote])}</td><td>${esc(l[2 - cote])}</td></tr>`).join('')}
    </table>
    ${bilan.length ? `<h3>Projet de jeu précédent</h3>${bilan.map(([p, n]) => `${esc(p)} : ${NIVEAUX_PROJET[n]}`).join('<br>')}` : ''}
    ${fiche.length ? `<h3>Fiche d'observation</h3>${fiche.map(([x, n]) => `${esc(x)} : ${NIVEAUX_FICHE[n - 1]}`).join('<br>')}` : ''}
    ${projet.length ? `<h3>Projet de jeu pour la prochaine rencontre</h3>${projet.map(esc).join('<br>')}` : ''}
    ${conseil ? `<h3>Conseil</h3>${esc(conseil)}` : ''}`;
  fenetre().hidden = false;
}
