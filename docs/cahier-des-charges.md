# Cahier des charges — Application HACCP pour la restauration

> Nom de code : **HACCP Express** (provisoire)
> Document destiné à Claude Code. Développer **lot par lot** (section 13), avec tests à chaque lot.
> Les décisions prises en cours de développement sont consignées en fin de document (section 15).

-----

## 0. Vision produit

Application SaaS (19–29 €/mois) qui digitalise le **Plan de Maîtrise Sanitaire (PMS)** des restaurants indépendants (pizzerias, brasseries, snacks, traiteurs, food trucks).

**Promesse :** « 5 minutes par jour, et vous êtes prêt pour le contrôle DDPP. »

### Principes non négociables

1. **5 min/jour max** d'utilisation pour l'équipe.
2. **Onboarding autonome en 15 min**, sans intervention humaine.
3. **1 à 2 taps** par tâche simple. Valeurs pré-remplies, gros boutons (≥ 56 px), clavier numérique géant.
4. **Fonctionne hors ligne** (tablette en cuisine, Wi-Fi instable).
5. **Registres infalsifiables** : aucun enregistrement n'est modifiable ni supprimable ; une correction = un nouvel enregistrement avec motif.
6. **Un seul écran central : « Aujourd'hui »**.
7. Interface en français, ton simple, zéro jargon inutile.

-----

## 1. Stack technique

|Couche           |Choix                                                                                                 |
|-----------------|------------------------------------------------------------------------------------------------------|
|Backend          |Django 5 + Django REST Framework, Python 3.12                                                         |
|Base de données  |PostgreSQL                                                                                            |
|Frontend         |React + Vite + TypeScript, Tailwind + shadcn/ui                                                       |
|Mode app         |**PWA** installable (service worker, manifest) — pas d'app store en V1                                |
|Hors ligne       |IndexedDB (Dexie.js) + file d'attente de synchronisation                                              |
|Fichiers / photos|Stockage S3-compatible (Cloudflare R2 ou équivalent), compression côté client (max 1600 px, JPEG 75 %)|
|PDF              |WeasyPrint (templates HTML → PDF)                                                                     |
|Paiement         |Stripe Billing (abonnements, essai 14 jours sans CB, portail client)                                  |
|Emails           |Brevo ou Postmark (transactionnels)                                                                   |
|Notifications    |Web Push (VAPID) + email                                                                              |
|Tâches planifiées|Celery + Redis, ou django-q2 (plus simple)                                                            |
|Hébergement      |Railway, région **UE**                                                                                |
|Tests            |pytest + pytest-django (backend), Vitest (frontend), Playwright (parcours critiques)                  |

Architecture **multi-tenant** par `Organization` (isolation au niveau des lignes : chaque requête filtrée par organisation, testée).

-----

## 2. Rôles et authentification

|Rôle                     |Accès                                               |Authentification                                 |
|-------------------------|----------------------------------------------------|-------------------------------------------------|
|**Gérant (Owner)**       |Tout : paramétrage, équipe, abonnement, rapports    |Email + mot de passe (+ lien magique optionnel)  |
|**Responsable (Manager)**|Paramétrage opérationnel, rapports, pas l'abonnement|Email + mot de passe                             |
|**Employé (Staff)**      |Saisie des tâches uniquement                        |**Code PIN à 4 chiffres** sur un appareil appairé|

### Appareil appairé (mode cuisine)

- Le gérant appaire une tablette/un téléphone à un établissement via un **code à 6 caractères** valable 10 min.
- L'appareil reste connecté à l'établissement (token longue durée, révocable).
- À chaque saisie, l'employé tape son PIN → l'enregistrement porte son identité.
- Le PIN est mémorisé 5 min (configurable) pour enchaîner plusieurs tâches.
- PIN stocké hashé. 5 erreurs → blocage 2 min.

-----

## 3. Modèle de données

Tous les modèles : `id` UUID (généré côté client pour les enregistrements terrain, pour le hors ligne), `created_at`, `updated_at`.
Tous les **enregistrements terrain** (relevés, réceptions…) : `establishment`, `staff_member`, `device`, `recorded_at_client`, `received_at_server`, `is_late` (bool), `corrects` (FK nullable vers l'enregistrement corrigé) + `correction_reason`.

### 3.1 Structure

- **Organization** : nom, SIRET, adresse de facturation, `stripe_customer_id`.
- **Establishment** : organization, nom, adresse, type (`pizzeria`, `brasserie`, `snack`, `traiteur`, `food_truck`, `autre`), n° de déclaration DDPP (optionnel), fuseau horaire (défaut Europe/Paris), horaires de service (pour planifier les tâches), `is_active`.
- **Subscription** : organization, plan (`essentiel`, `pro`), statut Stripe, fin d'essai.
- **User** (gérant/responsable) : email, nom, rôle, organizations.
- **StaffMember** : establishment, prénom, initiale du nom, PIN hashé, `is_active`.
- **Device** : establishment, nom, token, dernière synchro, `is_revoked`.

### 3.2 Équipements et référentiels

- **ColdUnit** (enceinte froide) : nom, type (`positif`, `negatif`, `chambre_froide_pos`, `chambre_froide_neg`, `vitrine`, `saladette`), `temp_min`, `temp_max`, `is_active`.
- **HotHoldingUnit** (maintien chaud, V1 optionnel) : nom, `temp_min` (défaut 63).
- **Fryer** : nom, capacité (L).
- **Supplier** : nom, catégories livrées (`frais`, `surgeles`, `sec`, `boissons`, `fruits_legumes`), contact.
- **CleaningZone** : nom (ex. « Plan de travail pizza »), catégorie (`surface`, `equipement`, `sol`, `froid`, `sanitaire`, `stockage`).
- **CleaningProduct** : nom, usage (détergent, désinfectant, détergent-désinfectant), dilution, temps de contact.
- **CleaningTask** : zone, produit, méthode (texte court), fréquence.
- **ProductCategory** (pour DLC secondaires) : nom, durée après ouverture par défaut (jours).
- **CorrectiveActionOption** : type de contrôle, libellé (liste préremplie, éditable).

### 3.3 Planification

- **TaskTemplate** : establishment, type (`temperature`, `cleaning`, `oil_check`, `custom_check`), cible (FK générique : ColdUnit, CleaningTask, Fryer…), règle de récurrence (RRULE), fenêtre horaire (`window_start`, `window_end`), `is_active`.
- **TaskOccurrence** : template, date, fenêtre, statut (`todo`, `done`, `done_late`, `missed`), enregistrement associé (FK générique).

### 3.4 Registres (enregistrements terrain)

- **TemperatureReading** : cold_unit, valeur (°C, 1 décimale), `is_compliant`, non_conformity (FK nullable).
- **Reception** : supplier, n° BL (optionnel), photo BL (optionnelle), statut global (`accepted`, `partially_refused`, `refused`).
- **ReceptionCheck** : reception, catégorie, température relevée (nullable pour le sec), emballage OK (bool), DLC OK (bool), `is_compliant`, commentaire.
- **TraceabilityPhoto** : photo, catégorie produit, fournisseur (optionnel), date, note courte. Date d'archivage calculée.
- **SecondaryLabel** : nom produit, catégorie, date d'ouverture/fabrication, date limite calculée, imprimé (bool).
- **CoolingRecord** : produit, quantité (optionnel), début (heure + T°), fin (heure + T°), `is_compliant`.
- **ReheatingRecord** : produit, début (heure + T°), fin (heure + T°), `is_compliant`.
- **OilCheck** : fryer, méthode (`visuel`, `bandelette`, `testeur`), valeur % composés polaires (nullable), action (`ok`, `filtrage`, `changement`), `is_compliant`.
- **CleaningLog** : cleaning_task, statut (`fait`, `non_fait` + motif).
- **NonConformity** : source (FK générique), type, description, action corrective (option + texte libre), contrôle de suivi requis (bool), statut (`ouverte`, `traitee`), traitée par / le.

### 3.5 Documents PMS

- **PmsDocument** : establishment, type (`attestation_formation_hygiene`, `contrat_nuisibles`, `rapport_nuisibles`, `declaration_ddpp`, `tableau_allergenes`, `analyse_eau`, `fiche_technique_produit`, `plan_nettoyage_signe`, `autre`), fichier, date du document, date d'expiration (nullable), personne concernée (nullable, pour les attestations).

### 3.6 Audit

- **AuditLog** : qui, quoi, quand, avant/après (pour les actions de paramétrage). Lecture seule.

-----

## 4. Règles métier

> ⚠️ Toutes les valeurs par défaut ci-dessous sont **paramétrables par établissement** et doivent être **validées par un professionnel de l'hygiène** (consultant, GBPH restaurateur) avant mise en production. L'application est un outil d'aide : elle ne remplace pas le PMS ni la responsabilité de l'exploitant (mention dans les CGU et le rapport).

### 4.1 Seuils par défaut

|Contrôle              |Règle par défaut                                                       |
|----------------------|-----------------------------------------------------------------------|
|Froid positif         |0 °C à +4 °C                                                           |
|Froid négatif         |≤ −18 °C                                                               |
|Réception frais       |≤ +4 °C (alerte au-delà)                                               |
|Réception surgelés    |≤ −18 °C conforme ; entre −18 et −15 °C alerte ; > −15 °C refus suggéré|
|Refroidissement rapide|de +63 °C à +10 °C en **≤ 2 h**                                        |
|Remise en température |atteindre **≥ +63 °C en ≤ 1 h**                                        |
|Maintien chaud        |≥ +63 °C                                                               |
|Huile de friture      |composés polaires **≤ 25 %**                                           |

### 4.2 Génération des tâches

- Job quotidien à 00:05 (heure locale de l'établissement) : crée les `TaskOccurrence` du jour à partir des `TaskTemplate`.
- Par défaut : relevé températures **à l'ouverture et à la fermeture** de chaque enceinte.
- À la fin de la fenêtre, une tâche non faite passe en `missed` → **elle apparaît comme manquante dans le rapport** (jamais masquée).
- Une tâche faite après la fenêtre est acceptée et marquée `done_late`.

### 4.3 Non-conformités

- Toute valeur hors seuil → écran rouge → **action corrective obligatoire** (choix dans une liste + texte libre optionnel) avant de pouvoir valider.
- Pour les températures d'enceintes : proposer automatiquement un **contre-relevé dans 30 min** (tâche ajoutée à « Aujourd'hui »).
- Une NC crée une notification au gérant.

Listes d'actions correctives par défaut (exemples) :

- Enceinte froide : « Porte mal fermée, refermée », « Réglage thermostat », « Produits transférés dans une autre enceinte », « Produits jetés », « Technicien appelé ».
- Réception : « Produit refusé et rendu au livreur », « Fournisseur informé », « Accepté sous réserve ».
- Refroidissement : « Produit jeté », « Produit consommé immédiatement ».
- Huile : « Huile changée », « Huile filtrée ».

### 4.4 DLC secondaires

- Date limite = date d'ouverture + durée de la catégorie (par défaut 3 jours, paramétrable par catégorie).
- Ne jamais dépasser la DLC d'origine : champ optionnel « DLC fabricant » ; si renseignée, retenir la plus courte.

### 4.5 Refroidissement / remise en température

- Démarrage : saisie T° + heure (pré-remplie à maintenant) → **minuteur visible dans « Aujourd'hui »** + notification à l'échéance (2 h / 1 h).
- Clôture : saisie T° de fin → calcul automatique de conformité.

### 4.6 Immutabilité

- Pas de `UPDATE` ni `DELETE` sur les registres via l'API (tests dédiés).
- Correction = nouvel enregistrement avec `corrects` + `correction_reason` obligatoire. Le rapport affiche les deux.

### 4.7 Score de complétude

- Par période et par registre : `tâches faites (à l'heure + en retard) / tâches prévues`.
- Affiché en % sur le tableau de bord et dans le rapport DDPP. Code couleur : ≥ 95 % vert, 80–95 % orange, < 80 % rouge.

### 4.8 Conservation

- Registres : conservés pendant toute la durée de l'abonnement + 3 ans après résiliation (export possible), sauf demande de suppression.
- Photos de traçabilité : conservation par défaut 12 mois, paramétrable.

-----

## 5. Écrans

### 5.1 Onboarding (gérant, 15 min max, wizard 6 étapes)

1. **Établissement** : nom, adresse, type → charge le template correspondant (section 6).
2. **Horaires** : jours et horaires d'ouverture (pour planifier les relevés).
3. **Froid** : liste pré-remplie selon le type, à ajuster (ajouter/renommer/supprimer).
4. **Fournisseurs** : saisie rapide nom + catégories (passable, ajoutable plus tard).
5. **Nettoyage** : plan pré-rempli, cases à décocher.
6. **Équipe** : prénoms + PIN, puis appairage de la tablette (code affiché en grand).

Fin → écran « Vous êtes prêt » + lien vers « Aujourd'hui ». Barre de progression en haut, bouton « Passer » partout sauf étape 1.

### 5.2 « Aujourd'hui » (écran principal, mode cuisine)

- En-tête : date, nom de l'établissement, indicateur de synchro (vert/orange hors ligne).
- Sections repliables : **À faire maintenant** (fenêtre en cours), **Plus tard**, **Minuteurs en cours** (refroidissements), **Fait**.
- Chaque tâche = une carte avec gros bouton d'action.
- Raccourcis permanents en bas : **Réception**, **Photo traça**, **Étiquette DLC**, **Refroidissement**.

### 5.3 Relevé températures

- **Un seul écran pour toutes les enceintes** : liste, champ température avec clavier numérique géant (touches −, virgule), passage automatique à l'enceinte suivante.
- Bouton « Tout valider » en bas. Valeur hors seuil → passage en rouge + action corrective.

### 5.4 Réception

- Choix fournisseur (les plus fréquents en haut) → photo BL (optionnelle) → une ligne par catégorie livrée : température, emballage ✓/✗, DLC ✓/✗ → valider.

### 5.5 Photo traçabilité

- Ouvre directement l'appareil photo, mitraillage possible (plusieurs étiquettes), catégorie en un tap, validation.

### 5.6 Étiquette DLC secondaire

- Choix catégorie/produit (récents en haut) → date d'ouverture (défaut : maintenant) → affichage de la date limite en très grand → imprimer (plan Pro, imprimante Bluetooth/ESC-POS ou via la boîte de dialogue d'impression) ou « noté à la main ».

### 5.7 Refroidissement / Remise en température

- Démarrer (produit + T°) / Clôturer (T° fin). Minuteur visible.

### 5.8 Huiles

- Choix friteuse → méthode → valeur/état → action.

### 5.9 Nettoyage

- Liste des tâches du jour par zone, validation par tap, possibilité de « Tout valider pour cette zone ».

### 5.10 Non-conformités (gérant)

- Liste filtrable (ouvertes/traitées, type, période), détail, clôture.

### 5.11 Documents PMS (gérant)

- Liste par type avec statut (présent / manquant / expire bientôt / expiré), upload photo ou PDF.
- Checklist « Documents obligatoires » avec ce qui manque en évidence.

### 5.12 Historique (gérant)

- Par registre, filtrable par date, enceinte, employé.

### 5.13 Tableau de bord (gérant)

- Score de complétude 7 jours / 30 jours, NC ouvertes, documents à renouveler, tâches manquées récentes.

### 5.14 Rapport DDPP (gérant)

- Choix période (défaut : 3 derniers mois) → génération PDF → téléchargement / partage.

### 5.15 Paramètres (gérant)

- Établissement, enceintes, fournisseurs, nettoyage, catégories DLC, actions correctives, équipe, appareils, seuils, abonnement.

### Règles d'UX

- Zones tactiles ≥ 56 px, police ≥ 18 px en mode cuisine.
- Contraste élevé, utilisable avec des mains mouillées (pas de gestes complexes, pas de glisser).
- Aucune saisie de texte obligatoire en mode cuisine (sauf correction).
- Confirmation visuelle et sonore légère à chaque validation.

-----

## 6. Templates par type d'établissement

Chaque template préremplit : enceintes, zones et tâches de nettoyage, catégories DLC, fournisseurs types (catégories uniquement).

### Exemple : Pizzeria

- **Froid** : Frigo positif cuisine, Saladette garnitures, Chambre froide positive (si présente), Congélateur, Frigo boissons (sans relevé obligatoire, désactivable).
- **Nettoyage** :
  - Après chaque service : plan de travail pizza, saladette (bacs), plan de découpe, ustensiles, lave-mains.
  - Quotidien : sols cuisine, poubelles, pelles à pizza, trancheuse (si présente), pétrin.
  - Hebdomadaire : intérieur des frigos, filtres de hotte, four (sole/brossage selon type), étagères réserve.
  - Mensuel : chambre froide complète, murs, réserve sèche.
- **Catégories DLC** : mozzarella/fromages ouverts, charcuterie tranchée, légumes préparés, sauce tomate maison, pâtons, viandes cuites.

Templates à créer de la même façon : **brasserie / restaurant traditionnel**, **snack / fast-food**, **traiteur**, **food truck**, **autre** (minimal).

-----

## 7. Rapport DDPP (PDF)

Contenu, dans l'ordre :

1. **Page de garde** : établissement, adresse, n° déclaration, période, date de génération.
2. **Synthèse** : score de complétude global et par registre, nombre de NC (ouvertes/traitées), documents PMS présents/manquants.
3. **Documents PMS** : liste avec dates et validité (fichiers en annexe ZIP optionnelle).
4. **Registres** (un tableau par registre) : températures (par enceinte, par jour, matin/soir), réceptions, refroidissements, remises en température, huiles, nettoyage, DLC secondaires.
   - Tâches manquées affichées explicitement (« Non réalisé »).
   - Corrections affichées avec la valeur initiale et le motif.
5. **Non-conformités** : date, type, valeur, action corrective, auteur.
6. **Pied de page** : pagination, mention « Registre généré par HACCP Express — enregistrements horodatés et non modifiables ».

Export complémentaire : ZIP des photos de traçabilité de la période.

-----

## 8. Notifications

|Événement                                                    |Destinataire    |Canal                   |
|-------------------------------------------------------------|----------------|------------------------|
|Relevé non fait 1 h après la fin de fenêtre                  |Gérant          |Push                    |
|Non-conformité saisie                                        |Gérant          |Push                    |
|Fin de minuteur refroidissement / remise en T°               |Appareil cuisine|Push + alerte dans l'app|
|Document expirant dans 30 j (contrat nuisibles, attestation…)|Gérant          |Email                   |
|Récap hebdomadaire (score, NC, manques)                      |Gérant          |Email (lundi 8 h)       |
|Fin d'essai J−3 / échec de paiement                          |Gérant          |Email                   |

Toutes désactivables dans les paramètres.

-----

## 9. Abonnement

- **Essai 14 jours sans carte bancaire**, toutes fonctionnalités Pro.
- **Essentiel — 19 €/mois HT** par établissement : tous les registres, rapport DDPP, utilisateurs illimités.
- **Pro — 29 €/mois HT** par établissement : + impression d'étiquettes DLC, photos de traçabilité illimitées, export ZIP, récap hebdo détaillé.
- Remise annuelle : 2 mois offerts.
- Fin d'essai ou impayé → **lecture seule** (les données et le rapport restent accessibles : ne jamais bloquer l'accès aux registres en cas de contrôle).
- Gestion via le portail client Stripe. Webhooks Stripe testés.

-----

## 10. Hors ligne et synchronisation

- Toutes les saisies terrain fonctionnent hors ligne : stockage IndexedDB + file d'attente.
- UUID générés côté client → **endpoints idempotents** (un renvoi ne crée pas de doublon).
- Registres en ajout seul → pas de conflit de fusion.
- Référentiels (enceintes, tâches du jour, PIN hashés) mis en cache sur l'appareil à chaque synchro.
- Photos mises en file et envoyées dès que le réseau revient.
- Indicateur visible : « 3 enregistrements en attente de synchronisation ».
- Heure client et heure serveur toutes deux stockées ; écart > 10 min signalé dans l'audit.

-----

## 11. Sécurité et RGPD

- Hébergement et stockage en UE.
- Données personnelles minimales pour les employés (prénom + initiale).
- HTTPS partout, tokens d'appareil révocables, rate limiting sur le PIN et le login.
- Tests d'isolation multi-tenant obligatoires (un utilisateur ne voit jamais les données d'une autre organisation).
- Export complet des données à la demande (JSON + PDF) ; suppression de compte.
- CGU + politique de confidentialité + mention « outil d'aide » (cf. 4).

-----

## 12. Hors périmètre V1

- Tableau des allergènes par plat (V2).
- Vue multi-établissements consolidée (V2).
- Sondes de température connectées (V2).
- Plats témoins (restauration collective).
- Applications natives iOS/Android (la PWA suffit en V1).
- Saisie vocale.
- Génération automatique du PMS complet.

-----

## 13. Plan de développement par lots

Chaque lot : migrations, tests (backend + frontend), mise à jour de ce document si une décision change. **Ne pas passer au lot suivant tant que les critères d'acceptation ne sont pas verts.**

### Lot 0 — Socle

Projet Django + DRF + React/Vite/shadcn, PWA de base, Docker local, CI, déploiement Railway (staging), multi-tenant, auth gérant.
✅ Un gérant peut créer un compte et se connecter ; tests d'isolation tenant passent.

### Lot 1 — Structure et onboarding

Modèles 3.1–3.3, templates (section 6), wizard d'onboarding, équipe + PIN, appairage d'appareil.
✅ Un restaurant « pizzeria » est entièrement configuré en moins de 15 min ; une tablette est appairée et un employé s'identifie par PIN.

### Lot 2 — « Aujourd'hui », températures, nettoyage

Génération des tâches, écran « Aujourd'hui », relevé températures, nettoyage, non-conformités et actions correctives, contre-relevé.
✅ Un relevé complet de 5 enceintes prend moins de 60 s ; une valeur hors seuil impose une action corrective ; une tâche non faite passe en `missed`.

### Lot 3 — Mode hors ligne

IndexedDB, file d'attente, endpoints idempotents, indicateur de synchro.
✅ Saisies faites en mode avion synchronisées sans doublon au retour du réseau (test Playwright).

### Lot 4 — Réception, traçabilité, DLC secondaires

✅ Une réception avec photo BL et 3 catégories se fait en moins de 90 s ; une étiquette DLC se génère en 3 taps.

### Lot 5 — Refroidissement, remise en température, huiles

Minuteurs et notifications.
✅ Un refroidissement non clôturé à temps génère une alerte et une NC.

### Lot 6 — Documents PMS, historique, tableau de bord, rapport DDPP

✅ Le PDF d'une période de 3 mois se génère en moins de 30 s et affiche explicitement les tâches manquées et les corrections.

### Lot 7 — Abonnement, notifications email, mise en production

Stripe (essai, plans, webhooks, lecture seule), emails, récap hebdo, CGU, page d'accueil simple.
✅ Parcours complet essai → paiement → résiliation → lecture seule testé de bout en bout.

-----

## 14. Consignes pour Claude Code

- Lire ce document en entier avant de commencer ; travailler **un lot à la fois**.
- Proposer le plan technique du lot avant de coder, puis implémenter.
- Écrire les tests en même temps que le code ; ne jamais désactiver un test pour le faire passer.
- Respecter strictement : immutabilité des registres (4.6), isolation multi-tenant, idempotence des endpoints terrain.
- Données de démonstration : un script `seed_demo` crée une pizzeria fictive avec 3 mois d'historique réaliste (quelques NC et tâches manquées) pour tester le rapport.
- En cas d'ambiguïté réglementaire : ne pas inventer de règle, laisser la valeur paramétrable et la signaler dans un fichier `QUESTIONS.md`.

-----

## 15. Journal des décisions

### Lot 0 — Socle (réalisé)

- **Monorepo** `backend/` + `frontend/`. Une seule image Docker en production : Django sert le build Vite via WhiteNoise (routes non-API → `index.html`), ce qui simplifie Railway (un service web + PostgreSQL).
- **Auth gérant** : JWT (SimpleJWT) — accès 1 h, rafraîchissement 30 jours avec rotation — stocké côté client dans `localStorage` pour rester compatible avec le mode PWA hors ligne. Throttling `10/min` sur connexion et inscription.
- **Inscription** = création en une transaction de `User` + `Organization` + `Membership(owner)`. Mot de passe ≥ 10 caractères (validateurs Django).
- **Multi-tenant** : `Membership(user, organization, role ∈ {owner, manager})`. Mixin `OrganizationScopedMixin` (`apps/core/tenancy.py`) ; une ressource d'une autre organisation renvoie **404**, jamais 403. `IsOrganizationOwner` réserve la modification de l'organisation au gérant.
- **Modèle de base** `UUIDTimeStampedModel` (UUID v4 par défaut côté serveur ; les enregistrements terrain accepteront un UUID fourni par le client à partir du Lot 3).
- **Frontend** : React 19, Vite 7, Tailwind 4 (`@tailwindcss/vite`), composants shadcn/ui écrits dans `src/components/ui`, taille de police de base 18 px et boutons de 56 px par défaut. PWA via `vite-plugin-pwa` (manifest fr, `autoUpdate`, l'API n'est jamais mise en cache par le service worker).
- **Tests** : pytest (Postgres réel, `--reuse-db`), Vitest + Testing Library (API simulée par `fetch` mocké), Playwright sur deux profils (mobile Pixel 7, tablette Galaxy Tab S4) avec API simulée par `page.route` au Lot 0.
- **CI GitHub Actions** : jobs backend (ruff, `makemigrations --check`, pytest sur Postgres 16), frontend (eslint, tsc, vitest, build), e2e (Playwright sur le build), docker (build de l'image sans push).
- **Non fait au Lot 0, reporté** : lien magique (§2), file de tâches planifiées (Lot 2), stockage S3 (Lot 4), déploiement effectif sur Railway (nécessite la création du projet dans l'interface Railway ; `railway.toml` prêt).
