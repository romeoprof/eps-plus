/*
 * MENU PRINCIPAL : les activités rangées par famille, dans l'ordre d'affichage.
 * Pour une activité du Champ 4, le nom doit être celui de champ4/contenu/apsa.js.
 * « module » ouvre un module à part, « bientot: true » affiche l'activité sans l'ouvrir,
 * « enseignant: true » la réserve à l'espace enseignant.
 */
export const FAMILLES = [
  {
    titre: 'Activités athlétiques',
    couleur: 'turquoise',
    activites: [
      { nom: 'Demi-fond', icone: '🏃', module: 'demifond' },
      { nom: 'Test VMA', icone: '📈', module: 'testvma' },
      { nom: 'PhotoFinish', icone: '📸', module: 'photofinish', enseignant: true },
    ],
  },
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
    titre: 'Affrontements interindividuels',
    couleur: 'violet',
    activites: [{ nom: 'Badminton' }, { nom: 'Tennis de table' }, { nom: 'Lutte' }],
  },
  {
    titre: "Activités d'expression",
    couleur: 'orange',
    activites: [{ nom: 'Arts du cirque', icone: '🎪', module: 'cirque' }],
  },
  {
    titre: 'Utilitaires',
    couleur: 'ardoise',
    activites: [{ nom: 'Vidéo laps', icone: '🎥', module: 'videolaps' }],
  },
];
