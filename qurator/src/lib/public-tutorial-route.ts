export function isPublicTutorialRoute(pathname: string): boolean {
  return pathname === '/tutorials' || pathname.startsWith('/tutorials/');
}
