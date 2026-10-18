export function driverDestination(role:string|undefined,companies:{slug:string;role:string}[],businessRole?:string):string|null{
  if(role==='driver')return null;
  const field=companies.find(company=>company.role==='field_agent'&&/^[a-z0-9-]+$/.test(company.slug));
  if(field)return `/field/${field.slug}`;
  if(businessRole==='van_sales')return '/staff';
  if(['admin','operations','merchant'].includes(role||'')||companies.length||businessRole)return '/workspaces';
  return null;
}
