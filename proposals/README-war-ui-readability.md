# Proposition UI — lisibilite des actions de guerre

Cette branche ne modifie pas `main`.

Elle ajoute un patch testable localement pour ameliorer :
- la separation entre actions militaires et actions internes
- la lisibilite du pays cible
- la coherence du panneau d'actions
- la lecture rapide des priorites strategiques

## Fichiers ajoutes
- `proposals/war-ui-readability.patch`
- `proposals/README-war-ui-readability.md`

## Tester localement dans VS Code
Depuis ton clone local du repo :

```bash
git fetch origin

git checkout proposal/war-ui-readability

git apply proposals/war-ui-readability.patch
```

Ensuite tu lances le client normalement et tu testes.

## Ce que le patch change
### GameRoutePage
- ajoute un bloc de contexte sur le pays selectionne
- separe les actions en 2 familles :
  - theatre exterieur
  - pilotage interne
- rend l'intention des boutons plus evidente selon la cible

### styles.css
- ajoute des cartes de contexte
- colore differemment les actions `attack`, `defend`, `invest`, `stabilize`
- donne une hierarchie visuelle plus claire au panneau d'actions

## Validation
Si le ressenti est meilleur, on pourra ensuite faire une vraie integration complete dans `main` avec :
- modales plus lisibles
- contexte diplomatique plus riche
- meilleur placement des boutons autour des actions de guerre
- distinctions plus historiques et situationnelles
