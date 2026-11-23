/*
 * MULTI-TIMER (Utilitaires) : les calculs, sans affichage.
 * Un chrono = { debut, cumul } : « debut » est l'heure du dernier départ (null à l'arrêt),
 * « cumul » le temps déjà compté avant ce départ (ms). Ainsi le temps reste juste même si
 * l'écran est redessiné ou si l'on passe par un autre écran.
 */
export const chronoVide = () => ({ debut: null, cumul: 0 });
export const ecoule = (c, maintenant = Date.now()) => c.cumul + (c.debut == null ? 0 : maintenant - c.debut);
export const demarrer = (c, maintenant = Date.now()) => {
  if (c.debut == null) c.debut = maintenant;
};
export const arreter = (c, maintenant = Date.now()) => {
  if (c.debut == null) return;
  c.cumul += maintenant - c.debut;
  c.debut = null;
};

/* 83 456 ms → « 01:23,4 » ; au-delà d'une heure → « 1:02:03,4 ». */
export function formatDuree(ms, { dixiemes = true } = {}) {
  const total = Math.max(0, ms);
  const dix = Math.floor(total / 100) % 10;
  const s = Math.floor(total / 1000);
  const h = Math.floor(s / 3600);
  const mmss = `${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${h ? `${h}:` : ''}${mmss}${dixiemes ? `,${dix}` : ''}`;
}

/* Compte à rebours : secondes entières restantes, arrondies au-dessus (on voit « 3, 2, 1 », puis 0). */
export const resteSecondes = (dureeMs, ecouleMs) => Math.max(0, Math.ceil((dureeMs - ecouleMs) / 1000));

/* Intervalles : préparation, puis « travail / repos » répétés ; pas de repos après la dernière série. */
export function etapesIntervalles({ prepa = 0, travail, repos = 0, series }) {
  const etapes = [];
  if (prepa > 0) etapes.push({ phase: 'prepa', serie: 0, duree: prepa * 1000 });
  for (let n = 1; n <= series; n += 1) {
    etapes.push({ phase: 'travail', serie: n, duree: travail * 1000 });
    if (repos > 0 && n < series) etapes.push({ phase: 'repos', serie: n, duree: repos * 1000 });
  }
  return etapes;
}

export const dureeTotale = (cfg) => etapesIntervalles(cfg).reduce((t, e) => t + e.duree, 0);

/* Où en est-on après « ms » millisecondes ? rang = numéro de l'étape (pour repérer un changement). */
export function phaseIntervalles(cfg, ms) {
  const etapes = etapesIntervalles(cfg);
  let debut = 0;
  for (let rang = 0; rang < etapes.length; rang += 1) {
    const e = etapes[rang];
    if (ms < debut + e.duree) return { ...e, rang, reste: debut + e.duree - ms, fini: false };
    debut += e.duree;
  }
  return { phase: 'fini', serie: cfg.series, rang: etapes.length, reste: 0, duree: 0, fini: true };
}

/* Réglage saisi au clavier : un entier entre min et max, sinon la valeur par défaut. */
export function borner(valeur, min, max, defaut) {
  const n = Math.round(Number(String(valeur).replace(',', '.')));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
}
