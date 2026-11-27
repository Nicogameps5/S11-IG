# Semana 11: Pinball 3D

**Asignatura**: Informática Gráfica

**Autor:** Nicolás Hernández Castro  

## Descripción del proyecto

Se ha desarrollado un prototipo interactivo de una máquina de Pinball en 3D implementado con **Three.js**, **Ammo.js** y **Tween.js**. La escena recrea una mesa recreativa de Pinball completa y jugable ambientada en un entorno panorámico de 360° de temática arcade.

## Características principales

### 1. Simulación física (`ammo.js`)
* **Gravedad inclinada:** En lugar de inclinar toda la geometría de la escena, se ha configurado el vector de gravedad del mundo físico con una componente positiva en el eje Z `(0, -9.8, 3.8)`, reproduciendo de forma natural la caída de la bola por la pendiente del tablero.
* **Detección continua de colisiones (*CCD*):** La bola metálica `btSphereShape` incorpora umbral de movimiento y radio de barrido continuo `setCcdMotionThreshold` y `setCcdSweptSphereRadius` junto con 10 sub-pasos por fotograma `stepSimulation(deltaTime, 10)`, evitando que atraviese las palas o las paredes en lanzamientos a alta velocidad.
* **Propiedades físicas diferenciadas:** Cada elemento del tablero utiliza cuerpos rígidos estáticos `btBoxShape` y `btCylinderShape` con coeficientes de restitución y fricción ajustados según su función, con mayor rebote en los deflectores superiores (`0.85`) y bumpers (`1.35`), y menor en los topes de retención (`0.2`).

### 2. Animación por interpolación y cuerpos cinemáticos (`tween.js`)
* **Palas inferiores articuladas:** Construidas mediante pivotes `THREE.Object3D` alineados con el ángulo de los embudos `±0.62 rad` y rematados con ejes cilíndricos. Al pulsar las teclas de control, se ejecuta una secuencia de dos tweens encadenados (`Quadratic.Out` para el golpeo rápido y `Quadratic.In` para el retorno).
* **Sincronización gráfico-física:** Tanto las palas como el obstáculo móvil central están registrados como cuerpos cinemáticos en `ammo.js`. En cada fotograma se extraen sus transformaciones globales (`getWorldPosition` y `getWorldQuaternion`) para actualizar el motor físico y transmitir impulso real a la bola al golpearla.
* **Obstáculo móvil en bucle y respuesta visual:** El bloque central combina traslación horizontal y rotación en el eje Y mediante una interpolación `Sinusoidal.InOut` infinita en modo `yoyo`. Por su parte, los bumpers reaccionan a cada impacto con una animación de escala elástica (`Elastic.Out`).

### 3. Modelado de la mesa, materiales e iluminación
* **Estructura completa de máquina arcade:** Además del área de juego, el modelo incluye un cajón inferior estructural y cuatro patas metálicas con topes de goma apoyadas en el suelo.
* **Texturizado y acabados:** Se emplean cuatro texturas externas: ilustración arcade para la base del tablero (`tablero.jpg`), acabado metálico pulido en la bola (`bola.jpg`), textura metálica con mapa de relieve (`bumpMap`) en el marco exterior y las patas (`marco.jpg`), y un fondo equirrectangular de 360° (`fondo.jpg` con `THREE.EquirectangularReflectionMapping`).
* **Guías translúcidas y sombras integradas:** Los carriles y embudos interiores utilizan un material oscuro semitransparente que deja visible el arte del tablero. La escena combina luz ambiental, una luz puntual cian `PointLight` sobre los bumpers y una luz direccional con sombras suaves `PCFSoftShadowMap` proyectadas sobre un plano invisible `THREE.ShadowMaterial` bajo las patas para integrar la mesa en el entorno 360°.

### 4. Jugabilidad, interfaz (HUD) y audio
* **Mecánica de partida y puntuación:** El carril derecho permite lanzar la bola mediante un impulso lineal `applyCentralImpulse`, mientras que el sistema detecta automáticamente si la bola cae por debajo de las palas para reponerla en el punto de salida. Los bumpers superiores suman 100 puntos y el bumper central verde otorga 200 puntos, con control de cooldown para evitar lecturas múltiples en un mismo rebote.
* **Marcador (HUD):** Interfaz que muestra en tiempo real la puntuación acumulada, el contador de bolas jugadas y un recordatorio visual de los controles.
* **Síntesis de sonido con Web Audio API:** Cada acción relevante, como el lanzamiento, rebote en bumpers con distinta frecuencia según su valor y pérdida de bola genera efectos sonoros en tiempo real mediante osciladores triangulares `OscillatorNode` sin depender de archivos de audio externos.

## Controles

| Tecla / Acción | Función |
| :--- | :--- |
| **Espacio** | Lanzar la bola desde el carril derecho |
| **A** / **←** | Accionar pala izquierda |
| **D** / **→** | Accionar pala derecha |
| **Enter** | Reiniciar / sacar nueva bola |
| **Ratón (arrastrar / rueda)** | Rotar y hacer zoom con `OrbitControls` |

## Estructura del proyecto

* `src/index.js`: Inicialización gráfica, mundo físico, construcción de la mesa, controles, audio y bucle de simulación.
* `src/index.html`: Documento base donde se monta el lienzo WebGL.
* `src/texturas/`: Texturas aplicadas al tablero (`tablero.jpg`), la bola (`bola.jpg`), el marco (`marco.jpg`) y el fondo panorámico (`fondo.jpg`).
* `package.json`: Dependencias del proyecto (`three`, `ammojs-typed`, `@tweenjs/tween.js`).

## Fuentes y recursos utilizados

* **Bibliotecas:** [Three.js](https://threejs.org/), [Ammo.js](https://github.com/kripken/ammo.js/) y [Tween.js](https://github.com/tweenjs/tween.js/).
* **Texturas externas:**
  * `tablero.jpg` (ilustración del tablero): https://www.dreamstime.com/retro-arcade-glowing-neon-signs-pixel-art-characters-ai-generated-image-content-title-image329392003
  * `bola.jpg` (textura metálica de la bola): https://www.poliigon.com/texture/matte-metal-texture-black/7037
  * `marco.jpg` (textura metálica para marco y patas): https://www.magnific.com/free-photo/gray-concrete-wall_4410361.htm#fromView=keyword&page=1&position=32&uuid=fd21bddc-1eb6-47ce-9c2d-43ad7a460956&track=ais_hybrid&query=Scratched+chrome+wallpaper
  * `fondo.jpg` (entorno equirrectangular 360°): Imagen generada con IA por Gemini.

## Asistencia con herramientas de IA

Para el desarrollo de esta práctica se ha utilizado la IA como apoyo en la sincronización entre cuerpos cinemáticos `three.js`/`tween.js` y `ammo.js`, el ajuste de colisiones en sub-pasos de simulación, la configuración de materiales y la estructuración del código y el README.

## Vídeo de demostración

[![Demostración Pinball 3D](https://img.youtube.com/vi/54ZST_wmnmQ/maxresdefault.jpg)](https://www.youtube.com/watch?v=54ZST_wmnmQ)