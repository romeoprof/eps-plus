/* Vérifie les calculs, la reprise des données et la protection de la liste d'élèves.
   Ouvrir tests/index.html via le serveur local. */
import { APSA } from '../src/champ4/contenu/apsa.js';
import { classer } from '../src/champ4/calculs/classement.js';
import { possesseur, score, tempsDePossession } from '../src/champ4/calculs/match.js';
import { indicateurs } from '../src/champ4/calculs/stats.js';
import { projetPrecedent } from '../src/champ4/calculs/suivi.js';
import { lignesCsv, lireElevesProteges } from '../src/champ4/donnees/export.js';
import { chiffrer } from '../src/noyau/chiffrement.js';
import { lireSauvegarde, migrerV3 } from '../src/champ4/donnees/migration.js';
import { etatInitial, nouveauMatch } from '../src/champ4/donnees/modele.js';
import { importerEleves, reinitialiserBilans, supprimerEquipe } from '../src/champ4/donnees/operations.js';
import { empreinte } from '../src/noyau/outils.js';

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

async function testsAsynchrones() {
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
