#!/usr/bin/env node

/**
 * llm-assistant.js
 * Pont intelligent avec Ollama (qwen3-coder:30b / qwen2.5-coder) pour :
 * 1. Générer le code JavaScript des 4 fonctions Sora adapté à un site cible.
 * 2. Corriger automatiquement le code après échec d'un test.
 * 3. Discuter de manière interactive avec le LLM spécialisé Sora.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const ROOT_DIR = process.cwd();
const KNOWLEDGE_DIR = path.join(ROOT_DIR, 'knowledge');
const MODULES_DIR = path.join(ROOT_DIR, 'modules');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3-coder:30b';

async function checkOllama() {
    try {
        const res = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (!res.ok) return { available: false, models: [] };
        const data = await res.json();
        return { available: true, models: data.models?.map(m => m.name) || [] };
    } catch {
        return { available: false, models: [] };
    }
}

function buildSystemPrompt() {
    const soraRefPath = path.join(KNOWLEDGE_DIR, 'sora-api-reference.md');
    const patternsPath = path.join(KNOWLEDGE_DIR, 'common-patterns.md');

    let soraRef = '';
    let patterns = '';

    if (fs.existsSync(soraRefPath)) soraRef = fs.readFileSync(soraRefPath, 'utf-8');
    if (fs.existsSync(patternsPath)) patterns = fs.readFileSync(patternsPath, 'utf-8');

    return `Tu es un expert mondial dans le développement d'extensions et modules JavaScript pour l'application Sora (iOS/macOS).
Ton objectif est de générer du code JavaScript propre, asynchrone et 100% conforme aux spécifications d'exécution de Sora.

### RÈGLES CRITIQUES D'IMPLÉMENTATION SORA :
1. TOUTES LES FONCTIONS DOIVENT ÊTRE ASYNCHRONES :
   - async function searchResults(keyword)
   - async function extractDetails(url)
   - async function extractEpisodes(url)
   - async function extractStreamUrl(url)
2. APPEL RESEAU :
   - fetch() est asynchrone et renvoie une Promise résolue avec le body textuel (string).
   - Utiliser TOUJOURS : const res = await fetch(...);
   - Si la réponse est du JSON : const data = JSON.parse(res);
3. FORMATS DE RETOUR STRICTS (TOUJOURS JSON.stringify SAUF direct URL string) :
   - searchResults : JSON.stringify([{ title: string, image: string, href: string }])
   - extractDetails : JSON.stringify({ description: string, aliases: string, airdate: string })
   - extractEpisodes : JSON.stringify([{ href: string, number: number }]) -> number DOIT être parseInt(num, 10)
   - extractStreamUrl : JSON.stringify({ streams: [{ title: string, streamUrl: string, headers: object }] })
4. CONSOLE ET SÉCURITÉ :
   - console.log ne prend JAMAIS plusieurs arguments (utiliser 'texte: ' + err, PAS 'texte:', err).
   - Toujours envelopper le corps de chaque fonction dans un try/catch pour éviter tout crash de l'app.

### DOCUMENTATION SORA DE RÉFÉRENCE :
${soraRef}

### PATTERNS DE SCRAPING COURANTS :
${patterns}
`;
}

async function callOllama(prompt, model = DEFAULT_MODEL, systemPrompt = buildSystemPrompt()) {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: false
        })
    });

    if (!res.ok) {
        throw new Error(`Erreur Ollama HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    return json.message?.content || '';
}

function extractCodeBlock(markdown) {
    const codeMatch = markdown.match(/```(?:javascript|js)?\n([\s\S]*?)```/i);
    return codeMatch ? codeMatch[1].trim() : markdown.trim();
}

export async function generateModuleCode(moduleName, siteReport, model = DEFAULT_MODEL) {
    const spinner = ora(`Génération du code Sora avec Ollama [${model}]...`).start();

    try {
        const prompt = `Voici les informations et la structure du site analysé :
${JSON.stringify(siteReport, null, 2)}

Génère le fichier JavaScript complet (\`script.js\`) pour ce module Sora nommé "${moduleName}".
N'oublie pas :
- Toutes les 4 fonctions DOIVENT être \`async\` et utiliser \`await fetch(...)\`.
- episode.number DOIT être un \`number\` (parseInt).
- Fournis UNIQUEMENT le code JavaScript dans un bloc de code.`;

        const response = await callOllama(prompt, model);
        const code = extractCodeBlock(response);

        const scriptPath = path.join(MODULES_DIR, moduleName, 'script.js');
        fs.writeFileSync(scriptPath, code, 'utf-8');

        spinner.succeed(chalk.green(`Code généré et enregistré dans : ${chalk.bold(scriptPath)}`));
        return code;
    } catch (error) {
        spinner.fail(chalk.red(`Erreur de génération : ${error.message}`));
        throw error;
    }
}

export async function fixModuleCode(moduleName, testErrors, model = DEFAULT_MODEL) {
    const scriptPath = path.join(MODULES_DIR, moduleName, 'script.js');
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Le fichier script.js pour le module ${moduleName} n'existe pas.`);
    }

    const currentCode = fs.readFileSync(scriptPath, 'utf-8');
    const spinner = ora(`Correction du code avec Ollama [${model}]...`).start();

    try {
        const prompt = `Voici le code actuel du module Sora (${moduleName}) :
\`\`\`javascript
${currentCode}
\`\`\`

Voici les erreurs détectées lors des tests unitaires :
${testErrors}

Corrige le code pour résoudre ces erreurs tout en respectant scrupuleusement les contraintes de format de Sora (async, await fetch, return JSON.stringify).
Renvoie UNIQUEMENT le code JavaScript complet corrigé dans un bloc de code.`;

        const response = await callOllama(prompt, model);
        const fixedCode = extractCodeBlock(response);

        fs.writeFileSync(scriptPath, fixedCode, 'utf-8');
        spinner.succeed(chalk.green(`Code corrigé enregistré avec succès dans : ${chalk.bold(scriptPath)}`));
        return fixedCode;
    } catch (error) {
        spinner.fail(chalk.red(`Erreur de correction : ${error.message}`));
        throw error;
    }
}

async function main() {
    console.log(chalk.bold.magenta('🤖 Sora LLM Assistant (Ollama) 🤖\n'));

    const { available, models } = await checkOllama();
    if (!available) {
        console.log(chalk.red(`❌ Ollama n'est pas accessible sur ${OLLAMA_HOST}.`));
        console.log(chalk.yellow('💡 Assurez-vous qu\'Ollama est lancé (`ollama serve`) et qu\'un modèle comme qwen3-coder:30b est installé.'));
        process.exit(1);
    }

    console.log(chalk.green(`✔ Connexion Ollama réussie !`));
    console.log(chalk.gray(`Modèles disponibles : ${models.join(', ') || 'aucun'}\n`));

    let chosenModel = DEFAULT_MODEL;
    if (!models.includes(DEFAULT_MODEL) && models.length > 0) {
        const preferred = models.find(m => m.includes('qwen') || m.includes('coder')) || models[0];
        console.log(chalk.yellow(`Modèle '${DEFAULT_MODEL}' non trouvé. Utilisation de : ${preferred}`));
        chosenModel = preferred;
    }

    if (!fs.existsSync(MODULES_DIR)) fs.mkdirSync(MODULES_DIR, { recursive: true });
    const availableModules = fs.readdirSync(MODULES_DIR).filter(f => fs.statSync(path.join(MODULES_DIR, f)).isDirectory());

    if (availableModules.length === 0) {
        console.log(chalk.yellow('Aucun module existant trouvé dans modules/.'));
        process.exit(0);
    }

    const { targetModule, action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'targetModule',
            message: 'Choisissez le module sur lequel travailler :',
            choices: availableModules
        },
        {
            type: 'list',
            name: 'action',
            message: 'Quelle opération souhaitez-vous effectuer ?',
            choices: [
                { name: '1. Générer le code à partir d\'un rapport d\'analyse', value: 'generate' },
                { name: '2. Discuter / Améliorer le code avec le LLM', value: 'chat' },
                { name: '3. Quitter', value: 'exit' }
            ]
        }
    ]);

    if (action === 'exit') return;

    if (action === 'generate') {
        const reportsDir = path.join(ROOT_DIR, 'reports');
        let siteReport = {};
        if (fs.existsSync(reportsDir)) {
            const reports = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
            if (reports.length > 0) {
                siteReport = JSON.parse(fs.readFileSync(path.join(reportsDir, reports[reports.length - 1]), 'utf-8'));
            }
        }
        await generateModuleCode(targetModule, siteReport, chosenModel);
    } else if (action === 'chat') {
        console.log(chalk.cyan(`\n💬 Session de chat ouverte avec ${chosenModel}. Tapez 'exit' pour quitter.\n`));
        const scriptPath = path.join(MODULES_DIR, targetModule, 'script.js');
        let currentCode = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf-8') : '';

        while (true) {
            const { userInput } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'userInput',
                    message: chalk.blue('Vous >')
                }
            ]);

            if (!userInput || userInput.toLowerCase() === 'exit') break;

            const spinner = ora('Réflexion du LLM...').start();
            try {
                const prompt = `Module concerné: ${targetModule}
Code actuel:
\`\`\`javascript
${currentCode}
\`\`\`

Demande de l'utilisateur:
${userInput}`;

                const reply = await callOllama(prompt, chosenModel);
                spinner.stop();
                console.log(chalk.magenta('\nAssistant Sora :'));
                console.log(reply);
                console.log('\n');

                if (reply.includes('```javascript') || reply.includes('```js')) {
                    const { apply } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'apply',
                            message: 'Voulez-vous sauvegarder ce code dans script.js ?',
                            default: false
                        }
                    ]);
                    if (apply) {
                        const newCode = extractCodeBlock(reply);
                        fs.writeFileSync(scriptPath, newCode, 'utf-8');
                        currentCode = newCode;
                        console.log(chalk.green('✔ Fichier script.js mis à jour !'));
                    }
                }
            } catch (err) {
                spinner.fail(chalk.red(`Erreur: ${err.message}`));
            }
        }
    }
}

if (process.argv[1]?.endsWith('llm-assistant.js')) {
    main();
}
