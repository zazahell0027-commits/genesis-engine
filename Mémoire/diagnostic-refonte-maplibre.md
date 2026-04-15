# Diagnostic refonte MapLibre

## Constat
La carte SVG maison etait arrivee a sa limite: elle melangeait projection, ocean, relief, labels, pays, provinces, marqueurs et camera dans un seul pipeline. Les retouches visuelles amelioraient un point puis en degradaient un autre: labels illisibles au zoom profond, fond trop plat, zoom instable, details non hierarchises.

## Decision
La carte principale passe sur MapLibre GL JS. Le backend, la simulation, les pays, les evenements, les artefacts et les actions restent reutilises. L'ancien rendu SVG reste dans le code comme reference/fallback technique, mais il n'est plus le rendu principal de l'ecran de partie.

## Architecture cible
- Basemap: OpenFreeMap/OpenMapTiles via `VITE_MAP_STYLE_URL`, avec ocean, terrain, routes, villes et labels cartographiques.
- Politique: source GeoJSON locale des pays, couleurs de controle, bordures, selection et focus.
- Details: villes/capitales issues des donnees locales, affichage progressif par zoom avec collision MapLibre.
- Gameplay: effets de round, artefacts, troupes, forts et industrie sous forme de couches MapLibre par-dessus la basemap.

## Ce qui reste a durcir
- Ajouter une vraie source de tuiles locale/self-host pour ne pas dependre du reseau.
- Ajouter une couche provinces MapLibre au lieu de garder les provinces dans l'ancien pipeline SVG.
- Affiner le style MapLibre pour se rapprocher davantage des captures Pax: bathymetrie plus sombre, relief plus contraste, labels pays plus theatrales.
- Ajouter des snapshots visuels automatises du nouveau rendu MapLibre.
