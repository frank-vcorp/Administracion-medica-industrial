/**
 * @file Redirección de compatibilidad para el catálogo legacy.
 * @id ARCH-20260325-02
 * @backup context/checkpoints/CHK_ARCH-20260325-02.md
 */
import { redirect } from 'next/navigation'

export default function ServicesPage() {
    redirect('/admin/services')
}
