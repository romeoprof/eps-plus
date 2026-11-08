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
  criteres.forEach((c) => lignes.push([c.libelle, compte(match, 0, c.cle), compte(match, 1, c.cle)]));
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
