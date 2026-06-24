import React from 'react';
import '../styles/ConfirmModal.css';

const ConfirmModal = ({ isOpen, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel, danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="cm-overlay" onClick={onCancel}>
      <div className="cm-modal" onClick={e => e.stopPropagation()}>
        <h3 className="cm-title">{title}</h3>
        <p className="cm-message">{message}</p>
        <div className="cm-actions">
          <button className="btn-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? 'cm-btn-danger' : 'btn-create'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
