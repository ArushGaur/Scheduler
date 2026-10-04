import { getSchedule } from '@/lib/actions';
import { handle } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = () => handle((email) => getSchedule(email));
