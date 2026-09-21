import { NextResponse } from "next/server";

const ROLE_PERMISSIONS={
  superadmin:["*"],
  admin:["view","blacklist","group_membership","messages","accounts"],
  operation:["view","blacklist"],
  viewer:["view"]
};

function credentials(){
  const users=[];
  if(process.env.PANEL_USER&&process.env.PANEL_PASSWORD)users.push({user:process.env.PANEL_USER,pass:process.env.PANEL_PASSWORD,role:"superadmin"});
  try{
    const extra=JSON.parse(process.env.PANEL_USERS||"[]");
    for(const x of extra)if(x?.user&&x?.pass)users.push({user:String(x.user),pass:String(x.pass),role:["superadmin","admin","operation","viewer"].includes(x.role)?x.role:"viewer"});
  }catch{}
  return users;
}
function authenticate(request){
  const auth=request.headers.get("authorization");
  if(!auth)return null;
  const [scheme,encoded]=auth.split(" ");
  if(scheme!=="Basic"||!encoded)return null;
  try{
    const decoded=atob(encoded),i=decoded.indexOf(":");
    if(i<0)return null;
    const user=decoded.slice(0,i),pass=decoded.slice(i+1);
    return credentials().find(x=>x.user===user&&x.pass===pass)||null;
  }catch{return null}
}
function requiredPermission(path,method){
  if(path.startsWith("/api/worker/send-message"))return"messages";
  if(path.startsWith("/api/worker/group-membership"))return"group_membership";
  if(path.startsWith("/api/worker/accounts")&&method==="POST")return"accounts";
  if(path.startsWith("/api/worker/blacklist")&&method==="POST")return"blacklist";
  if(path.startsWith("/api/worker/groups")&&method==="POST")return"accounts";
  return"view";
}
export function middleware(request){
  const member=authenticate(request);
  if(!member)return new NextResponse("GrupTakip - Giris gerekli",{status:401,headers:{"WWW-Authenticate":'Basic realm="GrupTakip", charset="UTF-8"',"Cache-Control":"no-store"}});
  const need=requiredPermission(request.nextUrl.pathname,request.method),allowed=ROLE_PERMISSIONS[member.role]||ROLE_PERMISSIONS.viewer;
  if(!(allowed.includes("*")||allowed.includes(need)))return NextResponse.json({ok:false,error:"Bu işlem için yetkiniz yok."},{status:403,headers:{"Cache-Control":"no-store"}});
  const headers=new Headers(request.headers);headers.set("x-panel-user",member.user);headers.set("x-panel-role",member.role);
  return NextResponse.next({request:{headers}});
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
