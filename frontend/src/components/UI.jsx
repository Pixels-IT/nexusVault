import { useState } from 'react';

export function Modal({ title, onClose, children, footer, width, hideClose, headerActions }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={width ? { width, maxWidth: `min(${width}, calc(100vw - 40px))` } : {}}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {headerActions}
            {!hideClose && <button className="btn btn-sm" onClick={onClose}>✕</button>}
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

export function Input({ ...props }) {
  return <input className={`form-control ${props.error ? 'error' : ''}`} {...props} />;
}

export function Select({ children, ...props }) {
  return <select className="form-control" {...props}>{children}</select>;
}

export function Badge({ type = 'muted', dot, children }) {
  return (
    <span className={`badge badge-${type}`}>
      {dot && <span className={`dot dot-${type === 'ok' ? 'ok' : type === 'warn' ? 'warn' : type === 'err' ? 'err' : 'muted'}`} />}
      {children}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" />;
}

export function Alert({ type = 'err', children }) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, marginBottom: 16 }}>{subtitle}</p>}
      {action}
    </div>
  );
}

export function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Confirmer la suppression" onClose={onCancel}
      footer={<>
        <button className="btn" onClick={onCancel}>Annuler</button>
        <button className="btn btn-danger" onClick={onConfirm}>Supprimer</button>
      </>}>
      <p style={{ fontSize: 13 }}>{message}</p>
    </Modal>
  );
}

export function useForm(initial) {
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const reset = () => { setData(initial); setErrors({}); };
  return { data, setData, errors, setErrors, set, reset };
}
