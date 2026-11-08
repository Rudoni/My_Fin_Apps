# Depenses recurrentes et statistiques mensuelles

## Installation

Avant de deployer le nouveau backend sur une base existante, depuis backend :

```sh
.venv/bin/alembic upgrade head
```

Utiliser la variable MY_FIN_APPS_DB_URL de l'environnement cible. La migration 20261108_000002 cree deux tables ; elle ne convertit pas les anciennes depenses. Pour une installation neuve, init.sql contient aussi ces tables.

## Fonctionnement

- Le mois de debut est inclus. Toutes les echeances jusqu'au mois actuel sont creees, datees du premier, fuseau Europe/Paris.
- Les depenses recurrentes generees sont des depenses ordinaires rattachees a une occurrence unique. Le total inclut donc deja leur montant : ne pas l'ajouter une seconde fois.
- Le total recurrent correspond aux occurrences presentes dans l'historique pour la periode selectionnee, pas a une projection de l'echeancier.
- Une suppression dans l'historique conserve une trace d'occurrence pour ne pas recreer la depense supprimee.
- La pause conserve les mois deja echus ; une reprise saute les mois de pause.
- Pour changer le tarif, mettre la regle en pause et en creer une nouvelle a partir du mois approprie.
- Une regle creee dans le passe rattrape les mois passes. Verifier les depenses deja saisies manuellement pour eviter de compter deux fois le meme paiement.
- Les donnees sont isolees par utilisateur ; les regles sont verrouillees pendant la generation.

## Premier du mois

Le budget, le dashboard, les annees et l'historique synchronisent automatiquement les echeances au chargement. Sans visite, la date de comptabilisation restera le premier du mois lors du prochain chargement.

Pour creer physiquement les lignes meme sans visite, planifier cette commande quotidienne dans un job backend disposant des memes variables et dependances :

```sh
python -m app.services.recurring_expenses
```

Repertoire de travail : backend (ou /app pour l'image Docker existante).
Exemple cron UTC : `10 0 * * *`. Le rattrapage rend les relances sans doublon. Aucun cron distant n'est configure automatiquement par cette modification.

## CA et benefice

Les graphiques des onglets Pilotage sont regroupes par mois de vente. En brocante, le CA correspond a ta part des ventes et le benefice soustrait le cout moyen d'achat, comme les indicateurs existants. Les valeurs sont estimees hors frais non saisis. Les filtres de recherche et de groupe brocante restent appliques.
