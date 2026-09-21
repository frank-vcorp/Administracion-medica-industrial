/**
 * Ola decorativa al pie del panel principal (no bajo el sidebar).
 * Eco suave del pie corporativo AMI (valle amplio, DISEÑO1-02).
 */
export function AmiCornerWaveAccent() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[min(20vh,112px)] text-[#592c82] opacity-[0.13] print:hidden"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="h-full w-full fill-current"
      >
        <path
          d="M0,120 L1440,120 L1440,18 C1080,92 360,92 0,18 Z"
        />
      </svg>
    </div>
  )
}
