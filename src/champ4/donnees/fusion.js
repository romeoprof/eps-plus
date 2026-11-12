/*
 * Regroupement des résultats de plusieurs tablettes, sans serveur.
 * Chaque tablette crée un fichier chiffré ; la tablette enseignant les fusionne.
 * La fusion n'efface rien et ne change aucun réglage de la tablette qui la reçoit.
 */
import { chiffrer, dechiffrer } from '../../noyau/chiffrement.js';
import { avancementCourse, courseAvecDonnees } from '../../demifond/calculs.js';
import { reporterVmaDemifond } from '../../testvma/cooper.js';
import { lireSauvegarde } from './migration.js';
import { alignerPaquet, reparerDoublons } from './doublons.js';
import { elevesCirque, fusionnerCirque, paquetCirque } from '../../cirque/calculs.js';

const TYPE_RESULTATS = 'eps-resultats';

/* Ce qu'une tablette envoie : ses matchs observés et seulement ce qu'il faut pour les lire. */
export function paquetResultats(etat, maintenant = Date.now()) {
  const matchs = etat.matchs.filter((m) => m.evenements.length);
  const idsEquipes = new Set(matchs.flatMap((m) => [m.a, m.b]));
  const equipes = etat.equipes.filter((t) => idsEquipes.has(t.id));
  const idsEleves = new Set(equipes.flatMap((t) => t.membres || []));
  const idsPoules = new Set(matchs.map((m) => m.pouleId).filter(Boolean));
  const courses = (etat.courses || []).filter(courseAvecDonnees);
  courses.forEach((course) =>
    course.coureurs.forEach((c) => {
      if (c.eleveId) idsEleves.add(c.eleveId);
    }),
  );
  const testsVma = etat.testsVma || [];
  testsVma.forEach((t) => idsEleves.add(t.eleveId));
  const tempsPf = etat.tempsPf || [];
  tempsPf.forEach((t) => idsEleves.add(t.eleveId));
  const cirque = paquetCirque(etat);
  elevesCirque(etat).forEach((id) => idsEleves.add(id));
  return {
    type: TYPE_RESULTATS,
    exporteLe: maintenant,
    matchs,
    courses,
    testsVma,
    tempsPf,
    cirque,
    equipes,
    poules: etat.poules.filter((p) => idsPoules.has(p.id)),
    /* Sans l'empreinte du code : le paquet peut passer en QR code, non chiffré. */
    eleves: etat.eleves.filter((e) => idsEleves.has(e.id)).map(({ cle, ...e }) => e),
  };
}

export const aDesResultats = (etat) =>
  etat.matchs.some((m) => m.evenements.length) ||
  (etat.courses || []).some(courseAvecDonnees) ||
  (etat.testsVma || []).length > 0 ||
  (etat.tempsPf || []).length > 0 ||
  (etat.cirque?.troupes || []).length > 0 ||
  Object.keys(paquetCirque(etat).carnets).length > 0;

/* Temps PhotoFinish : la version reçue d'une course remplace celle de cette tablette
   (l'attribution a pu être corrigée après un premier envoi). */
function fusionnerTempsPf(etat, paquet, bilan) {
  const recus = paquet.tempsPf || [];
  if (!recus.length) return;
  const courses = new Set(recus.map((t) => t.courseId));
  const avant = new Set((etat.tempsPf || []).map((t) => t.id));
  etat.tempsPf = [...(etat.tempsPf || []).filter((t) => !courses.has(t.courseId)), ...recus];
  recus.forEach((t) => {
    if (avant.has(t.id)) bilan.dejaPresents += 1;
    else bilan.ajoutes += 1;
  });
}

/* Les résultats de tests VMA sont définitifs : un même test n'est ajouté qu'une fois. */
function fusionnerTestsVma(etat, paquet, bilan) {
  etat.testsVma = etat.testsVma || [];
  const eleves = new Set();
  (paquet.testsVma || []).forEach((test) => {
    if (etat.testsVma.some((t) => t.id === test.id)) {
      bilan.dejaPresents += 1;
    } else {
      etat.testsVma.push(test);
      eleves.add(test.eleveId);
      bilan.ajoutes += 1;
    }
  });
  /* Le test le plus récent de chaque élève donne sa VMA en Demi-fond. */
  eleves.forEach((id) => reporterVmaDemifond(etat, id));
}

/* Une course reçue alors qu'elle tournait encore est close à l'heure de l'envoi. */
function fusionnerCourses(etat, paquet, bilan) {
  (paquet.courses || [])
    .filter(courseAvecDonnees)
    .forEach((brute) => {
      const recue = brute.finLe ? brute : { ...brute, finLe: paquet.exporteLe || Date.now() };
      const rang = etat.courses.findIndex((c) => c.id === recue.id);
      if (rang < 0) {
        etat.courses.push(recue);
        bilan.ajoutes += 1;
      } else if (avancementCourse(recue) > avancementCourse(etat.courses[rang])) {
        etat.courses[rang] = recue;
        bilan.misAJour += 1;
      } else {
        bilan.dejaPresents += 1;
      }
    });
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

export function fusionnerResultats(etat, paquetRecu) {
  const bilan = { ajoutes: 0, misAJour: 0, dejaPresents: 0 };
  /* Un élève déjà connu ici sous un autre identifiant n'est pas ajouté une seconde fois. */
  const paquet = alignerPaquet(etat, paquetRecu);
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
  fusionnerCourses(etat, paquet, bilan);
  fusionnerTestsVma(etat, paquet, bilan);
  fusionnerTempsPf(etat, paquet, bilan);
  fusionnerCirque(etat, paquet.cirque, bilan);
  reparerDoublons(etat);
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
