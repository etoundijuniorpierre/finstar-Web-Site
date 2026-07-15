import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiUrl: 'http://84.247.169.140:8056',
  browserApiUrl: '/directus',
  siteUrl: 'https://finstar-cm.com',
  cloudinaryCloudName: 'dqkgvvhxe',
  emailjs: {
    publicKey: 'JgxEJa4o02eYwDdM3',
    serviceId: 'service_i29l54j',
    templateIdEmail: 'template_atag9do',
    templateIdReply: 'template_jlxqruc',
    contactEmail: 'teamkf48inscription@gmail.com',
    careerEmail: 'teamkf48inscription@gmail.com'
  },
  supabase: {
    url: 'https://orontrbloeemieohnxhd.supabase.co/rest/v1',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yb250cmJsb2VlbWllb2hueGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDk2OTcsImV4cCI6MjA5OTUyNTY5N30.cgZ5GIgpH0JE-SAqmSfhpbRS18vEGuxBR9XwhxKQSXM',
    contactsBucket: 'Contacts',
    candidaturesBucket: 'Candidatures'
  },
  goatCounterCode: 'team48',
  goatCounterToken: 'euvtpfi3sd0qxppcfz5aevupfkf8fvmx77hegydlus73c3zd',
  directusToken: 'CwfXkGtZTrLb3Vp6--zZccqWEib5AhaU',
  goatCounterMockData: true
};
