"use client";

import { useRef, useState, type ComponentProps } from "react";
import { CircleAlert, CircleCheck, Film, LoaderCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_LIMITS_MB, looksLikeVideo, type UploadResult } from "@/lib/admin/media";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { TextInput } from "@/components/admin/form-controls";
import { ResilientImage, type ImageStatus } from "@/components/ui/resilient-image";

/** Admin image: `ResilientImage` with the admin's strings. */
export function AdminImage(props: Omit<ComponentProps<typeof ResilientImage>, "labels">) {
  const { media: t } = useAdminLang().t;
  return (
    <ResilientImage
      labels={{ loading: t.imageLoading, error: t.imageError, retry: t.imageRetry }}
      {...props}
    />
  );
}

/**
 * Gallery-editor row body: 48px preview, the URL, and a status line that
 * says in words whether the image actually loads — a broken link is otherwise
 * just a grey square that's easy to miss before saving.
 */
export function ImagePreview({ url }: { url: string }) {
  const { t } = useAdminLang();
  const [status, setStatus] = useState<ImageStatus>("loading");
  return (
    <>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
        <AdminImage src={url} alt="" sizes="48px" unoptimized compact className="object-cover" onStatusChange={setStatus} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{url}</span>
        <span
          className={cn(
            "flex items-start gap-1 text-xs",
            status === "loaded" && "text-emerald-700",
            status === "error" && "text-red-600",
            status === "loading" && "text-muted-foreground",
          )}
        >
          {status === "loading" && <LoaderCircle className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" />}
          {status === "loaded" && <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0" />}
          {status === "error" && <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />}
          {status === "loading" ? t.media.imageLoading : status === "loaded" ? t.media.imageLoaded : t.media.imageError}
        </span>
      </div>
    </>
  );
}

type Accept = "image" | "video" | "media"; // media = both

// `.heic`/`.mov` are listed explicitly because desktop browsers often don't
// map them to `image/*` / `video/*`, which greys the files out in the picker.
const ACCEPT_ATTR: Record<Accept, string> = {
  image: "image/*,.heic,.heif",
  video: "video/*,.mov,.m4v",
  media: "image/*,video/*,.heic,.heif,.mov,.m4v",
};

const VIDEO_FILE = /\.(mov|mp4|m4v|webm|3gp)$/i;

/**
 * POST the raw file to /api/upload, reporting upload progress (0–1). Resolves
 * once the server has finished converting it.
 */
function sendFile(
  file: File,
  lang: string,
  onProgress: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-lang", lang);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as UploadResult);
      } catch {
        // Not our JSON — nginx's 413 page, a 502 while restarting, etc.
        reject(new Error(String(xhr.status)));
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

/**
 * File-picker button that uploads through the `uploadMedia` server action and
 * hands back the stored `/uploads/...` URL. Building block for every media
 * input in the admin.
 */
export function UploadButton({
  accept = "image",
  onUploaded,
  className,
  compact = false,
  label,
}: {
  accept?: Accept;
  onUploaded: (url: string) => void;
  className?: string;
  /** Overrides the default "Upload" tooltip / accessible name. */
  label?: string;
  /** Icon-only variant for tight rows. */
  compact?: boolean;
}) {
  const { t, lang } = useAdminLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const kind =
      file.type.startsWith("video/") || VIDEO_FILE.test(file.name) ? "video" : "image";
    const limit = UPLOAD_LIMITS_MB[kind];
    if (file.size > limit * 1024 * 1024) {
      setError(`${t.media.tooLarge} (max ${limit}MB)`);
      return;
    }
    setPending(true);
    setProgress(0);
    try {
      const result = await sendFile(file, lang, setProgress);
      if ("url" in result) onUploaded(result.url);
      else setError(result.error);
    } catch (e) {
      // No JSON came back: nginx rejected the size, or the request was cut off
      // in transit, which for a large video usually means the connection.
      setError(
        (e as Error).message === "413"
          ? `${t.media.tooLarge} (max ${limit}MB)`
          : t.media.networkFailed,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR[accept]}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={label ?? t.media.upload}
        title={label ?? t.media.upload}
        className={cn(
          "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-md)] border text-sm transition-colors hover:bg-foreground/[0.03] disabled:pointer-events-none disabled:opacity-60",
          compact ? "w-10 shrink-0" : "px-3",
        )}
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {!compact &&
          (!pending
            ? t.media.upload
            : progress < 1
              ? `${t.media.uploading} ${Math.round(progress * 100)}%`
              : t.media.processing)}
      </button>
      {compact && pending && (
        <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">
          {progress < 1 ? `${Math.round(progress * 100)}%` : t.media.processing}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** 40px preview box: image thumbnail, video glyph, or empty muted square. */
export function MediaThumb({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted",
        className,
      )}
    >
      {url &&
        (looksLikeVideo(url) ? (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Film className="h-4 w-4" strokeWidth={1.75} />
          </span>
        ) : (
          <AdminImage src={url} alt="" sizes="40px" unoptimized compact className="object-cover" />
        ))}
    </div>
  );
}

/**
 * The one media input used everywhere a single image/video URL is edited:
 * preview + URL text field (paste still works) + upload button + clear.
 * Posts through a hidden input when `name` is given; use `value`/`onChange`
 * for controlled rows inside JSON-serialized editors.
 */
export function MediaField({
  name,
  defaultValue = "",
  value,
  onChange,
  accept = "image",
  id,
  placeholder,
  className,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (url: string) => void;
  accept?: Accept;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useAdminLang();
  const [internal, setInternal] = useState(defaultValue);
  const url = value !== undefined ? value : internal;

  const setUrl = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      {name && <input type="hidden" name={name} value={url} />}
      <MediaThumb url={url} />
      <TextInput
        id={id}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholder ?? t.media.urlPlaceholder}
        className="min-w-0 flex-1"
      />
      <UploadButton accept={accept} onUploaded={setUrl} compact />
      {url && (
        <button
          type="button"
          onClick={() => setUrl("")}
          aria-label={t.media.clear}
          title={t.media.clear}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
