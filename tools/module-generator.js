#!/usr/bin/env node

/**
 * module-generator.js
 * Génère automatiquement l'arborescence et les fichiers d'un module Sora :
 * - modules/<NomDuModule>/module.json
 * - modules/<NomDuModule>/script.js
 * 
 * Peut être exécuté de manière interactive ou en lui passant un rapport d'analyse.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

const ROOT_DIR = process.cwd();
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const MODULES_DIR = path.join(ROOT_DIR, 'modules');

function sanitizeModuleName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function generateModule(config) {
    const moduleName = sanitizeModuleName(config.sourceName);
    const targetDir = path.join(MODULES_DIR, moduleName);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Génération de module.json
    const manifestTemplatePath = path.join(TEMPLATES_DIR, 'module.json.template');
    let manifestContent = fs.readFileSync(manifestTemplatePath, 'utf-8');

    const manifestReplacements = {
        '{{SOURCE_NAME}}': config.sourceName || moduleName,
        '{{ICON_URL}}': config.iconUrl || `https://www.google.com/s2/favicons?sz=128&domain_url=${config.baseUrl}`,
        '{{AUTHOR_NAME}}': config.authorName || 'Anonymous',
        '{{AUTHOR_ICON}}': config.authorIcon || 'https://github.githubassets.com/favicons/favicon.png',
        '{{AUTHOR_URL}}': config.authorUrl || '',
        '{{LANGUAGE}}': config.language || 'French (SUB)',
        '{{STREAM_TYPE}}': config.streamType || 'HLS',
        '{{QUALITY}}': config.quality || '1080p',
        '{{BASE_URL}}': config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`,
        '{{SEARCH_BASE_URL}}': config.searchBaseUrl || `${config.baseUrl}/?s=%s`,
        '{{SCRIPT_URL}}': config.scriptUrl || `https://raw.githubusercontent.com/username/sora-modules/main/modules/${moduleName}/script.js`,
        '{{TYPE}}': config.type || 'anime',
        '{{DOWNLOAD_SUPPORT}}': config.downloadSupport ?? false,
        '{{SOFTSUB}}': config.softsub ?? false
    };

    for (const [placeholder, value] of Object.entries(manifestReplacements)) {
        manifestContent = manifestContent.replaceAll(placeholder, String(value));
    }

    const manifestPath = path.join(targetDir, 'module.json');
    fs.writeFileSync(manifestPath, manifestContent, 'utf-8');

    // 2. Génération de script.js
    const scriptTemplatePath = path.join(TEMPLATES_DIR, 'script.js.template');
    let scriptContent = fs.readFileSync(scriptTemplatePath, 'utf-8');

    const scriptReplacements = {
        '{{SOURCE_NAME}}': config.sourceName || moduleName,
        '{{BASE_URL}}': config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`,
        '{{SEARCH_BASE_URL}}': config.searchBaseUrl || `${config.baseUrl}/?s=`,
        '{{LANGUAGE}}': config.language || 'French (SUB)'
    };

    for (const [placeholder, value] of Object.entries(scriptReplacements)) {
        scriptContent = scriptContent.replaceAll(placeholder, String(value));
    }

    const scriptPath = path.join(targetDir, 'script.js');
    fs.writeFileSync(scriptPath, scriptContent, 'utf-8');

    console.log(chalk.green(`\n✅ Module [${chalk.bold(moduleName)}] généré avec succès !`));
    console.log(chalk.white(`- Manifest : ${chalk.cyan(manifestPath)}`));
    console.log(chalk.white(`- Script   : ${chalk.cyan(scriptPath)}`));
    console.log(chalk.yellow(`\n👉 Étape suivante : Utilisez le LLM pour adapter les sélecteurs et extracteurs du script :`));
    console.log(chalk.gray(`   npm run assist -- --module=${moduleName}\n`));

    return { manifestPath, scriptPath, targetDir };
}

// Mode Interactif CLI
async function runInteractive() {
    console.log(chalk.bold.blue('✨ Sora Extension Generator ✨\n'));

    // Vérifier si un rapport d'analyse existe
    const reportsDir = path.join(ROOT_DIR, 'reports');
    let reportData = null;

    if (fs.existsSync(reportsDir)) {
        const reports = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
        if (reports.length > 0) {
            const { useReport } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'useReport',
                    message: `Un rapport d'analyse récent a été trouvé (${reports[reports.length - 1]}). Voulez-vous pré-remplir avec ce rapport ?`,
                    default: true
                }
            ]);

            if (useReport) {
                const latestReport = path.join(reportsDir, reports[reports.length - 1]);
                reportData = JSON.parse(fs.readFileSync(latestReport, 'utf-8'));
            }
        }
    }

    const defaultName = reportData ? new URL(reportData.baseUrl).hostname.split('.')[0] : 'MonAnimeSite';
    const defaultBaseUrl = reportData ? reportData.baseUrl : 'https://exemple-anime.com';
    const defaultSearchUrl = reportData ? reportData.search.estimatedSearchUrl : `${defaultBaseUrl}/?s=%s`;

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'sourceName',
            message: 'Nom du module / de la source :',
            default: defaultName
        },
        {
            type: 'input',
            name: 'baseUrl',
            message: 'URL de base du site web :',
            default: defaultBaseUrl
        },
        {
            type: 'input',
            name: 'searchBaseUrl',
            message: 'URL de recherche (avec %s comme mot-clé) :',
            default: defaultSearchUrl
        },
        {
            type: 'list',
            name: 'language',
            message: 'Langue principale :',
            choices: [
                'French (SUB)',
                'French (DUB)',
                'French (SUB/DUB)',
                'English (SUB)',
                'English (DUB)'
            ],
            default: 'French (SUB)'
        },
        {
            type: 'list',
            name: 'streamType',
            message: 'Type de flux vidéo par défaut :',
            choices: ['HLS', 'MP4'],
            default: 'HLS'
        },
        {
            type: 'input',
            name: 'authorName',
            message: 'Nom de l\'auteur :',
            default: 'Dev'
        }
    ]);

    await generateModule(answers);
}

if (process.argv[1]?.endsWith('module-generator.js')) {
    runInteractive();
}
