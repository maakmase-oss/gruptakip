import makeWASocket,{DisconnectReason,fetchLatestBaileysVersion,useMultiFileAuthState} from "@whiskeysockets/baileys";
import P from "pino";
import QRCode from "qrcode";
import http from "node:http";
const log=P({level:process.env.LOG_LEVEL||"info"});
let currentQR=null,connected=false;
const port=Number(process.env.PORT||3000);

http.createServer(async(req,res)=>{
 const u=new URL(req.url||"/","http://localhost");
 const path=u.pathname;
 if(path==="/health"){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});return res.end(JSON.stringify({ok:true,connected,qrAvailable:!!currentQR}));}
 if(path==="/qr.png"){
   if(connected){res.writeHead(409,{"content-type":"text/plain"});return res.end("WhatsApp already connected");}
   if(!currentQR){res.writeHead(503,{"content-type":"text/plain","cache-control":"no-store"});return res.end("QR is preparing");}
   try{const png=await QRCode.toBuffer(currentQR,{type:"png",width:700,margin:4,errorCorrectionLevel:"M"});res.writeHead(200,{"content-type":"image/png","cache-control":"no-store,no-cache,must-revalidate","content-length":png.length});return res.end(png);}catch(e){res.writeHead(500);return res.end("QR error");}
 }
 if(path==="/favicon.ico"){res.writeHead(204);return res.end();}
 res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store,no-cache,must-revalidate"});
 if(connected)return res.end("<!doctype html><meta name=viewport content='width=device-width'><body style='font-family:Arial;text-align:center;padding:40px'><h1>GrupTakip</h1><h2>WhatsApp baglandi ✓</h2></body>");
 if(!currentQR)return res.end("<!doctype html><meta http-equiv='refresh' content='2'><meta name=viewport content='width=device-width'><body style='font-family:Arial;text-align:center;padding:40px'><h2>QR hazirlaniyor...</h2></body>");
 res.end(`<!doctype html><meta http-equiv="refresh" content="15"><meta name="viewport" content="width=device-width"><body style="font-family:Arial;text-align:center;background:white;color:black;padding:16px"><h1>GrupTakip</h1><p>WhatsApp &gt; Bagli cihazlar &gt; Cihaz bagla</p><img style="width:min(94vw,700px)" src="/qr.png?t=${Date.now()}"><p>QR otomatik yenilenir.</p></body>`);
}).listen(port,"0.0.0.0",()=>console.log("QR web server listening",port));

async function start(){
 const {state,saveCreds}=await useMultiFileAuthState(process.env.AUTH_DIR||"./auth");
 const {version}=await fetchLatestBaileysVersion();
 const sock=makeWASocket({version,auth:state,logger:log,printQRInTerminal:false,syncFullHistory:false});
 sock.ev.on("creds.update",saveCreds);
 sock.ev.on("connection.update",({connection,lastDisconnect,qr})=>{
   if(qr){currentQR=qr;connected=false;console.log("LIVE_QR_READY");}
   if(connection==="open"){connected=true;currentQR=null;console.log("WhatsApp baglandi.");}
   if(connection==="close"){connected=false;const code=lastDisconnect?.error?.output?.statusCode;const retry=code!==DisconnectReason.loggedOut;console.log("Baglanti kapandi.",{code,retry});if(retry)setTimeout(start,3000);}
 });
 sock.ev.on("group-participants.update",async event=>{
   if(event.action!=="add")return;
   const meta=await sock.groupMetadata(event.id).catch(()=>null);
   for(const jid of event.participants){
     const payload={event:"participant_added",groupId:event.id,groupName:meta?.subject||event.id,participant:jid,detectedAt:new Date().toISOString()};
     console.log("YENI_UYE",JSON.stringify(payload));
     const url=process.env.INGEST_URL,secret=process.env.INGEST_SECRET;
     if(url&&secret)await fetch(url,{method:"POST",headers:{"content-type":"application/json","x-gruptakip-secret":secret},body:JSON.stringify(payload)}).catch(e=>console.error("Panel aktarimi basarisiz",e.message));
   }
 });
}
start().catch(e=>{console.error(e);process.exit(1)});