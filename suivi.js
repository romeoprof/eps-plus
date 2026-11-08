import { libelleDe, pointsDe, score } from './match.js';

const cote = (match, idEquipe) => (match.a === idEquipe ? 0 : 1);

/* Projet de jeu choisi par une équipe lors de sa dernière rencontre terminée. */
export function projetPrecedent(matchs, match, idEquipe) {
  const precedent = matchs
    .filter(
      (x) =>
        x !== match &&
        x.apsa === match.apsa &&
        x.termine &&
        x.termineLe &&
        (!match.termineLe || x.termineLe < match.termineLe) &&
        (x.a === idEquipe || x.b === idEquipe) &&
        x.projets[cote(x, idEquipe)].length,
    )
    .sort((p, q) => q.termineLe - p.termineLe)[0];
  return precedent ? precedent.projets[cote(precedent, idEquipe)] : [];
}

/* { idEquipe: [[match, côté], ...] } pour les matchs terminés, du plus ancien au plus récent. */
export function rencontresParEquipe(matchs, apsa) {
  const parEquipe = {};
  matchs
    .filter((m) => m.apsa === apsa && m.termine && m.termineLe)
    .sort((p, q) => p.termineLe - q.termineLe)
    .forEach((m) =>
      [m.a, m.b].forEach((id, equipe) => {
        (parEquipe[id] = parEquipe[id] || []).push([m, equipe]);
      }),
    );
  return parEquipe;
}

const lePlusFrequent = (compteur) => Object.keys(compteur).sort((a, b) => compteur[b] - compteur[a])[0];

/* Profil d'un joueur de raquette sur toutes ses rencontres. */
export function profilJoueur(rencontres) {
  const coups = {};
  const fautes = {};
  const zones = {};
  let exemple = null;
  const parts = rencontres.map(([m, equipe]) => {
    exemple = m;
    m.evenements
      .filter((e) => e.equipe === equipe)
      .forEach((e) => {
        const points = pointsDe(m, e.critere);
        if (points > 0) coups[e.critere] = (coups[e.critere] || 0) + 1;
        if (points < 0) fautes[e.critere] = (fautes[e.critere] || 0) + 1;
        if (e.zone != null) zones[e.zone] = (zones[e.zone] || 0) + 1;
      });
    const pour = score(m, equipe);
    const contre = score(m, 1 - equipe);
    return pour + contre ? pour / (pour + contre) : 0;
  });
  const coup = lePlusFrequent(coups);
  const faute = lePlusFrequent(fautes);
  const zone = lePlusFrequent(zones);
  return {
    parts,
    coup: coup ? { libelle: libelleDe(exemple, coup), nombre: coups[coup] } : null,
    faute: faute ? { libelle: libelleDe(exemple, faute), nombre: fautes[faute] } : null,
    zone: zone != null ? Number(zone) : null,
  };
}
