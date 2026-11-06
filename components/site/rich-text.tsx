import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((n, i) => {
    if (n.type === "text") return <Fragment key={i}>{n.text}</Fragment>;
    if (n.type === "bold")
      return (
        <strong key={i} className="font-semibold text-foreground">
          <Inlines nodes={n.children} />
        </strong>
      );
    return (
      <em key={i}>
        <Inlines nodes={n.children} />
      </em>
    );
  });
}

/**
 * Renders a description written in the `lib/markdown.ts` subset. The first
 * paragraph, when it opens the text, is set as a larger lead.
 */
export function RichText({
  source,
  lead = true,
  className,
}: {
  source: string;
  lead?: boolean;
  className?: string;
}) {
  const blocks = parseMarkdown(source);
  if (!blocks.length) return null;

  return (
    <div className={cn("flex max-w-2xl flex-col gap-5 text-base leading-relaxed text-foreground/80 md:text-lg", className)}>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          const Tag = (`h${b.level + 1}`) as "h2" | "h3" | "h4";
          return (
            <Tag
              key={i}
              className={cn(
                "font-display font-light tracking-tight text-foreground",
                i > 0 && "mt-4",
                b.level === 1 && "text-3xl md:text-4xl",
                b.level === 2 && "text-2xl md:text-3xl",
                b.level === 3 && "text-xl md:text-2xl",
              )}
            >
              <Inlines nodes={b.content} />
            </Tag>
          );
        }
        if (b.type === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              className={cn(
                "flex flex-col gap-2 pl-6",
                b.ordered ? "list-decimal marker:text-muted-foreground" : "list-disc marker:text-primary",
              )}
            >
              {b.items.map((item, j) => (
                <li key={j} className="pl-1">
                  <Inlines nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p
            key={i}
            className={cn(
              lead && i === 0 &&
                "font-display text-xl font-light leading-snug tracking-tight text-foreground md:text-2xl",
            )}
          >
            <Inlines nodes={b.content} />
          </p>
        );
      })}
    </div>
  );
}
