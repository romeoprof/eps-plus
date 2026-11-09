/* Valeurs en vigueur : réglages de l'enseignant s'ils existent, sinon contenu par défaut. */
import { etat } from '../noyau/etat.js';
import { APSA } from './contenu/apsa.js';

/* Priorité : réglage en cours, puis défaut choisi par l'enseignant, puis contenu d'origine. */
const defautChoisi = (type, apsa) => etat.reglages.defauts?.[type]?.[apsa];
export const aUnDefautChoisi = (type, apsa) => !!defautChoisi(type, apsa);

export const criteresApsa = (apsa) => etat.reglages.criteres[apsa] || defautChoisi('criteres', apsa) || APSA[apsa].criteres;
const nonVides = (liste) => liste.filter((ligne) => ligne.trim());
export const projetsApsa = (apsa) => nonVides(etat.reglages.projets[apsa] || defautChoisi('projets', apsa) || APSA[apsa].projets);
export const ficheApsa = (apsa) => nonVides(etat.reglages.fiche[apsa] || defautChoisi('fiche', apsa) || projetsApsa(apsa));

/* Pour l'espace enseignant : garde les lignes vides en cours de saisie. */
export function listeEditable(type, apsa) {
  return etat.reglages[type][apsa] || (type === 'fiche' ? ficheApsa(apsa) : projetsApsa(apsa));
}

/* Contrats créés par l'enseignant : chacun devient une façon de marquer pour l'élève qui le choisit. */
export const contratsApsa = (apsa) => etat.reglages.contrats?.[apsa] || [];
const criteresContrat = (apsa) =>
  contratsApsa(apsa)
    .filter((c) => c.nom.trim())
    .map((c) => ({ cle: c.id, libelle: c.nom.trim(), points: c.points, contrat: true }));

export const criteresDuMatch = (match) =>
  match.criteres || [...criteresApsa(match.apsa), ...criteresContrat(match.apsa)];

export const nomEquipe = (id) => etat.equipes.find((e) => e.id === id)?.nom ?? '?';
export const equipesActives = () => etat.equipes.filter((e) => !e.archivee);
export const matchCourant = () => etat.matchs.find((m) => m.id === etat.matchCourant);

/* Nom de l'équipe A (côté 0) ou B (côté 1) d'un match. */
export const nomCote = (match, cote) => nomEquipe(cote ? match.b : match.a);
