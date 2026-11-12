/* Point d'entrée : choix de l'espace, en-tête, onglets, choix de l'écran affiché. */
import { etat, sauvegardeOk, sauver } from './noyau/etat.js';
import { brancherEvenements, declarerActions, definirDessin, notifier, rafraichir, vue } from './noyau/interface.js';
import { esc } from './noyau/outils.js';
import { eleveConnecte, estEleve, estEnseignant } from './noyau/espace.js';
import { vueAccueil } from './ecrans/accueil.js';
import { vueChoixEspace } from './ecrans/choix-espace.js';
import { vueConnexion, vueEnvoi, vueListeEleves, vueMaProgression } from './ecrans/eleve.js';
import { APSA } from './champ4/contenu/apsa.js';
import { matchCourant } from './champ4/reglages.js';
import { vueBilan } from './champ4/ecrans/bilan.js';
import { codeEnseignantValide, ouvrirPageEnseignant, pageEnseignantCourante, vueEnseignant } from './champ4/ecrans/enseignant.js';
import { vueEquipes } from './champ4/ecrans/equipes.js';
import { vueMatch } from './champ4/ecrans/match.js';
import { vuePoules } from './champ4/ecrans/poules.js';
import { ONGLETS_DF, vueDemifond } from './demifond/ecrans/module.js';
import { oublierChoixCourse } from './demifond/ecrans/reglages.js';
import { vueTestVma } from './testvma/ecran.js';
import { cooperEnCours } from './testvma/ecran-cooper.js';
import { coursePfEnCours, photofinishEnAttente, vuePhotofinish } from './photofinish/ecran.js';
import { ONGLETS_CIRQUE, vueCirque } from './cirque/ecran.js';

const photofinishActif = () => coursePfEnCours() || photofinishEnAttente();
const testVmaEnCours = () => !!etat.testVma.depart && !etat.testVma.arret;

const ONGLETS = [
  { id: 'equipes', libelle: '👥 Équipes', vue: vueEquipes },
  { id: 'poules', libelle: '🏆 Poules', vue: vuePoules },
  { id: 'match', libelle: '⏱️ Match', vue: vueMatch },
  { id: 'bilan', libelle: '📊 Bilan', vue: vueBilan },
];

/* Écrans propres à chaque espace. */
const ECRANS_ELEVE = ['connexion', 'ma-progression', 'envoi', 'liste-eleves'];
const ECRANS_ENSEIGNANT = ['enseignant', 'photofinish'];

/* En entrant dans un espace, une course ou un test en cours reprend là où il en était. */
function ecranDeReprise() {
  if (estEnseignant() && coursePfEnCours()) return 'photofinish';
  if (etat.courseEnCours) {
    vue.ongletDF = 'course';
    return 'demifond';
  }
  if (testVmaEnCours() || cooperEnCours() || (etat.testVma.cooper?.test && etat.testVma.cooper.test.coureurs[0].distanceFinale == null)) {
    return 'testvma';
  }
  if (etat.apsa) return 'champ4';
  return estEnseignant() ? 'enseignant' : 'accueil';
}

/* Récupère la configuration déposée sur le site, puis recharge l'application. */
async function mettreAJour() {
  if (!navigator.onLine) return notifier('Pas de connexion internet');
  try {
    const reponse = await fetch('config.json', { cache: 'no-store' });
    if (reponse.ok) {
      const config = await reponse.json();
      if (config.version && config.version !== etat.configVersion) {
        Object.assign(etat.reglages, config.reglages);
        if (config.reglages?.demifond) oublierChoixCourse();
        etat.configVersion = config.version;
        sauver();
        notifier('Configuration mise à jour ✔');
      } else {
        notifier('Déjà à jour ✔');
      }
    } else {
      notifier('Aucune configuration publiée');
    }
    setTimeout(() => window.location.reload(), 1300);
  } catch {
    notifier('Mise à jour impossible');
  }
}

function entrerEnseignant() {
  const champ = document.querySelector('#code-enseignant');
  if (!codeEnseignantValide(champ?.value || '')) {
    if (champ) champ.value = '';
    return notifier('Code incorrect.');
  }
  vue.espace = 'enseignant';
  etat.espace = null; // au prochain lancement, le code sera redemandé
  etat.eleveConnecte = null;
  sauver();
  ouvrirPageEnseignant('menu');
  vue.ecran = ecranDeReprise();
  rafraichir();
}

declarerActions({
  'espace-eleve': () => {
    vue.espace = 'eleve';
    etat.espace = 'eleve';
    sauver();
    vue.ecran = ecranDeReprise();
    rafraichir();
  },
  'espace-enseignant': entrerEnseignant,
  'changer-espace': () => {
    vue.espace = null;
    etat.espace = null;
    etat.eleveConnecte = null;
    sauver();
    vue.ecran = 'choix';
    rafraichir();
  },
  'ens-activites': () => {
    vue.ecran = 'accueil';
    rafraichir();
  },
  'menu-enseignant': () => {
    ouvrirPageEnseignant('menu');
    vue.ecran = 'enseignant';
    rafraichir();
  },
  accueil: () => {
    vue.ecran = 'accueil';
    rafraichir();
  },
  'menu-principal': () => {
    etat.apsa = null;
    etat.matchCourant = null;
    vue.ecran = 'accueil';
    vue.onglet = 'match';
    sauver();
    rafraichir();
  },
  'ouvrir-module': ({ module }) => {
    vue.ecran = module;
    rafraichir();
  },
  'choisir-apsa': ({ apsa }) => {
    etat.apsa = apsa;
    etat.matchCourant = null;
    vue.ecran = 'champ4';
    vue.onglet = 'match';
    sauver();
    rafraichir();
  },
  onglet: ({ onglet }) => {
    vue.onglet = onglet;
    rafraichir();
  },
  'basculer-affichage': ({ reglage }) => {
    etat.affichage[reglage] = !etat.affichage[reglage];
    sauver();
    rafraichir();
  },
  'mettre-a-jour': mettreAJour,
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'code-enseignant') entrerEnseignant();
});

function indicateurSauvegarde() {
  return sauvegardeOk
    ? `<span class="pastille-etat ok">✓ Enregistré</span>`
    : `<span class="pastille-etat erreur" role="alert">⚠ Non enregistré : fais une sauvegarde</span>`;
}

function libelleEspace() {
  if (estEnseignant()) return 'Espace enseignant';
  if (estEleve()) return eleveConnecte() ? `Espace élève · ${esc(eleveConnecte().nom)}` : 'Espace élève';
  return 'Saint-Joseph Auneau';
}

function dessinerEnTete() {
  const titres = { demifond: ['Demi-fond', '🏃'], testvma: ['Test VMA', '📈'], photofinish: ['PhotoFinish', '📸'], cirque: ['Arts du cirque', '🎪'] };
  const [titre, icone] =
    vue.ecran === 'champ4' ? [esc(etat.apsa), APSA[etat.apsa].icone] : titres[vue.ecran] || [libelleEspace(), estEnseignant() ? '🎓' : '🏅'];
  const sousTitre = titres[vue.ecran] || vue.ecran === 'champ4' ? `${titre} · ${libelleEspace()}` : titre;
  document.querySelector('#entete').innerHTML = `
    <div class="marque"><span class="marque-icone">${icone}</span><div><h1>EPS +</h1><small>${sousTitre}</small></div></div>
    <div class="commandes">
      <span id="etat-sauvegarde">${indicateurSauvegarde()}</span>
      ${vue.espace ? `<button class="btn-mini" data-action="changer-espace">⇄ Changer d'espace</button>` : ''}
      <button class="btn-mini" data-action="mettre-a-jour">⟳ Mise à jour</button>
      <button class="btn-mini" data-action="basculer-affichage" data-reglage="sombre" aria-label="Thème sombre" aria-pressed="${etat.affichage.sombre}">🌓</button>
      <button class="btn-mini" data-action="basculer-affichage" data-reglage="grandsBoutons" aria-label="Grands boutons" aria-pressed="${etat.affichage.grandsBoutons}">Aa</button>
    </div>`;
}

const retour = (action, texte) => `<button class="btn-retour" data-action="${action}">← ${texte}</button>`;

function dessinerNavigation() {
  const barre = document.querySelector('#navigation');
  const versMenu = retour('accueil', 'Menu principal');
  if (vue.ecran === 'photofinish') {
    /* Pas de retour au menu pendant une course : la caméra serait coupée. */
    barre.innerHTML = photofinishActif() ? '' : versMenu;
  } else if (vue.ecran === 'enseignant') {
    barre.innerHTML = pageEnseignantCourante() === 'menu' ? '' : retour('menu-enseignant', 'Menu enseignant');
  } else if (vue.ecran === 'accueil') {
    barre.innerHTML = estEnseignant() ? retour('menu-enseignant', 'Menu enseignant') : '';
  } else if (vue.ecran === 'testvma' || ECRANS_ELEVE.includes(vue.ecran)) {
    barre.innerHTML = versMenu;
  } else if (vue.ecran === 'champ4') {
    barre.innerHTML = `${retour('menu-principal', 'Menu principal')}
      <div class="onglets" role="tablist">${ONGLETS.map(
        (o) => `<button role="tab" aria-selected="${o.id === vue.onglet}" class="onglet ${o.id === vue.onglet ? 'actif' : ''}" data-action="onglet" data-onglet="${o.id}">${o.libelle}</button>`,
      ).join('')}</div>`;
  } else if (vue.ecran === 'cirque') {
    barre.innerHTML = `${versMenu}
      <div class="onglets" role="tablist">${ONGLETS_CIRQUE.map(
        (o) => `<button role="tab" aria-selected="${o.id === vue.ongletCirque}" class="onglet ${o.id === vue.ongletCirque ? 'actif' : ''}" data-action="cq-onglet" data-onglet="${o.id}">${o.libelle}</button>`,
      ).join('')}</div>`;
  } else if (vue.ecran === 'demifond') {
    barre.innerHTML = `${versMenu}
      <div class="onglets" role="tablist">${ONGLETS_DF.map(
        (o) => `<button role="tab" aria-selected="${o.id === vue.ongletDF}" class="onglet ${o.id === vue.ongletDF ? 'actif' : ''}" data-action="df-onglet" data-onglet="${o.id}">${o.libelle}</button>`,
      ).join('')}</div>`;
  } else {
    barre.innerHTML = '';
  }
}

function contenu() {
  switch (vue.ecran) {
    case 'choix':
      return vueChoixEspace();
    case 'enseignant':
      return vueEnseignant();
    case 'accueil':
      return vueAccueil();
    case 'connexion':
      return vueConnexion();
    case 'ma-progression':
      return vueMaProgression();
    case 'envoi':
      return vueEnvoi();
    case 'liste-eleves':
      return vueListeEleves();
    case 'demifond':
      return vueDemifond();
    case 'testvma':
      return vueTestVma();
    case 'photofinish':
      return vuePhotofinish();
    case 'cirque':
      return vueCirque();
    default:
      return ONGLETS.find((o) => o.id === vue.onglet).vue();
  }
}

/* Chaque espace n'ouvre que ses écrans. */
function verifierEcran() {
  if (!vue.espace) vue.ecran = 'choix';
  else if (vue.ecran === 'choix') vue.ecran = ecranDeReprise();
  else if (estEleve() && ECRANS_ENSEIGNANT.includes(vue.ecran)) vue.ecran = 'accueil';
  else if (estEnseignant() && ECRANS_ELEVE.includes(vue.ecran)) vue.ecran = 'accueil';
  if (vue.ecran === 'champ4' && !etat.apsa) vue.ecran = 'accueil';
}

definirDessin(() => {
  verifierEcran();
  document.body.classList.toggle('sombre', etat.affichage.sombre);
  document.body.classList.toggle('grands', etat.affichage.grandsBoutons);
  document.body.classList.toggle('ecran-choix', vue.ecran === 'choix');
  /* La zone autour de l'application (barre d'état de l'iPad) suit le fond, clair ou sombre. */
  const couleurFond = etat.affichage.sombre ? '#0f172a' : '#e8f4fd';
  document.documentElement.style.background = couleurFond;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', couleurFond);
  /* Pendant une course, on masque l'en-tête pour laisser la place aux coureurs. */
  const testEnCours = vue.ecran === 'testvma' && (testVmaEnCours() || cooperEnCours());
  const match = vue.ecran === 'champ4' && vue.onglet === 'match' ? matchCourant() : null;
  const raquetteEnCours = !!match && !match.termine && !!APSA[match.apsa]?.terrain;
  const pfEnCours = vue.ecran === 'photofinish' && photofinishActif();
  const demifondEnCours = vue.ecran === 'demifond' && vue.ongletDF === 'course' && !!etat.courseEnCours;
  document.body.classList.toggle('en-course', pfEnCours || testEnCours || raquetteEnCours || demifondEnCours);
  dessinerEnTete();
  dessinerNavigation();
  document.querySelector('#contenu').innerHTML = contenu();
});

brancherEvenements();
['input', 'change'].forEach((evenement) =>
  document.addEventListener(evenement, () => {
    const pastille = document.querySelector('#etat-sauvegarde');
    if (pastille) pastille.innerHTML = indicateurSauvegarde();
  }),
);

/* Une tablette d'élèves rouvre directement l'espace élève ; l'espace enseignant redemande le code. */
if (etat.espace === 'eleve') {
  vue.espace = 'eleve';
  vue.ecran = ecranDeReprise();
}
rafraichir();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
