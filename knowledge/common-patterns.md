# Patterns de Scraping Courants pour Sora

Ce document détaille les patterns habituels pour extraire des données de sites (généralement d'anime/streaming) en JavaScript dans le cadre des extensions Sora.

## Pattern 1 : Site avec API REST
C'est le scénario idéal et le plus robuste, lorsque le site cible utilise des appels XHR/Fetch pour récupérer ses données.

- **Principe** : Intercepter l'endpoint API et faire directement la requête.
- **Parsing** : La réponse étant du texte JSON (rappel : `fetch` dans Sora renvoie le texte brut), on utilise simplement `JSON.parse()`.

```javascript
// Exemple dans searchResults
let keywordEncoded = encodeURIComponent(keyword);
let apiResponseText = fetch('https://api.site.com/v1/search?q=' + keywordEncoded);
let data = JSON.parse(apiResponseText);

let results = [];
// Mapping des champs de l'API vers le format Sora
for(let i = 0; i < data.items.length; i++) {
    results.push({
        title: data.items[i].title,
        image: data.items[i].poster_image,
        href: data.items[i].slug // Ou ID, à utiliser dans extractDetails
    });
}
return JSON.stringify(results);
```

## Pattern 2 : Site HTML classique (Scraping DOM via Regex)
Sora ne fournissant pas de DOM Parser natif complet comme dans un navigateur web (pas de `document.querySelector`), le HTML brut doit être traité par expressions régulières (RegEx).

- **Principe** : Récupérer le code source de la page, et utiliser des regex pour matcher les blocs pertinents.

```javascript
let htmlContent = fetch('https://site.com/recherche/' + encodeURIComponent(keyword));
let results = [];

// Regex pour extraire un lien et son titre d'une balise <a>
// Ex: <a href="/anime/naruto" class="link">Naruto</a>
let regex = /<a[^>]*href="([^"]*?)"[^>]*>([^<]*)<\/a>/g;
let match;

// On boucle sur tous les matchs trouvés
while ((match = regex.exec(htmlContent)) !== null) {
    results.push({
        href: match[1],      // Le lien (groupe de capture 1)
        title: match[2].trim(), // Le texte (groupe de capture 2)
        image: ""            // L'image peut nécessiter une autre regex ou l'adaptation de celle-ci
    });
}
```

## Pattern 3 : Extraction de lecteur vidéo
Étape cruciale dans `extractStreamUrl`. Consiste à transformer l'URL d'une page de lecteur en un flux direct.

- **Iframe embed** : Les sites utilisent très souvent des lecteurs externes insérés via `<iframe>`. On extrait l'attribut `src` de l'iframe. Cette URL `src` peut ensuite être envoyée au `global-extractor` qui sait comment en sortir un lien de vidéo.
- **Player HLS** : Dans le code source du player, on recherche une chaîne de caractères se terminant par `.m3u8` (souvent trouvée dans une variable JS injectée dans le HTML).
- **Player MP4** : Même logique, recherche d'un lien direct `.mp4`.
- **API de streaming interne** : Certains players font un appel XHR vers une API interne avec un token pour recevoir l'URL du flux final. Le scraping implique de reproduire cet appel API (trouver le token, forger la requête `fetch`, parser le JSON retourné).
- **Cloudflare Bypass** : C'est le défi principal. Si le site est protégé par Cloudflare (mode Under Attack ou blocages agressifs), `fetch()` risque de retourner la page de défi CF et non le HTML désiré.

## Pattern 4 : Gestion des URLs
Les liens extraits du HTML sont parfois complexes ou relatifs.

- **Extraction d'ID** : Au lieu de garder une URL complète compliquée, on peut extraire un ID (numérique ou slug) depuis l'URL dans `searchResults`, puis le passer via le champ `href`. `extractDetails` et `extractEpisodes` utiliseront cet ID pour reconstruire leurs propres URLs d'API/pages.
- **Reconstruction d'URLs absolues** : Si la regex extrait `/img/poster.png`, il faut la transformer en `https://site.com/img/poster.png` en concaténant avec le `baseUrl`.
- **Encodage** : Toujours s'assurer que les chaînes variables injectées dans les requêtes URL sont passées dans `encodeURIComponent`.

## Pattern 5 : Sites français courants (VOSTFR/VF)
Les sites de streaming d'anime français suivent souvent ces architectures :
- **Page de recherche** : Une page HTML pure qui liste les résultats (Pattern 2).
- **Page détails (Anime)** : Elle regroupe souvent le synopsis (pour `extractDetails`) ET la liste des épisodes dans le même code HTML.
- **Lecteur (Player)** : Les hébergeurs les plus utilisés en France sont Sibnet, Sendvid, Doodstream, Vidoza, Uqload et Myvi.
- **Approche recommandée** : Extraire l'URL (ou l'ID) de l'iframe correspondant à un épisode, puis reléguer la logique d'extraction du flux direct à l'outil `global-extractor` qui implémente déjà la logique complexe de déchiffrement pour ces hébergeurs tiers.
