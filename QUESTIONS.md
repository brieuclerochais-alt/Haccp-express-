# Questions ouvertes

Points réglementaires ou produit non tranchés par le cahier des charges. Aucune
règle n'est inventée : la valeur est laissée paramétrable et signalée ici.

## Réglementaire (à valider par un professionnel de l'hygiène avant production)

- **Seuils par défaut (§4.1)** : les valeurs (0/+4 °C, −18 °C, 63 °C, 2 h, 1 h, 25 % de
  composés polaires) sont codées comme valeurs par défaut modifiables par
  établissement. Elles doivent être confirmées par rapport au GBPH applicable à
  chaque type d'établissement.
- **Tolérance froid positif** : certains GBPH tolèrent brièvement jusqu'à +6 °C ou
  +8 °C selon les denrées. Le seuil `temp_max` reste paramétrable par enceinte ;
  pas de tolérance temporaire implémentée.
- **Durée de conservation des registres (§4.8)** : « abonnement + 3 ans » est la
  politique produit retenue ; la durée légale minimale varie selon les documents.
  À confirmer.

## Produit / technique

- **Lot 0 — Python** : la machine de développement utilisée fournit Python 3.12 via
  `uv` ; l'image Docker et la CI ciblent 3.12 comme demandé.
- **Lot 0 — Authentification gérant** : JWT (accès 1 h, rafraîchissement 30 jours,
  rotation) stocké dans `localStorage` pour permettre le mode PWA hors ligne. Le
  « lien magique optionnel » (§2) n'est pas implémenté au Lot 0.
- **Lot 0 — Tâches planifiées** : ni Celery ni django-q2 n'est encore installé
  (premier besoin au Lot 2 pour la génération quotidienne des tâches). Préférence
  pour django-q2 (plus simple, un seul service Redis).
- **Lot 0 — Hébergement** : la configuration Railway (`railway.toml`) est prête ;
  la création du projet, de la base PostgreSQL et le choix de la région UE se font
  dans l'interface Railway et ne sont pas automatisables depuis le dépôt.
