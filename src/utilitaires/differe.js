/*
 * Vidéo laps : calculs du différé (sans caméra), vérifiés par les tests.
 * Les images filmées sont gardées dans l'ordre, chacune avec son heure de prise : { t, image }.
 */

export const ECART_MIN = 0;
export const ECART_MAX = 30; // secondes
export const ECART_DEFAUT = 5;
export const IMAGES_PAR_SECONDE = 25;

export const bornerEcart = (secondes) => Math.min(ECART_MAX, Math.max(ECART_MIN, Math.round(Number(secondes) * 2) / 2 || 0));

/* Image à montrer : la plus récente prise au moins « écart » secondes avant maintenant. -1 si aucune. */
export function rangAAfficher(images, maintenant, ecartSecondes) {
  const limite = maintenant - ecartSecondes * 1000;
  let bas = 0;
  let haut = images.length - 1;
  let trouve = -1;
  while (bas <= haut) {
    const milieu = (bas + haut) >> 1;
    if (images[milieu].t <= limite) {
      trouve = milieu;
      bas = milieu + 1;
    } else {
      haut = milieu - 1;
    }
  }
  return trouve;
}

/* Nombre d'images trop anciennes, devenues inutiles (on en garde une seconde de marge). */
export function aRetirer(images, maintenant, ecartSecondes, margeSecondes = 1) {
  const limite = maintenant - (ecartSecondes + margeSecondes) * 1000;
  let n = 0;
  while (n < images.length - 1 && images[n].t < limite) n += 1;
  return n;
}

/* Part du différé déjà filmée (0 à 1) : au début, il faut attendre que l'écart soit rempli. */
export function remplissage(images, maintenant, ecartSecondes) {
  if (!ecartSecondes) return images.length ? 1 : 0;
  if (!images.length) return 0;
  return Math.min(1, (maintenant - images[0].t) / (ecartSecondes * 1000));
}

export const formatEcart = (s) => `${String(s).replace('.', ',')} s`;
