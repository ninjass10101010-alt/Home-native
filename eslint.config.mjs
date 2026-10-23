import expoConfig from "eslint-config-expo/flat.js";
import globals from "globals";

export default [
  ...expoConfig,
  {
    files: ["scripts/**/*.mjs", "*.config.js", "jest.setup.ts", "jest.resolver.js"],
    languageOptions: { globals: globals.node },
  },
  {
    ignores: [".expo/**", ".worktrees/**", "node_modules/**", "reference/**", "screenshots/**", ".superpowers/**"],
  },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Button"],
              message:
                "Use src/ui primitives — Button is banned (design-system contract).",
            },
          ],
        },
      ],
    },
  },
];
