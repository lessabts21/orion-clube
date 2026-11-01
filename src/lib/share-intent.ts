/**
 * Adapter contract for native Android/iOS shared-file intake.
 *
 * This file deliberately does not pretend that browser file input is equivalent
 * to a native Share Sheet receiver. A Capacitor receive-sharing plugin and its
 * Android intent filters / iOS Share Extension must be installed and configured
 * before this adapter can return files.
 */
export type SharedDocument = {
  name: string
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'
  uri: string
}

export type ShareIntentBridge = {
  getSharedDocuments(): Promise<SharedDocument[]>
  clearSharedDocuments(): Promise<void>
}

export const supportedSharedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

/** Validate the metadata after a native bridge has delivered a document. */
export function validateSharedDocument(document: SharedDocument): string | null {
  if (!document.name.trim()) return 'O arquivo compartilhado não possui nome.'
  if (!supportedSharedMimeTypes.includes(document.mimeType)) return 'Formato não suportado.'
  if (!document.uri.trim()) return 'O aplicativo nativo não informou a localização do arquivo.'
  return null
}
