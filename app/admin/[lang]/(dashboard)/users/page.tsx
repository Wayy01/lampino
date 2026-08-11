import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { formatDate, formatDateTime } from "@/lib/admin/serialize";
import { PageHeader } from "@/components/admin/page-header";
import { UsersManager, type UserRow } from "@/components/admin/users-manager";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  const session = await requireAdmin(lang);
  const t = getAdminDict(lang);

  // Never select `password` — this data crosses into a client component.
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    lastLogin: u.lastLogin ? formatDateTime(u.lastLogin, lang) : null,
    createdAt: formatDate(u.createdAt, lang),
  }));

  return (
    <>
      <PageHeader title={t.users.title} count={rows.length} />
      <UsersManager rows={rows} currentUserId={session.userId} />
    </>
  );
}
