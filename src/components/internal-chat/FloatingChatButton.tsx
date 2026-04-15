import { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChatDrawer } from './ChatDrawer';
import { useInternalChat } from '@/hooks/useInternalChat';

export const FloatingChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { getTotalUnread } = useInternalChat();
  const totalUnread = getTotalUnread();

  const [position, setPosition] = useState({ x: 24, y: 24 }); // from bottom-right
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const hasMoved = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = dragStartRef.current.x - e.clientX;
    const deltaY = dragStartRef.current.y - e.clientY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      hasMoved.current = true;
    }

    const newX = Math.max(0, Math.min(window.innerWidth - 56, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleClick = useCallback(() => {
    if (!hasMoved.current) {
      setIsOpen(true);
    }
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className={`fixed z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-200 bg-primary text-primary-foreground flex items-center justify-center touch-none select-none ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
        style={{
          right: `${position.x}px`,
          bottom: `${position.y}px`,
          transition: isDragging ? 'none' : 'transform 0.2s',
        }}
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </Badge>
        )}
      </button>

      <ChatDrawer open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};
