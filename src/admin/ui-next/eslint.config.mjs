import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from 'typescript-eslint'; // Import typescript-eslint

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Use tseslint.config for modern flat config and explicit parser options
const eslintConfig = tseslint.config(
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Explicitly configure the TypeScript parser for type-aware linting
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json', // Point ONLY to the tsconfig in the current directory (src/admin/ui-next)
        tsconfigRootDir: __dirname, // Set the root directory for tsconfig resolution
      },
    },
    // Ensure ESLint doesn't look outside the current project directory
    ignores: ["../../**/*"], // Ignore files outside src/admin/ui-next
  }
);

export default eslintConfig;
