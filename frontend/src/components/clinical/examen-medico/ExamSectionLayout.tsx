'use client'

import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'

export const EXAM_CARD_CLASS =
  'bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4'

export const EXAM_CARD_TITLE_CLASS =
  'text-xs font-bold text-slate-700 uppercase tracking-wide pb-2 border-b border-slate-100'

export const EXAM_LABEL_CLASS =
  'block text-xs font-semibold text-slate-600 mb-1.5'

export const EXAM_INPUT_CLASS =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none disabled:opacity-60 transition-colors'

export const EXAM_NUMERIC_INPUT_CLASS =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none disabled:opacity-60 transition-colors'

export const EXAM_TEXTAREA_CLASS =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none disabled:opacity-60 transition-colors'

export interface ExamSectionHeaderProps {
  icon?: ComponentType<LucideProps> | ReactNode
  title: string
  subtitle: string
  stepNumber: number
  totalSteps: number
  rightSlot?: ReactNode
}

export function ExamSectionHeader({
  icon: Icon,
  title,
  subtitle,
  stepNumber,
  totalSteps,
  rightSlot,
}: ExamSectionHeaderProps) {
  const renderIcon = () => {
    if (!Icon) return null
    if (isValidElement(Icon)) return Icon
    if (
      typeof Icon === 'function' ||
      (typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon)
    ) {
      return createElement(Icon as ComponentType<LucideProps>, {
        className: 'h-4 w-4',
        strokeWidth: 2.25,
        'aria-hidden': true,
      })
    }
    return Icon
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
          {renderIcon()}
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800 leading-tight">{title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {rightSlot}
        <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-bold text-teal-700">
          Paso {stepNumber} de {totalSteps}
        </span>
      </div>
    </div>
  )
}

export interface ExamSectionFooterProps {
  readonly: boolean
  isBusy: boolean
  statusMessage?: string
  onPrev?: () => void
  prevLabel?: string
  onSaveDraft?: () => void
  draftLabel?: string
  onPrimary?: () => void
  primaryLabel?: string
  primaryVariant?: 'teal' | 'emerald'
  primaryDisabled?: boolean
  primaryTitle?: string
}

export function ExamSectionFooter({
  readonly,
  isBusy,
  statusMessage,
  onPrev,
  prevLabel = '← Anterior',
  onSaveDraft,
  draftLabel = 'Guardar borrador',
  onPrimary,
  primaryLabel,
  primaryVariant = 'teal',
  primaryDisabled = false,
  primaryTitle,
}: ExamSectionFooterProps) {
  const primaryColorClass =
    primaryVariant === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : 'bg-teal-600 hover:bg-teal-700 text-white'

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        {onPrev && !readonly && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onPrev}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-lg text-xs sm:text-sm transition-colors disabled:opacity-50"
          >
            {prevLabel}
          </button>
        )}
        {statusMessage ? (
          <p className="text-xs font-medium text-slate-600">{statusMessage}</p>
        ) : null}
      </div>

      {!readonly && (
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {onSaveDraft && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onSaveDraft}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors disabled:opacity-50"
            >
              {isBusy ? 'Guardando...' : draftLabel}
            </button>
          )}
          {onPrimary && primaryLabel && (
            <button
              type="button"
              disabled={isBusy || primaryDisabled}
              onClick={onPrimary}
              title={primaryTitle}
              className={`${primaryColorClass} font-bold px-5 py-2 rounded-lg text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isBusy ? 'Guardando...' : primaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
