/*
 * Demi-Cooper : courir la plus grande distance possible en 6 minutes.
 * VMA (km/h) = distance (m) ÷ 100, car 6 minutes = 1/10 d'heure.
 * Les calculs de passage reprennent ceux du demi-fond (repères, doubles appuis, distance finale).
 */
import { bilanCoureur, distanceAuPlot, vitesseInstantanee, vitesseMoyenne } from '../demifond/calculs.js';

export const DUREE_COOPER = 360;
/* classe vide = coureur hors liste, saisi par son nom */
export const COOPER_DEFAUT = { plots: 50, nom: '', classe: '', eleveId: '', test: null };

export function nouveauDemiCooper({ plots, nom, eleveId = null, classe = '' }, depart) {
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
    coureurs: [{ nom, eleveId, classe, cible: 0, vma: null, pct: null, passages: [] }],
  };
}

/* Résultat gardé dans les progrès de l'élève (seulement pour un élève de la liste). */
export function enregistrementCooper(test) {
  const c = coureur(test);
  if (!c.eleveId || c.distanceFinale == null) return null;
  const r = resultatCooper(test);
  return {
    id: test.id,
    type: 'demi-cooper',
    eleveId: c.eleveId,
    nom: c.nom,
    classe: c.classe,
    date: test.finLe,
    distance: r.distance,
    vma: Math.round(r.vma * 10) / 10,
  };
}

/* Ajoute ou remplace un résultat ; renvoie vrai s'il est nouveau. */
export function ajouterTestVma(etat, enregistrement) {
  etat.testsVma = etat.testsVma || [];
  const rang = etat.testsVma.findIndex((t) => t.id === enregistrement.id);
  if (rang >= 0) {
    etat.testsVma[rang] = enregistrement;
    return false;
  }
  etat.testsVma.push(enregistrement);
  return true;
}

/* La VMA du test le plus récent devient celle de l'élève en Demi-fond (projets de course). */
export function reporterVmaDemifond(etat, idEleve) {
  const dernier = testsVmaEleve(etat, idEleve).pop();
  const eleve = etat.eleves.find((e) => e.id === idEleve);
  if (!dernier || !eleve || !(dernier.vma >= 4 && dernier.vma <= 30)) return false;
  etat.coureurs = etat.coureurs || [];
  let fiche = etat.coureurs.find((c) => c.id === idEleve);
  if (!fiche) {
    fiche = { id: idEleve, eleveId: idEleve, nom: eleve.nom, classe: eleve.classe, vma: null, archive: false };
    etat.coureurs.push(fiche);
  }
  fiche.vma = dernier.vma;
  return true;
}

export const testsVmaEleve = (etat, idEleve) =>
  (etat.testsVma || []).filter((t) => t.eleveId === idEleve).sort((a, b) => a.date - b.date);

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
