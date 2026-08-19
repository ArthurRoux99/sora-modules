#!/usr/bin/env node

/**
 * site-analyzer.js
 * Analyse automatiquement un site web de streaming d'anime pour détecter sa structure :
 * - SPA vs HTML classique (SvelteKit, Next.js, Nuxt, React)
 * - API REST / GraphQL / Endpoints cachés
 * - Formulaires / URLs de recherche
 * - Fiches anime, épisodes et players vidéo
 */

import * as cheerio from 'cheerio';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function fetchPage(url) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText} sur ${url}`);
    }
    return await res.text();
}

export async function analyzeSite(targetUrl) {
    const spinner = ora(`Analyse du site : ${chalk.cyan(targetUrl)}`).start();
    
    try {
        const parsedUrl = new URL(targetUrl);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        
        spinner.text = 'Récupération de la page d\'accueil...';
        const html = await fetchPage(targetUrl);
        const $ = cheerio.load(html);
        
        const report = {
            baseUrl: baseUrl,
            targetUrl: targetUrl,
            timestamp: new Date().toISOString(),
            framework: 'Static / SSR HTML',
            search: {
                method: 'HTML',
                detectedFormAction: null,
                searchParam: 'q',
                estimatedSearchUrl: null,
                graphqlApi: null
            },
            animeList: [],
            detectedApis: [],
            detectedPlayers: [],
            sampleAnime: null
        };

        // 1. Détection de SPA / Frameworks
        if (html.includes('entry_start') || html.includes('__data.json') || html.includes('svelte')) {
            report.framework = 'SvelteKit (SPA / Hydrated)';
        } else if (html.includes('__NEXT_DATA__') || html.includes('_next/static')) {
            report.framework = 'Next.js (React)';
        } else if (html.includes('__NUXT__') || html.includes('_nuxt/')) {
            report.framework = 'Nuxt.js (Vue)';
        }

        // 2. Détection d'APIs tierces connues (AniList, Kitsu, etc.)
        if (html.includes('graphql.anilist.co') || html.includes('anilist')) {
            report.search.graphqlApi = 'https://graphql.anilist.co';
            report.search.method = 'AniList GraphQL';
            report.detectedApis.push('https://graphql.anilist.co');
        }

        // 3. Détection des endpoints de recherche
        spinner.text = 'Détection des mécanismes de recherche...';
        const searchForm = $('form[action*="search"], form[role="search"], form:has(input[type="search"]), form:has(input[name*="search"]), form:has(input[name*="q"]), form:has(input[name*="keyword"])').first();
        if (searchForm.length > 0) {
            const action = searchForm.attr('action') || '';
            const fullAction = action.startsWith('http') ? action : (action.startsWith('/') ? `${baseUrl}${action}` : `${baseUrl}/${action}`);
            const inputName = searchForm.find('input[name*="search"], input[name*="q"], input[name*="keyword"], input[type="text"]').attr('name') || 'q';
            
            report.search.detectedFormAction = fullAction;
            report.search.searchParam = inputName;
            report.search.estimatedSearchUrl = `${fullAction}${fullAction.includes('?') ? '&' : '?'}${inputName}=%s`;
        } else {
            report.search.estimatedSearchUrl = `${baseUrl}/?s=%s`;
        }

        // 4. Détection des cartes d'anime
        spinner.text = 'Analyse des cartes d\'anime...';
        const animeCards = $('article, .anime-card, .poster, .film-item, .item, .bsx, .thumb, a[href*="/anime/"], a[href*="/film/"], a[href*="/vostfr/"], a[href*="/vf/"]');
        
        const foundLinks = new Set();
        animeCards.each((_, el) => {
            const card = $(el);
            const link = card.is('a') ? card.attr('href') : card.find('a').first().attr('href');
            const title = card.find('img').attr('alt') || card.find('h2, h3, .title, .name').text().trim() || card.text().trim();
            const img = card.find('img').attr('src') || card.find('img').attr('data-src') || card.find('img').attr('data-lazy-src') || '';
            
            if (link && !foundLinks.has(link) && link !== '#' && !link.startsWith('javascript:')) {
                const fullLink = link.startsWith('http') ? link : `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
                foundLinks.add(link);
                if (title && title.length > 1 && title.length < 100) {
                    report.animeList.push({
                        title: title.replace(/\s+/g, ' ').slice(0, 80),
                        image: img.startsWith('http') ? img : (img ? `${baseUrl}${img}` : ''),
                        href: fullLink
                    });
                }
            }
        });

        report.animeList = report.animeList.slice(0, 10);

        // 5. Test d'un échantillon si disponible
        if (report.animeList.length > 0) {
            const sample = report.animeList[0];
            spinner.text = `Analyse d'un anime échantillon : ${chalk.yellow(sample.title)}...`;
            try {
                const animeHtml = await fetchPage(sample.href);
                const $anime = cheerio.load(animeHtml);
                
                const desc = $anime('.description, .synopsis, .entry-content, [itemprop="description"], p:contains("Synopsis")').text().trim() ||
                             $anime('meta[property="og:description"], meta[name="description"]').attr('content') || '';
                             
                const episodeLinks = [];
                $anime('a[href*="episode"], a[href*="/ep-"], .episodes-list a, .list-ep a, ul.episodes a, select.episodes option').each((i, el) => {
                    const epEl = $anime(el);
                    const epHref = epEl.attr('href') || epEl.attr('value');
                    const epText = epEl.text().trim();
                    if (epHref && !epHref.startsWith('javascript:')) {
                        const fullEpHref = epHref.startsWith('http') ? epHref : `${baseUrl}${epHref.startsWith('/') ? '' : '/'}${epHref}`;
                        episodeLinks.push({
                            number: i + 1,
                            title: epText || `Épisode ${i + 1}`,
                            href: fullEpHref
                        });
                    }
                });
                
                const iframes = [];
                $anime('iframe, [data-player], .player-embed, script:contains("m3u8"), script:contains("mp4")').each((_, el) => {
                    const src = $anime(el).attr('src') || $anime(el).attr('data-src') || $anime(el).attr('data-player');
                    if (src) iframes.push(src);
                });
                
                report.sampleAnime = {
                    title: sample.title,
                    url: sample.href,
                    description: desc.slice(0, 200) + (desc.length > 200 ? '...' : ''),
                    episodesCount: episodeLinks.length,
                    sampleEpisodes: episodeLinks.slice(0, 5),
                    detectedIframes: iframes
                };
            } catch (err) {
                report.sampleAnime = { error: err.message };
            }
        }

        spinner.succeed(chalk.green(`Analyse terminée pour ${chalk.bold(targetUrl)}`));
        
        const outputDir = path.resolve(process.cwd(), 'reports');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        const safeName = parsedUrl.hostname.replace(/[^a-z0-9]/gi, '_');
        const reportPath = path.join(outputDir, `${safeName}_report.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
        
        console.log(chalk.blue('\n📊 Résumé de l\'analyse :'));
        console.log(chalk.white(`- Base URL     : ${chalk.bold(report.baseUrl)}`));
        console.log(chalk.white(`- Architecture : ${chalk.yellow(report.framework)}`));
        if (report.search.graphqlApi) {
            console.log(chalk.white(`- API Détectée : ${chalk.green(report.search.graphqlApi)}`));
        }
        console.log(chalk.white(`- Animes trouvés : ${chalk.cyan(report.animeList.length)}`));
        console.log(chalk.gray(`\nRapport complet enregistré dans : ${reportPath}\n`));
        
        return report;
    } catch (error) {
        spinner.fail(chalk.red(`Échec de l'analyse : ${error.message}`));
        throw error;
    }
}

if (process.argv[1]?.endsWith('site-analyzer.js')) {
    const urlArg = process.argv.slice(2).find(arg => arg.startsWith('http') || arg.startsWith('--url='));
    const target = urlArg ? (urlArg.startsWith('--url=') ? urlArg.split('=')[1] : urlArg) : null;
    
    if (!target) {
        console.log(chalk.yellow('Usage: node tools/site-analyzer.js <URL_DU_SITE>'));
        process.exit(1);
    }
    
    analyzeSite(target);
}
