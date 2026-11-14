/*
 * SERVEUR LOCAL D'EPS + (PC Windows de l'établissement, Node.js 20 ou plus, sans autre installation).
 *
 * - Sert l'application en https (port 8443 ; le port 8080 redirige vers https).
 * - Reçoit les résultats des tablettes et les regroupe avec les mêmes calculs que l'application
 *   (src/champ4/donnees/fusion.js) : rien n'est effacé, pas de doublon.
 * - L'enseignant (son code) récupère tout ; un élève (son code à 4 chiffres) ne reçoit que son dossier.
 * - Les données restent dans serveur/donnees, jamais servies telles quelles, jamais sur internet.
 *
 * Lancement : double-clic sur serveur\demarrer-serveur.cmd (voir serveur\INSTALLATION.md).
 */
import { createServer as creerHttp } from 'node:http';
import { createServer as creerHttps } from 'node:https';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync, createReadStream, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces, hostname } from 'node:os';
import { etatInitial } from '../src/champ4/donnees/modele.js';
import { fusionnerResultats, paquetResultats } from '../src/champ4/donnees/fusion.js';
import { lireSauvegarde } from '../src/champ4/donnees/migration.js';
import { remplacerListe } from '../src/champ4/donnees/doublons.js';
import { dossierEleve } from '../src/champ4/donnees/dossier.js';
import { empreinte } from '../src/noyau/outils.js';
import { cleCode } from '../src/noyau/cle-code.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const APP = resolve(ICI, '..');
const DONNEES = process.env.EPS_DONNEES || join(ICI, 'donnees');
const CERTIFICATS = process.env.EPS_CERTIFICATS || join(ICI, 'certificats');
const PORT_HTTPS = Number(process.env.EPS_PORT_HTTPS || 8443);
const PORT_HTTP = Number(process.env.EPS_PORT_HTTP || 8080);
const EMPREINTE_PAR_DEFAUT = '74id85'; // même code de départ que l'application
const TAILLE_MAX = 8 * 1024 * 1024;

mkdirSync(join(DONNEES, 'sauvegardes'), { recursive: true });

/* ---------- Données du serveur ---------- */
const FICHIER_ETAT = join(DONNEES, 'etat.json');
const FICHIER_CONFIG = join(DONNEES, 'config.json');

function lireJson(fichier, defaut) {
  try {
    return JSON.parse(readFileSync(fichier, 'utf8'));
  } catch {
    return defaut;
  }
}

/* Écriture sûre : fichier temporaire puis remplacement, et une sauvegarde par jour. */
function ecrireJson(fichier, objet) {
  const temporaire = `${fichier}.tmp`;
  writeFileSync(temporaire, JSON.stringify(objet));
  renameSync(temporaire, fichier);
}

let etat = existsSync(FICHIER_ETAT) ? lireSauvegarde(lireJson(FICHIER_ETAT, etatInitial())) : etatInitial();
/* Configuration : celle déposée par l'enseignant, sinon le config.json de l'application. */
let config = lireJson(FICHIER_CONFIG, null) || lireJson(join(APP, 'config.json'), { version: 0, reglages: {} });

function enregistrer() {
  ecrireJson(FICHIER_ETAT, etat);
  const jour = new Date().toISOString().slice(0, 10);
  const copie = join(DONNEES, 'sauvegardes', `etat-${jour}.json`);
  if (!existsSync(copie)) copyFileSync(FICHIER_ETAT, copie);
}

/* ---------- Connexions : jetons en mémoire, essais limités ---------- */
const jetons = new Map(); // jeton → { role, eleveId, expire }
const essais = new Map(); // clé → { nombre, bloqueJusque }
const DUREE = { enseignant: 12 * 3600e3, eleve: 4 * 3600e3 };

function nouveauJeton(role, eleveId = null) {
  const jeton = randomBytes(24).toString('base64url');
  jetons.set(jeton, { role, eleveId, expire: Date.now() + DUREE[role] });
  return jeton;
}

function session(requete) {
  const jeton = (requete.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const s = jetons.get(jeton);
  if (!s) return null;
  if (s.expire < Date.now()) {
    jetons.delete(jeton);
    return null;
  }
  return s;
}

/* 5 erreurs de code → 5 minutes d'attente (un code à 4 chiffres ne doit pas pouvoir être deviné). */
function bloque(cle) {
  const e = essais.get(cle);
  return e && e.bloqueJusque > Date.now();
}
function echec(cle, seuil = 5) {
  const e = essais.get(cle) || { nombre: 0, bloqueJusque: 0 };
  e.nombre += 1;
  if (e.nombre >= seuil) {
    e.nombre = 0;
    e.bloqueJusque = Date.now() + 5 * 60e3;
  }
  essais.set(cle, e);
}

/* ---------- Réponses ---------- */
const ENTETES_SECURITE = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function json(reponse, statut, objet) {
  reponse.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...ENTETES_SECURITE });
  reponse.end(JSON.stringify(objet));
}

function lireCorps(requete) {
  return new Promise((resoudre, rejeter) => {
    let taille = 0;
    const morceaux = [];
    requete.on('data', (m) => {
      taille += m.length;
      if (taille > TAILLE_MAX) {
        rejeter(new Error('trop gros'));
        requete.destroy();
      } else {
        morceaux.push(m);
      }
    });
    requete.on('end', () => {
      try {
        resoudre(morceaux.length ? JSON.parse(Buffer.concat(morceaux).toString('utf8')) : {});
      } catch {
        rejeter(new Error('JSON illisible'));
      }
    });
    requete.on('error', rejeter);
  });
}

/* ---------- API ---------- */
const listePublique = () => etat.eleves.map(({ id, nom, classe }) => ({ id, nom, classe }));

async function api(requete, reponse, chemin) {
  const methode = requete.method;
  const s = session(requete);
  const ip = requete.socket.remoteAddress;

  if (chemin === '/api/etat' && methode === 'GET') {
    return json(reponse, 200, { serveur: 'EPS +', nom: hostname(), eleves: etat.eleves.length, configVersion: config.version || 0 });
  }

  if (chemin === '/api/connexion' && methode === 'POST') {
    const { role, code, eleveId } = await lireCorps(requete);
    const cle = `${role}:${eleveId || '-'}:${ip}`;
    if (bloque(cle) || bloque(`ip:${ip}`)) return json(reponse, 429, { erreur: 'Trop d’essais : réessaie dans 5 minutes.' });
    if (role === 'enseignant') {
      if (empreinte(String(code || '')) !== (config.reglages?.codeEmpreinte || EMPREINTE_PAR_DEFAUT)) {
        echec(cle);
        echec(`ip:${ip}`);
        return json(reponse, 401, { erreur: 'Code incorrect.' });
      }
      return json(reponse, 200, { jeton: nouveauJeton('enseignant'), role });
    }
    if (role === 'eleve') {
      const eleve = etat.eleves.find((e) => e.id === eleveId);
      if (!eleve?.cle) return json(reponse, 404, { erreur: "Pas de code pour cet élève sur le serveur : l'enseignant doit envoyer la liste." });
      if (!/^\d{4}$/.test(String(code)) || cleCode(eleve.id, String(code)) !== eleve.cle) {
        echec(cle);
        echec(`ip:${ip}`, 20); // une même tablette ne peut pas essayer les codes de toute la classe
        return json(reponse, 401, { erreur: 'Code incorrect.' });
      }
      return json(reponse, 200, { jeton: nouveauJeton('eleve', eleve.id), role, eleveId: eleve.id, nom: eleve.nom });
    }
    return json(reponse, 400, { erreur: 'Rôle inconnu.' });
  }

  /* Les tablettes envoient leurs résultats, identifiées ou non : on ne fait qu'ajouter. */
  if (chemin === '/api/resultats' && methode === 'POST') {
    const paquet = await lireCorps(requete);
    if (paquet?.type !== 'eps-resultats') return json(reponse, 400, { erreur: 'Ce ne sont pas des résultats EPS +.' });
    const bilan = fusionnerResultats(etat, paquet);
    enregistrer();
    return json(reponse, 200, bilan);
  }

  if (chemin === '/api/eleves' && methode === 'GET') return json(reponse, 200, { eleves: listePublique() });

  if (chemin === '/api/config' && methode === 'GET') return json(reponse, 200, config);

  if (chemin === '/api/dossier' && methode === 'GET') {
    if (s?.role !== 'eleve') return json(reponse, 401, { erreur: 'Identifie-toi d’abord.' });
    return json(reponse, 200, dossierEleve(etat, s.eleveId));
  }

  /* Réservé à l'enseignant. */
  if (s?.role !== 'enseignant') return json(reponse, 401, { erreur: 'Réservé à l’enseignant.' });

  if (chemin === '/api/tout' && methode === 'GET') {
    return json(reponse, 200, { ...paquetResultats(etat), eleves: listePublique() });
  }
  if (chemin === '/api/eleves' && methode === 'PUT') {
    const { eleves } = await lireCorps(requete);
    if (!Array.isArray(eleves)) return json(reponse, 400, { erreur: 'Liste invalide.' });
    remplacerListe(
      etat,
      eleves.filter((e) => e?.id && e.nom).map(({ id, nom, classe, cle }) => ({ id, nom, classe, cle })),
    );
    enregistrer();
    return json(reponse, 200, { eleves: etat.eleves.length });
  }
  if (chemin === '/api/config' && methode === 'PUT') {
    const recue = await lireCorps(requete);
    if (!recue?.reglages) return json(reponse, 400, { erreur: 'Configuration invalide.' });
    /* Le code enseignant n'est jamais perdu : sans nouveau code, l'ancien est gardé. */
    const codeEmpreinte = recue.reglages.codeEmpreinte || config.reglages?.codeEmpreinte;
    config = { version: Date.now(), reglages: { ...recue.reglages, ...(codeEmpreinte ? { codeEmpreinte } : {}) } };
    ecrireJson(FICHIER_CONFIG, config);
    return json(reponse, 200, { version: config.version });
  }
  if (chemin === '/api/sauvegarde' && methode === 'GET') {
    reponse.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="sauvegarde-serveur-eps-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    });
    return reponse.end(JSON.stringify(etat));
  }
  return json(reponse, 404, { erreur: 'Inconnu.' });
}

/* ---------- Fichiers de l'application ---------- */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};
/* Jamais servis : le serveur lui-même (données, certificats) et les fichiers de travail. */
const INTERDITS = [`${sep}serveur${sep}`, `${sep}outils${sep}`, `${sep}.`, `${sep}package.json`];

function fichier(requete, reponse, chemin) {
  let relatif = decodeURIComponent(chemin.split('?')[0]);
  if (relatif.endsWith('/')) relatif += 'index.html';
  const complet = normalize(join(APP, relatif));
  if (!complet.startsWith(APP + sep) || INTERDITS.some((x) => complet.slice(APP.length).toLowerCase().includes(x)) || complet.endsWith(`${sep}config.json`)) {
    reponse.writeHead(404, ENTETES_SECURITE);
    return reponse.end('Introuvable');
  }
  if (!existsSync(complet) || !statSync(complet).isFile()) {
    reponse.writeHead(404, ENTETES_SECURITE);
    return reponse.end('Introuvable');
  }
  reponse.writeHead(200, { 'Content-Type': TYPES[extname(complet).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...ENTETES_SECURITE });
  createReadStream(complet).pipe(reponse);
}

/* Le config.json demandé par l'ancienne version de l'application vient du serveur. */
async function traiter(requete, reponse) {
  const chemin = new URL(requete.url, 'https://local').pathname;
  try {
    if (chemin.startsWith('/api/')) return await api(requete, reponse, chemin);
    if (chemin === '/config.json') return json(reponse, 200, config);
    return fichier(requete, reponse, chemin);
  } catch (erreur) {
    return json(reponse, 400, { erreur: erreur.message });
  }
}

/* ---------- Démarrage ---------- */
const adresses = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

const pfx = join(CERTIFICATS, 'serveur.pfx');
if (existsSync(pfx)) {
  const motDePasse = readFileSync(join(CERTIFICATS, 'mot-de-passe.txt'), 'utf8').trim();
  creerHttps({ pfx: readFileSync(pfx), passphrase: motDePasse }, traiter).listen(PORT_HTTPS, () => {
    console.log(`EPS + : serveur prêt (https).`);
    [hostname(), ...adresses].forEach((a) => console.log(`  → https://${a}:${PORT_HTTPS}/`));
  });
  /* En http, on renvoie vers https (la caméra n'est autorisée qu'en https). */
  creerHttp((requete, reponse) => {
    const hote = (requete.headers.host || hostname()).replace(/:\d+$/, '');
    reponse.writeHead(301, { Location: `https://${hote}:${PORT_HTTPS}${requete.url}` });
    reponse.end();
  }).listen(PORT_HTTP);
} else {
  creerHttp(traiter).listen(PORT_HTTP, () => {
    console.log('EPS + : pas de certificat (serveur\\certificats) : serveur en http seulement.');
    console.log('  La caméra (PhotoFinish, QR codes) ne marchera pas. Lance serveur\\creer-certificat.cmd.');
    [hostname(), ...adresses].forEach((a) => console.log(`  → http://${a}:${PORT_HTTP}/`));
  });
}
console.log(`Données : ${DONNEES}`);
console.log('Laisser cette fenêtre ouverte pendant les cours. Ctrl+C pour arrêter.');
