import { score } from './match.js';

/* Classement d'une poule : victoires, puis différence de score. */
export function classer(poule, matchs) {
  const lignes = Object.fromEntries(
    poule.equipes.map((id) => [id, { id, joues: 0, victoires: 0, nuls: 0, defaites: 0, difference: 0 }]),
  );
  matchs
    .filter((m) => m.pouleId === poule.id && m.termine)
    .forEach((m) => {
      const a = lignes[m.a];
      const b = lignes[m.b];
      if (!a || !b) return;
      const sa = score(m, 0);
      const sb = score(m, 1);
      a.joues += 1;
      b.joues += 1;
      a.difference += sa - sb;
      b.difference += sb - sa;
      if (sa > sb) {
        a.victoires += 1;
        b.defaites += 1;
      } else if (sb > sa) {
        b.victoires += 1;
        a.defaites += 1;
      } else {
        a.nuls += 1;
        b.nuls += 1;
      }
    });
  return Object.values(lignes).sort((x, y) => y.victoires - x.victoires || y.difference - x.difference);
}
