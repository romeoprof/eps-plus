/*
 * CONTENU PÉDAGOGIQUE DU CHAMP 4 : c'est ce fichier qu'il faut modifier
 * pour ajuster les APSA, les critères observables et les projets de jeu.
 *
 * critere("clé", "Libellé affiché", points)
 *   points > 0 : points marqués par l'équipe
 *   points < 0 : points donnés à l'adversaire
 *   points = 0 : action observée, sans point
 *
 * Les clés "poss", "tir", "but", "perte", "faute" et "fav" sont utilisées
 * pour calculer les statistiques des sports collectifs : ne pas les renommer.
 */
const critere = (cle, libelle, points = 0) => ({ cle, libelle, points });

const ICONE_HANDBALL = `<svg viewBox="0 0 32 32" width="48" height="48" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#f4c542" stroke="#17303b" stroke-width="1.5"/><path d="M4 12Q16 20 28 12M4 20Q16 12 28 20" fill="none" stroke="#17303b" stroke-width="1.2"/></svg>`;

const PROJETS_COLLECTIF = [
  'Écarter le jeu',
  'Choix passe / dribble / tir plus judicieux',
  'Se démarquer après la passe',
  'Jouer vite après récupération',
  'Tirer en situation favorable',
];

const PROJETS_RAQUETTE = [
  'Utiliser mon coup préféré (point fort)',
  "Varier les zones pour écarter l'adversaire",
  'Alterner jeu court et jeu long',
  'Limiter les fautes directes',
  'Améliorer le service',
];

const PROJETS_VOLLEY = [
  'Varier les attaques',
  'Fiabiliser la réception',
  'Améliorer le service',
  'Communiquer entre partenaires',
];

const PROJETS_ULTIMATE = [
  'Écarter le jeu',
  'Faire moins de passes en cloche, au-dessus du défenseur',
  'Se démarquer après la passe',
  'Jouer vite après récupération',
  "Favoriser les passes vers l'avant",
];

export const APSA = {
  Handball: {
    icone: ICONE_HANDBALL,
    collectif: true,
    projets: PROJETS_COLLECTIF,
    criteres: [
      critere('poss', 'Possession'),
      critere('pas', 'Passe décisive'),
      critere('tir', 'Tir arrêté / manqué'),
      critere('fav', 'Tir en situation favorable'),
      critere('but', 'But', 1),
      critere('perte', 'Balle perdue'),
      critere('faute', 'Faute'),
    ],
  },
  'Basket-ball': {
    icone: '🏀',
    collectif: true,
    projets: PROJETS_COLLECTIF,
    criteres: [
      critere('poss', 'Possession'),
      critere('reb', 'Rebond'),
      critere('tir', 'Tir manqué'),
      critere('fav', 'Tir en situation favorable'),
      critere('but', 'Panier à 2 pts', 2),
      critere('tr3', 'Panier à 3 pts', 3),
      critere('lf', 'Lancer franc réussi', 1),
      critere('perte', 'Balle perdue'),
      critere('faute', 'Faute'),
    ],
  },
  Football: {
    icone: '⚽',
    collectif: true,
    projets: PROJETS_COLLECTIF,
    criteres: [
      critere('poss', 'Possession'),
      critere('pas', 'Passe décisive'),
      critere('tir', 'Tir non cadré / arrêté'),
      critere('fav', 'Tir en situation favorable'),
      critere('but', 'But', 1),
      critere('perte', 'Balle perdue'),
      critere('faute', 'Faute'),
      critere('cor', 'Corner obtenu'),
    ],
  },
  Rugby: {
    icone: '🏉',
    collectif: true,
    projets: PROJETS_COLLECTIF,
    criteres: [
      critere('poss', 'Possession'),
      critere('gain', 'Franchissement / gain de terrain'),
      critere('but', 'Essai', 5),
      critere('trf', 'Transformation', 2),
      critere('pla', 'Plaquage réussi'),
      critere('perte', 'Balle perdue'),
      critere('faute', 'Faute'),
    ],
  },
  Ultimate: {
    icone: '🥏',
    collectif: true,
    projets: PROJETS_ULTIMATE,
    criteres: [
      critere('poss', 'Possession du disque'),
      critere('pas', 'Passe réussie'),
      critere('pr', 'Passe ratée (le disque reste)'),
      critere('but', 'Point marqué', 1),
      critere('perte', 'Disque perdu'),
      critere('faute', 'Faute'),
    ],
  },
  'Volley-ball': {
    icone: '🏐',
    projets: PROJETS_VOLLEY,
    criteres: [
      critere('serv', 'Service gagnant', 1),
      critere('gag', 'Attaque gagnante', 1),
      critere('blo', 'Contre gagnant', 1),
      critere('sf', 'Service manqué', -1),
      critere('faute', 'Faute directe', -1),
    ],
  },
  Badminton: {
    icone: '🏸',
    terrain: true,
    projets: PROJETS_RAQUETTE,
    criteres: [
      critere('gag', 'Coup gagnant', 1),
      critere('serv', 'Service gagnant', 1),
      critere('fil', 'Faute : filet', -1),
      critere('dehors', 'Faute : dehors', -1),
      critere('faute', 'Faute de service', -1),
    ],
  },
  'Tennis de table': {
    icone: '🏓',
    terrain: true,
    projets: PROJETS_RAQUETTE,
    criteres: [
      critere('gag', 'Coup gagnant', 1),
      critere('serv', 'Service gagnant', 1),
      critere('fil', 'Faute : filet', -1),
      critere('dehors', 'Faute : hors table', -1),
      critere('faute', 'Faute de service', -1),
    ],
  },
};

/* Repères affichés sur les barres du bilan : [minimum, maximum] en %. */
export const REPERES = {
  'Conversion tirs → buts': [25, 48],
  'Densité (tirs / possessions)': [30, 55],
};

export const NIVEAUX_FICHE = ['Rarement', 'Parfois', 'Souvent', 'Toujours'];
export const NIVEAUX_PROJET = ['Non', 'En partie', 'Oui'];
