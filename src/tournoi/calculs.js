/*
 * GÉNÉRATEUR DE TOURNOI (Utilitaires) : la logique, sans affichage.
 *
 * Un tournoi a des « lieux » (tables, terrains ou tapis selon l'APSA) et des participants
 * (un élève, un double ou une équipe). Chaque fois qu'un lieu se libère, la rencontre suivante
 * y est appelée : on voit donc toujours qui joue où, quel lieu est libre et où il manque un joueur.
 *
 * Formules :
 *  - qpr          : « qui perd reste ». Le perdant reste sur son lieu, le gagnant sort et attend
 *                   dans la file ; le premier de la file va là où il manque un joueur.
 *  - championnat  : tous contre tous.
 *  - poules       : tous contre tous dans chaque poule, puis tableau final à élimination.
 *  - elimination  : tableau à élimination directe (exempts pour les têtes de série si besoin).
 */
import { uid } from '../noyau/outils.js';

export const FORMULES = {
  qpr: {
    nom: 'Qui perd reste',
    icone: '🔁',
    texte: "Le perdant reste sur place ; le gagnant sort, attend son tour et rejoue dès qu'une place se libère. Classement au nombre de victoires.",
  },
  championnat: { nom: 'Championnat', icone: '🔄', texte: 'Tous contre tous. Dès qu’un lieu se libère, la rencontre suivante y est appelée.' },
  poules: { nom: 'Poules puis tableau', icone: '🧩', texte: 'Tous contre tous dans chaque poule, puis les premiers de chaque poule jouent un tableau final.' },
  elimination: { nom: 'Élimination directe', icone: '⚔️', texte: 'Le perdant est éliminé, le gagnant passe au tour suivant, jusqu’à la finale.' },
};

export const MODES = { simple: 'Simple (1 contre 1)', double: 'Double (2 contre 2)', equipes: 'Équipes' };

/* Ce qui change d'une APSA à l'autre : nom du lieu, nombre conseillé, simple / double / équipes,
   match nul possible, unité du score, durée ou nombre de points d'un match. */
const raquette = (lieu, lieux, defautLieux, points) => ({
  lieu, lieux, defautLieux, modes: ['simple', 'double'], nul: false, unite: 'points', points, duree: 0, icone: '',
});
const collectif = (unite, minutes, nul = true) => ({
  lieu: 'Terrain', lieux: 'Terrains', defautLieux: 2, modes: ['equipes'], nul, unite, points: 0, duree: minutes * 60, taille: 5,
});

export const PROFILS = {
  'Tennis de table': { ...raquette('Table', 'Tables', 6, 11), icone: '🏓' },
  Badminton: { ...raquette('Terrain', 'Terrains', 4, 15), icone: '🏸' },
  Lutte: { lieu: 'Tapis', lieux: 'Tapis', defautLieux: 2, modes: ['simple'], nul: false, unite: 'points', points: 0, duree: 120, icone: '🤼' },
  Handball: { ...collectif('buts', 7), taille: 5 },
  'Basket-ball': { ...collectif('points', 7), taille: 4 },
  Football: { ...collectif('buts', 7), taille: 5 },
  Rugby: { ...collectif('essais', 7), taille: 5 },
  Ultimate: { ...collectif('points', 7), taille: 5 },
  'Volley-ball': { ...collectif('points', 0, false), points: 15, taille: 4 },
};

export const profil = (apsa) => PROFILS[apsa] || collectif('points', 7);

/* ---------- Outils ---------- */
export function melanger(liste, alea = Math.random) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export const participant = (t, id) => t.participants.find((p) => p.id === id);
export const nomParticipant = (t, id) => participant(t, id)?.nom || '?';
const present = (t, id) => !!id && !participant(t, id)?.absent;
export const gagnantDe = (m) => (m.gagnant === 'a' ? m.a : m.gagnant === 'b' ? m.b : null);
export const perdantDe = (m) => (m.gagnant === 'a' ? m.b : m.gagnant === 'b' ? m.a : null);

/* reste : le perdant resté sur place (qui perd reste) ; arbitre : { id, nom }, gardé d'une rencontre à l'autre. */
const lieuVide = () => ({ a: null, b: null, matchId: null, debut: 0, depuis: 0, dernier: null, reste: null, arbitre: null });
const vider = (table, champs = {}) => Object.assign(table, lieuVide(), { arbitre: table.arbitre || null }, champs);

/* Tous contre tous, par tours (méthode du cercle) : chacun se repose à son tour. */
export function toutesLesRencontres(ids) {
  const liste = ids.length % 2 ? [...ids, null] : [...ids];
  const n = liste.length;
  const paires = [];
  for (let tour = 0; tour < n - 1; tour += 1) {
    for (let i = 0; i < n / 2; i += 1) {
      const a = liste[i];
      const b = liste[n - 1 - i];
      if (a && b) paires.push(tour % 2 ? [b, a] : [a, b]);
    }
    liste.splice(1, 0, liste.pop());
  }
  return paires;
}

/* Place des têtes de série dans un tableau : 1 contre 8, 4 contre 5, 2 contre 7, 3 contre 6… */
export function ordreTableau(taille) {
  let ordre = [1];
  while (ordre.length < taille) {
    const t = ordre.length * 2;
    ordre = ordre.flatMap((x) => [x, t + 1 - x]);
  }
  return ordre;
}

const nouvelleRencontre = (champs) => ({
  id: uid(), a: null, b: null, phase: 'championnat', poule: null, tour: 0, rang: 0,
  etat: 'attente', table: null, debut: 0, fin: 0, sa: null, sb: null, gagnant: null, exempt: false, ...champs,
});

/* Nom d'un tour du tableau final. */
export function nomTour(t, tour) {
  const tours = Math.max(...t.matchs.filter((m) => m.phase === 'tableau').map((m) => m.tour)) + 1;
  const restant = tours - tour; // 1 = finale
  if (restant === 1) return 'Finale';
  if (restant === 2) return 'Demi-finales';
  if (restant === 3) return 'Quarts de finale';
  return `${2 ** (restant - 1)}es de finale`;
}

/* Tableau à élimination : tous les tours sont créés d'avance, les places se remplissent au fil des victoires. */
export function genererTableau(t, tetes) {
  const taille = 2 ** Math.ceil(Math.log2(Math.max(2, tetes.length)));
  const ordre = ordreTableau(taille);
  const tours = Math.log2(taille);
  const nouveaux = [];
  for (let tour = 0; tour < tours; tour += 1) {
    for (let rang = 0; rang < taille / 2 ** (tour + 1); rang += 1) nouveaux.push(nouvelleRencontre({ phase: 'tableau', tour, rang }));
  }
  t.matchs.push(...nouveaux);
  nouveaux
    .filter((m) => m.tour === 0)
    .forEach((m) => {
      m.a = tetes[ordre[2 * m.rang] - 1] || null;
      m.b = tetes[ordre[2 * m.rang + 1] - 1] || null;
      if (!m.a || !m.b) {
        /* Exempt : la tête de série passe directement au tour suivant. */
        Object.assign(m, { etat: 'fini', exempt: true, gagnant: m.a ? 'a' : 'b' });
        propager(t, m);
      }
    });
}

/* Le gagnant d'une rencontre du tableau prend sa place au tour suivant. */
function propager(t, m) {
  if (m.phase !== 'tableau') return;
  const suivant = t.matchs.find((x) => x.phase === 'tableau' && x.tour === m.tour + 1 && x.rang === Math.floor(m.rang / 2));
  if (!suivant || suivant.etat !== 'attente') return;
  suivant[m.rang % 2 ? 'b' : 'a'] = gagnantDe(m);
}

/* ---------- Création ---------- */
/*
 * options : { nom, apsa, formule, mode, lieux, participants: [{ nom, membres }], progression,
 *             duree, points, pts: { v, n, d }, nbPoules, qualifies, organisePar }
 */
export function creerTournoi(options, maintenant = Date.now(), alea = Math.random) {
  const p = profil(options.apsa);
  /* joueurs : [{ id, nom }] (id null pour un nom ajouté à la main) ; membres : les élèves de la liste. */
  const participants = options.participants.map((x) => {
    const joueurs = x.joueurs || (x.membres || []).map((id) => ({ id, nom: x.membres.length === 1 ? x.nom : '' }));
    return { id: uid(), nom: x.nom, joueurs, membres: joueurs.map((j) => j.id).filter(Boolean), absent: false };
  });
  const t = {
    id: uid(),
    nom: options.nom || `Tournoi de ${options.apsa}`,
    apsa: options.apsa,
    formule: options.formule,
    mode: options.mode,
    cree: maintenant,
    termine: false,
    termineLe: null,
    progression: options.progression !== false,
    auto: options.auto === true, // appel au choix par défaut ; automatique si demandé
    organisePar: options.organisePar || null,
    lieux: Math.max(1, options.lieux || p.defautLieux),
    tables: [],
    participants,
    matchs: [],
    file: [],
    poules: [],
    reglages: {
      duree: options.duree ?? p.duree,
      points: options.points ?? p.points,
      nul: p.nul && options.formule !== 'qpr' && options.formule !== 'elimination',
      pts: options.pts || { v: 3, n: 2, d: 1 },
      qualifies: options.qualifies || 2,
    },
  };
  const ids = melanger(participants.map((x) => x.id), alea);
  if (t.formule === 'qpr') {
    t.file = ids;
  } else if (t.formule === 'championnat') {
    t.matchs = toutesLesRencontres(ids).map(([a, b]) => nouvelleRencontre({ a, b, phase: 'championnat' }));
  } else if (t.formule === 'poules') {
    const nb = Math.min(Math.max(1, options.nbPoules || Math.round(ids.length / 4) || 1), Math.floor(ids.length / 2) || 1);
    t.poules = Array.from({ length: nb }, () => []);
    /* Répartition en serpentin : 1 2 3 3 2 1… */
    ids.forEach((id, i) => {
      const tour = Math.floor(i / nb);
      const k = i % nb;
      t.poules[tour % 2 ? nb - 1 - k : k].push(id);
    });
    regenererPoules(t);
  } else {
    t.tirage = ids;
    genererTableau(t, ids);
  }
  /* Aucune rencontre ne commence au lancement : on choisit qui joue sur chaque lieu. */
  ajusterLieux(t);
  if (t.auto) remplir(t, maintenant);
  return t;
}

/* Rencontres de poule refaites à partir de la composition des poules. */
function regenererPoules(t) {
  t.matchs = t.matchs.filter((m) => m.phase !== 'poule');
  const listes = t.poules.map((poule, numero) => toutesLesRencontres(poule).map(([a, b]) => nouvelleRencontre({ a, b, phase: 'poule', poule: numero })));
  /* Les poules jouent en même temps : on alterne leurs rencontres. */
  const longueur = Math.max(0, ...listes.map((l) => l.length));
  for (let i = 0; i < longueur; i += 1) listes.forEach((l) => l[i] && t.matchs.push(l[i]));
  const pleines = t.poules.filter((x) => x.length);
  t.reglages.qualifies = Math.max(1, Math.min(t.reglages.qualifies, ...pleines.map((x) => x.length)));
}

/* ---------- Composition (onglet Joueurs), possible tant qu'aucune rencontre n'a commencé ---------- */
const rienCommence = (t, phase) => t.matchs.filter((m) => m.phase === phase && !m.exempt).every((m) => m.etat === 'attente');
export const poulesModifiables = (t) => t.formule === 'poules' && !tableauLance(t) && rienCommence(t, 'poule');
export const tirageModifiable = (t) => t.formule === 'elimination' && !!t.tirage && rienCommence(t, 'tableau');

export function changerPoule(t, idParticipant, numero) {
  if (!poulesModifiables(t) || numero < 0) return false;
  t.poules = t.poules.map((p) => p.filter((x) => x !== idParticipant));
  while (t.poules.length <= numero) t.poules.push([]);
  t.poules[numero].push(idParticipant);
  regenererPoules(t);
  return true;
}

export function ajouterPoule(t) {
  if (!poulesModifiables(t)) return false;
  t.poules.push([]);
  return true;
}

export function retirerPoule(t, numero) {
  if (!poulesModifiables(t) || t.poules[numero]?.length) return false;
  t.poules.splice(numero, 1);
  regenererPoules(t);
  return true;
}

/* Tableau à élimination : la place « place » (0 = haut du tableau) reçoit ce participant,
   qui échange avec celui qui l'occupait. Les places d'exempt ne se choisissent pas. */
export function placerDansTableau(t, place, idParticipant) {
  if (!tirageModifiable(t)) return false;
  const tetes = [...t.tirage];
  const taille = 2 ** Math.ceil(Math.log2(Math.max(2, tetes.length)));
  const ici = ordreTableau(taille)[place] - 1;
  const ancien = tetes.indexOf(idParticipant);
  if (ici >= tetes.length || ancien < 0) return false;
  [tetes[ici], tetes[ancien]] = [tetes[ancien], tetes[ici]];
  t.matchs = t.matchs.filter((m) => m.phase !== 'tableau');
  t.tirage = tetes;
  genererTableau(t, tetes);
  return true;
}

/* Équipes et doubles : un joueur change d'équipe, s'ajoute ou se retire. */
function majEquipe(t, p) {
  p.membres = p.joueurs.map((j) => j.id).filter(Boolean);
  if (t.mode === 'double' && p.joueurs.length) p.nom = p.joueurs.map((j) => j.nom).join(' & ');
}

export function deplacerJoueur(t, deId, rang, versId) {
  const de = participant(t, deId);
  const vers = participant(t, versId);
  if (!de?.joueurs || !vers?.joueurs || de === vers || !de.joueurs[rang]) return false;
  vers.joueurs.push(...de.joueurs.splice(rang, 1));
  majEquipe(t, de);
  majEquipe(t, vers);
  return true;
}

export function ajouterJoueur(t, idParticipant, joueur) {
  const p = participant(t, idParticipant);
  if (!p?.joueurs || !joueur?.nom) return false;
  if (joueur.id && t.participants.some((x) => x.membres.includes(joueur.id))) return false;
  p.joueurs.push({ id: joueur.id || null, nom: joueur.nom });
  majEquipe(t, p);
  return true;
}

export function retirerJoueur(t, idParticipant, rang) {
  const p = participant(t, idParticipant);
  if (!p?.joueurs?.[rang]) return false;
  p.joueurs.splice(rang, 1);
  majEquipe(t, p);
  return true;
}

/* ---------- Lieux ---------- */
function ajusterLieux(t) {
  while (t.tables.length < t.lieux) t.tables.push(lieuVide());
  /* Seuls les derniers lieux libres peuvent être retirés. */
  while (t.tables.length > t.lieux) {
    const dernier = t.tables[t.tables.length - 1];
    if (dernier.a || dernier.b || dernier.matchId) break;
    t.tables.pop();
  }
}

export const etatLieu = (t, table) => {
  if (table.matchId) {
    const m = t.matchs.find((x) => x.id === table.matchId);
    return m && present(t, m.a) && present(t, m.b) ? 'enjeu' : 'manque';
  }
  if (table.a && table.b) return 'enjeu';
  if (table.a || table.b) return 'manque';
  return 'libre';
};

/* Arbitre d'un lieu : { id, nom } ou null. Il reste d'une rencontre à l'autre. */
export function choisirArbitre(t, numero, arbitre) {
  const table = t.tables[numero];
  if (!table) return false;
  table.arbitre = arbitre?.nom ? { id: arbitre.id || null, nom: arbitre.nom } : null;
  return true;
}

export function changerNombreLieux(t, nombre, maintenant = Date.now()) {
  const voulu = Math.max(1, Math.min(40, nombre));
  t.lieux = voulu;
  ajusterLieux(t);
  remplir(t, maintenant);
  return t.tables.length === voulu;
}

/* Participants occupés sur un lieu. */
function occupes(t) {
  const liste = new Set();
  t.tables.forEach((table) => {
    if (table.a) liste.add(table.a);
    if (table.b) liste.add(table.b);
    const m = table.matchId && t.matchs.find((x) => x.id === table.matchId);
    if (m) {
      liste.add(m.a);
      liste.add(m.b);
    }
  });
  return liste;
}

/* Appelle les rencontres sur les lieux libres. Renvoie les appels : [{ table, a, b }].
   En appel « au choix » (t.auto faux), rien n'est appelé sans qu'on le demande (force),
   et « seul » limite l'appel à un lieu. */
export function remplir(t, maintenant = Date.now(), force = false, seul = null) {
  ajusterLieux(t);
  if (t.termine || (t.auto === false && !force)) return [];
  return t.formule === 'qpr' ? remplirQpr(t, maintenant, seul) : remplirProgramme(t, maintenant, seul);
}

/* Appelle la rencontre proposée sur un lieu (bouton « Lancer »). */
export const appeler = (t, numero, maintenant = Date.now()) => remplir(t, maintenant, true, numero);

/* Ce qui serait appelé sur ce lieu, sans rien changer : { a, b } ou null. */
export function proposition(t, numero) {
  const copie = JSON.parse(JSON.stringify(t));
  const [appel] = remplir(copie, 0, true, numero);
  return appel ? { a: appel.a, b: appel.b } : null;
}

/* Rencontres qu'on peut choisir pour un lieu : en attente, joueurs présents et libres
   (ceux du lieu lui-même comptent comme libres, puisqu'on les remplace). */
export function rencontresPossibles(t, numero) {
  const table = t.tables[numero];
  const pris = occupes(t);
  const ici = table?.matchId && t.matchs.find((x) => x.id === table.matchId);
  if (ici) {
    pris.delete(ici.a);
    pris.delete(ici.b);
  }
  return t.matchs.filter((m) => m.etat === 'attente' && m.a && m.b && !pris.has(m.a) && !pris.has(m.b) && present(t, m.a) && present(t, m.b));
}

/* Choix d'une rencontre pour un lieu ; celle qui y était repart en attente. */
export function choisirRencontre(t, numero, idMatch, maintenant = Date.now()) {
  const table = t.tables[numero];
  const m = rencontresPossibles(t, numero).find((x) => x.id === idMatch);
  if (!table || !m) return false;
  const ancien = table.matchId && t.matchs.find((x) => x.id === table.matchId);
  if (ancien) Object.assign(ancien, { etat: 'attente', table: null, debut: 0 });
  Object.assign(m, { etat: 'enjeu', table: numero, debut: maintenant });
  vider(table, { matchId: m.id, debut: maintenant });
  return true;
}

/* Qui perd reste : choix des deux joueurs d'un lieu parmi ceux du lieu et ceux de la file.
   Ceux du lieu qui ne sont pas choisis repassent en tête de file. */
export function choisirJoueurs(t, numero, a, b, maintenant = Date.now()) {
  const table = t.tables[numero];
  if (!table || !a || !b || a === b) return false;
  const ici = [table.a, table.b].filter(Boolean);
  const possibles = new Set([...ici, ...t.file]);
  if (!possibles.has(a) || !possibles.has(b)) return false;
  t.file = [...ici.filter((id) => id !== a && id !== b), ...t.file.filter((id) => id !== a && id !== b)];
  const reste = [a, b].includes(table.reste) ? table.reste : null;
  const [x, y] = b === reste ? [b, a] : [a, b]; // celui qui est resté garde sa place
  vider(table, { a: x, b: y, debut: maintenant, reste });
  return true;
}

function remplirProgramme(t, maintenant, seul) {
  const appels = [];
  const pris = occupes(t);
  t.tables.forEach((table, i) => {
    if (table.matchId || (seul != null && i !== seul)) return;
    const m = t.matchs.find((x) => x.etat === 'attente' && x.a && x.b && !pris.has(x.a) && !pris.has(x.b) && present(t, x.a) && present(t, x.b));
    if (!m) return;
    Object.assign(m, { etat: 'enjeu', table: i, debut: maintenant });
    Object.assign(table, { matchId: m.id, debut: maintenant });
    pris.add(m.a);
    pris.add(m.b);
    appels.push({ table: i, a: m.a, b: m.b });
  });
  return appels;
}

function remplirQpr(t, maintenant, seul) {
  const appels = [];
  t.file = t.file.filter((id) => present(t, id));
  const passe = (revanche) =>
    t.tables.forEach((table, i) => {
      if (seul != null && i !== seul) return;
      const sur = [table.a, table.b].filter(Boolean);
      while (sur.length < 2 && t.file.length) {
        /* On évite de remettre face à face les deux joueurs qui viennent de jouer ensemble. */
        let k = sur.length ? t.file.findIndex((id) => id !== table.dernier) : 0;
        if (k < 0) {
          if (!revanche) break; // le gagnant attend qu'une autre place se libère
          k = 0;
        }
        sur.push(t.file.splice(k, 1)[0]);
      }
      const avant = !!(table.a && table.b);
      [table.a, table.b] = [sur[0] || null, sur[1] || null];
      if (table.a && table.b && !avant) {
        table.debut = maintenant;
        table.depuis = 0;
        appels.push({ table: i, a: table.a, b: table.b });
      } else if (!(table.a && table.b)) {
        table.debut = 0;
        if (!table.depuis) table.depuis = maintenant;
      }
    });
  passe(false);
  /* Personne d'autre ne joue : plutôt une revanche que d'attendre sans fin. */
  if (t.file.length && !t.tables.some((x) => x.a && x.b)) passe(true);
  /* Le perdant reste toujours sur son lieu : il n'est jamais déplacé vers un autre. */
  return appels;
}

/* ---------- Résultats ---------- */
/* resultat : { gagnant: 'a' | 'b' | 'nul', sa, sb } */
function lireResultat(t, resultat, phase) {
  const sa = resultat.sa === '' || resultat.sa == null ? null : Number(resultat.sa);
  const sb = resultat.sb === '' || resultat.sb == null ? null : Number(resultat.sb);
  let { gagnant } = resultat;
  if (!gagnant && sa != null && sb != null) gagnant = sa > sb ? 'a' : sb > sa ? 'b' : 'nul';
  const nulPossible = t.reglages.nul && phase !== 'tableau';
  if (!gagnant || (gagnant === 'nul' && !nulPossible)) return null;
  return { gagnant, sa, sb };
}

/* Fin de la rencontre jouée sur un lieu. Renvoie les nouveaux appels, ou null si le résultat est incomplet. */
export function enregistrerResultat(t, numero, resultat, maintenant = Date.now()) {
  const table = t.tables[numero];
  if (!table) return null;
  if (t.formule === 'qpr') {
    if (!table.a || !table.b) return null;
    const r = lireResultat(t, resultat, 'qpr');
    if (!r) return null;
    const m = nouvelleRencontre({ a: table.a, b: table.b, phase: 'qpr', etat: 'fini', table: numero, debut: table.debut, fin: maintenant, arbitre: table.arbitre?.nom || null, ...r });
    t.matchs.push(m);
    /* Le perdant reste (et reste affiché sur son lieu), le gagnant sort et va au bout de la file. */
    vider(table, { a: perdantDe(m), reste: perdantDe(m), dernier: gagnantDe(m), depuis: maintenant });
    t.file.push(gagnantDe(m));
    return remplir(t, maintenant);
  }
  const m = t.matchs.find((x) => x.id === table.matchId);
  if (!m) return null;
  const r = lireResultat(t, resultat, m.phase);
  if (!r) return null;
  Object.assign(m, r, { etat: 'fini', fin: maintenant, arbitre: table.arbitre?.nom || null });
  vider(table, { depuis: maintenant });
  propager(t, m);
  return remplir(t, maintenant);
}

/* Correction d'une rencontre déjà jouée (score mal saisi). */
export function corrigerResultat(t, idMatch, resultat) {
  const m = t.matchs.find((x) => x.id === idMatch);
  if (!m || m.etat !== 'fini' || m.exempt) return false;
  const r = lireResultat(t, resultat, m.phase);
  if (!r) return false;
  if (m.phase === 'tableau' && r.gagnant !== m.gagnant) {
    const suivant = t.matchs.find((x) => x.phase === 'tableau' && x.tour === m.tour + 1 && x.rang === Math.floor(m.rang / 2));
    if (suivant && suivant.etat !== 'attente') return false; // le tour suivant a déjà commencé
  }
  Object.assign(m, r);
  propager(t, m);
  return true;
}

/* Une rencontre appelée ne peut pas se jouer (joueur absent) : elle repart en attente. */
export function reporter(t, numero, maintenant = Date.now()) {
  const table = t.tables[numero];
  const m = table && t.matchs.find((x) => x.id === table.matchId);
  if (!m) return [];
  Object.assign(m, { etat: 'attente', table: null, debut: 0 });
  vider(table, { depuis: maintenant });
  /* Elle passe après les autres, pour ne pas revenir aussitôt. */
  t.matchs.splice(t.matchs.indexOf(m), 1);
  t.matchs.push(m);
  return remplir(t, maintenant);
}

/* Absent / présent. En « qui perd reste », l'absent quitte son lieu ; de retour, il va au bout de la file. */
export function basculerAbsent(t, id, maintenant = Date.now()) {
  const p = participant(t, id);
  if (!p) return [];
  p.absent = !p.absent;
  if (t.formule === 'qpr') {
    if (p.absent) {
      t.file = t.file.filter((x) => x !== id);
      t.tables.forEach((table) => {
        if (table.a !== id && table.b !== id) return;
        const reste = table.a === id ? table.b : table.a;
        vider(table, { a: reste, reste: table.reste === reste ? reste : null, depuis: maintenant });
      });
    } else if (!t.file.includes(id) && !t.tables.some((x) => x.a === id || x.b === id)) {
      t.file.push(id);
    }
  }
  return remplir(t, maintenant);
}

/* Participant arrivé en retard (qui perd reste et championnat seulement). */
export function ajouterParticipant(t, { nom, membres = [] }, maintenant = Date.now()) {
  if (!['qpr', 'championnat'].includes(t.formule)) return null;
  const p = { id: uid(), nom, joueurs: membres.length ? membres.map((id) => ({ id, nom })) : [{ id: null, nom }], membres, absent: false };
  if (t.formule === 'qpr') t.file.push(p.id);
  else t.participants.forEach((x) => t.matchs.push(nouvelleRencontre({ a: x.id, b: p.id, phase: 'championnat' })));
  t.participants.push(p);
  remplir(t, maintenant);
  return p;
}

/* ---------- Poules : tableau final ---------- */
export const poulesFinies = (t) => t.formule === 'poules' && t.matchs.filter((m) => m.phase === 'poule').every((m) => m.etat === 'fini');
export const tableauLance = (t) => t.matchs.some((m) => m.phase === 'tableau');

export function lancerTableauFinal(t, maintenant = Date.now()) {
  if (!poulesFinies(t) || tableauLance(t)) return false;
  const q = t.reglages.qualifies;
  const classements = t.poules.map((_, numero) => classementPoule(t, numero).map((x) => x.id));
  /* Têtes de série : les premiers de poule, puis les deuxièmes, etc. Le placement du tableau
     (1 contre le dernier) oppose le 1er d'une poule au 2e d'une autre poule. */
  const tetes = [];
  for (let place = 0; place < q; place += 1) classements.forEach((c) => c[place] && tetes.push(c[place]));
  genererTableau(t, tetes);
  remplir(t, maintenant);
  return true;
}

/* ---------- Classements ---------- */
export function bilanParticipants(t, matchs = t.matchs) {
  const bilans = new Map(t.participants.map((p) => [p.id, { id: p.id, nom: p.nom, joues: 0, v: 0, n: 0, d: 0, pour: 0, contre: 0, points: 0 }]));
  const { pts } = t.reglages;
  matchs
    .filter((m) => m.etat === 'fini' && !m.exempt)
    .forEach((m) => {
      [['a', 'b', m.sa, m.sb], ['b', 'a', m.sb, m.sa]].forEach(([moi, lui, pour, contre]) => {
        const b = bilans.get(m[moi]);
        if (!b) return;
        b.joues += 1;
        b.pour += pour || 0;
        b.contre += contre || 0;
        if (m.gagnant === moi) {
          b.v += 1;
          b.points += pts.v;
        } else if (m.gagnant === lui) {
          b.d += 1;
          b.points += pts.d;
        } else {
          b.n += 1;
          b.points += pts.n;
        }
      });
    });
  return bilans;
}

const parPoints = (x, y) => y.points - x.points || y.pour - y.contre - (x.pour - x.contre) || y.pour - x.pour || x.nom.localeCompare(y.nom);

export function classementPoule(t, numero) {
  const bilans = bilanParticipants(t, t.matchs.filter((m) => m.phase === 'poule' && m.poule === numero));
  return t.poules[numero].map((id) => bilans.get(id)).sort(parPoints);
}

/* Rang dans le tableau : 1 le vainqueur, 2 le finaliste, 3 les demi-finalistes, 5 les quarts… */
function rangsTableau(t) {
  const tableau = t.matchs.filter((m) => m.phase === 'tableau');
  const rangs = new Map();
  if (!tableau.length) return rangs;
  const tours = Math.max(...tableau.map((m) => m.tour)) + 1;
  tableau
    .filter((m) => m.etat === 'fini' && !m.exempt)
    .forEach((m) => {
      rangs.set(perdantDe(m), 2 ** (tours - 1 - m.tour) + 1);
      if (m.tour === tours - 1) rangs.set(gagnantDe(m), 1);
    });
  return rangs;
}

/* Classement général : [{ id, nom, rang, joues, v, n, d, pour, contre, points }] (rang null = encore en course). */
export function classementGeneral(t) {
  const bilans = bilanParticipants(t);
  const tous = [...bilans.values()];
  let liste;
  if (t.formule === 'qpr') {
    const ratio = (b) => (b.joues ? b.v / b.joues : 0);
    liste = tous.sort((x, y) => y.v - x.v || ratio(y) - ratio(x) || x.d - y.d || x.nom.localeCompare(y.nom));
    return liste.map((b, i) => ({ ...b, rang: i + 1 }));
  }
  if (t.formule === 'championnat') return tous.sort(parPoints).map((b, i) => ({ ...b, rang: i + 1 }));
  const rangs = rangsTableau(t);
  if (t.formule === 'elimination') {
    return tous
      .map((b) => ({ ...b, rang: rangs.get(b.id) ?? null }))
      .sort((x, y) => (x.rang ?? 0) - (y.rang ?? 0) || y.v - x.v || x.nom.localeCompare(y.nom));
  }
  /* Poules puis tableau : les qualifiés selon le tableau, puis les autres selon leur place en poule. */
  const placeEnPoule = new Map();
  t.poules.forEach((_, numero) => classementPoule(t, numero).forEach((b, i) => placeEnPoule.set(b.id, i)));
  const qualifies = new Set(t.matchs.filter((m) => m.phase === 'tableau').flatMap((m) => [m.a, m.b]).filter(Boolean));
  const dedans = tous.filter((b) => qualifies.has(b.id)).map((b) => ({ ...b, rang: rangs.get(b.id) ?? null }));
  const dehors = tous
    .filter((b) => !qualifies.has(b.id))
    .sort((x, y) => (placeEnPoule.get(x.id) ?? 99) - (placeEnPoule.get(y.id) ?? 99) || parPoints(x, y));
  if (!qualifies.size) return dehors.map((b) => ({ ...b, rang: null }));
  dedans.sort((x, y) => (x.rang ?? 0) - (y.rang ?? 0) || y.v - x.v);
  return [...dedans, ...dehors.map((b, i) => ({ ...b, rang: dedans.length + i + 1 }))];
}

/* ---------- Progression des élèves ---------- */
/* Une ligne par élève de la liste : son rang, son bilan et ses rencontres. Rien sur les autres élèves
   en dehors du nom de ses adversaires. */
export function resultatsEleves(t, eleves) {
  const classement = classementGeneral(t);
  const lignes = [];
  t.participants.forEach((p) => {
    const c = classement.find((x) => x.id === p.id);
    const rencontres = t.matchs
      .filter((m) => m.etat === 'fini' && !m.exempt && (m.a === p.id || m.b === p.id))
      .sort((x, y) => x.fin - y.fin)
      .map((m) => {
        const moi = m.a === p.id ? 'a' : 'b';
        const lui = moi === 'a' ? 'b' : 'a';
        return {
          date: m.fin,
          adversaire: nomParticipant(t, m[lui]),
          pour: m[`s${moi}`],
          contre: m[`s${lui}`],
          resultat: m.gagnant === moi ? 'V' : m.gagnant === lui ? 'D' : 'N',
          phase: m.phase === 'tableau' ? nomTour(t, m.tour) : m.phase === 'poule' ? `Poule ${String.fromCharCode(65 + m.poule)}` : '',
        };
      });
    p.membres.forEach((idEleve) => {
      const eleve = eleves.find((e) => e.id === idEleve);
      if (!eleve) return;
      lignes.push({
        id: `${t.id}-${eleve.id}`,
        tournoiId: t.id,
        eleveId: eleve.id,
        nom: eleve.nom,
        classe: eleve.classe,
        date: t.cree,
        apsa: t.apsa,
        formule: t.formule,
        libelle: t.nom,
        equipe: p.membres.length > 1 ? p.nom : '',
        rang: c?.rang ?? null,
        participants: t.participants.length,
        termine: t.termine,
        v: c?.v || 0,
        n: c?.n || 0,
        d: c?.d || 0,
        pour: c?.pour || 0,
        contre: c?.contre || 0,
        rencontres,
      });
    });
  });
  return lignes;
}

/* Recopie les résultats du tournoi dans etat.resTournois (refait après chaque résultat). */
export function enregistrerDansProgression(etat, t) {
  const autres = (etat.resTournois || []).filter((r) => r.tournoiId !== t.id);
  etat.resTournois = t.progression ? [...autres, ...resultatsEleves(t, etat.eleves)] : autres;
}

export const resTournoisEleve = (etat, idEleve) =>
  (etat.resTournois || []).filter((r) => r.eleveId === idEleve).sort((a, b) => a.date - b.date);

/* Équipes ou doubles formés au hasard, de tailles aussi proches que possible. */
export function formerEquipes(eleves, taille, alea = Math.random, nombreVoulu = 0) {
  const nombre = Math.max(1, nombreVoulu || Math.floor(eleves.length / Math.max(1, taille)));
  const groupes = Array.from({ length: nombre }, () => []);
  melanger(eleves, alea).forEach((e, i) => groupes[i % nombre].push(e));
  return groupes;
}
