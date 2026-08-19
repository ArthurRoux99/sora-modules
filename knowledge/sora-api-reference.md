# Référence API Sora

Documentation condensée de la structure et du fonctionnement d'une extension Sora. Idéal pour être utilisé comme contexte LLM.

## 1. Module JSON Schema
Ce schéma définit la structure d'une extension Sora (souvent un fichier `module.json`).

### Champs requis
- `sourceName` (string) : Nom de l'extension.
- `iconUrl` (string) : URL de l'icône de l'extension.
- `author` (object) : Structure `{ name: string, icon: string, url: string }`.
- `version` (string) : Version de l'extension (ex: "1.0.0").
- `language` (string) : Langue (ex: "fr").
- `streamType` (string) : Type de flux, 'HLS' ou 'MP4'.
- `quality` (string) : Qualité vidéo par défaut (ex: "1080p").
- `baseUrl` (string) : URL de base du site web cible.
- `searchBaseUrl` (string) : URL de recherche (doit obligatoirement contenir `%s` pour injecter la requête).
- `scriptUrl` (string) : Chemin local (ou URL) vers le script JavaScript (ex: "script.js").
- `type` (string) : Type de contenu ('anime', 'movies', 'shows', 'novels').

### Champs requis pour la Library
- `downloadSupport` (boolean) : Si l'extension supporte le téléchargement.
- `type` (string) : Doit être spécifié.

### Champs optionnels
- `asyncJS` (boolean) : Autoriser le code asynchrone (souvent true).
- `streamAsyncJS` (boolean) : Autoriser le code asynchrone spécifiquement pour le stream.
- `softsub` (boolean) : Support des sous-titres soft (VTT/SRT).
- `combo` (boolean)
- `description` (string) : Description de l'extension.

## 2. Les 4 Fonctions JavaScript
Le fichier JavaScript de l'extension (souvent `script.js`) doit impérativement exposer ces 4 fonctions.

### searchResults(keyword)
- **Input** : `keyword` (string) - Le terme de recherche.
- **Output** : `JSON.stringify([{ title: string, image: string, href: string }])`
- **Rôle** : Retourne une liste de résultats. Le champ `href` de chaque résultat sera passé comme argument à `extractDetails` et `extractEpisodes`.

```javascript
function searchResults(keyword) {
    try {
        let results = [];
        // Logique de recherche et remplissage de results
        return JSON.stringify(results);
    } catch(e) {
        return JSON.stringify([]);
    }
}
```

### extractDetails(url)
- **Input** : `url` (string) - Le `href` d'un élément renvoyé par `searchResults`.
- **Output** : `JSON.stringify({ description: string, aliases: string, airdate: string })`
- **Astuce** : Les clés `aliases` et `airdate` peuvent être détournées pour afficher d'autres informations (comme le Studio ou les Genres) dans l'interface Sora.

```javascript
function extractDetails(url) {
    try {
        let details = { description: "", aliases: "", airdate: "" };
        // Logique d'extraction des détails
        return JSON.stringify(details);
    } catch(e) {
        return JSON.stringify({});
    }
}
```

### extractEpisodes(url)
- **Input** : `url` (string) - Le même `href` renvoyé par `searchResults`.
- **Output** : `JSON.stringify([{ href: string, number: number }])`
- **⚠️ CONTRAINTE MAJEURE** : Le champ `number` DOIT être de type `number` (utiliser `parseInt(val)`), PAS un `string`.

```javascript
function extractEpisodes(url) {
    try {
        let episodes = [];
        // Logique d'extraction
        // s'assurer que number = parseInt(numero_episode)
        return JSON.stringify(episodes);
    } catch(e) {
        return JSON.stringify([]);
    }
}
```

### extractStreamUrl(url)
- **Input** : `url` (string) - Le `href` d'un épisode renvoyé par `extractEpisodes`.
- **Output** : Supporte 3 formats (toujours renvoyés sous forme de String) :
  1. URL directe (string) : `"https://example.com/video.mp4"`
  2. JSON avec multi-serveur (stringifié) : `JSON.stringify({ streams: [{ title, streamUrl, headers }] })`
  3. JSON avec multi-serveur + sous-titres : Ajouter `subtitle: "url"` à l'objet JSON précédent.

```javascript
function extractStreamUrl(url) {
    try {
        let responseObj = {
            streams: [{
                title: "Serveur 1",
                streamUrl: "https://example.com/stream.m3u8",
                headers: { "Referer": "https://example.com/" }
            }],
            subtitle: "https://example.com/subtitles.vtt" // Optionnel
        };
        return JSON.stringify(responseObj);
    } catch(e) {
        return "";
    }
}
```

## 3. Contraintes Sora Critiques
- **console.log()** : NE SUPPORTE PAS les multiples arguments. Utilisez la concaténation.
  - ❌ `console.log("Valeur:", myVar)`
  - ✅ `console.log("Valeur: " + myVar)`
- **try/catch** : Toujours englober le code des 4 fonctions d'un `try/catch` pour éviter de faire crasher l'appli.
- **encodeURIComponent()** : Obligatoire pour traiter les inputs utilisateur (`keyword`) avant de les injecter dans une URL de requête.
- **Type de retour** : Les 4 fonctions doivent TOUJOURS retourner un `string`. Pour les objets/tableaux, utiliser `JSON.stringify()`.
- **fetch() spécifique à Sora** : Contrairement aux navigateurs web, dans Sora, `fetch(url)` retourne **directement le texte** (string) de la réponse. Il n'y a pas d'objet Response, et on ne fait pas `.text()` ou `.json()`.
- **Headers custom** : S'ils sont nécessaires pour la lecture de la vidéo, les définir impérativement dans le champ `headers: {}` de l'objet de stream.

## 4. Global Extractor
- **URL** : `https://github.com/JMcrafter26/sora-global-extractor` (nommé `global-extractor`).
- **Utilité** : Outil puissant permettant d'extraire le lien de flux direct (`.m3u8` ou `.mp4`) depuis une multitude de lecteurs vidéos web courants (Doodstream, Sibnet, Vidoza, etc.).
- **Intégration** : Le code de cet extracteur peut souvent être intégré en tête du fichier `script.js` pour gérer de façon transparente le décodage des iframes trouvées sur les sites de streaming.
