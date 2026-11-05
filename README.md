# Appel de novembre

Site statique (« jamstack sans build ») sur la crise politique belge et la mobilisation du front commun syndical FGTB · CSC · Synova, de l'Appel de novembre 2025 à la manifestation nationale du 23 novembre 2026.

En ligne : https://ouaisfieu.github.io/appel-de-novembre/

## Déploiement (GitHub Pages)

1. Créer le dépôt `appel-de-novembre` sur le compte `ouaisfieu`.
2. Copier tout le contenu de ce dossier à la racine du dépôt, `.nojekyll` compris.
3. Dans *Settings → Pages* : choisir *Deploy from a branch*, branche `main`, dossier `/ (root)`.

Aucune dépendance, aucun build. Tous les chemins sont relatifs, sauf dans `404.html` qui utilise `<base href="/appel-de-novembre/">`.

## Mettre à jour sans toucher au HTML

| Fichier | Contenu |
|---|---|
| `data/etat.json` | Le bandeau d'alerte, l'état de la crise, les étapes, les blocages et les scénarios. **Pensez à changer `maj`.** |
| `data/agenda.json` | Les rendez-vous de la page d'accueil et de la page Agir, avec compte à rebours. `heure_inconnue: true` affiche « à confirmer ». |
| `data/chronologie.json` | La chronologie. `cat` vaut `syndical`, `gouvernement`, `social` ou `justice`. `key: true` marque un temps fort. |
| `data/sources.json` | Les sources complémentaires. La page Sources fusionne ce fichier avec les sources de la chronologie. |

Les textes de fond (dossiers, alternatives, agir) sont dans les fichiers `.html`. L'en-tête et le pied de page sont recopiés dans chaque page : modifiez-les partout à la fois, par exemple avec un rechercher-remplacer.

## Carte blanche : `boum/`

Le sous-dossier `boum/` est autonome : `index.html`, `boum.css`, `boum.js` et `data/mesures.json`. On peut y modifier les mesures du simulateur (montant, payeur, sources) et les lignes rouges des acteurs (règles `any`, `recettes_max`, `total_min`) sans toucher au code. La « preuve par l'exhaustivité » est recalculée automatiquement dans le navigateur.

## Tester en local

Le chargement des JSON par `fetch` ne fonctionne pas en `file://`. Il faut un petit serveur :

```
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

## Structure

```
boum/  (carte blanche : essai critique et simulateur)
index.html  chronologie.html  dossiers.html  alternatives.html  agir.html  sources.html  404.html
assets/css/style.css   assets/js/app.js
data/*.json
robots.txt  sitemap.xml  .nojekyll
```

Polices : Archivo et Source Serif 4 (Google Fonts). Thème clair/sombre automatique avec bascule manuelle. Pas de traceur.
