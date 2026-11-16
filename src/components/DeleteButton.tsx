import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, ConfirmDelete, IconButton, errorText, useToast } from "./ui";

/**
 * Admin-only delete for one record: a trash icon (or a labelled button) that opens a confirm
 * dialog naming the record, then DELETEs `path` and refreshes the listed queries.
 * Renders nothing for reviewers and viewers.
 */
export function DeleteButton({
  path,
  thing,
  name,
  consequence,
  invalidate,
  onDeleted,
  labelled = false,
  typeToConfirm,
}: {
  path: string;
  /** What kind of record, lower case: "task", "report". */
  thing: string;
  /** The record's own name, shown in the dialog and on the confirm button. */
  name: string;
  consequence: string;
  /** Query key prefixes to refresh after the delete. */
  invalidate: string[];
  onDeleted?: () => void;
  /** Show "Delete" text instead of a bare icon. */
  labelled?: boolean;
  /** For big deletes: the exact text the person must type first. */
  typeToConfirm?: string;
}) {
  const { isAdmin } = useSession();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: () => api.del(path),
    onSuccess: () => {
      for (const k of invalidate) qc.invalidateQueries({ queryKey: [k] });
      toast(`${thing.charAt(0).toUpperCase()}${thing.slice(1)} deleted`);
      setOpen(false);
      onDeleted?.();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  if (!isAdmin) return null;
  const short = name.length > 60 ? `${name.slice(0, 57)}...` : name;
  return (
    <>
      {labelled ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Trash2 size={14} /> Delete
        </Button>
      ) : (
        <IconButton label={`Delete ${short}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <Trash2 size={15} />
        </IconButton>
      )}
      <ConfirmDelete
        key={open ? "open" : "closed"}
        typeToConfirm={typeToConfirm}
        open={open}
        onClose={() => setOpen(false)}
        thing={thing}
        name={short}
        consequence={consequence}
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </>
  );
}
