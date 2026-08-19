#!/usr/bin/env node

/**
 * module-tester.js
 * Teste localement un module Sora en émulant le runtime de l'application Sora :
 * - fetch() retourne une Promise résolue avec le texte de la réponse (string).
 * - Exécute dans l'ordre :
 *   1. searchResults("naruto" ou mot-clé personnalisé)
 *   2. extractDetails(premierResultat.href)
 *   3. extractEpisodes(premierResultat.href)
 *   4. extractStreamUrl(premierEpisode.href)
 * - Valide la conformité exacte des formats de retour JSON.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const ROOT_DIR = process.cwd();
const MODULES_DIR = path.join(ROOT_DIR, 'modules');

// Headers de simulation navigateur pour le fetch émulé
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SoraApp/1.0',
    'Accept': '*/*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
};

/**
 * Crée le bac à sable (Sandbox) simulant l'environnement JS de l'app Sora
 */
function createSoraSandbox() {
    const logs = [];

    const sandbox = {
        // Dans Sora, fetch renvoie directement une string (le body textuel)
        fetch: async (url, options = {}) => {
            const reqHeaders = { ...HEADERS, ...(options?.headers || {}) };
            const res = await globalThis.fetch(url, { ...options, headers: reqHeaders });
            if (!res.ok) {
                throw new Error(`Fetch failed with HTTP status ${res.status}: ${res.statusText}`);
            }
            return await res.text();
        },
        console: {
            log: (msg) => logs.push(String(msg)),
            error: (msg) => logs.push(`[ERROR] ${String(msg)}`),
            warn: (msg) => logs.push(`[WARN] ${String(msg)}`)
        },
        encodeURIComponent: globalThis.encodeURIComponent,
        decodeURIComponent: globalThis.decodeURIComponent,
        parseInt: globalThis.parseInt,
        parseFloat: globalThis.parseFloat,
        JSON: globalThis.JSON,
        Math: globalThis.Math,
        Date: globalThis.Date,
        RegExp: globalThis.RegExp,
        String: globalThis.String,
        Array: globalThis.Array,
        Object: globalThis.Object,
        Promise: globalThis.Promise,
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout
    };

    const context = vm.createContext(sandbox);
    return { context, logs };
}

export async function testModule(moduleName, query = 'naruto') {
    console.log(chalk.bold.cyan(`\n🧪 Lancement des tests pour le module [${moduleName}]...\n`));

    const moduleDir = path.join(MODULES_DIR, moduleName);
    const scriptPath = path.join(moduleDir, 'script.js');
    const manifestPath = path.join(moduleDir, 'module.json');

    // 1. Validation de l'existence des fichiers
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Fichier module.json manquant dans : ${manifestPath}`);
    }
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Fichier script.js manquant dans : ${scriptPath}`);
    }

    // 2. Validation du manifest JSON
    const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
    let manifest;
    try {
        manifest = JSON.parse(manifestRaw);
        console.log(chalk.green(`✔ Manifest JSON valide (${manifest.sourceName} v${manifest.version})`));
    } catch (e) {
        throw new Error(`Le fichier module.json n'est pas un JSON valide : ${e.message}`);
    }

    const scriptCode = fs.readFileSync(scriptPath, 'utf-8');
    const { context, logs } = createSoraSandbox();

    // 3. Exécution du script dans le sandbox
    try {
        vm.runInContext(scriptCode, context);
    } catch (e) {
        throw new Error(`Erreur de syntaxe / chargement dans script.js : ${e.message}`);
    }

    const report = {
        success: true,
        errors: [],
        stepResults: {}
    };

    // --- TEST 1 : searchResults ---
    const s1Spinner = ora(`Test 1/4 : searchResults("${query}")...`).start();
    let searchOutput;
    try {
        if (typeof context.searchResults !== 'function') {
            throw new Error('La fonction searchResults(keyword) n\'est pas définie');
        }
        const rawRes = await context.searchResults(query);
        if (typeof rawRes !== 'string') {
            throw new Error(`searchResults doit retourner une chaîne JSON stringifiée, reçu type: ${typeof rawRes}`);
        }
        searchOutput = JSON.parse(rawRes);
        if (!Array.isArray(searchOutput)) {
            throw new Error('Le JSON retourné par searchResults doit être un tableau (Array)');
        }
        if (searchOutput.length === 0) {
            s1Spinner.warn(chalk.yellow(`searchResults a retourné 0 résultat pour "${query}"`));
        } else {
            const first = searchOutput[0];
            if (!first.title || !first.href) {
                throw new Error(`Les éléments de searchResults doivent contenir au minimum 'title' et 'href'. Reçu: ${JSON.stringify(first)}`);
            }
            s1Spinner.succeed(chalk.green(`searchResults OK : ${searchOutput.length} résultat(s) trouvé(s) (ex: "${first.title}")`));
        }
        report.stepResults.searchResults = searchOutput;
    } catch (err) {
        s1Spinner.fail(chalk.red(`Échec de searchResults : ${err.message}`));
        report.errors.push(`searchResults: ${err.message}`);
        report.success = false;
    }

    // Si la recherche n'a pas retourné de résultat, on tente avec l'URL de base
    const sampleHref = searchOutput && searchOutput.length > 0 ? searchOutput[0].href : manifest.baseUrl;

    // --- TEST 2 : extractDetails ---
    const s2Spinner = ora(`Test 2/4 : extractDetails("${sampleHref}")...`).start();
    try {
        if (typeof context.extractDetails !== 'function') {
            throw new Error('La fonction extractDetails(url) n\'est pas définie');
        }
        const rawRes = await context.extractDetails(sampleHref);
        if (typeof rawRes !== 'string') {
            throw new Error(`extractDetails doit retourner une chaîne JSON stringifiée, reçu type: ${typeof rawRes}`);
        }
        const details = JSON.parse(rawRes);
        if (typeof details !== 'object' || details === null || Array.isArray(details)) {
            throw new Error('extractDetails doit retourner un objet JSON');
        }
        s2Spinner.succeed(chalk.green(`extractDetails OK : description (${(details.description || '').slice(0, 40)}...)`));
        report.stepResults.extractDetails = details;
    } catch (err) {
        s2Spinner.fail(chalk.red(`Échec de extractDetails : ${err.message}`));
        report.errors.push(`extractDetails: ${err.message}`);
        report.success = false;
    }

    // --- TEST 3 : extractEpisodes ---
    const s3Spinner = ora(`Test 3/4 : extractEpisodes("${sampleHref}")...`).start();
    let episodesOutput;
    try {
        if (typeof context.extractEpisodes !== 'function') {
            throw new Error('La fonction extractEpisodes(url) n\'est pas définie');
        }
        const rawRes = await context.extractEpisodes(sampleHref);
        if (typeof rawRes !== 'string') {
            throw new Error(`extractEpisodes doit retourner une chaîne JSON stringifiée, reçu type: ${typeof rawRes}`);
        }
        episodesOutput = JSON.parse(rawRes);
        if (!Array.isArray(episodesOutput)) {
            throw new Error('extractEpisodes doit retourner un tableau d\'épisodes');
        }
        if (episodesOutput.length === 0) {
            s3Spinner.warn(chalk.yellow('extractEpisodes a retourné 0 épisode'));
        } else {
            const firstEp = episodesOutput[0];
            if (!firstEp.href || firstEp.number === undefined) {
                throw new Error(`Chaque épisode doit avoir 'href' et 'number'. Reçu: ${JSON.stringify(firstEp)}`);
            }
            if (typeof firstEp.number !== 'number') {
                throw new Error(`Le champ 'number' d'un épisode DOIT être un nombre entier (number), reçu type: ${typeof firstEp.number} (valeur: ${firstEp.number})`);
            }
            s3Spinner.succeed(chalk.green(`extractEpisodes OK : ${episodesOutput.length} épisode(s) trouvé(s)`));
        }
        report.stepResults.extractEpisodes = episodesOutput;
    } catch (err) {
        s3Spinner.fail(chalk.red(`Échec de extractEpisodes : ${err.message}`));
        report.errors.push(`extractEpisodes: ${err.message}`);
        report.success = false;
    }

    // --- TEST 4 : extractStreamUrl ---
    const sampleEpHref = episodesOutput && episodesOutput.length > 0 ? episodesOutput[0].href : sampleHref;
    const s4Spinner = ora(`Test 4/4 : extractStreamUrl("${sampleEpHref}")...`).start();
    try {
        if (typeof context.extractStreamUrl !== 'function') {
            throw new Error('La fonction extractStreamUrl(url) n\'est pas définie');
        }
        const rawRes = await context.extractStreamUrl(sampleEpHref);
        if (!rawRes) {
            throw new Error('extractStreamUrl a retourné une valeur vide / null');
        }

        // Format 1 : URL string directe
        if (typeof rawRes === 'string' && (rawRes.startsWith('http://') || rawRes.startsWith('https://'))) {
            s4Spinner.succeed(chalk.green(`extractStreamUrl OK (URL directe) : ${rawRes.slice(0, 60)}...`));
            report.stepResults.extractStreamUrl = rawRes;
        } else {
            // Format 2 : JSON structuré {streams: [...], subtitle?: ...}
            const streamJson = typeof rawRes === 'string' ? JSON.parse(rawRes) : rawRes;
            if (streamJson.streams && Array.isArray(streamJson.streams)) {
                s4Spinner.succeed(chalk.green(`extractStreamUrl OK (Multi-serveurs) : ${streamJson.streams.length} flux disponible(s)`));
                report.stepResults.extractStreamUrl = streamJson;
            } else if (streamJson.streamUrl) {
                s4Spinner.succeed(chalk.green(`extractStreamUrl OK (Stream avec sous-titres) : ${streamJson.streamUrl.slice(0, 60)}...`));
                report.stepResults.extractStreamUrl = streamJson;
            } else {
                throw new Error(`Format de retour extractStreamUrl non reconnu : ${typeof rawRes === 'string' ? rawRes.slice(0, 100) : JSON.stringify(rawRes)}`);
            }
        }
    } catch (err) {
        s4Spinner.fail(chalk.red(`Échec de extractStreamUrl : ${err.message}`));
        report.errors.push(`extractStreamUrl: ${err.message}`);
        report.success = false;
    }

    console.log('\n----------------------------------------');
    if (report.success) {
        console.log(chalk.bold.green('🎉 FÉLICITATIONS : Tous les tests sont passés avec succès ! Le module est prêt pour Sora !'));
    } else {
        console.log(chalk.bold.red(`❌ ${report.errors.length} erreur(s) détectée(s) lors des tests :`));
        report.errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
        console.log(chalk.yellow('\n💡 Conseil : Utilisez l\'assistant LLM pour corriger automatiquement ces erreurs :'));
        console.log(chalk.gray(`   npm run assist`));
    }
    console.log('----------------------------------------\n');

    return report;
}

// Mode CLI
async function main() {
    const modulesDir = MODULES_DIR;
    if (!fs.existsSync(modulesDir)) {
        console.log(chalk.red('Dossier modules/ inexistant.'));
        process.exit(1);
    }

    const availableModules = fs.readdirSync(modulesDir).filter(f => fs.statSync(path.join(modulesDir, f)).isDirectory());

    if (availableModules.length === 0) {
        console.log(chalk.yellow('Aucun module à tester. Créez-en un avec : npm run generate'));
        process.exit(0);
    }

    let targetModule = process.argv.slice(2).find(arg => !arg.startsWith('-'));

    if (!targetModule) {
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'targetModule',
                message: 'Sélectionnez le module à tester :',
                choices: availableModules
            },
            {
                type: 'input',
                name: 'query',
                message: 'Terme de recherche pour le test :',
                default: 'one piece'
            }
        ]);
        await testModule(answer.targetModule, answer.query);
    } else {
        await testModule(targetModule);
    }
}

if (process.argv[1]?.endsWith('module-tester.js')) {
    main();
}
