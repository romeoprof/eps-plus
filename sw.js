/* Fonctionnement hors connexion : réseau d'abord, copie locale si pas de réseau.
   Ajouter ici tout nouveau fichier de l'application, et changer VERSION. */
const PREFIXE = 'eps-plus-';
const VERSION = `${PREFIXE}27`;
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'styles/app.css',
  'src/main.js',
  'src/contenu/familles.js',
  'src/contenu/logo.js',
  'src/ecrans/accueil.js',
  'src/ecrans/choix-espace.js',
  'src/ecrans/eleve.js',
  'src/noyau/espace.js',
  'src/transfert/qr.js',
  'src/transfert/ecrans.js',
  'src/vendor/qrcode.js',
  'src/vendor/jsQR.js',
  'src/noyau/chiffrement.js',
  'src/noyau/etat.js',
  'src/noyau/interface.js',
  'src/noyau/outils.js',
  'src/noyau/appareil.js',
  'src/testvma/calculs.js',
  'src/testvma/cooper.js',
  'src/testvma/ecran.js',
  'src/testvma/ecran-cooper.js',
  'src/photofinish/calculs.js',
  'src/photofinish/ecran.js',
  'src/demifond/calculs.js',
  'src/demifond/contenu.js',
  'src/demifond/etat.js',
  'src/demifond/ecrans/bilan.js',
  'src/demifond/ecrans/coureurs.js',
  'src/demifond/ecrans/course.js',
  'src/demifond/ecrans/module.js',
  'src/demifond/ecrans/projet.js',
  'src/demifond/ecrans/reglages.js',
  'src/champ4/reglages.js',
  'src/champ4/contenu/apsa.js',
  'src/champ4/contenu/terrains.js',
  'src/champ4/calculs/classement.js',
  'src/champ4/calculs/match.js',
  'src/champ4/calculs/progression.js',
  'src/champ4/calculs/stats.js',
  'src/champ4/calculs/suivi.js',
  'src/champ4/donnees/doublons.js',
  'src/champ4/donnees/export.js',
  'src/champ4/donnees/fusion.js',
  'src/champ4/donnees/migration.js',
  'src/champ4/donnees/modele.js',
  'src/champ4/donnees/operations.js',
  'src/champ4/ecrans/bilan.js',
  'src/champ4/ecrans/courbe.js',
  'src/champ4/ecrans/enseignant.js',
  'src/champ4/ecrans/equipes.js',
  'src/champ4/ecrans/fiche.js',
  'src/champ4/ecrans/import-eleves.js',
  'src/champ4/ecrans/match.js',
  'src/champ4/ecrans/poules.js',
  'src/champ4/ecrans/progression.js',
  'src/champ4/ecrans/recolte.js',
  'src/champ4/ecrans/terrain.js',
];

self.addEventListener('install', (e) => {
  /* « reload » : la copie hors connexion est prise sur le site, jamais dans le cache du navigateur. */
  const requetes = FICHIERS.map((f) => new Request(f, { cache: 'reload' }));
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(requetes)).then(() => self.skipWaiting()));
});

/* Le site partage son adresse avec les autres apps EPS (eps-cirque, etc.) :
   on n'efface que les anciennes copies d'EPS +, jamais celles des autres apps. */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(cles.filter((c) => c.startsWith(PREFIXE) && c !== VERSION).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  /* « no-cache » : chaque fichier est revérifié sur le site. Sans cela, le navigateur garde
     jusqu'à 10 minutes d'anciens fichiers, qui peuvent bloquer une nouvelle version. */
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((reponse) => {
        if (reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(e.request)),
  );
});
