# Prochaine tache

## A faire maintenant
- Refaire le bloc central en vrai journal de partie, plus editorial, sans doublons ni textes techniques.
- Faire du clic droit une interaction spatiale vraiment contextuelle, avec 3 actions distinctes proposees par le LLM selon le point exact clique, y compris sur l'ocean ou le vide.
- Revoir les labels pays sur le modele PAX: centrage optique, grand nom de pays, tracking large, forme stable, debordement controle, et disparition seulement quand on zoome beaucoup.
- Compacter le HUD et supprimer les panneaux qui se marchent dessus, en gardant un seul vrai controle de monde utile.
- Finir le theatre lunaire avec un langage visuel propre et distinct de la Terre.
- Finir la coherence FR/EN des textes secondaires et des evenements.

## Cap
Le jeu doit ressembler a un atlas strategique vivant avec un vrai journal de partie, pas a une superposition de debug.

Le joueur choisit une nation au depart, puis ce choix devient le point de vue central:
- la nation jouee reste fixe
- le conseiller parle dans la langue de l'interface
- la carte sert la lecture strategique
- chaque controle visible doit avoir une vraie utilite gameplay

## References utiles
Ces references servent de direction, pas de copie:
- OpenFrontIO: composition propre, panneaux compacts, gestion des debordements, fond unifie, hierarchie claire.
- Freeciv-web: separation nette entre lecture 2D et modes 3D / WebGL.
- Lunar Commander et autres jeux lunaires: la Lune doit etre un theatre distinct, pas une Terre recoloree.
- Les grands jeux de strategie type EU4: les noms de pays doivent respirer, epouser le territoire et suivre l'echelle de lecture.

## Regles produit
1. Ne pas garder de boutons morts.
2. Ne pas conserver un bloc de lecture regionale qui ressemble a un panneau technique.
3. Ne pas faire du clic droit un simple retour vers un menu de base.
4. Faire du clic droit une interaction spatiale precise, meme sur l'ocean.
5. Faire sentir l'ouverture de partie comme un vrai journal LLM, surtout au premier tour.
6. Garder la Lune verrouillee derriere une progression de simulation explicite.

## Plan

### 1. Recomposer le centre de l'ecran
Garder l'information utile, mais calmer la forme.
- Remplacer le bloc de brief regional par un module plus editorial et plus humain.
- Ne garder dans la zone centrale que les informations qui aident vraiment a lire la partie.
- Mettre le reste dans des panneaux secondaires ou des tiroirs optionnels.

### 2. Faire du clic droit une interaction spatiale
Le clic droit doit vouloir dire: "qu'est-ce que je peux faire ici ?"
- Capturer la position exacte du clic, sur terre, mer ou espace vide.
- Determiner ce qui est sous le pointeur.
- Demander au LLM de proposer des actions courtes et adaptees a cette position exacte.
- Afficher cela dans un panneau calme et lisible, pas dans un menu generique.

### 3. Faire de l'ouverture de partie un journal LLM
Le depart de partie doit poser un cadre historique et narratif solide.
- Generer un vrai journal d'ouverture sur le premier tour.
- Ecrire comme un analyste ou historien strategique, pas comme un resume technique.
- Faire apparaitre l'etat initial du monde, le role du joueur et la tension strategique immediate.

### 4. Finaliser les labels Terre
Conserver les noms grands et poses, avec une logique stable par pays.
- Les noms de pays doivent etre centres optiquement sur la masse du territoire.
- Le label doit rester large, lisible et majoritairement horizontal ou en legere diagonale.
- La forme du label doit rester stable; le zoom ne doit agir que sur la presence visuelle.
- Les petits pays doivent rester lisibles sans devenir agressifs.
- Les grands pays doivent avoir des labels plus amples, plus nobles.

### 5. Nettoyer le HUD
Reduire l'agressivite visuelle sans perdre l'information utile.
- Garder une seule action claire de retour ou recentrage monde.
- Supprimer les controles decoratifs ou repetitifs.
- Eviter les surfaces de statut qui disent presque la meme chose.

### 6. Pousser la progression spatiale
Le jeu doit se lire comme Terre -> globe -> orbite -> Lune.
- Vue Terre proche: planisphere ou lecture territoriale.
- Vue globe: lecture globale et labels alleges.
- Vue orbite: couche strategique de transition.
- Vue Lune: langage visuel propre, territoire en facettes ou tuiles, pas un clone de la Terre.

### 7. Rendre la langue coherente
La langue de l'interface doit piloter la langue du jeu.
- Si le francais est selectionne, le conseiller doit repondre en francais.
- Les narratifs de tour, la diplomatie et les prompts contextuels doivent suivre la langue choisie.
- L'anglais ne doit rester qu'en fallback ou en mode explicite.

## Definition de fini
- La composition de carte parait intentionnelle, pas encombrante.
- Le centre de l'ecran raconte la situation sans crier.
- Le clic droit produit des actions contextuelles liees a l'endroit exact.
- Le francais pilote aussi le conseiller et les textes narratifs.
- Les labels Terre courbent et respirent mieux sans changer de forme au zoom.
- La Lune est une couche strategique distincte, pas une Terre recoloree.
- Le joueur comprend l'etat de la partie en un coup d'oeil, sans devoir decoder des badges de debug.
