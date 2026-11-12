import { APSA } from '../contenu/apsa.js';
import { decimal, pourcent } from '../../noyau/outils.js';
import { compte, score, tempsDePossession, tempsEcoule } from './match.js';

const CLES_DE_BASE = ['poss', 'tir', 'but', 'perte', 'faute'];
/* Ces actions complètent une possession déjà conclue (transformation, 2e lancer franc) :
   elles comptent au score, mais pas dans l'efficacité, qui dépasserait sinon 100 %. */
const COMPLEMENTS = ['trf', 'lf'];

function statsCollectif(match) {
  const criteres = match.criteres;
  const existe = (cle) => criteres.some((c) => c.cle === cle);
  const actionsDeScore = (eq) =>
    criteres.filter((c) => c.points > 0).reduce((s, c) => s + compte(match, eq, c.cle), 0);
  const nb = (eq, cle) => compte(match, eq, cle);
  /* Rugby et Ultimate n'ont pas de critère « tir » : aucun indicateur de tir pour eux. */
  const avecTirs = existe('tir');
  const tirs = (eq) => nb(eq, 'tir') + actionsDeScore(eq);
  const avecPossessions = existe('poss');
  const lignes = [];
  const ajouter = (libelle, calcul) => lignes.push([libelle, calcul(0), calcul(1)]);

  if (avecPossessions) ajouter('Possessions', (eq) => nb(eq, 'poss'));
  if (avecTirs) ajouter('Tirs (total)', tirs);
  ajouter('Actions de score', actionsDeScore);
  if (existe('perte')) ajouter('Pertes de balle', (eq) => nb(eq, 'perte'));
  if (existe('faute')) ajouter('Fautes', (eq) => nb(eq, 'faute'));
  if (avecTirs) {
    ajouter('Conversion tirs → buts', (eq) => pourcent(actionsDeScore(eq), tirs(eq)));
    if (avecPossessions) ajouter('Densité (tirs / possessions)', (eq) => pourcent(tirs(eq), nb(eq, 'poss')));
  }
  if (avecPossessions) {
    const conclusions = (eq) =>
      criteres
        .filter((c) => c.points > 0 && !COMPLEMENTS.includes(c.cle))
        .reduce((s, c) => s + compte(match, eq, c.cle), 0);
    ajouter('Efficacité (actions de score / possessions)', (eq) => pourcent(conclusions(eq), nb(eq, 'poss')));
    if (existe('perte')) ajouter('Pertes / possessions', (eq) => pourcent(nb(eq, 'perte'), nb(eq, 'poss')));
  }
  criteres
    .filter((c) => !CLES_DE_BASE.includes(c.cle) && !(c.points > 0))
    .forEach((c) => ajouter(c.libelle, (eq) => nb(eq, c.cle)));
  if (avecTirs && existe('fav')) {
    ajouter('Tirs en situation favorable (%)', (eq) => pourcent(nb(eq, 'fav'), tirs(eq)));
  }
  const temps = tempsDePossession(match);
  if (temps[0] + temps[1] > 0) {
    ajouter('Temps de possession (%)', (eq) => pourcent(temps[eq], temps[0] + temps[1]));
  }
  const minutes = tempsEcoule(match) / 60;
  if (minutes > 0) {
    if (avecTirs) ajouter('Tirs par minute', (eq) => decimal((tirs(eq) / minutes).toFixed(1)));
    ajouter('Actions de score par minute', (eq) => decimal((actionsDeScore(eq) / minutes).toFixed(1)));
  }
  return lignes;
}

function statsDuel(match) {
  const criteres = match.criteres;
  const total = score(match, 0) + score(match, 1);
  const lignes = [
    ['Points', score(match, 0), score(match, 1)],
    ['Part des points', pourcent(score(match, 0), total), pourcent(score(match, 1), total)],
  ];
  /* Un contrat n'apparaît que s'il a servi dans ce match. */
  criteres
    .filter((c) => !c.contrat || compte(match, 0, c.cle) + compte(match, 1, c.cle) > 0)
    .forEach((c) => lignes.push([c.libelle, compte(match, 0, c.cle), compte(match, 1, c.cle)]));
  const somme = (eq, liste) => liste.reduce((s, c) => s + compte(match, eq, c.cle), 0);
  const reussite = (eq) => {
    const gagnants = somme(eq, criteres.filter((c) => c.points > 0));
    return pourcent(gagnants, gagnants + somme(eq, criteres.filter((c) => c.points < 0)));
  };
  lignes.push(['Réussite (gagnants / gagnants + fautes)', reussite(0), reussite(1)]);
  return lignes;
}

/* Lignes du bilan : [indicateur, valeur équipe A, valeur équipe B]. */
export const indicateurs = (match) => (APSA[match.apsa]?.collectif ? statsCollectif(match) : statsDuel(match));

/* Rencontres observées d'une équipe (ou d'un joueur), de la plus ancienne à la plus récente : [[match, côté]]. */
export const rencontresObservees = (matchs, apsa, idEquipe) =>
  matchs
    .filter((m) => m.apsa === apsa && m.evenements.length && (m.a === idEquipe || m.b === idEquipe))
    .sort((p, q) => (p.termineLe || Number.MAX_SAFE_INTEGER) - (q.termineLe || Number.MAX_SAFE_INTEGER))
    .map((m) => [m, m.a === idEquipe ? 0 : 1]);

/* Toutes les rencontres d'une équipe réunies en une seule : l'équipe devient le côté A,
   ses adversaires successifs le côté B. Les indicateurs se calculent alors comme pour un match. */
export function matchCumule(rencontres) {
  const criteres = [];
  const evenements = [];
  let decalage = 0;
  rencontres.forEach(([m, cote]) => {
    (m.criteres || []).forEach((c) => {
      if (!criteres.some((x) => x.cle === c.cle)) criteres.push({ ...c });
    });
    m.evenements.forEach((e) => {
      const copie = { ...e, equipe: e.equipe === cote ? 0 : 1 };
      if (e.t != null) copie.t = e.t + decalage;
      evenements.push(copie);
    });
    decalage += tempsEcoule(m);
  });
  return { apsa: rencontres[0]?.[0].apsa, criteres, evenements, duree: decalage, departChrono: 0 };
}

/* Cumul d'une équipe : indicateurs sur toutes ses rencontres, bilan V/N/D et moyenne par rencontre. */
export function cumulEquipe(rencontres) {
  if (!rencontres.length) return null;
  const cumul = matchCumule(rencontres);
  const n = rencontres.length;
  let lignes = indicateurs(cumul);
  /* Le temps de possession se recalcule rencontre par rencontre (la balle repart de zéro à chaque match). */
  const possession = rencontres.reduce(
    (s, [m, cote]) => {
      const t = tempsDePossession(m);
      return [s[0] + t[cote], s[1] + t[1 - cote]];
    },
    [0, 0],
  );
  lignes = lignes.map((l) =>
    l[0] === 'Temps de possession (%)' ? [l[0], pourcent(possession[0], possession[0] + possession[1]), pourcent(possession[1], possession[0] + possession[1])] : l,
  );
  const moyenne = (v) => (typeof v === 'number' ? decimal((v / n).toFixed(1)) : '');
  const bilan = { victoires: 0, nuls: 0, defaites: 0, pour: 0, contre: 0 };
  rencontres.forEach(([m, cote]) => {
    const pour = score(m, cote);
    const contre = score(m, 1 - cote);
    bilan.pour += pour;
    bilan.contre += contre;
    if (m.termine) {
      if (pour > contre) bilan.victoires += 1;
      else if (pour < contre) bilan.defaites += 1;
      else bilan.nuls += 1;
    }
  });
  return { rencontres: n, ...bilan, lignes: lignes.map((l) => [...l, moyenne(l[1])]) };
}
