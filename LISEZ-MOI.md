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

En badminton et en tennis de table, le contrat se choisit sur l'écran du match. Ses points sont mis en avant dans la progression, sans changer le score. Le bonus chiffré s'active et se règle dans Espace enseignant → Réglages.

## Demi-fond

Menu principal → Activités athlétiques → Demi-fond. Quatre onglets : Coureurs (VMA, 8 coureurs maximum), Projet (course, % de VMA), Course (un appui à chaque plot), Bilan. La liste d'élèves et les VMA s'importent uniquement dans Espace enseignant → Demi-fond. Les seuils, les consignes, la tolérance (0,5 km/h par défaut), les valeurs par défaut des courses et la limite de double appui se règlent dans Espace enseignant → Demi-fond, ou dans `src/demifond/contenu.js`.

La consigne (SUPER, ACCÉLÈRE, RALENTIS) et l'écart affiché sur la carte comparent la vitesse du dernier segment au projet, au dixième près. L'objectif du bilan compare la vitesse moyenne au projet. Un passage impliquant plus de 30 km/h (réglable), ou moins d'une seconde après le précédent, est ignoré comme double appui. Les courses alimentent la Progression des élèves et le regroupement des tablettes.

La barre de chaque coureur montre son avancée idéale entre deux plots : elle repart de zéro à chaque appui, passe le petit trait à mi-chemin et atteint le grand trait à l'heure prévue au plot, selon son % de VMA. Elle passe en jaune en cas de retard.

Une course sur distance se termine avec le bouton « Terminer ». Une course sur temps s'arrête seule : une fenêtre demande la distance de chaque coureur depuis son dernier plot, puis l'allure de ce dernier morceau et la distance totale sont calculées.

## Regrouper les résultats sur la tablette enseignant

Espace enseignant → « Récupérer les données ». Sur chaque tablette : saisir un mot de passe, créer et envoyer le fichier chiffré. Sur la tablette enseignant : saisir le même mot de passe et choisir les fichiers reçus.

La fusion n'efface rien, évite les doublons et ne change pas les réglages. Il n'y a pas de synchronisation automatique, car l'application n'a pas de serveur. Ne jamais déposer ces fichiers sur GitHub.

## Reprendre les données de la V3

Dans la V3 : Bilan → Sauvegarder. Dans EPS + : Bilan → Restaurer, puis choisir le fichier `sauvegarde_eps.json`.
