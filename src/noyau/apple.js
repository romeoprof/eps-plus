/*
 * ESSAI DE DESIGN « APPLE » (Handball seulement) : retours immédiats et discrets.
 * - un appui sur un observable donne une très courte vibration (Android) au même instant que l'enfoncement visuel ;
 * - un score qui change « grandit » brièvement, pour qu'on voie tout de suite ce qui a bougé.
 * Rien ne se passe en dehors de body.theme-apple. Pour revenir comme avant : retirer l'import dans main.js.
 */
import { apresDessin } from './interface.js';

const actif = () => document.body.classList.contains('theme-apple');
const mouvementReduit = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Dès l'appui (pas au relâcher) : vibration brève, seulement pour les observables du match. */
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!actif()) return;
    const bouton = e.target.closest?.('.critere');
    if (!bouton || bouton.disabled) return;
    try {
      navigator.vibrate?.(8);
    } catch {
      /* pas de vibration sur cet appareil */
    }
  },
  { passive: true },
);

/* Après chaque dessin : on compare les scores affichés avec ceux d'avant. */
let avant = new Map();
apresDessin(() => {
  if (!actif()) {
    avant = new Map();
    return;
  }
  const maintenant = new Map();
  document.querySelectorAll('.score-a, .score-b, .score-equipe').forEach((el, i) => {
    const cle = `${el.className.split(' ')[0]}-${i}`;
    maintenant.set(cle, el.textContent);
    if (!mouvementReduit() && avant.has(cle) && avant.get(cle) !== el.textContent) el.classList.add('score-change');
  });
  avant = maintenant;
});

/* Le bouton touché s'éclaire un instant, même si l'écran est redessiné aussitôt. */
document.addEventListener('click', (e) => {
  if (!actif() || mouvementReduit()) return;
  const bouton = e.target.closest?.('.critere');
  if (!bouton) return;
  const { equipe, cle } = bouton.dataset;
  requestAnimationFrame(() => {
    const nouveau = document.querySelector(`.critere[data-equipe="${equipe}"][data-cle="${CSS.escape(cle || '')}"]`);
    nouveau?.classList.add('touche');
  });
});
