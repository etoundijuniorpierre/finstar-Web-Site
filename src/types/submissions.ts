/** Charges utiles des formulaires publics, telles qu'attendues par les routes SSR. */

export interface ContactSubmission {
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  sujet?: string;
  message: string;
  /** Identifiant du fichier Directus renvoyé par `/api/uploads`. */
  fichier?: string | null;
}

export interface JobApplication {
  nom: string;
  prenom: string;
  poste_souhaite?: string;
  age?: number;
  ville_residence?: string;
  telephone?: string;
  email?: string;
  dernier_diplome?: string;
  situation_matrimoniale?: string;
  nombre_enfants?: string;
  a_deja_travaille?: string;
  dernier_emploi?: string | null;
  disponibilites?: string[];
  travail_hors_ville?: string;
  condition_hors_ville?: string | null;
  salaire_souhaite?: string;
  mode_remuneration?: string;
  villes_preference?: string[];
  /** Identifiants de fichiers Directus. */
  cv?: string | null;
  fiche_recapitulative?: string | null;
  documents?: Record<string, string>;
  type_candidature?: string | null;
  type_stage?: string | null;
  duree_stage?: string | null;
  theme_stage?: string | null;
  etablissement?: string | null;
  service_stage?: string | null;
  avaliste?: string | null;
  avaliste_nom?: string | null;
  avaliste_prenom?: string | null;
  avaliste_telephone?: string | null;
  avaliste_adresse?: string | null;
  avaliste_relation?: string | null;
  caution_acceptee?: boolean | null;
}
