import { z } from 'zod';
import type { Theme } from './theme';
import { themeSchema } from './theme';
export const FLAGSHIP_ID='10000000-0000-4000-8000-000000000001';
export const companyRoles=['company_admin','supervisor','field_agent','vendor','customer'] as const;
export type CompanyRole=typeof companyRoles[number];
export type Company={id:string;slug:string;name:string;address:string;active:boolean;package:string;brand:Theme;brand_draft:Theme;geofence_metres:number;daily_target:number;allow_web_checkin:boolean};
export type CompanyMember={company_id:string;user_id:string;role:CompanyRole;active:boolean;label:string};
export type FieldStore={id:string;company_id:string;name:string;address:string;latitude:number;longitude:number;radius_metres:number|null};
export type Assignment={id:string;company_id:string;store_id:string;agent_id:string;visit_date:string};
export type Visit={id:string;assignment_id:string;agent_id:string;started_at:string;completed_at:string|null;override_reason:string|null;task_report:Record<string,unknown>|null};
export type Shift={id:string;agent_id:string;started_at:string;ended_at:string|null};
export type CompanySnapshot={company:Company;role:CompanyRole;actorId:string;metrics:{stores:number;planned:number;completed:number;agents:number};members:CompanyMember[];stores:FieldStore[];assignments:Assignment[];visits:Visit[];shifts:Shift[];modules:{module:string;enabled:boolean}[];versions:{id:string;created_at:string}[]};
const company={company_id:z.uuid()};
export const platformCommand=z.discriminatedUnion('action',[
  z.object({action:z.literal('create-company'),slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(2).max(60),name:z.string().trim().min(2).max(100),owner:z.email(),package:z.enum(['commerce','delivery','field_operations','enterprise'])}),
  z.object({action:z.literal('activation'),...company,active:z.boolean()}),
  z.object({action:z.literal('company-address'),...company,address:z.string().trim().max(500)}),
  z.object({action:z.literal('member'),...company,email:z.email(),role:z.enum(companyRoles),active:z.boolean()}),
  z.object({action:z.literal('brand'),...company,operation:z.enum(['draft','publish','rollback']),config:themeSchema,version:z.uuid().optional()}),
  z.object({action:z.literal('policy'),...company,radius:z.number().int().min(25).max(1000),target:z.number().int().min(1).max(200),web:z.boolean()}),
  z.object({action:z.literal('store'),...company,name:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(500),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),radius:z.number().int().min(25).max(1000).nullable()}),
  z.object({action:z.literal('assignment'),...company,store:z.uuid(),agent:z.uuid(),date:z.iso.date()}),
  z.object({action:z.literal('shift'),...company,operation:z.enum(['in','out'])}),
  z.object({action:z.literal('checkin'),...company,assignment:z.uuid(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0).max(50),captured:z.iso.datetime()}),
  z.object({action:z.literal('override'),...company,assignment:z.uuid(),reason:z.string().trim().min(15).max(500)}),
  z.object({action:z.literal('complete'),...company,visit:z.uuid(),report:z.object({stock_checked:z.literal(true),contact_confirmed:z.literal(true),notes:z.string().trim().min(10).max(2000)})}),
]);
