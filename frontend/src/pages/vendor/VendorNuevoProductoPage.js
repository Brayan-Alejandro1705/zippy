import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/VendorLayout';
import { useToast } from '../../context/ToastContext';
import { productosService, negociosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorProductos.css';

const CATEGORIAS = ['Bebidas', 'Panadería', 'Pastelería', 'Frutas y Verduras', 'Lácteos', 'Carnes', 'Otros'];

const Field = ({ label, error, children }) => (
  <div className="vnp-field">
    <label>{label}</label>
    {children}
    {error && <span className="vnp-err">{error}</span>}
  </div>
);

const VendorNuevoProductoPage = () => {
  const navigate     = useNavigate();
  const { addToast } = useToast();
  const fileRef      = useRef();

  const [step, setStep]       = useState(1);
  const [preview, setPreview] = useState(null);
  const [foto, setFoto]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [tried, setTried]     = useState(false);   // si intentó avanzar

  const [form, setForm] = useState({
    nombre: '', categoria: '', precio: '', stock: '',
    descripcion: '', disponible: true,
  });

  // ── Validation ──────────────────────────────────────────────────────────────
  const errors = {
    nombre:    !form.nombre.trim()             ? 'El nombre es requerido'         : '',
    categoria: !form.categoria                 ? 'Selecciona una categoría'        : '',
    precio:    !form.precio || Number(form.precio) <= 0 ? 'Ingresa un precio válido' : '',
    stock:     !form.stock  || Number(form.stock)  < 0  ? 'Ingresa el stock'          : '',
  };
  const hasErrors = Object.values(errors).some(Boolean);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  const handleNext = () => {
    setTried(true);
    if (hasErrors) return;
    setStep(2);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: negocio } = await negociosService.miNegocio();

      let imagenes = [];
      if (foto) {
        const { data } = await productosService.subirImagen(foto);
        imagenes = [data.url];
      }

      await productosService.crear(negocio.id, {
        nombre:      form.nombre,
        categoria:   form.categoria,
        precio:      Number(form.precio),
        stock:       Number(form.stock),
        descripcion: form.descripcion,
        es_visible:  form.disponible,
        imagenes,
      });
      addToast(`"${form.nombre}" añadido a tu catálogo`, 'success');
      navigate('/vendor/productos');
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo guardar el producto. Intenta de nuevo.';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendorLayout>
      <div className="vnp-wrapper">
        <div className="vnp-card">

          {/* Header */}
          <div className="vnp-card-header">
            <div>
              <h2 className="vnp-card-title">Nuevo Producto</h2>
              <p className="vnp-card-sub">Añade a tu catálogo</p>
            </div>
            <div className="vnp-steps">
              <div className={`vnp-step ${step === 1 ? 'vnp-step--active' : 'vnp-step--done'}`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <div className={`vnp-step-line ${step > 1 ? 'vnp-step-line--done' : ''}`} />
              <div className={`vnp-step ${step === 2 ? 'vnp-step--active' : ''}`}>2</div>
            </div>
          </div>

          <div className="vnp-body">
            {step === 1 ? (
              <>
                <Field label="Nombre del producto" error={tried && errors.nombre}>
                  <input
                    name="nombre" value={form.nombre} onChange={handleChange}
                    placeholder="Ej. Café Premium 500g"
                    className={tried && errors.nombre ? 'vnp-input-err' : ''}
                    autoFocus
                  />
                </Field>

                <Field label="Categoría" error={tried && errors.categoria}>
                  <select
                    name="categoria" value={form.categoria} onChange={handleChange}
                    className={tried && errors.categoria ? 'vnp-input-err' : ''}
                  >
                    <option value="">Selecciona categoría</option>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>

                <div className="vnp-field-row">
                  <Field label="Precio (COP)" error={tried && errors.precio}>
                    <input
                      name="precio" type="number" min="0" value={form.precio} onChange={handleChange}
                      placeholder="0"
                      className={tried && errors.precio ? 'vnp-input-err' : ''}
                    />
                  </Field>
                  <Field label="Stock (unidades)" error={tried && errors.stock}>
                    <input
                      name="stock" type="number" min="0" value={form.stock} onChange={handleChange}
                      placeholder="0"
                      className={tried && errors.stock ? 'vnp-input-err' : ''}
                    />
                  </Field>
                </div>

                {/* Photo upload */}
                <div className="vnp-field">
                  <label>Foto del producto <span className="vnp-optional">(opcional)</span></label>
                  <div
                    className={`vnp-dropzone ${preview ? 'vnp-dropzone--filled' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileRef.current.click()}
                  >
                    {preview
                      ? <img src={preview} alt="preview" className="vnp-preview" />
                      : <>
                          <span className="vnp-drop-icon">📷</span>
                          <span className="vnp-drop-text">Selecciona foto</span>
                          <span className="vnp-drop-sub">Arrastra o haz click · JPG, PNG, WEBP</span>
                        </>
                    }
                  </div>
                  {preview && (
                    <button type="button" className="vnp-remove-photo"
                      onClick={e => { e.stopPropagation(); setPreview(null); setFoto(null); }}>
                      ✕ Quitar foto
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => handleFile(e.target.files[0])} />
                </div>

                {/* Summary error */}
                {tried && hasErrors && (
                  <div className="vnp-summary-err">
                    ⚠ Completa los campos requeridos antes de continuar
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Preview card */}
                <div className="vnp-preview-row">
                  <div className="vnp-preview-photo">
                    {preview
                      ? <img src={preview} alt="preview" className="vnp-preview-sm" />
                      : <span className="vnp-preview-no-photo">📦</span>
                    }
                  </div>
                  <div className="vnp-preview-info">
                    <p className="vnp-preview-name">{form.nombre}</p>
                    <p className="vnp-preview-price">${Number(form.precio).toLocaleString('es-CO')}</p>
                    <p className="vnp-preview-stock">Stock: {form.stock} unidades</p>
                    <span className="vnp-preview-cat">{form.categoria}</span>
                  </div>
                </div>

                <div className="vnp-field">
                  <label>Descripción <span className="vnp-optional">(opcional)</span></label>
                  <textarea
                    name="descripcion" value={form.descripcion} onChange={handleChange}
                    placeholder="Describe tu producto: ingredientes, presentación, uso..." rows={4}
                  />
                </div>

                <div className="vnp-field vnp-toggle-row">
                  <div>
                    <span className="vnp-toggle-label">Publicar inmediatamente</span>
                    <p className="vnp-toggle-sub">El producto será visible para los clientes al guardar</p>
                  </div>
                  <button
                    type="button"
                    className={`cfg-toggle ${form.disponible ? 'cfg-toggle--on' : ''}`}
                    onClick={() => setForm(p => ({ ...p, disponible: !p.disponible }))}
                  >
                    <span className="cfg-toggle-thumb" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="vnp-footer">
            <button className="vnp-btn-back"
              onClick={() => step === 1 ? navigate('/vendor/productos') : setStep(1)}>
              Atrás
            </button>
            {step === 1 ? (
              <button className="vnp-btn-next" onClick={handleNext}>
                Siguiente →
              </button>
            ) : (
              <button className="vnp-btn-next" onClick={handleSave} disabled={saving}>
                {saving ? <ZLoader size="sm" inverted /> : '✓ Guardar producto'}
              </button>
            )}
          </div>

        </div>
      </div>
    </VendorLayout>
  );
};

export default VendorNuevoProductoPage;
