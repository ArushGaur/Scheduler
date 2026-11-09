import { addRoutine, updateRoutine, deleteRoutine } from '@/lib/actions';
import { handle } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const POST = async (req) => handle(async (email) => addRoutine(email, await req.json()));

export const PUT = async (req) =>
  handle(async (email) => {
    const body = await req.json();
    return updateRoutine(email, String(body.id), body);
  });

export const DELETE = async (req) => handle((email) => deleteRoutine(email, String(new URL(req.url).searchParams.get('id'))));
