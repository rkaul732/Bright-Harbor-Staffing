import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: ["node_modules/**", ".next/**", "supabase/functions/**"]
  },
  ...nextVitals
];

export default config;
