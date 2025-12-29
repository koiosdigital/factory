import js from '@eslint/js'
import ts from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import globals from 'globals'

export default ts.config(
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', '*.d.ts'],
  },

  // Base JS/TS rules
  js.configs.recommended,
  ...ts.configs.recommended,

  // Global settings for all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },

  // Vue files configuration
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: ts.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // TypeScript DOM types
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        EventListener: 'readonly',
        FormData: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        SerialPort: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      ...pluginVue.configs['flat/recommended'].rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-unused-vars': 'warn',
      'vue/no-deprecated-slot-attribute': 'off', // esp-web-tools uses slot attribute
    },
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Prettier - must be last to override other formatting rules
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'warn',
    },
  }
)
