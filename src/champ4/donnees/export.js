import { chiffrer, dechiffrer } from '../../noyau/chiffrement.js';
import { telecharger } from '../../noyau/outils.js';
import { NIVEAUX_PROJET } from '../contenu/apsa.js';
import { cumulEquipe, indicateurs, rencontresObservees } from '../calculs/stats.js';
import { score, tempsEcoule } from '../calculs/match.js';
import { creerClasseur, TYPE_XLSX } from '../../noyau/classeur.js';

export const FICHIER_ELEVES = 'eleves-proteges.json';

/* Tableau des statistiques, ouvrable dans Excel. */
export function lignesCsv(etat) {
  const nomEquipe = (id) => etat.equipes.find((e) => e.id === id)?.nom ?? '?';
  const lignes = [['APSA', 'Poule', 'Équipe A', 'Équipe B', 'Indicateur', 'A', 'B']];
  etat.matchs
    .filter((m) => m.evenements.length)
    .forEach((m) => {
      const debut = [m.apsa, etat.poules.find((p) => p.id === m.pouleId)?.nom || '', nomEquipe(m.a), nomEquipe(m.b)];
      indicateurs(m).forEach((l) => lignes.push([...debut, ...l]));
      if (m.conseils[0] || m.conseils[1]) lignes.push([...debut, 'Conseil', m.conseils[0], m.conseils[1]]);
      m.projets.forEach((liste, eq) => {
        if (liste.length) {
          const texte = liste.join(' | ');
          lignes.push([...debut, 'Projet de jeu choisi', eq ? '' : texte, eq ? texte : '']);
        }
      });
      m.bilanProjet.forEach((bilan, eq) => {
        Object.entries(bilan).forEach(([projet, niveau]) => {
          const texte = NIVEAUX_PROJET[niveau];
          lignes.push([...debut, `Projet précédent : ${projet}`, eq ? '' : texte, eq ? texte : '']);
        });
      });
    });
  return lignes;
}

export function exporterCsv(etat) {
  const texte = lignesCsv(etat)
    .map((ligne) => ligne.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  telecharger('stats_eps.csv', `﻿${texte}`, 'text/csv');
}

/* Classeur Excel propre et lisible : rencontres, détail de chaque rencontre, cumul par équipe / joueur. */
export function feuillesStats(etat, apsa, maintenant = Date.now()) {
  const nomEquipe = (id) => etat.equipes.find((e) => e.id === id)?.nom ?? '?';
  const date = (t) => (t ? new Date(t).toLocaleDateString('fr-FR') : 'en cours');
  const matchs = etat.matchs
    .filter((m) => m.evenements.length && (!apsa || m.apsa === apsa))
    .sort((p, q) => (p.termineLe || Number.MAX_SAFE_INTEGER) - (q.termineLe || Number.MAX_SAFE_INTEGER));
  const titre = (texte) => [{ v: texte, style: 'titre' }];
  const entete = (...cases) => cases.map((v) => ({ v, style: 'entete' }));
  const section = (texte, largeur) => [{ v: texte, style: 'section' }, ...Array(largeur - 1).fill({ v: '', style: 'section' })];
  const sousTitre = `${apsa || 'Toutes les APSA'} · exporté le ${new Date(maintenant).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;

  const rencontres = [
    titre('EPS + · Rencontres'),
    [sousTitre],
    [],
    entete('Date', 'APSA', 'Poule', 'Équipe / joueur A', 'Score A', 'Score B', 'Équipe / joueur B', 'Durée (min)', 'État', 'Observé par'),
    ...matchs.map((m) => [
      date(m.termineLe),
      m.apsa,
      etat.poules.find((p) => p.id === m.pouleId)?.nom || '',
      nomEquipe(m.a),
      score(m, 0),
      score(m, 1),
      nomEquipe(m.b),
      Math.round(tempsEcoule(m) / 6) / 10,
      m.termine ? 'Terminé' : 'En cours',
      m.observePar?.nom || '',
    ]),
  ];

  const detail = [titre('EPS + · Détail de chaque rencontre'), [sousTitre], []];
  matchs.forEach((m, rang) => {
    detail.push(section(`Rencontre ${rang + 1} · ${m.apsa} · ${date(m.termineLe)} · ${nomEquipe(m.a)} ${score(m, 0)} – ${score(m, 1)} ${nomEquipe(m.b)}`, 3));
    detail.push(entete('Indicateur', nomEquipe(m.a), nomEquipe(m.b)));
    indicateurs(m).forEach((l) => detail.push(l));
    if (m.conseils[0] || m.conseils[1]) detail.push(['Conseil', m.conseils[0], m.conseils[1]]);
    m.projets.forEach((liste, eq) => {
      if (liste.length) detail.push(['Projet de jeu choisi', eq ? '' : liste.join(' | '), eq ? liste.join(' | ') : '']);
    });
    m.bilanProjet.forEach((bilan, eq) =>
      Object.entries(bilan).forEach(([projet, niveau]) => {
        const texte = NIVEAUX_PROJET[niveau];
        detail.push([`Projet précédent : ${projet}`, eq ? '' : texte, eq ? texte : '']);
      }),
    );
    detail.push([]);
  });

  const ids = [...new Set(matchs.flatMap((m) => [m.a, m.b]))].sort((p, q) => nomEquipe(p).localeCompare(nomEquipe(q)));
  const cumul = [titre('EPS + · Cumul par équipe ou joueur'), [sousTitre], []];
  [...new Set(matchs.map((m) => m.apsa))].forEach((sport) =>
    ids.forEach((id) => {
      const c = cumulEquipe(rencontresObservees(matchs, sport, id));
      if (!c) return;
      cumul.push(section(`${nomEquipe(id)} · ${sport} · ${c.rencontres} rencontre${c.rencontres > 1 ? 's' : ''} · ${c.victoires} V / ${c.nuls} N / ${c.defaites} D · points ${c.pour} – ${c.contre}`, 4));
      cumul.push(entete('Indicateur', nomEquipe(id), 'Adversaires', 'Moyenne par rencontre'));
      c.lignes.forEach(([libelle, a, b, moyenne]) => cumul.push([libelle, a, b, moyenne === '' ? '' : Number(String(moyenne).replace(',', '.'))]));
      cumul.push([]);
    }),
  );

  return [
    { nom: 'Rencontres', largeurs: [12, 16, 14, 24, 9, 9, 24, 12, 11, 18], lignes: rencontres },
    { nom: 'Détail des rencontres', largeurs: [46, 24, 24], lignes: detail },
    { nom: 'Cumul par équipe', largeurs: [46, 22, 16, 22], lignes: cumul },
  ];
}

export function exporterClasseur(etat, apsa) {
  const d = new Date();
  const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nom = `stats-eps-${(apsa || 'toutes').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${jour}.xlsx`;
  telecharger(nom, creerClasseur(feuillesStats(etat, apsa)), TYPE_XLSX);
}

export const exporterSauvegarde = (etat) =>
  telecharger('sauvegarde_eps.json', JSON.stringify(etat), 'application/json');

/* Fichier des élèves à déposer sur le site : chiffré, donc illisible sans le mot de passe. */
export async function exporterElevesProteges(etat, motDePasse) {
  /* Chaque élève : prénom + initiale, classe et empreinte de son code (cle), jamais le code lisible. */
  const eleves = etat.eleves.map(({ id, nom, classe, cle }) => ({ id, nom, classe, cle }));
  const paquet = await chiffrer(JSON.stringify(eleves), motDePasse);
  telecharger(FICHIER_ELEVES, JSON.stringify(paquet), 'application/json');
}

export async function lireElevesProteges(paquet, motDePasse) {
  const eleves = JSON.parse(await dechiffrer(paquet, motDePasse));
  if (!Array.isArray(eleves)) throw new Error('Liste invalide');
  return eleves;
}

/* La configuration partagée ne contient jamais les listes d'élèves. */
export function exporterConfiguration(etat) {
  const version = Date.now();
  etat.configVersion = version;
  const { conseil, ficheObservateurs, criteres, projets, fiche, codeEmpreinte, contratBonus, contratValeur, defauts, demifond, contrats, cirque } = etat.reglages;
  telecharger(
    'config.json',
    JSON.stringify({ version, reglages: { conseil, ficheObservateurs, criteres, projets, fiche, codeEmpreinte, contratBonus, contratValeur, defauts, demifond, contrats, cirque } }),
    'application/json',
  );
}
