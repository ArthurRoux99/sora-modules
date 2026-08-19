# 🎯 Sora Extension Toolkit

Toolkit complet pour la création et la gestion d'extensions Sora destinées aux sites de streaming d'animes. Ce toolkit permet d'analyser les sites, générer les modules, les tester et les déployer de manière automatisée et assistée.

## 📋 Pré-requis

- Node.js 18+
- Ollama (Optionnel, recommandé pour l'assistant IA local)

## 🚀 Installation

Clonez ce dépôt, puis installez les dépendances :

```bash
npm install
```

## 🔄 Workflow Complet (5 Étapes)

1. **Analyser un site**
   Extrayez les informations, sélecteurs et l'architecture du site cible.
   ```bash
   npm run analyze
   ```

2. **Générer le module**
   Créez automatiquement le squelette et le code de l'extension.
   ```bash
   npm run generate
   ```

3. **Tester le module**
   Vérifiez que le module fonctionne correctement et récupère les bonnes données.
   ```bash
   npm run test-module
   ```

4. **Déployer**
   Préparez et déployez le module finalisé pour l'application Sora.
   ```bash
   npm run deploy
   ```

5. **Assistant IA**
   Utilisez l'assistant pour vous aider dans le développement de l'extension.
   ```bash
   npm run assist
   ```

## 🤖 Intégration Ollama

L'intégration d'Ollama permet de bénéficier d'une assistance LLM locale pour l'analyse des pages complexes, la génération de code et le débogage. Assurez-vous qu'Ollama fonctionne en arrière-plan avant d'utiliser la commande `npm run assist`.
