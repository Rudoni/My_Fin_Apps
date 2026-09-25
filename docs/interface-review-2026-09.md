# Revue du projet et refonte de septembre 2026

## Parcours et interface

- Dashboard restructure en trois vues : vue d'ensemble, flux et budget, patrimoine.
- Acces directs aux depenses, a la brocante et a l'achat-revente.
- Flux affiches sur les douze derniers mois renseignes par defaut, avec acces a tout l'historique filtre.
- Les pages Depenses, Achat-revente et Brocante separent maintenant saisie, listes et pilotage sur ordinateur comme sur mobile.
- Patrimoine separe les actifs, l'ajout/import Ledger et la repartition.
- Systeme visuel partage dans frontend/src/styles/studio.css, charge apres les styles historiques.
- Etats de chargement, erreurs lisibles, donnees absentes et rechargement du dashboard.
- Le mode discret masque les valeurs et graphiques du nouveau dashboard.
- Modales : fermeture Echap, maintien du focus et restauration du focus a la fermeture.

## Corrections fonctionnelles

- Trois routes de compte avaient un prefixe /auth en double. Les routes de profil, changement de mot de passe et fermeture des autres sessions correspondent maintenant aux appels frontend.
- Le patrimoine courant du dashboard utilisait le stock revente filtre par annee. Il utilise maintenant le stock courant complet ; les statistiques de ventes restent filtrees.
- Une erreur au chargement du patrimoine est maintenant presentee dans l'interface.
- Les pages HTML et JSON d'erreur brutes ne sont plus exposees comme messages utilisateur.

## Points restant a traiter avant une industrialisation plus large

Cette revue de code et de parcours ne constitue pas un audit de securite exhaustif ni une validation de la production.

1. Authentification : pas de limitation des tentatives de connexion ou d'inscription dans le code examine. Prevoir une protection persistante adaptee au nombre de serveurs.
2. Sessions : jeton conserve dans localStorage pendant une session pouvant durer 30 jours. Une injection JavaScript pourrait le lire ; etudier des cookies HttpOnly avec une protection CSRF adaptee.
3. CORS : la configuration par defaut accepte tous les sous-domaines vercel.app. Restreindre les origines aux deploiements autorises.
4. Premier compte : l'inscription du premier utilisateur revendique les lignes historiques sans proprietaire. Transformer cette operation en migration explicite avant toute nouvelle installation publique contenant des donnees.
5. Isolation : les principales routes examinees utilisent un utilisateur authentifie et des filtres user_id. Il manque une suite d'integration couvrant deux utilisateurs pour toutes les lectures, ecritures et imports.
6. Donnees financieres : verifier la coherence des indicateurs de rentabilite lorsque les annees d'achat et de vente different. La couverture de mise et le benefice realise sont deux notions differentes.
7. Qualite : la CI execute lint, build, compilation Python et les deux nouveaux tests de regression, mais pas de tests metier connectes a une base ephemere.
8. Maintenance : les styles historiques contiennent plusieurs blocs responsive redondants. La nouvelle couche regroupe ses points de rupture ; une consolidation du fichier historique reste souhaitable.
9. Exploitation : sauvegardes, restauration, alertes, quotas Railway/Neon et configuration effective des origines ne sont pas verifiables depuis le code seul.

## Perimetre de verification

Compilation TypeScript/Vite, lint frontend et compilation Python valides. Deux tests de regression backend valides (routes du compte et patrimoine non affecte par le filtre annuel). Controle Chromium local avec reponses API fictives : dashboard et onglets des quatre pages de gestion a 320, 390, 768 et 1440 px, sans debordement horizontal ni erreur JavaScript. Captures desktop et mobile inspectees. Ces essais ne valident pas les ecritures reelles ni l'isolation entre utilisateurs. Aucun deploiement ni aucune migration de donnees executes.
