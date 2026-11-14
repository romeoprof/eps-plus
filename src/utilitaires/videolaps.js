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
import { angleDegres, brasPropose, deplacer, poignees, poigneeTouchee, traceTouche } from './dessin.js';

const LARGEUR = 960; // largeur des images gardées (px)
const MARGE = 3; // secondes gardées en plus de l'écart, pour revoir image par image
const COULEURS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ffffff'];
const OUTILS = [
  { id: 'crayon', libelle: '✏️ Crayon' },
  { id: 'trait', libelle: '📏 Trait' },
  { id: 'fleche', libelle: '➡️ Flèche' },
  { id: 'cercle', libelle: '⭕ Cercle' },
  { id: 'angle', libelle: '📐 Angle' },
  { id: 'modifier', libelle: '✋ Déplacer' },
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
  trait: null, // tracé en cours de dessin
  selection: -1, // tracé choisi, à modifier
  geste: null, // poignée ou tracé en cours de déplacement
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

/* Angle : les deux bras, l'arc et l'ouverture en degrés, écrite près du sommet. */
function tracerAngle(ctx, trait) {
  const [s, b, c] = trait.points;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(s.x, s.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  const a1 = Math.atan2(b.y - s.y, b.x - s.x);
  const a2 = Math.atan2(c.y - s.y, c.x - s.x);
  let ecart = a2 - a1;
  while (ecart > Math.PI) ecart -= 2 * Math.PI;
  while (ecart < -Math.PI) ecart += 2 * Math.PI;
  const rayon = Math.max(18, Math.min(60, Math.hypot(b.x - s.x, b.y - s.y) / 3, Math.hypot(c.x - s.x, c.y - s.y) / 3));
  ctx.save();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s.x, s.y, rayon, a1, a1 + ecart, ecart < 0);
  ctx.stroke();
  const milieu = a1 + ecart / 2;
  const texte = `${angleDegres(s, b, c)}°`;
  ctx.font = 'bold 34px sans-serif';
  const largeur = ctx.measureText(texte).width;
  const tx = s.x + (rayon + 40) * Math.cos(milieu);
  const ty = s.y + (rayon + 40) * Math.sin(milieu);
  ctx.fillStyle = 'rgba(15, 23, 42, .78)';
  ctx.fillRect(tx - largeur / 2 - 8, ty - 22, largeur + 16, 42);
  ctx.fillStyle = trait.couleur;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texte, tx, ty);
  ctx.restore();
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
  if (trait.outil === 'angle' && trait.points.length === 3) {
    tracerAngle(ctx, trait);
  } else if (trait.outil === 'crayon') {
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

/* Tous les tracés ; le tracé choisi est entouré de pointillés et montre ses poignées. */
function peindreTraces(ctx, avecPoignees) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  [...vl.traits, ...(vl.trait ? [vl.trait] : [])].forEach((t) => tracer(ctx, t));
  const choisi = vl.traits[vl.selection];
  if (!avecPoignees || !choisi) return;
  ctx.save();
  poignees(choisi).forEach((i) => {
    const p = choisi.points[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = choisi.couleur === '#ffffff' ? '#0f172a' : choisi.couleur;
    ctx.stroke();
  });
  if (choisi.outil === 'crayon') {
    const xs = choisi.points.map((p) => p.x);
    const ys = choisi.points.map((p) => p.y);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(Math.min(...xs) - 12, Math.min(...ys) - 12, Math.max(...xs) - Math.min(...xs) + 24, Math.max(...ys) - Math.min(...ys) + 24);
  }
  ctx.restore();
}

function redessiner() {
  if (vl.dessin) peindreTraces(vl.dessin.getContext('2d'), true);
}

/* Tolérance du doigt, en pixels de l'image (l'écran peut être plus petit ou plus grand). */
const tolerance = () => 28 * (vl.dessin.width / Math.max(1, vl.dessin.getBoundingClientRect().width));

function brancherDessin() {
  vl.dessin.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    vl.dessin.setPointerCapture?.(e.pointerId);
    const p = point(e);
    /* Une poignée sous le doigt : on la déplace, quel que soit l'outil choisi. */
    const poignee = poigneeTouchee(vl.traits, p, tolerance());
    if (poignee) {
      vl.selection = poignee.trace;
      vl.geste = { type: 'poignee', trace: poignee.trace, point: poignee.point };
    } else if (vl.outil === 'modifier') {
      vl.selection = traceTouche(vl.traits, p, tolerance());
      vl.geste = vl.selection >= 0 ? { type: 'deplacer', dernier: p } : null;
    } else {
      vl.selection = -1;
      vl.trait = { outil: vl.outil, couleur: vl.couleur, points: [p] };
    }
    redessiner();
    majBoutonsDessin();
  });
  vl.dessin.addEventListener('pointermove', (e) => {
    const p = point(e);
    if (vl.geste?.type === 'poignee') {
      vl.traits[vl.geste.trace].points[vl.geste.point] = p;
    } else if (vl.geste?.type === 'deplacer') {
      deplacer(vl.traits[vl.selection], p.x - vl.geste.dernier.x, p.y - vl.geste.dernier.y);
      vl.geste.dernier = p;
    } else if (vl.trait) {
      if (vl.trait.outil === 'crayon') vl.trait.points.push(p);
      else vl.trait.points = [vl.trait.points[0], p];
    } else {
      return;
    }
    redessiner();
  });
  const finir = () => {
    vl.geste = null;
    if (vl.trait) {
      const [a] = vl.trait.points;
      const b = vl.trait.points[vl.trait.points.length - 1];
      if (vl.trait.points.length > 1 && Math.hypot(b.x - a.x, b.y - a.y) > 6) {
        /* L'angle est créé avec un 2e bras proposé, à régler ensuite par sa poignée. */
        if (vl.trait.outil === 'angle') vl.trait.points = [a, b, brasPropose(a, b)];
        vl.traits.push(vl.trait);
        vl.selection = vl.traits.length - 1;
      }
      vl.trait = null;
    }
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
  const supprimer = document.querySelector('[data-action="vl-supprimer"]');
  if (supprimer) supprimer.disabled = !vl.traits[vl.selection];
}

/* Image + dessin, enregistrés en PNG (par exemple pour la montrer en fin de séance). */
function enregistrerImage() {
  const toile = document.createElement('canvas');
  toile.width = vl.ecran.width;
  toile.height = vl.ecran.height;
  const ctx = toile.getContext('2d');
  ctx.drawImage(vl.ecran, 0, 0);
  const calque = document.createElement('canvas');
  calque.width = toile.width;
  calque.height = toile.height;
  peindreTraces(calque.getContext('2d'), false); // sans les poignées
  ctx.drawImage(calque, 0, 0);
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
  /* La couleur choisie s'applique aussi au tracé sélectionné. */
  'vl-couleur': ({ couleur }) => {
    vl.couleur = couleur;
    if (vl.traits[vl.selection]) vl.traits[vl.selection].couleur = couleur;
    rafraichir();
    redessiner();
  },
  'vl-annuler': () => {
    vl.traits.pop();
    if (vl.selection >= vl.traits.length) vl.selection = -1;
    redessiner();
    majBoutonsDessin();
  },
  'vl-supprimer': () => {
    if (!vl.traits[vl.selection]) return;
    vl.traits.splice(vl.selection, 1);
    vl.selection = -1;
    redessiner();
    majBoutonsDessin();
  },
  'vl-effacer': () => {
    vl.traits = [];
    vl.selection = -1;
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
      <button class="btn-mini" data-action="vl-supprimer">🗑 Supprimer le tracé</button>
      <button class="btn-mini" data-action="vl-effacer">🧽 Tout effacer</button>
    </div>`;
  return `<div class="carte vl-carte">
      <div class="vl-barre">
        ${ecartReglage}
        <button class="btn vl-pause ${pause ? '' : 'danger'}" data-action="vl-pause">${pause ? '▶ Reprendre' : '⏸ Pause'}</button>
      </div>
      <div data-place="vl-scene"></div>
      ${navigationImages}
      ${outils}
      <p class="aide">Dessine directement sur l'image, en pause ou pendant le différé. Pour modifier un tracé : fais glisser ses ronds blancs (extrémités, sommet et bras de l'angle) ; avec « ✋ Déplacer », touche un tracé pour le déplacer en entier. Une couleur touchée s'applique au tracé choisi.${pause ? ' « Reprendre » relance le différé (il se remplit à nouveau).' : ''}</p>
      <div class="rangee">
        <button class="btn secondaire" data-action="vl-photo">📷 Enregistrer l'image</button>
        <button class="btn secondaire" data-action="vl-plein-ecran">⛶ Plein écran</button>
        <button class="btn secondaire" data-action="vl-changer-camera">🔄 Changer de caméra</button>
        <button class="btn secondaire" data-action="vl-couper">Couper la caméra</button>
      </div>
    </div>`;
}
