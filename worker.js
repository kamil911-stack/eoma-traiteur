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

const ROUTES = new Set([
  '/', '/entreprises', '/mariages', '/engagements',
  '/la-cheffe', '/galerie', '/contact',
]);

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

    // 2. Vrai 404 sur les URLs inconnues (hors fichiers, geres par ASSETS)
    if (!isAsset && !ROUTES.has(path.replace(/\/+$/, '') || '/')) {
      return new Response(PAGE_404, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // Les routes SPA n'ont pas de fichier : on sert index.html
    const assetReq = (!isAsset && path !== '/')
      ? new Request(new URL('/', url).toString(), request)
      : request;

    const res = await env.ASSETS.fetch(assetReq);
    let out = new Response(res.body, res);

    // Le pre-rendu embarque les 7 vues dans le meme index.html. Un crawler qui
    // n'execute pas JS (GPTBot, PerplexityBot, Bingbot sur une partie de ses
    // crawls) verrait donc les 7 sections et 7 H1 sur chaque URL. Le filtrage
    // cote client ne les aide pas : on retire ici les sections des autres vues.
    if (!isAsset && res.headers.get('content-type')?.includes('text/html')) {
      const view = path.replace(/\/+$/, '') || '/';
      out = new HTMLRewriter()
        .on('#__prerender_seo section[data-prerender-path]', {
          element(el) {
            if (el.getAttribute('data-prerender-path') !== view) el.remove();
          },
        })
        .transform(out);
    }

    // 3. Le domaine de preview *.workers.dev ne doit pas etre indexe
    if (host.endsWith('.workers.dev')) {
      out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // 4. Cache : /assets/ porte un UUID dans son nom, donc immuable
    if (path.startsWith('/assets/')) {
      out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (!isAsset) {
      out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    return out;
  },
};
