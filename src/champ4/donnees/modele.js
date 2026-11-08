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
  contrats: {}, // { idEleve: { apsa: clé du critère choisi } }
  reglages: {
    conseil: true,
    criteres: {},
    projets: {},
    fiche: {},
    codeEmpreinte: null,
    contratBonus: false, // bonus chiffré affiché dans la page Progression
    contratValeur: 1, // bonus par point marqué selon le contrat
    defauts: { criteres: {}, fiche: {}, projets: {} }, // valeurs choisies avec « Définir par défaut »
  },
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
  contrats: {}, // contrats en vigueur pendant ce match
});
