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

## Serveur de l'établissement

Le dossier `serveur/` contient un petit serveur (Node.js, aucune autre installation) pour un PC Windows de l'établissement : voir `serveur/INSTALLATION.md`. Avec lui, les tablettes envoient seules leurs résultats, l'enseignant récupère tout, et chaque élève identifié reçoit son dossier (tout ce qui le concerne, toutes tablettes confondues, rien sur les autres). Le serveur réutilise les calculs de l'application (`src/champ4/donnees/fusion.js`, `dossier.js`). Côté application : `src/reseau/serveur.js` (envoi automatique, connexions) et `src/reseau/ecran.js` (carte « Serveur de l'établissement »). La version sur GitHub fonctionne toujours sans serveur (QR codes et fichiers).

## Espaces enseignant et élève

À l'ouverture : logo, puis **Espace élève** (sans code) ou **Espace enseignant** (code enseignant). « ⇄ Changer d'espace » ramène à ce choix. Une tablette laissée dans l'espace élève y revient seule ; l'espace enseignant redemande toujours le code.

- **Espace enseignant** : un menu de boutons. Activités (toutes, PhotoFinish compris), Gestion des élèves, Observables par APSA (avec les options des matchs : fiche d'observation des observateurs en fin de match, projet de jeu et conseil, bonus de contrat), Progression des élèves, Recevoir les données, Code d'accès ; la synchronisation des réglages (config.json) est en bas du menu (`src/champ4/ecrans/enseignant.js`).
- **Espace élève** : Sports, Demi-fond, Test VMA ; équipes, poules, VMA modifiables ; Liste des élèves et Mise à jour. L'élève peut s'identifier (classe, prénom, code à 4 chiffres) : il voit alors **sa** progression, et ses observations portent « observé par » son nom. Identifié ou non, il peut observer n'importe quel camarade : la performance va à l'élève observé (`src/ecrans/eleve.js`, `src/noyau/espace.js`).

**Codes des élèves** : créés par l'application à l'import de la liste. Espace enseignant → Gestion des élèves → « Codes des élèves » : liste par classe, impression, nouveau code. Les codes lisibles ne sont que sur la tablette enseignant ; la liste protégée n'en contient qu'une empreinte. Après un import ou un nouveau code : recréer la liste protégée et la déposer sur le site. Un code à 4 chiffres évite les confusions, ce n'est pas une vraie sécurité.

**Échanger les données** (dans les deux espaces) : la tablette élève affiche des QR codes qui défilent ; l'enseignant les lit avec la caméra. Dans l'autre sens, l'enseignant envoie les résultats de toute la classe aux tablettes élèves : chaque élève identifié y voit alors toutes ses performances, toutes tablettes confondues (seulement les siennes).

**Élèves en double** : un même élève (même prénom + initiale, même classe) peut avoir deux identifiants si les tablettes n'ont pas la même liste. L'application le reconnaît à son nom et sa classe : à la réception de résultats, à l'import d'une liste et à l'ouverture, toutes ses données sont regroupées sur un seul élève (celui qui a un code), sans rien perdre (`src/champ4/donnees/doublons.js`).

Envoi des données par QR code : la tablette affiche des QR codes qui défilent ; l'autre tablette les lit avec sa caméra. Les données restent aussi sur la tablette élève. Secours : fichier chiffré. Les QR codes ne sont pas chiffrés (prénoms, initiales, résultats), ils ne passent que d'un écran à une caméra proche. Bibliothèques : `src/vendor/qrcode.js` (qrcode-generator, MIT) et `src/vendor/jsQR.js` (jsQR, Apache 2.0) ; le lecteur utilise d'abord celui intégré à Chrome quand il existe.

## Mettre à jour la liste d'élèves sur les tablettes

1. Espace enseignant : importer le CSV (colonnes Nom ; Prénom ; Classe). Seuls le prénom et l'initiale du nom sont conservés.
2. Saisir un mot de passe de 10 caractères ou plus, puis « Créer le fichier protégé ».
3. Déposer `eleves-proteges.json` sur le site, à côté de `index.html`, en remplaçant l'ancien.
4. Sur chaque tablette : espace élève → « Liste des élèves » (ou onglet Équipes), saisir le mot de passe, puis « Importer les élèves ».

Le fichier en ligne est chiffré et le mot de passe n'est enregistré nulle part. Un mot de passe long est indispensable, car le fichier reste téléchargeable par tous. Le code de l'espace enseignant est distinct : il évite seulement les modifications par erreur.

## Progression des élèves et contrats

Espace enseignant → « Progression des élèves ». Seuls les élèves de la liste choisis dans une équipe ou comme joueur seul sont suivis. En sport collectif, ils reçoivent les statistiques de leur équipe.

En badminton et en tennis de table, l'enseignant crée les contrats dans Espace enseignant → Réglages, en choisissant le sport. L'élève en choisit un sur l'écran du match (bouton ⭐ Contrat) : un contrat créé ajoute un bouton de son côté et ses points comptent au score ; ils sont aussi mis en avant dans la progression.

Sur ces deux sports, un coup qui marque ne peut être noté que sur une zone du camp adverse, et une faute ne se note pas sur une zone. Le bonus chiffré s'active et se règle dans Espace enseignant → Réglages.

## Demi-fond

Menu principal → Activités athlétiques → Demi-fond. Quatre onglets : Coureurs (VMA, 8 coureurs maximum), Projet (course, % de VMA), Course (un appui à chaque plot), Bilan. La liste d'élèves et les VMA s'importent uniquement dans Espace enseignant → Réglages → Demi-fond. Les seuils, les consignes, la tolérance (0,5 km/h par défaut), les valeurs par défaut des courses et la limite de double appui se règlent au même endroit, ou dans `src/demifond/contenu.js`.

La consigne (SUPER, ACCÉLÈRE, RALENTIS) et l'écart affiché sur la carte comparent la vitesse du dernier segment au projet, au dixième près. L'objectif du bilan compare la vitesse moyenne au projet. Un passage impliquant plus de 30 km/h (réglable), ou moins d'une seconde après le précédent, est ignoré comme double appui. Les courses alimentent la Progression des élèves et le regroupement des tablettes. La courbe d'évolution de la vitesse de chaque course se retrouve dans la Progression (enseignant, ou élève identifié pour la sienne). Dans Progression des élèves, l'enseignant choisit la classe, l'élève puis l'APSA.

La barre de chaque coureur montre son avancée idéale entre deux plots : elle repart de zéro à chaque appui, passe le petit trait à mi-chemin et atteint le grand trait à l'heure prévue au plot, selon son % de VMA. Elle passe en jaune en cas de retard.

Une course sur distance se termine avec le bouton « Terminer ». Une course sur temps s'arrête seule : une fenêtre demande la distance de chaque coureur depuis son dernier plot, puis l'allure de ce dernier morceau et la distance totale sont calculées.

## Test VMA

Menu principal → Activités athlétiques → Test VMA, puis « Paliers » ou « Demi-Cooper ».

Demi-Cooper (`src/testvma/cooper.js`) : 6 minutes, le plus loin possible. Un élève touche le gros bouton à chaque repère : distance, vitesse du dernier repère et VMA estimée s'affichent en direct. Bips à mi-parcours et à la dernière minute ; arrêt automatique à 6 minutes, puis saisie des mètres faits après le dernier repère. VMA (km/h) = distance (m) ÷ 100. Le coureur se choisit dans la liste d'élèves (classe puis élève) ou se saisit par un nom libre. Pour un élève de la liste, le résultat s'enregistre dans sa Progression, devient sa VMA en Demi-fond et part avec le fichier « Récupérer les données ».

Paliers : se règlent vitesse initiale, incrémentation, durée d'un palier et distance entre repères (`src/testvma/calculs.js` pour les valeurs d'origine). Le test ne change qu'après « Valider ces valeurs ». Un bip retentit à chaque repère, plus aigu et plus long au premier repère de chaque palier. À l'arrêt : VMA = vitesse du palier + incrément × part du palier réalisée ; VO₂max estimée = VMA × 3,5. Les résultats ne sont pas rattachés à un élève et ne partent pas dans le regroupement des tablettes.

## Bilan des sports et export Excel

Onglet Bilan d'un sport : « 📊 Par rencontre » (comme avant) ou « 🧮 Cumul d'une équipe / d'un joueur » : toutes ses rencontres réunies (totaux, pourcentages recalculés sur l'ensemble, moyenne par rencontre, V/N/D), avec la liste des rencontres et « Voir le détail » pour chacune.

« 📗 Exporter les stats (Excel) » crée un vrai fichier .xlsx (`src/noyau/classeur.js`, sans bibliothèque) avec trois feuilles : Rencontres (date, score, durée, observateur), Détail des rencontres, Cumul par équipe.

## Arts du cirque

Menu principal → Activités d'expression → Arts du cirque (`src/cirque/`). Repris de l'application cirque-eps d'un collègue, avec les élèves et la Progression d'EPS +. Quatre onglets :

- **Troupe** : jusqu'à 10 artistes, choisis dans la liste d'élèves (classe puis prénoms) ou par un nom libre ; nom de la troupe et titre du spectacle.
- **Chorégraphe** : les 5 étapes du récit (situation initiale → situation finale). Pour chacune : chorégraphe(s), émotion, espace, temps ; jusqu'à 5 tableaux où l'on place les artistes au doigt sur la piste (pointillés depuis le tableau précédent), coulisses, et « ▶ Animer » pour voir les déplacements s'enchaîner.
- **Artiste** : le carnet de chaque artiste. Manipulation et équilibre : niveau par cumul de difficultés (1, 2, 3 ou plus) ; acrobatie : niveau 1, 2 ou 3 de la fiche. Un élève identifié ouvre son carnet, mais peut remplir celui d'un camarade (ça va dans le carnet du camarade).
- **Bilan** : profils des artistes et fiche des 5 étapes avec la piste, à imprimer.

Le projet est enregistré sur la tablette à chaque geste ; le bandeau de la troupe affiche l'heure du dernier enregistrement et le bouton « 💾 Sauvegarder le projet ». À la séance suivante, le groupe choisit sa troupe dans l'onglet Troupe et reprend là où il en était.

L'évaluation (Insuffisant → Très bien) et les conseils, de l'artiste comme du chorégraphe, ne se donnent que dans l'espace enseignant ; les élèves les voient. Le carnet d'un élève de la liste et les étapes qu'il a chorégraphiées apparaissent dans sa Progression et partent avec « Échanger les données » (la version la plus récente l'emporte). Les listes de difficultés, d'émotions, d'espace et de temps se règlent dans Espace enseignant → Observables par APSA → Arts du cirque.

## PhotoFinish

Menu principal → Activités athlétiques → PhotoFinish (`src/photofinish/`). La tablette est posée sur le côté de la piste, dans l'alignement de la ligne d'arrivée. On place la ligne rouge sur l'image en glissant le doigt, on règle la zone surveillée et la sensibilité (la ligne devient verte quand quelqu'un passe).

Départ au choix : coup de sifflet (micro, avec un essai sans lancer le chrono), toucher du bouton Départ, ou décompte sonore (« À vos marques », « Prêts », bip aigu après un délai variable). Chaque coureur qui franchit la ligne donne un temps ; le bouton « Passage » ajoute un temps à la main. Plusieurs coureurs, plusieurs temps dans la même course.

Les coureurs ne se choisissent pas avant le départ. Après « Terminer », chaque temps a sa photo d'arrivée (ligne rouge tracée dessus) et les 3 images avant et après : « Image avant / après » corrige le temps à l'image près ; « + 1 coureur » ajoute un second temps pour deux coureurs arrivés ensemble. Les photos restent en mémoire jusqu'à la course suivante ou au rechargement (elles ne sont pas enregistrées). Chaque temps s'attribue à un élève (classe puis élève) ou à un nom libre, et s'exporte en CSV. Un temps attribué à un élève va dans son dossier : Espace enseignant → Progression des élèves (date, temps, rang, meilleur temps par épreuve), protégé par le code enseignant. Ces temps partent avec « Récupérer les données ». La liste « Courses précédentes », visible des élèves, ne montre pas les noms. Précision : une image, soit 1/30 s environ ; le sifflet ajoute quelques centièmes de retard.
## Regrouper les résultats sur la tablette enseignant

Espace enseignant → « Récupérer les données ». Sur chaque tablette : saisir un mot de passe, créer et envoyer le fichier chiffré. Sur la tablette enseignant : saisir le même mot de passe et choisir les fichiers reçus.

La fusion n'efface rien, évite les doublons et ne change pas les réglages. Il n'y a pas de synchronisation automatique, car l'application n'a pas de serveur. Ne jamais déposer ces fichiers sur GitHub.

## Reprendre les données de la V3

Dans la V3 : Bilan → Sauvegarder. Dans EPS + : Bilan → Restaurer, puis choisir le fichier `sauvegarde_eps.json`.
