import { makeStateKey } from '@angular/core';
import { AccountType, AccountTypeTranslation, GlobalSettings, GlobalSettingsTranslation, Page, PageSection, PageSectionAccountTypes, PageSectionFiles, PageSectionsRelation, PageSectionStatistics, PageSectionTestimonials, PageSectionTranslation, Statistic, StatisticTranslation, Testimonial, TestimonialTranslation, Product, ProductTranslation, Items, ItemsTranslation, Vision, VisionTranslation, PageProductRelation, PageVisionRelation, PageSectionProduct } from '../types/directus';

export const GLOBAL_SETTINGS_KEY = makeStateKey<GlobalSettings>('global_settings');
export const ACCOUNT_TYPES_KEY = makeStateKey<AccountType[]>('account_types');
export const PAGES_KEY = makeStateKey<Page[]>('pages');
export const PAGE_SECTIONS_KEY = makeStateKey<PageSection[]>('page_sections');
export const STATISTICS_KEY = makeStateKey<Statistic[]>('statistics');
export const TESTIMONIALS_KEY = makeStateKey<Testimonial[]>('testimonials');
export const PAGE_SECTIONS_RELATIONS_KEY = makeStateKey<PageSectionsRelation[]>('page_sections_relations');
export const PAGE_SECTIONS_ACCOUNT_TYPES_KEY =
makeStateKey<PageSectionAccountTypes[]>('page_section_account_types');
export const PAGE_SECTIONS_STATISTICS_KEY =
makeStateKey<PageSectionStatistics[]>('page_sections_statistics');

export const PAGE_SECTIONS_TESTIMONIALS_KEY =
makeStateKey<PageSectionTestimonials[]>('page_section_testimonials');

export const PAGE_SECTIONS_FILES_KEY = makeStateKey<PageSectionFiles[]>('section_files_relations');
export const ACCOUNT_TYPE_TRANSLATIONS_KEY = makeStateKey<AccountTypeTranslation[]>('account_type_translations');
export const STATISTIC_TRANSLATIONS_KEY = makeStateKey<StatisticTranslation[]>('statistic_translations');
export const TESTIMONIAL_TRANSLATIONS_KEY = makeStateKey<TestimonialTranslation[]>('testimonial_translations');
export const GLOBAL_SETTINGS_TRANSLATIONS_KEY = makeStateKey<GlobalSettingsTranslation[]>('global_settings_translations');
export const PAGE_SECTION_TRANSLATIONS_KEY = makeStateKey<PageSectionTranslation[]>('page_section_translations');
export const PRODUCTS_KEY = makeStateKey<Product[]>('products');
export const PRODUCT_TRANSLATIONS_KEY = makeStateKey<ProductTranslation[]>('product_translations');
export const ITEMS_KEY = makeStateKey<Items[]>('items');
export const ITEMS_TRANSLATIONS_KEY = makeStateKey<ItemsTranslation[]>('items_translations');
export const VISION_KEY = makeStateKey<Vision[]>('vision');
export const VISION_TRANSLATIONS_KEY = makeStateKey<VisionTranslation[]>('vision_translations');
export const PAGE_PRODUCT_RELATIONS_KEY = makeStateKey<PageProductRelation[]>('page_product_relations');
export const PAGE_VISION_RELATIONS_KEY = makeStateKey<PageVisionRelation[]>('page_vision_relations');
export const PAGE_SECTION_PRODUCT_RELATIONS_KEY = makeStateKey<PageSectionProduct[]>('page_section_product_relations');
export const PRODUCT_ITEMS_RELATIONS_KEY = makeStateKey<any[]>('product_items_relations');