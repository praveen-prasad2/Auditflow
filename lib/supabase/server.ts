import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
export function authConfig(){const e=env as unknown as Record<string,string>;return {url:e.SUPABASE_URL||'',key:e.SUPABASE_PUBLISHABLE_KEY||e.SUPABASE_ANON_KEY||'',origin:e.APP_ORIGIN||''}}
export function authConfigured(){const {url,key}=authConfig();return !!(url&&key)}
export function appOrigin(){const {origin}=authConfig();if(!origin)throw Error('APP_ORIGIN is not configured');const u=new URL(origin);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('APP_ORIGIN must use HTTPS outside local development');return u.origin}
export async function supabaseServer(){const {url,key}=authConfig();if(!url||!key)throw Error('Supabase is not configured. Add your project URL and publishable key.');const jar=await cookies();return createServerClient(url,key,{cookieOptions:{httpOnly:true,sameSite:'lax',secure:appOrigin().startsWith('https://'),path:'/'},cookies:{getAll(){return jar.getAll()},setAll(values){for(const {name,value,options} of values)jar.set(name,value,options)}}})}
export function supabasePublic(){const {url,key}=authConfig();if(!url||!key)throw Error('Supabase is not configured.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
