# Next task

## Contexte
Le joueur demande une remise à niveau UX + simulation pour rendre les actions plus lisibles, plus cohérentes historiquement/temporalement, et mieux intégrées à un narrateur LLM.

## Tâche courante
Créer un plan d'action court et précis pour une roadmap en 3 incréments, sans refactor large.

## Objectif
1. Clarifier les boutons d'actions (attaque/défense vs propositions/conseils) et les boîtes de dialogue.
2. Renforcer la logique narrative LLM (mémoire, contexte temporel 2026+, réactions politiques multi-pays).
3. Définir une progression spatiale cohérente (Terre -> Lune) avec prérequis gameplay.
4. Ajouter de la gestion de scénarios (suppression), et un suivi économique historique (journal des revenus/dépenses).

## Contraintes
- Rester dans la continuité du jeu de stratégie narratif.
- Garder la cohérence historique et temporelle; événements plausibles mais ouverts au "what-if".
- Éviter les ajouts techniques non nécessaires au MVP de chaque incrément.

## Sortie attendue
### Plan d'action (court et précis)

#### Incrément 1 — Lisibilité & contrôle (1 sprint)
- Recomposer l'UI Action en 3 blocs visibles: **Action directe**, **Suggestion IA**, **Conséquence attendue**.
- Uniformiser les labels (attaque, défense, économie, diplomatie) + codes couleur stables.
- Améliorer lisibilité des dialogues (auteur, cible, date, impact).
- Ajouter la suppression de scénario/sauvegarde avec confirmation.

#### Incrément 2 — Narrateur LLM & mémoire monde (1-2 sprints)
- Introduire une mémoire persistante: événements majeurs, décisions joueur, tensions par pays, alliances.
- Forcer le narrateur à répondre selon: époque, contexte géopolitique, historique des tours, profil du joueur.
- Simuler au moins 3-5 pays actifs par tour avec décisions politiques crédibles.
- Créer un moteur d'événements opportunistes (bonus/malus) selon stratégie et risque.

#### Incrément 3 — Progression spatiale Terre/Lune (2 sprints)
- Ajouter zoom global Terre + écran de chargement/déchargement des ressources entre astres.
- Débloquer la carte Lune via prérequis (programme spatial, budget, satellite, mission reconnaissance).
- Ouvrir d'abord une zone lunaire partielle, puis extension exploration/exploitation.
- Ajouter un tableau mémoire économique: revenus, dépenses, programmes, retours par période.

### Définition de fini
- Le joueur distingue en moins de 3 secondes une action jouable d'une simple suggestion.
- Le narrateur ne répète pas les mêmes réponses sur 5 tours et cite le contexte temporel.
- La Lune n'est accessible qu'après prérequis explicites et visibles.
- Chaque scénario/sauvegarde peut être supprimé proprement depuis l'interface.
