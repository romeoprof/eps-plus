/* Son et écran de la tablette, partagés par les tests de course. */
let contexteAudio = null;
let verrouEcran = null;

export function bip(frequence = 1000, duree = 0.12, volume = 0.22) {
  try {
    contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
    contexteAudio.resume?.();
    const debut = contexteAudio.currentTime;
    const oscillateur = contexteAudio.createOscillator();
    const gain = contexteAudio.createGain();
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
