import * as LucideIcons from 'lucide-react';
import { LucideProps } from 'lucide-react';

interface DynamicIconProps extends LucideProps {
  name?: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  if (!name) return <LucideIcons.Star {...props} />;

  // @ts-ignore - Indexing lucide icons dynamically
  const IconComponent = LucideIcons[name];

  if (!IconComponent) {
    return <LucideIcons.Sparkles {...props} />; // Fallback icon
  }

  return <IconComponent {...props} />;
}
