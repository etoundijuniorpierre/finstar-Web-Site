#!/usr/bin/env node

const baseUrl = (process.env.DIRECTUS_URL || 'http://84.247.169.140:8056').replace(/\/$/, '');
const email = process.env.DIRECTUS_EMAIL;
const password = process.env.DIRECTUS_PASSWORD;
const apply = process.argv.includes('--apply');

if (!email || !password) throw new Error('DIRECTUS_EMAIL et DIRECTUS_PASSWORD sont requis.');

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload.data;
}

const session = await request('/auth/login', {
  method: 'POST', body: JSON.stringify({ email, password })
});
const headers = { Authorization: `Bearer ${session.access_token}` };

const stageFr = {
  title: 'Stage', quantity: null, gender: 'H/F', location: 'Présentiel - Cameroun - Stage',
  description_poste: "FINSTAR-CM accueille des stagiaires académiques et professionnels. Le stage académique dure au maximum 3 mois et s'articule autour d'un thème suivi pendant toute la période. Le stage professionnel dure 3 mois et peut être renouvelé une fois. Dans les deux cas, la finalité est la production d'un rapport validé par l'entreprise.",
  missions_poste: [
    "Réaliser les travaux liés au thème défini par l'établissement ou par la Direction de FINSTAR-CM dans le cadre d'un stage académique",
    "Participer aux activités du service d'affectation — informatique, commercial, conformité, comptabilité ou autre — dans le cadre d'un stage professionnel",
    'Contribuer à la promotion des produits et services FINSTAR-CM',
    "Participer, sous encadrement, aux actions d'ouverture de comptes et d'accompagnement des clients",
    'Respecter les procédures internes, la confidentialité et les consignes du responsable de stage',
    "Préparer un rapport de stage soumis à la validation de l'entreprise"
  ],
  description: {
    diplomes_requis: "Étudiant(e), apprenant(e) ou jeune diplômé(e). Le niveau et la filière doivent être cohérents avec le thème du stage académique ou le service demandé pour le stage professionnel.",
    aptitudes_personnelles: "Rigueur, sens de l'organisation, discrétion, capacité d'apprentissage, esprit d'équipe, aisance relationnelle et intérêt pour les activités de microfinance.",
    constitution_du_dossier: "Demande de stage ; CNI ; recommandation si disponible ; CV ; document de l'école de mise en stage si disponible."
  },
  apply_link: 'Postulez maintenant'
};

const stageEn = {
  title: 'Internship', quantity: null, gender: 'M/F', location: 'On-site - Cameroon - Internship',
  description_poste: 'FINSTAR-CM welcomes academic and professional interns. Academic internships last up to 3 months and follow a defined topic throughout the placement. Professional internships last 3 months and may be renewed once. Both paths conclude with a report validated by the company.',
  missions_poste: [
    'Carry out work related to the topic defined by the school or FINSTAR-CM Management for an academic internship',
    'Support the assigned department — IT, sales, compliance, accounting, or another department — for a professional internship',
    'Contribute to the promotion of FINSTAR-CM products and services',
    'Participate, under supervision, in account-opening and customer-support activities',
    'Comply with internal procedures, confidentiality requirements, and supervisor instructions',
    'Prepare an internship report for company validation'
  ],
  description: {
    diplomes_requis: 'Student, learner, or recent graduate. The level and field of study should match the academic topic or the department requested for a professional internship.',
    aptitudes_personnelles: 'Rigor, organization, discretion, learning ability, teamwork, interpersonal skills, and interest in microfinance activities.',
    constitution_du_dossier: 'Internship application ; national identity card ; recommendation if available ; CV ; school internship letter if available.'
  },
  apply_link: 'Apply Now'
};

function updateFrench(items) {
  const retained = items.filter(item => item.title !== 'Commerciaux' && item.title !== 'Stage');
  return [...retained.map(item => {
    if (item.title === "Agents d'encadrement") {
      return { ...item, description_poste: item.description_poste.replace(/\s*Le recrutement se fait sur concours uniquement\.?$/i, '') };
    }
    if (item.title === 'Collectrices') {
      return { ...item, description: { ...item.description, constitution_du_dossier: 'Un avaliste ; caution de 100 000 FCFA ; CV ; demande ; CNI ; plan de localisation.' } };
    }
    return item;
  }), stageFr];
}

function updateEnglish(items) {
  const retained = items.filter(item => item.title !== 'Sales Representatives' && item.title !== 'Internship');
  return [...retained.map(item => {
    if (item.title === 'Supervisors') {
      return { ...item, description_poste: item.description_poste.replace(/\s*Recruitment is exclusively through a competitive examination\.?$/i, '') };
    }
    if (item.title === 'Collection Officers') {
      return { ...item, description: { ...item.description, constitution_du_dossier: 'One avalist (guarantor) ; security deposit of 100,000 FCFA ; CV ; application letter ; national identity card ; location map.' } };
    }
    return item;
  }), stageEn];
}

const section = await request('/items/Pages_sections/13?fields=Pages_sections_id,table_data', { headers });
const translations = await request('/items/Pages_sections_translations?filter[Pages_sections_Pages_sections_id][_eq]=13&fields=id,languages_code,table_data', { headers });
const baseItems = typeof section.table_data === 'string' ? JSON.parse(section.table_data) : section.table_data;
const baseUpdated = updateFrench(baseItems);

console.log(`Carrière Directus : ${baseItems.length} offres avant, ${baseUpdated.length} après.`);
console.log(`Mode : ${apply ? 'application' : 'simulation'}.`);

if (apply) {
  await request('/items/Pages_sections/13', { method: 'PATCH', headers, body: JSON.stringify({ table_data: JSON.stringify(baseUpdated, null, 2) }) });
  for (const translation of translations) {
    const items = typeof translation.table_data === 'string' ? JSON.parse(translation.table_data) : translation.table_data;
    const updated = translation.languages_code === 'en-US' ? updateEnglish(items) : updateFrench(items);
    await request(`/items/Pages_sections_translations/${translation.id}`, { method: 'PATCH', headers, body: JSON.stringify({ table_data: updated }) });
  }
  console.log('Mise à jour Directus terminée.');
}
