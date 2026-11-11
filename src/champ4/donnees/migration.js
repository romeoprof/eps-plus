/* Lecture des sauvegardes : format actuel et fichiers sauvegarde_eps.json de la V3. */
import { APSA } from '../contenu/apsa.js';
import { etatInitial, VERSION_DONNEES } from './modele.js';
import { possesseur } from '../calculs/match.js';
import { reparerDoublons } from './doublons.js';

const versCritere = ([cle, libelle, points]) => ({ cle, libelle, points });

function migrerMatch(ancien, criteresV3) {
  const criteres = (criteresV3[ancien.ap] || APSA[ancien.ap].criteres).map((c) => ({ ...c }));
  const match = {
    id: ancien.id,
    apsa: ancien.ap,
    pouleId: ancien.pid || null,
    a: ancien.a,
    b: ancien.b,
    criteres: ancien.ev?.length ? criteres : null,
    evenements: [],
    duree: ancien.dur || 0,
    departChrono: ancien.t0 || 0,
    termine: !!ancien.done,
    termineLe: ancien.ts || null,
    conseils: [ancien.c?.[0] || '', ancien.c?.[1] || ''],
    projets: [ancien.i?.[0] || [], ancien.i?.[1] || []],
    bilanProjet: [ancien.v?.[0] || {}, ancien.v?.[1] || {}],
    fiche: [ancien.q?.[0] || {}, ancien.q?.[1] || {}],
  };
  /* La V3 notait les changements de possession à part : on les replace sur les événements. */
  const changements = ancien.tl || [];
  let rang = 0;
  const calcul = { criteres, evenements: [] };
  (ancien.ev || []).forEach(([equipe, critere, zone]) => {
    const avant = possesseur(calcul);
    const evenement = { equipe, critere };
    if (zone != null) evenement.zone = zone;
    calcul.evenements.push(evenement);
    const apres = possesseur(calcul);
    if (apres !== avant && apres != null && rang < changements.length) {
      evenement.t = changements[rang][0];
      rang += 1;
    }
    match.evenements.push(evenement);
  });
  return match;
}

export function migrerV3(ancien) {
  const etat = etatInitial();
  const criteresV3 = Object.fromEntries(
    Object.entries(ancien.obs || {}).map(([apsa, liste]) => [apsa, liste.map(versCritere)]),
  );
  etat.apsa = APSA[ancien.ap] ? ancien.ap : null;
  etat.equipes = (ancien.teams || []).map((t) => ({ id: t.id, nom: t.n, classe: t.c || '', membres: t.m || [] }));
  etat.poules = (ancien.poules || [])
    .filter((p) => APSA[p.ap])
    .map((p) => ({ id: p.id, nom: p.n, apsa: p.ap, equipes: p.ids }));
  etat.matchs = (ancien.matches || []).filter((m) => APSA[m.ap]).map((m) => migrerMatch(m, criteresV3));
  etat.matchCourant = ancien.cur || null;
  etat.matchBilan = ancien.bm || null;
  /* La V3 gardait « Nom Prénom » : on ne reprend que le prénom et l'initiale. */
  const raccourcir = (complet) => {
    const mots = complet.trim().split(/\s+/);
    const dernier = mots[mots.length - 1];
    /* Déjà sous la forme « Léa M » (conseil de la V3) : on n'y touche pas. */
    if (mots.length < 2 || /^\p{L}\.?$/u.test(dernier)) return complet;
    return `${dernier} ${mots[0].charAt(0).toUpperCase()}.`;
  };
  etat.eleves = (ancien.eleves || []).map((e) => ({ id: e.id, nom: raccourcir(e.n), classe: e.c || 'Sans classe' }));
  const nomsComplets = new Set((ancien.eleves || []).map((e) => e.n));
  etat.equipes.forEach((t) => {
    if (nomsComplets.has(t.nom)) t.nom = raccourcir(t.nom);
  });
  etat.reglages.conseil = ancien.cfg?.conseil !== false;
  etat.reglages.criteres = criteresV3;
  etat.reglages.projets = Object.fromEntries(Object.entries(ancien.cfg?.int || {}).filter(([apsa]) => APSA[apsa]));
  etat.reglages.fiche = ancien.cfg?.fo || {};
  etat.affichage = { sombre: !!ancien.ui?.dk, grandsBoutons: !!ancien.ui?.bg };
  return etat;
}

/* Transforme le contenu d'un fichier de sauvegarde en état utilisable. */
export function lireSauvegarde(contenu) {
  if (!contenu || typeof contenu !== 'object') throw new Error('Fichier invalide');
  if (contenu.version === VERSION_DONNEES) {
    const base = etatInitial();
    const etat = {
      ...base,
      ...contenu,
      reglages: { ...base.reglages, ...contenu.reglages },
      affichage: { ...base.affichage, ...contenu.affichage },
    };
    reparerDoublons(etat); // élèves en double d'anciennes versions : regroupés à l'ouverture
    return etat;
  }
  if (Array.isArray(contenu.matches) || Array.isArray(contenu.teams)) return migrerV3(contenu);
  throw new Error('Fichier non reconnu');
}
