import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const githubConfigured =
	!!process.env.AUTH_GITHUB_ID && !!process.env.AUTH_GITHUB_SECRET;

const googleConfigured =
	!!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		...(githubConfigured
			? [
					GitHub({
						clientId: process.env.AUTH_GITHUB_ID,
						clientSecret: process.env.AUTH_GITHUB_SECRET,
					}),
				]
			: []),
		...(googleConfigured
			? [
					Google({
						clientId: process.env.AUTH_GOOGLE_ID,
						clientSecret: process.env.AUTH_GOOGLE_SECRET,
					}),
				]
			: []),
	],
	pages: {
		signIn: "/signin",
	},
});

