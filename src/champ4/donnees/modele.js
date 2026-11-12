import { uid } from '../../noyau/outils.js';
import { PARAMETRES_DEFAUT } from '../../testvma/calculs.js';

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
  /* Demi-fond */
  coureurs: [], // { id, eleveId, nom, classe, vma, archive }
  courses: [],
  courseEnCours: null,
  courseBilan: null,
  /* Test VMA : réglages personnalisés et test en cours */
  testVma: { ...PARAMETRES_DEFAUT, depart: null, arret: null, mode: 'paliers', cooper: { plots: 50, nom: '', classe: '', eleveId: '', test: null } },
  testsVma: [], // résultats des élèves : { id, type, eleveId, nom, classe, date, distance, vma }
  espace: null, // 'eleve' : la tablette rouvre l'espace élève ; l'espace enseignant redemande toujours le code
  eleveConnecte: null, // élève identifié dans l'espace élève
  codesEleves: {}, // codes à 4 chiffres lisibles : seulement sur la tablette enseignant
  cirque: { troupes: [], carnets: {}, troupeCourante: null }, // arts du cirque : voir src/cirque/calculs.js
  tempsPf: [], // temps PhotoFinish attribués : { id, courseId, eleveId, nom, classe, date, libelle, t, rang, partants }
  /* null = valeur réglée dans l'espace enseignant */
  prepCourse: { selection: [], pct: {}, type: null, distance: null, duree: null, plots: null, tolerance: null },
  reglages: {
    conseil: true,
    criteres: {},
    projets: {},
    fiche: {},
    codeEmpreinte: null,
    contratBonus: false, // bonus chiffré affiché dans la page Progression
    contratValeur: 1, // bonus par point marqué selon le contrat
    defauts: { criteres: {}, fiche: {}, projets: {} }, // valeurs choisies avec « Définir par défaut »
    demifond: null, // tolérance, plots, sons et zones ; null = valeurs de demifond/contenu.js
    contrats: {}, // { apsa: [{ id, nom, points }] } : contrats créés par l'enseignant
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
