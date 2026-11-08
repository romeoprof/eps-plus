import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir, vue } from '../../noyau/interface.js';
import { esc, uid } from '../../noyau/outils.js';
import { classer } from '../calculs/classement.js';
import { score } from '../calculs/match.js';
import { nouveauMatch } from '../donnees/modele.js';
import { equipesActives, nomEquipe } from '../reglages.js';

function creerPoule() {
  const ids = [...document.querySelectorAll('.choix-poule:checked')].map((c) => c.value);
  if (ids.length < 2) return notifier('Choisis au moins 2 équipes.');
  const poule = {
    id: uid(),
    nom: document.querySelector('#nom-poule').value.trim() || 'Poule',
    apsa: etat.apsa,
    equipes: ids,
  };
  etat.poules.push(poule);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      etat.matchs.push(nouveauMatch(etat.apsa, ids[i], ids[j], poule.id));
    }
  }
  sauver();
  rafraichir();
}

async function supprimerPoule({ id }) {
  const ok = await demander({
    titre: 'Supprimer cette poule ?',
    texte: 'La poule et tous ses matchs seront effacés.',
    confirmer: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  etat.poules = etat.poules.filter((p) => p.id !== id);
  etat.matchs = etat.matchs.filter((m) => m.pouleId !== id);
  etat.matchCourant = null;
  sauver();
  rafraichir();
}

declarerActions({
  'poule-creer': creerPoule,
  'poule-supprimer': supprimerPoule,
  'poule-jouer': ({ id }) => {
    etat.matchCourant = id;
    vue.onglet = 'match';
    sauver();
    rafraichir();
  },
});

function choixEquipes() {
  const parClasse = {};
  equipesActives().forEach((t) => {
    const classe = t.classe || 'Sans classe';
    (parClasse[classe] = parClasse[classe] || []).push(t);
  });
  return (
    Object.keys(parClasse)
      .sort()
      .map(
        (classe) => `<label class="etiquette">${esc(classe)}</label><div class="pastilles">${parClasse[classe]
          .sort((a, b) => a.nom.localeCompare(b.nom))
          .map((t) => `<label class="pastille"><input type="checkbox" class="choix-poule" value="${esc(t.id)}">${esc(t.nom)}</label>`)
          .join('')}</div>`,
      )
      .join('') || `<p class="aide">Ajoute d'abord des équipes.</p>`
  );
}

function cartePoule(poule) {
  const matchs = etat.matchs.filter((m) => m.pouleId === poule.id);
  return `<div class="carte">
    <h2 class="carte-titre">🏆 ${esc(poule.nom)} <small>victoires, puis différence de score</small></h2>
    <div class="defile"><table>
      <tr><th>Équipe</th><th>J</th><th>V</th><th>N</th><th>D</th><th>+/-</th></tr>
      ${classer(poule, etat.matchs)
        .map(
          (l, rang) => `<tr><td>${rang + 1}. ${esc(nomEquipe(l.id))}</td><td>${l.joues}</td><td>${l.victoires}</td><td>${l.nuls}</td><td>${l.defaites}</td><td>${l.difference}</td></tr>`,
        )
        .join('')}
    </table></div>
    ${matchs
      .map(
        (m) => `<div class="rangee ligne-match">
          <span class="etire">${esc(nomEquipe(m.a))} – ${esc(nomEquipe(m.b))}${m.termine ? ` <b>${score(m, 0)}-${score(m, 1)}</b>` : ''}</span>
          <button class="btn ${m.termine ? 'secondaire' : ''}" data-action="poule-jouer" data-id="${esc(m.id)}">${m.termine ? 'Revoir' : 'Jouer le match'}</button>
        </div>`,
      )
      .join('')}
    <button class="btn secondaire" data-action="poule-supprimer" data-id="${esc(poule.id)}">Supprimer la poule</button>
  </div>`;
}

export const vuePoules = () => `
  <div class="carte"><h2 class="carte-titre">🏆 Créer une poule</h2>
    <input id="nom-poule" placeholder="Nom de la poule (ex. Poule A)">
    ${choixEquipes()}
    <button class="btn" data-action="poule-creer">Créer la poule</button>
  </div>
  ${etat.poules.filter((p) => p.apsa === etat.apsa).map(cartePoule).join('')}`;
