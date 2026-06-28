import { Reveal, MaskReveal } from "./reveal";
import { cn } from "@/lib/utils";

export function SectionHeading({
  index,
  kicker,
  title,
  align = "left",
  className,
}: {
  index?: string;
  kicker: string;
  title: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" && "mx-auto max-w-2xl text-center",
        className,
      )}
    >
      <Reveal>
        <div
          className={cn(
            "label-mono flex items-center gap-3 text-[0.8125rem] tracking-[0.16em] text-muted-foreground",
            align === "center" && "justify-center",
          )}
        >
          {index && <span className="font-medium text-primary">{index}</span>}
          <span className="h-px w-10 bg-border" />
          <span>{kicker}</span>
        </div>
      </Reveal>
      <h2 className="font-display mt-3 text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.02] tracking-[-0.02em]">
        <MaskReveal delay={0.05}>{title}</MaskReveal>
      </h2>
    </div>
  );
}
