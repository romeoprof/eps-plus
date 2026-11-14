/*
 * VIDÉO LAPS (Utilitaires) : la caméra filme en continu et l'écran montre l'image
 * avec un retard réglable (0 à 30 s). L'élève fait son geste, puis vient se voir.
 * Pause pour figer l'image, image par image pour revoir le geste, et dessin par-dessus
 * (crayon, trait, flèche, cercle) pour montrer une correction.
 * Les images ne sont gardées qu'en mémoire, le temps du différé : rien n'est enregistré.
 */
import { garderEcranAllume } from '../noyau/appareil.js';
import { etat, sauver } from '../noyau/etat.js';
import { apresDessin, declarerActions, notifier, rafraichir, vue } from '../noyau/interface.js';
import { telecharger } from '../noyau/outils.js';
import { aRetirer, bornerEcart, ECART_DEFAUT, ECART_MAX, formatEcart, IMAGES_PAR_SECONDE, rangAAfficher, remplissage } from './differe.js';

const LARGEUR = 960; // largeur des images gardées (px)
const MARGE = 3; // secondes gardées en plus de l'écart, pour revoir image par image
const COULEURS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ffffff'];
const OUTILS = [
  { id: 'crayon', libelle: '✏️ Crayon' },
  { id: 'trait', libelle: '📏 Trait' },
  { id: 'fleche', libelle: '➡️ Flèche' },
  { id: 'cercle', libelle: '⭕ Cercle' },
];

/* Réglages gardés d'une séance à l'autre. */
function reglages() {
  if (!etat.videolaps) etat.videolaps = { ecart: ECART_DEFAUT, camera: 'environment' };
  return etat.videolaps;
}

const vl = {
  flux: null,
  video: null,
  scene: null,
  ecran: null,
  dessin: null,
  petit: null,
  images: [], // { t, blob }
  encodages: 0,
  derniereCapture: 0,
  affiche: -1,
  decodage: false,
  pause: false,
  rangPause: -1,
  outil: 'crayon',
  couleur: COULEURS[0],
  traits: [],
  trait: null,
};

/* ---------- Scène : écran différé + calque de dessin ---------- */
function scene() {
  if (vl.scene) return vl.scene;
  const el = document.createElement('div');
  el.className = 'vl-scene';
  el.innerHTML = `<canvas class="vl-ecran"></canvas><canvas class="vl-dessin" aria-label="Zone de dessin"></canvas>
    <div class="vl-badge" aria-live="polite"></div><video playsinline muted autoplay hidden></video>`;
  vl.scene = el;
  [vl.ecran, vl.dessin] = el.querySelectorAll('canvas');
  vl.video = el.querySelector('video');
  brancherDessin();
  return el;
}

function tailleImages() {
  const vw = vl.video.videoWidth || 1280;
  const vh = vl.video.videoHeight || 720;
  return [LARGEUR, Math.round((LARGEUR * vh) / vw)];
}

function ajusterToiles() {
  const [l, h] = tailleImages();
  [vl.ecran, vl.dessin].forEach((toile) => {
    if (toile.width !== l || toile.height !== h) {
      toile.width = l;
      toile.height = h;
    }
  });
  if (!vl.petit) vl.petit = document.createElement('canvas');
  vl.petit.width = l;
  vl.petit.height = h;
  redessiner();
}

/* La caméra de face est montrée comme dans un miroir, plus naturel pour l'élève. */
function peindreVideo(ctx, l, h) {
  ctx.save();
  if (reglages().camera === 'user') ctx.setTransform(-1, 0, 0, 1, l, 0);
  ctx.drawImage(vl.video, 0, 0, l, h);
  ctx.restore();
}

function badge(texte) {
  const el = vl.scene?.querySelector('.vl-badge');
  if (el && el.textContent !== texte) el.textContent = texte;
}

/* ---------- Boucle : filmer, garder, afficher en différé ---------- */
function boucle() {
  if (!vl.flux) return;
  const maintenant = performance.now();
  const ecart = reglages().ecart;
  const [l, h] = [vl.ecran.width, vl.ecran.height];
  if (vl.video.videoWidth && l) {
    if (!vl.pause) {
      /* Filmer : une image toutes les 40 ms environ, compressée en JPEG pour tenir en mémoire. */
      if (ecart > 0 && maintenant - vl.derniereCapture >= 1000 / IMAGES_PAR_SECONDE && vl.encodages < 3) {
        vl.derniereCapture = maintenant;
        const ctx = vl.petit.getContext('2d');
        peindreVideo(ctx, l, h);
        vl.encodages += 1;
        const t = maintenant;
        vl.petit.toBlob(
          (blob) => {
            vl.encodages -= 1;
            if (!blob || vl.pause || !vl.flux) return;
            vl.images.push({ t, blob });
            if (vl.images.length > 1 && vl.images[vl.images.length - 2].t > t) vl.images.sort((a, b) => a.t - b.t);
            const n = aRetirer(vl.images, performance.now(), reglages().ecart, MARGE);
            if (n) {
              vl.images.splice(0, n);
              vl.affiche -= n;
            }
          },
          'image/jpeg',
          0.75,
        );
      }
      /* Afficher : l'image prise « écart » secondes plus tôt. */
      if (ecart === 0) {
        peindreVideo(vl.ecran.getContext('2d'), l, h);
        badge('● En direct');
      } else {
        const part = remplissage(vl.images, maintenant, ecart);
        const rang = rangAAfficher(vl.images, maintenant, ecart);
        if (part < 1 || rang < 0) {
          badge(`⏳ Différé en préparation : ${Math.floor(part * ecart)} / ${formatEcart(ecart)}`);
        } else {
          badge(`⏱ ${formatEcart(ecart)} de différé`);
          if (rang !== vl.affiche) montrer(rang);
        }
      }
    }
  }
  requestAnimationFrame(boucle);
}

function montrer(rang) {
  const image = vl.images[rang];
  if (!image || vl.decodage) return;
  vl.decodage = true;
  vl.affiche = rang;
  createImageBitmap(image.blob)
    .then((bmp) => {
      vl.ecran.getContext('2d').drawImage(bmp, 0, 0, vl.ecran.width, vl.ecran.height);
      bmp.close?.();
    })
    .catch(() => {})
    .finally(() => {
      vl.decodage = false;
    });
}

async function activerCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return notifier('Caméra indisponible : ouvre l’application en https.');
  arreterCamera();
  try {
    vl.flux = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: reglages().camera }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
  } catch {
    vl.flux = null;
    return notifier('Caméra refusée ou indisponible. Autorise la caméra pour ce site.');
  }
  scene();
  vl.video.srcObject = vl.flux;
  await vl.video.play().catch(() => {});
  await new Promise((r) => (vl.video.videoWidth ? r() : vl.video.addEventListener('loadedmetadata', r, { once: true })));
  ajusterToiles();
  viderMemoire();
  garderEcranAllume();
  requestAnimationFrame(boucle);
  rafraichir();
}

function viderMemoire() {
  vl.images = [];
  vl.affiche = -1;
  vl.pause = false;
  vl.rangPause = -1;
}

function arreterCamera() {
  vl.flux?.getTracks().forEach((p) => p.stop());
  vl.flux = null;
  if (vl.video) vl.video.srcObject = null;
  viderMemoire();
}

/* ---------- Pause et image par image ---------- */
function mettreEnPause() {
  if (!vl.flux) return;
  if (reglages().ecart === 0) {
    /* En direct, la pause fige l'image actuelle. */
    vl.images = [];
    vl.rangPause = -1;
  } else {
    vl.rangPause = vl.affiche >= 0 ? vl.affiche : vl.images.length - 1;
  }
  vl.pause = true;
  badge('⏸ Pause');
  rafraichir();
}

function reprendre() {
  viderMemoire();
  rafraichir();
}

function allerA(rang) {
  if (!vl.images.length) return;
  vl.rangPause = Math.max(0, Math.min(vl.images.length - 1, rang));
  vl.affiche = -1;
  vl.decodage = false;
  montrer(vl.rangPause);
  const curseur = document.querySelector('#vl-curseur');
  if (curseur) curseur.value = vl.rangPause;
  const repere = document.querySelector('#vl-repere');
  if (repere) repere.textContent = texteRepere();
}

const texteRepere = () => {
  if (!vl.images.length || vl.rangPause < 0) return '';
  const derniere = vl.images[vl.images.length - 1].t;
  return `image ${vl.rangPause + 1} / ${vl.images.length} · ${((vl.images[vl.rangPause].t - derniere) / 1000).toFixed(1).replace('.', ',')} s`;
};

/* ---------- Dessin ---------- */
function point(e) {
  const cadre = vl.dessin.getBoundingClientRect();
  return { x: ((e.clientX - cadre.left) / cadre.width) * vl.dessin.width, y: ((e.clientY - cadre.top) / cadre.height) * vl.dessin.height };
}

function tracer(ctx, trait) {
  const [a] = trait.points;
  const b = trait.points[trait.points.length - 1];
  ctx.strokeStyle = trait.couleur;
  ctx.fillStyle = trait.couleur;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (trait.outil === 'crayon') {
    ctx.moveTo(a.x, a.y);
    trait.points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  } else if (trait.outil === 'cercle') {
    ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (trait.outil === 'fleche' && Math.hypot(b.x - a.x, b.y - a.y) > 8) {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - 26 * Math.cos(angle - 0.45), b.y - 26 * Math.sin(angle - 0.45));
      ctx.lineTo(b.x - 26 * Math.cos(angle + 0.45), b.y - 26 * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  }
}

function redessiner() {
  if (!vl.dessin) return;
  const ctx = vl.dessin.getContext('2d');
  ctx.clearRect(0, 0, vl.dessin.width, vl.dessin.height);
  [...vl.traits, ...(vl.trait ? [vl.trait] : [])].forEach((t) => tracer(ctx, t));
}

function brancherDessin() {
  vl.dessin.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    vl.dessin.setPointerCapture?.(e.pointerId);
    vl.trait = { outil: vl.outil, couleur: vl.couleur, points: [point(e)] };
  });
  vl.dessin.addEventListener('pointermove', (e) => {
    if (!vl.trait) return;
    const p = point(e);
    if (vl.trait.outil === 'crayon') vl.trait.points.push(p);
    else vl.trait.points = [vl.trait.points[0], p];
    redessiner();
  });
  const finir = () => {
    if (!vl.trait) return;
    if (vl.trait.points.length > 1) vl.traits.push(vl.trait);
    vl.trait = null;
    redessiner();
    majBoutonsDessin();
  };
  vl.dessin.addEventListener('pointerup', finir);
  vl.dessin.addEventListener('pointercancel', finir);
}

function majBoutonsDessin() {
  document.querySelectorAll('[data-action="vl-annuler"], [data-action="vl-effacer"]').forEach((b) => {
    b.disabled = !vl.traits.length;
  });
}

/* Image + dessin, enregistrés en PNG (par exemple pour la montrer en fin de séance). */
function enregistrerImage() {
  const toile = document.createElement('canvas');
  toile.width = vl.ecran.width;
  toile.height = vl.ecran.height;
  const ctx = toile.getContext('2d');
  ctx.drawImage(vl.ecran, 0, 0);
  ctx.drawImage(vl.dessin, 0, 0);
  toile.toBlob((blob) => {
    const d = new Date();
    const nom = `video-laps-${d.toISOString().slice(0, 10)}-${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}.png`;
    telecharger(nom, blob, 'image/png');
  }, 'image/png');
}

/* ---------- Plein écran ---------- */
async function basculerPleinEcran() {
  if (document.fullscreenElement) {
    await document.exitFullscreen?.().catch(() => {});
  } else {
    await document.documentElement.requestFullscreen?.().catch(() => notifier('Plein écran indisponible sur cet appareil.'));
  }
}
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('vl-plein', !!document.fullscreenElement && vue.ecran === 'videolaps');
});

/* ---------- Quitter l'outil : la caméra s'arrête et la mémoire se vide ---------- */
apresDessin(() => {
  if (vue.ecran !== 'videolaps') {
    if (vl.flux) arreterCamera();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    return;
  }
  const place = document.querySelector('[data-place="vl-scene"]');
  if (place && vl.scene) {
    place.appendChild(vl.scene);
    if (vl.flux && vl.video.paused) vl.video.play().catch(() => {});
  }
  majBoutonsDessin();
});

/* ---------- Actions ---------- */
function changerEcart(valeur) {
  const r = reglages();
  r.ecart = bornerEcart(valeur);
  sauver();
  if (vl.pause) reprendre();
  else rafraichir();
}

declarerActions({
  'vl-camera': activerCamera,
  'vl-couper': () => {
    arreterCamera();
    rafraichir();
  },
  'vl-changer-camera': () => {
    reglages().camera = reglages().camera === 'environment' ? 'user' : 'environment';
    sauver();
    activerCamera();
  },
  'vl-ecart': ({ pas }) => changerEcart(reglages().ecart + Number(pas)),
  'vl-ecart-curseur': (_, champ) => changerEcart(champ.value),
  'vl-pause': () => (vl.pause ? reprendre() : mettreEnPause()),
  'vl-image': ({ pas }) => allerA(vl.rangPause + Number(pas)),
  'vl-curseur': (_, champ) => allerA(Number(champ.value)),
  'vl-outil': ({ outil }) => {
    vl.outil = outil;
    rafraichir();
  },
  'vl-couleur': ({ couleur }) => {
    vl.couleur = couleur;
    rafraichir();
  },
  'vl-annuler': () => {
    vl.traits.pop();
    redessiner();
    majBoutonsDessin();
  },
  'vl-effacer': () => {
    vl.traits = [];
    redessiner();
    majBoutonsDessin();
  },
  'vl-photo': enregistrerImage,
  'vl-plein-ecran': basculerPleinEcran,
});

/* ---------- Affichage ---------- */
export function vueVideolaps() {
  const r = reglages();
  if (!vl.flux) {
    return `<div class="carte"><h2 class="carte-titre">🎥 Vidéo laps</h2>
      <p>La tablette filme et <b>montre l'image avec quelques secondes de retard</b> : l'élève fait son geste, puis vient se voir sur l'écran sans toucher à rien.</p>
      <p class="aide">Pose la tablette face à la zone de travail (trépied, banc, mur). Les images ne sont gardées que le temps du différé, en mémoire : rien n'est enregistré ni envoyé.</p>
      <button class="btn bouton-large" data-action="vl-camera">📷 Activer la caméra</button>
    </div>`;
  }
  const pause = vl.pause;
  const ecartReglage = `<div class="vl-ecart">
      <span class="etiquette">Retard de l'écran</span>
      <button class="btn-rond" aria-label="Moins de retard" data-action="vl-ecart" data-pas="-1" ${r.ecart <= 0 ? 'disabled' : ''}>−</button>
      <b>${r.ecart ? formatEcart(r.ecart) : 'direct'}</b>
      <button class="btn-rond" aria-label="Plus de retard" data-action="vl-ecart" data-pas="1" ${r.ecart >= ECART_MAX ? 'disabled' : ''}>+</button>
      <input type="range" min="0" max="${ECART_MAX}" step="1" value="${r.ecart}" data-choix="vl-ecart-curseur" aria-label="Retard en secondes">
    </div>`;
  const navigationImages =
    pause && vl.images.length
      ? `<div class="vl-images">
          <button class="btn secondaire" data-action="vl-image" data-pas="-5">⏪</button>
          <button class="btn secondaire" data-action="vl-image" data-pas="-1">◀ Image</button>
          <input id="vl-curseur" type="range" min="0" max="${vl.images.length - 1}" value="${Math.max(0, vl.rangPause)}" data-saisie="vl-curseur" aria-label="Revoir les dernières secondes">
          <button class="btn secondaire" data-action="vl-image" data-pas="1">Image ▶</button>
          <button class="btn secondaire" data-action="vl-image" data-pas="5">⏩</button>
          <small id="vl-repere">${texteRepere()}</small>
        </div>`
      : '';
  const outils = `<div class="vl-outils">
      ${OUTILS.map((o) => `<button class="choix-sport ${vl.outil === o.id ? 'actif' : ''}" aria-pressed="${vl.outil === o.id}" data-action="vl-outil" data-outil="${o.id}">${o.libelle}</button>`).join('')}
      <span class="vl-couleurs">${COULEURS.map(
        (c) => `<button class="vl-couleur ${vl.couleur === c ? 'actif' : ''}" style="background:${c}" aria-label="Couleur ${c}" aria-pressed="${vl.couleur === c}" data-action="vl-couleur" data-couleur="${c}"></button>`,
      ).join('')}</span>
      <button class="btn-mini" data-action="vl-annuler">↩ Annuler</button>
      <button class="btn-mini" data-action="vl-effacer">🧽 Effacer</button>
    </div>`;
  return `<div class="carte vl-carte">
      <div class="vl-barre">
        ${ecartReglage}
        <button class="btn vl-pause ${pause ? '' : 'danger'}" data-action="vl-pause">${pause ? '▶ Reprendre' : '⏸ Pause'}</button>
      </div>
      <div data-place="vl-scene"></div>
      ${navigationImages}
      ${outils}
      <p class="aide">Dessine directement sur l'image, en pause ou pendant le différé.${pause ? ' « Reprendre » relance le différé (il se remplit à nouveau).' : ''}</p>
      <div class="rangee">
        <button class="btn secondaire" data-action="vl-photo">📷 Enregistrer l'image</button>
        <button class="btn secondaire" data-action="vl-plein-ecran">⛶ Plein écran</button>
        <button class="btn secondaire" data-action="vl-changer-camera">🔄 Changer de caméra</button>
        <button class="btn secondaire" data-action="vl-couper">Couper la caméra</button>
      </div>
    </div>`;
}
