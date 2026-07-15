#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://84.247.169.140:8056').replace(/\/$/, '');
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;
const APPLY = process.argv.includes('--apply');

if (!DIRECTUS_EMAIL || !DIRECTUS_PASSWORD) {
  console.error('DIRECTUS_EMAIL et DIRECTUS_PASSWORD sont requis.');
  process.exit(1);
}

async function request(path, options = {}) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} → HTTP ${res.status}: ${text}`);
  }

  return body?.data ?? body;
}

async function login() {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: DIRECTUS_EMAIL, password: DIRECTUS_PASSWORD }),
  });
  return data.access_token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

const aboutFrTable = {
  data: [
    {
      Catégorie: 'Notre Mission',
      Contenu:
        'Notre mission est d’améliorer les conditions de vie des communautés marginalisées en leur offrant des produits financiers adaptés à leurs besoins. Elle se décline en trois axes : lutter contre la pauvreté grâce à des solutions d’épargne adaptées, accompagner les TPE et PME vers une croissance durable, et développer des solutions d’accompagnement ajustées aux réalités de chaque secteur d’activité.',
    },
    {
      Catégorie: 'Notre Vision',
      Contenu:
        'FINSTAR rêve d’un Cameroun où chaque citoyen, chaque communauté et chaque entrepreneur est autonome, valorisé et épanoui.',
    },
    {
      Catégorie: 'Nos Valeurs',
      Contenu: {
        'Valeurs Clés': ['Intégrité', 'Rigueur', 'Passion', 'Responsabilité', 'Collaboration'],
        Description:
          'Ces valeurs guident notre culture interne, notre qualité de service et la relation de confiance que nous construisons avec nos clients.',
      },
    },
    {
      Catégorie: 'Nos convictions',
      Contenu: [
        'L’homme est le premier acteur de son développement',
        'La création de richesse est accessible avec discipline, épargne et accompagnement',
        'L’épargne est le premier pas vers l’autonomie financière',
        'Le travail, la persévérance et la confiance en soi soutiennent la création de richesse',
        'Le savoir et le savoir-faire sont des socles essentiels du développement durable',
      ],
    },
    {
      Catégorie: 'Nos Partenaires',
      Contenu: ['Afriland First Bank', 'Ecobank', 'Saar Assurance'],
    },
  ],
};

const aboutEnTable = {
  data: [
    {
      Catégorie: 'Our Mission',
      Contenu:
        'Our mission is to improve the living conditions of underserved communities by offering financial products tailored to their needs. It is structured around three pillars: fighting poverty through adapted savings solutions, supporting VSEs and SMEs toward sustainable growth, and developing support solutions aligned with the realities of each business sector.',
    },
    {
      Catégorie: 'Our Vision',
      Contenu:
        'FINSTAR dreams of a Cameroon where every citizen, community and entrepreneur is autonomous, valued and fulfilled.',
    },
    {
      Catégorie: 'Our Values',
      Contenu: {
        'Valeurs Clés': ['Integrity', 'Rigor', 'Passion', 'Responsibility', 'Collaboration'],
        Description:
          'These values guide our internal culture, our service quality and the trusted relationship we build with our clients.',
      },
    },
    {
      Catégorie: 'Our convictions',
      Contenu: [
        'People are the first actors of their own development',
        'Wealth creation is accessible through discipline, savings and support',
        'Saving is the first step toward financial autonomy',
        'Work, perseverance and self-confidence support wealth creation',
        'Knowledge and know-how are essential foundations for sustainable development',
      ],
    },
    {
      Catégorie: 'Our Partners',
      Contenu: ['Afriland First Bank', 'Ecobank', 'Saar Assurance'],
    },
  ],
};

const sectionUpdates = [
  {
    collection: 'Pages_sections',
    id: 2,
    fields: {
      subheadline:
        'Épargnez en sécurité, financez vos projets et faites grandir votre activité avec une microfinance agréée, proche de vous.',
    },
  },
  {
    collection: 'Pages_sections',
    id: 6,
    fields: { headline: 'Ils partagent leur expérience' },
  },
  ...[7, 14, 16].map((id) => ({
    collection: 'Pages_sections',
    id,
    fields: { headline: 'Rejoignez plus de 4 000 clients accompagnés' },
  })),
  {
    collection: 'Pages_sections',
    id: 8,
    fields: {
      headline: 'Découvrez nos produits et services financiers adaptés à vos besoins',
      subheadline:
        'FINSTAR-CM SA propose des solutions d’épargne, de crédit, d’assurance, de transfert, de mobile money et de partenariat pour accompagner les particuliers, entrepreneurs, TPE et PME.',
    },
  },
  {
    collection: 'Pages_sections',
    id: 9,
    fields: {
      headline: 'Conçu pour vous aider à épargner et à investir',
      subheadline:
        'Des solutions pensées pour sécuriser vos revenus, préparer vos projets et faire progresser votre activité avec un accompagnement adapté.',
    },
  },
  {
    collection: 'Pages_sections',
    id: 11,
    fields: {
      headline: 'Préparez votre demande de crédit',
    },
  },
  {
    collection: 'Pages_sections',
    id: 15,
    fields: {
      headline: 'Contactez-nous !',
      table_data: JSON.stringify({
        contact_info: {
          emails: ['contact@finstar-cm.com'],
          phone_numbers: ['+237 620 724 796'],
          customer_service: { whatsapp: '+237 620 724 796' },
        },
        social_media: { title: 'Suivez-nous', platforms: ['Facebook', 'LinkedIn'] },
        agencies: {
          title: 'Nos agences',
          locations: [
            'Yaoundé – Nkolbisson (en face d’Afriland First Bank)',
            'Douala – Bessengue (Feu rouge Bessengue)',
            'Bafoussam (vers la mairie rurale – Sapeurs-pompiers)',
            'Bayangam (ancien péage)',
            'Bangangté – Descente Marché B',
          ],
        },
      }, null, 2),
    },
  },
  {
    collection: 'Pages_sections',
    id: 17,
    fields: {
      headline: 'Qui sommes-nous ?',
      table_data: JSON.stringify(aboutFrTable, null, 2),
    },
  },
];

const sectionTranslationUpdates = [
  {
    collection: 'Pages_sections_translations',
    id: 1,
    fields: {
      subheadline:
        'Épargnez en sécurité, financez vos projets et faites grandir votre activité avec une microfinance agréée, proche de vous.',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 2,
    fields: {
      subheadline:
        'Save securely, finance your plans and grow your business with a licensed microfinance institution close to you.',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 7,
    fields: { headline: 'Ils partagent leur expérience' },
  },
  {
    collection: 'Pages_sections_translations',
    id: 8,
    fields: { headline: 'They share their experience' },
  },
  ...[9, 23, 27].map((id) => ({
    collection: 'Pages_sections_translations',
    id,
    fields: { headline: 'Rejoignez plus de 4 000 clients accompagnés' },
  })),
  ...[10, 24, 28].map((id) => ({
    collection: 'Pages_sections_translations',
    id,
    fields: { headline: 'Join more than 4,000 clients supported' },
  })),
  {
    collection: 'Pages_sections_translations',
    id: 11,
    fields: {
      headline: 'Découvrez nos produits et services financiers adaptés à vos besoins',
      subheadline:
        'FINSTAR-CM SA propose des solutions d’épargne, de crédit, d’assurance, de transfert, de mobile money et de partenariat pour accompagner les particuliers, entrepreneurs, TPE et PME.',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 12,
    fields: {
      headline: 'Discover financial products and services tailored to your needs',
      subheadline:
        'FINSTAR-CM SA offers savings, credit, insurance, transfer, mobile money and partnership solutions to support individuals, entrepreneurs, VSEs and SMEs.',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 13,
    fields: {
      headline: 'Conçu pour vous aider à épargner et à investir',
      subheadline:
        'Des solutions pensées pour sécuriser vos revenus, préparer vos projets et faire progresser votre activité avec un accompagnement adapté.',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 14,
    fields: {
      headline: 'Designed to help you save and invest',
      subheadline:
        'Solutions designed to secure your income, prepare your projects and grow your activity with tailored support.',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 17,
    fields: {
      headline: 'Préparez votre demande de crédit',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 18,
    fields: {
      headline: 'Prepare your credit application',
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 25,
    fields: {
      headline: 'Contactez-nous !',
      table_data: {
        contact_info: {
          emails: ['contact@finstar-cm.com'],
          phone_numbers: ['+237 620 724 796'],
          customer_service: { whatsapp: '+237 620 724 796' },
        },
        social_media: { title: 'Suivez-nous', platforms: ['Facebook', 'LinkedIn'] },
        agencies: {
          title: 'Nos agences',
          locations: [
            'Yaoundé – Nkolbisson (en face d’Afriland First Bank)',
            'Douala – Bessengue (Feu rouge Bessengue)',
            'Bafoussam (vers la mairie rurale – Sapeurs-pompiers)',
            'Bayangam (ancien péage)',
            'Bangangté – Descente Marché B',
          ],
        },
      },
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 26,
    fields: {
      headline: 'Contact us!',
      table_data: {
        contact_info: {
          emails: ['contact@finstar-cm.com'],
          phone_numbers: ['+237 620 724 796'],
          customer_service: { whatsapp: '+237 620 724 796' },
        },
        social_media: { title: 'Follow us', platforms: ['Facebook', 'LinkedIn'] },
        agencies: {
          title: 'Our branches',
          locations: [
            'Yaoundé – Nkolbisson (in front of Afriland First Bank)',
            'Douala – Bessengue (Bessengue Traffic Light)',
            'Bafoussam (near the rural council – Firefighters Station)',
            'Bayangam (former toll area)',
            'Bangangté – Downhill from Market B',
          ],
        },
      },
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 29,
    fields: {
      headline: 'Qui sommes-nous ?',
      table_data: aboutFrTable,
    },
  },
  {
    collection: 'Pages_sections_translations',
    id: 30,
    fields: {
      headline: 'Who are we?',
      table_data: aboutEnTable,
    },
  },
];

const testimonialUpdates = [
  {
    collection: 'Testimonials',
    id: 3,
    fields: {
      Quote:
        'En tant que bayam-sellam, la collecte de mes recettes me prenait beaucoup de temps. Depuis FINCOLLECT, tout est plus simple et sécurisé : je gagne du temps et je reçois une confirmation par SMS après chaque collecte.',
      author_title: 'Commerçante',
    },
  },
  {
    collection: 'Testimonials',
    id: 5,
    fields: {
      Quote:
        'Grâce à l’épargne journalière, je dépose chaque soir ce que j’ai gagné dans la journée. Je n’ai plus besoin de garder l’argent sur moi : c’est sécurisé, pratique, et je vois mes économies grandir progressivement.',
    },
  },
  {
    collection: 'Testimonials',
    id: 41,
    fields: {
      Quote:
        'Avant, je gérais tout mon argent en liquide. Avec FINSAVE, mes dépôts se font directement depuis mon restaurant. C’est rapide, je ne perds plus de temps, et mes fonds sont en sécurité. FINSTAR a vraiment simplifié ma vie.',
    },
  },
];

const testimonialTranslationUpdates = [
  {
    collection: 'Testimonials_translations',
    id: 5,
    fields: {
      Quote:
        'En tant que bayam-sellam, la collecte de mes recettes me prenait beaucoup de temps. Depuis FINCOLLECT, tout est plus simple et sécurisé : je gagne du temps et je reçois une confirmation par SMS après chaque collecte.',
      author_title: 'Commerçante',
    },
  },
  {
    collection: 'Testimonials_translations',
    id: 6,
    fields: {
      Quote:
        'As a market vendor, collecting my daily revenue used to take a lot of time. Since FINCOLLECT, everything is simpler and more secure: I save time and receive an SMS confirmation after each collection.',
      author_title: 'Market vendor',
    },
  },
  {
    collection: 'Testimonials_translations',
    id: 10,
    fields: {
      Quote:
        'Grâce à l’épargne journalière, je dépose chaque soir ce que j’ai gagné dans la journée. Je n’ai plus besoin de garder l’argent sur moi : c’est sécurisé, pratique, et je vois mes économies grandir progressivement.',
    },
  },
  {
    collection: 'Testimonials_translations',
    id: 49,
    fields: {
      Quote:
        'Avant, je gérais tout mon argent en liquide. Avec FINSAVE, mes dépôts se font directement depuis mon restaurant. C’est rapide, je ne perds plus de temps, et mes fonds sont en sécurité. FINSTAR a vraiment simplifié ma vie.',
    },
  },
];

const productUpdates = [
  {
    collection: 'Product',
    id: 4,
    fields: {
      headlines:
        'Grâce à nos partenaires, envoyez et recevez des fonds rapidement depuis nos agences via Western Union, MoneyGram et Ria.',
    },
  },
  {
    collection: 'Product_translations',
    id: 6,
    fields: {
      Headlines:
        'Grâce à nos partenaires, envoyez et recevez des fonds rapidement depuis nos agences via Western Union, MoneyGram et Ria.',
    },
  },
];

const itemUpdates = [
  {
    collection: 'items',
    id: 1,
    fields: {
      name: 'Compte épargne',
      description:
        'À travers ses comptes d’épargne, FINSTAR vous aide à faire progresser votre épargne en sécurité, tout en conservant des solutions adaptées à vos projets et imprévus. Une base simple et structurée pour renforcer votre stabilité financière.',
    },
  },
  {
    collection: 'items_translations',
    id: 1,
    fields: {
      name: 'Compte épargne',
      description:
        'À travers ses comptes d’épargne, FINSTAR vous aide à faire progresser votre épargne en sécurité, tout en conservant des solutions adaptées à vos projets et imprévus. Une base simple et structurée pour renforcer votre stabilité financière.',
    },
  },
  {
    collection: 'items',
    id: 2,
    fields: {
      description:
        'Le compte courant facilite la gestion de vos dépenses quotidiennes. Il offre un accès rapide à vos fonds, des opérations fluides et un meilleur suivi de vos transactions. Une solution pratique, flexible et sécurisée.',
    },
  },
  {
    collection: 'items_translations',
    id: 4,
    fields: {
      description:
        'Le compte courant facilite la gestion de vos dépenses quotidiennes. Il offre un accès rapide à vos fonds, des opérations fluides et un meilleur suivi de vos transactions. Une solution pratique, flexible et sécurisée.',
    },
  },
  {
    collection: 'items',
    id: 3,
    fields: {
      description:
        'Le compte bloqué permet de sécuriser une somme pendant une période définie et de préparer un projet avec davantage de discipline. Les conditions et la rémunération applicables sont précisées dans le contrat du produit.',
    },
  },
  {
    collection: 'items_translations',
    id: 34,
    fields: {
      description:
        'Le compte bloqué permet de sécuriser une somme pendant une période définie et de préparer un projet avec davantage de discipline. Les conditions et la rémunération applicables sont précisées dans le contrat du produit.',
    },
  },
  {
    collection: 'items_translations',
    id: 33,
    fields: {
      description:
        'A blocked account helps secure a sum for a defined period and prepare a project with greater discipline. Applicable terms and remuneration are specified in the product agreement.',
    },
  },
  {
    collection: 'items',
    id: 5,
    fields: {
      name: 'Dépôt à terme',
      description:
        'Placez une somme pour une durée déterminée et bénéficiez des conditions prévues à l’échéance. Le capital, la durée et la rémunération sont définis contractuellement afin de préparer vos projets avec visibilité.',
    },
  },
  {
    collection: 'items_translations',
    id: 36,
    fields: {
      name: 'Dépôt à terme',
      description:
        'Placez une somme pour une durée déterminée et bénéficiez des conditions prévues à l’échéance. Le capital, la durée et la rémunération sont définis contractuellement afin de préparer vos projets avec visibilité.',
    },
  },
  {
    collection: 'items_translations',
    id: 6,
    fields: {
      description:
        'Place funds for a defined term under conditions agreed at maturity. The capital, duration and remuneration are specified contractually so you can plan your projects with clarity.',
    },
  },
  {
    collection: 'items',
    id: 15,
    fields: { name: 'Paiement scolarité' },
  },
  {
    collection: 'items',
    id: 17,
    fields: {
      description:
        'FINALERT vous permet de recevoir automatiquement par SMS des notifications sur vos opérations et des informations importantes de FINSTAR. Simple et pratique, il vous donne un accès rapide aux informations essentielles de votre compte.',
    },
  },
  {
    collection: 'items_translations',
    id: 27,
    fields: {
      description:
        'FINALERT vous permet de recevoir automatiquement par SMS des notifications sur vos opérations et des informations importantes de FINSTAR. Simple et pratique, il vous donne un accès rapide aux informations essentielles de votre compte.',
    },
  },
];

const settingsUpdates = [
  {
    collection: 'global_settings',
    id: 1,
    singleton: true,
    fields: {
      footer_address: 'Direction générale : Bastos, Yaoundé',
      site_description:
        'FINSTAR-CM SA est un établissement de microfinance de deuxième catégorie agréé, au service de l’épargne, du crédit et de l’inclusion financière au Cameroun.',
    },
  },
  {
    collection: 'global_settings_translations',
    id: 2,
    fields: {
      footer_address: 'Direction générale : Bastos, Yaoundé',
      site_description:
        'FINSTAR-CM SA est un établissement de microfinance de deuxième catégorie agréé, au service de l’épargne, du crédit et de l’inclusion financière au Cameroun.',
    },
  },
  {
    collection: 'global_settings_translations',
    id: 3,
    fields: {
      footer_address: 'Head office: Bastos, Yaoundé',
      site_description:
        'FINSTAR-CM SA is a licensed second-tier microfinance institution serving savings, credit and financial inclusion in Cameroon.',
    },
  },
];

const updates = [
  ...sectionUpdates,
  ...sectionTranslationUpdates,
  ...testimonialUpdates,
  ...testimonialTranslationUpdates,
  ...productUpdates,
  ...itemUpdates,
  ...settingsUpdates,
];

async function backupRecords(token) {
  const grouped = new Map();
  for (const update of updates) {
    if (!grouped.has(update.collection)) grouped.set(update.collection, new Set());
    grouped.get(update.collection).add(update.id);
  }

  const backup = {};
  for (const [collection, ids] of grouped) {
    backup[collection] = [];
    for (const id of ids) {
      backup[collection].push(await request(`/items/${collection}/${id}`, { headers: auth(token) }));
    }
  }

  const outDir = join(process.cwd(), 'reports');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = join(outDir, `directus-content-backup-${stamp}.json`);
  await writeFile(outFile, JSON.stringify({ source: DIRECTUS_URL, createdAt: new Date().toISOString(), backup }, null, 2), 'utf8');
  return outFile;
}

async function main() {
  const token = await login();
  const backupFile = await backupRecords(token);
  console.log(`Backup écrit : ${backupFile}`);
  console.log(`${APPLY ? 'Application' : 'Dry-run'} : ${updates.length} mises à jour ciblées.`);

  for (const update of updates) {
    const fieldNames = Object.keys(update.fields).join(', ');
    console.log(`- ${update.collection}#${update.id}: ${fieldNames}`);
    if (APPLY) {
      const path = update.singleton ? `/items/${update.collection}` : `/items/${update.collection}/${update.id}`;
      await request(path, {
        method: 'PATCH',
        headers: auth(token),
        body: JSON.stringify(update.fields),
      });
    }
  }

  console.log(APPLY ? 'Mises à jour Directus appliquées.' : 'Aucune écriture effectuée.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
