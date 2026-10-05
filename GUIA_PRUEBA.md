# Guía de prueba de ZIPPYGO, de punta a punta

Esto es para hacerlo **una vez, en serio**, antes de que lo haga un cliente.
Toma unos veinte minutos. Hazlo con la app de **Android**, que ya tiene todo
lo último; el iPhone todavía está esperando la revisión de la 1.2.

Las cuentas de prueba están en `zippy-ios-llaves/credenciales_demo.txt`
(vendedor, repartidor y cliente). Si puedes, usa **tres dispositivos o tres
navegadores distintos** —uno por rol— para no estar entrando y saliendo.

Avísame cuando arranques: me quedo mirando los errores del servidor en vivo y
lo que salga mal lo corrijo de una.

---

## Antes de empezar

- [ ] El vendedor de prueba tiene **al menos tres productos publicados**, con
      foto y precio, y el negocio está **abierto** a esta hora (revisa el
      horario en su perfil; si está cerrado, el botón de agregar no deja).
- [ ] El repartidor de prueba está **en línea** en su panel.

---

## 1. Buscar y armar el pedido (como cliente)

- [ ] Entra a la tienda **sin iniciar sesión**. Debe dejarte ver todo.
- [ ] Busca un producto **escribiéndolo mal a propósito**: sin tildes
      ("platano"), con una letra cambiada ("arros"), o pegado ("cocacola").
      **Tiene que encontrarlo igual.**
- [ ] Busca algo que no existe. Debe decirlo con calma, no quedarse en blanco.
- [ ] Agrega dos o tres productos al carrito.
- [ ] Abre el carrito: **cada producto debe mostrar su foto**, y el total
      debe cuadrar con lo que suman los precios más el domicilio.
- [ ] Toca pagar. Ahí sí te debe pedir cuenta.

## 2. Hacer el pedido

- [ ] Inicia sesión como cliente.
- [ ] Elige la dirección y **marca el punto en el mapa**.
- [ ] Confirma el pedido.
- [ ] **Si es el primer pedido de esa cuenta**, debe quedar "En validación" y
      mostrarte el aviso de que soporte te va a llamar. Eso es correcto, no es
      un error.
      - [ ] Entra como **admin** a Validación, revisa que el pedido aparezca
            con el nombre y el teléfono del cliente, y **apruébalo**.

## 3. El negocio (como vendedor)

- [ ] El pedido debe aparecerle en Mis Órdenes.
- [ ] **Confírmalo**, márcalo en preparación y después listo para recoger.
- [ ] Mira que el total que le aparece a él sea el mismo que vio el cliente.

## 4. La entrega (como repartidor)

- [ ] El pedido debe aparecer en los disponibles. **Tómalo.**
- [ ] Revisa que veas la dirección, el punto en el mapa y el teléfono.
- [ ] Como cliente, abre **Ver seguimiento**: debe aparecer el repartidor,
      el **tiempo estimado** y el mapa.
- [ ] Prueba el **chat** del pedido: escribe de un lado y revisa que llegue
      al otro.
- [ ] Marca la entrega con el **código de recogida**.

## 5. Después de entregado (como cliente)

- [ ] **Califica el pedido.** Deben salir las estrellas del negocio, de los
      productos, del tiempo de entrega y **del repartidor con su nombre**.
- [ ] Entra como repartidor y revisa que su calificación ya aparezca arriba.
- [ ] Toca **Repetir pedido**. Debe volver a armar el carrito con los
      **precios de hoy** y llevarte al carrito.

## 6. Cancelar

- [ ] Haz otro pedido y, **sin que el vendedor lo confirme**, cánchalo desde
      Pedidos. Debe dejarte.
- [ ] Haz otro, que el vendedor lo ponga **en preparación**, e intenta
      cancelarlo. **No debe dejarte**, y debe decirte por qué.
- [ ] Revisa que el inventario del producto haya vuelto a subir después de
      cancelar.

## 7. Lo que se queda quieto

- [ ] Haz un pedido y **déjalo sin confirmar diez minutos**.
- [ ] Al cliente le debe salir el aviso de que el negocio no ha confirmado,
      con el botón de escribir a soporte.
- [ ] Al vendedor le debe salir el aviso rojo arriba de sus órdenes.
- [ ] Al admin le debe aparecer en Validación, pestaña **Quietos**.

---

## Qué anotar

De cada cosa que salga mal, escribe tres datos: **qué hiciste**, **qué
esperabas** y **qué pasó**. Con eso lo arreglo rápido. Si sale un mensaje de
error, cópialo tal cual o tómale foto.

Y anota también lo que te **moleste** aunque funcione: un botón que no se ve,
un texto confuso, algo que toma tres toques y debería tomar uno. Eso vale
tanto como un error.
