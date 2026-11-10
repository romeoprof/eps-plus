/*
 * Demi-Cooper : courir la plus grande distance possible en 6 minutes.
 * VMA (km/h) = distance (m) ÷ 100, car 6 minutes = 1/10 d'heure.
 * Les calculs de passage reprennent ceux du demi-fond (repères, doubles appuis, distance finale).
 */
import { bilanCoureur, distanceAuPlot, vitesseInstantanee, vitesseMoyenne } from '../demifond/calculs.js';

export const DUREE_COOPER = 360;
export const COOPER_DEFAUT = { plots: 50, nom: '', test: null };

export function nouveauDemiCooper({ plots, nom }, depart) {
  return {
    id: `cooper${depart}`,
    type: 'temps',
    duree: DUREE_COOPER,
    distance: 0,
    plots,
    tolerance: 0,
    depart,
    finLe: null,
    journal: [],
    coureurs: [{ nom, cible: 0, vma: null, pct: null, passages: [] }],
  };
}

const coureur = (test) => test.coureurs[0];

/* Ce que l'élève voit pendant la course. */
export function cooperEnDirect(test) {
  const c = coureur(test);
  const n = c.passages.length;
  const moyenne = vitesseMoyenne(test, c);
  return {
    reperes: n,
    distance: distanceAuPlot(test, n),
    vitesse: vitesseInstantanee(test, c),
    /* Garder ce rythme jusqu'au bout donnerait cette VMA et cette distance. */
    vmaEstimee: moyenne,
    distancePrevue: moyenne == null ? null : Math.round((moyenne / 3.6) * DUREE_COOPER),
  };
}

export function resultatCooper(test) {
  const b = bilanCoureur(test, coureur(test));
  return {
    distance: b.distance,
    vma: b.distance / 100,
    vitesses: b.vitesses,
    vitesseMax: b.vitesseMax,
    regularite: b.regularite,
    reperes: b.plots,
    distanceFinale: b.distanceFinale,
    allureFinale: b.allureFinale,
  };
}
