import Link from 'next/link';
import {requireRole} from '@/lib/server';
import {ProductImporter} from '@/components/product-importer';
export default async function Page(){await requireRole(['admin']);return <><nav className="resource-subnav"><Link href="/admin/products">Products</Link><Link href="/admin/categories">Category IDs</Link><Link href="/admin/merchants">Inventory owners</Link></nav><ProductImporter/></>;}
