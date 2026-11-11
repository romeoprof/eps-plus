import { chiffrer, dechiffrer } from '../../noyau/chiffrement.js';
import { telecharger } from '../../noyau/outils.js';
import { NIVEAUX_PROJET } from '../contenu/apsa.js';
import { indicateurs } from '../calculs/stats.js';

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
  const { conseil, criteres, projets, fiche, codeEmpreinte, contratBonus, contratValeur, defauts, demifond, contrats } = etat.reglages;
  telecharger(
    'config.json',
    JSON.stringify({ version, reglages: { conseil, criteres, projets, fiche, codeEmpreinte, contratBonus, contratValeur, defauts, demifond, contrats } }),
    'application/json',
  );
}
