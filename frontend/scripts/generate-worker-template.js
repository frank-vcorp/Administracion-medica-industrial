#!/usr/bin/env node
/**
 * Script generador de plantilla Excel para carga masiva de trabajadores.
 * Genera: frontend/public/templates/plantilla-trabajadores.xlsx
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-11-ALTA-MASIVA-TRABAJADORES.md
 */

const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

const HEADERS = [
  'Nombre(s)',
  'Apellido(s)',
  'CURP o ID Nacional',
  'Fecha de Nacimiento',
  'Género',
  'Correo Electrónico',
  'Teléfono',
  'Puesto',
]

const EXAMPLE_ROW = [
  'Juan Carlos',
  'García López',
  'GALJ900101HMCRCN02',
  '01/01/1990',
  'M',
  'jcgarcia@empresa.com',
  '5512345678',
  'Operador de Producción',
]

const workbook = XLSX.utils.book_new()
const wsData = [HEADERS, EXAMPLE_ROW]
const worksheet = XLSX.utils.aoa_to_sheet(wsData)

// Ancho de columnas
worksheet['!cols'] = [
  { wch: 20 }, // Nombre(s)
  { wch: 22 }, // Apellido(s)
  { wch: 22 }, // CURP o ID Nacional
  { wch: 20 }, // Fecha de Nacimiento
  { wch: 8 },  // Género
  { wch: 28 }, // Correo Electrónico
  { wch: 14 }, // Teléfono
  { wch: 25 }, // Puesto
]

XLSX.utils.book_append_sheet(workbook, worksheet, 'Trabajadores')

const outputPath = path.join(__dirname, '..', 'public', 'templates', 'plantilla-trabajadores.xlsx')
XLSX.writeFile(workbook, outputPath)

console.log(`✅ Plantilla generada en: ${outputPath}`)
