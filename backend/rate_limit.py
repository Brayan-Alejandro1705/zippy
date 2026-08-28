# ============================================================================
# rate_limit.py - Limiter compartido para proteger login/registro de fuerza
# bruta y abuso (usa la IP del request como clave).
#
# Vive en su propio archivo (en vez de definirse en main.py) para que las
# rutas puedan importarlo con "from rate_limit import limiter" sin crear un
# import circular con main.py.
# ============================================================================

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
