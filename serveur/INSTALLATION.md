# EPS + : installer le serveur de l'établissement

Le serveur est un PC Windows de l'établissement, allumé pendant les cours. Il donne l'application aux tablettes et garde toutes les données. Rien ne part sur internet.

## Ce que fait le serveur

- Les tablettes **envoient seules** leurs résultats dès qu'elles ont le Wi-Fi de l'établissement (toutes les 20 secondes). Sans Wi-Fi, elles gardent tout et envoient plus tard.
- L'enseignant, avec son code, **récupère tout** (Espace enseignant → Serveur et échanges → Synchroniser ; c'est aussi fait à chaque entrée dans l'espace enseignant).
- Un élève qui s'identifie (prénom + code à 4 chiffres) **reçoit son dossier** : tout ce qui le concerne, venant de toutes les tablettes. Jamais celui des autres.
- La liste d'élèves et la configuration se chargent sur les tablettes **sans mot de passe à saisir**.

## Installation (une seule fois)

1. **Copier le dossier de l'application** sur le PC serveur, par exemple dans `C:\EPS-plus` (tout le dossier `app`, avec le sous-dossier `serveur`).
2. **Installer Node.js** (gratuit) : https://nodejs.org → version « LTS » → installer avec les choix proposés.
3. **Demander une adresse IP fixe** pour ce PC au service informatique (sinon le certificat est à refaire quand l'adresse change).
4. **Créer le certificat https** : double-clic sur `serveur\creer-certificat.cmd`. Il fabrique :
   - `serveur\certificats\eps-plus-autorite.cer` : à installer sur chaque tablette (étape 6) ;
   - `serveur\certificats\serveur.pfx` et `mot-de-passe.txt` : restent sur le PC, ne jamais les copier ailleurs.
5. **Démarrer le serveur** : double-clic sur `serveur\demarrer-serveur.cmd`. La fenêtre affiche les adresses, par exemple `https://192.168.1.20:8443/`. Si Windows demande l'accès au réseau, autoriser les **réseaux privés**. Laisser la fenêtre ouverte.
6. **Sur chaque tablette** (une seule fois) : copier `eps-plus-autorite.cer` (clé USB, Drive, e-mail) puis :
   - Android : Paramètres → Sécurité → Chiffrement et identifiants → Installer un certificat → **Certificat CA** → choisir le fichier.
   - iPad : ouvrir le fichier → Réglages → Profil téléchargé → Installer ; puis Réglages → Général → Informations → Réglages des certificats → activer « EPS+ Autorite locale ».
7. **Ouvrir l'application** dans Chrome (Android) ou Safari (iPad) à l'adresse affichée par le serveur, puis menu → « Ajouter à l'écran d'accueil ».

## Première mise en route

1. Espace enseignant → **Gestion des élèves** : importer le CSV (les codes à 4 chiffres sont créés, à imprimer).
2. Espace enseignant → **Serveur et échanges** : « Envoyer la liste d'élèves », puis « Publier la configuration ».
3. Les tablettes chargent la liste seules ; les élèves peuvent s'identifier.

**Données déjà notées sur la version internet** (romeoprof.github.io) : elles restent sur cette version, car une tablette garde ses données séparément pour chaque adresse. Pour les apporter au serveur : dans la version internet, Échanger les données → QR codes ou fichier, et les lire depuis l'espace enseignant de la version serveur ; ou Bilan → Sauvegarder, puis Bilan → Restaurer sur la tablette enseignant de la version serveur.

## Au quotidien

- Allumer le PC, double-clic sur `demarrer-serveur.cmd`.
- Pour qu'il démarre seul : Planificateur de tâches Windows → Créer une tâche de base → « À l'ouverture de session » → Démarrer un programme → `C:\EPS-plus\serveur\demarrer-serveur.cmd`.

## Sauvegardes et sécurité

- Toutes les données sont dans `serveur\donnees` (`etat.json`, `config.json`). Une copie par jour est gardée dans `serveur\donnees\sauvegardes`. Copier régulièrement ce dossier sur une clé ou un disque.
- L'enseignant peut aussi télécharger une sauvegarde : Serveur et échanges → « Sauvegarde du serveur ».
- Le serveur ne sert jamais les dossiers `serveur` et `outils` : les données et le certificat ne sont pas accessibles depuis les tablettes.
- Un code élève faux 5 fois de suite bloque les essais 5 minutes (20 erreurs depuis une même tablette aussi) : un code à 4 chiffres ne peut pas être deviné en essayant tout.
- Le code enseignant est le même que dans l'application ; le changer dans Code d'accès puis « Publier la configuration ».
- La liste des élèves (prénom, initiale, classe) est visible des tablettes du réseau de l'établissement ; les codes ne le sont jamais (seulement leur empreinte, sur le serveur).

## Ports

https : 8443 (http : 8080, qui renvoie vers https). Pour les changer : variables d'environnement `EPS_PORT_HTTPS` et `EPS_PORT_HTTP`.
