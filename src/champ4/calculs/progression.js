/* Suivi individuel : statistiques d'un élève dans tous les sports.
   Seuls comptent les élèves de la liste choisis dans une équipe ou comme joueur seul.
   Les événements étant notés par équipe, un élève reçoit ceux de son équipe. */
import { compte, libelleDe, pointsDe, score } from './match.js';

export const elevesSuivis = (etat) => {
  const membres = new Set(etat.equipes.flatMap((t) => t.membres || []));
  (etat.courses || []).forEach((course) =>
    course.coureurs.forEach((c) => {
      if (c.eleveId) membres.add(c.eleveId);
    }),
  );
  return etat.eleves.filter((e) => membres.has(e.id));
};

/* Rencontres observées de l'élève, de la plus ancienne à la plus récente (en cours à la fin). */
export function rencontresEleve(etat, idEleve) {
  const equipes = etat.equipes.filter((t) => (t.membres || []).includes(idEleve)).map((t) => t.id);
  const ordre = (m) => m.termineLe || Number.MAX_SAFE_INTEGER;
  return etat.matchs
    .filter((m) => m.evenements.length && (equipes.includes(m.a) || equipes.includes(m.b)))
    .sort((p, q) => ordre(p) - ordre(q))
    .map((match) => ({ match, cote: equipes.includes(match.a) ? 0 : 1 }));
}

/* Élèves rattachés au côté A (0) ou B (1) d'un match. */
export function membresDuCote(etat, match, cote) {
  const equipe = etat.equipes.find((t) => t.id === (cote ? match.b : match.a));
  return (equipe?.membres || []).filter((id) => etat.eleves.some((e) => e.id === id));
}

/* Contrat d'un élève pour ce match. Une fois le match commencé, seul le contrat
   enregistré dans le match compte : changer de contrat ne réécrit pas le passé. */
export function contratDuMatch(etat, match, idEleve) {
  if (match.contrats && idEleve in match.contrats) return match.contrats[idEleve];
  if (match.evenements.length) return '';
  return etat.contrats?.[idEleve]?.[match.apsa] || '';
}

/* Bonus affiché en progression si l'enseignant l'a activé ; le score des matchs ne change pas. */
export const bonusContrat = (points, reglages) =>
  reglages.contratBonus ? points * (Number(reglages.contratValeur) || 0) : 0;

function suiviContrat(etat, rencontres, idEleve) {
  const lignes = rencontres
    .map(({ match, cote }) => {
      const cle = contratDuMatch(etat, match, idEleve);
      if (!cle) return null;
      const nombre = compte(match, cote, cle);
      return {
        match,
        cote,
        libelle: libelleDe(match, cle),
        nombre,
        points: nombre * Math.max(pointsDe(match, cle), 0),
        gagnes: score(match, cote),
      };
    })
    .filter(Boolean);
  if (!lignes.length) return null;
  const somme = (champ) => lignes.reduce((s, l) => s + l[champ], 0);
  return {
    lignes,
    nombre: somme('nombre'),
    points: somme('points'),
    gagnes: somme('gagnes'),
    parts: lignes.filter((l) => l.match.termine).map((l) => (l.gagnes ? l.points / l.gagnes : 0)),
  };
}

function suiviSport(etat, apsa, rencontres, idEleve) {
  const suivi = {
    apsa,
    rencontres: rencontres.length,
    terminees: 0,
    victoires: 0,
    nuls: 0,
    defaites: 0,
    pointsPour: 0,
    pointsContre: 0,
    parts: [],
    contrat: suiviContrat(etat, rencontres, idEleve),
  };
  const criteres = new Map();
  const projets = new Map();
  const fiche = new Map();
  rencontres.forEach(({ match, cote }) => {
    const pour = score(match, cote);
    const contre = score(match, 1 - cote);
    suivi.pointsPour += pour;
    suivi.pointsContre += contre;
    (match.criteres || []).forEach((c) => {
      const ligne = criteres.get(c.cle) || { libelle: c.libelle, points: c.points, nombre: 0 };
      ligne.libelle = c.libelle;
      ligne.nombre += compte(match, cote, c.cle);
      criteres.set(c.cle, ligne);
    });
    Object.entries(match.bilanProjet?.[cote] || {}).forEach(([projet, niveau]) => projets.set(projet, niveau));
    Object.entries(match.fiche?.[cote] || {}).forEach(([item, niveau]) => {
      const ligne = fiche.get(item) || { total: 0, nombre: 0 };
      ligne.total += niveau;
      ligne.nombre += 1;
      fiche.set(item, ligne);
    });
    if (match.termine) {
      suivi.terminees += 1;
      if (pour > contre) suivi.victoires += 1;
      else if (contre > pour) suivi.defaites += 1;
      else suivi.nuls += 1;
      suivi.parts.push(pour + contre ? pour / (pour + contre) : 0);
    }
  });
  suivi.criteres = [...criteres.values()];
  suivi.projets = [...projets.entries()].map(([texte, niveau]) => ({ texte, niveau }));
  suivi.fiche = [...fiche.entries()].map(([texte, l]) => ({ texte, moyenne: l.total / l.nombre }));
  return suivi;
}

/* Bilan complet d'un élève : total tous sports et détail par sport. */
export function suiviEleve(etat, idEleve) {
  const rencontres = rencontresEleve(etat, idEleve);
  const parApsa = new Map();
  rencontres.forEach((r) => {
    parApsa.set(r.match.apsa, [...(parApsa.get(r.match.apsa) || []), r]);
  });
  const sports = [...parApsa.entries()].map(([apsa, liste]) => suiviSport(etat, apsa, liste, idEleve));
  const total = (champ) => sports.reduce((s, x) => s + x[champ], 0);
  return {
    sports,
    rencontres: rencontres.length,
    victoires: total('victoires'),
    nuls: total('nuls'),
    defaites: total('defaites'),
    pointsContrat: sports.reduce((s, x) => s + (x.contrat?.points || 0), 0),
  };
}
