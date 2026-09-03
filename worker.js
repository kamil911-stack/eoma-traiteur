// Worker ÉOMA — couche SEO devant les assets statiques.
//
// Regle trois problemes que la configuration d'assets seule ne peut pas traiter :
//   1. www.eomatraiteur.fr et eoma-traiteur.eomatraiteur.workers.dev repondaient
//      tous les deux en 200 avec le meme contenu que le domaine principal
//      (contenu duplique sur 3 domaines).
//   2. Le routage SPA renvoyait 200 + l'accueil pour n'importe quelle URL
//      inexistante (soft 404). Ici seules les 7 routes connues sont servies,
//      le reste part en vrai 404.
//   3. Cache : le HTML doit rester revalide, mais /assets/ est immuable
//      (nom de fichier = UUID) et peut etre mis en cache un an.

// Metadonnees par vue. Le script SEO du bundle fait le meme travail apres
// rendu, mais uniquement pour les clients qui executent JS : sans ca les 7
// URLs partagent le title et le canonical de l'accueil dans le HTML servi.
const PAGES = {
  '/': {
    title: "ÉOMA Traiteur d'Exception — Traiteur événementiel, mariage & entreprise en France",
    description: "Traiteur événementiel haut de gamme pour mariages, réceptions et événements d'entreprise. Cuisine 100% faite maison, fraîche et de saison, circuit court. Devis sous 48h.",
    ogTitle: "ÉOMA Traiteur d'Exception — Traiteur événementiel, mariage & entreprise",
    ogDesc: "Cuisine 100% faite maison pour mariages, réceptions et événements d'entreprise. Devis sous 48h.",
  },
  '/entreprises': {
    title: "Traiteur entreprise Essonne (91) — ÉOMA Traiteur d'Exception",
    description: "Déjeuners de réunion, plateaux chauds, cocktails d'affaires et petits-déjeuners pour entreprises en Essonne et Île-de-France. Cuisine faite maison, devis sous 48h.",
    ogTitle: "Traiteur entreprise en Essonne (91) — ÉOMA Traiteur d'Exception",
    ogDesc: "Déjeuners de réunion, plateaux chauds et cocktails d'affaires pour vos équipes. Cuisine faite maison, devis sous 48h.",
  },
  '/mariages': {
    title: "Traiteur mariage Essonne (91) — Buffets & cocktails | ÉOMA",
    description: "Traiteur mariage et réception en Essonne et Île-de-France : buffets froids et chauds, cocktails et animations culinaires. Cuisine faite maison, devis sous 48h.",
    ogTitle: "Traiteur mariage en Essonne (91) — Buffets & cocktails | ÉOMA",
    ogDesc: "Buffets, cocktails et animations culinaires pour votre mariage en Île-de-France. Cuisine faite maison, devis sous 48h.",
  },
  '/engagements': {
    title: "Nos engagements — Traiteur écoresponsable en Essonne | ÉOMA",
    description: "Cuisine 100% faite maison, produits frais et de saison, circuit court avec des producteurs français et zéro plastique. La démarche d'ÉOMA Traiteur.",
    ogTitle: "Nos engagements — Traiteur écoresponsable en Essonne | ÉOMA",
    ogDesc: "Cuisine 100% faite maison, produits frais et de saison, circuit court avec des producteurs français, zéro plastique.",
  },
  '/la-cheffe': {
    title: "Célia Leroy, cheffe et gérante — ÉOMA Traiteur d'Exception",
    description: "Célia Leroy dirige ÉOMA Traiteur depuis Ris-Orangis. Elle prend vos appels, construit vos menus et signe vos devis, sans intermédiaire.",
    ogTitle: "Célia Leroy, cheffe et gérante — ÉOMA Traiteur d'Exception",
    ogDesc: "La cheffe prend vos appels, construit vos menus et signe vos devis, sans intermédiaire.",
  },
  '/galerie': {
    title: "Galerie — Buffets, cocktails et réceptions | ÉOMA Traiteur",
    description: "Découvrez en images les buffets, cocktails et réceptions réalisés par ÉOMA Traiteur d'Exception en Essonne et en Île-de-France.",
    ogTitle: "Galerie — Buffets, cocktails et réceptions | ÉOMA Traiteur",
    ogDesc: "Les buffets, cocktails et réceptions réalisés par ÉOMA Traiteur en Essonne et en Île-de-France.",
  },
  '/contact': {
    title: "Contact & devis sous 48h — ÉOMA Traiteur, Ris-Orangis (91)",
    description: "Contactez ÉOMA Traiteur à Ris-Orangis (91) : 07 67 60 31 51. Devis personnalisé sous 48h pour vos mariages, réceptions et événements d'entreprise.",
    ogTitle: "Contact & devis sous 48h — ÉOMA Traiteur, Ris-Orangis (91)",
    ogDesc: "Contactez ÉOMA Traiteur : 07 67 60 31 51. Devis personnalisé sous 48h pour vos événements.",
  },
};

const ROUTES = new Set(Object.keys(PAGES));

// Pages statiques classiques, hors SPA. Elles ont un vrai fichier .html, mais
// html_handling: auto-trailing-slash redirige /x.html vers /x : sans cette
// table, /x ne figurait pas dans ROUTES et repartait en 404. Les deux liens du
// footer pointaient donc dans le vide sur les 7 pages du site.
const STATIC_PAGES = {
  '/mentions-legales': '/mentions-legales.html',
  '/politique-confidentialite': '/politique-confidentialite.html',
};

const PAGE_404 = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Page introuvable — ÉOMA Traiteur d'Exception</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#245613;color:#EDE7D8;font-family:'Poppins',-apple-system,sans-serif;text-align:center;padding:24px}
 h1{font-family:'Playfair Display',Georgia,serif;color:#C9A55C;font-size:clamp(28px,5vw,44px);margin:0 0 14px}
 p{color:rgba(237,231,216,.85);margin:0 0 28px}
 a{display:inline-block;padding:13px 26px;background:#C9A55C;color:#163C0B;
   border-radius:999px;text-decoration:none;font-weight:600}
</style>
</head><body><div>
 <h1>Cette page n'existe pas</h1>
 <p>Le lien que vous avez suivi ne correspond à aucune page du site.</p>
 <a href="/">Retour à l'accueil</a>
</div></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;

    // 1. www -> apex, en 301 (permanent, transmet le signal aux moteurs).
    // On force https : derriere le proxy Cloudflare le protocole vu ici peut
    // etre http, et rediriger vers http ajouterait un saut inutile.
    if (host.startsWith('www.')) {
      url.hostname = host.slice(4);
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const path = url.pathname;
    const isAsset = /\.[a-z0-9]+$/i.test(path);

    // Ancienne URL du fichier de design, gardee pour les favoris et liens
    // externes. Le fichier faisait une redirection meta-refresh + JS, que les
    // moteurs suivent mal et qui ne transmet pas de signal : vrai 301 ici.
    if (/^\/EOMA(%20| )Traiteur(\.html)?$/i.test(path)) {
      return Response.redirect(new URL('/', url).toString(), 301);
    }

    // Etat de l'editeur de design, jamais deploye. Le composant image-slot le
    // demande sur chaque page : on renvoie un JSON vide plutot qu'un 404 qui
    // pollue la console et les logs. (Avant, le soft 404 lui renvoyait
    // l'accueil en 200, soit 380 Ko de HTML a chaque chargement de page.)
    if (path === '/.image-slots.state.json') {
      return new Response('{}', {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=86400',
          'x-robots-tag': 'noindex',
        },
      });
    }

    const view = path.replace(/\/+$/, '') || '/';

    // 2. Vrai 404 sur les URLs inconnues (hors fichiers, geres par ASSETS)
    if (!isAsset && !ROUTES.has(view) && !STATIC_PAGES[view]) {
      return new Response(PAGE_404, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // Les pages statiques servent leur propre fichier ; les routes SPA n'ont
    // pas de fichier dedie, on leur sert index.html.
    let assetReq = request;
    if (STATIC_PAGES[view]) {
      assetReq = new Request(new URL(STATIC_PAGES[view], url).toString(), request);
    } else if (!isAsset && path !== '/') {
      assetReq = new Request(new URL('/', url).toString(), request);
    }

    const res = await env.ASSETS.fetch(assetReq);
    let out = new Response(res.body, res);

    // Le pre-rendu embarque les 7 vues dans le meme index.html. Un crawler qui
    // n'execute pas JS (GPTBot, PerplexityBot, Bingbot sur une partie de ses
    // crawls) verrait donc les 7 sections et 7 H1 sur chaque URL. Le filtrage
    // cote client ne les aide pas : on retire ici les sections des autres vues.
    if (!isAsset && res.headers.get('content-type')?.includes('text/html')) {
      const page = PAGES[view];
      const canonical = 'https://eomatraiteur.fr' + (view === '/' ? '/' : view);

      let rw = new HTMLRewriter()
        .on('#__prerender_seo section[data-prerender-path]', {
          element(el) {
            if (el.getAttribute('data-prerender-path') !== view) el.remove();
          },
        });

      // Title, description, canonical et Open Graph propres a la vue, poses
      // dans le HTML servi. Le script du bundle refait le meme travail apres
      // rendu ; ici c'est pour les clients qui n'executent pas JS.
      if (page) {
        rw = rw
          .on('title', {
            element(el) { el.setInnerContent(page.title); },
          })
          .on('meta[name="description"]', {
            element(el) { el.setAttribute('content', page.description); },
          })
          .on('link[rel="canonical"]', {
            element(el) { el.setAttribute('href', canonical); },
          })
          .on('meta[property="og:title"]', {
            element(el) { el.setAttribute('content', page.ogTitle); },
          })
          .on('meta[property="og:description"]', {
            element(el) { el.setAttribute('content', page.ogDesc); },
          })
          .on('meta[property="og:url"]', {
            element(el) { el.setAttribute('content', canonical); },
          });
      }

      out = rw.transform(out);
    }

    // 3. Le domaine de preview *.workers.dev ne doit pas etre indexe
    if (host.endsWith('.workers.dev')) {
      out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // 4. Cache : /assets/ porte un UUID dans son nom, donc immuable.
    // /photos/, /uploads/ et les logos ne changent jamais non plus, mais leur
    // nom est stable : cache long sans immutable, pour rester remplacables.
    if (path.startsWith('/assets/')) {
      out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/^\/(photos|uploads)\//.test(path) || /^\/logo-eoma(-light)?\.png$/.test(path) || path === '/favicon.ico') {
      out.headers.set('Cache-Control', 'public, max-age=2592000');
    } else if (!isAsset) {
      out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    return out;
  },
};
