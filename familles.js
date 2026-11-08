/*
 * MENU PRINCIPAL : les activités rangées par famille.
 * Pour une activité du Champ 4, le nom doit être celui de champ4/contenu/apsa.js.
 * « bientot: true » affiche l'activité sans permettre de l'ouvrir.
 */
export const FAMILLES = [
  {
    titre: 'Sports collectifs',
    couleur: 'bleu',
    activites: [
      { nom: 'Handball' },
      { nom: 'Basket-ball' },
      { nom: 'Football' },
      { nom: 'Rugby' },
      { nom: 'Ultimate' },
      { nom: 'Volley-ball' },
    ],
  },
  {
    titre: 'Sports de raquette',
    couleur: 'violet',
    activites: [{ nom: 'Badminton' }, { nom: 'Tennis de table' }],
  },
  {
    titre: "Activités d'expression",
    couleur: 'orange',
    activites: [{ nom: 'Arts du cirque', icone: '🎪', bientot: true }],
  },
];
