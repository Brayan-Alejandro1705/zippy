import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usuariosService } from '../config/api';
import '../styles/GlobalSearch.css';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await usuariosService.listar({ search: query, limit: 6 });
        const data = res.data.results ?? res.data;
        setResults(Array.isArray(data) ? data.slice(0, 6) : []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (id) => {
    setQuery('');
    setOpen(false);
    navigate(`/usuarios/${id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'Enter' && query.trim()) navigate(`/usuarios?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="gs-container" ref={ref}>
      <input
        type="text"
        className="search-input gs-input"
        placeholder="🔍  Buscar usuarios..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <div className="gs-dropdown">
          {loading ? (
            <div className="gs-state">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="gs-state">Sin resultados para "{query}"</div>
          ) : (
            results.map(u => (
              <div key={u.id} className="gs-item" onClick={() => handleSelect(u.id)}>
                <div className="gs-item-avatar">{u.nombre?.charAt(0) ?? '?'}</div>
                <div className="gs-item-info">
                  <span className="gs-item-name">{u.nombre}</span>
                  <span className="gs-item-meta">{u.email} · {u.rol}</span>
                </div>
                <span className={`us-rol-badge us-rol-${u.rol?.toLowerCase()}`}>{u.rol}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
