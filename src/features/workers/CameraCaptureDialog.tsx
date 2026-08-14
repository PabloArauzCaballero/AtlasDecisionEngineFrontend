'use client';

import { Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ModalDialog } from '../../components/ModalDialog';

interface CameraCaptureDialogProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Toma la selfie con la cámara del equipo, sin salir del portal.
 *
 * Subir un archivo obliga a hacerse la foto con otra cosa, guardarla y buscarla:
 * tres pasos fuera del portal para un dato que caduca en cuanto termina la
 * verificación. Aquí se toma y se manda.
 *
 * Va sobre `ModalDialog` y no sobre un overlay propio: ese componente ya monta
 * el diálogo en `document.body` —sin eso, la animación de entrada de la ruta
 * deja un `transform` que descoloca cualquier `position: fixed`, un defecto que
 * este portal ya pagó una vez—, atrapa el foco y cierra con Escape.
 *
 * Dos cosas que este diálogo se toma en serio por su cuenta:
 *
 * 1. **La cámara se apaga siempre.** Cada pista del `MediaStream` se detiene al
 *    cerrar, al desmontar y al fallar. Sin eso el testigo del portátil se queda
 *    encendido después de cerrar, que es a la vez un susto razonable y una
 *    promesa rota.
 * 2. **La foto se revisa antes de mandarla.** Se congela en el lienzo y hay que
 *    aceptarla: una selfie movida rechazada por el motor cuesta una ejecución y
 *    un minuto de espera; verla antes no cuesta nada.
 */
export function CameraCaptureDialog({ onCapture, onClose }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [estado, setEstado] = useState<'abriendo' | 'lista' | 'congelada' | 'error'>('abriendo');
  const [problema, setProblema] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function abrir() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `user` es la cámara frontal: la que apunta a quien se verifica. Sin
          // la pista, un móvil abre la trasera.
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelado) {
          detener(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setEstado('lista');
      } catch (error) {
        if (cancelado) return;
        setProblema(explicar(error));
        setEstado('error');
      }
    }

    void abrir();
    return () => {
      cancelado = true;
      detener(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  function capturar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const contexto = canvas.getContext('2d');
    if (!contexto) return;
    /*
     * Se dibuja SIN espejar, al revés de como se ve.
     *
     * La vista previa va espejada porque una imagen sin espejar se siente como
     * mirar a otra persona y nadie se encuadra bien así. Pero lo que se manda
     * tiene que ser la escena real: la selfie que se compara debe ser la de
     * verdad, no su reflejo.
     */
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
    setEstado('congelada');
  }

  function aceptar() {
    canvasRef.current?.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        onClose();
      },
      // JPEG y no PNG: una cámara produce una imagen fotográfica, y un PNG de
      // 1280x720 sin comprimir ronda los 2,5 MiB contra los ~200 KiB de éste.
      'image/jpeg',
      0.92,
    );
  }

  return (
    <ModalDialog
      title="Tomar la selfie"
      subtitle="La imagen se usa para verificar y no se conserva."
      icon={<Camera />}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          {estado === 'congelada' ? (
            <>
              <button type="button" className="button" onClick={() => setEstado('lista')}>
                Repetir
              </button>
              <button type="button" className="button button-primary" onClick={aceptar}>
                Usar esta foto
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button-primary"
              disabled={estado !== 'lista'}
              onClick={capturar}
            >
              Tomar foto
            </button>
          )}
        </>
      }
    >
      <div className="camera-stage">
        {/* Los dos conviven montados: alternarlos con `hidden` evita recrear el
            vídeo —y con él volver a pedir la cámara— cada vez que se repite. */}
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          hidden={estado !== 'lista'}
          aria-label="Vista previa de la cámara"
        />
        <canvas ref={canvasRef} className="camera-canvas" hidden={estado !== 'congelada'} />
        {estado === 'abriendo' ? (
          <p className="camera-hint" role="status">
            Pidiendo permiso para usar la cámara…
          </p>
        ) : null}
        {estado === 'error' ? (
          <p className="camera-hint is-error" role="alert">
            {problema}
          </p>
        ) : null}
      </div>

      {estado === 'lista' ? (
        <p className="camera-hint">
          Colócate de frente, con la cara centrada y sin nada que la tape. Se ve en espejo, como en
          un espejo de verdad; la foto se guarda sin espejar.
        </p>
      ) : null}
    </ModalDialog>
  );
}

function detener(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Traduce el fallo del navegador a algo accionable.
 *
 * Los nombres de estos errores están normalizados; el `message` no, y cambia
 * entre navegadores. Por eso se decide por `name`. «Permission denied» no le
 * dice a nadie que tiene que abrir el candado de la barra de direcciones.
 */
function explicar(error: unknown): string {
  const nombre = error instanceof Error ? error.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'El navegador bloqueó la cámara. Abre el candado de la barra de direcciones, permite la cámara para este sitio y vuelve a intentarlo. También puedes subir la selfie como archivo.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'No se encontró ninguna cámara en este equipo. Sube la selfie como archivo.';
  }
  if (nombre === 'NotReadableError') {
    return 'La cámara está ocupada por otro programa. Ciérralo y vuelve a intentarlo, o sube la selfie como archivo.';
  }
  return 'No se pudo abrir la cámara en este equipo. Sube la selfie como archivo.';
}
