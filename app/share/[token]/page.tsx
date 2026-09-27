import {sharedReport} from '@/lib/store';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Share({params}:{params:Promise<{token:string}>}){const {token}=await params;if(token.length>100)notFound();const r=await sharedReport(token);if(!r)notFound();return <main style={{maxWidth:900,margin:'40px auto',padding:20}}><article className={'report-preview '+r.template}><div className="report-kicker">{r.agency} / SEO REPORT</div><h1>{r.title}</h1><p>{r.website} · {r.period}</p><div className="report-rule"/>{r.sections.filter((s:any)=>!s.hidden).map((s:any)=><section key={s.id}><h2>{s.title}</h2><p>{s.text}</p></section>)}<footer>Site crawl · Updated {new Date(r.updatedAt).toLocaleDateString()} · AuditFlow</footer></article></main>}
