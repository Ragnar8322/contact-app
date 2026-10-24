import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", {
        allowConstantExport: true,
        // Hooks y variantes que viven a propósito junto a su componente (contextos y shadcn/ui)
        allowExportNames: [
          "useAuth", "useCampana", "useFormField", "useSidebar", "toast",
          "badgeVariants", "buttonVariants", "toggleVariants", "navigationMenuTriggerStyle",
        ],
      }],
      // Las variables sin usar las verifica TypeScript (noUnusedLocals / noUnusedParameters)
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
