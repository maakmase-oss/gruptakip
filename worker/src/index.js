import makeWASocket,{DisconnectReason,fetchLatestBaileysVersion,useMultiFileAuthState} from "@whiskeysockets/baileys";
import P from "pino";
import QRCode from "qrcode";
import http from "node:http";
const log=P({level:process.env.LOG_LEVEL||"info"});
let currentQR=null,connected=false;
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{
 const path=new URL(req.url||"/","http://localhost").pathname;
 if(path==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,connected,qrAvailable:!!currentQR}));}
 if(path==="/favicon.ico"){res.writeHead(204);return res.end();}
 res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store,no-cache,must-revalidate"});
 if(connected)return res.end("<!doctype html><meta name=viewport content='width=device-width'><body style='font-family:Arial;text-align:center;padding:40px'><h1>GrupTakip</h1><h2>WhatsApp baglandi ✓</h2></body>");
 if(!currentQR)return res.end("<!doctype html><meta http-equiv='refresh' content='2'><meta name=viewport content='width=device-width'><body style='font-family:Arial;text-align:center;padding:40px'><h2>QR hazirlaniyor...</h2><p>Sayfa otomatik yenilenecek.</p></body>");
 try{const data=await QRCode.toDataURL(currentQR,{width:600,margin:4,errorCorrectionLevel:"M"});res.end(`<!doctype html><meta http-equiv="refresh" content="12"><meta name="viewport" content="width=device-width"><body style="font-family:Arial;text-align:center;background:white;color:black;padding:16px"><h1>GrupTakip</h1><p>WhatsApp &gt; Bagli cihazlar &gt; Cihaz bagla</p><img alt="WhatsApp QR" style="width:min(94vw,600px);height:auto" src="${data}"><p>QR otomatik yenilenir.</p></body>`);}catch(e){res.end("<h2>QR olusturulamadi, sayfayi yenileyin.</h2>");}
}).listen(port,"0.0.0.0",()=>console.log("QR web server listening",port));
async function start(){const {state,saveCreds}=await useMultiFileAuthState(process.env.AUTH_DIR||"./auth");const {version}=await fetchLatestBaileysVersion();const sock=makeWASocket({version,auth:state,logger:log,printQRInTerminal:false,syncFullHistory:false});sock.ev.on("creds.update",saveCreds);sock.ev.on("connection.update",({connection,lastDisconnect,qr})=>{if(qr){currentQR=qr;connected=false;console.log("Yeni QR hazir.");}if(connection==="open"){connected=true;currentQR=null;console.log("WhatsApp baglandi.");}if(connection==="close"){connected=false;const code=lastDisconnect?.error?.output?.statusCode;const retry=code!==DisconnectReason.loggedOut;console.log("Baglanti kapandi.",{code,retry});if(retry)setTimeout(start,3000);}});sock.ev.on("group-participants.update",async event=>{if(event.action!=="add")return;const meta=await sock.groupMetadata(event.id).catch(()=>null);for(const jid of event.participants){const payload={event:"participant_added",groupId:event.id,groupName:meta?.subject||event.id,participant:jid,detectedAt:new Date().toISOString()};console.log("YENI_UYE",JSON.stringify(payload));const url=process.env.INGEST_URL,secret=process.env.INGEST_SECRET;if(url&&secret)await fetch(url,{method:"POST",headers:{"content-type":"application/json","x-gruptakip-secret":secret},body:JSON.stringify(payload)}).catch(e=>console.error("Panel aktarimi basarisiz",e.message));}})}
start().catch(e=>{console.error(e);process.exit(1)});