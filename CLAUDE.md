# Notas del proyecto ZIPPYGO

Cosas que no se ven leyendo un archivo suelto y que ya han causado errores.
Si alguna deja de ser cierta, corrígela aquí.

## Fechas: el servidor manda hora universal SIN la Z

Todo en la base se guarda con `datetime.utcnow()` y se serializa con
`.isoformat()`, que no lleva zona horaria. El navegador, al no verla, da por
hecho que ya es hora de aquí: todo sale cinco horas adelantado.

- En el frontend, **ninguna fecha del servidor pasa por `new Date(iso)`**.
  Siempre por `frontend/src/utils/fechas.js` (`fechaServidor`, `hora`,
  `fechaCorta`, `fechaHoraCorta`, `fechaHoraLarga`, `minutosDesde`, `esHoy`).
- En el backend, si se arma una fecha como texto, hay que restar 5 horas
  (Colombia no cambia de hora en todo el año). Ver `_fecha_colombia` en
  `routes_pedidos_especiales.py`.

## Las notificaciones no se guardan solas

`push.notificar_usuario` y `notificar_usuarios` hacen `db.add()` pero **no**
hacen commit: eso queda a cargo de quien llama. Si se notifica después del
`db.commit()` de la operación, hay que poner otro `db.commit()` detrás o la
fila del historial se descarta al cerrar la sesión (el push sí sale, así que
el fallo es invisible).

## No vaciar listas cuando falla la red

En las pantallas que refrescan solas (sobre todo la del repartidor), un error
de red **no** debe dejar la lista en cero: se conserva lo último bueno y se
avisa. Un `catch { setLista([]) }` le borraba la pantalla al repartidor en
cualquier bache de señal.

## Dónde corre cada cosa

- Android carga el frontend desde Render (`server.url` en
  `frontend/capacitor.config.ts`), así que un cambio de web le llega sin
  recompilar.
- iOS va empaquetado (`CAP_BUNDLED=1`) y recibe los cambios por el actualizador
  propio (`backend/routes_actualizaciones.py`), no por el servicio de Capgo.

## Compilar

`CI=true npx react-scripts build` dentro de `frontend/`. Es más estricto que el
workflow (que usa `CI=false`): si pasa aquí, pasa allá.
