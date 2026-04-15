# Compte rendu compare Genesis vs Pax Historia

## Objectif
Ce document sert de memoire de travail pour la refonte de la carte et de l'ergonomie map/HUD afin de rapprocher Genesis du rendu et du flow visuel de Pax Historia.

## Captures classees
- `Mémoire/snaps-genesis/`
- `Mémoire/snaps-pax-historia/`

Le dossier contient:
- les captures originales copiees depuis `C:\Users\Zizi\Pictures\Screenshots\`
- quelques aliases renommes pour reperer plus vite les vues cles

## Echantillons retenus
- Genesis:
  - `Capture d'ecran 2026-04-12 203217.png`
  - `Capture d'ecran 2026-04-12 203438.png`
  - `Capture d'ecran 2026-04-12 210618.png`
  - `Capture d'ecran 2026-04-12 220730.png`
  - `Capture d'ecran 2026-04-14 223609.png`
  - `Capture d'ecran 2026-04-14 223642.png`
  - `genesis-world-flat-2026-04-14-223609.png`
  - `genesis-region-label-chaos-2026-04-14-223642.png`
- Pax Historia:
  - `Capture d'ecran 2026-04-10 213056.png`
  - `Capture d'ecran 2026-04-10 214316.png`
  - `Capture d'ecran 2026-04-10 214333.png`
  - `Capture d'ecran 2026-04-13 113443.png`
  - `Capture d'ecran 2026-04-13 113547.png`
  - `Capture d'ecran 2026-04-13 113604.png`
  - `Capture d'ecran 2026-04-13 113757.png`
  - `Capture d'ecran 2026-04-13 113844.png`
  - `Capture d'ecran 2026-04-13 113900.png`
  - `Capture d'ecran 2026-04-13 113920.png`
  - `Capture d'ecran 2026-04-13 113942.png`
  - `Capture d'ecran 2026-04-13 114005.png`
  - `pax-game-globe-reference-2026-04-13-113757.png`
  - `pax-game-world-reference-2026-04-13-113844.png`
  - `pax-game-country-reference-2026-04-13-113900.png`
  - `pax-game-region-detail-reference-2026-04-13-113942.png`

## Verification technique
Commandes executees avec succes:
- `npm run typecheck`
- `npm run build`
- `npm test`

Etat connu du projet:
- le projet compile correctement au niveau type system
- les tests serveur passent
- le principal probleme n'est plus la compilation
- le principal probleme est la fidelite visuelle, la hierarchie d'information et la coherence du pipeline de rendu map

## Diagnostic rapide
Genesis donne encore une impression de prototype alors que Pax Historia donne une impression de produit fini.

La difference ne vient pas d'un seul detail. Elle vient de 6 couches en meme temps:
- la base cartographique
- la hierarchie des labels
- la densite d'information a chaque zoom
- la qualite du shell HUD et des panneaux
- la fluidite du flow de lancement de partie
- la coherence du pipeline de rendu

## Erreurs visibles dans Genesis

### 1. La carte parait plate et pauvre
Sur `genesis-world-flat-2026-04-14-223609.png`:
- ocean trop clair et trop uniforme
- pas assez de bathymetrie perceptible
- pays remplis par aplats trop simples
- relief visuel et texture presque absents
- contraste trop faible entre surface maritime, littoraux et masse continentale

Effet percu:
- l'oeil humain lit une "carte debug" plutot qu'un monde vivant

### 2. Les labels explosent a mauvais zoom
Sur `genesis-region-label-chaos-2026-04-14-223642.png`:
- noms de regions affiches beaucoup trop tot
- taille de texte beaucoup trop grande
- collisions massives entre labels
- labels coupes sur les bords de l'ecran
- labels qui ecrasent totalement la lecture du territoire
- priorite visuelle incorrecte: les regions prennent le dessus sur les pays
- noms bruts et melanges de langues issus de la source de donnees comme `Eilean Siar`, `Vastra Gotaland`, `Niedersachsen`
- absence de normalisation linguistique ou de fallback visuel coherent

Effet percu:
- la carte devient illisible au moment precis ou elle devrait devenir plus informative
- la carte donne une impression de dataset affiche tel quel au lieu d'une carte pensee pour un humain

### 3. La hierarchie d'information n'est pas stable
Dans Pax, a un zoom donne, une seule famille d'information domine clairement:
- globe: masse globale
- monde: pays
- theatre: pays + formes
- pays: grandes villes, capitales, frontieres
- region: regions + villes
- detail: detail local

Dans Genesis:
- les familles se melangent
- labels pays, regions, marqueurs et overlays peuvent coexister trop tot
- il n'y a pas encore de regle visuelle non negociable par niveau de zoom

### 4. Le shell HUD est trop compact et trop technique
Sur Genesis:
- boutons top-left trop petits et trop serres
- legende sous les boutons trop dense
- capsule pays actif au centre trop detachee du reste
- tooltip petit et peu integre
- les panneaux n'ont pas encore la meme presence que dans Pax

Sur Pax:
- chaque bloc a une fonction evidente
- l'espacement respire
- les capsules sont plus grosses, plus lisibles, mieux alignees
- la carte reste toujours la star

### 5. Le flow de lancement n'est pas encore au niveau
Pax montre un vrai parcours:
- page scenario hero
- selection pays sur carte
- configuration de partie
- transition de chargement
- ouverture de partie

Genesis a deja des briques, mais l'ensemble reste moins fluide et moins premium.

### 6. La langue et les donnees ne sont pas traitees comme un produit
Dans Pax:
- les noms affiches sont choisis pour la lisibilite
- les couches d'information suivent une langue et une presentation coherentes

Dans Genesis:
- on expose encore parfois les noms natifs ou techniques des donnees
- le changement de langue n'est pas encore une vraie couche produit sur la map
- le rendu donne l'impression que les donnees commandent l'UI au lieu de l'inverse

## Causes probables dans le code

### 1. Le composant map fait trop de choses a la fois
Fichier concerne:
- `client/src/components/WorldGeoMap.tsx`

Constat:
- chargement GeoJSON
- camera
- globe
- flat map
- LOD
- tooltips
- marqueurs
- labels
- panneau d'options
- interactions souris

Resultat:
- regressions faciles
- lecture difficile
- ajustements visuels fragiles

### 2. Le LOD est mieux qu'avant, mais encore trop permissif
Fichiers concernes:
- `client/src/features/map/map-lod-spec.json`
- `client/src/features/map/pipeline.ts`

Constat:
- le LOD existe
- mais les seuils restent encore trop souples pour la lisibilite humaine
- les regions montent trop vite
- les familles de labels ne s'excluent pas encore assez fort

### 3. Le style map est defini a plusieurs endroits
Fichiers concernes:
- `client/src/styles.css`
- `client/src/styles/game-ui-fidelity.css`

Constat:
- plusieurs selecteurs se recouvrent
- certaines regles map existent en double
- la cascade CSS peut produire un rendu instable selon les ajustements

Effet:
- on corrige un point visuel et on en degrade un autre

### 4. Les donnees map ne sont pas harmonisees avec les niveaux de zoom
Fichiers concernes:
- `client/public/maps/world_countries_slim.json`
- `client/public/maps/europe_provinces.json`

Constat:
- on combine une carte monde pays simplifiee avec des provinces Europe
- cette combinaison est utile, mais elle doit etre tres strictement pilotee
- sinon on obtient des noms de regions tres specifiques alors que le zoom n'est pas pret pour ca

### 5. Globe et carte plane ne sont pas encore deux systemes assez distincts
Constat:
- le comportement s'est ameliore
- mais on sent encore une logique partagee entre rendu globe et flat map

Effet:
- transitions fragiles
- risque de duplication visuelle
- sensation de mode special plutot que de veritable vue globale coherente

## Ecart de ressemblance avec Pax Historia

### Base visuelle
Pax:
- ocean sombre, profond, textural
- labels serif fins et elegants
- contours nets
- couleurs riches mais maitrisees

Genesis:
- ocean clair
- labels souvent trop gras ou trop gros
- couleurs plus sandbox prototype
- manque d'effet matiere

### Zoom et dynamisme
Pax:
- chaque cran de zoom change la lecture
- la camera raconte quelque chose
- les labels apparaissent au bon moment

Genesis:
- le zoom change surtout l'echelle
- il ne change pas encore assez la narration visuelle
- la langue, la taille et la densite des labels ne sont pas encore pilotees comme un systeme unique

### HUD
Pax:
- panneaux larges, calmes, lisibles
- excellente priorisation

Genesis:
- beaucoup de petits controles
- densite trop technique
- moins de respiration

## Recherche web graphique (15 avril 2026)

### Ce que les sources officielles Pax confirment
Sources:
- `https://wiki.paxhistoria.co/gameplay`
- `https://wiki.paxhistoria.co/roadmap`
- `https://wiki.paxhistoria.co/`
- `https://www.paxhistoria.co/presets/category/historical`

Constats utiles:
- Pax assume une boucle visuelle tres claire: `Chats`, `Actions`, `Time Jump`, puis lecture de l'etat du monde et des rounds precedents.
- Le roadmap officiel confirme explicitement une orientation graphique forte:
  - `new basemap`
  - `zooms down to street level`
  - `dark mode`
  - `map markers`
  - compatibilite de ces marqueurs avec l'IA
- Le site officiel met aussi en avant un parcours de preset qui parait produit:
  - hero scenario
  - choix pays
  - configuration de partie
  - chargement
  - ouverture de partie

Conclusion:
- Le rendu clair, plat et trop abstrait de Genesis n'est pas seulement "different".
- Il est en contradiction directe avec la direction annoncee par Pax lui-meme.

### Ce que les references cartographiques officielles apportent
Sources:
- `https://docs.mapbox.com/help/troubleshooting/optimize-map-label-placement/`
- `https://docs.mapbox.com/style-spec/reference/layers/`
- `https://docs.mapbox.com/help/glossary/zoom-extent/`
- `https://docs.mapbox.com/help/glossary/zoom-level/`
- `https://cesium.com/docs/tutorials/imagery-layers/`
- `https://cesium.com/learn/cesiumjs-fundamentals/`

Apports concrets:
- **Label collision**: une carte lisible ne laisse pas les labels se battre librement. Il faut une collision systematique et une hierarchie de priorite.
- **Variable anchor**: un label ne doit pas avoir une seule position fixe. Il faut plusieurs placements possibles autour du point/centre.
- **Zoom extent**: chaque couche visuelle doit exister sur une plage de zoom limitee. Si une couche detaillee apparait trop tot, elle pollue la carte.
- **Zoom-dependent styling**: taille, opacite, contour, densite et type de marqueur doivent changer avec le zoom.
- **Globe imagery layering**: un globe convaincant n'est pas juste une sphere. Il faut un fond, des couches d'imagerie, une camera maitrisee, et une transition propre vers la vue 2D.

Conclusion:
- Les problemes de Genesis ne viennent pas d'un manque de CSS uniquement.
- Ils viennent aussi d'un manque de regles cartographiques strictes.

## Implications directes pour Genesis

### 1. La map doit etre pensee comme un produit cartographique
Genesis doit cesser d'afficher les donnees "comme elles viennent".

Il faut:
- des noms choisis pour la lecture humaine
- une langue prioritaire par rendu
- des regles de collision
- des couches invisibles tant que le zoom n'est pas approprie

### 2. Globe et flat map doivent etre deux experiences distinctes
Le globe ne doit pas etre une simple variante de la carte plane.

Le globe doit:
- raconter la masse mondiale
- rester propre et peu dense
- avoir sa propre camera
- servir d'entree dans le theatre mondial

La flat map doit:
- prendre le relais pour la lecture strategique
- reveler les couches detaillees par niveau
- assumer la lisibilite avant la quantite

### 3. Le zoom doit changer la narration visuelle
Le zoom ne doit pas seulement agrandir.

Il doit changer:
- les labels visibles
- les marqueurs visibles
- la densite d'information
- la priorite pays / region / ville
- la taille des contours et halos

### 4. Le shell HUD doit suivre la carte, pas l'inverse
Pax laisse la carte respirer.

Genesis doit donc:
- grossir legerement les controles importants
- enlever les boutons trop techniques ou trop redondants du premier plan
- garder un nombre reduit de commandes visibles a tout moment
- rendre les panneaux plus nets, plus stables, plus ancrés

## Direction visuelle recommandee

### Basemap
- ocean tres sombre, profond, avec bathymetrie lisible
- surface maritime plus bleue/noire que bleue claire
- contraste plus fort entre terre, cote et mer
- relief visuel discret mais constant

### Pays
- palette plus maitrisee
- saturation presente mais pas "arcade"
- contour principal sombre et stable
- labels serif elegants, plus fins, mieux espaces

### Regions
- seulement apres selection ou zoom suffisant
- labels plus petits que les pays
- jamais plus dominants que le pays parent
- noms harmonises linguistiquement

### Villes et marqueurs
- capitales d'abord
- villes majeures ensuite
- clustering au besoin
- symboles plus petits, plus precis
- texte de ville seulement quand la carte peut l'absorber

### Panneaux
- plus grands
- plus simples
- meilleur rythme vertical
- moins de micro-elements visibles en permanence

## Traduction en plan d'action

### P0 graphique
- geler 6 captures cibles: globe, monde, Europe, pays, region, detail
- definir pour chacune:
  - couches visibles
  - taille cible des labels
  - type de marqueurs autorises
  - comportement camera

### P0 pipeline
- separer le rendu en modules:
  - `globe renderer`
  - `flat renderer`
  - `label manager`
  - `marker manager`
  - `camera controller`
  - `map chrome`

### P0 lisibilite
- interdire les labels de region sans selection ou zoom de detail
- interdire les villes majeures sans contexte local
- limiter les labels pays en zoom theatre
- ajouter une vraie priorite de collision

### P1 fidelite Pax
- assombrir definitivement la basemap
- refaire la palette pays
- retravailler contours, halos et serif labels
- refaire le layout des commandes map

### P1 flow de partie
- aligner le lancement avec le parcours Pax:
  - scenario hero
  - choix pays
  - configuration
  - creation
  - entree en partie

## Resume ajoute
- Les sources officielles Pax confirment que la bonne cible visuelle est une carte sombre, profonde, avec zoom detaille et marqueurs.
- Les references officielles de cartographie confirment qu'il faut des zoom extents, une collision de labels, des ancres variables et des couches strictes.
- Genesis doit arreter les retouches locales et se comporter comme un vrai systeme cartographique pilote par niveaux de zoom.

## Priorites de correction

### P0. Arreter les tweaks disperses
Ne plus empiler des retouches locales sur la map sans repasser par un schema unique.

### P0. Isoler le pipeline map
Objectif:
- un module de rendu globe
- un module de rendu flat map
- un module LOD
- un module labels et marqueurs
- un module HUD map

### P0. Regles LOD non negociables
A definir noir sur blanc:
- `globe`: aucun label region, aucun marqueur local
- `world`: seulement pays
- `theatre`: pays + quelques capitales
- `country`: pays cible + villes majeures + regions si besoin
- `region`: regions + villes filtrees
- `detail`: detail local seulement

Une famille dominante par zoom. Pas de melange libre.

### P0. Collision labels + clustering marqueurs obligatoires
Si ce point n'est pas strict, la carte restera illisible.

### P1. Refonte visuelle ocean + contours + palette
But:
- ocean plus sombre
- littoraux mieux lus
- palette plus Pax-like
- labels plus elegants

### P1. Refonte du shell map
But:
- dock bas gauche plus propre
- commandes top-left plus grandes et plus selectives
- panneaux mieux ancres
- capsule date plus credible

### P1. Refonte du parcours de lancement
But:
- page scenario hero
- choix pays lisible
- options de partie mieux structurees
- transition claire vers la partie

### P2. Validation screenshot automatisee
Le snapshot logique existe deja.
La prochaine etape utile est un snapshot image compare:
- globe
- monde
- europe
- pays
- region
- detail

## Decision de travail recommandee
La bonne suite n'est pas de continuer des micro-corrections visuelles partout.

La bonne suite est:
1. figer 6 vues cibles
2. refactorer la map en pipeline isole
3. rebrancher le HUD autour
4. seulement ensuite peaufiner le style

## Resume
- Genesis est techniquement plus stable qu'avant.
- Genesis n'est pas encore assez proche de Pax visuellement.
- Le probleme principal n'est plus un bug unique, c'est une incoherence de pipeline map et de hierarchie visuelle.
- La prochaine vraie amelioration doit passer par une refonte map structuree, pas par des retouches ponctuelles.
