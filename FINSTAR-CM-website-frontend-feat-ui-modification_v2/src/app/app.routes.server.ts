import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Les pages publiques dépendent de Directus. Un rendu SSR à la requête évite
 * les chargements CMS concurrents du pré-rendu de build, tout en conservant
 * un HTML complet pour les moteurs de recherche et les aperçus sociaux.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Server },
];
