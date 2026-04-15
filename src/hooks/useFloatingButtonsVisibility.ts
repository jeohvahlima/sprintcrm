import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'floating-buttons-visibility';

interface FloatingButtonsVisibility {
  chatButton: boolean;
  dialerButton: boolean;
}

const getDefaults = (): FloatingButtonsVisibility => ({
  chatButton: true,
  dialerButton: true,
});

const load = (): FloatingButtonsVisibility => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...getDefaults(), ...JSON.parse(stored) };
  } catch {}
  return getDefaults();
};

export const useFloatingButtonsVisibility = () => {
  const [visibility, setVisibility] = useState<FloatingButtonsVisibility>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
    // Dispatch event so other components react
    window.dispatchEvent(new CustomEvent('floating-buttons-changed', { detail: visibility }));
  }, [visibility]);

  // Listen for changes from other tabs/components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as FloatingButtonsVisibility;
      setVisibility(detail);
    };
    window.addEventListener('floating-buttons-changed', handler);
    return () => window.removeEventListener('floating-buttons-changed', handler);
  }, []);

  const toggleChat = useCallback(() => {
    setVisibility(prev => ({ ...prev, chatButton: !prev.chatButton }));
  }, []);

  const toggleDialer = useCallback(() => {
    setVisibility(prev => ({ ...prev, dialerButton: !prev.dialerButton }));
  }, []);

  return {
    chatVisible: visibility.chatButton,
    dialerVisible: visibility.dialerButton,
    toggleChat,
    toggleDialer,
  };
};
