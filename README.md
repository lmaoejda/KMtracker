# KMtracker

**KMtracker** es una aplicación web para registrar recorridos manuales o con GPS,
guardar rutas y consultar distancia, duración y estadísticas.

Las rutas se muestran sobre OpenStreetMap. Cada cuenta tiene acceso únicamente a sus
propias rutas.

## Qué incluye

- Crear una cuenta e iniciar sesión.
- Marcar una ruta manualmente sobre el mapa.
- Registrar una ruta con el GPS del teléfono o la computadora.
- Guardar, abrir y revisar rutas anteriores.
- Consultar distancia total y estadísticas.

## Versiones del proyecto

| Versión | Carpeta | Tecnología |
|---|---|---|
| Aplicación principal — **recomendada para empezar** | [`flask/`](flask/) | Flask, SQLite, Jinja2 y JavaScript |
| Interfaz Next.js | [`src/`](src/) | Next.js, React y PostgreSQL |

La guía siguiente instala y ejecuta **la versión principal de Flask**.

---

# Ejecutar KMtracker en Windows

## 1. Abrir la terminal en el proyecto

Abre PowerShell y entra a la carpeta del proyecto:

```powershell
cd "D:\Users\Admin\Desktop\proyectos\flask-gps-route-tracker"
cd flask
```

> Si instalaste el proyecto en otra ubicación, reemplaza la ruta anterior por la ruta
> donde se encuentra esta carpeta.

## 2. Crear el entorno virtual

```powershell
py -m venv .venv
```

Si `py` no está disponible, usa:

```powershell
python -m venv .venv
```

## 3. Activar el entorno virtual

```powershell
.\.venv\Scripts\Activate.ps1
```

Si PowerShell muestra un aviso de permisos, ejecuta este comando una vez:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Cuando se active, el nombre `(.venv)` aparecerá al inicio de la línea.

## 4. Instalar las dependencias

Con el entorno activo:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 5. Iniciar el servidor

```powershell
python app.py
```

Deja esta terminal abierta mientras uses KMtracker.

Abre en el navegador:

**<http://127.0.0.1:5000>**

Al iniciar por primera vez se crea automáticamente la base de datos
`flask/tracking.db`.

## 6. Crear tu cuenta

1. Abre <http://127.0.0.1:5000>.
2. Pulsa **Crear cuenta**.
3. Ingresa un correo y una contraseña de al menos 8 caracteres.
4. Confirma la contraseña.
5. Después de registrarte, entra en la pantalla principal.

## 7. Registrar una ruta manual

1. Selecciona **Manual**.
2. Haz clic en el mapa para agregar puntos.
3. KMtracker calculará la distancia entre puntos.
4. Pulsa **Limpiar** para borrar la ruta actual.
5. Pulsa **Guardar ruta** para conservarla.

## 8. Registrar una ruta con GPS

1. Selecciona **GPS en vivo**.
2. Pulsa **INICIAR**.
3. Autoriza el acceso a la ubicación.
4. Mantén la página abierta mientras recorres la ruta.
5. Pulsa **DETENER** y luego **Guardar ruta**.

Los navegadores permiten GPS con precisión completa únicamente mediante `https://` o
desde `localhost`.

Para probar desde un teléfono en la misma red:

```powershell
ngrok http 5000
```

Abre en el teléfono la dirección `https://...` que muestre `ngrok`. Permite el acceso a
la ubicación cuando el navegador lo solicite.

---

# Detener o volver a iniciar

Detener el servidor:

- Pulsa `Ctrl+C` en la terminal.

Iniciar nuevamente:

```powershell
cd "D:\Users\Admin\Desktop\proyectos\flask-gps-route-tracker\flask"
.\.venv\Scripts\Activate.ps1
python app.py
```

---

# Estructura principal

```text
flask/
├── app.py                  # Servidor, páginas y API
├── db.py                   # Usuarios y rutas en SQLite
├── requirements.txt        # Dependencias de Python
├── tracking.db             # Base de datos local
├── templates/              # Páginas HTML
└── static/
    ├── css/style.css       # Diseño visual
    └── js/
        ├── map.js          # Mapa y rutas manuales
        └── tracking.js     # Seguimiento GPS
```

---

# Configuración opcional

Estas variables cambian el comportamiento del servidor. Todas tienen valores
predeterminados.

| Variable | Valor predeterminado | Para qué sirve |
|---|---|---|
| `SECRET_KEY` | `dev-change-me-in-production` | Firma las sesiones. Debes cambiarla en producción. |
| `DATABASE_PATH` | `flask/tracking.db` | Ubicación de la base de datos SQLite. |
| `DEFAULT_LAT` | `-34.6037` | Latitud inicial del mapa. |
| `DEFAULT_LNG` | `-58.3816` | Longitud inicial del mapa. |
| `DEFAULT_ZOOM` | `13` | Nivel de zoom inicial del mapa. |
| `PORT` | `5000` | Puerto del servidor. |

Ejemplo en PowerShell:

```powershell
$env:SECRET_KEY="una-clave-larga-y-secreta"
$env:PORT="5000"
python app.py
```

---

# API principal

| Método | Ruta | Acción |
|---|---|---|
| `POST` | `/api/auth/register` | Crear cuenta |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `POST` | `/api/routes` | Guardar una ruta |
| `GET` | `/api/routes` | Obtener las rutas del usuario |
| `GET` | `/api/routes/<id>` | Obtener una ruta guardada |
| `GET` | `/api/health` | Comprobar el estado del servidor |

---

# Ejecutar la versión Next.js

Usa esta sección solo si quieres probar la segunda implementación:

```powershell
npm install
npx drizzle-kit push
npm run dev
```

Después abre <http://localhost:3000>.

Esta versión necesita PostgreSQL y la variable de entorno `DATABASE_URL`.

# Problemas frecuentes

## El navegador no pide permiso de ubicación

- Permite ubicación en la configuración del navegador.
- Usa `localhost`, `https://` o la dirección `https://` de `ngrok`.
- Comprueba que el GPS esté activado en el teléfono.

## `python` no se reconoce

Instala Python 3.10 o una versión posterior y marca la opción para agregar Python al
`PATH`. Después vuelve a abrir PowerShell.

## El puerto 5000 está ocupado

Inicia KMtracker en otro puerto:

```powershell
$env:PORT="5050"
python app.py
```

Abre <http://127.0.0.1:5050>.
# KMtracker
