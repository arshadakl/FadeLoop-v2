import { useEffect, useRef } from "react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus cancel button on mount to prevent accidental Enter confirmation
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Accessible Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-default w-full h-full border-none"
        onClick={onCancel}
        tabIndex={-1}
        aria-label="Close dialog"
      />

      {/* Dialog card */}
      <div
        className="w-full max-w-md bg-card text-card-foreground border border-border rounded-lg shadow-xl p-6 space-y-4 relative z-10 animate-in zoom-in-95 duration-150 focus:outline-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
      >
        <div className="space-y-2">
          <h3
            id="confirm-dialog-title"
            className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2"
          >
            {isDestructive && (
              <span className="text-destructive text-base">⚠️</span>
            )}
            <span>{title}</span>
          </h3>
          <p
            id="confirm-dialog-description"
            className="text-sm text-muted-foreground leading-relaxed text-pretty"
          >
            {description}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
