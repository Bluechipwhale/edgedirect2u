// Generate SQL from the typed development fixtures. No credentials are needed.
const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}),file);
const {defaultTheme}=require('../src/lib/theme.ts');const {products,categories}=require('../src/lib/seed.ts');
const sql=value=>`'${String(value).replace(/'/g,"''")}'`;
const theme=sql(JSON.stringify(defaultTheme));
if (!fs.existsSync('supabase/migrations/003_default_theme.sql')) fs.writeFileSync('supabase/migrations/003_default_theme.sql',`-- Initial configuration only; no sample products in production.\ninsert into website_settings(id,config) values('draft',${theme}::jsonb),('published',${theme}::jsonb);\ninsert into theme_versions(config) values(${theme}::jsonb);\n`);
let seed='-- DEVELOPMENT FIXTURES ONLY. Never apply to a live catalogue.\n';
for(const c of categories)seed+=`insert into categories(id,name,image) values(${sql(c.id)},${sql(c.name)},${sql(c.image)}) on conflict(id) do nothing;\n`;
const merchants=[...new Map(products.map(p=>[p.merchant_id,p.merchant_name]))];
for(const [id,name] of merchants)if(id!=='edge')seed+=`insert into organizations values(${sql(id)},${sql(name)},'merchant'); insert into merchants(id,name,description,status) values(${sql(id)},${sql(name)},'Development fixture merchant','approved');\n`;
for(const p of products){const keys=['id','slug','name','category_id','brand','merchant_id','merchant_name','price_kobo','stock','reserved','image','images','description','options','featured','active','created_at'];seed+=`insert into products(${keys.join(',')}) values(${keys.map(k=>typeof p[k]==='object'?sql(JSON.stringify(p[k]))+'::jsonb':typeof p[k]==='boolean'||typeof p[k]==='number'?String(p[k]):sql(p[k])).join(',')});\n`;seed+=`insert into stock_movements(product_id,quantity,reason) values(${sql(p.id)},${p.stock},'Development opening stock');\n`;}
seed+=`insert into warehouses values('warehouse-lagos','Lagos development warehouse','Development fixture',true,now());\n`;
fs.writeFileSync('supabase/seed.sql',seed);
