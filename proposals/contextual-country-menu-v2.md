# Proposition V2 — menu contextuel pays + interface geopolitique nettoyee

## But
Refondre l'interaction principale autour de la carte pour que le jeu reste d'abord geopolitique, lisible et contextuel.

## Probleme constate
- les boutons de guerre permanents nuisent a la lisibilite
- trop de panneaux se chevauchent
- la guerre semble toujours active alors qu'elle devrait etre contextuelle
- l'interface n'est pas encore assez claire ni assez francisee

## Direction V2
### 1. Interaction carte
- clic gauche : selectionner un pays / ouvrir sa fiche
- clic droit : ouvrir un menu contextuel d'actions
- les actions affiches dependent du contexte du pays et de l'etat du monde

### 2. Fin des boutons de guerre permanents
- supprimer l'affichage constant de `Attack / Defend`
- n'afficher les options militaires que si un contexte les justifie :
  - crise
  - incident frontalier
  - guerre
  - ultimatum
  - menace declaree

### 3. Menu contextuel pays
Le menu doit etre leger, lisible, temporaire et ferme automatiquement au clic hors menu.

#### Categories possibles
- Diplomatie
- Economie
- Renseignement
- Militaire (uniquement si contexte valide)
- Spatial (plus tard, si debloque)

#### Exemples d'actions
- Ouvrir la fiche pays
- Contacter diplomatiquement
- Observer
- Proposer accord
- Sanctionner
- Soutenir
- Menacer
- Declarer ligne rouge
- Intervention militaire (uniquement si contexte valide)

### 4. Panneau d'evenement unique
Au lieu d'avoir plusieurs panneaux envahissants :
- un seul panneau principal d'evenement / contexte
- resume du narrateur
- causes
- options disponibles
- consequences probables

### 5. Interface entierement en francais
- labels UI en francais
- suggestions LLM affichees en francais
- narration LLM affichee en francais
- vocabulaire plus coherent avec le ton geopolitique du jeu

## Regles UX
- pas plus de 5 a 7 actions visibles dans le menu contextuel
- masquer les actions non pertinentes
- eviter les superpositions de panneaux
- garder la carte visible comme centre principal du gameplay

## Pistes de fichiers a toucher
- `client/src/components/WorldGeoMap.tsx`
- `client/src/pages/GameRoutePage.tsx`
- `client/src/styles.css`
- systeme de labels / i18n ou equivalent
- bridge UI / LLM pour forcer la sortie francaise cote interface

## Critere de validation
La V2 est reussie si :
- la carte est plus propre
- il n'y a plus de boutons de guerre permanents
- les actions s'ouvrent naturellement via clic droit
- la lecture est plus claire
- le jeu respire davantage la geopolitique que la guerre permanente
