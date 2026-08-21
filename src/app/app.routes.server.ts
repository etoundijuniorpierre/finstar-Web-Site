import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { localizedPaths } from '../prerender-routes';

/**
 * Les pages publiques sont identiques pour tous les visiteurs et peuvent être
 * pré-rendues avec le contenu Directus disponible au build. L'admin reste côté
 * client ; ses données protégées proviennent exclusivement des API Express.
 */
export const serverRoutes: ServerRoute[] = [
  { path: ':lang/admin', renderMode: RenderMode.Client },
  { path: '', renderMode: RenderMode.Prerender },
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return ['fr-FR', 'en-US'].map((lang) => ({ lang }));
    },
  },
  {
    path: ':lang/**',
    renderMode: RenderMode.Prerender,
    // En développement, les routes qui ne sont pas encore dans le cache de
    // prerender doivent rester rendues par le serveur : le contenu Directus v2
    // est privé et son jeton ne doit jamais être envoyé au navigateur.
    fallback: PrerenderFallback.Server,
    async getPrerenderParams() {
      return ['fr-FR', 'en-US'].flatMap((lang) =>
        localizedPaths.map((path) => ({ lang, '**': path })),
      );
    },
  },
  { path: '**', renderMode: RenderMode.Client },
];
