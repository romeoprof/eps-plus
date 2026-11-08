import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { esc, uid } from '../../noyau/outils.js';
import { nombreDeMatchsJoues, supprimerEquipe } from '../donnees/operations.js';
import { equipesActives } from '../reglages.js';
import { blocImportEleves } from './import-eleves.js';

let classeChoisie = '';

function elevesCoches() {
  return [...document.querySelectorAll('.choix-eleve:checked')]
    .map((case_) => etat.eleves.find((e) => e.id === case_.value))
    .filter(Boolean);
}

function creerEquipe() {
  const eleves = elevesCoches();
  let nom = document.querySelector('#nom-equipe').value.trim();
  if (!nom) nom = eleves.length === 1 ? eleves[0].nom : eleves.length ? `Équipe ${etat.equipes.length + 1}` : '';
  if (!nom) return notifier('Saisis un nom ou choisis des élèves.');
  etat.equipes.push({ id: uid(), nom, classe: eleves.length ? classeChoisie : '', membres: eleves.map((e) => e.id) });
  sauver();
  rafraichir();
}

function creerIndividuels() {
  const eleves = elevesCoches();
  if (!eleves.length) return notifier('Coche au moins un élève.');
  eleves.forEach((e) => {
    if (!equipesActives().some((t) => t.nom === e.nom && t.classe === classeChoisie)) {
      etat.equipes.push({ id: uid(), nom: e.nom, classe: classeChoisie, membres: [e.id] });
    }
  });
  sauver();
  rafraichir();
}

async function supprimer({ id }) {
  const joues = nombreDeMatchsJoues(etat, id);
  if (joues) {
    const ok = await demander({
      titre: 'Supprimer cette équipe ?',
      texte: `Elle a déjà joué ${joues} match${joues > 1 ? 's' : ''}. Ses résultats resteront dans les bilans, mais elle ne sera plus proposée.`,
      confirmer: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
  }
  supprimerEquipe(etat, id);
  sauver();
  rafraichir();
}

declarerActions({
  'equipe-classe': (_, champ) => {
    classeChoisie = champ.value;
    rafraichir();
  },
  'equipe-creer': creerEquipe,
  'equipe-individuel': creerIndividuels,
  'equipe-supprimer': supprimer,
});

export function vueEquipes() {
  const classes = [...new Set(etat.eleves.map((e) => e.classe))].sort();
  const eleves = etat.eleves
    .filter((e) => e.classe === classeChoisie)
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const nomEleve = (id) => etat.eleves.find((e) => e.id === id)?.nom ?? '?';
  const equipes = equipesActives();

  const choixEleves = classes.length
    ? `<label class="etiquette">1. Choisis une classe</label>
       <select data-choix="equipe-classe">
         <option value="">Classe…</option>
         ${classes.map((c) => `<option ${c === classeChoisie ? 'selected' : ''}>${esc(c)}</option>`).join('')}
       </select>
       ${
         eleves.length
           ? `<label class="etiquette">2. Coche les élèves de l'équipe</label>
              <div class="pastilles">${eleves
                .map(
                  (e) => `<label class="pastille"><input type="checkbox" class="choix-eleve" value="${esc(e.id)}">${esc(e.nom)}</label>`,
                )
                .join('')}</div>`
           : ''
       }`
    : `<p class="aide">Aucune liste d'élèves sur cette tablette : importe-la ci-dessous, ou saisis un nom.</p>`;

  const carteImport = classes.length
    ? `<details class="carte"><summary><b>⬇ Mettre à jour la liste d'élèves</b></summary><br>${blocImportEleves()}</details>`
    : `<div class="carte"><h2 class="carte-titre">⬇ Importer les élèves</h2>${blocImportEleves()}</div>`;

  return `
    ${classes.length ? '' : carteImport}
    <div class="carte"><h2 class="carte-titre">👥 Créer une équipe ou un joueur</h2>
      ${choixEleves}
      <input id="nom-equipe" placeholder="Nom de l'équipe (facultatif si un seul élève)">
      <div class="rangee">
        <button class="btn" data-action="equipe-creer">Créer l'équipe / le joueur</button>
        ${classes.length ? `<button class="btn secondaire" data-action="equipe-individuel">Ajouter en individuel</button>` : ''}
      </div>
    </div>
    ${
      equipes
        .map(
          (t) => `<div class="carte rangee">
            <div class="etire"><b>${esc(t.nom)}</b>${t.classe ? ` <small>· ${esc(t.classe)}</small>` : ''}
              ${t.membres.length > 1 ? `<br><small>${t.membres.map((id) => esc(nomEleve(id))).join(', ')}</small>` : ''}
            </div>
            <button class="btn secondaire" data-action="equipe-supprimer" data-id="${esc(t.id)}">Supprimer</button>
          </div>`,
        )
        .join('') || `<p class="aide centre">Ajoute les équipes ou les joueurs qui vont jouer.</p>`
    }
    ${classes.length ? carteImport : ''}`;
}
