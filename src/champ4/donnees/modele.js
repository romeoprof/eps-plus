import { uid } from '../../noyau/outils.js';

export const VERSION_DONNEES = 2;

export const etatInitial = () => ({
  version: VERSION_DONNEES,
  apsa: null,
  equipes: [],
  poules: [],
  matchs: [],
  matchCourant: null,
  matchBilan: null,
  eleves: [],
  reglages: { conseil: true, criteres: {}, projets: {}, fiche: {}, codeEmpreinte: null },
  configVersion: null,
  affichage: { sombre: false, grandsBoutons: false },
});

export const nouveauMatch = (apsa, a, b, pouleId = null) => ({
  id: uid(),
  apsa,
  pouleId,
  a,
  b,
  criteres: null, // copiés au premier événement, puis figés
  evenements: [],
  duree: 0,
  departChrono: 0,
  termine: false,
  termineLe: null,
  conseils: ['', ''],
  projets: [[], []],
  bilanProjet: [{}, {}],
  fiche: [{}, {}],
});
