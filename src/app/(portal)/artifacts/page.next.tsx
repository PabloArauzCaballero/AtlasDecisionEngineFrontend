import { redirect } from 'next/navigation';

/** El inventario de artefactos se fundió con «Algoritmos y versiones»: una sola pantalla. */
export default function ArtifactsRoute() {
  redirect('/algorithms');
}
