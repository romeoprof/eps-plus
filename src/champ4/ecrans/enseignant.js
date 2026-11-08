import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { empreinte, esc, uid } from '../../noyau/outils.js';
import { APSA } from '../contenu/apsa.js';
import { exporterConfiguration, exporterElevesProteges } from '../donnees/export.js';
import { importerEleves } from '../donnees/operations.js';
import { aUnDefautChoisi, criteresApsa, listeEditable } from '../reglages.js';
import { blocImportEleves } from './import-eleves.js';
import { vueProgression } from './progression.js';
import { vueRecolte } from './recolte.js';

const EMPREINTE_PAR_DEFAUT = '74id85';
const POINTS_MAX = 10;

let deverrouille = false;
let pageEnseignant = 'reglages';
let apsaEditee = null;
let messageImport = '';

/* Copie les critères par défaut avant la première modification. */
function criteresModifiables(apsa) {
  if (!etat.reglages.criteres[apsa]) {
    etat.reglages.criteres[apsa] = criteresApsa(apsa).map((c) => ({ ...c }));
  }
  return etat.reglages.criteres[apsa];
}

/* Même principe pour la fiche d'observation et les projets de jeu. */
function listeModifiable(type, apsa) {
  if (!etat.reglages[type][apsa]) etat.reglages[type][apsa] = [...listeEditable(type, apsa)];
  return etat.reglages[type][apsa];
}

/* Les CSV d'Excel sont souvent en Windows-1252 : on évite ainsi les accents abîmés. */
async function lireTexte(fichier) {
  const octets = await fichier.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder('windows-1252').decode(octets);
  }
}

declarerActions({
  'ens-entrer': () => {
    const attendu = etat.reglages.codeEmpreinte || EMPREINTE_PAR_DEFAUT;
    if (empreinte(document.querySelector('#code').value) === attendu) {
      deverrouille = true;
      rafraichir();
    } else {
      notifier('Code incorrect.');
    }
  },
  'ens-bonus-actif': (_, champ) => {
    etat.reglages.contratBonus = champ.checked;
    sauver();
    rafraichir();
  },
  'ens-bonus-valeur': (_, champ) => {
    etat.reglages.contratValeur = Math.max(0, Number(champ.value) || 0);
    sauver();
  },
  'ens-page': ({ page }) => {
    pageEnseignant = page;
    rafraichir();
  },
  'ens-verrouiller': () => {
    deverrouille = false;
    rafraichir();
  },
  'ens-conseil': (_, champ) => {
    etat.reglages.conseil = champ.checked;
    sauver();
  },
  'ens-apsa': ({ apsa }) => {
    apsaEditee = apsa;
    rafraichir();
  },
  'ens-libelle': ({ apsa, rang }, champ) => {
    criteresModifiables(apsa)[rang].libelle = champ.value;
    sauver();
  },
  'ens-points-pas': ({ apsa, rang, pas }) => {
    const critere = criteresModifiables(apsa)[rang];
    critere.points = Math.min(POINTS_MAX, Math.max(-POINTS_MAX, critere.points + Number(pas)));
    sauver();
    rafraichir();
  },
  'ens-retirer': ({ apsa, rang }) => {
    criteresModifiables(apsa).splice(Number(rang), 1);
    sauver();
    rafraichir();
  },
  'ens-ajouter': ({ apsa }) => {
    criteresModifiables(apsa).push({ cle: `c${uid()}`, libelle: 'Nouveau critère', points: 0 });
    sauver();
    rafraichir();
  },
  'ens-definir-defaut': ({ type, apsa }) => {
    const defauts = etat.reglages.defauts;
    if (type === 'criteres') defauts.criteres[apsa] = criteresApsa(apsa).map((c) => ({ ...c }));
    else defauts[type][apsa] = listeEditable(type, apsa).filter((ligne) => ligne.trim());
    sauver();
    rafraichir();
    notifier(`Enregistré comme défaut pour ${apsa} ✔`);
  },
  'ens-retablir': ({ type, apsa }) => {
    delete etat.reglages[type][apsa];
    sauver();
    rafraichir();
    notifier('Valeurs par défaut rétablies ✔');
  },
  'ens-origine': async ({ type, apsa }) => {
    const ok = await demander({
      titre: "Revenir aux valeurs d'origine ?",
      texte: `Le défaut que tu as choisi pour ${apsa} sera effacé, ainsi que les modifications en cours de ce bloc.`,
      confirmer: "Revenir à l'origine",
      danger: true,
    });
    if (!ok) return;
    delete etat.reglages.defauts[type][apsa];
    delete etat.reglages[type][apsa];
    sauver();
    rafraichir();
  },
  'ens-ligne': ({ type, apsa, rang }, champ) => {
    listeModifiable(type, apsa)[rang] = champ.value;
    sauver();
  },
  'ens-ligne-retirer': ({ type, apsa, rang }) => {
    listeModifiable(type, apsa).splice(Number(rang), 1);
    sauver();
    rafraichir();
  },
  'ens-ligne-ajouter': ({ type, apsa }) => {
    listeModifiable(type, apsa).push('');
    sauver();
    rafraichir();
    [...document.querySelectorAll(`[data-saisie="ens-ligne"][data-type="${type}"]`)].pop()?.focus();
  },
  'ens-csv': async (_, champ) => {
    const fichier = champ.files[0];
    if (!fichier) return;
    const ajoutes = importerEleves(etat, await lireTexte(fichier));
    messageImport = `${ajoutes} élève${ajoutes > 1 ? 's' : ''} importé${ajoutes > 1 ? 's' : ''}.`;
    sauver();
    rafraichir();
  },
  'ens-vider-eleves': async () => {
    const ok = await demander({
      titre: 'Supprimer les élèves importés ?',
      texte: 'La liste sera effacée de cette tablette. Les équipes déjà créées sont conservées.',
      confirmer: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    etat.eleves = [];
    messageImport = '';
    sauver();
    rafraichir();
  },
  'ens-publier-eleves': async () => {
    const champ = document.querySelector('#mot-de-passe-publication');
    if (!etat.eleves.length) return notifier("Importe d'abord une liste d'élèves.");
    if (champ.value.length < 10) return notifier('Choisis un mot de passe de 10 caractères ou plus.');
    await exporterElevesProteges(etat, champ.value);
    champ.value = '';
    notifier('Fichier créé : dépose-le sur le site.');
  },
  'ens-exporter': () => {
    exporterConfiguration(etat);
    sauver();
    rafraichir();
  },
  'ens-code': () => {
    const champ = document.querySelector('#nouveau-code');
    if (champ.value.trim().length < 4) return notifier('Le code doit contenir au moins 4 caractères.');
    etat.reglages.codeEmpreinte = empreinte(champ.value.trim());
    champ.value = '';
    sauver();
    notifier('Code modifié ✔');
  },
});

const vueVerrou = () => `
  <div class="carte verrou"><h2 class="carte-titre">🔒 Espace enseignant</h2>
    <label class="etiquette" for="code">Code d'accès</label>
    <input id="code" type="password" inputmode="numeric" autocomplete="off" placeholder="Code">
    <button class="btn" data-action="ens-entrer">Entrer</button>
  </div>`;

const choixDuSport = (apsa) => `
  <div class="choix-sports" role="group" aria-label="Sport à régler">
    ${Object.keys(APSA)
      .map(
        (k) => `<button class="choix-sport ${k === apsa ? 'actif' : ''}" aria-pressed="${k === apsa}" data-action="ens-apsa" data-apsa="${esc(k)}"><span aria-hidden="true">${APSA[k].icone}</span>${esc(k)}</button>`,
      )
      .join('')}
  </div>`;

function tuileCritere(c, rang, a) {
  const signe = c.points > 0 ? 'positif' : c.points < 0 ? 'negatif' : 'neutre';
  const reperes = `data-apsa="${a}" data-rang="${rang}"`;
  return `<div class="tuile-critere ${signe}">
    <input value="${esc(c.libelle)}" aria-label="Nom du critère" data-saisie="ens-libelle" ${reperes}>
    <div class="tuile-critere-bas">
      <span class="etiquette-points">Points</span>
      <button class="btn-rond" aria-label="Retirer un point à ${esc(c.libelle)}" ${c.points <= -POINTS_MAX ? 'disabled' : ''} data-action="ens-points-pas" data-pas="-1" ${reperes}>−</button>
      <b class="valeur-points">${c.points > 0 ? '+' : ''}${c.points}</b>
      <button class="btn-rond" aria-label="Ajouter un point à ${esc(c.libelle)}" ${c.points >= POINTS_MAX ? 'disabled' : ''} data-action="ens-points-pas" data-pas="1" ${reperes}>+</button>
      <button class="btn-rond supprimer" aria-label="Supprimer ${esc(c.libelle)}" data-action="ens-retirer" ${reperes}>✕</button>
    </div>
  </div>`;
}

function boutonsDefaut(type, apsa, a) {
  const reperes = `data-type="${type}" data-apsa="${a}"`;
  return `<button class="btn secondaire" data-action="ens-definir-defaut" ${reperes}>📌 Définir par défaut</button>
    <button class="btn secondaire" data-action="ens-retablir" ${reperes}>Rétablir par défaut</button>
    ${aUnDefautChoisi(type, apsa) ? `<button class="btn secondaire" data-action="ens-origine" ${reperes}>Revenir à l'origine</button>` : ''}`;
}

const carteCriteres = (apsa, a) => `
  <div class="carte"><h2 class="carte-titre">👁️ Critères observables <small>${a}</small></h2>
    <p class="aide legende-points">
      <span class="pastille-signe positif">+ pour l'équipe</span>
      <span class="pastille-signe negatif">− pour l'adversaire</span>
      <span class="pastille-signe neutre">0 sans point</span>
      Les changements s'appliquent aux prochains matchs.
    </p>
    <div class="grille-criteres">${criteresApsa(apsa).map((c, rang) => tuileCritere(c, rang, a)).join('')}</div>
    <div class="rangee sans-marge">
      <button class="btn" data-action="ens-ajouter" data-apsa="${a}">＋ Ajouter un critère</button>
      ${boutonsDefaut('criteres', apsa, a)}
    </div>
  </div>`;

function carteListe(type, titre, description, apsa, a) {
  const reperes = `data-type="${type}" data-apsa="${a}"`;
  const lignes = listeEditable(type, apsa)
    .map(
      (texte, rang) => `<div class="case-liste">
        <span class="numero" aria-hidden="true">${rang + 1}</span>
        <textarea rows="2" placeholder="Écris ici…" aria-label="${esc(description)} ${rang + 1}" data-saisie="ens-ligne" ${reperes} data-rang="${rang}">${esc(texte)}</textarea>
        <button class="btn-rond supprimer" aria-label="Supprimer la ligne ${rang + 1}" data-action="ens-ligne-retirer" ${reperes} data-rang="${rang}">✕</button>
      </div>`,
    )
    .join('');
  return `<div class="carte"><h2 class="carte-titre">${titre} <small>${a}</small></h2>
    ${lignes || '<p class="aide">Aucune ligne pour ce sport.</p>'}
    <div class="rangee sans-marge">
      <button class="btn" data-action="ens-ligne-ajouter" ${reperes}>＋ Ajouter une ligne</button>
      ${boutonsDefaut(type, apsa, a)}
    </div>
  </div>`;
}

const carteOptions = () => `
  <div class="carte"><h2 class="carte-titre">⚙️ Options</h2>
    <label class="case"><input type="checkbox" ${etat.reglages.conseil ? 'checked' : ''} data-choix="ens-conseil">Projet de jeu et conseil de fin de match</label>
    <label class="case marge-haut"><input type="checkbox" ${etat.reglages.contratBonus ? 'checked' : ''} data-choix="ens-bonus-actif">⭐ Bonus chiffré pour le contrat</label>
    ${
      etat.reglages.contratBonus
        ? `<div class="rangee marge-haut sans-marge"><label class="etire" for="valeur-bonus">Bonus par point marqué selon le contrat</label>
           <input id="valeur-bonus" class="points" type="number" min="0" max="20" step="0.5" value="${Number(etat.reglages.contratValeur) || 0}" data-choix="ens-bonus-valeur"></div>`
        : ''
    }
    <p class="aide marge-haut">Le bonus s'affiche uniquement dans la page Progression. Le score des matchs ne change pas.</p>
  </div>`;

function carteEleves() {
  const nbClasses = new Set(etat.eleves.map((e) => e.classe)).size;
  return `<div class="carte"><h2 class="carte-titre">👥 Listes d'élèves (CSV)</h2>
    <p class="aide">Colonnes : Nom ; Prénom ; Classe. Seuls le prénom et l'initiale du nom sont conservés (ex. : Léa M.).</p>
    <p><b>${etat.eleves.length} élève${etat.eleves.length > 1 ? 's' : ''}</b> dans ${nbClasses} classe${nbClasses > 1 ? 's' : ''}. ${esc(messageImport)}</p>
    <div class="rangee sans-marge">
      <label class="btn">Importer un CSV<input type="file" accept=".csv,.txt" hidden data-choix="ens-csv"></label>
      <button class="btn secondaire" data-action="ens-vider-eleves">Supprimer les élèves</button>
    </div>
  </div>`;
}

const carteEnvoiEleves = () => `
  <div class="carte"><h2 class="carte-titre">🔐 Envoyer la liste aux autres tablettes</h2>
    <p class="aide">1. Choisis un mot de passe et crée le fichier protégé. 2. Dépose-le sur le site, à côté de index.html. 3. Sur chaque tablette : onglet Équipes, mot de passe, puis « Importer les élèves ». Le mot de passe n'est enregistré nulle part : retiens-le bien.</p>
    <div class="rangee">
      <input id="mot-de-passe-publication" class="etire" type="password" autocomplete="new-password" placeholder="Mot de passe (10 caractères ou plus)" aria-label="Mot de passe de la liste">
      <button class="btn" data-action="ens-publier-eleves">Créer le fichier protégé</button>
    </div>
    <p class="aide">Cette tablette peut aussi récupérer la liste publiée :</p>
    ${blocImportEleves()}
  </div>`;

const carteSynchro = () => `
  <div class="carte"><h2 class="carte-titre">🔄 Synchronisation des réglages</h2>
    <p class="aide">Après tes modifications, exporte la configuration, puis dépose-la sur le site à côté de index.html. Les tablettes la récupèrent avec le bouton « Mise à jour ». Elle ne contient aucun élève.</p>
    <button class="btn" data-action="ens-exporter">Exporter la configuration (config.json)</button>
    <p class="aide marge-haut">Configuration appliquée sur cet appareil : ${etat.configVersion ? new Date(etat.configVersion).toLocaleString('fr-FR') : 'aucune'}</p>
  </div>`;

const carteCode = () => `
  <div class="carte"><h2 class="carte-titre">🔑 Changer le code d'accès</h2>
    <p class="aide">Ce code évite les modifications par erreur, mais ne protège pas des données sensibles.</p>
    <div class="rangee sans-marge">
      <input id="nouveau-code" class="etire" type="password" autocomplete="new-password" placeholder="Nouveau code">
      <button class="btn secondaire" data-action="ens-code">Enregistrer</button>
    </div>
  </div>`;

export function vueEnseignant() {
  if (!deverrouille) return vueVerrou();
  const apsa = apsaEditee && APSA[apsaEditee] ? apsaEditee : etat.apsa || Object.keys(APSA)[0];
  apsaEditee = apsa;
  const a = esc(apsa);
  const onglet = (id, libelle) =>
    `<button role="tab" aria-selected="${pageEnseignant === id}" class="onglet ${pageEnseignant === id ? 'actif' : ''}" data-action="ens-page" data-page="${id}">${libelle}</button>`;
  const navigation = `<div class="onglets marge-bas" role="tablist">${onglet('reglages', '⚙️ Réglages')}${onglet('progression', '📈 Progression des élèves')}${onglet('recolte', '🔄 Récupérer les données')}</div>`;
  if (pageEnseignant === 'progression') return navigation + vueProgression();
  if (pageEnseignant === 'recolte') return navigation + vueRecolte();
  return `${navigation}
    <h2 class="titre-section">Réglages par sport</h2>
    ${choixDuSport(apsa)}
    ${carteCriteres(apsa, a)}
    <div class="grille-reglages">
      ${carteListe('fiche', "📋 Fiche d'observation", "Critère de la fiche d'observation", apsa, a)}
      ${carteListe('projets', '🎯 Projets de jeu proposés', 'Projet de jeu', apsa, a)}
    </div>
    <h2 class="titre-section">Réglages généraux</h2>
    <div class="grille-reglages">
      ${carteOptions()}
      ${carteEleves()}
      ${carteEnvoiEleves()}
      ${carteSynchro()}
      ${carteCode()}
    </div>
    <button class="btn secondaire" data-action="ens-verrouiller">🔒 Verrouiller</button>`;
}
