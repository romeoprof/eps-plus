/* Empreinte du code à 4 chiffres d'un élève : la même sur les tablettes et sur le serveur. */
import { empreinte } from './outils.js';

export const cleCode = (idEleve, code) => empreinte(`eleve:${idEleve}:${code}`);
