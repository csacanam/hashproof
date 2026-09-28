import { useEffect, useRef } from "react";

/** A native <dialog>: focus trap, Escape to close and the backdrop come with it. */
export default function Modal({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dash-modal${wide ? " dash-modal--wide" : ""}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dash-modal-body">
        <div className="dash-modal-head">
          <h2>{title}</h2>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
