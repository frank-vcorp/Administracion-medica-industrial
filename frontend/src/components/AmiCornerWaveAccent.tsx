/**
 * Acento decorativo (esquina inferior derecha), inspirado en la ola del pie
 * del sitio corporativo AMI. No intercepta clics ni desplaza layout.
 */
export function AmiCornerWaveAccent() {
  return (
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-0 hidden sm:block w-[min(38vw,280px)] h-[min(22vh,120px)] text-[#592c82] opacity-[0.08] print:hidden"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        className="h-full w-full fill-current"
      >
        {/* Valle suave anclado a la esquina inferior derecha (eco DISEÑO1-02) */}
        <path
          d="M0,120 L320,120 L320,0 C240,72 140,88 0,52 Z"
        />
      </svg>
    </div>
  )
}
