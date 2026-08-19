// Re:ANIME - Module Sora
// Utilise l'API AniList GraphQL pour la recherche/métadonnées et l'API Flix de Re:ANIME pour les flux vidéo.

const ANILIST_API = "https://graphql.anilist.co";
const REANIME_BASE = "https://reanime.to";

/**
 * Exécute une requête GraphQL vers AniList
 */
async function queryAniList(query, variables) {
    const rawRes = await fetch(ANILIST_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ query: query, variables: variables })
    });
    return JSON.parse(rawRes);
}

/**
 * Recherche de contenu par mot-clé
 * @param {string} keyword
 * @returns {string} JSON stringifié [{title, image, href}]
 */
async function searchResults(keyword) {
    try {
        const query = `
        query ($search: String) {
          Page(page: 1, perPage: 20) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              title {
                english
                romaji
                userPreferred
              }
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        }`;

        const data = await queryAniList(query, { search: keyword });
        const mediaList = data?.data?.Page?.media || [];

        const results = mediaList.map(item => {
            const title = item.title.english || item.title.romaji || item.title.userPreferred || "Sans titre";
            const image = item.coverImage.extraLarge || item.coverImage.large || item.coverImage.medium || "";
            const href = `${REANIME_BASE}/anime/${item.id}`;
            return {
                title: title,
                image: image,
                href: href
            };
        });

        return JSON.stringify(results);
    } catch (e) {
        console.log("searchResults error: " + e);
        return JSON.stringify([{ title: "Error", image: "", href: "" }]);
    }
}

/**
 * Extraction des détails d'un anime
 * @param {string} url
 * @returns {string} JSON stringifié {description, aliases, airdate}
 */
async function extractDetails(url) {
    try {
        const match = url.match(/\/anime\/(\d+)/);
        const anilistId = match ? parseInt(match[1], 10) : 20;

        const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            description(asHtml: false)
            genres
            averageScore
            seasonYear
            episodes
            status
          }
        }`;

        const data = await queryAniList(query, { id: anilistId });
        const media = data?.data?.Media;

        const cleanDesc = (media?.description || "Aucune description disponible.").replace(/<[^>]+>/g, "").trim();
        const genres = media?.genres ? media.genres.join(", ") : "Anime";
        const score = media?.averageScore ? `Note: ${media.averageScore}%` : "";
        const aliases = `${genres} | ${score}`.trim();
        const year = media?.seasonYear || "Inconnue";
        const epCount = media?.episodes ? `${media.episodes} eps` : "";
        const airdate = `${year} (${epCount})`.trim();

        return JSON.stringify({
            description: cleanDesc,
            aliases: aliases,
            airdate: airdate
        });
    } catch (e) {
        console.log("extractDetails error: " + e);
        return JSON.stringify({
            description: "Erreur lors de la récupération des détails.",
            aliases: "Inconnu",
            airdate: "Inconnu"
        });
    }
}

/**
 * Extraction des épisodes d'un anime
 * @param {string} url
 * @returns {string} JSON stringifié [{href, number}]
 */
async function extractEpisodes(url) {
    try {
        const match = url.match(/\/anime\/(\d+)/);
        const anilistId = match ? parseInt(match[1], 10) : 20;

        const query = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            episodes
          }
        }`;

        const data = await queryAniList(query, { id: anilistId });
        const epTotal = data?.data?.Media?.episodes || 1;

        const episodes = [];
        for (let i = 1; i <= epTotal; i++) {
            episodes.push({
                href: `${REANIME_BASE}/watch/${anilistId}?ep=${i}`,
                number: parseInt(i, 10)
            });
        }

        return JSON.stringify(episodes);
    } catch (e) {
        console.log("extractEpisodes error: " + e);
        return JSON.stringify([]);
    }
}

/**
 * Extraction des flux de streaming pour un épisode
 * @param {string} url
 * @returns {string} JSON stringifié {streams: [{title, streamUrl, headers}]}
 */
async function extractStreamUrl(url) {
    try {
        const idMatch = url.match(/\/watch\/(\d+)/);
        const epMatch = url.match(/[?&]ep=(\d+)/);

        const anilistId = idMatch ? idMatch[1] : "20";
        const episodeNum = epMatch ? epMatch[1] : "1";

        const flixUrl = `${REANIME_BASE}/api/flix/${anilistId}/${episodeNum}`;
        const rawRes = await fetch(flixUrl, {
            headers: {
                "Accept": "application/json"
            }
        });

        const data = JSON.parse(rawRes);
        const streams = [];

        if (data && data.success && Array.isArray(data.servers)) {
            for (const server of data.servers) {
                if (server.dataLink) {
                    const langType = server.dataType ? ` [${server.dataType.toUpperCase()}]` : "";
                    const serverName = server.serverName || "Serveur";
                    streams.push({
                        title: `${serverName}${langType}`,
                        streamUrl: server.dataLink,
                        headers: {
                            "Referer": "https://reanime.to/"
                        }
                    });
                }
            }
        }

        return JSON.stringify({ streams: streams });
    } catch (e) {
        console.log("extractStreamUrl error: " + e);
        return JSON.stringify({ streams: [] });
    }
}