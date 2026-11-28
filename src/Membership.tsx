import {useEffect,useState} from 'react'
import {supabase} from './supabaseClient'
export const membershipRequired=import.meta.env.VITE_MEMBERSHIP_PREVIEW==='true'
export type MembershipStatus='checking'|'guest'|'active'|'inactive'|'unavailable'
export function useMembership():MembershipStatus{
 const [status,setStatus]=useState<MembershipStatus>(membershipRequired?'checking':'active')
 useEffect(()=>{if(!membershipRequired)return;if(!supabase){setStatus('unavailable');return}const client=supabase;let active=true,epoch=0
 async function check(){const version=++epoch;setStatus('checking');try{const {data,error}=await client.auth.getUser();if(!active||version!==epoch)return;if(error||!data.user){setStatus('guest');return}
 const response=await client.from('subscriptions').select('status,current_period_end').eq('user_id',data.user.id).maybeSingle();if(!active||version!==epoch)return
 if(response.error){setStatus('unavailable');return}const row=response.data
 setStatus(row&&['active','trialing'].includes(row.status)&&Number.isFinite(Date.parse(row.current_period_end??''))&&Date.parse(row.current_period_end??'')>Date.now()?'active':'inactive')
 }catch{if(active&&version===epoch)setStatus('unavailable')}}
 void check();const {data}=client.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active)void check()},0)});const timer=setInterval(()=>void check(),60000);return()=>{active=false;epoch++;data.subscription.unsubscribe();clearInterval(timer)}
 },[])
 return status
}
export function MembershipNotice({status,onAccount}:{status:MembershipStatus;onAccount:()=>void}){
 return <section className="panel membership-gate"><span className="eyebrow gold">EDGEIQ · MEMBERSHIP</span><h1>{status==='checking'?'Checking membership…':'Members-only research'}</h1><p>{status==='unavailable'?'Membership verification is unavailable.':status==='guest'?'Sign in to check your membership.':'An active membership is required in this preview.'}</p><button className="cta" onClick={onAccount}>View membership &amp; sign in</button><p className="footnote">Checkout is not enabled in this preview.</p></section>
}
export function MembershipPlans(){
 return <section className="panel membership-plans"><span className="eyebrow gold">EDGEIQ PRO · PLANNED MEMBERSHIP</span><h2>Choose your future membership</h2><p>All research is currently free. These are planned prices, not active subscriptions.</p><div className="membership-grid">{[['Weekly','$4.99','/week'],['Monthly','$12.99','/month'],['Annual','$99.99','/year']].map(([label,price,period])=><article key={label}><h3>{label}</h3><strong>{price}</strong><span>{period}</span><p>Full research access after launch</p></article>)}</div><p className="footnote">No payment is taken. Join the interest list below for launch updates.</p></section>
}
