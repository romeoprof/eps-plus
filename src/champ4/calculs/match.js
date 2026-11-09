/* Calculs sur un match. Chaque match garde ses propres critères : modifier
   les réglages ne change donc jamais le score d'un match déjà commencé. */

const critereDe = (match, cle) => (match.criteres || []).find((c) => c.cle === cle);

export const pointsDe = (match, cle) => critereDe(match, cle)?.points ?? 0;
export const libelleDe = (match, cle) => critereDe(match, cle)?.libelle ?? cle;

/* Cohérence zone / critère (zones 0 à 8 : côté A, zones 9 à 17 : côté B).
   Un coup qui marque arrive dans le camp adverse ; une faute ne se note pas sur une zone. */
export function coupPossible(zone, cote, points) {
  if (zone == null || points === 0) return true;
  if (points < 0) return false;
  const campDeLaZone = zone < 9 ? 0 : 1;
  return campDeLaZone !== cote;
}

export const compte = (match, equipe, cle) =>
  match.evenements.filter((e) => e.equipe === equipe && e.critere === cle).length;

export function score(match, equipe) {
  return match.evenements.reduce((total, e) => {
    const points = pointsDe(match, e.critere);
    if (points > 0 && e.equipe === equipe) return total + points;
    if (points < 0 && e.equipe !== equipe) return total - points;
    return total;
  }, 0);
}

export const tempsEcoule = (match, maintenant = Date.now()) =>
  match.duree + (match.departChrono ? (maintenant - match.departChrono) / 1000 : 0);

/* Quelle équipe a la balle après cet événement ? */
function possesseurApres(match, evenement, actuel) {
  const avecPossession = (match.criteres || []).some((c) => c.cle === 'poss');
  if (avecPossession) {
    if (evenement.critere === 'poss') return evenement.equipe;
    if (evenement.critere === 'perte') return 1 - evenement.equipe;
    return actuel;
  }
  const points = pointsDe(match, evenement.critere);
  if (points > 0) return evenement.equipe;
  if (points < 0) return 1 - evenement.equipe;
  return actuel;
}

export function possesseur(match) {
  return match.evenements.reduce((actuel, e) => possesseurApres(match, e, actuel), null);
}

/* Temps de possession [équipe A, équipe B] en secondes, recalculé depuis les
   événements : annuler une action corrige donc aussi ce temps. */
export function tempsDePossession(match, maintenant = Date.now()) {
  const cumul = [0, 0];
  let actuel = null;
  let debut = 0;
  for (const e of match.evenements) {
    const suivant = possesseurApres(match, e, actuel);
    if (suivant !== actuel && e.t != null) {
      if (actuel != null) cumul[actuel] += e.t - debut;
      actuel = suivant;
      debut = e.t;
    }
  }
  if (actuel != null) cumul[actuel] += tempsEcoule(match, maintenant) - debut;
  return cumul;
}
