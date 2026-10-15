import { AuthForm } from '@/components/auth-form';
import { workspacePath } from '@/lib/workspace-path';
export default async function Page({searchParams}:{searchParams:Promise<{next?:string|string[]}>}){return <AuthForm register returnTo={workspacePath((await searchParams).next)}/>;}
