import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { empreinte, esc, uid } from '../../noyau/outils.js';
import { APSA } from '../contenu/apsa.js';
import { exporterConfiguration, exporterElevesProteges } from '../donnees/export.js';
import { importerEleves } from '../donnees/operations.js';
import { aUnDefautChoisi, contratsApsa, criteresApsa, listeEditable } from '../reglages.js';
import { vueReglagesDemifond } from '../../demifond/ecrans/reglages.js';
import { vueReglagesCirque } from '../../cirque/reglages.js';
import { blocImportEleves } from './import-eleves.js';
import { vueProgression } from './progression.js';
import { vueEnvoyer, vueRecevoir } from '../../transfert/ecrans.js';
import { attribuerCodes, changerCode } from '../../noyau/espace.js';

const EMPREINTE_PAR_DEFAUT = '74id85';
const POINTS_MAX = 10;
const DEMIFOND = 'demifond'; // sport réglé à part : ses réglages ont leur propre écran
const CIRQUE = 'cirque'; // de même pour les arts du cirque

let pageEnseignant = 'menu';
let apsaEditee = null;
let messageImport = '';
let classeCodes = '';

export const pageEnseignantCourante = () => pageEnseignant;
export function ouvrirPageEnseignant(page) {
  pageEnseignant = page;
  if (page === 'eleves' && attribuerCodes(etat)) sauver();
}

/* Code de l'espace enseignant (celui déjà défini, modifiable dans « Code d'accès »). */
export const codeEnseignantValide = (code) => empreinte(code) === (etat.reglages.codeEmpreinte || EMPREINTE_PAR_DEFAUT);

/* Liste imprimable des codes, une classe par page. */
function imprimerCodes(classe) {
  const classes = classe ? [classe] : [...new Set(etat.eleves.map((e) => e.classe))].sort();
  const pages = classes
    .map((c) => {
      const lignes = etat.eleves
        .filter((e) => e.classe === c)
        .sort((a, b) => a.nom.localeCompare(b.nom))
        .map((e) => `<tr><td>${esc(e.nom)}</td><td class="code">${esc(etat.codesEleves?.[e.id] || '')}</td></tr>`)
        .join('');
      return `<section><h1>EPS + · Codes élèves · ${esc(c)}</h1><table><tr><th>Élève</th><th>Code</th></tr>${lignes}</table>
        <p>Chaque élève garde son code pour lui : il sert à s'identifier dans l'espace élève.</p></section>`;
    })
    .join('');
  const cadre = document.createElement('iframe');
  cadre.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(cadre);
  cadre.contentDocument.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Codes élèves</title>
    <style>body{font-family:sans-serif}section{page-break-after:always}table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #333;padding:10px 12px;text-align:left;font-size:16px}.code{font:700 22px monospace;letter-spacing:4px}</style>${pages}</html>`);
  cadre.contentDocument.close();
  setTimeout(() => {
    cadre.contentWindow.print();
    setTimeout(() => cadre.remove(), 1000);
  }, 300);
}

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
  'ens-code-classe': (_, champ) => {
    classeCodes = champ.value;
    rafraichir();
  },
  'ens-code-nouveau': async ({ id }) => {
    const eleve = etat.eleves.find((e) => e.id === id);
    const ok = await demander({
      titre: `Nouveau code pour ${eleve?.nom || 'cet élève'} ?`,
      texte: "L'ancien code ne marchera plus. Pense à recréer et déposer la liste protégée pour les autres tablettes.",
      confirmer: 'Nouveau code',
    });
    if (!ok) return;
    changerCode(etat, id);
    sauver();
    rafraichir();
  },
  'ens-imprimer-codes': ({ classe }) => imprimerCodes(classe || ''),
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
    ouvrirPageEnseignant(page);
    window.scrollTo(0, 0);
    rafraichir();
  },
  'ens-fiche-active': (_, champ) => {
    etat.reglages.ficheObservateurs = champ.checked;
    sauver();
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
  'ens-contrat-ajouter': ({ apsa }) => {
    etat.reglages.contrats[apsa] = [...contratsApsa(apsa), { id: `ctr${uid()}`, nom: 'Nouveau contrat', points: 1 }];
    sauver();
    rafraichir();
    [...document.querySelectorAll('[data-saisie="ens-contrat-nom"]')].pop()?.select();
  },
  'ens-contrat-nom': ({ apsa, rang }, champ) => {
    contratsApsa(apsa)[rang].nom = champ.value;
    sauver();
  },
  'ens-contrat-points': ({ apsa, rang, pas }) => {
    const contrat = contratsApsa(apsa)[rang];
    contrat.points = Math.min(POINTS_MAX, Math.max(1, contrat.points + Number(pas)));
    sauver();
    rafraichir();
  },
  'ens-contrat-retirer': ({ apsa, rang }) => {
    contratsApsa(apsa).splice(Number(rang), 1);
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
    attribuerCodes(etat);
    messageImport = `${ajoutes} élève${ajoutes > 1 ? 's' : ''} importé${ajoutes > 1 ? 's' : ''}, avec leur code.`;
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
    etat.codesEleves = {};
    messageImport = '';
    sauver();
    rafraichir();
  },
  'ens-publier-eleves': async () => {
    const champ = document.querySelector('#mot-de-passe-publication');
    if (!etat.eleves.length) return notifier("Importe d'abord une liste d'élèves.");
    if (champ.value.length < 10) return notifier('Choisis un mot de passe de 10 caractères ou plus.');
    attribuerCodes(etat);
    sauver();
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

const choixDuSport = (apsa) => `
  <div class="choix-sports" role="group" aria-label="Sport à régler">
    <button class="choix-sport ${apsa === DEMIFOND ? 'actif' : ''}" aria-pressed="${apsa === DEMIFOND}" data-action="ens-apsa" data-apsa="${DEMIFOND}"><span aria-hidden="true">🏃</span>Demi-fond</button>
    <button class="choix-sport ${apsa === CIRQUE ? 'actif' : ''}" aria-pressed="${apsa === CIRQUE}" data-action="ens-apsa" data-apsa="${CIRQUE}"><span aria-hidden="true">🎪</span>Arts du cirque</button>
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

function carteContratsEnseignant(apsa, a) {
  const tuiles = contratsApsa(apsa)
    .map((c, rang) => {
      const reperes = `data-apsa="${a}" data-rang="${rang}"`;
      return `<div class="tuile-critere positif">
        <input value="${esc(c.nom)}" aria-label="Nom du contrat" placeholder="Nom du contrat" data-saisie="ens-contrat-nom" ${reperes}>
        <div class="tuile-critere-bas">
          <span class="etiquette-points">Points</span>
          <button class="btn-rond" aria-label="Retirer un point à ${esc(c.nom)}" ${c.points <= 1 ? 'disabled' : ''} data-action="ens-contrat-points" data-pas="-1" ${reperes}>−</button>
          <b class="valeur-points">+${c.points}</b>
          <button class="btn-rond" aria-label="Ajouter un point à ${esc(c.nom)}" ${c.points >= POINTS_MAX ? 'disabled' : ''} data-action="ens-contrat-points" data-pas="1" ${reperes}>+</button>
          <button class="btn-rond supprimer" aria-label="Supprimer ${esc(c.nom)}" data-action="ens-contrat-retirer" ${reperes}>✕</button>
        </div>
      </div>`;
    })
    .join('');
  return `<div class="carte"><h2 class="carte-titre">⭐ Contrats <small>${a}</small></h2>
    <p class="aide">Chaque contrat créé est proposé à l'élève sur l'écran du match, en plus des coups gagnants ci-dessus. S'il le choisit, un bouton ⭐ à son nom apparaît de son côté. Les changements s'appliquent aux prochains matchs.</p>
    ${tuiles ? `<div class="grille-criteres">${tuiles}</div>` : ''}
    <button class="btn" data-action="ens-contrat-ajouter" data-apsa="${a}">＋ Créer un contrat</button>
  </div>`;
}

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
  <div class="carte"><h2 class="carte-titre">⚙️ Options des matchs</h2>
    <p class="aide">Pour tous les sports.</p>
    <label class="case"><input type="checkbox" ${etat.reglages.ficheObservateurs !== false ? 'checked' : ''} data-choix="ens-fiche-active">📋 Fiche d'observation des observateurs en fin de match</label>
    <label class="case marge-haut"><input type="checkbox" ${etat.reglages.conseil ? 'checked' : ''} data-choix="ens-conseil">Projet de jeu et conseil de fin de match</label>
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
    <p class="aide">1. Choisis un mot de passe et crée le fichier protégé (il contient les élèves et une empreinte de leur code, jamais le code lisible). 2. Dépose-le sur le site, à côté de index.html. 3. Sur chaque tablette : espace élève, « Liste des élèves », mot de passe, puis « Importer les élèves ». Le mot de passe n'est enregistré nulle part : retiens-le bien.</p>
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

/* Codes à 4 chiffres des élèves, par classe. */
function carteCodes() {
  const classes = [...new Set(etat.eleves.map((e) => e.classe))].sort();
  if (!classes.length) return '';
  const classe = classes.includes(classeCodes) ? classeCodes : classes[0];
  const lignes = etat.eleves
    .filter((e) => e.classe === classe)
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map(
      (e) => `<tr><td>${esc(e.nom)}</td><td class="code-eleve">${esc(etat.codesEleves?.[e.id] || '–')}</td>
        <td><button class="btn-mini" data-action="ens-code-nouveau" data-id="${esc(e.id)}">🔄 Nouveau code</button></td></tr>`,
    )
    .join('');
  return `<div class="carte carte-large"><h2 class="carte-titre">🔢 Codes des élèves</h2>
    <p class="aide">Chaque élève s'identifie dans l'espace élève avec ce code. Les codes lisibles ne sont que sur cette tablette. Après un import ou un nouveau code, recrée la liste protégée (carte ci-dessous) et dépose-la sur le site : les autres tablettes y prennent les codes.</p>
    <div class="rangee">
      <select data-choix="ens-code-classe" aria-label="Classe">${classes.map((c) => `<option ${c === classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="btn secondaire" data-action="ens-imprimer-codes" data-classe="${esc(classe)}">🖨️ Imprimer cette classe</button>
      <button class="btn secondaire" data-action="ens-imprimer-codes">🖨️ Imprimer toutes les classes</button>
    </div>
    <div class="defile"><table class="table-codes"><tr><th>Élève</th><th>Code</th><th></th></tr>${lignes}</table></div>
  </div>`;
}

const PAGES = [
  { id: 'activites', icone: '🏅', titre: 'Activités', texte: 'Observer, chronométrer, PhotoFinish' },
  { id: 'eleves', icone: '👥', titre: 'Gestion des élèves', texte: 'Listes, codes, liste protégée' },
  { id: 'observables', icone: '👁️', titre: 'Observables par APSA', texte: 'Critères, contrats, fiches, options' },
  { id: 'progression', icone: '📈', titre: 'Progression des élèves', texte: 'Dossier de chaque élève' },
  { id: 'recevoir', icone: '🔄', titre: 'Échanger les données', texte: 'Recevoir des tablettes, renvoyer aux élèves' },
  { id: 'code', icone: '🔑', titre: "Code d'accès", texte: "Code de l'espace enseignant" },
];
export const titrePageEnseignant = () => PAGES.find((p) => p.id === pageEnseignant)?.titre || 'Espace enseignant';

const vueMenu = () => `
  <div class="accueil-titre"><h2>Espace enseignant</h2><p>Que veux-tu faire ?</p></div>
  <div class="grille-menu">${PAGES.map(
    (p) => `<button class="tuile-menu" ${p.id === 'activites' ? 'data-action="ens-activites"' : `data-action="ens-page" data-page="${p.id}"`}>
      <span class="tuile-icone">${p.icone}</span><b>${p.titre}</b><small>${p.texte}</small></button>`,
  ).join('')}</div>
  <div class="marge-haut">${carteSynchro()}</div>`;

function vueObservables() {
  const apsa = apsaEditee === DEMIFOND || apsaEditee === CIRQUE || APSA[apsaEditee] ? apsaEditee : etat.apsa || DEMIFOND;
  apsaEditee = apsa;
  const a = esc(apsa);
  return `${choixDuSport(apsa)}
    ${
      apsa === DEMIFOND
        ? vueReglagesDemifond()
        : apsa === CIRQUE
          ? vueReglagesCirque()
          : `${carteCriteres(apsa, a)}
           ${APSA[apsa].terrain ? carteContratsEnseignant(apsa, a) : ''}
           <div class="grille-reglages">
             ${carteListe('fiche', "📋 Fiche d'observation", "Critère de la fiche d'observation", apsa, a)}
             ${carteListe('projets', '🎯 Projets de jeu proposés', 'Projet de jeu', apsa, a)}
           </div>`
    }`;
}

export function vueEnseignant() {
  const titre = (texte) => `<h2 class="titre-section">${texte}</h2>`;
  switch (pageEnseignant) {
    case 'eleves':
      return `${titre('👥 Gestion des élèves')}<div class="grille-reglages">${carteEleves()}${carteCodes()}${carteEnvoiEleves()}</div>`;
    case 'observables':
      return `${titre('👁️ Observables par APSA')}${vueObservables()}${carteOptions()}`;
    case 'progression':
      return vueProgression();
    case 'recevoir':
      return `${titre('🔄 Échanger les données')}${vueRecevoir()}${vueEnvoyer()}`;
    case 'code':
      return `${titre("🔑 Code d'accès")}${carteCode()}`;
    default:
      return vueMenu();
  }
}
