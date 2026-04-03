# Outfit Maker

Tu armario personal como app web.

## Cómo subir a GitHub Pages

### Requisitos
- [Node.js](https://nodejs.org) instalado (versión 18 o superior)
- Cuenta en [github.com](https://github.com)

---

### Paso 1 — Crear el repositorio en GitHub

1. Ve a [github.com/new](https://github.com/new)
2. Nombre del repositorio: **`outfit-maker`** (importante, debe ser exactamente este nombre)
3. Deja todo lo demás por defecto y pulsa **Create repository**

---

### Paso 2 — Abrir la carpeta del proyecto

1. Descomprime el ZIP que descargaste
2. Abre una terminal dentro de esa carpeta
   - **Mac**: clic derecho en la carpeta → "Nueva terminal en la carpeta"
   - **Windows**: dentro de la carpeta, clic derecho → "Abrir en Terminal"

---

### Paso 3 — Instalar dependencias y conectar con GitHub

Ejecuta estos comandos uno a uno:

```bash
npm install
```

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/outfit-maker.git
git push -u origin main
```

> ⚠️ Sustituye `TU_USUARIO` por tu nombre de usuario de GitHub

---

### Paso 4 — Publicar en GitHub Pages

```bash
npm run deploy
```

Esto construye la app y la publica. Tarda ~30 segundos.

---

### Paso 5 — Activar GitHub Pages

1. Ve a tu repositorio en GitHub
2. Entra en **Settings** → **Pages**
3. En "Branch" selecciona **gh-pages** → **/ (root)** → pulsa **Save**

---

### ✅ Tu app estará en:

```
https://TU_USUARIO.github.io/outfit-maker/
```

---

## Instalar como app en el iPhone (PWA)

1. Abre la URL en **Safari**
2. Pulsa el botón **Compartir** (cuadrado con flecha)
3. Selecciona **"Añadir a pantalla de inicio"**
4. Pulsa **Añadir**

Ya aparece como app con icono propio, sin barra del navegador.

---

## Datos y privacidad

Todos tus datos (prendas y outfits) se guardan en el **localStorage** de tu navegador/dispositivo.
Cada persona que abra la app ve su propio armario vacío — los datos nunca se comparten ni van a ningún servidor.
