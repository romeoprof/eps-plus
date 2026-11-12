/*
 * ARTS DU CIRQUE : contenus par défaut, repris de l'application cirque-eps d'un collègue.
 * L'enseignant peut modifier les listes dans Espace enseignant → Observables par APSA → Arts du cirque.
 */

export const MAX_ARTISTES = 10;
export const MAX_TABLEAUX = 5;

/* Couleur de chaque artiste sur la piste (dans l'ordre de la troupe). */
export const COULEURS_ARTISTES = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6'];

/* Les 5 étapes du récit du spectacle. */
export const ETAPES = [
  { titre: '1. Situation initiale', aide: 'Présentation des artistes et du monde du spectacle' },
  { titre: '2. Élément perturbateur', aide: 'Un événement imprévu vient bousculer la piste' },
  { titre: '3. Péripétie', aide: "L'épreuve majeure, la tension monte" },
  { titre: '4. Résolution', aide: "La réponse trouvée pour rétablir l'harmonie" },
  { titre: '5. Situation finale', aide: "Le tableau d'apothéose et le salut au public" },
];

/* Familles de l'artiste : manipulation et équilibre par cumul de difficultés, acrobatie par niveau. */
export const FAMILLES_CIRQUE = [
  { id: 'manipulation', icone: '🤹', nom: 'Manipulation', exemples: 'balles, foulards, massues, diabolos, assiettes…', objet: 'Balles' },
  { id: 'equilibre', icone: '🪜', nom: 'Équilibre', exemples: 'fil, rolla-bolla, pédalgo, poutre, boule…', objet: 'Rolla-bolla' },
  { id: 'acrobatie', icone: '🤸', nom: 'Acrobatie', exemples: 'roulades, roues, sauts, pyramides…', objet: 'Figure au sol' },
];

export const REGLAGES_CIRQUE = {
  manipulation: ['+ 1 objet', '+ 1 autre objet', 'Se déplacer', 'Sous la jambe', 'Sauter', 'Lancer haut', 'Demi-tour sur soi', 'Lancer dans le dos', 'Échange à deux', 'Assis / En tailleur'],
  equilibre: ['Avancer', 'Reculer', 'Faire un demi-tour', "S'accroupir", 'Lâcher les mains', 'Tenir plus de 5 s', 'Jongler / manipuler dessus', 'Sur 1 pied', 'Passer un obstacle', 'Autonome (sans parade)'],
  emotions: ['Joie', 'Peur', 'Tristesse', 'Colère'],
  espace: ['Petit', 'Grand', 'Se rapprocher', "S'éloigner", 'Isolé', 'Ensemble'],
  temps: ['Vite', 'Lent', 'Arrêt', 'Long', 'Court'],
};

/* Listes réglables, dans l'ordre d'affichage chez l'enseignant. */
export const LISTES_CIRQUE = [
  { id: 'manipulation', titre: '🤹 Difficultés de manipulation' },
  { id: 'equilibre', titre: '🪜 Difficultés d’équilibre' },
  { id: 'emotions', titre: '🎭 Émotions' },
  { id: 'espace', titre: "📐 Utilisation de l'espace" },
  { id: 'temps', titre: '⏱️ Utilisation du temps' },
];

/* Évaluation par l'enseignant (artiste et chorégraphe). */
export const EVALUATIONS = { 1: '🔴 Insuffisant', 2: '🟠 Fragile', 3: '🟢 Satisfaisant', 4: '⭐ Très bien' };
