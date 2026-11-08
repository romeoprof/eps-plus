import { etat, sauver } from '../../noyau/etat.js';
import { declarerActions, demander, notifier, rafraichir } from '../../noyau/interface.js';
import { empreinte, esc, uid } from '../../noyau/outils.js';
import { APSA } from '../contenu/apsa.js';
import { exporterConfiguration, exporterElevesProteges } from '../donnees/export.js';
import { importerEleves } from '../donnees/operations.js';
import { criteresApsa, ficheApsa, projetsApsa } from '../reglages.js';
import { blocImportEleves } from './import-eleves.js';

const EMPREINTE_PAR_DEFAUT = '74id85';

let deverrouille = false;
let apsaEditee = null;
let messageImport = '';

/* Copie les critères par défaut avant la première modification. */
function criteresModifiables(apsa) {
  if (!etat.reglages.criteres[apsa]) {
    etat.reglages.criteres[apsa] = criteresApsa(apsa).map((c) => ({ ...c }));
  }
  return etat.reglages.criteres[apsa];
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

const versLignes = (texte) => texte.split('\n').filter((l) => l.trim());

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
  'ens-verrouiller': () => {
    deverrouille = false;
    rafraichir();
  },
  'ens-conseil': (_, champ) => {
    etat.reglages.conseil = champ.checked;
    sauver();
  },
  'ens-apsa': (_, champ) => {
    apsaEditee = champ.value;
    rafraichir();
  },
  'ens-libelle': ({ apsa, rang }, champ) => {
    criteresModifiables(apsa)[rang].libelle = champ.value;
    sauver();
  },
  'ens-points': ({ apsa, rang }, champ) => {
    criteresModifiables(apsa)[rang].points = Number(champ.value) || 0;
    sauver();
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
  'ens-defaut': ({ apsa }) => {
    delete etat.reglages.criteres[apsa];
    sauver();
    rafraichir();
  },
  'ens-fiche': ({ apsa }, champ) => {
    etat.reglages.fiche[apsa] = versLignes(champ.value);
    sauver();
  },
  'ens-projets': ({ apsa }, champ) => {
    etat.reglages.projets[apsa] = versLignes(champ.value);
    sauver();
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

export function vueEnseignant() {
  if (!deverrouille) return vueVerrou();
  const apsa = apsaEditee && APSA[apsaEditee] ? apsaEditee : etat.apsa || Object.keys(APSA)[0];
  apsaEditee = apsa;
  const a = esc(apsa);
  const nbClasses = new Set(etat.eleves.map((e) => e.classe)).size;
  return `
    <div class="carte"><label class="case"><input type="checkbox" ${etat.reglages.conseil ? 'checked' : ''} data-choix="ens-conseil">Projet de jeu et conseil de fin de match</label></div>

    <div class="carte"><h2 class="carte-titre">Critères observables</h2>
      <select data-choix="ens-apsa">${Object.keys(APSA).map((k) => `<option ${k === apsa ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <p class="aide">Points : positif = pour l'équipe, négatif = pour l'adversaire, 0 = sans point. Les changements s'appliquent aux prochains matchs, jamais à ceux déjà commencés.</p>
      ${criteresApsa(apsa)
        .map(
          (c, rang) => `<div class="rangee ligne-critere">
            <input class="etire" value="${esc(c.libelle)}" aria-label="Libellé" data-saisie="ens-libelle" data-apsa="${a}" data-rang="${rang}">
            <input class="points" type="number" min="-10" max="10" value="${c.points}" aria-label="Points" data-choix="ens-points" data-apsa="${a}" data-rang="${rang}">
            <button class="btn secondaire" data-action="ens-retirer" data-apsa="${a}" data-rang="${rang}">Supprimer</button>
          </div>`,
        )
        .join('')}
      <div class="rangee">
        <button class="btn" data-action="ens-ajouter" data-apsa="${a}">Ajouter un critère</button>
        <button class="btn secondaire" data-action="ens-defaut" data-apsa="${a}">Rétablir par défaut</button>
      </div>
    </div>

    <div class="carte"><h2 class="carte-titre">📋 Critères de la fiche d'observation <small>${a}, un par ligne</small></h2>
      <textarea rows="6" data-saisie="ens-fiche" data-apsa="${a}">${esc(ficheApsa(apsa).join('\n'))}</textarea>
    </div>

    <div class="carte"><h2 class="carte-titre">🎯 Projets de jeu proposés <small>${a}, un par ligne</small></h2>
      <textarea rows="6" data-saisie="ens-projets" data-apsa="${a}">${esc(projetsApsa(apsa).join('\n'))}</textarea>
    </div>

    <div class="carte"><h2 class="carte-titre">👥 Listes d'élèves (CSV)</h2>
      <p class="aide">Colonnes : Nom ; Prénom ; Classe. Seuls le prénom et l'initiale du nom sont conservés (ex. : Léa M.).</p>
      <p><b>${etat.eleves.length} élève${etat.eleves.length > 1 ? 's' : ''}</b> dans ${nbClasses} classe${nbClasses > 1 ? 's' : ''}. ${esc(messageImport)}</p>
      <div class="rangee">
        <label class="btn">Importer un CSV<input type="file" accept=".csv,.txt" hidden data-choix="ens-csv"></label>
        <button class="btn secondaire" data-action="ens-vider-eleves">Supprimer les élèves importés</button>
      </div>
    </div>

    <div class="carte"><h2 class="carte-titre">🔐 Envoyer la liste aux autres tablettes</h2>
      <p class="aide">1. Choisis un mot de passe et crée le fichier protégé. 2. Dépose ce fichier sur le site, à côté de index.html. 3. Sur chaque tablette : onglet Équipes, mot de passe, puis « Importer les élèves ». Le mot de passe n'est enregistré nulle part : retiens-le bien.</p>
      <div class="rangee">
        <input id="mot-de-passe-publication" class="etire" type="password" autocomplete="new-password" placeholder="Mot de passe (10 caractères ou plus)" aria-label="Mot de passe de la liste">
        <button class="btn" data-action="ens-publier-eleves">Créer le fichier protégé</button>
      </div>
      <p class="aide">Cette tablette peut aussi récupérer la liste publiée :</p>
      ${blocImportEleves()}
    </div>

    <div class="carte"><h2 class="carte-titre">🔄 Synchronisation des réglages</h2>
      <p class="aide">Après tes modifications, exporte la configuration, puis dépose-la sur le site à côté de index.html. Les tablettes la récupèrent avec le bouton « Mise à jour ». Elle ne contient aucun élève.</p>
      <button class="btn" data-action="ens-exporter">Exporter la configuration (config.json)</button>
      <p class="aide">Configuration appliquée sur cet appareil : ${etat.configVersion ? new Date(etat.configVersion).toLocaleString('fr-FR') : 'aucune'}</p>
    </div>

    <div class="carte"><h2 class="carte-titre">🔑 Changer le code d'accès</h2>
      <p class="aide">Ce code évite les modifications par erreur, mais ne protège pas des données sensibles.</p>
      <div class="rangee">
        <input id="nouveau-code" class="etire" type="password" autocomplete="new-password" placeholder="Nouveau code">
        <button class="btn secondaire" data-action="ens-code">Enregistrer</button>
      </div>
    </div>

    <button class="btn secondaire" data-action="ens-verrouiller">Verrouiller</button>`;
}
