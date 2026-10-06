import { adminAction } from '@/lib/actions';
import { handle } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Owner only (checked on the server in adminAction). body: { action, ...fields }
export const POST = async (req) => handle(async (email) => adminAction(email, await req.json()));
