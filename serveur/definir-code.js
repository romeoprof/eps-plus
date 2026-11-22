/*
 * Choisit le code enseignant du serveur (double-clic sur serveur\definir-code.cmd).
 * Le serveur n'accepte plus l'empreinte de config.json, publique sur internet : il garde la sienne,
 * calculée lentement (scrypt), dans serveur\donnees\code-enseignant.json. Le code lui-même n'est écrit nulle part.
 * Mettre le même code que dans l'application (Espace enseignant).
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdirSync } from 'node:fs';
import { DONNEES, ecrireCodeEnseignant } from './code-enseignant.js';

const lecture = createInterface({ input: stdin, output: stdout });
const code = (await lecture.question('Code enseignant (le même que dans l’application) : ')).trim();
const encore = (await lecture.question('Retape-le pour confirmer : ')).trim();
lecture.close();

if (code.length < 6) {
  console.log('Code trop court : 6 caractères au moins. Rien n’a été changé.');
  process.exit(1);
}
if (code !== encore) {
  console.log('Les deux codes sont différents. Rien n’a été changé.');
  process.exit(1);
}
mkdirSync(DONNEES, { recursive: true });
ecrireCodeEnseignant(code);
console.log('Code enseignant du serveur enregistré ✔ (pris en compte tout de suite, sans redémarrer).');
