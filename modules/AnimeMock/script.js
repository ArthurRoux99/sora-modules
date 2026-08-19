// AnimeMock - Module Sora de démonstration

/**
 * Recherche de contenu
 */
async function searchResults(keyword) {
    try {
        const encoded = encodeURIComponent(keyword);
        // Simulation de résultats
        const list = [
            {
                title: 'Naruto Shippuden (VOSTFR)',
                image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300',
                href: 'https://animemock.local/anime/naruto-shippuden'
            },
            {
                title: 'One Piece (VOSTFR)',
                image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300',
                href: 'https://animemock.local/anime/one-piece'
            }
        ];
        return JSON.stringify(list);
    } catch (error) {
        console.log('searchResults error: ' + error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

/**
 * Extraction des détails
 */
async function extractDetails(url) {
    try {
        const details = {
            description: 'Un jeune ninja recherche la reconnaissance de ses pairs et rêve de devenir Hokage.',
            aliases: 'Genres: Action, Aventure, Shonen',
            airdate: '2007 - 2017'
        };
        return JSON.stringify(details);
    } catch (error) {
        console.log('extractDetails error: ' + error);
        return JSON.stringify({ description: 'Erreur', aliases: 'Inconnu', airdate: 'Inconnu' });
    }
}

/**
 * Extraction des épisodes
 */
async function extractEpisodes(url) {
    try {
        const episodes = [];
        for (let i = 1; i <= 12; i++) {
            episodes.push({
                href: `${url}/episode-${i}`,
                number: parseInt(i, 10) // Nombre entier impératif pour Sora
            });
        }
        return JSON.stringify(episodes);
    } catch (error) {
        console.log('extractEpisodes error: ' + error);
        return JSON.stringify([]);
    }
}

/**
 * Extraction des flux vidéo
 */
async function extractStreamUrl(url) {
    try {
        const streamData = {
            streams: [
                {
                    title: 'Serveur 1 (FHD)',
                    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                    headers: {}
                },
                {
                    title: 'Serveur 2 (HD)',
                    streamUrl: 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hd_7.m3u8',
                    headers: {}
                }
            ]
        };
        return JSON.stringify(streamData);
    } catch (error) {
        console.log('extractStreamUrl error: ' + error);
        return JSON.stringify({ streams: [] });
    }
}
