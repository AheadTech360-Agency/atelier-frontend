import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { usePagedList } from "@/lib/paged";
import { useSession } from "@/lib/session";
import { agentName, bytes } from "@/lib/format";
import { Badge, Button, ConfirmDelete, Dialog, EmptyState, ErrorNote, Field, IconButton, Input, LoadMore, Panel, Select, Skeleton, TextField, cx, errorText, useToast } from "../ui";
import type { Asset } from "@/api-types/Asset";
import type { UploadTicket } from "@/api-types/UploadTicket";
import type { SignedUrl } from "@/api-types/SignedUrl";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
const TAGS = ["product", "lifestyle", "store", "team", "decorative", "logo"];

export function AssetsTab({ clientId }: { clientId: string }) {
  const { canReview } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; done: boolean; error?: string }[]>([]);
  const [uploadTags, setUploadTags] = useState<string[]>(["product"]);
  const [editing, setEditing] = useState<Asset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const q = usePagedList<Asset>(["assets", clientId], `/clients/${clientId}/assets`, { tag, search }, 40);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => ACCEPT.includes(f.type));
    const skipped = Array.from(files).length - list.length;
    if (skipped) toast(`${skipped} file${skipped > 1 ? "s" : ""} skipped: only JPG, PNG, WebP, GIF, AVIF and SVG images upload.`, "error");
    if (!list.length) return;
    setUploading(list.map((f) => ({ name: f.name, done: false })));
    for (const [i, file] of list.entries()) {
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error("Larger than 25 MB");
        const ticket = await api.post<UploadTicket>(`/clients/${clientId}/assets/upload`, {
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          tags: uploadTags,
        });
        // Straight to Cloudflare R2 with the signed URL; the file never passes through our server.
        const put = await fetch(ticket.upload.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } }).catch(() => null);
        if (!put || !put.ok) {
          await api.del(`/assets/${ticket.asset.id}`).catch(() => undefined);
          throw new Error(
            put ? `R2 refused the upload (${put.status}). Check the bucket's CORS rules.` : "Couldn't reach R2. Check the bucket's CORS rules allow this site.",
          );
        }
        setUploading((u) => u.map((x, j) => (j === i ? { ...x, done: true } : x)));
      } catch (e) {
        setUploading((u) => u.map((x, j) => (j === i ? { ...x, done: true, error: errorText(e) } : x)));
      }
    }
    qc.invalidateQueries({ queryKey: ["assets", clientId] });
    setTimeout(() => setUploading((u) => u.filter((x) => x.error)), 2500);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canReview) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-4">
      {canReview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            "flex flex-col gap-3 rounded-lg border border-dashed p-4 md:flex-row md:items-center",
            dragging ? "border-denim bg-denim-soft" : "border-line-strong bg-surface",
          )}
        >
          <div className="flex-1">
            <p className="font-medium">Drop images here, or choose files</p>
            <p className="text-[13px] text-ink-2">
              Stored in Cloudflare R2. Bots use these in articles first, then real Shopify product photos. Up to 25 MB each. Tag them so bots pick the right ones.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tags for new uploads">
              {TAGS.map((t) => {
                const on = uploadTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setUploadTags(on ? uploadTags.filter((x) => x !== t) : [...uploadTags, t])}
                    className={cx("h-7 rounded-md border px-2 text-[13px] capitalize", on ? "border-denim bg-denim-soft text-denim" : "border-line-strong text-ink-2")}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT.join(",")}
            className="sr-only"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <Button variant="primary" onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Choose images
          </Button>
        </div>
      ) : null}

      {uploading.length ? (
        <ul className="rounded-md border border-line bg-surface text-[13px]">
          {uploading.map((u, i) => (
            <li key={i} className="flex justify-between border-b border-line px-3 py-1.5 last:border-0">
              <span className="truncate">{u.name}</span>
              <span className={u.error ? "text-p1" : u.done ? "text-ok" : "text-ink-3"}>{u.error ?? (u.done ? "Uploaded" : "Uploading")}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Panel
        title="Images"
        actions={
          <div className="flex gap-2">
            <Input aria-label="Search images" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-40" />
            <Select aria-label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-8 w-auto">
              <option value="">All tags</option>
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : !q.items.length ? (
          <EmptyState title={tag || search ? "No images match" : "No images yet"} body={tag || search ? "Clear the search or tag filter." : "Upload store and product photos so the bots never have to guess."} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-5">
            {q.items.map((a) => (
              <AssetCard key={a.id} asset={a} onEdit={canReview ? () => setEditing(a) : undefined} />
            ))}
          </ul>
        )}
        <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
      </Panel>
      {editing ? <AssetDialog asset={editing} clientId={clientId} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function AssetCard({ asset, onEdit }: { asset: Asset; onEdit?: () => void }) {
  const url = useQuery({
    queryKey: ["asset-url", asset.id],
    queryFn: () => api.get<SignedUrl>(`/assets/${asset.id}/url`),
    staleTime: 50 * 60_000,
  });
  return (
    <li>
      <button onClick={onEdit} disabled={!onEdit} className="group block w-full text-left">
        <div className="relative aspect-square overflow-hidden rounded-md border border-line bg-sunken">
          {url.data ? (
            <img src={url.data.url} alt={asset.alt_text || asset.file_name} loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-ink-3">{url.error ? <ImageOff size={18} /> : null}</div>
          )}
          {asset.approval_status !== "approved" ? (
            <span className="absolute top-1.5 left-1.5">
              <Badge tone={asset.approval_status === "pending" ? "p2" : "p1"}>{asset.approval_status}</Badge>
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[13px] group-hover:underline">{asset.file_name}</p>
        <p className="truncate text-[12px] text-ink-3">
          {asset.source === "generated" ? `Generated by ${agentName(asset.uploaded_by_agent, true)}` : asset.tags.join(", ") || "No tags"}, {bytes(asset.size_bytes)}
        </p>
      </button>
    </li>
  );
}

function AssetDialog({ asset, clientId, onClose }: { asset: Asset; clientId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [alt, setAlt] = useState(asset.alt_text);
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [product, setProduct] = useState(asset.shopify_product_id ?? "");
  const [confirm, setConfirm] = useState(false);
  const url = useQuery({
    queryKey: ["asset-url", asset.id],
    queryFn: () => api.get<SignedUrl>(`/assets/${asset.id}/url`),
    staleTime: 50 * 60_000,
  });

  const save = useMutation({
    mutationFn: (approval_status?: string) =>
      api.put<Asset>(`/assets/${asset.id}`, {
        alt_text: alt,
        tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        shopify_product_id: product || null,
        approval_status: approval_status ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets", clientId] });
      toast("Image saved");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });
  const del = useMutation({
    mutationFn: () => api.del(`/assets/${asset.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets", clientId] });
      toast("Image deleted");
      onClose();
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={asset.file_name}
      footer={
        <>
          <IconButton label={`Delete ${asset.file_name}`} className="mr-auto" onClick={() => setConfirm(true)}>
            <Trash2 size={15} />
          </IconButton>
          {asset.approval_status === "pending" ? (
            <>
              <Button variant="danger" onClick={() => save.mutate("rejected")}>
                Reject image
              </Button>
              <Button variant="approve" onClick={() => save.mutate("approved")}>
                Approve image
              </Button>
            </>
          ) : (
            <Button variant="primary" busy={save.isPending} onClick={() => save.mutate(undefined)}>
              Save image
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Alt text" hint="Describe what's in the image. Bots reuse this on the site." value={alt} onChange={(e) => setAlt(e.target.value)} />
        <TextField label="Tags" hint="Comma separated, e.g. product, lifestyle" value={tags} onChange={(e) => setTags(e.target.value)} />
        <TextField label="Shopify product ID" value={product} onChange={(e) => setProduct(e.target.value)} />
        {url.data ? (
          <Field label="Image URL" htmlFor="asset-url" hint={url.data.permanent ? "Permanent. Bots embed this URL in articles." : "Temporary, valid for an hour. Set R2_PUBLIC_BASE_URL on the backend for permanent URLs."}>
            <div className="flex gap-2">
              <Input id="asset-url" readOnly value={url.data.url} onFocus={(e) => e.target.select()} className="font-mono text-[12.5px]" />
              <Button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(url.data!.url).then(
                    () => toast("Image URL copied"),
                    () => toast("Copy failed. Select the URL and copy it manually.", "error"),
                  )
                }
              >
                Copy URL
              </Button>
            </div>
          </Field>
        ) : null}
      </div>
      <ConfirmDelete
        open={confirm}
        onClose={() => setConfirm(false)}
        thing="image"
        name={asset.file_name}
        consequence="Bots can no longer use it. Pages already published with it are not changed."
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </Dialog>
  );
}
