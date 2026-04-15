# Genesis Engine — plan d’action court et précis

## Objectif
Rendre le jeu plus lisible, plus cohérent, plus vivant et plus crédible, sans casser la direction actuelle.

---

## 1. Refaire l’interface d’action de guerre

### Problèmes
- Les boutons `attack`, `defense` et autres actions sont mal placés.
- Les actions, propositions et conséquences se mélangent.
- Les boîtes de dialogue ne sont pas assez lisibles.

### Solutions
- Créer un panneau unique de **contexte d’action** pour les actions militaires et diplomatiques.
- Séparer clairement :
  - action immédiate
  - coût / risque
  - effet probable
  - réponse possible des autres pays
- Refaire les modales avec une structure fixe :
  - titre
  - contexte
  - options
  - impacts
  - confirmation

### Fichiers / zones à modifier
- `client/src/components/*Action*`
- `client/src/components/*Modal*`
- `client/src/pages/GameRoutePage.tsx`
- composants liés à la map, au panneau latéral et aux dialogues

---

## 2. Améliorer la lisibilité générale

### Problèmes
- On différencie mal les types d’information.
- Les boîtes de dialogue et panneaux manquent de hiérarchie visuelle.
- Le dézoom actuel ne donne pas encore une vraie sensation de globe.

### Solutions
- Définir 4 types visuels cohérents :
  - action du joueur
  - information neutre
  - alerte / crise
  - proposition / opportunité
- Revoir contrastes, espacements, titres et icônes.
- Ajouter un mode de vue plus global pour renforcer la lecture géopolitique.

### Fichiers / zones à modifier
- `client/src/components/WorldGeoMap.tsx`
- composants de HUD / panels / event feed / dialogs
- styles globaux du client

---

## 3. Ajouter une vraie mémoire du monde

### Problèmes
- Le monde risque d’oublier trop vite les décisions du joueur.
- Les événements n’ont pas assez de continuité historique.

### Solutions
- Créer un journal persistant des événements :
  - guerre
  - alliance
  - crise
  - sanctions
  - recherche
  - spatial
  - scandale
- Ajouter un historique synthétique par pays :
  - argent généré
  - puissance
  - stabilité
  - influence
  - recherche

### Fichiers / zones à créer / modifier
- `shared/` pour les types d’événements et de mémoire
- `server/` pour la persistance et l’agrégation historique
- composants UI pour afficher journal et tableaux de suivi

---

## 4. Brancher le LLM comme narrateur logique

### Problèmes
- Le LLM ne doit pas juste “répondre”.
- Il doit agir comme un narrateur cohérent, contextuel et non répétitif.

### Solutions
- Le LLM doit recevoir systématiquement :
  - état du monde
  - historique récent
  - profil du joueur
  - contexte temporel
  - état des grandes puissances
- Le LLM produit :
  - événements
  - réactions internationales
  - opportunités
  - conséquences différées
  - narration synthétique
- Prévoir des garde-fous pour éviter :
  - répétitions
  - contradictions
  - événements absurdes hors contexte

### Fichiers / zones à créer / modifier
- `server/src/ai/` ou équivalent
- builder de prompt
- gestionnaire de mémoire
- résolveur d’événements
- bridge serveur → client pour l’event feed

---

## 5. Simuler les autres pays plus intelligemment

### Problèmes
- Le monde ne doit pas sembler vide hors des actions du joueur.
- Les autres pays doivent réagir avec une logique politique crédible.

### Solutions
- Donner à chaque grande puissance un profil minimal :
  - doctrine
  - stabilité
  - agressivité
  - priorité économique
  - priorité militaire
  - priorité scientifique
  - relations avec les autres
- Le LLM interprète ces états pour enrichir les événements, mais la base logique doit exister en données.

### Fichiers / zones à créer / modifier
- `shared/` pour les profils pays
- `server/` pour la simulation géopolitique
- UI pour rapports pays / diplomatie / tensions

---

## 6. Ajouter un tableau mémoire économique et politique

### Problèmes
- Il manque une mémoire utile pour suivre l’évolution du monde.
- Le joueur doit voir les effets de ses choix sur la durée.

### Solutions
- Ajouter un tableau de suivi avec :
  - argent généré par pays
  - évolution des revenus
  - tensions
  - alliances
  - recherche
  - influence globale
- Ajouter un historique d’événements majeurs consultable.

### Fichiers / zones à créer / modifier
- panneau d’analyse / ledger / timeline côté client
- endpoints serveur pour données historiques

---

## 7. Intégrer une progression spatiale logique

### Problèmes
- Accéder directement à la Lune sans progression casserait la cohérence.
- Le spatial doit prolonger le scénario, pas juste ajouter une map.

### Solutions
- Débloquer l’espace par étapes :
  1. programme spatial
  2. satellite
  3. observation orbitale
  4. mission lunaire
  5. carte lune
  6. exploration / exploitation
- Charger / décharger les astres selon l’état de progression.
- Faire dépendre l’accès à la Lune de décisions, budget, recherche et contexte géopolitique.

### Fichiers / zones à créer / modifier
- systèmes de progression / recherche / exploration
- loader de carte planétaire / lunaire
- UI d’accès spatial

---

## 8. Gérer les scénarios proprement

### Problèmes
- Les scénarios doivent pouvoir être créés, modifiés, supprimés.
- Il faut préparer le moteur pour d’autres époques plus tard.

### Solutions
- Ajouter une gestion de scénarios :
  - créer
  - éditer
  - supprimer
  - dupliquer
- Garder un format commun pour :
  - époque
  - contexte initial
  - pays actifs
  - règles spéciales
  - niveau technologique

### Fichiers / zones à créer / modifier
- gestionnaire de scénarios côté serveur
- UI admin / debug / éditeur simple de scénario
- schémas partagés côté `shared/`

---

## Ordre de priorité recommandé
1. UI guerre + lisibilité des dialogues
2. mémoire du monde
3. intégration LLM avec mémoire et contexte
4. simulation des autres pays
5. tableau historique économie / politique
6. progression spatiale
7. gestion complète des scénarios

---

## Résultat visé
Le joueur doit avoir la sensation que :
- ses actions sont claires
- le monde se souvient
- les autres pays existent vraiment
- les événements ont une logique
- le LLM agit comme un narrateur intelligent
- l’espace est une extension crédible de la partie
