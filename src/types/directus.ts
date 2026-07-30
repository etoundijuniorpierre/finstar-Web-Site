type DirectusJsonObject = Record<string, unknown>;

type Pages_sections_Statistics = {
  id: number;
  Pages_sections_Pages_sections_id: number;
  Statistics_statistics_id: number;
};

type Pages_sections_Testimonials = {
  id: number;
  Pages_sections_Pages_sections_id: number;
  Testimonials_testimonials_id: number;
};

type Pages_sections_files = {
  id: number;
  Pages_sections_Pages_sections_id: number;
  directus_files_id: string;
};

type Account_types = {
  account_id: number;
  account_name: string;
  Description: string;
  min_amount: number;
  Account_maintenance: number;
  Icon: string | null;
  Hover_image: string | null;
  full_description: string;
  translations?: Account_types_translations[];
};

type Account_types_translations = {
  id: number;
  Account_types_account_id: number;
  languages_code: string;
  account_name: string;
  Description: string;
  full_description: string;
};


type Pages = {
  page_id: number;
  status: 'published' | 'draft' | 'archived';
  creation_date: string;
  last_update: string;
  Slug: string;
  title: string;
  seo_title: string;
  seo_description: string | null;
  template: 'default' | 'landing_page' | null;
};

type Pages_sections = {
  Pages_sections_id: number;
  user_created: string | null;
  date_created: string;
  user_updated: string | null;
  date_updated: string;
  Type: string;
  image: string | null;
  images: (string | null)[] | null;
  document: string | null;
  call_to_action: string | null;
  call_to_action_link: string | null;
  headline: string | null;
  headlines2: string | null;
  subheadline: string | null;
  subheadline2?: string | LoanProcess[] | null;
  subheadline3: string | null;
  body_content: string | null;
  video_url: string | null;
  table_data: string | DirectusJsonObject | null;
  translations?: Pages_sections_translations[];
};

type Pages_sections_translations = {
  id: number;
  Pages_sections_Pages_sections_id: number;
  languages_code: string;
  headline: string | null;
  subheadline: string | null;
  headlines2: string | null;
  body_content: string | null;
  call_to_action: string | null;
  call_to_action_link: string | null;
  subheadline2: string | LoanProcess[] | null;
  table_data: string | DirectusJsonObject | null;
};

type Statistics = {
  statistics_id: number;
  sort: number | null;
  created_by: string | null;
  creation_date: string;
  updated_by: string | null;
  update_on: string;
  value: number | null;
  value1: number | null;
  label: string | null;
  translations?: Statistics_translations[];
};

type Statistics_translations = {
  id: number;
  Statistics_statistics_id: number;
  languages_code: string;
  value: number | null;
  label: string | null;
};

type Testimonials = {
  testimonials_id: number;
  user: string | null;
  creation_date: string;
  Quote: string;
  author_name: string;
  author_title: string;
  author_image: string | null;
  translations?: Testimonials_translations[];
};

type Testimonials_translations = {
  id: number;
  Testimonials_testimonials_id: number;
  languages_code: string;
  author_title: string | null;
  Quote: string | null;
};

type global_settings = {
  settings_id: number;
  Finsite_icon: string | null;
  site_logo: string | null;
  site_name: string;
  main_navigation: Array<{ label: string; link: string }> | null;
  Footer_Text: string | null;
  Footer_logo: string | null;
  footer_social_links: Array<{ platform: string; url: string }> | null;
  footer_address: string | null;
  footer_email: string | null;
  site_description: string | null;
  translations?: global_settings_translations[];
};

type global_settings_translations = {
  id: number;
  global_settings_settings_id: number;
  languages_code: string;
  site_name: string | null;
  main_navigation: Array<{ label: string; link: string }> | null;
  Footer_text: string | null;
  footer_social_links: Array<{ platform: string; url: string }> | null;
  footer_address: string | null;
  footer_email: string | null;
  site_description: string | null;
};

type languages = {
  code: string;
  name: string | null;
  direction: 'ltr' | 'rtl';
};

type Pages_Pages_sections = {
  id: number;
  Pages_page_id: number;
  Pages_sections_Pages_sections_id: number;
};

type Pages_sections_Account_types = {
  id: number;
  Pages_sections_Pages_sections_id: number;
  Account_types_account_id: number;
};

type Pages_Product = {
  id: number;
  Pages_page_id: number;
  Product_id: number;
};

type Pages_vision = {
  id: number;
  Pages_page_id: number;
  vision_id: number;
};

type Pages_sections_Product = {
  id: number;
  Pages_sections_Pages_sections_id: number;
  Product_id: number;
};

type Product = {
  id: number;
  sort: number | null;
  user_created: string | null;
  date_created: string;
  user_updated: string | null;
  date_updated: string;
  Name: string;
  product_image: string | null;
  headlines: string;
  Table_data: any | null;
  translations?: Product_translations[];
};

type Product_translations = {
  id: number;
  Product_id: number;
  languages_code: string;
  Name: string | null;
  Headlines: string | null;
  Table_data: any | null;
};

type Product_items = {
  id: number;
  Product_id: number;
  items_id: number;
};

type items = {
  id: number;
  status: 'published' | 'draft' | 'archived';
  sort: number | null;
  user_created: string | null;
  date_created: string;
  user_updated: string | null;
  date_updated: string;
  name: string;
  image: string | null;
  description: string | null;
  translations?: items_translations[];
};

type items_translations = {
  id: number;
  items_id: number;
  languages_code: string;
  name: string | null;
  description: string | null;
};

type vision = {
  id: number;
  sort: number | null;
  user_created: string | null;
  date_created: string;
  user_updated: string | null;
  date_updated: string;
  vision: string;
  image: string | null;
  translations?: vision_translations[];
};

type vision_translations = {
  id: number;
  vision_id: number;
  languages_code: string;
  vision: string | null;
};

type Candidatures = {
  id: number;
};

type Contacts = {
  id: number;
};

type Schema = {
  Candidatures: Candidatures[];
  Contacts: Contacts[];
  Account_types: Account_types[];
  Account_types_translations: Account_types_translations[];
  Pages: Pages[];
  Pages_Pages_sections: Pages_Pages_sections[];
  Pages_Product: Pages_Product[];
  Pages_vision: Pages_vision[];
  Pages_sections: Pages_sections[];
  Pages_sections_Account_types: Pages_sections_Account_types[];
  Pages_sections_Product: Pages_sections_Product[];
  Pages_sections_Statistics: Pages_sections_Statistics[];
  Pages_sections_Testimonials: Pages_sections_Testimonials[];
  Pages_sections_files: Pages_sections_files[];
  Pages_sections_translations: Pages_sections_translations[];
  Product: Product[];
  Product_items: Product_items[];
  Product_translations: Product_translations[];
  Statistics: Statistics[];
  Statistics_translations: Statistics_translations[];
  Testimonials: Testimonials[];
  Testimonials_translations: Testimonials_translations[];
  global_settings: global_settings;
  global_settings_translations: global_settings_translations[];
  items: items[];
  items_translations: items_translations[];
  languages: languages[];
  vision: vision[];
  vision_translations: vision_translations[];
}

export type {
  Schema,
  Account_types as AccountType,
  Account_types_translations as AccountTypeTranslation,
  Pages as Page,
  Pages_Pages_sections as PageSectionsRelation,
  Pages_Product as PageProductRelation,
  Pages_vision as PageVisionRelation,
  Pages_sections as PageSection,
  Pages_sections_translations as PageSectionTranslation,
  Pages_sections_Account_types as PageSectionAccountTypes,
  Pages_sections_Product as PageSectionProduct,
  Pages_sections_Statistics as PageSectionStatistics,
  Pages_sections_Testimonials as PageSectionTestimonials,
  Pages_sections_files as PageSectionFiles,
  Product,
  Product_items as ProductItems,
  Product_translations as ProductTranslation,
  Statistics as Statistic,
  Statistics_translations as StatisticTranslation,
  Testimonials as Testimonial,
  Testimonials_translations as TestimonialTranslation,
  global_settings as GlobalSettings,
  global_settings_translations as GlobalSettingsTranslation,
  items as Items,
  items_translations as ItemsTranslation,
  languages as Language,
  vision as Vision,
  vision_translations as VisionTranslation,
};

export type PageWithSections = Pages & {
  sections: EnrichedPageSection[];
  visions?: vision[];
  products?: Product[];
};

export type EnrichedPageSection = Pages_sections & {
  statistics?: Statistics[];
  testimonials?: Testimonials[];
  account_types?: Account_types[];
  product_data?: Product[];
};

export type HTMLContent = string;
export type MarkdownContent = string;

export interface LoanProcessStep {
  step: string;
  details?: string[];
}

export interface LoanProcess {
  title: string;
  steps: LoanProcessStep[];
}
