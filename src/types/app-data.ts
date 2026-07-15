import { GlobalSettings, AccountType, Page, Statistic, Testimonial, PageSection, PageSectionsRelation, PageSectionStatistics, PageSectionTestimonials, PageSectionAccountTypes, PageSectionFiles, AccountTypeTranslation, StatisticTranslation, TestimonialTranslation, GlobalSettingsTranslation, PageSectionTranslation,  Product, ProductTranslation, Items, ItemsTranslation, Vision, VisionTranslation, PageProductRelation, PageVisionRelation, PageSectionProduct, ProductItems } from './directus';

export interface AppData {
  globalSettings: GlobalSettings | null;
  accountTypes: AccountType[];
  pages: Page[];
  statistics: Statistic[];
  testimonials: Testimonial[];
  sections: PageSection[];
  pageSectionsRelations: PageSectionsRelation[];
  sectionStatisticsRelations: PageSectionStatistics[];
  sectionTestimonialsRelations: PageSectionTestimonials[];
  sectionAccountTypesRelations: PageSectionAccountTypes[];
  sectionFilesRelations: PageSectionFiles[],
  accountTypeTranslations: AccountTypeTranslation[];
  statisticTranslations: StatisticTranslation[];
  testimonialTranslations: TestimonialTranslation[];
  globalSettingsTranslations: GlobalSettingsTranslation[];
  pageSectionTranslations: PageSectionTranslation[];
  products: Product[];
  productTranslations: ProductTranslation[];
  items: Items[];
  itemsTranslations: ItemsTranslation[];
  vision: Vision[];
  visionTranslations: VisionTranslation[];
  pageProductRelations: PageProductRelation[];
  pageVisionRelations: PageVisionRelation[];
  pageSectionProductRelations: PageSectionProduct[];
  productItemsRelations: ProductItems[];
}