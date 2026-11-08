/*
 * Regroupement des résultats de plusieurs tablettes, sans serveur.
 * Chaque tablette crée un fichier chiffré ; la tablette enseignant les fusionne.
 * La fusion n'efface rien et ne change aucun réglage de la tablette qui la reçoit.
 */
import { chiffrer, dechiffrer } from '../../noyau/chiffrement.js';
import { lireSauvegarde } from './migration.js';

const TYPE_RESULTATS = 'eps-resultats';

/* Ce qu'une tablette envoie : ses matchs observés et seulement ce qu'il faut pour les lire. */
export function paquetResultats(etat, maintenant = Date.now()) {
  const matchs = etat.matchs.filter((m) => m.evenements.length);
  const idsEquipes = new Set(matchs.flatMap((m) => [m.a, m.b]));
  const equipes = etat.equipes.filter((t) => idsEquipes.has(t.id));
  const idsEleves = new Set(equipes.flatMap((t) => t.membres || []));
  const idsPoules = new Set(matchs.map((m) => m.pouleId).filter(Boolean));
  return {
    type: TYPE_RESULTATS,
    exporteLe: maintenant,
    matchs,
    equipes,
    poules: etat.poules.filter((p) => idsPoules.has(p.id)),
    eleves: etat.eleves.filter((e) => idsEleves.has(e.id)),
  };
}

/* La version reçue remplace la version locale seulement si elle est plus avancée. */
function plusRecent(recu, local) {
  if (recu.evenements.length !== local.evenements.length) return recu.evenements.length > local.evenements.length;
  return (recu.termineLe || 0) > (local.termineLe || 0);
}

/* Un chrono resté lancé sur l'autre tablette est arrêté au moment de l'envoi. */
function arreterChrono(match, exporteLe) {
  if (!match.departChrono) return match;
  const fin = exporteLe || Date.now();
  return { ...match, duree: match.duree + Math.max(0, (fin - match.departChrono) / 1000), departChrono: 0 };
}

export function fusionnerResultats(etat, paquet) {
  const bilan = { ajoutes: 0, misAJour: 0, dejaPresents: 0 };
  const matchs = (paquet.matchs || []).filter((m) => m.evenements?.length);

  (paquet.eleves || []).forEach((eleve) => {
    if (!etat.eleves.some((e) => e.id === eleve.id)) etat.eleves.push(eleve);
  });

  /* Les équipes reçues gardent leur nom dans les bilans, sans encombrer les listes de cette tablette. */
  const equipesUtiles = new Set(matchs.flatMap((m) => [m.a, m.b]));
  (paquet.equipes || [])
    .filter((t) => equipesUtiles.has(t.id) && !etat.equipes.some((e) => e.id === t.id))
    .forEach((t) => etat.equipes.push({ ...t, archivee: true }));

  (paquet.poules || []).forEach((poule) => {
    const locale = etat.poules.find((p) => p.id === poule.id);
    if (locale) locale.equipes = [...new Set([...locale.equipes, ...poule.equipes])];
    else etat.poules.push({ ...poule });
  });

  matchs.forEach((brut) => {
    const recu = arreterChrono(brut, paquet.exporteLe);
    const rang = etat.matchs.findIndex((m) => m.id === recu.id);
    if (rang < 0) {
      etat.matchs.push(recu);
      bilan.ajoutes += 1;
    } else if (plusRecent(recu, etat.matchs[rang])) {
      etat.matchs[rang] = recu;
      bilan.misAJour += 1;
    } else {
      bilan.dejaPresents += 1;
    }
  });
  return bilan;
}

export async function creerFichierResultats(etat, motDePasse) {
  return JSON.stringify(await chiffrer(JSON.stringify(paquetResultats(etat)), motDePasse));
}

/* Accepte un fichier de résultats chiffré ou un fichier « Sauvegarder », y compris de la V3. */
export async function lireFichierResultats(texte, motDePasse) {
  const contenu = JSON.parse(texte);
  if (contenu.donnees && contenu.sel) {
    const paquet = JSON.parse(await dechiffrer(contenu, motDePasse));
    if (paquet.type !== TYPE_RESULTATS) throw new Error('Ce fichier ne contient pas de résultats');
    return paquet;
  }
  return lireSauvegarde(contenu);
}
