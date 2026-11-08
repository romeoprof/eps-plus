/* Fonctionnement hors connexion : réseau d'abord, copie locale si pas de réseau.
   Ajouter ici tout nouveau fichier de l'application, et changer VERSION. */
const PREFIXE = 'eps-plus-';
const VERSION = `${PREFIXE}4`;
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'styles/app.css',
  'src/main.js',
  'src/contenu/familles.js',
  'src/ecrans/accueil.js',
  'src/noyau/chiffrement.js',
  'src/noyau/etat.js',
  'src/noyau/interface.js',
  'src/noyau/outils.js',
  'src/champ4/reglages.js',
  'src/champ4/contenu/apsa.js',
  'src/champ4/contenu/terrains.js',
  'src/champ4/calculs/classement.js',
  'src/champ4/calculs/match.js',
  'src/champ4/calculs/progression.js',
  'src/champ4/calculs/stats.js',
  'src/champ4/calculs/suivi.js',
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
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie));
        return reponse;
      })
      .catch(() => caches.match(e.request)),
  );
});
