/* Opérations sur les données (sans affichage, donc testables). */

const estJoue = (m) => m.evenements.length > 0 || m.termine;

/* Supprime une équipe. Si elle a déjà joué, elle est seulement masquée :
   son nom reste lisible dans les bilans. Ses matchs non joués disparaissent. */
export function supprimerEquipe(etat, id) {
  const concerne = (m) => m.a === id || m.b === id;
  const joues = etat.matchs.filter((m) => concerne(m) && estJoue(m));
  etat.matchs = etat.matchs.filter((m) => !concerne(m) || estJoue(m));
  etat.poules.forEach((p) => {
    if (!joues.some((m) => m.pouleId === p.id)) p.equipes = p.equipes.filter((e) => e !== id);
  });
  if (joues.length) {
    const equipe = etat.equipes.find((e) => e.id === id);
    if (equipe) equipe.archivee = true;
  } else {
    etat.equipes = etat.equipes.filter((e) => e.id !== id);
  }
  if (!etat.matchs.some((m) => m.id === etat.matchCourant)) etat.matchCourant = null;
}

export const nombreDeMatchsJoues = (etat, id) =>
  etat.matchs.filter((m) => (m.a === id || m.b === id) && estJoue(m)).length;

/* Efface tous les résultats d'une APSA ; équipes, élèves et poules sont conservés. */
export function reinitialiserBilans(etat, apsa) {
  etat.matchs = etat.matchs.filter((m) => m.pouleId || m.apsa !== apsa);
  etat.matchs
    .filter((m) => m.apsa === apsa)
    .forEach((m) => {
      Object.assign(m, {
        criteres: null,
        evenements: [],
        duree: 0,
        departChrono: 0,
        termine: false,
        termineLe: null,
        conseils: ['', ''],
        projets: [[], []],
        bilanProjet: [{}, {}],
        fiche: [{}, {}],
        contrats: {},
      });
    });
  etat.matchCourant = null;
  etat.matchBilan = null;
}

/* Pour protéger l'identité : « Léa M. ». Le nom de famille complet n'est jamais conservé. */
export function prenomInitiale(nomDeFamille, prenom) {
  const initiale = nomDeFamille.trim().charAt(0).toUpperCase();
  const debut = prenom.trim();
  if (!debut) return initiale ? `${nomDeFamille.trim()}` : '';
  return initiale ? `${debut} ${initiale}.` : debut;
}

export const identifiantEleve = (texte) => {
  let h = 0;
  for (const c of texte) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `e${(h >>> 0).toString(36)}`;
};

/* Lit un fichier CSV d'élèves (Nom ; Prénom ; Classe). Renvoie le nombre d'ajouts.
   Deux élèves d'une même classe qui donnent « Léa M. » deviennent « Léa M. » et « Léa M. (2) ». */
export function importerEleves(etat, texte) {
  const separateur = texte.includes(';') ? ';' : ',';
  const vus = {};
  let ajoutes = 0;
  texte.split(/\r?\n/).forEach((ligne, rang) => {
    const colonnes = ligne.split(separateur).map((s) => s.trim().replace(/^"|"$/g, ''));
    if (!colonnes[0] || (rang === 0 && /^nom/i.test(colonnes[0]))) return;
    const base = prenomInitiale(colonnes[0], colonnes[1] || '');
    const classe = colonnes[2] || 'Sans classe';
    const repere = `${base}|${classe}`;
    vus[repere] = (vus[repere] || 0) + 1;
    const nom = vus[repere] > 1 ? `${base} (${vus[repere]})` : base;
    if (!etat.eleves.some((e) => e.nom === nom && e.classe === classe)) {
      etat.eleves.push({ id: identifiantEleve(`${nom}|${classe}`), nom, classe });
      ajoutes += 1;
    }
  });
  return ajoutes;
}
