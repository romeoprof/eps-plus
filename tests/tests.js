/* Vérifie les calculs, la reprise des données et la protection de la liste d'élèves.
   Ouvrir tests/index.html via le serveur local. */
import { APSA } from '../src/champ4/contenu/apsa.js';
import { classer } from '../src/champ4/calculs/classement.js';
import { coupPossible, possesseur, score, tempsDePossession } from '../src/champ4/calculs/match.js';
import { bonusContrat, contratDuMatch, elevesSuivis, suiviEleve } from '../src/champ4/calculs/progression.js';
import { creerFichierResultats, fusionnerResultats, lireFichierResultats, paquetResultats } from '../src/champ4/donnees/fusion.js';
import { indicateurs } from '../src/champ4/calculs/stats.js';
import { projetPrecedent } from '../src/champ4/calculs/suivi.js';
import { lignesCsv, lireElevesProteges } from '../src/champ4/donnees/export.js';
import { chiffrer } from '../src/noyau/chiffrement.js';
import { lireSauvegarde, migrerV3 } from '../src/champ4/donnees/migration.js';
import { etatInitial, nouveauMatch } from '../src/champ4/donnees/modele.js';
import { importerEleves, lireElevesCsv, reinitialiserBilans, supprimerEquipe } from '../src/champ4/donnees/operations.js';
import { erreurParametre, paliersDuTest, resultatTest, situationTest } from '../src/testvma/calculs.js';
import {
  ajouterTestVma,
  cooperEnDirect,
  DUREE_COOPER,
  enregistrementCooper,
  nouveauDemiCooper,
  reporterVmaDemifond,
  resultatCooper,
  testsVmaEleve,
} from '../src/testvma/cooper.js';
import { PCT_PAS, REGLAGES_DEFAUT } from '../src/demifond/contenu.js';
import {
  aCouru,
  allureFinale,
  annulerPassage,
  avanceeSegment,
  bilanCoureur,
  dureeSegmentPrevue,
  consigne,
  courseAvecDonnees,
  distanceFinaleValide,
  enregistrerPassage,
  estArrive,
  projetCoureur,
  suiviDemifond,
  vitesseCible,
  zoneDe,
} from '../src/demifond/calculs.js';
import { empreinte } from '../src/noyau/outils.js';
import {
  ajouterPassage,
  analyserImage,
  analyseSon,
  enregistrerTempsCourse,
  estSifflet,
  tempsPfEleve,
  formatTemps,
  lignesCsvCourse,
  luminositesLignes,
  nouveauDetecteur,
  nouvelleCourse,
  partEnMouvement,
  passagesTries,
  seuilMouvement,
} from '../src/photofinish/calculs.js';

const resultats = [];
function test(nom, fonction) {
  try {
    fonction();
    resultats.push([true, nom]);
  } catch (erreur) {
    resultats.push([false, `${nom} : ${erreur.message}`]);
  }
}
function egal(obtenu, attendu) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`obtenu ${a}, attendu ${b}`);
}
const vrai = (valeur, texte) => {
  if (!valeur) throw new Error(texte);
};

function match(apsa, evenements, autres = {}) {
  const m = nouveauMatch(apsa, 'A', 'B');
  m.criteres = APSA[apsa].criteres.map((c) => ({ ...c }));
  m.evenements = evenements.map(([equipe, critere, t]) => ({ equipe, critere, t }));
  return Object.assign(m, autres);
}
const valeur = (m, libelle) => indicateurs(m).find((l) => l[0] === libelle);

test('Handball : un but donne 1 point à la bonne équipe', () => {
  const m = match('Handball', [[0, 'but'], [0, 'but'], [1, 'but']]);
  egal([score(m, 0), score(m, 1)], [2, 1]);
});

test('Rugby : essai et transformation', () => {
  const m = match('Rugby', [[1, 'but'], [1, 'trf']]);
  egal(score(m, 1), 7);
});

test('Badminton : une faute donne le point à l\'adversaire', () => {
  const m = match('Badminton', [[0, 'fil'], [1, 'gag']]);
  egal([score(m, 0), score(m, 1)], [0, 2]);
});

test('BUG V3 corrigé : modifier les réglages ne change pas un score passé', () => {
  const m = match('Handball', [[0, 'but']]);
  const reglageModifie = APSA.Handball.criteres.map((c) => (c.cle === 'but' ? { ...c, points: 3 } : c));
  vrai(reglageModifie.find((c) => c.cle === 'but').points === 3, 'réglage non modifié');
  egal(score(m, 0), 1);
});

test('BUG V3 corrigé : Rugby sans « conversion tirs → buts »', () => {
  const m = match('Rugby', [[0, 'poss'], [0, 'but']]);
  egal(valeur(m, 'Conversion tirs → buts'), undefined);
  egal(valeur(m, 'Tirs (total)'), undefined);
  egal(valeur(m, 'Efficacité (actions de score / possessions)').slice(1), ['100 %', '–']);
});

test('BUG V3 corrigé : Ultimate sans « conversion tirs → buts »', () => {
  const m = match('Ultimate', [[0, 'poss'], [0, 'but']]);
  egal(valeur(m, 'Conversion tirs → buts'), undefined);
});

test('Rugby : essai + transformation sur une possession ne dépasse pas 100 %', () => {
  const m = match('Rugby', [[0, 'poss'], [0, 'but'], [0, 'trf']]);
  egal(valeur(m, 'Efficacité (actions de score / possessions)')[1], '100 %');
  egal(score(m, 0), 7);
});

test('Handball : conversion et densité', () => {
  const m = match('Handball', [[0, 'poss'], [0, 'poss'], [0, 'poss'], [0, 'poss'], [0, 'tir'], [0, 'but']]);
  egal(valeur(m, 'Conversion tirs → buts')[1], '50 %');
  egal(valeur(m, 'Densité (tirs / possessions)')[1], '50 %');
});

test('Possession : annuler une action corrige le temps', () => {
  const m = match('Handball', [[0, 'poss', 0], [1, 'poss', 30]], { duree: 90 });
  egal(tempsDePossession(m, 0), [30, 60]);
  m.evenements.pop();
  egal(tempsDePossession(m, 0), [90, 0]);
  egal(possesseur(m), 0);
});

test('Possession : une perte de balle la donne à l\'adversaire', () => {
  egal(possesseur(match('Handball', [[0, 'poss'], [0, 'perte']])), 1);
});

test('BUG V3 corrigé : supprimer une équipe qui a joué garde son nom', () => {
  const etat = etatInitial();
  etat.equipes = [{ id: 'A', nom: 'Les Aigles', classe: '', membres: [] }, { id: 'B', nom: 'Les Bleus', classe: '', membres: [] }, { id: 'C', nom: 'Les Cerfs', classe: '', membres: [] }];
  const joue = match('Handball', [[0, 'but']]);
  const nonJoue = nouveauMatch('Handball', 'A', 'C');
  etat.matchs = [joue, nonJoue];
  supprimerEquipe(etat, 'A');
  egal(etat.equipes.find((e) => e.id === 'A').archivee, true);
  egal(etat.matchs.length, 1);
  egal(lignesCsv(etat)[1][2], 'Les Aigles');
});

test('Supprimer une équipe qui n\'a pas joué l\'efface et retire ses matchs', () => {
  const etat = etatInitial();
  etat.equipes = [{ id: 'A', nom: 'x', classe: '', membres: [] }];
  etat.poules = [{ id: 'p', nom: 'P', apsa: 'Handball', equipes: ['A', 'B'] }];
  etat.matchs = [nouveauMatch('Handball', 'A', 'B', 'p')];
  supprimerEquipe(etat, 'A');
  egal(etat.equipes.length, 0);
  egal(etat.matchs.length, 0);
  egal(etat.poules[0].equipes, ['B']);
});

test('BUG V3 corrigé : réinitialiser efface fiches et possession', () => {
  const etat = etatInitial();
  const enPoule = match('Handball', [[0, 'poss', 5]], { pouleId: 'p', duree: 60, termine: true, termineLe: 5 });
  enPoule.fiche[0].x = 3;
  etat.matchs = [enPoule, match('Handball', [[0, 'but']]), match('Rugby', [[0, 'but']])];
  reinitialiserBilans(etat, 'Handball');
  egal(etat.matchs.length, 2);
  egal(enPoule.evenements, []);
  egal(enPoule.fiche, [{}, {}]);
  egal(enPoule.duree, 0);
  egal(enPoule.termine, false);
  egal(etat.matchs[1].evenements.length, 1);
});

test('Classement : victoires, puis différence de score', () => {
  const poule = { id: 'p', equipes: ['A', 'B', 'C'] };
  const m1 = match('Handball', [[0, 'but'], [0, 'but']], { pouleId: 'p', termine: true });
  const m2 = Object.assign(match('Handball', [[0, 'but']], { pouleId: 'p', termine: true }), { a: 'C', b: 'B' });
  const lignes = classer(poule, [m1, m2]);
  egal(lignes.map((l) => l.id), ['A', 'C', 'B']);
  egal(lignes[2].defaites, 2);
});

test('Projet de jeu : on retrouve celui de la rencontre précédente', () => {
  const avant = match('Handball', [], { termine: true, termineLe: 10, projets: [['Écarter le jeu'], []] });
  const apres = match('Handball', [], { termine: true, termineLe: 20 });
  egal(projetPrecedent([avant, apres], apres, 'A'), ['Écarter le jeu']);
  egal(projetPrecedent([avant, apres], apres, 'B'), []);
});

const SAUVEGARDE_V3 = {
  ap: 'Handball',
  teams: [{ id: 't1', n: 'Rouges', c: '5A', m: ['e1'] }, { id: 't2', n: 'Verts', c: '5A', m: [] }],
  poules: [{ id: 'p1', n: 'Poule A', ap: 'Handball', ids: ['t1', 't2'] }],
  matches: [
    { id: 'm1', ap: 'Handball', pid: 'p1', a: 't1', b: 't2', ev: [[0, 'poss'], [0, 'but'], [1, 'poss']], dur: 120, done: 1, ts: 1000, tl: [[10, 0], [50, 1]], c: ['Bien', ''], i: [['Écarter le jeu'], []], v: [{ x: 2 }, {}], q: [{ y: 4 }, {}] },
    { id: 'm2', ap: 'Handball', pid: null, a: 't1', b: 't2', ev: [], dur: 0, done: 0 },
    { id: 'old', ap: 'Tennis', a: 't1', b: 't2', ev: [], dur: 0, done: 0 },
  ],
  cur: 'm2',
  obs: { Handball: [['poss', 'Possession', 0], ['but', 'But', 2]] },
  eleves: [{ id: 'e1', n: 'Lea M', c: '5A' }],
  cfg: { conseil: false, int: { Handball: ['Mon projet'] }, fo: { Handball: ['Mon critère'] }, pubEl: true },
  ui: { dk: true },
};

test('Reprise V3 : équipes, élèves et réglages', () => {
  const etat = lireSauvegarde(SAUVEGARDE_V3);
  egal(etat.equipes[0].nom, 'Rouges');
  egal(etat.eleves[0].nom, 'Lea M');
  egal(etat.poules[0].equipes, ['t1', 't2']);
  egal(etat.reglages.conseil, false);
  egal(etat.reglages.projets.Handball, ['Mon projet']);
  egal(etat.affichage.sombre, true);
  egal(etat.reglages.pubEl, undefined);
});

test('Reprise V3 : le score est identique et la possession conservée', () => {
  const etat = migrerV3(SAUVEGARDE_V3);
  const m = etat.matchs[0];
  egal(etat.matchs.length, 2);
  egal(score(m, 0), 2); // la V3 comptait les points réglés (2), pas ceux par défaut (1)
  egal(tempsDePossession(m, 0), [40, 70]);
  egal(m.conseils, ['Bien', '']);
  egal(m.fiche[0].y, 4);
  egal(etat.matchs[1].criteres, null);
});

test('Une sauvegarde au nouveau format est relue à l\'identique', () => {
  const etat = etatInitial();
  etat.apsa = 'Rugby';
  egal(lireSauvegarde(JSON.parse(JSON.stringify(etat))).apsa, 'Rugby');
});

test('Un fichier inconnu est refusé', () => {
  let refuse = false;
  try {
    lireSauvegarde({ bonjour: 1 });
  } catch {
    refuse = true;
  }
  vrai(refuse, 'fichier accepté');
});

test('Import CSV : prénom + initiale, en-tête ignoré, doublons évités', () => {
  const etat = etatInitial();
  const ajout = () => importerEleves(etat, 'Nom;Prénom;Classe\nMartin;Léa;5A\nDupont;Tom;5A\n');
  egal(ajout(), 2);
  egal(ajout(), 0);
  egal(etat.eleves.map((e) => e.nom), ['Léa M.', 'Tom D.']);
  vrai(!JSON.stringify(etat.eleves).includes('Martin'), 'nom de famille conservé');
});

test('Import CSV : deux élèves identiques après réduction restent distincts', () => {
  const etat = etatInitial();
  const csv = 'Martin;Léa;5A\nMoreau;Léa;5A\nMartin;Léa;5B\n';
  egal(importerEleves(etat, csv), 3);
  egal(etat.eleves.map((e) => e.nom), ['Léa M.', 'Léa M. (2)', 'Léa M.']);
  egal(new Set(etat.eleves.map((e) => e.id)).size, 3);
  egal(importerEleves(etat, csv), 0);
});

test('Reprise V3 : les noms complets sont réduits, équipes individuelles comprises', () => {
  const etat = migrerV3({
    teams: [{ id: 't', n: 'Martin Léa', c: '5A', m: ['e'] }, { id: 'u', n: 'Les Bleus', c: '', m: [] }],
    eleves: [{ id: 'e', n: 'Martin Léa', c: '5A' }],
    matches: [],
  });
  egal(etat.eleves[0], { id: 'e', nom: 'Léa M.', classe: '5A' });
  egal(etat.equipes.map((t) => t.nom), ['Léa M.', 'Les Bleus']);
});

function etatSuivi() {
  const etat = etatInitial();
  etat.eleves = [{ id: 'e1', nom: 'Léa M.', classe: '5A' }, { id: 'e2', nom: 'Tom D.', classe: '5A' }, { id: 'e3', nom: 'Zoé B.', classe: '5B' }];
  etat.equipes = [
    { id: 'A', nom: 'Léa M.', classe: '5A', membres: ['e1'] },
    { id: 'B', nom: 'Saisi à la main', classe: '', membres: [] },
    { id: 'C', nom: 'Les Aigles', classe: '5A', membres: ['e1', 'e2'] },
  ];
  return etat;
}

test('Progression : seuls les élèves choisis dans une équipe sont suivis', () => {
  egal(elevesSuivis(etatSuivi()).map((e) => e.id), ['e1', 'e2']);
});

test('Progression : les événements de tous les sports sont comptés', () => {
  const etat = etatSuivi();
  etat.matchs = [
    match('Badminton', [[0, 'gag'], [0, 'gag'], [1, 'gag']], { termine: true, termineLe: 10 }),
    Object.assign(match('Handball', [[1, 'but'], [0, 'but']], { termine: true, termineLe: 20 }), { a: 'B', b: 'C' }),
    match('Handball', [], { termine: true, termineLe: 30 }),
  ];
  const suivi = suiviEleve(etat, 'e1');
  egal(suivi.sports.map((s) => s.apsa), ['Badminton', 'Handball']);
  egal(suivi.rencontres, 2);
  egal([suivi.victoires, suivi.nuls, suivi.defaites], [1, 1, 0]);
  egal(suivi.sports[0].criteres.find((c) => c.libelle === 'Coup gagnant').nombre, 2);
  egal(suiviEleve(etat, 'e2').sports.map((s) => s.apsa), ['Handball']);
  egal(suiviEleve(etat, 'e3').rencontres, 0);
});

test('Contrat : seuls les points de la manière choisie sont valorisés', () => {
  const etat = etatSuivi();
  etat.matchs = [match('Badminton', [[0, 'gag'], [0, 'serv'], [0, 'gag'], [1, 'fil']], { termine: true, termineLe: 10, contrats: { e1: 'gag' } })];
  const contrat = suiviEleve(etat, 'e1').sports[0].contrat;
  egal([contrat.points, contrat.gagnes], [2, 4]);
  egal(contrat.parts, [0.5]);
  egal(suiviEleve(etat, 'e1').pointsContrat, 2);
  egal(score(etat.matchs[0], 0), 4);
});

test('Contrat : changer de contrat ne réécrit pas les matchs déjà commencés', () => {
  const etat = etatSuivi();
  etat.contrats = { e1: { Badminton: 'serv' } };
  const ancienAvecContrat = match('Badminton', [[0, 'gag']], { contrats: { e1: 'gag' } });
  const ancienSansContrat = match('Badminton', [[0, 'serv']], { contrats: undefined });
  const nonCommence = match('Badminton', []);
  egal(contratDuMatch(etat, ancienAvecContrat, 'e1'), 'gag');
  egal(contratDuMatch(etat, ancienSansContrat, 'e1'), '');
  egal(contratDuMatch(etat, nonCommence, 'e1'), 'serv');
});

test('Contrat : un match réinitialisé oublie son contrat', () => {
  const etat = etatSuivi();
  const enPoule = match('Badminton', [[0, 'gag']], { pouleId: 'p', contrats: { e1: 'gag' } });
  etat.matchs = [enPoule];
  reinitialiserBilans(etat, 'Badminton');
  egal(enPoule.contrats, {});
});

/* Demi-fond */
function courseEssai(autres = {}) {
  return {
    id: 'course1',
    type: 'distance',
    distance: 300,
    duree: 720,
    plots: 100,
    tolerance: 0.5,
    depart: 1000000,
    finLe: null,
    journal: [],
    coureurs: [
      { coureurId: 'e1', eleveId: 'e1', nom: 'Léa M.', classe: '5A', vma: 14, pct: 80, cible: 11.2, zone: 'Endurance active', passages: [] },
      { coureurId: 'c9', eleveId: null, nom: 'Invité', classe: 'Sans classe', vma: 12, pct: 80, cible: 9.6, zone: '', passages: [] },
    ],
    ...autres,
  };
}
const aSeconde = (course, s) => course.depart + s * 1000;

test('Demi-fond : calcul du projet (VMA 14 à 80 %, 2 km, plots de 100 m)', () => {
  const v = vitesseCible(14, 80);
  egal(Math.round(v * 10) / 10, 11.2);
  const p = projetCoureur(v, { type: 'distance', distance: 2000, duree: 0, plots: 100 });
  egal(Math.round(p.temps), 643);
  egal(Math.round(p.parPlot), 32);
  const t = projetCoureur(v, { type: 'temps', distance: 0, duree: 720, plots: 100 });
  egal(Math.round(t.distance), 2240);
});

test('Demi-fond : zones modifiables et consigne selon la tolérance de 0,5 km/h', () => {
  const zones = [{ nom: 'Seuil', min: 85, max: 94 }];
  egal(zoneDe(90, zones), 'Seuil');
  egal(zoneDe(70, zones), '');
  egal(consigne(11.7, 11.2, 0.5), 'super');
  egal(consigne(10.7, 11.2, 0.5), 'super');
  egal(consigne(11.8, 11.2, 0.5), 'ralentis');
  egal(consigne(10.6, 11.2, 0.5), 'accelere');
  egal(consigne(null, 11.2, 0.5), 'attente');
});

test('Demi-fond : un double appui est ignoré, un passage normal est gardé', () => {
  const c = courseEssai();
  egal(enregistrerPassage(c, 0, aSeconde(c, 32)).accepte, true);
  egal(enregistrerPassage(c, 0, aSeconde(c, 32.4)), { accepte: false, raison: 'double' });
  egal(enregistrerPassage(c, 0, aSeconde(c, 40)), { accepte: false, raison: 'double' }); // 100 m en 8 s = 45 km/h
  egal(c.coureurs[0].passages, [32]);
  egal(enregistrerPassage(c, 0, aSeconde(c, 64)).accepte, true);
  egal(c.coureurs[0].passages, [32, 64]);
});

test('Demi-fond : deux coureurs au même instant sont notés tous les deux', () => {
  const c = courseEssai();
  egal(enregistrerPassage(c, 0, aSeconde(c, 32)).accepte, true);
  egal(enregistrerPassage(c, 1, aSeconde(c, 32)).accepte, true);
  egal(c.journal, [0, 1]);
});

test('Demi-fond : annuler retire le dernier passage, tous coureurs confondus', () => {
  const c = courseEssai();
  enregistrerPassage(c, 0, aSeconde(c, 32));
  enregistrerPassage(c, 1, aSeconde(c, 37));
  egal(annulerPassage(c).nom, 'Invité');
  egal(c.coureurs[1].passages, []);
  egal(c.coureurs[0].passages, [32]);
  annulerPassage(c);
  egal(annulerPassage(c), null);
});

test('Demi-fond : arrivée et dernier segment plus court', () => {
  const c = courseEssai({ distance: 250 });
  [30, 60, 75].forEach((s) => enregistrerPassage(c, 0, aSeconde(c, s)));
  egal(estArrive(c, c.coureurs[0]), true);
  egal(enregistrerPassage(c, 0, aSeconde(c, 120)), { accepte: false, raison: 'arrive' });
  const b = bilanCoureur(c, c.coureurs[0]);
  egal(b.distance, 250);
  egal(Math.round(b.vitesses[2]), 12); // 50 m en 15 s
});

test('Demi-fond : la course sur temps refuse les passages après la fin', () => {
  const c = courseEssai({ type: 'temps', duree: 60 });
  egal(enregistrerPassage(c, 0, aSeconde(c, 30)).accepte, true);
  egal(enregistrerPassage(c, 0, aSeconde(c, 61)), { accepte: false, raison: 'temps' });
});

test('Demi-fond : la tolérance est appliquée à l\'appui', () => {
  egal(consigne(10.9, 11.2, 0.5), 'super'); // 0,3 km/h en dessous
  egal(consigne(11.5, 11.2, 0.5), 'super'); // 0,3 km/h au-dessus
  egal(consigne(10.66, 11.2, 0.5), 'super'); // affiché -0,5 : respecte la tolérance
  egal(consigne(10.64, 11.2, 0.5), 'accelere'); // affiché -0,6
  egal(consigne(11.76, 11.2, 0.5), 'ralentis'); // affiché +0,6
  egal(consigne(11.5, 11.2, 0.2), 'ralentis'); // une autre tolérance s'applique
});

test('Demi-fond : l\'objectif du bilan suit le même arrondi', () => {
  const c = courseEssai({ tolerance: 0.5 });
  enregistrerPassage(c, 0, aSeconde(c, 33.8)); // 100 m en 33,8 s = 10,65 km/h, écart affiché -0,5 ou -0,6
  const b = bilanCoureur(c, c.coureurs[0]);
  const ecart = Math.round((b.moyenne - 11.2) * 10) / 10;
  egal(b.atteint, Math.abs(ecart) <= 0.5);
});

test('Demi-fond : la limite de double appui suit le réglage de la course', () => {
  const c = courseEssai({ vitesseMax: 50 });
  egal(enregistrerPassage(c, 0, aSeconde(c, 8)).accepte, true); // 45 km/h accepté
  const d = courseEssai({ vitesseMax: 20 });
  egal(enregistrerPassage(d, 0, aSeconde(d, 15)), { accepte: false, raison: 'double' }); // 24 km/h refusé
  const ancienne = courseEssai();
  egal(enregistrerPassage(ancienne, 0, aSeconde(ancienne, 8)), { accepte: false, raison: 'double' }); // 30 km/h par défaut
});

test('Demi-fond : la barre avance à la vitesse du projet entre deux plots', () => {
  // Plots de 120 m à 12 km/h : 36 s par plot
  const c = courseEssai({ plots: 120, distance: 300 });
  const coureur = c.coureurs[0];
  coureur.cible = 12;
  egal(Math.round(dureeSegmentPrevue(c, coureur)), 36);
  egal(avanceeSegment(c, coureur, 0), 0);
  egal(avanceeSegment(c, coureur, 18), 0.5); // mi-chemin : petit trait
  egal(Math.round(avanceeSegment(c, coureur, 36) * 100), 100); // grand trait à l'heure du plot
  // Après l'appui, la barre repart de zéro depuis ce plot
  enregistrerPassage(c, 0, aSeconde(c, 40));
  egal(avanceeSegment(c, coureur, 40), 0);
  egal(avanceeSegment(c, coureur, 58), 0.5);
  // Dernier segment de 60 m (240 m → 300 m) : deux fois plus court
  enregistrerPassage(c, 0, aSeconde(c, 76));
  egal(Math.round(dureeSegmentPrevue(c, coureur)), 18);
  // Un élève en retard dépasse 1, un élève en avance ne reste pas à zéro
  egal(avanceeSegment(c, coureur, 76 + 27), 1.5);
});

test('Demi-fond : la zone par défaut s\'appelle VMA et les % vont de 5 en 5', () => {
  egal(REGLAGES_DEFAUT.zones.map((z) => z.nom).includes('VMA'), true);
  egal(REGLAGES_DEFAUT.zones.map((z) => z.nom).includes('PMA'), false);
  egal(PCT_PAS, 5);
});

test('Demi-fond : course sur temps, allure et distance après le dernier plot', () => {
  const c = courseEssai({ type: 'temps', duree: 100 });
  [32, 64].forEach((s) => enregistrerPassage(c, 0, aSeconde(c, s)));
  const coureur = c.coureurs[0];
  // 36 s après le dernier plot, 90 m : 9 km/h
  egal(allureFinale(c, coureur, 90), 9);
  egal(distanceFinaleValide(c, coureur, 90), true);
  egal(distanceFinaleValide(c, coureur, 0), true);
  egal(distanceFinaleValide(c, coureur, -5), false);
  egal(distanceFinaleValide(c, coureur, 400), false); // 40 km/h : impossible
  coureur.distanceFinale = 90;
  const b = bilanCoureur(c, coureur);
  egal(b.distance, 290);
  egal(b.temps, 100);
  egal(b.moyenne.toFixed(2), '10.44');
  egal(b.allureFinale, 9);
  egal(b.vitesses.length, 3);
  egal(b.vitesses[2], 9);
  egal(b.vitesseMax.toFixed(2), '11.25'); // le dernier morceau ne compte pas ici
});

test('Demi-fond : coureur sans plot, seule la distance finale compte', () => {
  const c = courseEssai({ type: 'temps', duree: 60 });
  const coureur = c.coureurs[1];
  coureur.distanceFinale = 150;
  const b = bilanCoureur(c, coureur);
  egal([b.distance, b.plots, b.temps], [150, 0, 60]);
  egal(b.moyenne, 9);
  egal(b.allureFinale, 9);
  egal(aCouru(coureur), true);
  c.finLe = 5000;
  egal(courseAvecDonnees(c), true);
});

test('Demi-fond : la fusion garde la version avec les distances finales', () => {
  const local = etatInitial();
  const c = courseEssai({ type: 'temps', duree: 100 });
  enregistrerPassage(c, 0, aSeconde(c, 32));
  c.finLe = 5000;
  const avant = JSON.parse(JSON.stringify(c));
  fusionnerResultats(local, { courses: [avant] });
  const apres = JSON.parse(JSON.stringify(c));
  apres.coureurs[0].distanceFinale = 50;
  egal(fusionnerResultats(local, { courses: [apres] }), { ajoutes: 0, misAJour: 1, dejaPresents: 0 });
  egal(fusionnerResultats(local, { courses: [avant] }), { ajoutes: 0, misAJour: 0, dejaPresents: 1 });
  egal(local.courses[0].coureurs[0].distanceFinale, 50);
});

test('Demi-fond : bilan (moyenne, écart, objectif, vitesse max, régularité)', () => {
  const c = courseEssai();
  [32, 64, 96].forEach((s) => enregistrerPassage(c, 0, aSeconde(c, s)));
  const b = bilanCoureur(c, c.coureurs[0]);
  egal(b.moyenne.toFixed(2), '11.25');
  egal(b.ecart, 0.05);
  egal(b.atteint, true);
  egal(b.regularite, 100);
  egal(b.vitesseMax.toFixed(2), '11.25');
  const lent = courseEssai();
  [40, 90, 150].forEach((s) => enregistrerPassage(lent, 0, aSeconde(lent, s)));
  const bl = bilanCoureur(lent, lent.coureurs[0]);
  egal(bl.atteint, false);
  vrai(bl.regularite < 100, 'régularité attendue sous 100');
});

test('Demi-fond : suivi de l\'élève, coureur hors liste exclu', () => {
  const etat = etatSuivi();
  const c1 = courseEssai({ id: 'a' });
  const c2 = courseEssai({ id: 'b' });
  const enCours = courseEssai({ id: 'c' });
  [c1, c2, enCours].forEach((c) => {
    [32, 64].forEach((s) => enregistrerPassage(c, 0, aSeconde(c, s)));
    enregistrerPassage(c, 1, aSeconde(c, 40));
  });
  c1.finLe = 2000;
  c2.finLe = 1000;
  etat.courses = [c1, c2, enCours];
  etat.eleves.push({ id: 'e9', nom: 'Sans course', classe: '5A' });
  const suivi = suiviDemifond(etat, 'e1');
  egal(suivi.courses, 2);
  egal(suivi.lignes.map((l) => l.course.id), ['b', 'a']);
  egal(suivi.atteints, 2);
  egal(suiviDemifond(etat, 'c9').courses, 0);
  vrai(elevesSuivis(etat).some((e) => e.id === 'e1'), 'coureur de la liste suivi');
  vrai(!elevesSuivis(etat).some((e) => e.id === 'e9'), 'élève sans équipe ni course non suivi');
});

test('Demi-fond : le regroupement des tablettes ajoute les courses, sans doublon', () => {
  const autre = etatSuivi();
  const c = courseEssai();
  enregistrerPassage(c, 0, aSeconde(c, 32));
  c.finLe = 5000;
  autre.courses = [c, courseEssai({ id: 'vide' })];
  const local = etatInitial();
  const paquet = JSON.parse(JSON.stringify(paquetResultats(autre)));
  egal(fusionnerResultats(local, paquet), { ajoutes: 1, misAJour: 0, dejaPresents: 0 });
  egal(local.courses.map((x) => x.id), ['course1']);
  egal(local.eleves.some((e) => e.id === 'e1'), true);
  egal(fusionnerResultats(local, paquet), { ajoutes: 0, misAJour: 0, dejaPresents: 1 });
  egal(suiviDemifond(local, 'e1').courses, 1);
});

test('Demi-fond : une course reçue alors qu\'elle tournait encore est close', () => {
  const local = etatInitial();
  const c = courseEssai();
  enregistrerPassage(c, 0, aSeconde(c, 32));
  fusionnerResultats(local, { exporteLe: 9000, courses: [c] });
  egal(local.courses[0].finLe, 9000);
  egal(local.courseEnCours, null);
});

test('Import de VMA : prénom + initiale, VMA en 4e colonne', () => {
  const lignes = lireElevesCsv('Nom;Prénom;Classe;VMA\nMartin;Léa;5A;14,5\n');
  egal(lignes[0].eleve.nom, 'Léa M.');
  egal(lignes[0].colonnes[3], '14,5');
});

/* Raquette : zones et contrats créés par l'enseignant */
test('Raquette : un coup gagnant n\'arrive que dans le camp adverse', () => {
  egal(coupPossible(4, 1, 1), true); // zone côté A, joueur B marque
  egal(coupPossible(4, 0, 1), false); // zone côté A, joueur A ne peut pas y marquer
  egal(coupPossible(13, 0, 1), true);
  egal(coupPossible(13, 1, 1), false);
  egal(coupPossible(8, 0, 1), false); // dernière zone du côté A
  egal(coupPossible(9, 0, 1), true); // première zone du côté B
});

test('Raquette : une faute ne se note pas sur une zone', () => {
  egal(coupPossible(4, 0, -1), false);
  egal(coupPossible(13, 0, -1), false);
  egal(coupPossible(null, 0, -1), true);
  egal(coupPossible(null, 0, 1), true); // la zone reste facultative
  egal(coupPossible(4, 0, 0), true); // un critère sans point n'est pas concerné
});

test('Contrat créé : compte au score et n\'apparaît au bilan que s\'il a servi', () => {
  const m = match('Badminton', [[0, 'gag'], [0, 'ctr1']]);
  m.criteres.push({ cle: 'ctr1', libelle: 'Smash gagnant', points: 2, contrat: true }, { cle: 'ctr2', libelle: 'Amorti', points: 1, contrat: true });
  m.contrats = { e1: 'ctr1' };
  egal(score(m, 0), 3);
  const lignes = indicateurs(m).map((l) => l[0]);
  egal(lignes.includes('Smash gagnant'), true);
  egal(lignes.includes('Amorti'), false);
  const etat = etatSuivi();
  etat.matchs = [Object.assign(m, { termine: true, termineLe: 5 })];
  const contrat = suiviEleve(etat, 'e1').sports[0].contrat;
  egal([contrat.points, contrat.gagnes], [2, 3]);
  egal(contrat.lignes[0].libelle, 'Smash gagnant');
});

/* Test VMA */
const PROTOCOLE_LEGER = { vitesse: 8, increment: 0.5, duree: 60, distance: 20 };
const chronoArrondi = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

test('Test VMA : mêmes temps de passage que le tableau de référence', () => {
  const paliers = paliersDuTest(PROTOCOLE_LEGER);
  egal(paliers[0].vitesse, 8);
  egal(paliers[0].passages.map(chronoArrondi), ['0:09', '0:18', '0:27', '0:36', '0:45', '0:54']);
  egal(paliers[1].vitesse, 8.5);
  egal(paliers[1].passages.slice(0, 5).map(chronoArrondi), ['1:02', '1:10', '1:19', '1:27', '1:36']);
  egal(paliers[2].passages.slice(0, 5).map(chronoArrondi), ['2:01', '2:09', '2:17', '2:25', '2:33']);
  egal(paliers[paliers.length - 1].vitesse, 25);
});

test('Test VMA : les incréments sans erreur d\'arrondi (10, 10,1, 10,2…)', () => {
  const paliers = paliersDuTest({ vitesse: 10, increment: 0.1, duree: 60, distance: 20 });
  egal(paliers.slice(0, 4).map((p) => p.vitesse), [10, 10.1, 10.2, 10.3]);
});

test('Test VMA : position dans le test', () => {
  const paliers = paliersDuTest(PROTOCOLE_LEGER);
  const avant = situationTest(paliers, 0);
  egal(avant.dernier, null);
  egal(chronoArrondi(avant.suivant.t), '0:09');
  const ensuite = situationTest(paliers, 9.1);
  egal(ensuite.dernier.colonne, 1);
  egal(ensuite.dernier.palier.numero, 1);
  egal(chronoArrondi(ensuite.suivant.t), '0:18');
  const palier2 = situationTest(paliers, 63);
  egal(palier2.dernier.palier.numero, 2);
  egal(palier2.dernier.colonne, 1);
});

test('Test VMA : VMA avec part du palier réalisée, et VO₂max', () => {
  const paliers = paliersDuTest(PROTOCOLE_LEGER);
  const debut = resultatTest(paliers, 0, PROTOCOLE_LEGER);
  egal([debut.vma, debut.palier, debut.reperes, debut.distance], [8, 1, 0, 0]);
  const moitie = resultatTest(paliers, 27.1, PROTOCOLE_LEGER); // 3 repères sur 6 au palier 1
  egal(moitie.vma, 8.25);
  egal(moitie.vo2, 8.25 * 3.5);
  egal(moitie.distance, 60);
});

test('Test VMA : paramètres impossibles refusés', () => {
  egal(erreurParametre('vitesse', 10), null);
  vrai(erreurParametre('vitesse', 40) != null, 'vitesse trop haute acceptée');
  vrai(erreurParametre('increment', 0) != null, 'incrément nul accepté');
  vrai(erreurParametre('increment', NaN) != null, 'incrément vide accepté');
  vrai(erreurParametre('duree', 2) != null, 'durée trop courte acceptée');
  vrai(erreurParametre('distance', 1) != null, 'distance trop courte acceptée');
});

/* Demi-Cooper */
test('Demi-Cooper : VMA = distance ÷ 100, avec les mètres après le dernier repère', () => {
  const t = nouveauDemiCooper({ plots: 50, nom: 'Léa M.' }, 1000000);
  [15, 30, 45, 60].forEach((s) => enregistrerPassage(t, 0, 1000000 + s * 1000)); // 50 m en 15 s = 12 km/h
  const direct = cooperEnDirect(t);
  egal([direct.distance, direct.reperes, Math.round(direct.vitesse), Math.round(direct.vmaEstimee)], [200, 4, 12, 12]);
  egal(direct.distancePrevue, 1200); // 12 km/h pendant 6 min
  t.finLe = 1000000 + DUREE_COOPER * 1000;
  t.coureurs[0].distanceFinale = 0;
  egal(resultatCooper(t).vma, 2); // 200 m ÷ 100
  t.coureurs[0].distanceFinale = 30;
  const r = resultatCooper(t);
  egal([r.distance, r.vma], [230, 2.3]);
});

test('Demi-Cooper : un double appui est ignoré, les repères suivent les réglages', () => {
  const depart = 1000000;
  const t = nouveauDemiCooper({ plots: 100, nom: '' }, depart);
  egal(enregistrerPassage(t, 0, depart + 30000).accepte, true);
  egal(enregistrerPassage(t, 0, depart + 30500), { accepte: false, raison: 'double' });
  egal(cooperEnDirect(t).distance, 100);
  egal(enregistrerPassage(t, 0, depart + (DUREE_COOPER + 1) * 1000), { accepte: false, raison: 'temps' });
});

test('Demi-Cooper : le résultat d\'un élève de la liste va dans ses progrès, pas celui d\'un nom libre', () => {
  const depart = 2000000;
  const fini = (reglage) => {
    const t = nouveauDemiCooper(reglage, depart);
    [15, 30].forEach((s) => enregistrerPassage(t, 0, depart + s * 1000));
    t.finLe = depart + DUREE_COOPER * 1000;
    t.coureurs[0].distanceFinale = 20;
    return t;
  };
  const libre = fini({ plots: 50, nom: 'Invité' });
  egal(enregistrementCooper(libre), null);
  const eleve = fini({ plots: 50, nom: 'Léa M.', eleveId: 'e1', classe: '5A' });
  const e = enregistrementCooper(eleve);
  egal([e.eleveId, e.distance, e.vma, e.type], ['e1', 120, 1.2, 'demi-cooper']);
  const etat = etatSuivi();
  egal(ajouterTestVma(etat, e), true);
  egal(ajouterTestVma(etat, e), false); // pas de doublon
  egal(testsVmaEleve(etat, 'e1').length, 1);
  egal(elevesSuivis(etat).some((x) => x.id === 'e1'), true);
});

test('Demi-Cooper : le résultat part vers la tablette enseignant, sans doublon', () => {
  const autre = etatSuivi();
  autre.testsVma = [{ id: 'cooper1', type: 'demi-cooper', eleveId: 'e2', nom: 'Tom D.', classe: '5A', date: 5, distance: 1300, vma: 13 }];
  const local = etatInitial();
  const paquet = JSON.parse(JSON.stringify(paquetResultats(autre)));
  egal(fusionnerResultats(local, paquet), { ajoutes: 1, misAJour: 0, dejaPresents: 0 });
  egal(fusionnerResultats(local, paquet), { ajoutes: 0, misAJour: 0, dejaPresents: 1 });
  egal(testsVmaEleve(local, 'e2')[0].vma, 13);
  egal(local.eleves.some((x) => x.id === 'e2'), true);
});

test('Demi-Cooper : la VMA du test le plus récent passe dans la fiche Demi-fond', () => {
  const etat = etatSuivi();
  etat.coureurs = [{ id: 'e1', eleveId: 'e1', nom: 'Léa M.', classe: '5A', vma: 11, archive: false }];
  etat.testsVma = [
    { id: 'a', type: 'demi-cooper', eleveId: 'e1', date: 20, distance: 1300, vma: 13 },
    { id: 'b', type: 'demi-cooper', eleveId: 'e1', date: 10, distance: 1200, vma: 12 },
  ];
  egal(reporterVmaDemifond(etat, 'e1'), true);
  egal(etat.coureurs[0].vma, 13);
  // Un élève sans fiche de coureur en reçoit une
  etat.testsVma.push({ id: 'c', type: 'demi-cooper', eleveId: 'e2', date: 5, distance: 1250, vma: 12.5 });
  reporterVmaDemifond(etat, 'e2');
  egal(etat.coureurs.find((c) => c.id === 'e2').vma, 12.5);
  // Récupéré sur la tablette enseignant : la VMA suit aussi
  const local = etatInitial();
  fusionnerResultats(local, JSON.parse(JSON.stringify(paquetResultats(etat))));
  egal(local.coureurs.find((c) => c.id === 'e1').vma, 13);
});

test('PhotoFinish : temps au centième, tronqué comme un chrono', () => {
  egal(formatTemps(9876), '9,87');
  egal(formatTemps(62345), '1:02,34');
  egal(formatTemps(0), '0,00');
  egal(formatTemps(null), '–');
});

test('PhotoFinish : mouvement sur la ligne, sans compter un changement de lumière', () => {
  const bande = (valeurs) => {
    const pixels = new Uint8ClampedArray(valeurs.length * 2 * 4);
    valeurs.forEach((v, y) => [0, 1].forEach((x) => pixels.set([v, v, v, 255], (y * 2 + x) * 4)));
    return luminositesLignes(pixels, 2, valeurs.length);
  };
  const fond = bande(Array(10).fill(100));
  egal(partEnMouvement(bande(Array(10).fill(160)), fond), 0); // toute l'image s'éclaire
  egal(partEnMouvement(bande([100, 100, 100, 30, 30, 30, 30, 100, 100, 100]), fond), 0.4); // un coureur
  egal(partEnMouvement(fond, null), 0);
});

test('PhotoFinish : un passage par coureur, puis réarmement quand la ligne est calme', () => {
  const det = nouveauDetecteur();
  const seuil = seuilMouvement(60);
  const parts = [0, 0.5, 0.6, 0.4, 0, 0, 0.5, 0.5, 0];
  const passages = parts.map((p, i) => analyserImage(det, p, i * 33, seuil)).map((v, i) => (v ? i : null)).filter((v) => v != null);
  egal(passages, [1, 6]);
  vrai(seuilMouvement(100) < seuilMouvement(5), 'plus sensible = seuil plus bas');
});

test('PhotoFinish : le sifflet est un son fort et aigu, pas un bruit général', () => {
  const hz = 48000 / 1024;
  const spectre = (fond, pic) => {
    const o = new Uint8Array(512).fill(fond);
    for (let i = Math.round(2900 / hz); i <= Math.round(3100 / hz); i += 1) o[i] = pic;
    return o;
  };
  vrai(estSifflet(analyseSon(spectre(80, 220), hz), 50), 'sifflet reconnu');
  vrai(!estSifflet(analyseSon(spectre(200, 220), hz), 50), 'bruit large refusé');
  vrai(!estSifflet(analyseSon(spectre(40, 110), hz), 50), 'sifflet trop lointain');
});

test('PhotoFinish : plusieurs passages classés et exportés', () => {
  const course = nouvelleCourse({ methode: 'sifflet', classe: '5A' }, 1000);
  ajouterPassage(course, 8120.4, 'camera').eleveId = 'e1';
  ajouterPassage(course, 7950, 'camera').nom = 'Dossard 4';
  ajouterPassage(course, 8120, 'toucher');
  egal(passagesTries(course).map((p) => p.t), [7950, 8120, 8120]);
  egal(new Set(course.passages.map((p) => p.id)).size, 3);
  const lignes = lignesCsvCourse(course, [{ id: 'e1', nom: 'Léa M.', classe: '5A' }]);
  egal(lignes[1], ['1', '7,95', 'Dossard 4', '5A']);
  egal(lignes[2], ['2', '8,12', 'Léa M.', '5A']);
});

test('PhotoFinish : les temps attribués vont dans le dossier des élèves et partent à la tablette enseignant', () => {
  const etat = etatInitial();
  etat.eleves = [{ id: 'e1', nom: 'Léa M.', classe: '5A' }, { id: 'e2', nom: 'Tom B.', classe: '5A' }];
  const course = nouvelleCourse({ methode: 'sifflet', libelle: '50 m', classe: '5A' }, 5000);
  course.fin = 15000;
  ajouterPassage(course, 8200, 'camera').eleveId = 'e1';
  ajouterPassage(course, 7900, 'camera').eleveId = 'e2';
  ajouterPassage(course, 9000, 'camera').nom = 'Dossard 9'; // nom libre : pas de dossier
  egal(enregistrerTempsCourse(etat, course), 2);
  egal(tempsPfEleve(etat, 'e1').map((t) => [t.t, t.rang, t.partants, t.libelle]), [[8200, 2, 3, '50 m']]);
  vrai(elevesSuivis(etat).some((e) => e.id === 'e2'), 'élève suivi dans la Progression');
  // Correction après coup : le temps change de propriétaire, sans doublon
  course.passages[0].eleveId = 'e2';
  course.passages[1].eleveId = '';
  enregistrerTempsCourse(etat, course);
  egal(etat.tempsPf.map((t) => [t.eleveId, t.t]), [['e2', 8200]]);
  // Tablette enseignant : la version reçue de la course remplace l'ancienne
  const enseignant = etatInitial();
  enseignant.tempsPf = [{ id: 'vieux', courseId: course.id, eleveId: 'e1', t: 1 }];
  fusionnerResultats(enseignant, JSON.parse(JSON.stringify(paquetResultats(etat))));
  egal(enseignant.tempsPf.map((t) => [t.eleveId, t.t]), [['e2', 8200]]);
  vrai(enseignant.eleves.some((e) => e.id === 'e2'), 'élève transmis');
});

test('Une ancienne sauvegarde reçoit bien les défauts vides', () => {
  const ancienne = etatInitial();
  delete ancienne.reglages.defauts;
  egal(lireSauvegarde(JSON.parse(JSON.stringify(ancienne))).reglages.defauts, { criteres: {}, fiche: {}, projets: {} });
});

test('Bonus de contrat : seulement si activé', () => {
  egal(bonusContrat(3, { contratBonus: false, contratValeur: 2 }), 0);
  egal(bonusContrat(3, { contratBonus: true, contratValeur: 2 }), 6);
  egal(bonusContrat(3, { contratBonus: true, contratValeur: 0.5 }), 1.5);
});

test('La fusion ajoute les matchs reçus sans toucher aux données locales', () => {
  const autre = etatSuivi();
  const recu = match('Badminton', [[0, 'gag']], { id: 'm-autre', termine: true, termineLe: 5 });
  autre.matchs = [recu, match('Rugby', [], { id: 'vide' })];
  const local = etatInitial();
  local.apsa = 'Rugby';
  local.eleves = [{ id: 'e2', nom: 'Tom D.', classe: '5A' }];
  local.equipes = [{ id: 'A', nom: 'Équipe locale', classe: '', membres: [] }];
  local.reglages.contratValeur = 4;
  const bilan = fusionnerResultats(local, paquetResultats(autre));
  egal(bilan, { ajoutes: 1, misAJour: 0, dejaPresents: 0 });
  egal(local.matchs.map((m) => m.id), ['m-autre']);
  egal(local.equipes.find((t) => t.id === 'A').nom, 'Équipe locale');
  egal(local.equipes.find((t) => t.id === 'B').archivee, true);
  egal(local.apsa, 'Rugby');
  egal(local.reglages.contratValeur, 4);
});

test('La fusion ne crée pas de doublon et garde la version la plus avancée', () => {
  const local = etatInitial();
  const paquet = (evenements) => ({ matchs: [match('Handball', evenements, { id: 'm1' })] });
  fusionnerResultats(local, paquet([[0, 'but']]));
  egal(fusionnerResultats(local, paquet([[0, 'but']])), { ajoutes: 0, misAJour: 0, dejaPresents: 1 });
  egal(fusionnerResultats(local, paquet([[0, 'but'], [1, 'but']])), { ajoutes: 0, misAJour: 1, dejaPresents: 0 });
  egal(fusionnerResultats(local, paquet([[0, 'but']])), { ajoutes: 0, misAJour: 0, dejaPresents: 1 });
  egal(local.matchs.length, 1);
  egal(local.matchs[0].evenements.length, 2);
});

test('La fusion arrête un chrono resté lancé', () => {
  const local = etatInitial();
  fusionnerResultats(local, { exporteLe: 10000, matchs: [match('Handball', [[0, 'but']], { departChrono: 4000, duree: 10 })] });
  egal([local.matchs[0].departChrono, local.matchs[0].duree], [0, 16]);
});

test('Après fusion, la progression compte les matchs des deux tablettes', () => {
  const local = etatSuivi();
  local.matchs = [match('Badminton', [[0, 'gag']], { id: 'm1' })];
  const autre = etatSuivi();
  autre.matchs = [Object.assign(match('Handball', [[1, 'but']], { id: 'm2' }), { a: 'B', b: 'C' })];
  fusionnerResultats(local, paquetResultats(autre));
  egal(suiviEleve(local, 'e1').rencontres, 2);
  egal(suiviEleve(local, 'e1').sports.map((s) => s.apsa).sort(), ['Badminton', 'Handball']);
});

async function testsAsynchrones() {
  const etatChiffre = etatSuivi();
  etatChiffre.matchs = [match('Badminton', [[0, 'gag']], { id: 'm1' })];
  const texte = await creerFichierResultats(etatChiffre, 'un-long-mot-de-passe');
  const champs = Object.keys(JSON.parse(texte)).sort().join();
  const clair = champs === 'donnees,iterations,iv,sel' && !/Léa|classe|nom|equipes|matchs/.test(texte.replace(/"donnees":"[^"]*"/, ''));
  resultats.push([clair && !texte.includes('Léa'), 'Fichier de résultats : seuls des champs chiffrés sont lisibles']);
  const relu = await lireFichierResultats(texte, 'un-long-mot-de-passe');
  resultats.push([relu.matchs.length === 1, 'Fichier de résultats : relu avec le bon mot de passe']);
  let refus = false;
  try {
    await lireFichierResultats(texte, 'mauvais-mot-de-passe');
  } catch {
    refus = true;
  }
  resultats.push([refus, 'Fichier de résultats : un mauvais mot de passe est refusé']);
  const v3 = await lireFichierResultats(JSON.stringify(SAUVEGARDE_V3), '');
  resultats.push([v3.matchs.length === 2, 'Fichier de résultats : une sauvegarde V3 est acceptée']);

  const eleves = [{ id: 'e1', nom: 'Léa M.', classe: '5A' }];
  const paquet = await chiffrer(JSON.stringify(eleves), 'un-long-mot-de-passe');
  try {
    egal(await lireElevesProteges(paquet, 'un-long-mot-de-passe'), eleves);
    vrai(!JSON.stringify(paquet).includes('Léa'), 'prénom lisible dans le fichier');
    resultats.push([true, 'Liste protégée : relue avec le bon mot de passe, illisible sans lui']);
  } catch (erreur) {
    resultats.push([false, `Liste protégée : ${erreur.message}`]);
  }
  let refuse = false;
  try {
    await lireElevesProteges(paquet, 'mauvais-mot-de-passe');
  } catch {
    refuse = true;
  }
  resultats.push([refuse, 'Liste protégée : un mauvais mot de passe est refusé']);
}

test('La configuration partagée ne peut pas contenir d\'élèves', () => {
  const etat = etatInitial();
  etat.eleves = [{ id: 'e', nom: 'Léa', classe: '5A' }];
  const { conseil, criteres, projets, fiche, codeEmpreinte } = etat.reglages;
  vrai(!JSON.stringify({ conseil, criteres, projets, fiche, codeEmpreinte }).includes('Léa'), 'élève présent');
});

test('L\'empreinte d\'un code est stable et ne contient pas le code', () => {
  egal(empreinte('code-exemple'), empreinte('code-exemple'));
  vrai(empreinte('code-exemple') !== empreinte('autre-exemple'), 'empreintes identiques');
  vrai(!empreinte('code-exemple').includes('code'), 'code lisible');
});

await testsAsynchrones();

const echecs = resultats.filter(([ok]) => !ok).length;
document.querySelector('#bilan').textContent = echecs ? `${echecs} test(s) en échec sur ${resultats.length}` : `${resultats.length} tests réussis`;
document.querySelector('#liste').innerHTML = resultats
  .map(([ok, nom]) => `<li class="${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✗'} ${nom}</li>`)
  .join('');
