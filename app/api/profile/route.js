import { startTimetable, changeElective, ValidationError } from '@/lib/actions';
import { handle } from '@/lib/http';

export const dynamic = 'force-dynamic';

// body: { action: 'start', elective } | { action: 'change', elective }
export const POST = async (req) =>
  handle(async (email) => {
    const { action, elective } = await req.json();
    if (action === 'start') return startTimetable(email, elective);
    if (action === 'change') return changeElective(email, elective);
    throw new ValidationError('Unknown action');
  });
