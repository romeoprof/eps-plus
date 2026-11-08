/*
 * RÉGLAGES DE DÉPART DU DEMI-FOND.
 * La tolérance, la distance entre plots et les zones se modifient aussi
 * dans Espace enseignant → Réglages, sans toucher à ce fichier.
 */
export const REGLAGES_DEFAUT = {
  tolerance: 0.5, // écart accepté autour du projet, en km/h
  distancePlots: 100, // en mètres
  sons: true,
  zones: [
    { nom: 'Endurance fondamentale', min: 60, max: 74 },
    { nom: 'Endurance active', min: 75, max: 84 },
    { nom: 'Seuil', min: 85, max: 94 },
    { nom: 'VMA', min: 95, max: 105 },
    { nom: 'Vitesse', min: 106, max: 120 },
  ],
};

/* Protection contre les doubles appuis : au-delà, le passage est ignoré. */
export const VITESSE_MAX_KMH = 30;
export const INTERVALLE_MIN_S = 1;

export const MAX_COUREURS = 8;
export const PCT_MIN = 60;
export const PCT_MAX = 120;
export const PCT_PAS = 5;
export const PCT_DEFAUT = 80;

export const CONSIGNES = {
  attente: 'PRÊT',
  super: 'SUPER',
  accelere: 'ACCÉLÈRE',
  ralentis: 'RALENTIS',
  fin: 'ARRIVÉ',
};
