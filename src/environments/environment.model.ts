/**
 * Contrat du fichier `environment.ts`, désormais unique pour tous les
 * déploiements. Ce qui doit varier d'un environnement à l'autre n'a pas sa
 * place ici : les réglages EmailJS viennent de `.env` via
 * `environment.build.ts`, et les secrets serveur ne quittent jamais le
 * processus Node.
 */
export interface EmailJsConfig {
  publicKey: string;
  serviceId: string;
  /** Template EmailJS pour la notification interne (équipe Finstar). */
  templateIdEmail: string;
  templateIdReply: string;
  /** Template EmailJS pour l'accusé de réception envoyé à l'utilisateur. */
  contactEmail: string;
  careerEmail: string;
}

export interface Environment {
  /** URL Directus utilisée côté serveur. */
  apiUrl: string;
  /** URL publique utilisée par le navigateur, généralement un proxy même origine. */
  browserApiUrl: string;
  siteUrl: string;
  cloudinaryCloudName: string;
  emailjs: EmailJsConfig;
  googleAnalyticsId?: string;
  lookerStudioEmbedUrl?: string;
  goatCounterCode?: string;
}
