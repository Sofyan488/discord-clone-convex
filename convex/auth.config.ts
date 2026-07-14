// Auth configuration consumed by Convex. CONVEX_SITE_URL is provided by the
// deployment; the auth JWT keys (JWKS / JWT_PRIVATE_KEY) are set as deployment
// environment variables by `npx @convex-dev/auth` during setup.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
