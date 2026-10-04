import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { AuthError, ValidationError } from './actions';

// Runs an API handler for the signed-in person. fn receives their (verified Google) email.
export async function handle(fn) {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) throw new AuthError();
    return NextResponse.json(await fn(email));
  } catch (err) {
    const status = err instanceof AuthError ? 401 : err instanceof ValidationError ? 400 : 500;
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status });
  }
}
