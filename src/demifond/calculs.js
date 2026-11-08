/* Calculs du demi-fond, sans affichage. Vitesses en km/h, distances en m, temps en s. */
import { INTERVALLE_MIN_S, REGLAGES_DEFAUT } from './contenu.js';

const arrondi2 = (n) => Math.round(n * 100) / 100;
/* Écarts comparés au dixième, comme à l'écran : un « -0,5 » affiché respecte une tolérance de 0,5. */
const ecartAffiche = (vitesse, cible) => Math.round((vitesse - cible) * 10) / 10;
const vitesseMaxDe = (course) => course.vitesseMax ?? REGLAGES_DEFAUT.vitesseMax;
const versMs = (kmh) => kmh / 3.6;

export const vitesseCible = (vma, pct) => (Number(vma) * Number(pct)) / 100;

export function zoneDe(pct, zones) {
  return zones.find((z) => pct >= z.min && pct <= z.max)?.nom || '';
}

/* Distance, temps et temps de passage prévus pour un coureur. */
export function projetCoureur(vitesse, { type, distance, duree, plots }) {
  const ms = versMs(vitesse);
  if (!ms) return { distance: 0, temps: 0, parPlot: 0 };
  return {
    distance: type === 'temps' ? ms * duree : distance,
    temps: type === 'temps' ? duree : distance / ms,
    parPlot: plots / ms,
  };
}

/* Sur une course en distance, le dernier segment peut être plus court qu'un écart entre plots. */
export function distanceAuPlot(course, nombre) {
  const brute = nombre * course.plots;
  return course.type === 'distance' ? Math.min(brute, course.distance) : brute;
}

export const plotsPrevus = (course) => Math.ceil(course.distance / course.plots);

export function estArrive(course, coureur) {
  return course.type === 'distance' && coureur.passages.length >= plotsPrevus(course);
}

export const tempsCourse = (course, maintenant = Date.now()) =>
  course.depart ? ((course.finLe || maintenant) - course.depart) / 1000 : 0;

/* Temps prévu pour atteindre le prochain plot à la vitesse du projet. */
export function dureeSegmentPrevue(course, coureur) {
  const n = coureur.passages.length;
  const distance = distanceAuPlot(course, n + 1) - distanceAuPlot(course, n);
  return coureur.cible ? distance / versMs(coureur.cible) : 0;
}

/* Avancée idéale depuis le dernier appui : 0 au dernier plot, 1 quand l'élève doit être au suivant. */
export function avanceeSegment(course, coureur, temps) {
  const duree = dureeSegmentPrevue(course, coureur);
  const n = coureur.passages.length;
  const depuis = temps - (n ? coureur.passages[n - 1] : 0);
  return duree > 0 ? Math.max(0, depuis / duree) : 0;
}

/* Vitesse de chaque segment entre deux plots, du départ au dernier plot. */
export function vitessesParSegment(course, coureur) {
  return coureur.passages.map((t, i) => {
    const precedent = i ? coureur.passages[i - 1] : 0;
    const distance = distanceAuPlot(course, i + 1) - distanceAuPlot(course, i);
    return t > precedent ? (distance / (t - precedent)) * 3.6 : 0;
  });
}

export function vitesseInstantanee(course, coureur) {
  const vitesses = vitessesParSegment(course, coureur);
  return vitesses.length ? vitesses[vitesses.length - 1] : null;
}

/* Course sur temps : temps écoulé entre le dernier plot et le signal de fin. */
function tempsApresDernierPlot(course, coureur) {
  const n = coureur.passages.length;
  return course.duree - (n ? coureur.passages[n - 1] : 0);
}

/* Allure du dernier morceau, entre le dernier plot et l'endroit atteint à la fin du temps. */
export function allureFinale(course, coureur, metres) {
  const temps = tempsApresDernierPlot(course, coureur);
  return temps > 0 && metres > 0 ? (metres / temps) * 3.6 : null;
}

/* La distance saisie doit rester possible (mêmes limites que les doubles appuis). */
export function distanceFinaleValide(course, coureur, metres) {
  if (!(metres >= 0)) return false;
  if (metres === 0) return true;
  const allure = allureFinale(course, coureur, metres);
  return allure != null && allure <= vitesseMaxDe(course);
}

const aDistanceFinale = (coureur) => coureur.distanceFinale != null;
const distanceTotale = (course, coureur) =>
  distanceAuPlot(course, coureur.passages.length) + (coureur.distanceFinale || 0);

export function vitesseMoyenne(course, coureur) {
  const n = coureur.passages.length;
  if (aDistanceFinale(coureur)) {
    const distance = distanceTotale(course, coureur);
    return distance ? (distance / course.duree) * 3.6 : null;
  }
  return n ? (distanceAuPlot(course, n) / coureur.passages[n - 1]) * 3.6 : null;
}

export const aCouru = (coureur) => coureur.passages.length > 0 || coureur.distanceFinale > 0;
export const courseAvecDonnees = (course) => course.coureurs.some(aCouru);
/* Sert à reconnaître la version la plus avancée d'une même course entre deux tablettes. */
export const avancementCourse = (course) =>
  (course.journal?.length || 0) + course.coureurs.filter(aDistanceFinale).length;

export function consigne(vitesse, cible, tolerance) {
  if (vitesse == null) return 'attente';
  const ecart = ecartAffiche(vitesse, cible);
  if (ecart > tolerance) return 'ralentis';
  if (ecart < -tolerance) return 'accelere';
  return 'super';
}

/* Enregistre un passage, sauf s'il est impossible (double appui). */
export function enregistrerPassage(course, rang, maintenant = Date.now()) {
  const coureur = course.coureurs[rang];
  if (!coureur || !course.depart || course.finLe) return { accepte: false, raison: 'arret' };
  if (estArrive(course, coureur)) return { accepte: false, raison: 'arrive' };
  const t = (maintenant - course.depart) / 1000;
  if (course.type === 'temps' && t > course.duree) return { accepte: false, raison: 'temps' };
  const n = coureur.passages.length;
  const precedent = n ? coureur.passages[n - 1] : 0;
  const ecoule = t - precedent;
  const distance = distanceAuPlot(course, n + 1) - distanceAuPlot(course, n);
  if (ecoule < INTERVALLE_MIN_S || (distance / ecoule) * 3.6 > vitesseMaxDe(course)) {
    return { accepte: false, raison: 'double' };
  }
  coureur.passages.push(Math.round(t * 10) / 10);
  course.journal.push(rang);
  return { accepte: true };
}

/* Annule le dernier passage noté, tous coureurs confondus. */
export function annulerPassage(course) {
  const rang = course.journal.pop();
  if (rang == null) return null;
  course.coureurs[rang].passages.pop();
  return course.coureurs[rang];
}

/* Régularité sur 100 : 100 si toutes les vitesses sont identiques (100 − coefficient de variation). */
function regularite(vitesses) {
  if (vitesses.length < 2) return null;
  const moyenne = vitesses.reduce((s, v) => s + v, 0) / vitesses.length;
  if (!moyenne) return 0;
  const variance = vitesses.reduce((s, v) => s + (v - moyenne) ** 2, 0) / vitesses.length;
  return Math.max(0, Math.round(100 - (Math.sqrt(variance) / moyenne) * 100));
}

export function bilanCoureur(course, coureur) {
  const vitesses = vitessesParSegment(course, coureur);
  const n = coureur.passages.length;
  const moyenne = vitesseMoyenne(course, coureur);
  const ecart = moyenne == null ? null : arrondi2(moyenne - coureur.cible);
  const finale = allureFinale(course, coureur, coureur.distanceFinale || 0);
  const tempsSansFinale = n ? coureur.passages[n - 1] : 0;
  return {
    /* Le dernier morceau figure au graphique, mais pas dans la vitesse max ni la régularité :
       il est trop court et estimé à l'œil pour être comparé aux autres segments. */
    vitesses: finale == null ? vitesses : [...vitesses, finale],
    distanceFinale: coureur.distanceFinale ?? null,
    allureFinale: finale,
    plots: n,
    distance: distanceTotale(course, coureur),
    temps: aDistanceFinale(coureur) ? course.duree : tempsSansFinale,
    moyenne,
    vitesseMax: vitesses.length ? Math.max(...vitesses) : null,
    regularite: regularite(vitesses),
    ecart,
    ecartPct: ecart == null || !coureur.cible ? null : (ecart / coureur.cible) * 100,
    pctReel: moyenne == null || !coureur.vma ? null : (moyenne / coureur.vma) * 100,
    atteint: ecart != null && Math.abs(ecartAffiche(moyenne, coureur.cible)) <= course.tolerance,
  };
}

/* Suivi d'un élève sur toutes ses courses terminées, de la plus ancienne à la plus récente. */
export function suiviDemifond(etat, idEleve) {
  const lignes = (etat.courses || [])
    .filter((c) => c.finLe)
    .sort((a, b) => a.finLe - b.finLe)
    .flatMap((course) =>
      course.coureurs
        .filter((c) => c.eleveId === idEleve && aCouru(c))
        .map((c) => ({ course, coureur: c, ...bilanCoureur(course, c) })),
    );
  const regularites = lignes.map((l) => l.regularite).filter((r) => r != null);
  return {
    lignes,
    courses: lignes.length,
    atteints: lignes.filter((l) => l.atteint).length,
    meilleure: lignes.length ? Math.max(...lignes.map((l) => l.moyenne)) : null,
    regulariteMoyenne: regularites.length
      ? Math.round(regularites.reduce((s, r) => s + r, 0) / regularites.length)
      : null,
  };
}
