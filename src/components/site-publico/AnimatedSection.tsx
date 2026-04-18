import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface Props {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  delay?: number;
}

export function AnimatedSection({ children, className = '', id, style, delay = 0 }: Props) {
  const { ref, visible } = useScrollAnimation<HTMLElement>();
  return (
    <section
      ref={ref}
      id={id}
      style={{ ...style, transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </section>
  );
}
