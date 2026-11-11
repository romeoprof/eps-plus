/*
 * PhotoFinish : la caméra filme la ligne d'arrivée de profil.
 * Le chrono part au coup de sifflet, au toucher de l'écran ou après un décompte ;
 * chaque coureur qui franchit la ligne donne un temps et quelques photos prises autour
 * de son passage : à la fin, on choisit l'image exacte et on attribue le temps à un élève.
 */
import { bip, garderEcranAllume, vibrer } from '../noyau/appareil.js';
import { etat, sauver } from '../noyau/etat.js';
import { apresDessin, declarerActions, demander, notifier, rafraichir, vue } from '../noyau/interface.js';
import { esc, telecharger } from '../noyau/outils.js';
import {
  ajouterPassage,
  enregistrerTempsCourse,
  analyserImage,
  analyseSon,
  estSifflet,
  formatTemps,
  lignesCsvCourse,
  luminositesLignes,
  nouveauDetecteur,
  nouvelleCourse,
  partEnMouvement,
  passagesTries,
  REGLAGES_PF,
  seuilMouvement,
  seuilSifflet,
} from './calculs.js';

const PHOTO_L = 480; // largeur des photos d'arrivée (px)
const AVANT = 3; // images gardées avant chaque passage
const APRES = 3; // et après
const BANDE_L = 4;
const BANDE_H = 96;
const METHODES = [
  { id: 'sifflet', libelle: '📣 Coup de sifflet' },
  { id: 'toucher', libelle: '👆 Toucher l’écran' },
  { id: 'decompte', libelle: '🔢 Décompte' },
];

/* Données de la course et réglages : dans la sauvegarde. Le reste ne vit que pendant l'utilisation. */
export function pf() {
  if (!etat.photofinish) etat.photofinish = { reglages: {}, course: null, historique: [] };
  const p = etat.photofinish;
  p.reglages = p.reglages || {};
  Object.keys(REGLAGES_PF).forEach((cle) => {
    if (!(cle in p.reglages)) p.reglages[cle] = REGLAGES_PF[cle];
  });
  p.historique = p.historique || [];
  return p;
}
const reglages = () => pf().reglages;
const laCourse = () => pf().course;

/* Course terminée : les temps attribués aux élèves vont dans leur Progression, puis on enregistre. */
function sauverCourse() {
  if (laCourse()?.fin) enregistrerTempsCourse(etat, laCourse());
  sauver();
}
export const coursePfEnCours = () => !!laCourse() && !laCourse().fin;

const direct = {
  flux: null,
  scene: null,
  video: null,
  petit: null,
  lignesPrec: null,
  part: 0,
  detecteur: nouveauDetecteur(),
  t0: null, // heure du départ sur l'horloge précise de la tablette (performance.now)
  attente: null, // 'sifflet', 'test-sifflet' ou 'decompte'
  etape: '',
  minuteurs: [],
  micro: null,
  recentes: [], // dernières images de la course : { t, toile }
  captures: [], // passages qui attendent encore leurs images « après »
  photos: new Map(), // id du passage → { images: [{ t, src }], k: image choisie }
  imagesParSeconde: 0,
};
/* Photos : seulement en mémoire (trop lourdes pour la sauvegarde). */
function oublierPhotos() {
  direct.recentes = [];
  direct.captures = [];
  direct.photos = new Map();
}
export const photofinishEnAttente = () => !!direct.attente && direct.attente !== 'test-sifflet';

/* Horloge d'un événement (toucher) : la même que performance.now(), sinon l'heure actuelle. */
const heureEvenement = (e) => {
  const maintenant = performance.now();
  return e && Math.abs(e.timeStamp - maintenant) < 1000 ? e.timeStamp : maintenant;
};

/* ---------- Scène : la vidéo avec la ligne d'arrivée ---------- */
function scene() {
  if (direct.scene) return direct.scene;
  const el = document.createElement('div');
  el.className = 'pf-scene';
  el.innerHTML = `<video playsinline muted autoplay></video>
    <div class="pf-zone pf-zone-haut"></div><div class="pf-zone pf-zone-bas"></div><div class="pf-ligne"></div>`;
  direct.scene = el;
  direct.video = el.querySelector('video');
  /* Glisser le doigt sur l'image place la ligne d'arrivée (avant le départ seulement). */
  let glisse = false;
  const placer = (e) => {
    if (!glisse || coursePfEnCours()) return;
    const cadre = direct.video.getBoundingClientRect();
    reglages().ligne = Math.min(0.98, Math.max(0.02, (e.clientX - cadre.left) / cadre.width));
    majScene();
    const curseur = document.querySelector('[data-cle="ligne"]');
    if (curseur) curseur.value = reglages().ligne;
  };
  el.addEventListener('pointerdown', (e) => {
    glisse = true;
    placer(e);
  });
  el.addEventListener('pointermove', placer);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) =>
    el.addEventListener(type, () => {
      if (glisse) sauver();
      glisse = false;
    }),
  );
  majScene();
  return el;
}

function majScene() {
  if (!direct.scene) return;
  const r = reglages();
  direct.scene.querySelector('.pf-ligne').style.left = `${r.ligne * 100}%`;
  direct.scene.querySelector('.pf-zone-haut').style.height = `${r.haut * 100}%`;
  direct.scene.querySelector('.pf-zone-bas').style.height = `${(1 - r.bas) * 100}%`;
  direct.scene.classList.toggle('verrouillee', coursePfEnCours());
}

async function activerCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return notifier('Caméra indisponible : ouvre l’application depuis son adresse en https.');
  }
  arreterCamera();
  try {
    direct.flux = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: reglages().camera },
        frameRate: { ideal: 60 },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch {
    direct.flux = null;
    return notifier('Caméra refusée ou indisponible. Autorise la caméra pour ce site.');
  }
  scene();
  direct.video.srcObject = direct.flux;
  direct.video.play().catch(() => {});
  direct.lignesPrec = null;
  garderEcranAllume();
  lancerBoucleImages();
  rafraichir();
}

function arreterCamera() {
  direct.flux?.getTracks().forEach((piste) => piste.stop());
  direct.flux = null;
  if (direct.video) direct.video.srcObject = null;
}

/* ---------- Analyse de chaque image de la caméra ---------- */
function lancerBoucleImages() {
  const flux = direct.flux;
  const video = direct.video;
  let compte = 0;
  let debutCompte = performance.now();
  const suivante = () => {
    if (direct.flux !== flux) return;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(surImage);
    else requestAnimationFrame((maintenant) => surImage(maintenant, null));
  };
  function surImage(maintenant, infos) {
    if (direct.flux !== flux) return;
    /* L'heure de prise de vue de l'image, quand le navigateur la donne : c'est la plus juste. */
    let temps = infos?.captureTime ?? maintenant;
    if (Math.abs(temps - performance.now()) > 1000) temps = maintenant;
    compte += 1;
    if (temps - debutCompte >= 1000) {
      direct.imagesParSeconde = Math.round((compte * 1000) / (temps - debutCompte));
      compte = 0;
      debutCompte = temps;
      const ips = document.querySelector('#pf-ips');
      if (ips) ips.textContent = `${direct.imagesParSeconde} images/s`;
    }
    try {
      traiterImage(temps);
    } catch {
      /* image pas encore prête */
    }
    suivante();
  }
  suivante();
}

function traiterImage(temps) {
  const video = direct.video;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const r = reglages();
  if (!direct.petit) {
    const toile = document.createElement('canvas');
    toile.width = BANDE_L;
    toile.height = BANDE_H;
    direct.petit = toile.getContext('2d', { willReadFrequently: true });
  }
  const largeur = Math.max(2, Math.round(vw * 0.006));
  const sx = Math.min(vw - largeur, Math.max(0, Math.round(r.ligne * vw - largeur / 2)));
  const sy = Math.round(r.haut * vh);
  const sh = Math.max(8, Math.round((r.bas - r.haut) * vh));
  direct.petit.drawImage(video, sx, sy, largeur, sh, 0, 0, BANDE_L, BANDE_H);
  const lignes = luminositesLignes(direct.petit.getImageData(0, 0, BANDE_L, BANDE_H).data, BANDE_L, BANDE_H);
  const part = partEnMouvement(lignes, direct.lignesPrec);
  direct.lignesPrec = lignes;
  direct.part = part;
  const seuil = seuilMouvement(r.sensibilite);
  direct.scene?.querySelector('.pf-ligne').classList.toggle('mouvement', part >= seuil);
  const jauge = document.querySelector('#pf-jauge-mvt');
  if (jauge) jauge.style.width = `${Math.min(100, (part / 0.6) * 100)}%`;

  if (coursePfEnCours() && direct.t0 != null) {
    garderImage(video, vw, vh, temps - direct.t0);
    if (analyserImage(direct.detecteur, part, temps, seuil)) noterPassage(temps - direct.t0, 'camera');
  }
}

/* ---------- Photos d'arrivée : quelques images avant et après chaque passage ---------- */
const enPhoto = (image) => ({ t: Math.max(0, Math.round(image.t)), src: image.toile.toDataURL('image/jpeg', 0.75) });

function garderImage(video, vw, vh, t) {
  const hauteur = Math.round((PHOTO_L * vh) / vw);
  const toile = direct.recentes.length > AVANT ? direct.recentes.shift().toile : document.createElement('canvas');
  if (toile.width !== PHOTO_L || toile.height !== hauteur) {
    toile.width = PHOTO_L;
    toile.height = hauteur;
  }
  const ctx = toile.getContext('2d');
  ctx.drawImage(video, 0, 0, PHOTO_L, hauteur);
  /* La ligne d'arrivée est tracée sur la photo, pour juger le passage du torse. */
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(Math.round(reglages().ligne * PHOTO_L) - 1, 0, 2, hauteur);
  const image = { t, toile };
  direct.recentes.push(image);
  direct.captures = direct.captures.filter((capture) => {
    capture.images.push(enPhoto(image));
    capture.reste -= 1;
    return capture.reste > 0;
  });
}

function photographierPassage(passage) {
  if (!direct.recentes.length) return;
  const entree = { images: direct.recentes.map(enPhoto), k: direct.recentes.length - 1 };
  direct.photos.set(passage.id, entree);
  direct.captures.push({ images: entree.images, reste: APRES });
}

/* ---------- Départ ---------- */
function demarrer(heure, methode) {
  const r = reglages();
  annulerAttente(false);
  const ecart = performance.now() - heure;
  const course = nouvelleCourse({ methode, libelle: r.libelle, classe: r.classe }, Date.now() - ecart);
  pf().course = course;
  direct.t0 = heure;
  direct.detecteur = nouveauDetecteur();
  oublierPhotos();
  bip(1200, 0.25, 0.3);
  vibrer(80);
  garderEcranAllume();
  sauver();
  rafraichir();
  lancerChrono();
}

function lancerChrono() {
  const tourner = () => {
    if (!coursePfEnCours() || direct.t0 == null) return;
    const chrono = document.querySelector('#pf-chrono');
    if (chrono) chrono.textContent = formatTemps(performance.now() - direct.t0);
    requestAnimationFrame(tourner);
  };
  requestAnimationFrame(tourner);
}

/* Après un rechargement, le chrono repart de l'heure de départ enregistrée. */
function reprendre() {
  const course = laCourse();
  if (!course || course.fin || direct.t0 != null) return;
  direct.t0 = performance.now() - (Date.now() - course.depart);
  direct.detecteur = nouveauDetecteur();
  lancerChrono();
}

function annulerAttente(redessiner = true) {
  direct.minuteurs.forEach(clearTimeout);
  direct.minuteurs = [];
  arreterMicro();
  direct.attente = null;
  direct.etape = '';
  if (redessiner) rafraichir();
}

function changerEtape(texte, frequence) {
  direct.etape = texte;
  const el = document.querySelector('#pf-etape');
  if (el) el.textContent = texte;
  bip(frequence, 0.3, 0.3);
}

function lancerDecompte() {
  direct.attente = 'decompte';
  direct.etape = 'À vos marques…';
  rafraichir();
  bip(660, 0.3, 0.3);
  direct.minuteurs.push(setTimeout(() => changerEtape('Prêts…', 660), 2000));
  /* Le dernier bip arrive après un délai variable, pour éviter les départs anticipés. */
  direct.minuteurs.push(setTimeout(() => demarrer(performance.now(), 'decompte'), 3500 + Math.random() * 1200));
}

/* ---------- Micro : reconnaissance du coup de sifflet ---------- */
async function ecouterSifflet(mode) {
  if (!navigator.mediaDevices?.getUserMedia) return notifier('Micro indisponible sur cet appareil.');
  annulerAttente(false);
  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch {
    return notifier('Micro refusé : autorise le micro ou choisis le départ au toucher.');
  }
  const contexte = new (window.AudioContext || window.webkitAudioContext)();
  contexte.resume?.();
  const analyseur = contexte.createAnalyser();
  analyseur.fftSize = 1024;
  analyseur.smoothingTimeConstant = 0;
  analyseur.minDecibels = -100;
  analyseur.maxDecibels = -20;
  contexte.createMediaStreamSource(flux).connect(analyseur);
  const octets = new Uint8Array(analyseur.frequencyBinCount);
  const hzParCase = contexte.sampleRate / analyseur.fftSize;
  /* Le son analysé couvre une courte fenêtre : on date le sifflet au milieu de celle-ci. */
  const demiFenetre = (analyseur.fftSize / contexte.sampleRate) * 500;
  const micro = { flux, contexte, positifs: 0, premier: null, dernierTest: 0 };
  micro.minuteur = setInterval(() => {
    analyseur.getByteFrequencyData(octets);
    const son = analyseSon(octets, hzParCase);
    const r = reglages();
    const jauge = document.querySelector('#pf-jauge-son');
    if (jauge) jauge.style.width = `${(son.niveau / 255) * 100}%`;
    if (!estSifflet(son, r.sensibiliteSifflet)) {
      micro.positifs = 0;
      return;
    }
    micro.positifs += 1;
    if (micro.positifs === 1) micro.premier = performance.now() - demiFenetre;
    if (micro.positifs < 2) return;
    if (direct.attente === 'sifflet') {
      demarrer(micro.premier, 'sifflet');
    } else if (direct.attente === 'test-sifflet' && performance.now() - micro.dernierTest > 1500) {
      micro.dernierTest = performance.now();
      vibrer(60);
      notifier('✔ Coup de sifflet reconnu');
    }
  }, 8);
  direct.micro = micro;
  direct.attente = mode;
  garderEcranAllume();
  rafraichir();
}

function arreterMicro() {
  if (!direct.micro) return;
  clearInterval(direct.micro.minuteur);
  direct.micro.flux.getTracks().forEach((piste) => piste.stop());
  direct.micro.contexte.close?.();
  direct.micro = null;
}

/* ---------- Passages ---------- */
function noterPassage(t, source) {
  const course = laCourse();
  if (!coursePfEnCours()) return;
  photographierPassage(ajouterPassage(course, t, source));
  vibrer(30);
  bip(1500, 0.06, 0.15);
  sauver();
  majDirect();
}

function majDirect() {
  const course = laCourse();
  const liste = document.querySelector('#pf-liste-direct');
  if (liste) liste.innerHTML = listeDirect(course);
  const compte = document.querySelector('#pf-compte');
  if (compte) compte.textContent = texteCompte(course);
}

const texteCompte = (course) => `${course.passages.length} passage${course.passages.length > 1 ? 's' : ''}`;

/* Toucher : départ et passages comptent dès que le doigt touche l'écran. */
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest?.('[data-pf-depart]')) {
    e.preventDefault();
    if (!coursePfEnCours()) demarrer(heureEvenement(e), direct.attente === 'sifflet' ? 'toucher (sifflet non entendu)' : 'toucher');
  } else if (e.target.closest?.('[data-pf-passage]')) {
    e.preventDefault();
    if (direct.t0 != null) noterPassage(heureEvenement(e) - direct.t0, 'toucher');
  }
});

/* ---------- Quitter l'écran : caméra et micro s'arrêtent ---------- */
apresDessin(() => {
  if (vue.ecran !== 'photofinish') {
    if (direct.flux) arreterCamera();
    if (direct.attente) annulerAttente(false);
    return;
  }
  const placeScene = document.querySelector('[data-place="scene"]');
  if (placeScene && direct.scene) {
    placeScene.appendChild(direct.scene);
    majScene();
    if (direct.flux && direct.video.paused) direct.video.play().catch(() => {});
  }
});

/* ---------- Actions ---------- */
const BORNES = {
  ligne: [0.02, 0.98],
  haut: [0, 0.8],
  bas: [0.2, 1],
  sensibilite: [5, 100],
  sensibiliteSifflet: [0, 100],
};

declarerActions({
  'pf-camera': activerCamera,
  'pf-camera-stop': () => {
    arreterCamera();
    rafraichir();
  },
  'pf-camera-changer': () => {
    reglages().camera = reglages().camera === 'environment' ? 'user' : 'environment';
    sauver();
    activerCamera();
  },
  'pf-reglage': ({ cle }, champ) => {
    const [min, max] = BORNES[cle];
    const r = reglages();
    r[cle] = Math.min(max, Math.max(min, Number(champ.value)));
    if (cle === 'haut' && r.haut > r.bas - 0.15) r.haut = Math.max(0, r.bas - 0.15);
    if (cle === 'bas' && r.bas < r.haut + 0.15) r.bas = Math.min(1, r.haut + 0.15);
    majScene();
    const seuil = document.querySelector(`#pf-seuil-${cle}`);
    if (seuil && cle === 'sensibilite') seuil.style.left = `${(seuilMouvement(r.sensibilite) / 0.6) * 100}%`;
    if (seuil && cle === 'sensibiliteSifflet') seuil.style.left = `${(seuilSifflet(r.sensibiliteSifflet) / 255) * 100}%`;
    sauver();
  },
  'pf-methode': ({ methode }) => {
    if (direct.attente === 'test-sifflet') annulerAttente(false);
    reglages().depart = methode;
    sauver();
    rafraichir();
  },
  'pf-libelle': (_, champ) => {
    reglages().libelle = champ.value.trim();
    sauver();
  },
  'pf-classe': (_, champ) => {
    reglages().classe = champ.value;
    if (laCourse()?.fin) laCourse().classe = champ.value;
    sauver();
    rafraichir();
  },
  'pf-sifflet': () => ecouterSifflet('sifflet'),
  'pf-tester-sifflet': () => (direct.attente === 'test-sifflet' ? annulerAttente() : ecouterSifflet('test-sifflet')),
  'pf-decompte': lancerDecompte,
  'pf-annuler-attente': () => annulerAttente(),
  'pf-terminer': () => {
    const course = laCourse();
    if (!coursePfEnCours()) return;
    course.fin = Date.now();
    bip(880, 0.3, 0.3);
    sauverCourse();
    rafraichir();
  },
  'pf-abandon': async () => {
    const ok = await demander({
      titre: 'Annuler la course ?',
      texte: 'Les temps de cette course seront effacés.',
      confirmer: 'Annuler la course',
      danger: true,
    });
    if (!ok) return;
    pf().course = null;
    direct.t0 = null;
    oublierPhotos();
    sauver();
    rafraichir();
  },
  /* Image avant / après : le temps devient celui de l'image choisie. */
  'pf-image': ({ id, sens }) => {
    const p = laCourse()?.passages.find((q) => q.id === id);
    const entree = direct.photos.get(id);
    if (!p || !entree) return;
    entree.k = Math.min(entree.images.length - 1, Math.max(0, entree.k + Number(sens)));
    p.t = entree.images[entree.k].t;
    sauverCourse();
    rafraichir();
  },
  /* Sans photo (après un rechargement) : correction au centième. */
  'pf-decaler': ({ id, sens }) => {
    const p = laCourse()?.passages.find((q) => q.id === id);
    if (!p) return;
    p.t = Math.max(0, p.t + Number(sens) * 10);
    sauverCourse();
    rafraichir();
  },
  /* Deux coureurs arrivés ensemble : un second temps sur les mêmes images. */
  'pf-dupliquer': ({ id }) => {
    const course = laCourse();
    const p = course?.passages.find((q) => q.id === id);
    if (!p) return;
    const copie = ajouterPassage(course, p.t, p.source);
    const entree = direct.photos.get(id);
    if (entree) direct.photos.set(copie.id, { images: entree.images, k: entree.k });
    sauverCourse();
    rafraichir();
    notifier('Temps ajouté : choisis l’image où passe le second coureur.');
  },
  'pf-supprimer': ({ id }) => {
    const course = laCourse();
    course.passages = course.passages.filter((p) => p.id !== id);
    direct.photos.delete(id);
    sauverCourse();
    rafraichir();
  },
  'pf-eleve': ({ id }, champ) => {
    const p = laCourse().passages.find((q) => q.id === id);
    if (!p) return;
    p.eleveId = champ.value;
    p.nom = '';
    sauverCourse();
    rafraichir();
  },
  'pf-nom': ({ id }, champ) => {
    const p = laCourse().passages.find((q) => q.id === id);
    if (!p) return;
    p.nom = champ.value.trim();
    sauver();
  },
  'pf-csv': ({ id }) => {
    const course = id ? pf().historique.find((c) => c.id === id) : laCourse();
    if (!course) return;
    const cellule = (c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
    const texte = lignesCsvCourse(course, etat.eleves).map((l) => l.map(cellule).join(';')).join('\r\n');
    const date = new Date(course.depart).toISOString().slice(0, 10);
    telecharger(`photofinish-${date}.csv`, `﻿${texte}`, 'text/csv;charset=utf-8');
  },
  'pf-nouvelle': () => {
    const p = pf();
    if (p.course?.passages.length) p.historique.unshift(p.course);
    p.historique = p.historique.slice(0, 50);
    p.course = null;
    direct.t0 = null;
    oublierPhotos();
    sauver();
    rafraichir();
  },
  'pf-historique-suppr': async ({ id }) => {
    const ok = await demander({ titre: 'Effacer cette course ?', texte: 'La course disparaît de cette liste. Les temps attribués aux élèves restent dans leur Progression.', confirmer: 'Effacer', danger: true });
    if (!ok) return;
    pf().historique = pf().historique.filter((c) => c.id !== id);
    sauver();
    rafraichir();
  },
});

/* ---------- Affichage ---------- */
const curseur = (cle, libelle, min, max, pas, desactive = false) => `
  <label>${libelle}<input type="range" min="${min}" max="${max}" step="${pas}" value="${reglages()[cle]}" data-saisie="pf-reglage" data-cle="${cle}" ${desactive ? 'disabled' : ''}></label>`;

function carteCamera(enCourse) {
  const r = reglages();
  if (!direct.flux) {
    return `<div class="carte"><h2 class="carte-titre">📸 Caméra</h2>
      <p>Pose la tablette <b>sur le côté de la piste, dans l'alignement de la ligne d'arrivée</b>, l'écran tourné vers toi : les coureurs passent de gauche à droite (ou l'inverse) devant la caméra.</p>
      <button class="btn bouton-large" data-action="pf-camera">📷 Activer la caméra</button>
      <p class="aide">Sans caméra, tu peux tout de même chronométrer en touchant le bouton « Passage » à chaque arrivée.</p>
    </div>`;
  }
  const seuil = (seuilMouvement(r.sensibilite) / 0.6) * 100;
  return `<div class="carte"><h2 class="carte-titre">📸 Caméra <small id="pf-ips" class="aide">${direct.imagesParSeconde ? `${direct.imagesParSeconde} images/s` : ''}</small></h2>
    <div data-place="scene"></div>
    ${enCourse ? '' : `<p class="aide">Glisse le doigt sur l'image pour placer la <b style="color:#ef4444">ligne rouge</b> exactement sur la ligne d'arrivée. Les zones sombres en haut et en bas ne sont pas surveillées (spectateurs, arrière-plan).</p>`}
    <div class="grille-parametres pf-reglages">
      ${curseur('ligne', 'Ligne d’arrivée', 0.02, 0.98, 0.005, enCourse)}
      ${curseur('haut', 'Haut de la zone', 0, 0.8, 0.01, enCourse)}
      ${curseur('bas', 'Bas de la zone', 0.2, 1, 0.01, enCourse)}
      ${curseur('sensibilite', 'Sensibilité des passages', 5, 100, 1)}
    </div>
    <div class="pf-ligne-jauge"><span>Mouvement sur la ligne</span>
      <div class="pf-jauge"><i id="pf-jauge-mvt"></i><b id="pf-seuil-sensibilite" class="seuil" style="left:${seuil}%"></b></div></div>
    ${enCourse ? '' : `<p class="aide">Fais passer quelqu'un sur la ligne : elle devient verte et la jauge dépasse le trait rouge. Sinon, augmente la sensibilité. Si elle s'allume sans passage, diminue-la.</p>
    <div class="rangee marge-haut">
      <button class="btn secondaire" data-action="pf-camera-changer">🔄 Changer de caméra</button>
      <button class="btn secondaire" data-action="pf-camera-stop">Couper la caméra</button>
    </div>`}
  </div>`;
}

function choixClasse(valeur) {
  const classes = [...new Set(etat.eleves.map((e) => e.classe))].sort();
  if (!classes.length) return '';
  return `<label>Classe (pour nommer les temps)
    <select data-choix="pf-classe">
      <option value="">Noms libres</option>
      ${classes.map((c) => `<option ${c === valeur ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select></label>`;
}

function carteDepart() {
  const r = reglages();
  const choix = METHODES.map(
    (m) => `<button class="choix-sport ${r.depart === m.id ? 'actif' : ''}" aria-pressed="${r.depart === m.id}" data-action="pf-methode" data-methode="${m.id}">${m.libelle}</button>`,
  ).join('');
  const explications = {
    sifflet: `<p>Le chrono part au <b>coup de sifflet</b>, entendu par le micro de la tablette. Garde la tablette à portée de son (moins de 30 m environ).</p>
      <label class="pf-curseur-seul">Sensibilité du micro<input type="range" min="0" max="100" step="1" value="${r.sensibiliteSifflet}" data-saisie="pf-reglage" data-cle="sensibiliteSifflet"></label>
      ${direct.attente === 'test-sifflet' ? jaugeSon() : ''}
      <button class="btn secondaire" data-action="pf-tester-sifflet">${direct.attente === 'test-sifflet' ? '⏹ Arrêter l’essai' : '🎙️ Essayer le micro (sans lancer le chrono)'}</button>`,
    toucher: `<p>Le chrono part dès que tu <b>touches le bouton Départ</b>. Pratique si tu donnes le départ toi-même, tablette en main.</p>`,
    decompte: `<p>La tablette annonce <b>« À vos marques », « Prêts »</b> par deux bips graves, puis donne le départ par un <b>bip aigu</b> après un délai variable. Monte le son de la tablette.</p>`,
  };
  return `<div class="carte"><h2 class="carte-titre">🏁 Départ</h2>
    <div class="choix-sports">${choix}</div>
    ${explications[r.depart]}
    <div class="grille-parametres marge-haut">
      <label>Nom de la course (facultatif)<input value="${esc(r.libelle)}" placeholder="ex. 50 m – série 2" autocomplete="off" data-saisie="pf-libelle"></label>
    </div>
    <p class="aide">Les coureurs se choisissent à la fin de la course, temps par temps, à l'aide des photos d'arrivée.</p>
  </div>`;
}

const jaugeSon = () => `<div class="pf-ligne-jauge"><span>Niveau du sifflet</span>
  <div class="pf-jauge"><i id="pf-jauge-son"></i><b id="pf-seuil-sensibiliteSifflet" class="seuil" style="left:${(seuilSifflet(reglages().sensibiliteSifflet) / 255) * 100}%"></b></div></div>`;

function boutonDepart() {
  const methode = reglages().depart;
  if (methode === 'sifflet') return `<button class="btn bouton-depart bouton-large-depart" data-action="pf-sifflet">📣 Attendre le coup de sifflet</button>`;
  if (methode === 'decompte') return `<button class="btn bouton-depart bouton-large-depart" data-action="pf-decompte">🔢 Lancer le décompte</button>`;
  return `<button class="btn bouton-depart bouton-large-depart" data-pf-depart>▶ DÉPART</button>`;
}

function carteHistorique() {
  const historique = pf().historique;
  if (!historique.length) return '';
  const lignes = historique
    .map((c) => {
      const tries = passagesTries(c);
      const date = new Date(c.depart).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      /* Sans les noms : cet écran est ouvert aux élèves. Les temps nominatifs sont dans la Progression. */
      const premiers = tries
        .slice(0, 3)
        .map((p, i) => `${i + 1}. ${formatTemps(p.t)}`)
        .join(' · ');
      return `<li><div><b>${esc(c.libelle || 'Course')}</b> <small>${date} · ${tries.length} temps</small><br><small>${premiers}</small></div>
        <button class="btn-mini" data-action="pf-historique-suppr" data-id="${esc(c.id)}" aria-label="Effacer">🗑</button></li>`;
    })
    .join('');
  return `<div class="carte"><h2 class="carte-titre">📋 Courses précédentes</h2>
    <p class="aide">Les noms n'apparaissent pas ici. Les temps attribués aux élèves sont dans Espace enseignant → Progression des élèves.</p>
    <ul class="pf-historique">${lignes}</ul></div>`;
}

const listeDirect = (course) =>
  passagesTries(course)
    .map((p, i) => `<li><b>${i + 1}</b><span>${formatTemps(p.t)}</span><small>${p.source === 'camera' ? '📸' : '👆'}</small></li>`)
    .reverse()
    .join('') || '<li class="aide">En attente du premier passage…</li>';

function vueAttente() {
  const sifflet = direct.attente === 'sifflet';
  return `<div class="carte pf-attente-carte">
      <p class="pf-attente" id="pf-etape">${sifflet ? '📣 En attente du coup de sifflet…' : esc(direct.etape)}</p>
      ${sifflet ? jaugeSon() : ''}
      <div class="rangee centre-rangee marge-haut">
        ${sifflet ? '<button class="btn" data-pf-depart>👆 Départ manuel</button>' : ''}
        <button class="btn secondaire" data-action="pf-annuler-attente">Annuler</button>
      </div>
    </div>
    ${direct.flux ? '<div class="carte"><div data-place="scene"></div></div>' : ''}`;
}

function vueCourse(course) {
  return `<div class="cooper-haut pf-haut">
      <div><span>${esc(course.libelle || 'Chrono')}</span><b id="pf-chrono" class="pf-chrono">${formatTemps(performance.now() - direct.t0)}</b></div>
      <div class="pf-compte" id="pf-compte">${texteCompte(course)}</div>
    </div>
    ${direct.flux ? '<div data-place="scene"></div>' :'<p class="aide centre">Caméra coupée : touche « Passage » à chaque arrivée, ou <button class="btn-mini" data-action="pf-camera">réactive la caméra</button>.</p>'}
    <div class="pf-commandes">
      <button class="bouton-repere pf-bouton-passage" data-pf-passage aria-label="Ajouter un passage maintenant">👆 PASSAGE<small>touche à chaque arrivée</small></button>
      <ol class="pf-liste-direct" id="pf-liste-direct">${listeDirect(course)}</ol>
    </div>
    <div class="rangee centre-rangee marge-haut">
      <button class="btn bouton-stop" data-action="pf-terminer">⏹ Terminer la course</button>
      <button class="btn secondaire" data-action="pf-abandon">Annuler la course</button>
    </div>`;
}

function champNom(course, p) {
  const eleves = etat.eleves.filter((e) => e.classe === course.classe).sort((a, b) => a.nom.localeCompare(b.nom));
  if (course.classe && eleves.length) {
    return `<select data-choix="pf-eleve" data-id="${esc(p.id)}" aria-label="Élève">
      <option value="">— Élève —</option>
      ${eleves.map((e) => `<option value="${esc(e.id)}" ${e.id === p.eleveId ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
    </select>`;
  }
  return `<input value="${esc(p.nom)}" placeholder="Nom ou dossard" autocomplete="off" data-saisie="pf-nom" data-id="${esc(p.id)}" aria-label="Nom">`;
}

function photoArrivee(p, rang) {
  const entree = direct.photos.get(p.id);
  const id = esc(p.id);
  if (!entree) {
    return `<div class="rangee centre-rangee pf-sans-photo">
      <button class="btn-mini" data-action="pf-decaler" data-id="${id}" data-sens="-1">− 0,01 s</button>
      <span class="aide">photo non disponible</span>
      <button class="btn-mini" data-action="pf-decaler" data-id="${id}" data-sens="1">+ 0,01 s</button>
    </div>`;
  }
  const n = entree.images.length;
  return `<figure class="pf-photo">
      <img src="${entree.images[entree.k].src}" alt="Arrivée n° ${rang} : image ${entree.k + 1} sur ${n}">
      <figcaption>
        <button class="btn secondaire" data-action="pf-image" data-id="${id}" data-sens="-1" ${entree.k === 0 ? 'disabled' : ''}>◀ Image avant</button>
        <span>${entree.k + 1} / ${n}</span>
        <button class="btn secondaire" data-action="pf-image" data-id="${id}" data-sens="1" ${entree.k === n - 1 ? 'disabled' : ''}>Image après ▶</button>
      </figcaption>
    </figure>`;
}

function vueResultats(course) {
  const tries = passagesTries(course);
  const attribues = (etat.tempsPf || []).filter((r) => r.courseId === course.id).length;
  const avecPhotos = tries.some((p) => direct.photos.has(p.id));
  const arrivees = tries
    .map(
      (p, i) => `<li class="pf-arrivee">
        <div class="pf-arrivee-haut">
          <span class="pf-rang">${i + 1}</span>
          <b class="pf-temps">${formatTemps(p.t)} s</b>
          <button class="btn-mini" data-action="pf-dupliquer" data-id="${esc(p.id)}" title="Deux coureurs arrivés ensemble">👥 + 1 coureur</button>
          <button class="btn-mini" data-action="pf-supprimer" data-id="${esc(p.id)}" aria-label="Supprimer ce temps">✕</button>
        </div>
        ${photoArrivee(p, i + 1)}
        ${champNom(course, p)}
      </li>`,
    )
    .join('');
  return `<div class="carte"><h2 class="carte-titre">🏁 Arrivées${course.libelle ? ` · ${esc(course.libelle)}` : ''}</h2>
      <p class="aide">Départ : ${esc(course.methode)} · ${tries.length} temps, à l'image près (${direct.imagesParSeconde || 30} images par seconde environ).</p>
      ${
        avecPhotos
          ? `<p class="aide">Pour chaque temps, la photo du passage sur la <b style="color:#ef4444">ligne rouge</b>. Si le torse n'est pas encore sur la ligne, passe à l'image suivante : le temps se corrige. Deux coureurs sur la même image : « + 1 coureur ».</p>`
          : `<p class="aide">Les photos ne sont gardées que jusqu'à la course suivante ou au rechargement de l'application.</p>`
      }
      <h4>Attribuer les temps</h4>
      <p class="aide">${
        course.classe
          ? 'Choisis l’élève sous chaque photo : le temps et le rang vont dans son dossier (Espace enseignant → Progression des élèves), visible seulement avec le code enseignant.'
          : 'Choisis la classe pour attribuer chaque temps à un élève de la liste (il ira dans son dossier). Sinon, écris un nom ou un dossard : ce temps n’est pas gardé dans un dossier.'
      }</p>
      <div class="grille-parametres">${choixClasse(course.classe)}</div>
      ${attribues ? `<p class="enregistre">✔ ${attribues} temps enregistré${attribues > 1 ? 's' : ''} dans le dossier des élèves</p>` : ''}
      <ol class="pf-arrivees">${arrivees || '<li class="aide">Aucun passage.</li>'}</ol>
    </div>
    <div class="rangee centre-rangee">
      <button class="btn secondaire" data-action="pf-csv">⬇ Exporter (CSV)</button>
      <button class="btn bouton-large" data-action="pf-nouvelle">↺ Nouvelle course</button>
    </div>`;
}

export function vuePhotofinish() {
  const course = laCourse();
  reprendre();
  if (course && !course.fin) return vueCourse(course);
  if (course) return vueResultats(course);
  if (direct.attente && direct.attente !== 'test-sifflet') return vueAttente();
  return `${carteCamera(false)}${carteDepart()}${boutonDepart()}${carteHistorique()}`;
}
