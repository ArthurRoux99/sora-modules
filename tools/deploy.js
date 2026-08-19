#!/usr/bin/env node

/**
 * deploy.js
 * Outil de déploiement et d'hébergement local pour modules Sora :
 * 1. Prépare les URLs pour GitHub Raw ou hébergement distant.
 * 2. Démarre un serveur HTTP local pour tester immédiatement sur votre iPhone / iPad / Mac sur le même réseau WiFi.
 * 3. Génère les liens profonds sora:// pour ajouter le module en un clic.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';

const ROOT_DIR = process.cwd();
const MODULES_DIR = path.join(ROOT_DIR, 'modules');

// Récupère l'IP locale (WiFi / Ethernet)
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// Serveur HTTP local pour servir les modules
function startLocalServer(port = 8080) {
    const server = http.createServer((req, res) => {
        // En-têtes CORS pour autoriser l'app Sora
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const cleanUrl = req.url.split('?')[0];
        let filePath = path.join(ROOT_DIR, cleanUrl);

        // Si le chemin pointe vers un dossier, chercher module.json
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'module.json');
        }

        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 Not Found: ${cleanUrl}`);
            return;
        }

        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        if (ext === '.json') contentType = 'application/json';
        if (ext === '.js') contentType = 'application/javascript';

        res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
        fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => {
        const localIP = getLocalIP();
        console.log(chalk.bold.green(`\n🚀 Serveur Local Sora démarré sur le port ${port} !`));
        console.log(chalk.white(`- Accès Machine : ${chalk.cyan(`http://localhost:${port}`)}`));
        console.log(chalk.white(`- Accès Réseau (iOS/Mac) : ${chalk.cyan(`http://${localIP}:${port}`)}`));
    });

    return server;
}

async function main() {
    console.log(chalk.bold.blue('📦 Déploiement & Partage de Module Sora 📦\n'));

    if (!fs.existsSync(MODULES_DIR)) {
        console.log(chalk.red('Dossier modules/ inexistant.'));
        process.exit(1);
    }

    const availableModules = fs.readdirSync(MODULES_DIR).filter(f => fs.statSync(path.join(MODULES_DIR, f)).isDirectory());

    if (availableModules.length === 0) {
        console.log(chalk.yellow('Aucun module disponible à déployer.'));
        process.exit(0);
    }

    const { targetModule, mode } = await inquirer.prompt([
        {
            type: 'list',
            name: 'targetModule',
            message: 'Choisissez le module à déployer :',
            choices: availableModules
        },
        {
            type: 'list',
            name: 'mode',
            message: 'Mode de distribution souhaité :',
            choices: [
                { name: '1. Serveur local (Test instantané sur iPhone / Mac en WiFi)', value: 'local' },
                { name: '2. Générer les URLs GitHub Raw (Production)', value: 'github' }
            ]
        }
    ]);

    const moduleDir = path.join(MODULES_DIR, targetModule);
    const manifestPath = path.join(moduleDir, 'module.json');

    if (mode === 'local') {
        const port = 8080;
        const localIP = getLocalIP();
        const localManifestUrl = `http://${localIP}:${port}/modules/${targetModule}/module.json`;
        const localScriptUrl = `http://${localIP}:${port}/modules/${targetModule}/script.js`;

        // Mise à jour temporaire du scriptUrl pour le test local
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifest.scriptUrl = localScriptUrl;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

        startLocalServer(port);

        console.log(chalk.yellow('\n📲 Pour installer ce module sur votre app Sora :'));
        console.log(chalk.white(`1. Ouvrez Sora sur votre appareil (connecté au même WiFi).`));
        console.log(chalk.white(`2. Allez dans l'onglet ${chalk.bold('Modules')} > Appuyez sur ${chalk.bold('+')}.`));
        console.log(chalk.white(`3. Collez cette URL :`));
        console.log(chalk.bold.magenta(`   ${localManifestUrl}\n`));
        console.log(chalk.gray('Laissez ce terminal ouvert pendant vos tests.\nAppuyez sur Ctrl+C pour arrêter le serveur.'));
    } else if (mode === 'github') {
        const { username, repo } = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'Votre nom d\'utilisateur GitHub :',
                default: 'username'
            },
            {
                type: 'input',
                name: 'repo',
                message: 'Nom de votre dépôt GitHub :',
                default: 'sora-modules'
            }
        ]);

        const rawBaseUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/modules/${targetModule}`;
        const rawManifestUrl = `${rawBaseUrl}/module.json`;
        const rawScriptUrl = `${rawBaseUrl}/script.js`;

        // Mise à jour du scriptUrl dans le manifest
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifest.scriptUrl = rawScriptUrl;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

        console.log(chalk.green('\n✔ Manifest mis à jour pour GitHub Raw !'));
        console.log(chalk.white(`- URL Manifest : ${chalk.cyan(rawManifestUrl)}`));
        console.log(chalk.white(`- URL Script   : ${chalk.cyan(rawScriptUrl)}`));
        console.log(chalk.yellow('\n👉 Étapes suivantes :'));
        console.log(chalk.white('1. Commitez et poussez votre dossier sur GitHub :'));
        console.log(chalk.gray(`   git add . && git commit -m "Add ${targetModule} module" && git push`));
        console.log(chalk.white('2. Partagez l\'URL du manifest ou ajoutez-la dans Sora :\n'));
        console.log(chalk.bold.magenta(`   ${rawManifestUrl}\n`));
    }
}

if (process.argv[1]?.endsWith('deploy.js')) {
    main();
}
