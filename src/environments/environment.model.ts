/**
 * Contrat unique partagé par environment.ts (dev) et environment.prod.ts (prod).
 * Toute clé ajoutée ici doit être renseignée dans LES DEUX fichiers, sinon
 * la compilation échoue — ce qui évite les divergences silencieuses entre
 * les environnements (ex. clés emailjs mal nommées ou URL Directus oubliée).
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
  production: boolean;
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
  goatCounterMockData?: boolean;
}
