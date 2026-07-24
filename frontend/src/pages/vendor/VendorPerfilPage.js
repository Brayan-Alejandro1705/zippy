import React, { useState, useEffect } from 'react';
import VendorLayout from '../../components/VendorLayout';
import { useToast } from '../../context/ToastContext';
import { negociosService, productosService } from '../../config/api';
import ZLoader from '../../components/ZLoader';
import '../../styles/VendorPerfil.css';
import { opcionesCategoria } from '../../constants/categorias';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CIUDADES = ['Garzón', 'Neiva', 'Pitalito', 'La Plata', 'Campoalegre'];

const FORM_VACIO = {
  nombre: '', categoria: 'General', descripcion: '',
  direccion: '', ciudad: 'Garzón', telefono: '',
  horarioApertura: '07:00', horarioCierre: '20:00',
};

const VendorPerfilPage = () => {
  const { addToast } = useToast();
  const [negocio, setNegocio]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [diasAbiertos, setDiasAbiertos] = useState(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    negociosService.miNegocio()
      .then(({ data }) => {
        setNegocio(data);
        setForm({
          nombre:          data.nombre_negocio || '',
          categoria:       data.categoria || 'General',
          descripcion:     data.descripcion || '',
          direccion:       data.direccion || '',
          ciudad:          data.ciudad || 'Garzón',
          telefono:        data.telefono || '',
          horarioApertura: data.hora_apertura || '07:00',
          horarioCierre:   data.hora_cierre || '20:00',
        });
        if (data.dias_operacion) setDiasAbiertos(data.dias_operacion.split(',').filter(Boolean));
      })
      .catch(() => addToast('No se pudo cargar el perfil de la tienda', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const toggleDia = (dia) => {
    setDiasAbiertos(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const handleFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!negocio) return;
    setSaving(true);
    try {
      let logoUrl = negocio.logo;
      if (fotoFile) {
        const { data } = await productosService.subirImagen(fotoFile);
        logoUrl = data.url;
      }

      const { data: actualizado } = await negociosService.actualizar(negocio.id, {
        nombre_negocio: form.nombre,
        categoria:      form.categoria,
        descripcion:    form.descripcion,
        direccion:      form.direccion,
        ciudad:         form.ciudad,
        telefono:       form.telefono,
        hora_apertura:  form.horarioApertura,
        hora_cierre:    form.horarioCierre,
        dias_operacion: diasAbiertos.join(','),
        logo:           logoUrl,
      });

      setNegocio(actualizado);
      setFotoFile(null);
      addToast('Perfil de la tienda actualizado', 'success');
    } catch (err) {
      addToast(err.response?.data?.detail || 'No se pudo guardar el perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fotoUrl = fotoPreview || negocio?.logo;

  if (loading) {
    return (
      <VendorLayout searchPlaceholder="Buscar...">
        <ZLoader label="Cargando perfil de la tienda..." />
      </VendorLayout>
    );
  }

  return (
    <VendorLayout searchPlaceholder="Buscar...">
      <div className="vpf-page-header">
        <h1 className="vpf-title">Perfil de tienda</h1>
        <p className="vpf-subtitle">Así te ven tus clientes en la plataforma</p>
      </div>

      <form className="vpf-card" onSubmit={handleSave}>
        <div className="vpf-photo-section">
          <div className="vpf-photo">
            {fotoUrl ? <img src={fotoUrl} alt="Foto del negocio" /> : <span className="vpf-photo-placeholder">🏪</span>}
          </div>
          <div>
            <label className="vpf-upload-btn">
              📷 Cambiar foto del negocio
              <input type="file" accept="image/*" onChange={handleFoto} hidden />
            </label>
            <p className="vpf-photo-hint">JPG o PNG, máximo 5MB. Recomendado 800x600px.</p>
          </div>
        </div>

        <div className="vpf-field-row">
          <div className="vpf-field">
            <label>Nombre del negocio</label>
            <input name="nombre" value={form.nombre} onChange={set} />
          </div>
          <div className="vpf-field">
            <label>Categoría principal</label>
            <select name="categoria" value={form.categoria} onChange={set}>
              {opcionesCategoria(form.categoria).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="vpf-field">
          <label>Descripción</label>
          <textarea name="descripcion" rows={3} value={form.descripcion} onChange={set} />
        </div>

        <div className="vpf-field-row">
          <div className="vpf-field">
            <label>Dirección</label>
            <input name="direccion" value={form.direccion} onChange={set} />
          </div>
          <div className="vpf-field">
            <label>Ciudad</label>
            <select name="ciudad" value={form.ciudad} onChange={set}>
              {CIUDADES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="vpf-field" style={{ maxWidth: 260 }}>
          <label>Teléfono de contacto</label>
          <input name="telefono" value={form.telefono} onChange={set} />
        </div>

        <div className="vpf-section-title">Horario de atención</div>
        <div className="vpf-field-row">
          <div className="vpf-field">
            <label>Hora de apertura</label>
            <input type="time" name="horarioApertura" value={form.horarioApertura} onChange={set} />
          </div>
          <div className="vpf-field">
            <label>Hora de cierre</label>
            <input type="time" name="horarioCierre" value={form.horarioCierre} onChange={set} />
          </div>
        </div>
        <div className="vpf-field">
          <label>Días de atención</label>
          <div className="vpf-dias">
            {DIAS.map(dia => (
              <button
                type="button"
                key={dia}
                className={`vpf-dia-btn ${diasAbiertos.includes(dia) ? 'vpf-dia-btn--active' : ''}`}
                onClick={() => toggleDia(dia)}
              >
                {dia.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="vpf-footer">
          <button type="submit" className="vpf-btn-save" disabled={saving}>
            {saving ? 'Guardando...' : '✓ Guardar cambios'}
          </button>
        </div>
      </form>
    </VendorLayout>
  );
};

export default VendorPerfilPage;