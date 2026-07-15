# Architecture analytics de la page Admin

## Choix retenu

La page `/:lang/admin` est préparée pour GoatCounter, un outil d’analytics open source, léger et sans identifiant personnel. Le service hébergé est gratuit pour un usage public raisonnable et l’API permet de construire un tableau de bord personnalisé.

- Aucun rapport Looker Studio tiers n’est désormais embarqué.
- Le site GoatCounter FINSTAR-CM utilise le code `team48`.
- Les changements de route Angular sont envoyés à GoatCounter comme pages vues.
- Les CTA et l’envoi réussi du formulaire contact sont envoyés comme événements GoatCounter.
- Une clé API GoatCounter ne doit jamais être placée dans le bundle navigateur : elle devra rester côté serveur si l’API est utilisée pour alimenter des cartes internes.

## Mise en production

1. Le compte GoatCounter et le site `team48` doivent être actifs pour `finstar-cm.com`.
2. Le code public `team48` est déjà renseigné dans `environment.prod.ts` sous `goatCounterCode`.
3. Déployer puis vérifier les pages vues dans le tableau GoatCounter.
4. Si l’on veut rapatrier les statistiques dans les cartes Admin, créer une clé API et la stocker uniquement dans les variables du serveur SSR.

## Indicateurs recommandés

1. Audience : visiteurs, pages vues, sessions et appareils.
2. Acquisition : recherche, réseaux sociaux, accès direct et campagnes.
3. Contenu : pages services, produits, contacts et parcours les plus consultés.
4. Conversion : clics CTA, clics WhatsApp/email et demandes de contact.

## FAQ

GoatCounter convient aux statistiques de trafic et aux événements de navigation. Les volumes de candidatures et de contacts restent des données opérationnelles issues de la base applicative et ne doivent pas être mélangés aux statistiques visiteurs.

## Sécurité

La route `/admin` est `noindex`, mais `noindex` n’est pas une authentification. Une protection serveur doit être ajoutée avant d’y exposer des données internes.
