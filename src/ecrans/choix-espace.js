/* Écran d'arrivée : logo, puis espace enseignant (avec code) ou espace élève (sans code). */
import { logoSvg } from '../contenu/logo.js';

export const vueChoixEspace = () => `
  <div class="choix-espace">
    <div class="logo-accueil">${logoSvg()}<h2>EPS +</h2><p>Observer, mesurer, progresser</p></div>
    <div class="grille-espaces">
      <button class="carte-espace eleve" data-action="espace-eleve">
        <span class="tuile-icone">🏃</span><b>Espace élève</b>
        <small>Observer, chronométrer, voir sa progression</small>
      </button>
      <div class="carte-espace enseignant">
        <span class="tuile-icone">🎓</span><b>Espace enseignant</b>
        <label class="etiquette" for="code-enseignant">Code d'accès</label>
        <input id="code-enseignant" type="password" autocapitalize="off" autocorrect="off" autocomplete="off" placeholder="Code">
        <button class="btn" data-action="espace-enseignant">Entrer</button>
      </div>
    </div>
  </div>`;
