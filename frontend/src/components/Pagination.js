import React from 'react';
import '../styles/Pagination.css';

const Pagination = ({ page, totalPages, total, pageSize, onPageChange }) => {
  if (totalPages <= 1) return null;

  const delta = 2;
  const left = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);
  const pages = [];
  for (let i = left; i <= right; i++) pages.push(i);

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pg-wrapper">
      <span className="pg-info">Mostrando {from}–{to} de {total}</span>
      <div className="pg-container">
        <button className="pg-btn" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          ← Anterior
        </button>
        {left > 1 && (
          <>
            <button className="pg-btn" onClick={() => onPageChange(1)}>1</button>
            {left > 2 && <span className="pg-ellipsis">…</span>}
          </>
        )}
        {pages.map(p => (
          <button
            key={p}
            className={`pg-btn ${p === page ? 'pg-btn--active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        {right < totalPages && (
          <>
            {right < totalPages - 1 && <span className="pg-ellipsis">…</span>}
            <button className="pg-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button className="pg-btn" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
          Siguiente →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
