/*
 * Vidéo laps : géométrie des tracés (sans affichage), vérifiée par les tests.
 * Un tracé : { outil, couleur, points }.
 *  crayon : tous les points du geste ; trait et flèche : [début, fin] ;
 *  cercle : [centre, point du bord] ; angle : [sommet, bout du 1er bras, bout du 2e bras].
 */

/* Ouverture de l'angle en degrés (0 à 180), au sommet s, entre les bras s→b et s→c. */
export function angleDegres(s, b, c) {
  const a1 = Math.atan2(b.y - s.y, b.x - s.x);
  const a2 = Math.atan2(c.y - s.y, c.x - s.x);
  let ecart = Math.abs(a2 - a1);
  if (ecart > Math.PI) ecart = 2 * Math.PI - ecart;
  return Math.round((ecart * 180) / Math.PI);
}

/* Deuxième bras proposé à la création d'un angle : le premier tourné de 45°. */
export function brasPropose(s, b) {
  const angle = Math.atan2(b.y - s.y, b.x - s.x) - Math.PI / 4;
  const longueur = Math.hypot(b.x - s.x, b.y - s.y);
  return { x: s.x + longueur * Math.cos(angle), y: s.y + longueur * Math.sin(angle) };
}

export function distanceSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const longueur2 = dx * dx + dy * dy;
  const k = longueur2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / longueur2)) : 0;
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy));
}

/* Le doigt touche-t-il ce tracé (à « tolerance » près) ? */
export function toucheTrace(trace, p, tolerance) {
  const pts = trace.points;
  if (trace.outil === 'cercle') return Math.abs(Math.hypot(p.x - pts[0].x, p.y - pts[0].y) - Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)) <= tolerance;
  if (trace.outil === 'angle') return distanceSegment(p, pts[0], pts[1]) <= tolerance || distanceSegment(p, pts[0], pts[2]) <= tolerance;
  for (let i = 1; i < pts.length; i += 1) if (distanceSegment(p, pts[i - 1], pts[i]) <= tolerance) return true;
  return pts.length === 1 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= tolerance;
}

/* Poignées qu'on peut déplacer au doigt (le crayon se déplace en entier). */
export const poignees = (trace) => (trace.outil === 'crayon' ? [] : trace.points.map((_, i) => i));

/* Poignée la plus proche sous le doigt : { rang du tracé, rang du point } ou null. Les derniers tracés passent devant. */
export function poigneeTouchee(traces, p, tolerance) {
  let meilleure = null;
  traces.forEach((trace, rang) =>
    poignees(trace).forEach((i) => {
      const d = Math.hypot(p.x - trace.points[i].x, p.y - trace.points[i].y);
      if (d <= tolerance && (!meilleure || d <= meilleure.distance)) meilleure = { trace: rang, point: i, distance: d };
    }),
  );
  return meilleure;
}

export function traceTouche(traces, p, tolerance) {
  for (let rang = traces.length - 1; rang >= 0; rang -= 1) if (toucheTrace(traces[rang], p, tolerance)) return rang;
  return -1;
}

export const deplacer = (trace, dx, dy) => {
  trace.points = trace.points.map((q) => ({ x: q.x + dx, y: q.y + dy }));
};
