/* A Jornada · cria no TEC Concursos, na conta do próprio aluno, um caderno de 20 a 30 questões por aula.
   Roda dentro do site do TEC (aberto pelo botão "➜ A Jornada" dos favoritos), usa a sessão do aluno e devolve
   à plataforma os números dos cadernos, que ficam gravados nas tarefas de questões de cada aula. */
(function(){
  if(window.__jxCadRun)return;window.__jxCadRun=1;
  var D=document,raw="";
  try{raw=(location.hash.match(/jxcad=([^&]*)/)||[])[1]||sessionStorage.getItem("jxcad")||""}catch(e){}
  var J=null;try{J=JSON.parse(decodeURIComponent(raw))}catch(e){try{J=JSON.parse(raw)}catch(x){}}
  var ID="jx-cad-box",old=D.getElementById(ID);if(old)old.remove();
  var box=D.createElement("div");box.id=ID;
  box.style.cssText="position:fixed;top:16px;right:16px;z-index:2147483647;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;background:#120d2b;color:#f1ecff;border:1px solid #a06bff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);padding:18px;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  D.body.appendChild(box);
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  var BTN="display:inline-block;margin-top:12px;padding:10px 16px;border-radius:10px;background:linear-gradient(90deg,#7b3cff,#ff5f8f);color:#fff;font-weight:700;text-decoration:none;border:0;cursor:pointer;font-size:15px";
  function show(h){box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:17px">➜ A Jornada · '+(J&&J.mode==="inc"?"incidência no TEC":"cadernos do TEC")+'</b><button id="jxcX" style="background:none;border:0;color:#c2b6df;font-size:20px;cursor:pointer" aria-label="Fechar">×</button></div>'+h;var x=D.getElementById("jxcX");if(x)x.onclick=function(){STOP=1;box.remove()}}
  if(!J||!J.items||!J.items.length){show('<p style="margin:0">Não chegou a lista de aulas. Volte à plataforma e toque em <b>Abrir o TEC e criar os cadernos</b>; depois toque de novo no favorito ➜ A Jornada aqui.</p>');return}
  try{sessionStorage.setItem("jxcad",raw)}catch(e){}
  var STOP=0,O=J.o||"",N=Math.max(20,Math.min(30,J.n||25)),DONE={},RES=[],FAIL=[];
  try{(JSON.parse(sessionStorage.getItem("jxcad-res")||"[]")||[]).forEach(function(r){if(r&&r.k){DONE[r.k]=1;RES.push(r)}})}catch(e){}
  var SW={};"a o e de da do das dos em na no nas nos por para com sem sua seu suas seus um uma ao aos as os que se lei leis art arts artigo artigos sobre entre ou como pela pelo pelas pelos nocoes basicas basicos conceito conceitos geral gerais parte aula aulas cf cc cp cpc cpp".split(" ").forEach(function(w){SW[w]=1});
  function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")}
  function toks(s){var o={};norm(s).replace(/\([^)]*\)/g," ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).forEach(function(w){if(w.length>2&&!SW[w])o[w.length>6?w.slice(0,6):w]=1});return o}
  function dice(A,B){var a=Object.keys(A),b=Object.keys(B);if(!a.length||!b.length)return 0;var i=0;a.forEach(function(x){if(B[x])i++});return 2*i/(a.length+b.length)}
  function cands(t){var s=String(t||"").replace(/\([^)]*\)/g," ").split(/[:;,]|\s[–—-]\s/)[0].replace(/^\s*(no[cç][oõ]es( b[aá]sicas)? de|conceitos? de|teoria (da|do|de)|aspectos gerais d[aoe]s?|introdu[cç][aã]o (a|ao|à)|estudo d[aoe]s?)\s+/i,"").replace(/\s+/g," ").trim();
    var w=s.split(" ").filter(Boolean),cut=function(n){var a=w.slice(0,n);while(a.length>1&&SW[norm(a[a.length-1])])a.pop();return a.join(" ")};
    var lg=w.filter(function(x){return!SW[norm(x)]}).sort(function(a,b){return b.length-a.length})[0]||"";var out=[cut(3),cut(2),lg],u={};if(norm(lg).length>7)out.push(norm(lg).slice(0,6));var lei=String(t||"").match(/\b\d{1,2}\.\d{3}\b/);if(lei)out.unshift(lei[0]);return out.filter(function(x){x=x.trim();if(x.length<4||u[norm(x)])return false;u[norm(x)]=1;return true})}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function getJSON(u){return fetch(u,{credentials:"include"}).then(function(r){if(!r.ok)throw new Error("http "+r.status);return r.json()})}
  function form(F,extra){var p=new URLSearchParams();p.append("universo","");p.append("formato","OBJETIVA");Object.keys(extra||{}).forEach(function(k){p.append(k,extra[k])});F.forEach(function(f,i){p.append("filtros["+i+"].tipo",f[0]);p.append("filtros["+i+"].id",String(f[1]))});return p}
  function count(F){var p=form(F,{gerarEmSerie:"false",caderno:""});return fetch("/api/questoes/contagem/filtros",{method:"POST",body:p,credentials:"include",headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(function(r){return r.json()}).then(function(j){return+(j&&j.int)||0}).catch(function(){return 0})}
  function create(F,name,n){var p=new URLSearchParams();p.append("caderno","");p.append("universo","");p.append("formato","OBJETIVA");p.append("formaEscolherQuestoes","ALEATORIA");F.forEach(function(f,i){p.append("filtros["+i+"].tipo",f[0]);p.append("filtros["+i+"].id",String(f[1]))});p.append("nomeCaderno",name);p.append("pastaDestino","0");p.append("abrirEmModoCurso","false");p.append("totalQuestoes",String(n));
    return fetch("/questoes/filtrar",{method:"POST",body:p,credentials:"include",headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(function(r){return+((r.url.match(/cadernos\/(\d+)/)||[])[1]||0)})}
  var SC={};function search(term){var k=norm(term);if(SC[k])return SC[k];SC[k]=getJSON("/api/assuntos?formato=OBJETIVA&hierarquico=false&nome="+encodeURIComponent(k)+"&universo=").then(function(j){return(j&&j.assuntos)||[]}).catch(function(){return[]});return SC[k]}
  function prog(i,tot,cur){var pc=Math.round(i/tot*100);show('<p style="margin:0 0 8px">Criando na sua conta do TEC um caderno de '+N+' questões para cada aula do seu edital. Deixe esta aba aberta.</p><div style="height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden"><i style="display:block;height:100%;width:'+pc+'%;background:linear-gradient(90deg,#7b3cff,#ff5f8f)"></i></div><p style="margin:8px 0 0;font-size:13px;color:#c2b6df">'+i+' de '+tot+' aulas · '+RES.length+' cadernos prontos'+(FAIL.length?' · '+FAIL.length+' sem questões no TEC':'')+'</p><p style="margin:6px 0 0;font-size:13px">'+esc(cur||"")+'</p><button id="jxcS" style="'+BTN+';background:#2a2350">Parar</button>');var s=D.getElementById("jxcS");if(s)s.onclick=function(){STOP=1}}
  function finish(){var url=O+"/#jxestr="+encodeURIComponent(JSON.stringify({v:1,src:"teccad",cads:RES,fail:FAIL,n:N}));
    show('<p style="margin:0"><b>'+RES.length+' cadernos</b> prontos na sua conta do TEC'+(FAIL.length?' ('+FAIL.length+' aula'+(FAIL.length>1?'s':'')+' sem questões suficientes no TEC)':'')+'. Volte à plataforma para gravar cada caderno na tarefa de questões da aula.</p><a href="'+esc(url)+'" target="_blank" rel="noopener" style="'+BTN+'">Voltar para A Jornada</a>');
    try{sessionStorage.removeItem("jxcad");sessionStorage.removeItem("jxcad-res")}catch(e){}}
  (async function(){
    if(J.mode==="inc")show('<p style="margin:0">Lendo matérias e bancas do TEC…</p>');else prog(0,J.items.length,"Lendo matérias e bancas do TEC…");
    var M=[],B=[];try{M=(await getJSON("/api/materias?formato=OBJETIVA&nome=&universo=")).materias||[]}catch(e){}try{B=(await getJSON("/api/bancas?formato=OBJETIVA&nome=&universo=")).bancas||[]}catch(e){}
    if(!M.length){show('<p style="margin:0">Não consegui ler o TEC. Confira se você está logado no TEC Concursos e toque de novo no favorito ➜ A Jornada.</p>');return}
    var bn=norm(J.banca||"").replace(/[^a-z0-9 ]/g," ").trim(),banca=null;
    if(bn)B.forEach(function(b){var s=norm(b.sigla+" "+b.nome);if(!banca&&(norm(b.sigla)===bn||s.split(/[^a-z0-9]+/).indexOf(bn.split(" ")[0])>=0))banca=b});
    /* incidência: compara pelo radical de 5 letras e aceita o assunto do TEC cujo nome está todo dentro do assunto do edital */
    function t5(x){var o={};norm(x).replace(/\([^)]*\)/g," ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).forEach(function(w){if(w.length>2&&!SW[w])o[w.length>5?w.slice(0,5):w]=1});return o}
    function sc5(T,nome){var N=t5(nome),a=Object.keys(T),b=Object.keys(N);if(!a.length||!b.length)return 0;var i=0;b.forEach(function(x){if(T[x])i++});return Math.max(2*i/(a.length+b.length),.9*i/b.length)}
    function cand5(tp){var c=cands(tp),w=String(tp).replace(/\([^)]*\)/g," ").split(/[:;,]/)[0].split(/[\s\-\/]+/).filter(function(x){return x.length>=4&&!SW[norm(x)]});if(w.length<=3)w.forEach(function(x){if(c.indexOf(x)<0)c.push(x)});return c}
    async function incRun(){var OUT={},tot=J.items.length,nA=0;J.items.forEach(function(it){nA+=(it.t||[]).length});var dn=0,CG=null;
      /* provas anteriores do mesmo cargo no mesmo órgão (é o que o TEC mostra nas estatísticas do cargo) */
      if(J.orgao&&J.cargo){try{show('<p style="margin:0">Procurando as provas anteriores de '+esc(J.cargo)+' ('+esc(J.orgao)+') no TEC…</p>');
        var OR=(await getJSON("/api/orgaos?formato=OBJETIVA&nome=&universo=")).orgaos||[],os=norm(J.orgao).replace(/[^a-z0-9]/g,""),org=null;
        OR.forEach(function(o){if(!org&&norm(o.sigla).replace(/[^a-z0-9]/g,"")===os)org=o});
        if(org){var CL=[],walk=function(L){(L||[]).forEach(function(c){if(c.tipo!=="Area")CL.push(c);walk(c.subTree)})};walk((await getJSON("/api/cargos?universo=&formato=OBJETIVA&orgao="+org.id+"&hierarquico=true")).cargos);
          var TC=toks(J.cargo),bc=null,bv=0;CL.forEach(function(c){var v=dice(TC,toks(String(c.nome).replace(/\([^)]*\)/g," ")));if(v>bv){bv=v;bc=c}});
          if(bc&&bv>=.6){var ct=await count([["CARGO",bc.id]]);if(ct>=30)CG={id:bc.id,nome:bc.nome,tot:ct}}}}catch(e){}}
      function ip(cur){var pc=Math.round(dn/Math.max(1,nA)*100);show('<p style="margin:0 0 8px">Contando no TEC as questões '+(banca?'da <b>'+esc(banca.sigla||banca.nome)+'</b>':'das bancas')+' de cada matéria e assunto do seu edital. Nada é criado na sua conta. Deixe esta aba aberta.</p><div style="height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden"><i style="display:block;height:100%;width:'+pc+'%;background:linear-gradient(90deg,#7b3cff,#ff5f8f)"></i></div><p style="margin:8px 0 0;font-size:13px;color:#c2b6df">'+dn+' de '+nA+' assuntos</p><p style="margin:6px 0 0;font-size:13px">'+esc(cur||"")+'</p><button id="jxcS" style="'+BTN+';background:#2a2350">Parar e voltar com o que já contei</button>');var s=D.getElementById("jxcS");if(s)s.onclick=function(){STOP=1}}
      for(var i=0;i<tot;i++){if(STOP)break;var it=J.items[i];if(!it||!it.k)continue;ip(it.m);
        var mi=mats(it.m);if(!mi.length){dn+=(it.t||[]).length;OUT[it.k]={n:0,p:[]};continue}
        var MF=mi.map(function(x){return["MATERIA",x]}),nb=banca?await count(MF.concat([["BANCA",banca.id]])):0,g=0,n=nb,nc=CG?await count(MF.concat([["CARGO",CG.id]])):-1,f=CG?"c":"b";
        if(!banca||nb<40){n=await count(MF);g=1;if(!CG)f="g"}
        var useC=CG&&nc>=25;if(CG&&!useC)f=g?"g":"b";
        var p=[],tops=(it.t||[]).slice(0,40);
        for(var j=0;j<tops.length;j++){if(STOP)break;dn++;if(j%3===0)ip(it.m+" · "+tops[j]);var tp=tops[j],T=t5(tp),cs=cand5(tp),got=[];
          for(var c=0;c<cs.length;c++){var L=await search(cs[c]);L.forEach(function(r){if(!(r.materia&&mi.indexOf(r.materia.id)>=0))return;var v=sc5(T,r.nome);if(norm(r.nome).indexOf(norm(cs[c]))>=0)v+=/^\d/.test(cs[c])?.5:.15;if(v>=.62)got.push([r.id,v])});if(got.some(function(x){return x[1]>=.85}))break}
          got.sort(function(a,b){return b[1]-a[1]});var ids=[];got.forEach(function(x){if(ids.length<3&&ids.indexOf(x[0])<0&&(!ids.length||x[1]>=.75))ids.push(x[0])});
          if(!ids.length){p.push(-1);continue}
          var F=ids.map(function(x){return["ASSUNTO",x]});if(useC)F.push(["CARGO",CG.id]);else if(!g&&banca)F.push(["BANCA",banca.id]);p.push(await count(F));await sleep(40)}
        while(p.length<tops.length)p.push(-1);OUT[it.k]={n:n,nc:nc,p:p,g:g,f:f}}
      var nm=Object.keys(OUT).filter(function(k){return OUT[k].n>0}).length,url=O+"/#jxestr="+encodeURIComponent(JSON.stringify({v:1,src:"tecinc",b:banca?(banca.sigla||banca.nome):"",cg:CG?CG.nome:"",ct:CG?CG.tot:0,inc:OUT}));
      show('<p style="margin:0"><b>'+nm+' matérias</b> contadas no TEC'+(CG?' (provas anteriores de '+esc(CG.nome)+': '+CG.tot+' questões)':'')+(STOP?' (você parou antes do fim)':'')+'. Volte à plataforma para usar a incidência de cada matéria e assunto.</p><a href="'+esc(url)+'" target="_blank" rel="noopener" style="'+BTN+'">Voltar para A Jornada</a>');
      try{sessionStorage.removeItem("jxcad");sessionStorage.removeItem("jxcad-res")}catch(e){}}
    var MC={};function mats(m){var k=norm(m);if(MC[k])return MC[k];var parts=String(m).split(/\s+e\s+(?=[A-ZÁ-Ú])|\s*[\/;]\s*/),out=[];
      parts.forEach(function(p){var T=toks(p.replace(/^direito\s+/i,"Direito "));var best=null,bv=0;M.forEach(function(x){var v=dice(T,toks(x.nome));if(norm(x.nome).indexOf(norm(p))===0)v=Math.max(v,.9);if(v>bv){bv=v;best=x}});if(best&&bv>=.5&&out.indexOf(best.id)<0)out.push(best.id)});
      MC[k]=out;return out}
    if(J.mode==="inc"){await incRun();return}
    for(var i=0;i<J.items.length;i++){if(STOP)break;var it=J.items[i];if(!it||!it.k||DONE[it.k])continue;
      prog(i,J.items.length,it.m+" · "+it.t);
      try{var mi=mats(it.m),ids=[],names=[];
        var tops=(it.a||[]).slice(0,5);
        for(var j=0;j<tops.length;j++){var tp=tops[j],T=toks(tp),best=null,bv=0,cs=cands(tp);
          for(var c=0;c<cs.length;c++){var L=await search(cs[c]);L.forEach(function(r){if(mi.length&&!(r.materia&&mi.indexOf(r.materia.id)>=0))return;var v=dice(T,toks(r.nome));if(norm(r.nome).indexOf(norm(cs[c]))>=0)v+=.15;if(v>bv){bv=v;best=r}});if(bv>=.6)break}
          if(best&&bv>=.4&&ids.indexOf(best.id)<0){ids.push(best.id);names.push(best.nome)}}
        var F=ids.map(function(x){return["ASSUNTO",x]}),geral=0;
        if(!F.length&&mi.length){F=mi.map(function(x){return["MATERIA",x]});geral=1}
        if(!F.length){FAIL.push(it.k);continue}
        var nb=banca?await count(F.concat([["BANCA",banca.id]])):0,useB=nb>=20,n=useB?nb:await count(F);
        /* assunto com poucas questões no TEC: usa a matéria inteira para fechar a bateria */
        if(n<10&&!geral&&mi.length){F=mi.map(function(x){return["MATERIA",x]});geral=1;nb=banca?await count(F.concat([["BANCA",banca.id]])):0;useB=nb>=20;n=useB?nb:await count(F)}
        if(n<1){FAIL.push(it.k);continue}
        var q=Math.min(N,n),FF=useB?F.concat([["BANCA",banca.id]]):F;
        var nome=("A Jornada · "+it.m+" · "+it.t).replace(/\s+/g," ").slice(0,140);
        var cid=await create(FF,nome,q);
        if(cid){var r={k:it.k,id:cid,n:q,b:useB?banca.sigla:"",as:names.slice(0,4).join("; ").slice(0,300),g:geral};RES.push(r);try{sessionStorage.setItem("jxcad-res",JSON.stringify(RES))}catch(e){}}else FAIL.push(it.k);
      }catch(e){FAIL.push(it.k)}
      await sleep(250)}
    finish()})();
})();
