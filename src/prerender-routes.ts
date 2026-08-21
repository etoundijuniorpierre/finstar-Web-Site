export const localizedPaths = [
  'home',
  'about',
  'services',
  'career',
  'career/candidature',
  'contacts',
  'agencies',
  'faq',
];

export default [
  '/',
  ...['fr-FR', 'en-US'].flatMap((language) => [
    `/${language}`,
    ...localizedPaths.map((path) => `/${language}/${path}`),
  ]),
];
