import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const googleConfigured =
	!!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		...(googleConfigured
			? [
					Google({
						clientId: process.env.AUTH_GOOGLE_ID,
						clientSecret: process.env.AUTH_GOOGLE_SECRET,
					}),
				]
			: []),
		Credentials({
			name: "Email and Password",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			authorize: async (credentials) => {
				const email = String(credentials?.email ?? "")
					.trim()
					.toLowerCase();
				const password = String(credentials?.password ?? "");

				if (!email || !password) return null;

				const user = await prisma.user.findUnique({ where: { email } });
				if (!user?.passwordHash) return null;

				const valid = await verifyPassword(password, user.passwordHash);
				if (!valid) return null;

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.image,
				};
			},
		}),
	],
	pages: {
		signIn: "/signin",
	},
	callbacks: {
		async jwt({ token, user, account }) {
			if (user) {
				token.name = user.name;
				token.email = user.email;
				token.picture = user.image;
			}

			// Only touch the DB on actual sign-in (account present), not on every token refresh.
			if (account && token.email) {
				const email = String(token.email).toLowerCase();
				const name = token.name ? String(token.name) : null;
				const image = token.picture ? String(token.picture) : null;
				const now = new Date();

				// Check if user exists
				let dbUser = await prisma.user.findUnique({ where: { email } });

				if (dbUser) {
					// Update existing user
					dbUser = await prisma.user.update({
						where: { email },
						data: {
							name,
							image,
							provider: account.provider,
							lastLoginAt: now,
							lastSeenAt: now,
						},
					});
				} else {
					// Generate username from email (take part before @)
					let username = email.split("@")[0].toLowerCase();
					
					// Ensure username is unique by checking and appending numbers if needed
					let usernameExists = await prisma.user.findUnique({
						where: { username },
					});
					let counter = 1;
					while (usernameExists) {
						username = `${email.split("@")[0].toLowerCase()}${counter}`;
						usernameExists = await prisma.user.findUnique({
							where: { username },
						});
						counter++;
					}

					// Create new user
					dbUser = await prisma.user.create({
						data: {
							username,
							email,
							name,
							image,
							provider: account.provider,
							lastLoginAt: now,
							lastSeenAt: now,
						},
					});
				}

				// Persist DB user id into the session
				token.userId = dbUser.id;
			}

			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				// @ts-expect-error - custom field
				session.user.id = token.userId;
			}
			return session;
		},
	},
});

