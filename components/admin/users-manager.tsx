"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  saveUser,
  deleteUser,
  type UserActionState,
} from "@/lib/admin/actions/users";
import { useAdminLang, useAdminT } from "@/lib/admin/i18n-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AdminSelect } from "@/components/admin/select";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  Field,
  TextInput,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

export type UserRow = {
  id: number;
  username: string;
  email: string;
  role: string;
  /** Pre-formatted on the server; null when the user never signed in. */
  lastLogin: string | null;
  createdAt: string;
};

const iconBtn =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

function UserDialog({
  user,
  open,
  onClose,
}: {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState<UserActionState, FormData>(
    saveUser.bind(null, user?.id ?? null),
    null,
  );

  // Close the dialog once the action reports success.
  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{user ? t.users.editUser : t.users.newUser}</DialogTitle>
        <AdminForm action={formAction} className="flex flex-col gap-4">
          <LangField />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.users.username} htmlFor="user_username">
              <TextInput
                id="user_username"
                name="username"
                defaultValue={user?.username}
                autoComplete="off"
                required
              />
            </Field>
            <Field label={t.users.email} htmlFor="user_email">
              <TextInput
                id="user_email"
                name="email"
                type="email"
                defaultValue={user?.email}
                autoComplete="off"
                required
              />
            </Field>
          </div>
          <Field
            label={t.users.password}
            htmlFor="user_password"
            hint={user ? t.users.passwordEditHint : t.users.passwordCreateHint}
          >
            <TextInput
              id="user_password"
              name="password"
              type="password"
              autoComplete="new-password"
              required={!user}
              minLength={user ? undefined : 8}
            />
          </Field>
          <Field label={t.users.role} htmlFor="user_role">
            <AdminSelect
              id="user_role"
              name="role"
              defaultValue={user?.role === "admin" ? "admin" : "editor"}
              options={[
                { value: "editor", label: t.users.roleEditor },
                { value: "admin", label: t.users.roleAdmin },
              ]}
            />
          </Field>
          <ActionNotice state={state?.error ? state : null} />
          <div className="flex justify-end">
            <SubmitButton>
              {user ? t.products.saveChanges : t.users.createUser}
            </SubmitButton>
          </div>
        </AdminForm>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({
  rows,
  currentUserId,
}: {
  rows: UserRow[];
  currentUserId: number;
}) {
  const { t, lang } = useAdminLang();
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: UserRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const columns: Column<UserRow>[] = [
    {
      key: "user",
      header: t.users.user,
      cell: (u) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{u.username}</span>
            {u.id === currentUserId && (
              <span className="label-mono shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {t.users.you}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: t.users.role,
      hideOnMobile: true,
      cell: (u) => (
        <span className="text-muted-foreground">
          {u.role === "admin" ? t.users.roleAdmin : t.users.roleEditor}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: t.users.lastLogin,
      hideOnMobile: true,
      cell: (u) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {u.lastLogin ?? t.users.never}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(u)}
            aria-label={`${t.common.edit} ${u.username}`}
            className={iconBtn}
          >
            <Pencil className="h-4 w-4" />
          </button>
          {/* Never offer deleting yourself or the last remaining account. */}
          {u.id !== currentUserId && rows.length > 1 && (
            <ConfirmButton
              action={deleteUser.bind(null, lang, currentUserId, u.id)}
              confirmLabel={t.common.sure}
              title={t.users.deleteUser}
            >
              <Trash2 className="h-4 w-4" />
            </ConfirmButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          {t.users.newUser}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        empty={
          <EmptyState
            icon={<Users className="h-8 w-8" strokeWidth={1.25} />}
            message={t.users.empty}
          />
        }
      />

      {dialogOpen && (
        <UserDialog
          key={editing?.id ?? "new"}
          user={editing}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
