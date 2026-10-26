'use client'

import type { ReactNode } from 'react'

export function AmiMirrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
      <span className="font-bold text-slate-800">Papeleta AMI — </span>
      {children}
    </div>
  )
}

export function AmiMirrorTable({
  rows,
  emptyHint,
}: {
  rows: { label: string; value: string }[]
  emptyHint: string
}) {
  if (!rows.length) {
    if (!emptyHint.trim()) return null
    return <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{emptyHint}</p>
  }
  return (
    <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
      <thead className="bg-slate-100">
        <tr>
          <th className="text-left p-2 font-semibold text-slate-600 w-1/3">Campo</th>
          <th className="text-left p-2 font-semibold text-slate-600">Valor capturado (AMI)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-slate-100">
            <td className="p-2 text-slate-500 capitalize">{row.label}</td>
            <td className="p-2 text-slate-800 whitespace-pre-wrap">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AmiMirrorTextBlock({ title, text, emptyHint }: { title: string; text: string; emptyHint: string }) {
  if (!text.trim()) {
    if (!emptyHint.trim()) return null
    return (
      <div>
        {title ? <p className="text-[11px] font-semibold text-slate-600 mb-1">{title}</p> : null}
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{emptyHint}</p>
      </div>
    )
  }
  return (
    <div>
      {title ? <p className="text-[11px] font-semibold text-slate-600 mb-1">{title}</p> : null}
      <p className="text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
        {text}
      </p>
    </div>
  )
}
