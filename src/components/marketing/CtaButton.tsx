import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui";
import { cn } from "@/lib/format";
import { SITE } from "@/lib/site";

/**
 * CTA principal da landing: "Começar agora — R$47/mês" → /cadastro.
 *
 * Variante exclusiva da página de vendas (envolve o ButtonLink compartilhado,
 * sem alterá-lo). O clique em /cadastro dispara o evento Lead do Meta Pixel
 * (via LeadOnCtaClick, montado na landing).
 *
 * Nunca usar "Criar conta grátis": não existe plano/período gratuito.
 */
export function CtaButton({
  className,
  size = "lg",
  variant = "primary",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
}) {
  return (
    <ButtonLink href={SITE.signupHref} size={size} variant={variant} className={cn(className)}>
      {SITE.ctaLabel}
      <ArrowRight size={16} />
    </ButtonLink>
  );
}
