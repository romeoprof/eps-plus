/* Valeurs en vigueur : réglages de l'enseignant s'ils existent, sinon contenu par défaut. */
import { etat } from '../noyau/etat.js';
import { APSA } from './contenu/apsa.js';

export const criteresApsa = (apsa) => etat.reglages.criteres[apsa] || APSA[apsa].criteres;
export const projetsApsa = (apsa) => etat.reglages.projets[apsa] || APSA[apsa].projets;
export const ficheApsa = (apsa) => etat.reglages.fiche[apsa] || projetsApsa(apsa);

export const criteresDuMatch = (match) => match.criteres || criteresApsa(match.apsa);

export const nomEquipe = (id) => etat.equipes.find((e) => e.id === id)?.nom ?? '?';
export const equipesActives = () => etat.equipes.filter((e) => !e.archivee);
export const matchCourant = () => etat.matchs.find((m) => m.id === etat.matchCourant);

/* Nom de l'équipe A (côté 0) ou B (côté 1) d'un match. */
export const nomCote = (match, cote) => nomEquipe(cote ? match.b : match.a);
