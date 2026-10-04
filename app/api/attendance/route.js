import { setAttendance, clearAttendance } from '@/lib/actions';
import { handle } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const POST = async (req) => handle(async (email) => setAttendance(email, await req.json()));

export const DELETE = async (req) =>
  handle((email) => {
    const p = new URL(req.url).searchParams;
    return clearAttendance(email, Number(p.get('class_id')), p.get('date'));
  });
