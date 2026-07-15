/**
 * Contrat unique partagé par environment.ts (dev) et environment.prod.ts (prod).
 * Toute clé ajoutée ici doit être renseignée dans LES DEUX fichiers, sinon
 * la compilation échoue — ce qui évite les divergences silencieuses entre
 * les environnements (ex. bloc `supabase` absent en dev, clés emailjs mal nommées).
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

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  contactsBucket: string;
  candidaturesBucket: string;
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
  supabase: SupabaseConfig;
  googleAnalyticsId?: string;
  lookerStudioEmbedUrl?: string;
  /** Code public du site GoatCounter, sans la partie .goatcounter.com. */
  goatCounterCode?: string;
  /**
   * Token API GoatCounter. ⚠️ Présent dans le bundle navigateur (environment.ts
   * est bundlé côté client) : ne l'utiliser QUE pour des appels effectués via le
   * serveur SSR, et le régénérer s'il fuite.
   */
  goatCounterToken?: string;
  directusToken?: string;
  /**
   * Si vrai, /api/metrics/traffic sert des données de démonstration réalistes
   * (le site n'a pas encore de trafic réel). À passer à false au lancement :
   * l'endpoint basculera alors sur les vraies données GoatCounter.
   */
  goatCounterMockData?: boolean;
}
