export function customerCsvCell(value:unknown){
  let string=String(value??'');
  if(/^\s*[=+\-@\t\r]/.test(string))string="'"+string;
  return `"${string.replaceAll('"','""')}"`;
}
