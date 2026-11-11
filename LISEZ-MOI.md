# EPS +

Application d'observation EPS pour tablettes. Elle reprend les fonctions de la V3 de « pwa-observateur ».

## Essayer sur le PC

Depuis Claude, demander de lancer l'application. Sinon, faire un clic droit sur `outils/serveur.ps1`, choisir « Exécuter avec PowerShell », puis ouvrir http://localhost:8765 dans un navigateur.

Ouvrir directement `index.html` ne fonctionne pas : il faut passer par ce petit serveur ou par le site en ligne.

## Où modifier quoi

| Pour changer… | Fichier |
|---|---|
| Familles et activités du menu principal | `src/contenu/familles.js` |
| APSA, critères, points, projets de jeu, repères | `src/champ4/contenu/apsa.js` |
| Dessins des terrains | `src/champ4/contenu/terrains.js` |
| Couleurs et apparence | `styles/app.css` |
| Écrans du Champ 4 | `src/champ4/ecrans/` |
| Calculs (scores, statistiques, classements) | `src/champ4/calculs/` |
| Sauvegarde, import et export | `src/champ4/donnees/` |

## Vérifier après une modification

Ouvrir http://localhost:8765/tests/ : tous les tests doivent être verts.

Si un fichier est ajouté, l'inscrire dans la liste de `sw.js`. Après toute modification, changer `VERSION` dans ce même fichier.

## Mettre à jour la liste d'élèves sur les tablettes

1. Espace enseignant : importer le CSV (colonnes Nom ; Prénom ; Classe). Seuls le prénom et l'initiale du nom sont conservés.
2. Saisir un mot de passe de 10 caractères ou plus, puis « Créer le fichier protégé ».
3. Déposer `eleves-proteges.json` sur le site, à côté de `index.html`, en remplaçant l'ancien.
4. Sur chaque tablette : onglet Équipes, saisir le mot de passe, puis « Importer les élèves ».

Le fichier en ligne est chiffré et le mot de passe n'est enregistré nulle part. Un mot de passe long est indispensable, car le fichier reste téléchargeable par tous. Le code de l'espace enseignant est distinct : il évite seulement les modifications par erreur.

## Progression des élèves et contrats

Espace enseignant → « Progression des élèves ». Seuls les élèves de la liste choisis dans une équipe ou comme joueur seul sont suivis. En sport collectif, ils reçoivent les statistiques de leur équipe.

En badminton et en tennis de table, l'enseignant crée les contrats dans Espace enseignant → Réglages, en choisissant le sport. L'élève en choisit un sur l'écran du match (bouton ⭐ Contrat) : un contrat créé ajoute un bouton de son côté et ses points comptent au score ; ils sont aussi mis en avant dans la progression.

Sur ces deux sports, un coup qui marque ne peut être noté que sur une zone du camp adverse, et une faute ne se note pas sur une zone. Le bonus chiffré s'active et se règle dans Espace enseignant → Réglages.

## Demi-fond

Menu principal → Activités athlétiques → Demi-fond. Quatre onglets : Coureurs (VMA, 8 coureurs maximum), Projet (course, % de VMA), Course (un appui à chaque plot), Bilan. La liste d'élèves et les VMA s'importent uniquement dans Espace enseignant → Réglages → Demi-fond. Les seuils, les consignes, la tolérance (0,5 km/h par défaut), les valeurs par défaut des courses et la limite de double appui se règlent au même endroit, ou dans `src/demifond/contenu.js`.

La consigne (SUPER, ACCÉLÈRE, RALENTIS) et l'écart affiché sur la carte comparent la vitesse du dernier segment au projet, au dixième près. L'objectif du bilan compare la vitesse moyenne au projet. Un passage impliquant plus de 30 km/h (réglable), ou moins d'une seconde après le précédent, est ignoré comme double appui. Les courses alimentent la Progression des élèves et le regroupement des tablettes.

La barre de chaque coureur montre son avancée idéale entre deux plots : elle repart de zéro à chaque appui, passe le petit trait à mi-chemin et atteint le grand trait à l'heure prévue au plot, selon son % de VMA. Elle passe en jaune en cas de retard.

Une course sur distance se termine avec le bouton « Terminer ». Une course sur temps s'arrête seule : une fenêtre demande la distance de chaque coureur depuis son dernier plot, puis l'allure de ce dernier morceau et la distance totale sont calculées.

## Test VMA

Menu principal → Activités athlétiques → Test VMA, puis « Paliers » ou « Demi-Cooper ».

Demi-Cooper (`src/testvma/cooper.js`) : 6 minutes, le plus loin possible. Un élève touche le gros bouton à chaque repère : distance, vitesse du dernier repère et VMA estimée s'affichent en direct. Bips à mi-parcours et à la dernière minute ; arrêt automatique à 6 minutes, puis saisie des mètres faits après le dernier repère. VMA (km/h) = distance (m) ÷ 100. Le coureur se choisit dans la liste d'élèves (classe puis élève) ou se saisit par un nom libre. Pour un élève de la liste, le résultat s'enregistre dans sa Progression, devient sa VMA en Demi-fond et part avec le fichier « Récupérer les données ».

Paliers : se règlent vitesse initiale, incrémentation, durée d'un palier et distance entre repères (`src/testvma/calculs.js` pour les valeurs d'origine). Le test ne change qu'après « Valider ces valeurs ». Un bip retentit à chaque repère, plus aigu et plus long au premier repère de chaque palier. À l'arrêt : VMA = vitesse du palier + incrément × part du palier réalisée ; VO₂max estimée = VMA × 3,5. Les résultats ne sont pas rattachés à un élève et ne partent pas dans le regroupement des tablettes.

## PhotoFinish

Menu principal → Activités athlétiques → PhotoFinish (`src/photofinish/`). La tablette est posée sur le côté de la piste, dans l'alignement de la ligne d'arrivée. On place la ligne rouge sur l'image en glissant le doigt, on règle la zone surveillée et la sensibilité (la ligne devient verte quand quelqu'un passe).

Départ au choix : coup de sifflet (micro, avec un essai sans lancer le chrono), toucher du bouton Départ, ou décompte sonore (« À vos marques », « Prêts », bip aigu après un délai variable). Chaque coureur qui franchit la ligne donne un temps ; le bouton « Passage » ajoute un temps à la main. Plusieurs coureurs, plusieurs temps dans la même course.

Les coureurs ne se choisissent pas avant le départ. Après « Terminer », chaque temps a sa photo d'arrivée (ligne rouge tracée dessus) et les 3 images avant et après : « Image avant / après » corrige le temps à l'image près ; « + 1 coureur » ajoute un second temps pour deux coureurs arrivés ensemble. Les photos restent en mémoire jusqu'à la course suivante ou au rechargement (elles ne sont pas enregistrées). Chaque temps s'attribue à un élève (classe puis élève) ou à un nom libre, et s'exporte en CSV. Un temps attribué à un élève va dans son dossier : Espace enseignant → Progression des élèves (date, temps, rang, meilleur temps par épreuve), protégé par le code enseignant. Ces temps partent avec « Récupérer les données ». La liste « Courses précédentes », visible des élèves, ne montre pas les noms. Précision : une image, soit 1/30 s environ ; le sifflet ajoute quelques centièmes de retard.
## Regrouper les résultats sur la tablette enseignant

Espace enseignant → « Récupérer les données ». Sur chaque tablette : saisir un mot de passe, créer et envoyer le fichier chiffré. Sur la tablette enseignant : saisir le même mot de passe et choisir les fichiers reçus.

La fusion n'efface rien, évite les doublons et ne change pas les réglages. Il n'y a pas de synchronisation automatique, car l'application n'a pas de serveur. Ne jamais déposer ces fichiers sur GitHub.

## Reprendre les données de la V3

Dans la V3 : Bilan → Sauvegarder. Dans EPS + : Bilan → Restaurer, puis choisir le fichier `sauvegarde_eps.json`.
