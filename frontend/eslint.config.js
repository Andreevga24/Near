import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Загрузка данных в useEffect + setState — нормальный паттерн; правило конфликтует с ним.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/context/**/*.tsx', 'src/components/board/boardFlowContext.tsx'],
    rules: {
      // Контекстные файлы экспортируют и провайдер, и хук — это ожидаемо.
      'react-refresh/only-export-components': 'off',
    },
  },
])
