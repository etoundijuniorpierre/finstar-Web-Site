export interface SupabaseCandidature {
  id?: number;
  date_created?: string
  Nom: string;
  Prenom: string;
  Poste_souhaite: string;
  Age: number;
  Ville_de_residence: string;
  Tel: string;
  Email: string;
  Dernier_diplome: string;
  Situation_matrimoniale: string;
  Nombre_d_enfants: string;
  a_deja_travaille: string;
  dernier_emploi?: string | null;
  Nouvel_emploi_jours_et_horaires: string[];
  Travail_hors_de_la_ville: string;
  Condition_de_travail_hors_de_la_ville?: string | null;
  Salaire_souhaite: string;
  Methodes_de_remuneration: string;
  Villes_de_preference: string[];
  CV_Url?: string | null;
  Fiche_Url?: string | null;
  Type_candidature?: string | null;
  Type_stage?: string | null;
  Duree_stage?: string | null;
  Theme_stage?: string | null;
  Etablissement?: string | null;
  Service_stage?: string | null;
  Avaliste?: string | null;
  Avaliste_nom?: string | null;
  Avaliste_prenom?: string | null;
  Avaliste_telephone?: string | null;
  Avaliste_adresse?: string | null;
  Avaliste_relation?: string | null;
  Caution_acceptee?: boolean | null;
}

export interface SupabaseContact {
  id?: number;
  Nom: string;
  Prenom: string;
  Email: string;
  Telephone: string;
  Sujet: string;
  Message: string;
  Fichier_Url?: string | null;
  created_at?: string;
}
