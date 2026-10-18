// Only known checkout and workspace routes can be used as sign-in return destinations.
export function workspacePath(value:unknown):string|undefined{
  return typeof value==='string'&&/^\/(?:checkout|staff|driver|merchant|admin(?:\/(?:team|products|inventory|settings))?|platform(?:\/security)?|workspaces|(?:company|field)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(value)&&value.length<=150?value:undefined;
}
