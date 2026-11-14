/*
 * Dossier d'un élève : uniquement ce qui le concerne, pour le lui envoyer depuis le serveur.
 * Ses rencontres (avec les noms des équipes), ses courses (sans les temps des autres coureurs),
 * ses tests VMA, ses temps PhotoFinish, son carnet de cirque et les troupes dont il fait partie.
 * Rien d'autre : pas les autres élèves, pas leurs codes, pas leurs carnets.
 */
import { paquetCirque } from '../../cirque/calculs.js';

export function dossierEleve(etat, idEleve, maintenant = Date.now()) {
  const eleve = etat.eleves.find((e) => e.id === idEleve);
  if (!eleve) return null;
  const sesEquipes = new Set(etat.equipes.filter((t) => (t.membres || []).includes(idEleve)).map((t) => t.id));
  const matchs = etat.matchs
    .filter((m) => m.evenements?.length && (sesEquipes.has(m.a) || sesEquipes.has(m.b)))
    .map((m) => {
      const copie = { ...m };
      if (m.contrats) copie.contrats = idEleve in m.contrats ? { [idEleve]: m.contrats[idEleve] } : {};
      return copie;
    });
  const idsEquipes = new Set(matchs.flatMap((m) => [m.a, m.b]));
  const equipes = etat.equipes
    .filter((t) => idsEquipes.has(t.id))
    .map((t) => ({ id: t.id, nom: t.nom, classe: t.classe, membres: sesEquipes.has(t.id) ? [idEleve] : [] }));
  const courses = (etat.courses || [])
    .filter((c) => c.coureurs?.some((x) => x.eleveId === idEleve))
    .map((c) => ({ ...c, coureurs: c.coureurs.filter((x) => x.eleveId === idEleve) }));
  const cirque = paquetCirque(etat);
  const troupes = cirque.troupes.filter((t) => t.membres.some((m) => m.id === idEleve));
  return {
    type: 'eps-resultats',
    exporteLe: maintenant,
    dossierDe: idEleve,
    eleves: [{ id: eleve.id, nom: eleve.nom, classe: eleve.classe }],
    equipes,
    poules: [],
    matchs,
    courses,
    testsVma: (etat.testsVma || []).filter((t) => t.eleveId === idEleve),
    tempsPf: (etat.tempsPf || []).filter((t) => t.eleveId === idEleve),
    cirque: { troupes, carnets: cirque.carnets[idEleve] ? { [idEleve]: cirque.carnets[idEleve] } : {} },
  };
}
