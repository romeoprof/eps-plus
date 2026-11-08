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

## Reprendre les données de la V3

Dans la V3 : Bilan → Sauvegarder. Dans EPS + : Bilan → Restaurer, puis choisir le fichier `sauvegarde_eps.json`.
