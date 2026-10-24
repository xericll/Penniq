import { useState, useEffect } from 'react';

export interface KeyboardViewportState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
}

/**
 * Hook to detect virtual keyboard state and height on mobile using window.visualViewport
 * and input focus/blur events.
 */
export function useKeyboardViewport(): KeyboardViewportState {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isInputElement = (el: Element | null): boolean => {
      if (!el) return false;
      const tagName = el.tagName?.toUpperCase();
      return tagName === 'INPUT' || tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const updateKeyboardState = () => {
      const activeEl = document.activeElement;
      const isInputActive = isInputElement(activeEl);

      let currentKbHeight = 0;
      if (window.visualViewport) {
        // Height diff between layout viewport and visual viewport
        const diff = Math.max(0, window.innerHeight - window.visualViewport.height);
        // On mobile keyboards, diff is typically > 100px
        if (diff > 80) {
          currentKbHeight = Math.round(diff);
        }
      }

      const isOpen = isInputActive || currentKbHeight > 80;
      setIsKeyboardOpen(isOpen);
      setKeyboardHeight(isOpen ? currentKbHeight : 0);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (isInputElement(target)) {
        setIsKeyboardOpen(true);
        // Scroll into view with slight delay to allow mobile keyboard to open and viewport to resize
        setTimeout(() => {
          if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, 220);
      }
    };

    const handleFocusOut = () => {
      // Small delay to check if focus moved to another input or genuinely blurred
      setTimeout(() => {
        const active = document.activeElement;
        if (!isInputElement(active)) {
          updateKeyboardState();
        }
      }, 100);
    };

    // Attach listeners
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', updateKeyboardState);
      viewport.addEventListener('scroll', updateKeyboardState);
    }
    window.addEventListener('resize', updateKeyboardState);

    // Initial check
    updateKeyboardState();

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (viewport) {
        viewport.removeEventListener('resize', updateKeyboardState);
        viewport.removeEventListener('scroll', updateKeyboardState);
      }
      window.removeEventListener('resize', updateKeyboardState);
    };
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}
