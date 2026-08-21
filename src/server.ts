import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { getContext } from '@netlify/angular-runtime/app-engine.js';
import { handleServerRoutes } from './server-api';

const angularAppEngine = new AngularAppEngine();

/**
 * Point d'entrée du rendu serveur.
 *
 * Les routes applicatives — administration, avis, formulaires, relais Directus —
 * sont traitées avant le rendu : c'est ici qu'elles vivent désormais, l'hébergeur
 * exécutant ce gestionnaire au format Web standard plutôt qu'un serveur Express.
 */
export async function netlifyAppEngineHandler(request: Request): Promise<Response> {
  const handled = await handleServerRoutes(request);
  if (handled) return handled;

  const context = getContext();
  const result = await angularAppEngine.handle(request, context);
  return result || new Response('Not found', { status: 404 });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(netlifyAppEngineHandler);
