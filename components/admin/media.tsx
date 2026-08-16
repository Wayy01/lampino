"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Film, LoaderCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadMedia } from "@/lib/admin/actions/upload";
import { UPLOAD_LIMITS_MB, looksLikeVideo } from "@/lib/admin/media";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { TextInput } from "@/components/admin/form-controls";

type Accept = "image" | "video" | "media"; // media = both

const ACCEPT_ATTR: Record<Accept, string> = {
  image: "image/*",
  video: "video/*",
  media: "image/*,video/*",
};

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
}: {
  accept?: Accept;
  onUploaded: (url: string) => void;
  className?: string;
  /** Icon-only variant for tight rows. */
  compact?: boolean;
}) {
  const { t, lang } = useAdminLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const limit = UPLOAD_LIMITS_MB[kind];
    if (file.size > limit * 1024 * 1024) {
      setError(`${t.media.tooLarge} (max ${limit}MB)`);
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("_lang", lang);
      const result = await uploadMedia(fd);
      if ("url" in result) onUploaded(result.url);
      else setError(result.error);
    } catch {
      // The action never returned — the request was cut off in transit, which
      // for a large video usually means the connection, not the server.
      setError(t.media.networkFailed);
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
        aria-label={t.media.upload}
        title={t.media.upload}
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
        {!compact && (pending ? t.media.uploading : t.media.upload)}
      </button>
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
          <Image src={url} alt="" fill sizes="40px" unoptimized className="object-cover" />
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
