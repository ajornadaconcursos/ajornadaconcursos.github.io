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
  function show(h){box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:17px">➜ A Jornada · '+(J&&J.mode==="inc"?"incidência no TEC":J&&J.mode==="guia"?"guia do seu concurso":"cadernos do TEC")+'</b><button id="jxcX" style="background:none;border:0;color:#c2b6df;font-size:20px;cursor:pointer" aria-label="Fechar">×</button></div>'+h+'<p id="jxWait" style="margin:6px 0 0;font-size:13px;color:#ffcf6b"></p>';var x=D.getElementById("jxcX");if(x)x.onclick=function(){STOP=1;box.remove()}}
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
  /* o TEC limita a quantidade de pedidos (erro 429): espera e tenta de novo, sem acelerar */
  async function tf(u,o){var w=[4000,12000,30000,60000];for(var k=0;;k++){var r=await fetch(u,o);if(r.status!==429||k>=w.length)return r;var b=D.getElementById("jxWait");if(b)b.textContent="O TEC pediu uma pausa, continuando em "+Math.round(w[k]/1000)+" s…";await sleep(w[k]);if(b)b.textContent=""}}
  function getJSON(u){return tf(u,{credentials:"include"}).then(function(r){if(!r.ok)throw new Error("http "+r.status);return r.json()})}
  function form(F,extra){var p=new URLSearchParams();p.append("universo","");p.append("formato","OBJETIVA");Object.keys(extra||{}).forEach(function(k){p.append(k,extra[k])});F.forEach(function(f,i){p.append("filtros["+i+"].tipo",f[0]);p.append("filtros["+i+"].id",String(f[1]))});return p}
  function count(F){var p=form(F,{gerarEmSerie:"false",caderno:""});return sleep(150).then(function(){return tf("/api/questoes/contagem/filtros",{method:"POST",body:p,credentials:"include",headers:{"Content-Type":"application/x-www-form-urlencoded"}})}).then(function(r){return r.json()}).then(function(j){return+(j&&j.int)||0}).catch(function(){return 0})}
  function create(F,name,n){var p=new URLSearchParams();p.append("caderno","");p.append("universo","");p.append("formato","OBJETIVA");p.append("formaEscolherQuestoes","ALEATORIA");F.forEach(function(f,i){p.append("filtros["+i+"].tipo",f[0]);p.append("filtros["+i+"].id",String(f[1]))});p.append("nomeCaderno",name);p.append("pastaDestino","0");p.append("abrirEmModoCurso","false");p.append("totalQuestoes",String(n));
    return fetch("/questoes/filtrar",{method:"POST",body:p,credentials:"include",headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(function(r){return+((r.url.match(/cadernos\/(\d+)/)||[])[1]||0)})}
  var SC={};function search(term){var k=norm(term);if(SC[k])return SC[k];SC[k]=getJSON("/api/assuntos?formato=OBJETIVA&hierarquico=false&nome="+encodeURIComponent(k)+"&universo=").then(function(j){return(j&&j.assuntos)||[]}).catch(function(){return[]});return SC[k]}
  function prog(i,tot,cur){var pc=Math.round(i/tot*100);show('<p style="margin:0 0 8px">Criando na sua conta do TEC um caderno de '+N+' questões para cada aula do seu edital. Deixe esta aba aberta.</p><div style="height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden"><i style="display:block;height:100%;width:'+pc+'%;background:linear-gradient(90deg,#7b3cff,#ff5f8f)"></i></div><p style="margin:8px 0 0;font-size:13px;color:#c2b6df">'+i+' de '+tot+' aulas · '+RES.length+' cadernos prontos'+(FAIL.length?' · '+FAIL.length+' sem questões no TEC':'')+'</p><p style="margin:6px 0 0;font-size:13px">'+esc(cur||"")+'</p><button id="jxcS" style="'+BTN+';background:#2a2350">Parar</button>');var s=D.getElementById("jxcS");if(s)s.onclick=function(){STOP=1}}
  function finish(){var url=O+"/#jxestr="+encodeURIComponent(JSON.stringify({v:1,src:"teccad",cads:RES,fail:FAIL,n:N}));
    show('<p style="margin:0"><b>'+RES.length+' cadernos</b> prontos na sua conta do TEC'+(FAIL.length?' ('+FAIL.length+' aula'+(FAIL.length>1?'s':'')+' sem questões suficientes no TEC)':'')+'. Volte à plataforma para gravar cada caderno na tarefa de questões da aula.</p><a href="'+esc(url)+'" target="_blank" rel="noopener" style="'+BTN+'">Voltar para A Jornada</a>');
    try{sessionStorage.removeItem("jxcad");sessionStorage.removeItem("jxcad-res")}catch(e){}}
  (async function(){
    if(J.mode==="inc"||J.mode==="guia")show('<p style="margin:0">Lendo matérias e bancas do TEC…</p>');else prog(0,J.items.length,"Lendo matérias e bancas do TEC…");
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
    /* ---------- GUIA DO CONCURSO: acha o guia do TEC do concurso escolhido, lê as matérias e o índice de assuntos
       (só nomes e quantidades) e cria na conta do aluno um caderno por matéria e um por assunto que mais cai ---------- */
    function frame(url,test,ms){return new Promise(function(res){var f=D.createElement("iframe");f.style.cssText="position:fixed;width:1100px;height:900px;left:-4000px;top:0;opacity:0;pointer-events:none";f.src=url;D.body.appendChild(f);var t0=Date.now();
      (function poll(){var d=null;try{d=f.contentDocument}catch(e){}var r=null;try{r=d&&d.body&&test(d)}catch(e){}if(r){setTimeout(function(){f.remove()},50);res(r)}else if(Date.now()-t0>(ms||25000)){f.remove();res(null)}else setTimeout(poll,600)})()})}
    function indice(html){var d=new DOMParser().parseFromString(html,"text/html"),root=d.querySelector(".caderno-guia-arvore-indice>ul"),out=[];if(!root)return out;
      (function walk(ul,dep,par){var last=null;[].forEach.call(ul.children,function(ch){if(ch.tagName==="LI"){var sp=ch.querySelector("span"),cq=ch.querySelector(".capitulo-questoes");var n={n:(sp?sp.textContent:"").replace(/\s+/g," ").trim(),q:+(((cq?cq.textContent:"").match(/\d+/)||[0])[0]),d:dep,p:par};if(n.n){out.push(n);last=n}}else if(ch.tagName==="UL")walk(ch,dep+1,last)})})(root,0,null);return out}
    async function guiaRun(){var NA=Math.max(3,Math.min(12,J.na||8)),G=null,tag=String(J.org||J.busca||"").trim();
      function gs(h){show('<p style="margin:0">'+h+'</p><p style="margin:8px 0 0;font-size:13px;color:#c2b6df">Deixe esta aba aberta.</p>')}
      var tries=[J.busca,J.cargo].filter(Boolean),L=[];
      for(var t=0;t<tries.length&&!L.length;t++){gs('Procurando no TEC o guia de <b>'+esc(tries[t])+'</b>…');
        L=await frame("/guias/agrupamento/edital?busca="+encodeURIComponent(tries[t]),function(d){var A=[].map.call(d.querySelectorAll("a[href]"),function(a){return{u:a.href,t:a.textContent.replace(/\s+/g," ").trim()}}).filter(function(x){return/\/guias\/[^\/]+\/[^\/]+\/[^\/]+\/-\/?$/.test(x.u)&&x.t});return A.length?A:(/Foram encontrados 0|Nenhum guia/i.test(d.body.innerText)?[]:null)})||[]}
      var TC=toks((J.cargo||"")+" "+(J.area||"")),bv=0;L.forEach(function(x){var y=+((x.t.match(/\/(20\d\d)/)||[0,0])[1]),v=dice(TC,toks(x.t.replace(/\([^)]*\)/g," ")))+(y?(y-2000)/1000:0);if(v>bv){bv=v;G=x}});
      if(!G||bv<.42){var u0=O+"/#jxestr="+encodeURIComponent(JSON.stringify({v:1,src:"tecguia",none:1,found:L.length}));
        show('<p style="margin:0">O TEC ainda não tem um guia para <b>'+esc(J.cargo||J.busca)+'</b>. Sem problema: volte à plataforma e ela cria os seus cadernos pelas matérias e assuntos do edital.</p><a href="'+esc(u0)+'" target="_blank" rel="noopener" style="'+BTN+'">Voltar para A Jornada</a>');return}
      gs('Abrindo o guia <b>'+esc(G.t)+'</b>…');
      var MT=await frame(G.u,function(d){var A=[].filter.call(d.querySelectorAll("a[href]"),function(a){return/\/-\/[^\/]+\/id\/?$/.test(a.href)});if(!A.length)return null;return A.map(function(a){var b=a.parentElement;for(var k=0;k<7&&b&&!/ - 20\d\d/.test(b.innerText||"");k++)b=b.parentElement;var tx=(b&&b.innerText)||"",l1=(tx.split("\n").map(function(x){return x.trim()}).filter(Boolean)[0]||"");
        var n=l1.replace(/\s*-\s*[A-Z0-9][A-Za-z0-9\-\/ ]*-\s*20\d\d.*$/,"").replace(/\s+\d+$/,"").trim();if(!n||/ver detalhes/i.test(n))n=a.textContent.replace(/\s+/g," ").trim();var q=+((tx.match(/(\d[\d.]*)\s*Quest/)||[0,"0"])[1].replace(/\./g,""));return{u:a.href,n:n,q:q}})},30000)||[];
      var byU={};MT.forEach(function(x){var ok=x.n&&!/^ver detalhes$/i.test(x.n),o=byU[x.u];if(!o)byU[x.u]=Object.assign({},x,{n:ok?x.n:""});else{if(!o.n&&ok)o.n=x.n;if(!o.q&&x.q)o.q=x.q}});
      MT=Object.keys(byU).map(function(u){var x=byU[u];if(!x.n){var sl=(u.match(/\/-\/([^\/]+)\/id/)||[0,""])[1].replace(/-[a-z0-9]+-20\d\d$/,"").replace(/-/g," ");x.n=sl.charAt(0).toUpperCase()+sl.slice(1)}return x}).filter(function(x){return x.n&&!/in[eé]ditas/i.test(x.n+" "+x.u)});
      if(!MT.length){show('<p style="margin:0">Não consegui ler as matérias do guia. Toque de novo no favorito ➜ A Jornada.</p>');return}
      var OUT=[],tot=0,dn=0;
      for(var i=0;i<MT.length;i++){if(STOP)break;var m=MT[i];gs('Lendo os assuntos de <b>'+esc(m.n)+'</b> ('+(i+1)+' de '+MT.length+')…');
        try{var h=await (await tf(m.u,{credentials:"include"})).text();m.idx=indice(h)}catch(e){m.idx=[]}
        var tops=m.idx.filter(function(x){return x.d===0}),lv=m.idx.filter(function(x){return x.d===1});if(!lv.length)lv=tops;
        m.mi=[];tops.forEach(function(x){mats(x.n).forEach(function(id){if(m.mi.indexOf(id)<0)m.mi.push(id)})});if(!m.mi.length)m.mi=mats(m.n);
        m.sel=lv.filter(function(x){return x.q>=8}).sort(function(a,b){return b.q-a.q}).slice(0,NA);tot+=1+m.sel.length;await sleep(300)}
      function cp(cur){var pc=Math.round(dn/Math.max(1,tot)*100);show('<p style="margin:0 0 8px">Guia <b>'+esc(G.t)+'</b>. Criando na sua conta do TEC um caderno por matéria e um por assunto que mais cai'+(banca?', da <b>'+esc(banca.sigla||banca.nome)+'</b> quando houver questões suficientes':'')+'.</p><div style="height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden"><i style="display:block;height:100%;width:'+pc+'%;background:linear-gradient(90deg,#7b3cff,#ff5f8f)"></i></div><p style="margin:8px 0 0;font-size:13px;color:#c2b6df">'+dn+' de '+tot+' cadernos · '+esc(cur||"")+'</p><p id="jxWait" style="margin:6px 0 0;font-size:13px;color:#ffcf6b"></p><button id="jxStop" style="'+BTN+';background:#2a2150">Parar e voltar com o que já foi feito</button>');var s=D.getElementById("jxStop");if(s)s.onclick=function(){STOP=1}}
      async function mk(F,min,max,name){var nb=banca?await count(F.concat([["BANCA",banca.id]])):0,useB=nb>=min,n=useB?nb:await count(F),q=Math.min(max,n);if(q<5)return null;if(J.dry)return{cad:0,qq:q,b:useB?(banca.sigla||""):""};var id=await create(useB?F.concat([["BANCA",banca.id]]):F,name.replace(/\s+/g," ").slice(0,140),q);return id?{cad:id,qq:q,b:useB?(banca.sigla||""):""}:null}
      for(var i=0;i<MT.length;i++){if(STOP)break;var m=MT[i],R={n:m.n,q:m.q,as:[]};
        cp(m.n);if(m.mi.length){try{var c=await mk(m.mi.map(function(x){return["MATERIA",x]}),40,60,"A Jornada · "+tag+" · "+m.n);if(c){R.cad=c.cad;R.cq=c.qq;R.b=c.b}}catch(e){}}dn++;
        for(var k=0;k<m.sel.length;k++){if(STOP)break;var a=m.sel[k];cp(m.n+" › "+a.n);
          try{var cs=await search(a.n),T=toks(a.n),best=null,bs=0;cs.forEach(function(r){var v=norm(r.nome)===norm(a.n)?1:dice(T,toks(r.nome));if(m.mi.length&&r.materia&&m.mi.indexOf(r.materia.id)>=0)v+=.2;if(v>bs){bs=v;best=r}});
            if(best&&bs>=.8){var c2=await mk([["ASSUNTO",best.id]],15,30,"A Jornada · "+tag+" · "+m.n+" · "+a.n);R.as.push({n:a.n,q:a.q,cad:c2?c2.cad:0,qq:c2?c2.qq:0,b:c2?c2.b:""})}else R.as.push({n:a.n,q:a.q,cad:0})}catch(e){R.as.push({n:a.n,q:a.q,cad:0})}
          dn++;await sleep(250)}
        OUT.push(R);try{sessionStorage.setItem("jxguia-res",JSON.stringify(OUT))}catch(e){}}
      var nc=0;OUT.forEach(function(r){if(r.cad)nc++;r.as.forEach(function(a){if(a.cad)nc++})});
      var url=O+"/#jxestr="+encodeURIComponent(JSON.stringify({v:1,src:"tecguia",g:{t:G.t,u:G.u},b:banca?(banca.sigla||banca.nome):"",mats:OUT}));
      show('<p style="margin:0">Guia <b>'+esc(G.t)+'</b>: <b>'+OUT.length+' matérias</b> lidas e <b>'+nc+' cadernos</b> criados na sua conta do TEC'+(STOP?' (você parou antes do fim)':'')+'. Volte à plataforma para ligar cada caderno à matéria e aos assuntos do seu edital.</p><a href="'+esc(url)+'" target="_blank" rel="noopener" style="'+BTN+'">Voltar para A Jornada</a>');
      try{sessionStorage.removeItem("jxcad");sessionStorage.removeItem("jxguia-res")}catch(e){}}
  /* ===== assunto do TEC para cada tópico da aula =====
     1) "família": assuntos do TEC da mesma matéria cujo nome traz o termo central do tópico (ex.: "Nacionalidade" → Espécies de Nacionalidade, Perda da Nacionalidade, Extradição… (da Nacionalidade));
        termo central = palavra longa e específica (≥ 8 letras) ou par de palavras vizinhas (ex.: "direitos fundamentais", "controle … constitucionalidade");
     2) sem família: o assunto mais parecido, com régua de 70% (semelhança com o tópico + palavras do nome presentes no contexto da aula) */
  var GEN={};"constitucional constitucionais constituicao fundamentais fundamental direitos principios organizacao administracao administrativo publica publico normas norma geral gerais conceito conceitos teoria disposicoes estado estados federal poder poderes questoes mescladas aspectos introducao nocoes legislacao processo procedimento juridica juridico sistema sistemas regime".split(" ").forEach(function(w){GEN[w]=1});
  function words(s){return norm(s).replace(/\([^)]*\)/g," ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(function(w){return w.length>2&&!SW[w]})}
  function hasAll(nome,ws){var n=" "+norm(nome).replace(/[^a-z0-9 ]/g," ")+" ";return ws.every(function(w){return n.indexOf(" "+w.slice(0,Math.min(w.length,6)))>=0})}
  async function famPick(tp,it,mi,search){var out=[],seen={},cov={};
    var segs=String(tp).replace(/\([^)]*\)/g," ").split(/[.,;:–—]|\s-\s|\s+e\s+(?=[A-ZÁ-Ú])/).map(words).filter(function(x){return x.length});
    async function fam(ws){var q=ws.length===1?ws[0]:ws[ws.length-1],L=await search(q);
      return L.filter(function(r){var inM=r.materia&&mi.indexOf(r.materia.id)>=0;if(mi.length&&!inM)return false;var n=norm(r.nome);return ws.length===1?(" "+n.replace(/[^a-z0-9 ]/g," ")+" ").indexOf(" "+ws[0])>=0:hasAll(r.nome,ws)})}
    function add(F,ws){if(!F.length||F.length>10)return false;F.forEach(function(r){if(!seen[r.id]){seen[r.id]=1;out.push(r)}});ws.forEach(function(w){cov[w]=1});return true}
    /* pares de palavras vizinhas dentro do mesmo trecho (não atravessa vírgula ou ponto) */
    for(var s=0;s<segs.length;s++){var W=segs[s];for(var i=0;i+1<W.length;i++){if(GEN[W[i]]&&GEN[W[i+1]])continue;add(await fam([W[i],W[i+1]]),[W[i],W[i+1]])}}
    /* palavra longa e específica, ou o trecho de uma palavra só (ex.: "União", "Nacionalidade"), se ainda não coberta por um par */
    for(var s2=0;s2<segs.length;s2++){var W2=segs[s2];for(var j=0;j<W2.length;j++){var w=W2[j];if(cov[w]||GEN[w])continue;if(w.length>=8||(W2.length===1&&w.length>=5))add(await fam([w]),[w])}}
    if(out.length)return out.slice(0,10);
    var CTX=toks([it.t||""].concat(it.a||[],it.kw||[]).join(" "));function cover(nome){var N=toks(nome),k=Object.keys(N);if(!k.length)return 0;var i=0;k.forEach(function(x){if(CTX[x])i++});return i/k.length}
    var T=toks(tp),best=null,bv=0,cs=cands(tp);
    for(var c=0;c<cs.length;c++){var L2=await search(cs[c]);L2.forEach(function(r){var inM=r.materia&&mi.indexOf(r.materia.id)>=0;if(mi.length&&!inM)return;var nk=Object.keys(toks(r.nome)).length,ex=norm(r.nome)===norm(tp)||norm(r.nome)===norm(cs[c]);
        var v=ex?1:Math.min(dice(T,toks(r.nome))*.55+cover(r.nome)*.45+(norm(r.nome).indexOf(norm(cs[c]))>=0?.1:0),.99);if(!ex&&nk<=1)v=Math.min(v,.5);if(!mi.length&&v<.9)return;if(v>bv){bv=v;best=r}});if(bv>=.95)break}
    return best&&bv>=.7?[best]:[]}
    if(J.mode==="guia"){await guiaRun();return}
    if(J.mode==="inc"){await incRun();return}
    for(var i=0;i<J.items.length;i++){if(STOP)break;var it=J.items[i];if(!it||!it.k||DONE[it.k])continue;
      prog(i,J.items.length,it.m+" · "+it.t);
      try{var mi=mats(it.m),ids=[],names=[],pick=[];
        var tops=(it.a||[]).slice(0,5);
        for(var j=0;j<tops.length;j++){var got=await famPick(tops[j],it,mi,search);got.forEach(function(r){if(ids.indexOf(r.id)<0&&ids.length<10){ids.push(r.id);names.push(r.nome);pick.push(r)}})}
        /* dois ou mais assuntos irmãos (mesmo assunto-pai no TEC): usa o pai, que cobre a aula inteira sem puxar outro ramo */
        var PID=function(r){return r.idPai||r.paiId||r.idAssuntoPai||(r.pai&&r.pai.id)||(r.assuntoPai&&r.assuntoPai.id)||0},grp={};
        pick.forEach(function(r){var p=PID(r);if(p)(grp[p]=grp[p]||[]).push(r)});
        Object.keys(grp).forEach(function(p){var g=grp[p];if(g.length<2)return;var par=g[0].pai||g[0].assuntoPai||null,pn=par&&par.nome?par.nome:"";if(!pn)return;
          ids=ids.filter(function(x){return!g.some(function(r){return r.id===x})});names=names.filter(function(x){return!g.some(function(r){return r.nome===x})});ids.unshift(+p);names.unshift(pn)});
        /* nunca troca o assunto pela matéria inteira: sem assunto encontrado, a aula fica de fora e a plataforma avisa */
        var F=ids.map(function(x){return["ASSUNTO",x]}),geral=0,whole=/\|\*$/.test(it.k);
        /* o caderno da "matéria inteira" é o único que usa a matéria toda */
        if(whole&&mi.length){F=mi.map(function(x){return["MATERIA",x]})}
        if(!F.length){FAIL.push(it.k);continue}
        var nb=banca?await count(F.concat([["BANCA",banca.id]])):0,useB=nb>=15,n=useB?nb:await count(F);
        /* poucas questões da banca nesse assunto: completa com o MESMO assunto em outras bancas (nunca com outra matéria) */
        if(n<1){FAIL.push(it.k);continue}
        var q=Math.min(Math.min(+it.n||N,100),n),FF=useB?F.concat([["BANCA",banca.id]]):F;
        var nome=(whole?"A Jornada · "+it.m+" · Matéria inteira":"A Jornada · "+it.m+" › "+names.slice(0,3).join(" / ")).replace(/\s+/g," ").slice(0,140);
        var cid=await create(FF,nome,q);
        if(cid){var r={k:it.k,id:cid,n:q,b:useB?banca.sigla:"",as:names.slice(0,4).join("; ").slice(0,300),g:geral};RES.push(r);try{sessionStorage.setItem("jxcad-res",JSON.stringify(RES))}catch(e){}}else FAIL.push(it.k);
      }catch(e){FAIL.push(it.k)}
      await sleep(250)}
    finish()})();
})();
