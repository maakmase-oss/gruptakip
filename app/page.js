"use client";
import { useEffect, useState } from "react";
const W="/api/worker";
export default function Home(){
 const [accounts,setAccounts]=useState([]); const [aid,setAid]=useState("main"); const [groups,setGroups]=useState([]); const [events,setEvents]=useState([]); const [name,setName]=useState(""); const [loading,setLoading]=useState(false);
 const account=accounts.find((x)=>x.id===aid)||{};
 function url(path){return W+path+"?accountId="+encodeURIComponent(aid);}
 async function refresh(id=aid){
  setLoading(true);
  try{
   const ar=await fetch(W+"/accounts",{cache:"no-store"}); const ad=await ar.json(); const list=ad.accounts||[]; setAccounts(list);
   const current=list.find((x)=>x.id===id);
   const er=await fetch(W+"/events?accountId="+encodeURIComponent(id),{cache:"no-store"}); const ed=await er.json(); setEvents(ed.events||[]);
   if(current&&current.connected){const gr=await fetch(W+"/groups?accountId="+encodeURIComponent(id),{cache:"no-store"});const gd=await gr.json();setGroups(gd.groups||[]);}else setGroups([]);
  }catch(e){console.error(e);} finally{setLoading(false);}
 }
 useEffect(()=>{refresh(aid);const t=setInterval(()=>refresh(aid),15000);return()=>clearInterval(t);},[aid]);
 async function addAccount(){if(!name.trim())return;const r=await fetch(W+"/accounts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:name.trim()})});const d=await r.json();if(d.id){setName("");setAid(d.id);}}
 async function save(next){setGroups(next);await fetch(url("/groups"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({groupIds:next.filter((x)=>x.monitored).map((x)=>x.id)})});}
 async function toggle(id){await save(groups.map((x)=>x.id===id?{...x,monitored:!x.monitored}:x));}
 async function all(){await save(groups.map((x)=>({...x,monitored:true})));}
 const joined=events.filter((x)=>x.event==="participant_added");
 return <main>
  <header><div><span className="brand">GRUPTAKİP</span><h1>WhatsApp Grup Takip Paneli</h1><p>Birden fazla yönetici WhatsApp hesabını ayrı ayrı takip edin.</p></div><div className="status">● {account.connected?"WhatsApp bağlı":"Bağlantı yok"}</div></header>
  <section className="panel"><div className="panelHead"><div><h2>WhatsApp Hesapları</h2><p>Hesap seçin veya yeni yönetici hesabı ekleyin.</p></div><div><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Örn. Yönetici 2"/> <button onClick={addAccount}>Yeni Hesap Ekle</button></div></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{accounts.map((x)=><button key={x.id} className={x.id===aid?"on":""} onClick={()=>setAid(x.id)}>{x.name} · {x.connected?"Bağlı":"QR Bekliyor"}</button>)}</div></section>
  {!account.connected&&account.id&&<section className="panel"><div className="panelHead"><div><h2>{account.name} Bağlantısı</h2><p>İlgili telefonda WhatsApp / Bağlı cihazlar / Cihaz bağla bölümünden QR kodu okutun.</p></div><button onClick={()=>refresh(aid)}>QR Yenile</button></div><div style={{textAlign:"center",padding:20}}><img src={url("/qr.png")+"&t="+Date.now()} alt="WhatsApp QR" style={{maxWidth:360,width:"100%",background:"#fff",padding:12,borderRadius:12}}/></div></section>}
  <section className="cards"><article><b>{groups.filter((x)=>x.monitored).length}</b><span>Takip edilen grup</span></article><article><b>{groups.length}</b><span>Bu hesaptaki grup</span></article><article><b>{events.length}</b><span>Kayıtlı olay</span></article><article><b>{accounts.filter((x)=>x.connected).length}</b><span>Bağlı WhatsApp</span></article></section>
  <section className="panel"><div className="panelHead"><div><h2>{account.name||"Hesap"} · Gruplarım</h2><p>Bu hesaptan takip edilecek grupları seçin.</p></div><div><button onClick={all}>Tümünü Takip Et</button> <button onClick={()=>refresh(aid)}>Yenile</button></div></div>{loading?<div className="empty">Yükleniyor...</div>:!account.connected?<div className="empty">Önce bu WhatsApp hesabını QR ile bağlayın.</div>:groups.map((x)=><div className="groupRow" key={x.id}><div><b>{x.name}</b><p>{x.participants} katılımcı</p></div><button className={x.monitored?"on":""} onClick={()=>toggle(x.id)}>{x.monitored?"Takip Ediliyor":"Takip Et"}</button></div>)}</section>
  <section className="panel"><div className="panelHead"><div><h2>Yeni Katılanlar</h2><p>{account.name||"Seçili hesap"} üzerinden tespit edilenler.</p></div></div>{joined.length===0?<div className="empty">Henüz kayıt yok.</div>:<table><thead><tr><th>GRUP</th><th>NUMARA</th><th>GİRİŞ ZAMANI</th></tr></thead><tbody>{joined.slice(0,100).map((x)=><tr key={x.id}><td>{x.groupName}</td><td>+{x.phone}</td><td>{new Date(x.detectedAt).toLocaleString("tr-TR")}</td></tr>)}</tbody></table>}</section>
 </main>;
}