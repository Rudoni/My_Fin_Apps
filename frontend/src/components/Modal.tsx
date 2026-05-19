import { ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ title, eyebrow, children, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
