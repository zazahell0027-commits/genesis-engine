# Prochaine tache

## Priorite actuelle
1. Faire du clic droit une interaction spatiale contextuelle avec 3 actions courtes proposees selon le point exact clique, y compris sur l'ocean ou le vide.
2. Compacter le HUD et supprimer les panneaux redondants, en gardant un seul controle de monde vraiment utile.
3. Finir le theatre lunaire avec un langage visuel distinct de la Terre et une progression de simulation claire.
4. Finir la coherence FR/EN des textes secondaires, des evenements et du conseiller.

## Taches a ajouter
5. Purger les mentions `Pax` restantes dans les commentaires et docs techniques qui accompagnent la carte.
6. Tuner et valider les labels pays sur les cas limites visibles: petits pays, archipels, zoom extreme, collisions et rotations.
7. Ajouter des tests de non-regression sur le planner de labels, les collisions et le branchement viewport MapLibre.
8. Repasser sur les panneaux et controles restants de la route de jeu pour supprimer les doublons, boutons morts et textes superflus.
9. Rendre les noms de pays toujours lisibles sur la carte, avec un ordre de couches plus clair et des seuils de visibilite moins agressifs si besoin.

## Cap
Le jeu doit ressembler a un atlas strategique vivant avec un vrai journal de partie, pas a une superposition debug.

Le point de vue du joueur est fixe sur sa nation. Tout le reste doit servir cette lecture :
- la nation jouee reste au centre
- le conseiller parle dans la langue de l'interface
- la carte sert la lecture strategique
- chaque controle visible doit avoir une vraie utilite gameplay

## Regles produit
1. Ne pas garder de boutons morts.
2. Ne pas garder de panneaux qui disent presque la meme chose.
3. Ne pas faire du clic droit un simple retour vers un menu de base.
4. Faire sentir l'ouverture de partie comme un vrai journal LLM, surtout au premier tour.
5. Garder la Lune derriere une progression de simulation explicite.
6. Verifier et corriger les erreurs eventuelles avant de clore une tache.
7. Mettre a jour `reports/next-task.md` a la fin de chaque tache terminee.
8. Verifier que la reponse et le rendu restent alignes avec le cap produit sous tous les angles.
9. Si un test ou un rendu diverge, reprendre la comprehension, corriger, puis ameliorer avant de conclure.
