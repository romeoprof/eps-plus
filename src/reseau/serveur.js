/*
 * Lien avec le serveur local de l'établissement (dossier serveur/).
 * Quand l'application est ouverte depuis ce serveur :
 *  - les résultats de la tablette partent seuls dès qu'il y a du réseau (sinon ils attendent) ;
 *  - l'enseignant récupère tout et envoie la liste d'élèves et la configuration ;
 *  - un élève identifié récupère son dossier : tout ce qui le concerne, toutes tablettes confondues.
 * Ouverte depuis GitHub (sans serveur), l'application garde les échanges par QR code et fichier.
 */
import { etat, sauver } from '../noyau/etat.js';
import { notifier, rafraichir } from '../noyau/interface.js';
import { aDesResultats, fusionnerResultats, paquetResultats } from '../champ4/donnees/fusion.js';

export const serveur = {
  disponible: false, // le serveur a répondu
  verifie: false, // on a déjà essayé de le joindre
  jeton: null,
  role: null,
  eleveId: null,
  envoiEnCours: false,
  dernierEnvoi: null, // heure du dernier envoi réussi
  derniereReception: null,
  erreur: '',
};

/* Empreinte simple des résultats : on ne renvoie que ce qui a changé. */
function signature(objet) {
  const texte = JSON.stringify(objet);
  let h = 0;
  for (let i = 0; i < texte.length; i += 1) h = (h * 31 + texte.charCodeAt(i)) | 0;
  return `${texte.length}-${h}`;
}

async function appel(chemin, { methode = 'GET', corps, jeton = serveur.jeton, delai = 8000 } = {}) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delai);
  try {
    const reponse = await fetch(`api/${chemin}`, {
      method: methode,
      cache: 'no-store',
      signal: controle.signal,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok) throw Object.assign(new Error(donnees.erreur || `Erreur ${reponse.status}`), { statut: reponse.status });
    return donnees;
  } finally {
    clearTimeout(minuteur);
  }
}

/* Le serveur est-il là ? (Sur GitHub, /api n'existe pas : pas de serveur.) */
export async function detecter() {
  try {
    const reponse = await appel('etat', { jeton: null, delai: 3000 });
    serveur.disponible = reponse.serveur === 'EPS +';
  } catch {
    serveur.disponible = false;
  }
  serveur.verifie = true;
  return serveur.disponible;
}

/* ---------- Envoi automatique des résultats de la tablette ---------- */
export const resultatsEnAttente = () => aDesResultats(etat) && signature(paquetResultats(etat, 0)) !== etat.synchro?.signature;

export async function envoyerResultats({ silencieux = true } = {}) {
  if (serveur.envoiEnCours || !aDesResultats(etat)) return false;
  const paquet = paquetResultats(etat);
  const sig = signature(paquetResultats(etat, 0));
  if (sig === etat.synchro?.signature) return true;
  serveur.envoiEnCours = true;
  try {
    if (!serveur.disponible && !(await detecter())) throw new Error('Serveur injoignable');
    await appel('resultats', { methode: 'POST', corps: paquet, jeton: null });
    etat.synchro = { signature: sig, envoyeLe: Date.now() };
    serveur.dernierEnvoi = Date.now();
    serveur.erreur = '';
    sauver();
    if (!silencieux) notifier('Résultats envoyés au serveur ✔');
    return true;
  } catch (erreur) {
    serveur.disponible = false;
    serveur.erreur = erreur.message;
    if (!silencieux) notifier('Serveur injoignable : les résultats partiront dès le retour du Wi-Fi.');
    return false;
  } finally {
    serveur.envoiEnCours = false;
    majPastille();
  }
}

/* ---------- Enseignant ---------- */
export async function connecterEnseignant(code) {
  if (!serveur.disponible && !(await detecter())) return false;
  try {
    const r = await appel('connexion', { methode: 'POST', corps: { role: 'enseignant', code }, jeton: null });
    Object.assign(serveur, { jeton: r.jeton, role: 'enseignant', eleveId: null });
    return true;
  } catch {
    return false;
  }
}

/* Tout ce que le serveur a reçu de toutes les tablettes. */
export async function recupererTout({ silencieux = false } = {}) {
  try {
    await envoyerResultats();
    const paquet = await appel('tout');
    const bilan = fusionnerResultats(etat, paquet);
    serveur.derniereReception = Date.now();
    etat.synchro = { ...(etat.synchro || {}), signature: signature(paquetResultats(etat, 0)) };
    sauver();
    if (!silencieux) notifier(`Synchronisé ✔ ${bilan.ajoutes} ajouté(s), ${bilan.misAJour} mis à jour`);
    return bilan;
  } catch (erreur) {
    if (!silencieux) notifier(erreur.statut === 401 ? 'Reconnecte-toi à l’espace enseignant.' : 'Serveur injoignable.');
    return null;
  } finally {
    majPastille();
  }
}

export async function envoyerListe(eleves) {
  return appel('eleves', { methode: 'PUT', corps: { eleves: eleves.map(({ id, nom, classe, cle }) => ({ id, nom, classe, cle })) } });
}

export async function publierConfiguration(config) {
  return appel('config', { methode: 'PUT', corps: config });
}

export const lireConfiguration = () => appel('config', { jeton: null });

/* Liste des élèves du serveur (prénom + initiale, classe). Les empreintes de code déjà connues sont gardées. */
export async function chargerListe() {
  const { eleves } = await appel('eleves', { jeton: null });
  return eleves.map((e) => ({ ...e, ...(etat.eleves.find((x) => x.id === e.id)?.cle ? { cle: etat.eleves.find((x) => x.id === e.id).cle } : {}) }));
}

/* ---------- Élève ---------- */
/* Le serveur vérifie le code et renvoie le dossier de l'élève, ajouté à la tablette. */
export async function connecterEleve(eleveId, code) {
  const r = await appel('connexion', { methode: 'POST', corps: { role: 'eleve', eleveId, code }, jeton: null });
  Object.assign(serveur, { jeton: r.jeton, role: 'eleve', eleveId });
  await recupererDossier();
  return r;
}

export async function recupererDossier() {
  if (serveur.role !== 'eleve' || !serveur.jeton) return null;
  const dossier = await appel('dossier');
  fusionnerResultats(etat, dossier);
  serveur.derniereReception = Date.now();
  sauver();
  return dossier;
}

export function deconnecterServeur() {
  Object.assign(serveur, { jeton: null, role: null, eleveId: null });
}

/* ---------- Pastille dans l'en-tête ---------- */
const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export function pastilleServeur() {
  if (!serveur.verifie || (!serveur.disponible && !etat.synchro?.envoyeLe && !serveur.erreur)) return '';
  if (serveur.disponible) {
    const attente = resultatsEnAttente();
    return `<span class="pastille-etat ${attente ? 'attente' : 'ok'}" title="Serveur de l'établissement">🖥️ ${attente ? 'Envoi en attente' : `Serveur ✔${etat.synchro?.envoyeLe ? ` ${heure(etat.synchro.envoyeLe)}` : ''}`}</span>`;
  }
  return `<span class="pastille-etat attente" title="Le serveur sera rejoint au retour du Wi-Fi">🖥️ Hors ligne${resultatsEnAttente() ? ' · envoi en attente' : ''}</span>`;
}
function majPastille() {
  const el = document.querySelector('#etat-serveur');
  if (el) el.innerHTML = pastilleServeur();
}

/* Toutes les 20 secondes, et au retour du réseau : on envoie ce qui a changé. */
export function demarrerSynchro() {
  detecter().then(() => {
    majPastille();
    if (serveur.disponible) envoyerResultats();
  });
  setInterval(() => {
    if (resultatsEnAttente()) envoyerResultats();
    else majPastille();
  }, 20000);
  window.addEventListener('online', () => detecter().then(() => envoyerResultats()));
}

export const actualiser = () => rafraichir();
