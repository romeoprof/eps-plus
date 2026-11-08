/*
 * RÉGLAGES DE DÉPART DU DEMI-FOND.
 * Tout ce bloc se modifie aussi dans Espace enseignant → Demi-fond, sans toucher à ce fichier.
 */
export const REGLAGES_DEFAUT = {
  tolerance: 0.5, // écart accepté autour du projet, en km/h
  distancePlots: 100, // en mètres
  typeCourse: 'distance', // 'distance' ou 'temps'
  distance: 2000, // en mètres
  duree: 720, // en secondes
  pctDefaut: 80, // % de VMA proposé au départ
  vitesseMax: 30, // km/h : au-delà, un appui est ignoré comme double appui
  sons: true,
  consignes: {
    attente: 'PRÊT',
    super: 'SUPER',
    accelere: 'ACCÉLÈRE',
    ralentis: 'RALENTIS',
    fin: 'ARRIVÉ',
  },
  zones: [
    { nom: 'Endurance fondamentale', min: 60, max: 74 },
    { nom: 'Endurance active', min: 75, max: 84 },
    { nom: 'Seuil', min: 85, max: 94 },
    { nom: 'VMA', min: 95, max: 105 },
    { nom: 'Vitesse', min: 106, max: 120 },
  ],
};

/* Protection contre les doubles appuis : un appui trop rapproché du précédent est ignoré. */
export const INTERVALLE_MIN_S = 1;

export const MAX_COUREURS = 8;
export const PCT_MIN = 60;
export const PCT_MAX = 120;
export const PCT_PAS = 5;
