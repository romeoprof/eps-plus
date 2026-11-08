/* Onglet Coureurs : VMA de chaque élève et choix des coureurs de la prochaine course. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, notifier, rafraichir } from '../../noyau/interface.js';
import { esc, uid } from '../../noyau/outils.js';
import { MAX_COUREURS } from '../contenu.js';
import { coureurDe, ficheCoureur, lireVma, tousLesCoureurs } from '../etat.js';

let classeChoisie = '';
let voirArchives = false;

declarerActions({
  'df-classe': (_, champ) => {
    classeChoisie = champ.value;
    rafraichir();
  },
  'df-archives': (_, champ) => {
    voirArchives = champ.checked;
    rafraichir();
  },
  'df-choisir': ({ id }, champ) => {
    const selection = etat.prepCourse.selection.filter((x) => x !== id);
    if (champ.checked) {
      if (selection.length >= MAX_COUREURS) {
        champ.checked = false;
        return notifier(`${MAX_COUREURS} coureurs maximum par tablette.`);
      }
      selection.push(id);
    }
    etat.prepCourse.selection = selection;
    sauver();
    rafraichir();
  },
  'df-vma': ({ id }, champ) => {
    const fiche = ficheCoureur(id) || coureurDe(id);
    if (!fiche) return;
    fiche.vma = lireVma(champ.value);
    if (champ.value && fiche.vma == null) notifier('VMA attendue entre 4 et 30 km/h.');
    sauver();
    rafraichir();
  },
  'df-archiver': ({ id }) => {
    const fiche = ficheCoureur(id) || coureurDe(id);
    if (!fiche) return;
    fiche.archive = !fiche.archive;
    if (fiche.archive) etat.prepCourse.selection = etat.prepCourse.selection.filter((x) => x !== id);
    sauver();
    rafraichir();
  },
  'df-ajouter': () => {
    const nom = document.querySelector('#df-nom').value.trim();
    const vma = lireVma(document.querySelector('#df-nouvelle-vma').value);
    if (!nom) return notifier('Saisis un nom.');
    if (vma == null) return notifier('VMA attendue entre 4 et 30 km/h.');
    etat.coureurs.push({ id: `c${uid()}`, eleveId: null, nom, classe: 'Sans classe', vma, archive: false });
    classeChoisie = 'Sans classe';
    sauver();
    rafraichir();
  },
});

function ligneCoureur(c) {
  const choisi = etat.prepCourse.selection.includes(c.id);
  return `<div class="ligne-coureur ${choisi ? 'choisi' : ''} ${c.archive ? 'archive' : ''}">
    <label class="ligne-coureur-nom">
      <input type="checkbox" ${choisi ? 'checked' : ''} ${c.vma ? '' : 'disabled'} data-choix="df-choisir" data-id="${esc(c.id)}" aria-label="Choisir ${esc(c.nom)}">
      <b>${esc(c.nom)}</b>
    </label>
    <label class="champ-vma">VMA
      <input type="text" inputmode="decimal" value="${c.vma ?? ''}" placeholder="–" aria-label="VMA de ${esc(c.nom)} en km/h" data-choix="df-vma" data-id="${esc(c.id)}">
    </label>
    <button class="btn-rond" aria-label="${c.archive ? 'Désarchiver' : 'Archiver'} ${esc(c.nom)}" title="${c.archive ? 'Désarchiver' : 'Archiver'}" data-action="df-archiver" data-id="${esc(c.id)}">${c.archive ? '↩' : '🗄'}</button>
  </div>`;
}

export function vueCoureurs() {
  const tous = tousLesCoureurs();
  const classes = [...new Set(tous.map((c) => c.classe))].sort();
  const classe = classes.includes(classeChoisie) ? classeChoisie : classes[0] || '';
  classeChoisie = classe;
  const liste = tous
    .filter((c) => c.classe === classe && c.archive === voirArchives)
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const nbChoisis = etat.prepCourse.selection.length;
  return `
    ${
      classes.length
        ? `<div class="carte">
            <h2 class="carte-titre">👥 Choisis les coureurs <small>${nbChoisis} / ${MAX_COUREURS} sélectionnés</small></h2>
            <div class="rangee">
              <select class="etire" data-choix="df-classe" aria-label="Classe">${classes.map((c) => `<option ${c === classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
              <label class="case"><input type="checkbox" ${voirArchives ? 'checked' : ''} data-choix="df-archives">Voir les archivés</label>
            </div>
            <p class="aide">Saisis la VMA en km/h, puis coche jusqu'à ${MAX_COUREURS} coureurs. La VMA reste enregistrée pour les prochaines courses.</p>
            <div class="grille-coureurs">${liste.map(ligneCoureur).join('') || '<p class="aide">Aucun coureur ici.</p>'}</div>
            ${nbChoisis ? `<button class="btn marge-haut" data-action="df-onglet" data-onglet="projet">Continuer vers le projet →</button>` : ''}
          </div>`
        : `<div class="carte centre"><p class="aide">Aucun élève sur cette tablette. La liste d'élèves et les VMA s'importent dans Espace enseignant → Demi-fond.</p></div>`
    }
    <div class="carte"><h2 class="carte-titre">➕ Coureur hors liste</h2>
      <p class="aide">Il peut courir, mais il n'est pas compté dans la Progression des élèves.</p>
      <div class="rangee sans-marge">
        <input id="df-nom" class="etire" placeholder="Nom" aria-label="Nom du coureur">
        <input id="df-nouvelle-vma" class="points" inputmode="decimal" placeholder="VMA" aria-label="VMA du coureur">
        <button class="btn secondaire" data-action="df-ajouter">Ajouter</button>
      </div>
    </div>`;
}
