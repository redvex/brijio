export const regularPageOrigins = ['http://*/*', 'https://*/*']

export interface ChromePermissionsApi {
  contains: (permissions: { origins: string[] }) => Promise<boolean>
  request: (permissions: { origins: string[] }) => Promise<boolean>
}

export function isRegularPageUrl (url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function hasRegularPageAccess (
  permissions: ChromePermissionsApi
): Promise<boolean> {
  return await permissions.contains({
    origins: regularPageOrigins
  })
}

export async function requestRegularPageAccess (
  permissions: ChromePermissionsApi
): Promise<boolean> {
  return await permissions.request({
    origins: regularPageOrigins
  })
}
