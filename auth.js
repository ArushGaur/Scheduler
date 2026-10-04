import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Sign in with Google. The session lives in a signed cookie (no session table needed);
// all timetable data is stored in the database against the person's Gmail address.
// Needs AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (see README). AUTH_SECRET is optional: it only
// signs the login cookie, so if it is not set the Google client secret is used for that.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  secret: process.env.AUTH_SECRET || process.env.AUTH_GOOGLE_SECRET,
  session: { strategy: 'jwt' },
  trustHost: true,
  callbacks: {
    // Only accept Google accounts whose email Google has verified.
    signIn({ account, profile }) {
      return account?.provider === 'google' ? Boolean(profile?.email_verified && profile?.email) : false;
    },
  },
});
