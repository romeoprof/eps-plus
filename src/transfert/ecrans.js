/*
 * Envoyer (espace élève) et recevoir (espace enseignant) les résultats par QR codes.
 * Les résultats restent toujours aussi sur la tablette qui les a enregistrés.
 */
import { bip, garderEcranAllume, vibrer } from '../noyau/appareil.js';
import { etat, sauver } from '../noyau/etat.js';
import { eleveConnecte } from '../noyau/espace.js';
import { apresDessin, declarerActions, notifier, rafraichir } from '../noyau/interface.js';
import { esc } from '../noyau/outils.js';
import { aDesResultats, fusionnerResultats, paquetResultats } from '../champ4/donnees/fusion.js';
import { carteEnvoiFichier, carteReceptionFichier, resumeResultats } from '../champ4/ecrans/recolte.js';
import {
  assembler,
  chargerScript,
  decoderPaquet,
  decouper,
  encoderPaquet,
  envoiComplet,
  lireMorceau,
  nouvelleReception,
  recevoirMorceau,
} from './qr.js';

/* ---------- Envoi : les QR codes défilent à l'écran ---------- */
const diffusion = { images: [], rang: 0, minuteur: null };

function arreterDiffusion() {
  clearInterval(diffusion.minuteur);
  diffusion.minuteur = null;
  diffusion.images = [];
}

function afficherQr() {
  const zone = document.querySelector('#qr-zone');
  if (!zone || !diffusion.images.length) return arreterDiffusion();
  zone.innerHTML = diffusion.images[diffusion.rang];
  const legende = document.querySelector('#qr-legende');
  if (legende) legende.textContent = `QR code ${diffusion.rang + 1} sur ${diffusion.images.length}`;
  diffusion.rang = (diffusion.rang + 1) % diffusion.images.length;
}

async function lancerDiffusion() {
  if (!aDesResultats(etat)) return notifier('Aucun résultat sur cette tablette.');
  try {
    await chargerScript('src/vendor/qrcode.js');
  } catch {
    return notifier('QR codes indisponibles : utilise le fichier chiffré.');
  }
  const paquet = { ...paquetResultats(etat), envoyePar: eleveConnecte()?.nom || '' };
  const id = Math.random().toString(36).slice(2, 8);
  const morceaux = decouper(await encoderPaquet(paquet), id);
  diffusion.images = morceaux.map((texte) => {
    const qr = window.qrcode(0, 'L');
    qr.addData(texte);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  });
  diffusion.rang = 0;
  garderEcranAllume();
  rafraichir();
  afficherQr();
  clearInterval(diffusion.minuteur);
  if (diffusion.images.length > 1) diffusion.minuteur = setInterval(afficherQr, 700);
}

export function vueEnvoyer() {
  const enCours = diffusion.images.length > 0;
  return `<div class="carte"><h2 class="carte-titre">📤 Envoyer les données de cette tablette</h2>
      <p><b>${resumeResultats()}</b> sur cette tablette.</p>
      <p class="aide">Les données restent aussi sur cette tablette. Montre l'écran à la caméra de la tablette de ton enseignant (Espace enseignant → Recevoir les données) : ${enCours && diffusion.images.length > 1 ? 'les QR codes défilent seuls, garde l’écran face à la caméra jusqu’au message « Reçu ».' : 'elle lit le QR code.'}</p>
      ${
        enCours
          ? `<div class="qr-cadre"><div id="qr-zone" class="qr-zone" role="img" aria-label="QR code des résultats"></div><p id="qr-legende" class="qr-legende"></p></div>
             <button class="btn secondaire" data-action="qr-arreter">⏹ Arrêter</button>`
          : `<button class="btn bouton-large" data-action="qr-envoyer">📲 Afficher les QR codes</button>`
      }
    </div>
    ${carteEnvoiFichier()}`;
}

/* ---------- Réception : la caméra lit les QR codes ---------- */
const lecteur = { flux: null, video: null, toile: null, detecteur: null, minuteur: null, occupe: false, reception: nouvelleReception(), finis: new Set() };
let compteRendu = [];
let etatLecture = '';

function arreterLecture() {
  clearInterval(lecteur.minuteur);
  lecteur.minuteur = null;
  lecteur.flux?.getTracks().forEach((piste) => piste.stop());
  lecteur.flux = null;
  if (lecteur.video) lecteur.video.srcObject = null;
}

const majTexte = (selecteur, html) => {
  const el = document.querySelector(selecteur);
  if (el) el.innerHTML = html;
};
const listeCompteRendu = () => compteRendu.map((l) => `<li>${esc(l)}</li>`).join('');

async function traiterValeur(valeur) {
  const morceau = lireMorceau(valeur);
  if (!morceau || lecteur.finis.has(morceau.id)) return;
  const envoi = recevoirMorceau(lecteur.reception, valeur);
  etatLecture = `Lecture en cours : ${envoi.parts.size} / ${envoi.total} QR codes`;
  majTexte('#qr-etat', esc(etatLecture));
  if (!envoiComplet(envoi)) return;
  lecteur.finis.add(envoi.id);
  lecteur.reception.envois.delete(envoi.id);
  try {
    const paquet = await decoderPaquet(assembler(envoi));
    if (paquet.type !== 'eps-resultats') throw new Error('type');
    const { ajoutes, misAJour, dejaPresents } = fusionnerResultats(etat, paquet);
    sauver();
    bip(1320, 0.2, 0.3);
    vibrer(80);
    compteRendu.unshift(`${paquet.envoyePar || 'Tablette'} : ${ajoutes} ajouté(s), ${misAJour} mis à jour, ${dejaPresents} déjà présent(s)`);
    etatLecture = '✔ Reçu. Tu peux lire la tablette suivante.';
  } catch {
    compteRendu.unshift('Envoi illisible : recommence depuis la tablette élève.');
    etatLecture = 'Envoi illisible.';
  }
  majTexte('#qr-etat', esc(etatLecture));
  majTexte('#qr-liste', listeCompteRendu());
}

async function scanner() {
  const video = lecteur.video;
  if (lecteur.occupe || !video?.videoWidth) return;
  lecteur.occupe = true;
  try {
    let valeurs = [];
    if (lecteur.detecteur) {
      valeurs = (await lecteur.detecteur.detect(video)).map((code) => code.rawValue);
    } else {
      const echelle = Math.min(1, 800 / video.videoWidth);
      const l = Math.round(video.videoWidth * echelle);
      const h = Math.round(video.videoHeight * echelle);
      if (!lecteur.toile) lecteur.toile = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      lecteur.toile.canvas.width = l;
      lecteur.toile.canvas.height = h;
      lecteur.toile.drawImage(video, 0, 0, l, h);
      const code = window.jsQR(lecteur.toile.getImageData(0, 0, l, h).data, l, h, { inversionAttempts: 'dontInvert' });
      if (code) valeurs = [code.data];
    }
    for (const valeur of valeurs) await traiterValeur(valeur);
  } catch {
    /* image illisible : on réessaie à l'image suivante */
  } finally {
    lecteur.occupe = false;
  }
}

async function demarrerLecture() {
  if (!navigator.mediaDevices?.getUserMedia) return notifier('Caméra indisponible sur cet appareil.');
  try {
    lecteur.flux = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } });
  } catch {
    return notifier('Caméra refusée : autorise la caméra pour ce site.');
  }
  lecteur.detecteur = null;
  try {
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      lecteur.detecteur = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch {
    lecteur.detecteur = null;
  }
  if (!lecteur.detecteur) {
    try {
      await chargerScript('src/vendor/jsQR.js');
    } catch {
      arreterLecture();
      return notifier('Lecteur de QR codes indisponible : utilise les fichiers chiffrés.');
    }
  }
  if (!lecteur.video) {
    lecteur.video = document.createElement('video');
    lecteur.video.className = 'qr-video';
    lecteur.video.setAttribute('playsinline', '');
    lecteur.video.muted = true;
  }
  lecteur.video.srcObject = lecteur.flux;
  lecteur.video.play().catch(() => {});
  etatLecture = 'Vise le QR code affiché sur la tablette élève.';
  garderEcranAllume();
  lecteur.minuteur = setInterval(scanner, 120);
  rafraichir();
}

export function vueRecevoir() {
  const actif = !!lecteur.flux;
  return `<div class="carte"><h2 class="carte-titre">📷 Lire les QR codes des tablettes</h2>
      <p class="aide">Sur la tablette élève : « Envoyer les données », puis « Afficher les QR codes ». Ici, vise l'écran avec la caméra : quand tous les QR codes sont lus, les résultats sont ajoutés sans rien effacer, et sans doublon.</p>
      ${actif ? '<div data-place="lecteur-qr" class="qr-lecteur"></div>' : ''}
      <p id="qr-etat" class="qr-etat" aria-live="polite">${esc(actif ? etatLecture : '')}</p>
      <button class="btn ${actif ? 'secondaire' : 'bouton-large'}" data-action="${actif ? 'qr-lecture-stop' : 'qr-lecture'}">${actif ? '⏹ Arrêter la caméra' : '📷 Lire les QR codes'}</button>
      <ul id="qr-liste" class="compte-rendu">${listeCompteRendu()}</ul>
    </div>
    ${carteReceptionFichier()}`;
}

apresDessin(() => {
  const place = document.querySelector('[data-place="lecteur-qr"]');
  if (place && lecteur.video && lecteur.flux) {
    place.appendChild(lecteur.video);
    if (lecteur.video.paused) lecteur.video.play().catch(() => {});
  } else if (lecteur.flux) {
    arreterLecture();
  }
  if (!document.querySelector('#qr-zone')) arreterDiffusion();
  else afficherQr();
});

declarerActions({
  'qr-envoyer': lancerDiffusion,
  'qr-arreter': () => {
    arreterDiffusion();
    rafraichir();
  },
  'qr-lecture': demarrerLecture,
  'qr-lecture-stop': () => {
    arreterLecture();
    rafraichir();
  },
});
