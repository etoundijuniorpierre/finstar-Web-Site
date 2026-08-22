import { buildConfig } from './environment.build';
import { Environment } from './environment.model';

export const environment: Environment = {
  apiUrl: 'http://84.247.169.140:8056',
  browserApiUrl: '/directus',
  siteUrl: 'https://finstar-cm.com',
  cloudinaryCloudName: 'dqkgvvhxe',
  emailjs: buildConfig.emailjs,
  goatCounterCode: 'team48',
};
