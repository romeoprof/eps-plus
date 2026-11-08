/* Les quatre onglets du module Demi-fond. */
import { declarerActions, rafraichir, vue } from '../../noyau/interface.js';
import { vueBilanDF } from './bilan.js';
import { vueCoureurs } from './coureurs.js';
import { vueCourse } from './course.js';
import { vueProjet } from './projet.js';

export const ONGLETS_DF = [
  { id: 'coureurs', libelle: '👥 Coureurs', vue: vueCoureurs },
  { id: 'projet', libelle: '🎯 Projet', vue: vueProjet },
  { id: 'course', libelle: '⏱️ Course', vue: vueCourse },
  { id: 'bilan', libelle: '📊 Bilan', vue: vueBilanDF },
];

declarerActions({
  'df-onglet': ({ onglet }) => {
    vue.ongletDF = onglet;
    rafraichir();
  },
});

export const vueDemifond = () => (ONGLETS_DF.find((o) => o.id === vue.ongletDF) || ONGLETS_DF[0]).vue();
