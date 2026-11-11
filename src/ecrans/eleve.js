/*
 * Espace élève : identification facultative (classe, prénom, code à 4 chiffres),
 * progression personnelle et envoi des données. Identifié ou non, l'élève peut
 * toujours observer n'importe quel camarade : la performance va à l'élève observé.
 */
import { etat, sauver } from '../noyau/etat.js';
import { codeValide, eleveConnecte } from '../noyau/espace.js';
import { declarerActions, notifier, rafraichir, vue } from '../noyau/interface.js';
import { esc } from '../noyau/outils.js';
import { vueEleve } from '../champ4/ecrans/progression.js';
import { blocImportEleves } from '../champ4/ecrans/import-eleves.js';
import { vueEnvoyer } from '../transfert/ecrans.js';

let classeChoisie = '';
let eleveChoisi = '';

function seConnecter() {
  const eleve = etat.eleves.find((e) => e.id === eleveChoisi);
  const champ = document.querySelector('#code-eleve');
  if (!eleve) return notifier('Choisis ton prénom dans la liste.');
  if (!eleve.cle) return notifier("Ton code n'est pas encore sur cette tablette : demande à ton enseignant de mettre à jour la liste.");
  if (!codeValide(eleve, champ.value.trim())) {
    champ.value = '';
    return notifier('Code incorrect.');
  }
  etat.eleveConnecte = eleve.id;
  eleveChoisi = '';
  sauver();
  vue.ecran = 'accueil';
  rafraichir();
  notifier(`Bonjour ${eleve.nom} !`);
}

declarerActions({
  'cx-ouvrir': () => {
    vue.ecran = 'connexion';
    rafraichir();
  },
  'cx-classe': (_, champ) => {
    classeChoisie = champ.value;
    eleveChoisi = '';
    rafraichir();
  },
  'cx-eleve': (_, champ) => {
    eleveChoisi = champ.value;
    rafraichir();
    document.querySelector('#code-eleve')?.focus();
  },
  'cx-entrer': seConnecter,
  'cx-quitter': () => {
    etat.eleveConnecte = null;
    sauver();
    vue.ecran = 'accueil';
    rafraichir();
    notifier('Déconnecté.');
  },
  'ma-progression': () => {
    vue.ecran = eleveConnecte() ? 'ma-progression' : 'connexion';
    rafraichir();
  },
  'envoyer-donnees': () => {
    vue.ecran = 'envoi';
    rafraichir();
  },
  'liste-eleves': () => {
    vue.ecran = 'liste-eleves';
    rafraichir();
  },
});

/* Valider le code avec la touche Entrée. */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'code-eleve') seConnecter();
});

export function vueConnexion() {
  const classes = [...new Set(etat.eleves.map((e) => e.classe))].sort();
  if (!classes.length) {
    return `<div class="carte centre"><h2 class="carte-titre">🔑 M'identifier</h2>
      <p class="aide">Aucune liste d'élèves sur cette tablette. Importe-la d'abord (Liste des élèves).</p>
      <button class="btn" data-action="liste-eleves">👥 Liste des élèves</button></div>`;
  }
  const classe = classes.includes(classeChoisie) ? classeChoisie : '';
  const eleves = etat.eleves.filter((e) => e.classe === classe).sort((a, b) => a.nom.localeCompare(b.nom));
  return `<div class="carte carte-connexion"><h2 class="carte-titre">🔑 M'identifier</h2>
    <p class="aide">Identifié·e, tu peux voir ta progression, et tes observations portent ton nom. Tu peux toujours observer un ou une camarade : sa performance va dans sa progression à lui ou à elle.</p>
    <label class="etiquette" for="cx-classe">Ma classe</label>
    <select id="cx-classe" data-choix="cx-classe">
      <option value="">Choisis ta classe…</option>
      ${classes.map((c) => `<option ${c === classe ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>
    ${
      classe
        ? `<label class="etiquette" for="cx-eleve">Mon prénom</label>
      <select id="cx-eleve" data-choix="cx-eleve">
        <option value="">Choisis ton prénom…</option>
        ${eleves.map((e) => `<option value="${esc(e.id)}" ${e.id === eleveChoisi ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
      </select>`
        : ''
    }
    ${
      eleveChoisi
        ? `<label class="etiquette" for="code-eleve">Mon code à 4 chiffres</label>
      <input id="code-eleve" class="champ-code" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">
      <button class="btn bouton-large marge-haut" data-action="cx-entrer">Entrer</button>`
        : ''
    }
  </div>`;
}

export function vueMaProgression() {
  const eleve = eleveConnecte();
  if (!eleve) return vueConnexion();
  return `<div class="carte"><h2 class="carte-titre">📈 Ma progression <small>${esc(eleve.nom)} · ${esc(eleve.classe)}</small></h2>
      <p class="aide">Ce qui a été observé sur cette tablette. Ton enseignant a le dossier complet, avec les autres tablettes.</p></div>
    ${vueEleve(eleve)}`;
}

export const vueEnvoi = () => vueEnvoyer();

export const vueListeEleves = () => `
  <div class="carte"><h2 class="carte-titre">👥 Liste des élèves</h2>
    <p class="aide">${etat.eleves.length} élève${etat.eleves.length > 1 ? 's' : ''} sur cette tablette. Pour récupérer la liste publiée par l'enseignant (avec les codes), saisis le mot de passe qu'il te donne.</p>
    ${blocImportEleves()}
  </div>`;

/* Haut de l'accueil de l'espace élève. */
export function bandeauEleve() {
  const eleve = eleveConnecte();
  const outils = `<div class="rangee sans-marge">
      <button class="btn secondaire" data-action="envoyer-donnees">📤 Envoyer les données</button>
      <button class="btn secondaire" data-action="liste-eleves">👥 Liste des élèves</button>
    </div>`;
  if (eleve) {
    return `<div class="carte bandeau-eleve"><div class="bandeau-eleve-nom">👋 <b>${esc(eleve.nom)}</b> <small>${esc(eleve.classe)}</small></div>
      <div class="rangee sans-marge">
        <button class="btn" data-action="ma-progression">📈 Ma progression</button>
        <button class="btn secondaire" data-action="cx-quitter">Me déconnecter</button>
      </div>${outils}</div>`;
  }
  return `<div class="carte bandeau-eleve"><div class="bandeau-eleve-nom">Tu n'es pas identifié·e. <small>Tu peux quand même observer, arbitrer et coacher tes camarades.</small></div>
    <div class="rangee sans-marge"><button class="btn" data-action="cx-ouvrir">🔑 M'identifier</button></div>${outils}</div>`;
}
