import makeWASocket,{DisconnectReason,fetchLatestBaileysVersion,useMultiFileAuthState} from "@whiskeysockets/baileys";
import P from "pino";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import http from "node:http";
const log=P({level:process.env.LOG_LEVEL||"info"});
let currentQR=null, connected=false;
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{
  if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,connected,qrAvailable:!!currentQR}));}
  if(req.url!=="/"){res.writeHead(404);return res.end("Not found");}
  res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
  if(connected)return res.end("<html><meta name=viewport content='width=device-width'><body style='font-family:Arial;text-align:center;padding:40px'><h1>GrupTakip</h1><h2>WhatsApp baglandi ✓</h2></body></html>");
  if(!currentQR)return res.end("<html><meta http-equiv='refresh' content='3'><meta name=viewport content='width=device-width'><body style='font-family:Arial;text-align:center;padding:40px'><h2>QR hazirlaniyor...</h2></body></html>");
  const data=await QRCode.toDataURL(currentQR,{width:520,margin:3,errorCorrectionLevel:"M"});
  res.end(`<html><meta http-equiv="refresh" content="15"><meta name="viewport" content="width=device-width"><body style="font-family:Arial;text-align:center;background:#fff;padding:20px"><h1>GrupTakip</h1><p>WhatsApp → Bagli cihazlar → Cihaz bagla</p><img style="width:min(92vw,520px)" src="${data}"><p>QR yenilenirse sayfa otomatik guncellenir.</p></body></html>`);
}).listen(port,()=>console.log("QR web server port",port));
async function start(){const {state,saveCreds}=await useMultiFileAuthState(process.env.AUTH_DIR||"./auth");const {version}=await fetchLatestBaileysVersion();const sock=makeWASocket({version,auth:state,logger:log,printQRInTerminal:false,syncFullHistory:false});sock.ev.on("creds.update",saveCreds);sock.ev.on("connection.update",({connection,lastDisconnect,qr})=>{if(qr){currentQR=qr;connected=false;console.log("\nGrupTakip QR kodu:");qrcodeTerminal.generate(qr,{small:true});}if(connection==="open"){connected=true;currentQR=null;console.log("WhatsApp baglandi.");}if(connection==="close"){connected=false;const code=lastDisconnect?.error?.output?.statusCode;const retry=code!==DisconnectReason.loggedOut;console.log("Baglanti kapandi.",{code,retry});if(retry)setTimeout(start,3000);}});sock.ev.on("group-participants.update",async event=>{if(event.action!=="add")return;const meta=await sock.groupMetadata(event.id).catch(()=>null);for(const jid of event.participants){const payload={event:"participant_added",groupId:event.id,groupName:meta?.subject||event.id,participant:jid,detectedAt:new Date().toISOString()};console.log("YENI_UYE",JSON.stringify(payload));const url=process.env.INGEST_URL,secret=process.env.INGEST_SECRET;if(url&&secret)await fetch(url,{method:"POST",headers:{"content-type":"application/json","x-gruptakip-secret":secret},body:JSON.stringify(payload)}).catch(e=>console.error("Panel aktarimi basarisiz",e.message));}})}
start().catch(e=>{console.error(e);process.exit(1)});