import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Password-based auth (Convex Auth). Sign-up collects display name + avatar in
// addition to email/password; the `profile` callback maps them onto the users row.
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string | undefined) ?? "",
          avatarUrl: params.avatarUrl as string | undefined,
        };
      },
    }),
  ],
});
