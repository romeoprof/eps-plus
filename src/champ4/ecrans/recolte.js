/* Espace enseignant : envoyer les résultats d'une tablette et récupérer ceux des autres. */
import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, notifier, rafraichir } from '../../noyau/interface.js';
import { esc, partagerFichier } from '../../noyau/outils.js';
import { courseAvecDonnees } from '../../demifond/calculs.js';
import { aDesResultats, creerFichierResultats, fusionnerResultats, lireFichierResultats } from '../donnees/fusion.js';

let compteRendu = [];

const deuxChiffres = (n) => String(n).padStart(2, '0');
function nomDuFichier() {
  const d = new Date();
  return `resultats-eps-${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}-${deuxChiffres(d.getHours())}h${deuxChiffres(d.getMinutes())}.txt`;
}

async function envoyer() {
  const champ = document.querySelector('#mot-de-passe-envoi');
  if (!aDesResultats(etat)) return notifier('Aucun résultat sur cette tablette.');
  if (champ.value.length < 10) return notifier('Choisis un mot de passe de 10 caractères ou plus.');
  const contenu = await creerFichierResultats(etat, champ.value);
  champ.value = '';
  const resultat = await partagerFichier(nomDuFichier(), contenu);
  if (resultat === 'telecharge') notifier('Fichier enregistré : envoie-le sur la tablette enseignant.');
  if (resultat === 'partage') notifier('Fichier envoyé ✔');
}

async function lireUnFichier(fichier, motDePasse) {
  try {
    const paquet = await lireFichierResultats(await fichier.text(), motDePasse);
    const { ajoutes, misAJour, dejaPresents } = fusionnerResultats(etat, paquet);
    return `${fichier.name} : ${ajoutes} ajouté(s), ${misAJour} mis à jour, ${dejaPresents} déjà présent(s)`;
  } catch {
    return `${fichier.name} : refusé (mot de passe incorrect ou fichier non reconnu)`;
  }
}

async function recuperer(_, champ) {
  const motDePasse = document.querySelector('#mot-de-passe-recolte').value;
  const fichiers = [...champ.files];
  champ.value = '';
  if (!fichiers.length) return;
  compteRendu = [];
  for (const fichier of fichiers) {
    compteRendu.push(await lireUnFichier(fichier, motDePasse));
  }
  sauver();
  rafraichir();
}

declarerActions({ 'recolte-envoyer': envoyer, 'recolte-recuperer': recuperer });

export function vueRecolte() {
  const observes = etat.matchs.filter((m) => m.evenements.length).length;
  const courses = etat.courses.filter(courseAvecDonnees).length;
  const tests = (etat.testsVma || []).length;
  const temps = (etat.tempsPf || []).length;
  return `
    <div class="carte"><h2 class="carte-titre">📤 Envoyer les résultats de cette tablette</h2>
      <p class="aide">À faire sur chaque tablette d'élèves. Le fichier est chiffré, puis tu l'envoies par Drive, Quick Share ou e-mail vers la tablette enseignant. Les résultats restent aussi sur cette tablette.</p>
      <p><b>${observes} match${observes > 1 ? 's' : ''} observé${observes > 1 ? 's' : ''}, ${courses} course${courses > 1 ? 's' : ''}, ${tests} test${tests > 1 ? 's' : ''} VMA et ${temps} temps PhotoFinish</b> sur cette tablette.</p>
      <div class="rangee">
        <input id="mot-de-passe-envoi" class="etire" type="password" autocomplete="new-password" placeholder="Mot de passe (10 caractères ou plus)" aria-label="Mot de passe du fichier de résultats">
        <button class="btn" data-action="recolte-envoyer">📤 Créer et envoyer le fichier</button>
      </div>
    </div>

    <div class="carte"><h2 class="carte-titre">📥 Récupérer les résultats des autres tablettes</h2>
      <p class="aide">À faire sur la tablette enseignant. Saisis le mot de passe, puis choisis un ou plusieurs fichiers reçus. Ils sont ajoutés à cette tablette sans rien effacer, et récupérer deux fois le même fichier ne crée pas de doublon.</p>
      <div class="rangee">
        <input id="mot-de-passe-recolte" class="etire" type="password" autocomplete="off" placeholder="Mot de passe des fichiers" aria-label="Mot de passe des fichiers de résultats">
        <label class="btn">📥 Choisir les fichiers<input type="file" accept=".txt,.json,text/plain,application/json" multiple hidden data-choix="recolte-recuperer"></label>
      </div>
      ${compteRendu.length ? `<ul class="compte-rendu">${compteRendu.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>`;
}
