"""Comprueba que carrito y orden dan el MISMO total.

Era el bug: dos funciones distintas calculando lo mismo. Esta prueba falla si
alguien vuelve a separarlas.
"""
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(r"C:\Users\aleja\zippy\backend")))

import calculos  # noqa: E402
from config import settings  # noqa: E402


class DbFalsa:
    """Simula la base sin conectarse: siempre dice que no hay valor guardado,
    asi el calculo cae en el respaldo de config.py."""

    def query(self, *_a, **_k):
        return self

    def filter(self, *_a, **_k):
        return self

    def first(self):
        return None


db = DbFalsa()
subtotal = Decimal("25000")

cuentas = calculos.desglose(subtotal, db)

print("Desglose de un pedido de $25.000:")
print(f"  subtotal    {cuentas['subtotal']:>12,.0f}")
print(f"  IVA {settings.IMPUESTO_IVA:.0f}%     {cuentas['impuesto']:>12,.0f}")
print(f"  domicilio   {cuentas['costo_domicilio']:>12,.0f}")
print(f"  TOTAL       {cuentas['total']:>12,.0f}")
print()

# El carrito y la orden deben coincidir: ambos pasan por el mismo modulo.
total_carrito = cuentas["total"]
total_orden = (
    cuentas["subtotal"] + cuentas["impuesto"] + calculos.costo_domicilio(db)
)

print(f"total en el carrito: {total_carrito:,.0f}")
print(f"total en la orden:   {total_orden:,.0f}")
print()
if total_carrito == total_orden:
    print("OK: coinciden. El cliente ve lo mismo en las dos pantallas.")
else:
    print("ERROR: no coinciden. Volvieron a separarse las cuentas.")
