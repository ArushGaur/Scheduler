import { auth } from '@/auth';
import Login from '@/components/Login';
import TimetableApp from '@/components/TimetableApp';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.email) return <Login />;
  const { name, email, image } = session.user;
  return <TimetableApp user={{ name: name || '', email, image: image || '' }} />;
}
