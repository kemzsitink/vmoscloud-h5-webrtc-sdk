import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "node_modules/**", "rollup.config.mjs"],
    },
    ...tseslint.configs.strict,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-non-null-assertion": "warn",
            "eqeqeq": ["error", "always"],
            "no-var": "error",
            "prefer-const": "error",
        },
    }
);
