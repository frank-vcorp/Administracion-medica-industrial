/**
 * @id IMPL-20260324-01
 * FIX REFERENCE: FIX-20260324-01 — aterrizar en dashboard, no en workers
 */
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
