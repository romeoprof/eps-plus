/* Son et écran de la tablette, partagés par les tests de course. */
let contexteAudio = null;
let verrouEcran = null;

/* Les tablettes n'autorisent le son qu'après un toucher : à chaque appui, le son est créé ou réveillé.
   Sans cela, un bip lancé par un minuteur (sans toucher) reste muet. */
function contexte() {
  contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
  if (contexteAudio.state !== 'running') contexteAudio.resume?.().catch?.(() => {});
  return contexteAudio;
}
document.addEventListener(
  'pointerdown',
  () => {
    try {
      const ctx = contexte();
      /* Un son vide joué pendant le toucher débloque l'audio (Chrome Android, Safari). */
      const vide = ctx.createBufferSource();
      vide.buffer = ctx.createBuffer(1, 1, 22050);
      vide.connect(ctx.destination);
      vide.start(0);
    } catch {
      /* son non disponible */
    }
  },
  true,
);

export function bip(frequence = 1000, duree = 0.12, volume = 0.22, forme = 'sine') {
  try {
    contexte();
    const debut = contexteAudio.currentTime;
    const oscillateur = contexteAudio.createOscillator();
    const gain = contexteAudio.createGain();
    oscillateur.type = forme;
    oscillateur.frequency.value = frequence;
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    oscillateur.connect(gain).connect(contexteAudio.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
  } catch {
    /* son non disponible */
  }
}

export function vibrer(duree = 40) {
  try {
    navigator.vibrate?.(duree);
  } catch {
    /* non disponible (iPad) */
  }
}

export function garderEcranAllume() {
  try {
    if (navigator.wakeLock && !verrouEcran) {
      navigator.wakeLock
        .request('screen')
        .then((v) => {
          verrouEcran = v;
          v.addEventListener('release', () => {
            verrouEcran = null;
          });
        })
        .catch(() => {});
    }
  } catch {
    /* non disponible */
  }
}
