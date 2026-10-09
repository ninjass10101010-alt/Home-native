import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    ignores: [".expo/**", "node_modules/**", "reference/**", "screenshots/**", ".superpowers/**"],
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
