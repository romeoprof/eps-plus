/*
 * Code enseignant du serveur : empreinte lente (scrypt) gardée dans serveur\donnees, jamais servie.
 * Chaque essai coûte environ 0,1 s : il faudrait le fichier (qui ne quitte pas le PC), puis plus d'une journée
 * pour un code à 6 chiffres et des années pour 8 caractères mêlant lettres et chiffres. L'empreinte de
 * config.json, publique, se retrouve en quelques minutes : elle ne sert qu'aux tablettes hors connexion.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DONNEES = process.env.EPS_DONNEES || join(dirname(fileURLToPath(import.meta.url)), 'donnees');
const FICHIER = join(DONNEES, 'code-enseignant.json');
const PARAMETRES = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const calculer = (code, sel) => scryptSync(String(code), sel, 32, PARAMETRES);

export function ecrireCodeEnseignant(code) {
  const sel = randomBytes(16);
  const contenu = { sel: sel.toString('hex'), empreinte: calculer(code, sel).toString('hex') };
  writeFileSync(`${FICHIER}.tmp`, JSON.stringify(contenu));
  renameSync(`${FICHIER}.tmp`, FICHIER);
}

/* null : aucun code choisi sur ce serveur ; sinon true ou false. Relu à chaque essai (pas de redémarrage). */
export function verifierCodeEnseignant(code) {
  let enregistre;
  try {
    enregistre = JSON.parse(readFileSync(FICHIER, 'utf8'));
  } catch {
    return null;
  }
  const attendu = Buffer.from(enregistre.empreinte, 'hex');
  const obtenu = calculer(code, Buffer.from(enregistre.sel, 'hex'));
  return attendu.length === obtenu.length && timingSafeEqual(attendu, obtenu);
}
