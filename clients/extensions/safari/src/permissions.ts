// Safari permissions module.
//
// Per ADR 0019, Safari grants the broad host permission at
// extension-install time. There is no runtime permission request flow,
// so both hasRegularPageAccess and requestRegularPageAccess always
// resolve to true.

export interface SafariPermissionsApi {
  hasRegularPageAccess: () => Promise<boolean>
  requestRegularPageAccess: () => Promise<boolean>
}

export function isRegularPageUrl (url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function hasRegularPageAccess (): Promise<boolean> {
  // Safari grants broad host permission at install time — always true.
  return true
}

export async function requestRegularPageAccess (): Promise<boolean> {
  // No runtime permission request needed — already granted at install.
  return true
}