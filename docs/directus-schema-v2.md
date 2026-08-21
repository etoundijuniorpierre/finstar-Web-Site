# Schéma Directus v2 — cible

> Statut : **gelé** pour construction sur staging.
> Périmètre dérivé de [`reports/migration-keep-manifest.json`](../reports/migration-keep-manifest.json),
> produit par `npm run audit:directus` (lecture seule).

## Règle

**Ne garder que ce que le site rend aujourd'hui, images comprises.**

La v2 est une **instance neuve**. On n'émet aucun `DELETE` sur l'instance actuelle :
elle reste, avec le backup, la source de secours. Toute décision d'exclusion est
donc réversible tant que l'ancienne instance existe.

## Principes

1. **Le schéma est du code** — snapshot versionné, jamais modifié à la main en prod.
2. **Aucun ID numérique codé en dur.** Les PK changent d'une instance à l'autre.
   On identifie par **singleton** ou par **clé stable** (`key` / `slug`).
3. **Le texte traduisible ne vit que dans `_translations`.** Plus de doublon
   racine/traduction (c'est ce qui a fait croire que Directus « ne mettait pas à jour »).
4. **`snake_case`** partout, collections et champs.
5. **Vraies contraintes FK** sur les relations (l'audit a trouvé 11 jonctions pendantes).
6. **Pas de blob JSON générique** là où une collection convient.

---

## Collections cibles

### Singletons

| Collection | Champs | Traduit |
|---|---|---|
| `site_settings` | `site_name`, `site_logo` (file), `main_navigation` (json), `footer_text`, `footer_address`, `footer_email`, `social_links` (json), `site_description` | ✅ |
| `home_page` | `hero_headline`, `hero_subheadline`, `hero_image` (file), `hero_cta_label`, `hero_cta_link`, `stats_headline`, `testimonials_headline` | ✅ |
| `services_page` | `intro_headline`, `intro_subheadline`, `intro_image` (file), `credit_headline`, `credit_headline_2` | ✅ |
| `careers_page` | `intro_headline`, `intro_subheadline`, `intro_headline_2`, `intro_body`, `intro_image` (file) | ✅ |
| `about_page` | `headline`, `subheadline`, `image` (file) | ✅ |
| `contact_settings` | `headline`, `headline_2`, `emails` (json[]), `phone_numbers` (json[]), `whatsapp`, `backgrounds` (M2M files) | ✅ |
| `cta_banner` | `headline`, `subheadline`, `cta_link` | ✅ |

> `cta_banner` remplace les 3 sections `call_to_action` (about/careers/contact).
> Le bandeau est identique sur tout le site ; le dupliquer par page a d'ailleurs
> créé un trou : `homepage` et `services` n'en avaient aucun et affichaient celui
> d'une autre page.

### Collections

| Collection | Champs | Traduit |
|---|---|---|
| `visions` | `sort`, `text`, `image` (file) | ✅ |
| `stats` | `sort`, `value` (**integer**), `label`, `show_plus` (**boolean**) | ✅ |
| `testimonials` | `sort`, `quote`, `author_name`, `author_title`, `author_image` (file) | ✅ |
| `credit_products` | `sort`, `key` (slug stable), `name`, `image` (file), `headline` | ✅ |
| `product_items` | `product` (**M2O** → `credit_products`), `sort`, `name`, `image` (file), `description`, `opening_minimum`, `eligibility`, `documents`, `benefits` | ✅ |
| `credit_categories` | `sort`, `category`, `interest_rates` (json[]), `requirements` (json[]) | ✅ |
| `loan_process` | `sort`, `title`, `steps` (json : `[{ step, details[] }]`) | ✅ |
| `about_blocks` | `sort`, `kind` (**enum** `mission\|vision\|values\|partners`), `title`, `body`, `values` (json[]) | ✅ |
| `partners` | `sort`, `name`, `logo` (file), `url` | — |
| `agencies` | `sort`, `name`, `city` | ✅ |
| `job_offers` | `sort`, `key`, `title`, `description`, `diplomas` (json[]), `mission`, `skills` (json[]), `tasks` (json[]), `remuneration`, `dossier` (json[]) | ✅ |
| `account_types` | `sort`, `key`, `legacy_id`, `min_amount`, `account_name`, `description`, `full_description` | ✅ |
| `account_opening_guides` | `sort`, `key`, `account_ids`, `opening_fee`, `opening_minimum`, `label`, `tagline`, `best_for`, `use_cases`, `documents`, `benefits`, `practical_note` | ✅ |
| `languages` | `code`, `name`, `direction` | — |

**Total de la cible étendue : 7 singletons + collections éditoriales et fonctionnelles du lot** (+ leurs `_translations`). Les deux collections de comptes ont été ajoutées après constat que ces blocs étaient désormais rendus par le frontend.

---

## Mapping ancien → cible

| Source actuelle | Cible |
|---|---|
| section **#2** `hero_banner` (homepage) | `home_page.hero_*` |
| section **#5** `statistics informations` + M2M `Statistics` | `home_page.stats_headline` + `stats` |
| section **#6** `testimonials` + M2M `Testimonials` | `home_page.testimonials_headline` + `testimonials` |
| M2M `Pages_vision` | `visions` |
| section **#8** (services intro) | `services_page.intro_*` |
| section **#11** `headline` / `headlines2` | `services_page.credit_headline` / `credit_headline_2` |
| section **#11** `subheadline2` (JSON `LoanProcess[]`, champ polymorphe) | `loan_process` |
| section **#11** `table_data` (chaîne JSON, clé **`'interest rate'` avec un espace**) | `credit_categories` (clés normalisées) |
| `Product` + `Product_items` + `items` | `credit_products` + `product_items` (M2O) |
| section **#12** (careers intro) | `careers_page.intro_*` |
| section **#13** `table_data` (JSON offres) | `job_offers` |
| section **#15** `table_data` (`contact_info` / `agencies`) + galerie | `contact_settings` + `agencies` |
| section **#17** `headline`/`subheadline`/`image` | `about_page` |
| section **#17** `table_data` (blob mission/vision/values/partners) | `about_blocks` |
| section **#18** `image_gallery` (logos partenaires) | `partners.logo` |
| sections **#7 / #14 / #16** `call_to_action` | `cta_banner` (singleton) |
| `global_settings` | `site_settings` |

### Transformations notables

- **`Statistics.value`** contient parfois un `%` (le front faisait `parseInt(value.replace('%',''))`).
  → `value` devient un **entier**, le suffixe `+` devient le booléen **`show_plus`**
  (le front le devinait par regex sur le `label` : `/client|customer|agenc|agency/`).
- **`table_data`** (chaînes JSON `JSON.parse()`-ées à l'exécution) → **vraies lignes**.
  La clé `'interest rate'` (avec espace) devient `interest_rates`.
- **`subheadline2`** typé `string | LoanProcess[]` → collection `loan_process` typée.
- **Identification** : `sectionById(8/9/10/11/12/13/15/17/18)` disparaît. Chaque page
  lit son **singleton**, chaque liste lit sa **collection**.

---

## Exclus de la v2

### Collections
| Collection | Motif |
|---|---|
| `Pages_sections_Account_types` | Jonction legacy remplacée par `account_types` et `account_opening_guides`, car le bloc de comparaison des comptes est désormais rendu. |
| `Contact_form_data` | Legacy. Les soumissions vont dans **Supabase**. Contient de la **PII** → export chiffré avant mise hors service. |
| `JobDemandForm` | Idem (candidatures). |

### Champs
`Pages_sections.document` · `Pages_sections.subheadline3` · `Pages_sections.links-aj0yns`
(artefact d'UI auto-nommé) · `Statistics.value1` · `global_settings.Finsite_icon` ·
`global_settings.Footer_logo` — **aucun n'est lu par un service**.

### Sections
| # | Page | Motif |
|---|---|---|
| 1 | (aucune) | résidu non rattaché |
| 4 | homepage | `differents accounts type` — jamais rendue |
| 9 | services | `differents accounts type` — jamais rendue |
| 10 | services | `text_block` (ouverture de compte) — jamais rendue |

### Fichiers
- **58 conservés** (ceux réellement affichés).
- **25 orphelins frontend** (référencés mais jamais rendus) — surtout les `Icon`/`Hover_image`
  d'`Account_types`, `Finsite_icon`, et les visuels des sections `call_to_action`
  (le bandeau affiche des étoiles statiques de `/assets/stars/`).
- **65 orphelins base** (référencés par rien) — dépôts accidentels :
  `ChatGPT Image Nov 18, 2025….png`, `pngwing.com (2).png`,
  `ifpaf2023_exemple_cahier_des_charges.pdf`, etc.

### Intégrité
**11 lignes pendantes** dans `Pages_sections_files` (`section = null`, ids 5,6,7,8,26–32).
Non reprises. Empêchées en v2 par une contrainte FK réelle.

---

## Ordre d'exécution

1. **Backup complet** (dump + `uploads/` intégral + `schema snapshot`) et **test de restauration**.
2. **Export chiffré** de `Contact_form_data` / `JobDemandForm` (PII).
3. Staging isolé → application du schéma v2.
4. Migration guidée par le manifeste (idempotente).
5. Frontend sur branche `feat/schema-v2` + `environment.staging.ts`.
6. Validation, puis bascule manuelle.

L'ancienne instance n'est mise hors service qu'**après** validation, et jamais avant
que le backup ait été restauré avec succès au moins une fois.
