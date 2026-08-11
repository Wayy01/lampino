"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import {
  saveCategory,
  deleteCategory,
  reorderCategories,
  type CategoryActionState,
} from "@/lib/admin/actions/categories";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaField } from "@/components/admin/media";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  DragHandle,
  draggingRow,
  moveItem,
  useReorder,
} from "@/components/admin/reorder";
import {
  Field,
  TextInput,
  SubmitButton,
  ActionNotice,
  LangField,
} from "@/components/admin/form-controls";

export type CategoryRow = {
  id: number;
  name: string;
  name_ro: string;
  name_ru: string;
  slug: string;
  imageUrl: string | null;
  productCount: number;
  rentalCount: number;
};

const iconBtn =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

function CategoryDialog({
  category,
  open,
  onClose,
}: {
  category: CategoryRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState<CategoryActionState, FormData>(
    saveCategory.bind(null, category?.id ?? null),
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
        <DialogTitle>
          {category ? t.categories.editCategory : t.categories.newCategory}
        </DialogTitle>
        <form action={formAction} className="flex flex-col gap-4">
          <LangField />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.products.nameRo} htmlFor="cat_name_ro">
              <TextInput id="cat_name_ro" name="name_ro" defaultValue={category?.name_ro} required />
            </Field>
            <Field label={t.products.nameRu} htmlFor="cat_name_ru">
              <TextInput id="cat_name_ru" name="name_ru" defaultValue={category?.name_ru} required />
            </Field>
          </div>
          <Field label={t.categories.slug} htmlFor="cat_slug" hint={t.categories.slugHint}>
            <TextInput id="cat_slug" name="slug" defaultValue={category?.slug} className="font-mono" />
          </Field>
          <Field label={t.categories.imageUrl} htmlFor="cat_image">
            <MediaField id="cat_image" name="imageUrl" defaultValue={category?.imageUrl ?? ""} accept="image" />
          </Field>
          <ActionNotice state={state?.error ? state : null} />
          <div className="flex justify-end">
            <SubmitButton>
              {category ? t.products.saveChanges : t.categories.createCategory}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesManager({ rows }: { rows: CategoryRow[] }) {
  const t = useAdminT();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Dragging reorders locally so the rows never lag a frame behind the
  // pointer, and the new order is pushed to the server on drop. Only the id
  // order is held locally — the row data itself always comes from props, so a
  // revalidation (a rename, a new category) shows through immediately.
  const [idOrder, setIdOrder] = useState<number[] | null>(null);
  const pendingIds = useRef<number[]>([]);

  const order = useMemo(() => {
    if (!idOrder) return rows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const sorted = idOrder
      .map((id) => byId.get(id))
      .filter((r): r is CategoryRow => r !== undefined);
    const known = new Set(idOrder);
    // Anything created since the drag lands at the end rather than vanishing.
    return [...sorted, ...rows.filter((r) => !known.has(r.id))];
  }, [rows, idOrder]);

  const reorder = useReorder({
    count: order.length,
    onMove: (from, to) => {
      const ids = moveItem(
        order.map((c) => c.id),
        from,
        to,
      );
      pendingIds.current = ids;
      setIdOrder(ids);
    },
    onCommit: () => {
      const ids = pendingIds.current;
      startTransition(() => reorderCategories(ids));
    },
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: CategoryRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const columns: Column<CategoryRow>[] = [
    {
      key: "order",
      header: <span className="sr-only">{t.categories.order}</span>,
      className: "w-12 pr-0",
      cell: (c) => {
        const index = order.findIndex((r) => r.id === c.id);
        return (
          <DragHandle
            label={t.common.dragToReorder}
            {...reorder.handleProps(index)}
          />
        );
      },
    },
    {
      key: "category",
      header: t.categories.category,
      // The reorder arrows come first here, so name this the identity column.
      primary: true,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
            {c.imageUrl && (
              <Image src={c.imageUrl} alt="" fill sizes="40px" unoptimized className="object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name_ro}</div>
            <div className="truncate text-xs text-muted-foreground">{c.name_ru}</div>
          </div>
        </div>
      ),
    },
    {
      key: "slug",
      header: t.categories.slug,
      hideOnMobile: true,
      cell: (c) => (
        <span className="font-mono text-xs text-muted-foreground">{c.slug}</span>
      ),
    },
    {
      key: "usage",
      header: t.categories.inUse,
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-muted-foreground">
          {c.productCount} {t.categories.productsCount}
          {c.rentalCount > 0 &&
            ` · ${c.rentalCount} ${t.categories.rentalsCount}`}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(c)}
            aria-label={`${t.common.edit} ${c.name}`}
            className={iconBtn}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <ConfirmButton
            action={deleteCategory.bind(null, c.id)}
            confirmLabel={t.common.sure}
            title={
              c.productCount > 0
                ? `${c.productCount} ${t.categories.loseCategory}`
                : undefined
            }
          >
            <Trash2 className="h-4 w-4" />
          </ConfirmButton>
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
          {t.categories.newCategory}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={order}
        rowKey={(c) => c.id}
        rowProps={(_, i) => reorder.itemProps(i)}
        rowClassName={(_, i) => (reorder.dragIndex === i ? draggingRow : undefined)}
        empty={
          <EmptyState
            icon={<Shapes className="h-8 w-8" strokeWidth={1.25} />}
            message={t.categories.empty}
          />
        }
      />

      {dialogOpen && (
        <CategoryDialog
          key={editing?.id ?? "new"}
          category={editing}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
