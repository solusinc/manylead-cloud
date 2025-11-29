import { useCallback, useState } from "react";

/**
 * Standard hook for managing open/close state of dialogs, sheets, and modals
 * Follows Airbnb/Chakra UI patterns
 *
 * @param defaultOpen - Initial open state (default: false)
 * @returns Object with isOpen state and control functions
 *
 * @example
 * ```tsx
 * const { isOpen, onOpen, onClose, onToggle } = useDisclosure();
 *
 * return (
 *   <>
 *     <button onClick={onOpen}>Open Dialog</button>
 *     <Dialog open={isOpen} onOpenChange={onClose}>
 *       <DialogContent>...</DialogContent>
 *     </Dialog>
 *   </>
 * );
 * ```
 */
export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const onToggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, setIsOpen, onOpen, onClose, onToggle };
}
