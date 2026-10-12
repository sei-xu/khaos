import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `.claude` holds git worktrees (`.claude/worktrees/<name>`), which are
    // full checkouts of this same repo. Without this entry `eslint .` descends
    // into them and reports every problem twice — once per checkout — so the
    // counts silently double while a worktree exists.
    ignores: ['dist', 'node_modules', 'vite.config.ts', '.claude'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // substitui a regra JS nativa pela versão TS-aware
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Os módulos de contexto exportam o Provider e o hook consumidor juntos,
    // de propósito — é o padrão do ecossistema React, e separá-los custaria
    // três arquivos novos e imports mexidos em outros doze. O preço de manter
    // assim é só em dev: o Fast Refresh do Vite só troca um módulo a quente se
    // tudo que ele exporta for componente, então editar um destes arquivos dá
    // reload da página inteira em vez de hot swap. Nada no build nem em
    // produção. A regra segue valendo em todo o resto do app; aqui só estes
    // nomes de hook ficam isentos.
    files: [
      'src/lib/activeEntityContext.tsx',
      'src/lib/chat/chatActivityContext.tsx',
      'src/lib/processingContext.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'useActiveEntity',
            'useSyncActiveEntity',
            'useChatActivity',
            'useProcessingContext',
          ],
        },
      ],
    },
  }
);
