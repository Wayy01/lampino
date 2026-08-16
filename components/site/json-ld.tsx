import type { JsonLdNode } from "@/lib/schema";

/**
 * Emits a schema.org block. `<` is escaped so a product name containing
 * `</script>` can't break out of the tag.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
