// Chrome permissions module.
//
// Per ADR 0030, Chrome now grants the broad host permission at
// extension-install time (host_permissions in manifest). There is
// no runtime permission request flow, so hasRegularPageAccess
// always resolves to true.

export function isRegularPageUrl (url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function hasRegularPageAccess (): Promise<boolean> {
  // Broad host permission is granted at install time — always true.
  return true
}
