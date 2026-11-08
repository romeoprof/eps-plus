/* Accès aux réglages et aux coureurs du demi-fond. */
import { etat } from '../noyau/etat.js';
import { REGLAGES_DEFAUT } from './contenu.js';

export const reglagesDemifond = () => ({
  ...REGLAGES_DEFAUT,
  ...etat.reglages.demifond,
  consignes: { ...REGLAGES_DEFAUT.consignes, ...etat.reglages.demifond?.consignes },
});

export const coureurDe = (id) => etat.coureurs.find((c) => c.id === id);
export const courseEnCours = () => etat.courses.find((c) => c.id === etat.courseEnCours);

/* Tout élève de la liste peut courir ; sa fiche de coureur est créée à la première VMA saisie. */
export function ficheCoureur(id) {
  let coureur = coureurDe(id);
  if (!coureur) {
    const eleve = etat.eleves.find((e) => e.id === id);
    if (!eleve) return null;
    coureur = { id, eleveId: id, nom: eleve.nom, classe: eleve.classe, vma: null, archive: false };
    etat.coureurs.push(coureur);
  }
  return coureur;
}

/* Élèves de la liste et coureurs ajoutés à la main, réunis pour l'affichage. */
export function tousLesCoureurs() {
  const depuisEleves = etat.eleves.map(
    (e) => coureurDe(e.id) || { id: e.id, eleveId: e.id, nom: e.nom, classe: e.classe, vma: null, archive: false },
  );
  const libres = etat.coureurs.filter((c) => !c.eleveId);
  return [...depuisEleves, ...libres];
}

export const dateCourte = (horodatage) => (horodatage ? new Date(horodatage).toLocaleDateString('fr-FR') : '–');
