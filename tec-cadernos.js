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
  /* conferência: cada aula com os assuntos do TEC que entraram no caderno */
  function report(){var T={};(J.items||[]).forEach(function(i){T[i.k]=i.t||i.k});return'<details style="margin-top:10px"><summary style="cursor:pointer">Conferir aula por aula</summary><ol style="margin:6px 0 0;padding-left:18px;font-size:13px;max-height:220px;overflow:auto">'+RES.map(function(r){return'<li><b>'+esc(T[r.k]||r.k)+'</b><br>→ '+esc(r.as||"")+'</li>'}).join("")+FAIL.map(function(k){return'<li><b>'+esc(T[k]||k)+'</b><br>→ sem assunto certo no TEC (não criei caderno)</li>'}).join("")+'</ol></details>'}
  function finish(){var url=O+"/#jxestr="+encodeURIComponent(JSON.stringify({v:1,src:"teccad",cads:RES,fail:FAIL,n:N}));
    show('<p style="margin:0"><b>'+RES.length+' cadernos</b> prontos na sua conta do TEC'+(FAIL.length?' ('+FAIL.length+' aula'+(FAIL.length>1?'s':'')+' sem questões suficientes no TEC)':'')+'. Volte à plataforma para gravar cada caderno na tarefa de questões da aula.</p><a href="'+esc(url)+'" target="_blank" rel="noopener" style="'+BTN+'">Voltar para A Jornada</a>'+report());
    try{sessionStorage.removeItem("jxcad");sessionStorage.removeItem("jxcad-res")}catch(e){}}
  (async function(){
    if(J.mode==="inc"||J.mode==="guia"||J.mode==="lpmap")show('<p style="margin:0">Lendo matérias e bancas do TEC…</p>');else prog(0,J.items.length,"Lendo matérias e bancas do TEC…");
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
  var MOD={};"verbal verbais nominal nominais simples composta compostas composto compostos ativa passiva ativo passivo especial especiais geral comum comuns".split(" ").forEach(function(w){MOD[w]=1});
  function words(s){return norm(s).replace(/\([^)]*\)/g," ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(function(w){return w.length>2&&!SW[w]})}
  /* singular de cada palavra: "verbos" acha "Verbo", "vozes" acha "Vozes"/"Voz", "verbais" acha "Verbal" (antes o plural fazia a aula ficar sem caderno) */
  function sing(w){w=String(w||"");if(w.length<5)return w;return w.replace(/zes$/,"z").replace(/[oa]es$/,"ao").replace(/([rs])es$/,"$1").replace(/([aeo])is$/,"$1l").replace(/s$/,"")}
  function sws(s){return norm(s).replace(/\([^)]*\)/g," ").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(Boolean).map(sing)}
  function hasAll(nome,ws){var N=sws(nome);return ws.every(function(w){var k=sing(w).slice(0,Math.min(sing(w).length,6));return N.some(function(x){return x.indexOf(k)===0})})}
  /* ===== Língua Portuguesa: dicionário fixo aula → assuntos do TEC =====
     Português tem os mesmos assuntos em todo concurso. Em vez de adivinhar pelo texto, cada palavra-chave da aula aponta para
     o nome do assunto no TEC (nomes do Índice do próprio TEC). "*" = começo de palavra (interjei* acha Interjeição/Interjeições).
     need = palavra que também tem de estar no nome do assunto. */
  var LPD=[
    [/\bsubstantiv/,["substantivo"]],[/\badjetiv/,["adjetivo"]],[/\badverbi/,["adverbio"]],[/\bartigos?\b/,["artigo"]],[/\bnumera(l|is)\b/,["numeral"]],[/\binterj/,["interjei*"]],
    [/\bpreposi/,["preposi*"]],[/\bconjunc|\bconjunco/,["conjun*"]],[/\bpronomes?\b/,["pronome"]],[/colocacao (pronominal|dos pronomes)|\bproclise|\bmesoclise|\benclise/,["colocacao pronominal"]],
    [/\bverbos?\b|tempos? (e modos )?verba|modos? verba|flexao verbal|emprego dos tempos/,["verbo"]],[/\bvoz(es)?\b|voz passiva/,["vozes","voz passiva"]],[/\bcorrelac/,["correlacao"]],
    [/\bpontuac|\bvirgula/,["pontuacao"]],[/\bconcordanc/,["concordancia"]],[/\bregenc/,["regencia"]],[/\bcrase/,["crase"]],
    [/\bcoes(ao|iva)/,["coesao"]],[/\bcoerenc/,["coerencia"]],[/\bsinonim|\bantonim/,["sinonim*","antonim*"]],[/\bhomonim|\bparonim/,["homonim*","paronim*"]],
    [/significac/,["significacao"]],[/\bsemantic/,["semantica"]],[/figuras? de linguagem|linguagem figurada/,["figuras de linguagem"]],[/\bdenotac|\bconotac/,["denota*","conota*"]],[/\bpolissem/,["polissem*"]],
    [/\binterpreta|\bcompreens/,["interpretacao","compreensao"]],[/\btipologia|tipos? (de texto|textuais)/,["tipologia"]],[/\bgeneros? (textua|do discurso|de texto)/,["generos",{q:"genero",need:"text"}]],
    [/\bortograf/,["ortografia"]],[/\bacentuac/,["acentuacao"]],[/\bhifen/,["hifen"]],[/\bporques?\b/,["porque"]],
    [/(formacao|estrutura) (das|de) palavras/,[{q:"formacao",need:"palavra"},{q:"estrutura",need:"palavra"}]],
    [/\bsujeito/,["sujeito"]],[/\bpredicad|\bpredicativ/,["predica*"]],[/termos? (da|das) orac|termos (essenciais|integrantes|acessorios)/,["termos"]],[/\baposto|\bvocativo/,["aposto","vocativo"]],[/\badjuntos?\b/,["adjunto"]],[/\bobjetos? (direto|indireto)/,["objeto"]],[/complemento nominal/,["complemento nominal"]],
    [/\bcoordenac|\bcoordenad/,["coordena*"]],[/\bsubordinac|\bsubordinad/,["subordina*"]],[/periodo composto/,["periodo composto"]],
    [/variac(ao|oes) linguistic|niveis de linguagem|variantes? linguistic/,["variacao linguistica","niveis de linguagem"]],[/redacao oficial|correspondencia oficial|manual de redacao/,["redacao oficial"]],
    [/\bparalelismo/,["paralelismo"]],[/\breescrit|\breescritur/,["reescrit*"]],[/discurso (direto|indireto)/,["discurso"]],[/funcoes da linguagem/,["funcoes da linguagem"]],[/\bfonolog|\bfonetic/,["fonologia","fonetica"]]];
  /* lê primeiro o título da aula (o mais preciso); só se ele não tiver palavra-chave usa os tópicos do edital ligados à aula */
  /* ===== conferência pelo título (todas as matérias): um assunto do TEC só entra no caderno se tiver palavra própria em comum com o título da aula
     (ou com os nomes do Índice do guia, no Oficial de Justiça). Palavras genéricas (lei, direito, artigos, noções…) não contam; "8.112" vira "8112". ===== */
  var TGW={};"classes classe palavras palavra nocoes nocao aspectos gerais geral parte partes arts art artigos artigo lei leis direito direitos teoria conceito conceitos introducao disposicoes normas norma estudo estudos revisao exercicios questoes aula aulas modulo topicos resumo parte especial principios principio regras regra tipos especies".split(" ").forEach(function(w){TGW[w]=1});
  function tsig(x){return(String(x).match(/\b[A-Z]{2,5}\b/g)||[]).map(function(w){return w.toLowerCase()}).filter(function(w){return!/^(art|arts|cf|cc|cp|cpc|cpp|lei)$/.test(w)}).concat(tsig0(x))}
  function tsig0(x){return norm(x).replace(/(\d)\.(\d{3})/g,"$1$2").replace(/[^a-z0-9 ]/g," ").split(/\s+/).map(sing).filter(function(w){return w&&(/^\d{3,}$/.test(w)||(w.length>3&&!SW[w]&&!TGW[w]))}).map(function(w){return /^\d/.test(w)?w:w.slice(0,6)})}
  function titleOk(nome,it){var A=tsig(String(nome)),B=tsig([it.t||""].concat(it.a||[]).join(" "));if(!A.length||!B.length)return false;
    return A.some(function(w){return B.some(function(v){return w===v||(w.length>=5&&v.length>=5&&(w.indexOf(v)===0||v.indexOf(w)===0))})})}
/* Português: números fixos dos assuntos do TEC (Língua Portuguesa = matéria 3), conferidos no TEC em 23/11/2026.
     Cada palavra-chave do TÍTULO da aula aponta para o número do assunto: sem busca, sem adivinhação. */
  var LPID=[
   [/\bsubstantiv/,[5640]],[/\badjetiv/,[5649]],[/\badverbi/,[5651]],[/\bartigos?\b/,[5647]],[/\bnumera(l|is)\b/,[5648]],[/\binterj/,[5653]],
   [/\bpreposi/,[5650]],[/\bconjunc|\bconjunco/,[5652]],[/pronomes? relativ/,[9507,6237]],[/\bpronomes?\b(?! relativ)/,[5654]],[/colocacao (pronominal|dos pronomes)|\bproclise|\bmesoclise|\benclise/,[330]],
   [/\bverbos?\b|tempos? (e modos )?verba|modos? verba|flexao verbal|emprego dos tempos|conjugac/,[5641]],[/locuc(ao|oes) verba/,[5669]],[/\bvoz(es)?\b|voz passiva/,[306]],[/\bcorrelac/,[5668]],
   [/\bpontuac|\bvirgula/,[294]],[/\bconcordanc/,[335]],[/\bregenc/,[332]],[/\bcrase/,[333]],
   [/\bcoes(ao|iva)|\bcoerenc|\bconectores|\banafora|\bcatafora|referenciac/,[344]],[/\bsinonim|\bantonim/,[342]],[/\bhomonim|\bparonim/,[341]],[/\bdenotac|\bconotac/,[339]],[/\bpolissem/,[1499]],
   [/significac/,[3844]],[/\bsemantic/,[338]],[/figuras? de linguagem|linguagem figurada/,[346]],[/vicios? de linguagem|\bpleonasm|\bambiguidade/,[347]],[/funcoes da linguagem|elementos da comunicacao/,[4635]],
   [/\binterpreta|\bcompreens/,[348]],[/\btipologia|tipos? (de texto|textuais)|\bgeneros? (textua|do discurso|de texto)/,[3818]],[/ordenac(ao|ão) de paragrafos|\bparagrafos/,[5637]],
   [/\bortograf/,[5629]],[/\bacentuac/,[5628]],[/\bhifen/,[5630]],[/\bporques?\b|\baonde\b/,[5635]],[/maiuscula/,[5639]],[/\bfonetic|\bfonolog|\bfonema|separacao silabica|\bsilab/,[288]],
   [/(formacao|estrutura) (das|de) palavras/,[295]],
   [/\bsujeito/,[8205]],[/\bpredicad|\bpredicativ/,[8206]],[/termos essenciais/,[8204]],[/termos integrantes|\btransitividade|\bobjetos? (direto|indireto)|complemento nominal/,[8207]],[/termos acessorios|\badjuntos?\b|\baposto|\bvocativo/,[8208]],
   [/termos? (da|das) orac/,[6230]],[/frase,? oracao|oracao e periodo/,[6229]],
   [/\bcoordenac|\bcoordenad/,[6232]],[/subordinadas? substantiva/,[6233]],[/subordinadas? adjetiva/,[6234]],[/subordinadas? adverbia/,[6235]],[/oracoes reduzidas|\breduzidas/,[6236]],
   [/variac(ao|oes) linguistic|niveis de linguagem|variantes? linguistic|variac(ao|oes) da linguagem/,[4501]],[/linguagem formal|\binformal\b|norma culta/,[3594]],[/discurso (direto|indireto)|tipos de discurso/,[3779]],
   [/particula se\b|\bfuncoes do se\b|\bpronome se\b/,[5655]],[/(vocabulo|palavra|funcoes do) que\b/,[5656]],[/(vocabulo|palavra) como\b/,[5657]],
   [/\bparalelismo/,[349]],[/\breescrit|\breescritur|substituicao de palavras/,[5631]],[/\bclareza/,[351]]];
  /* título que só diz o assunto-mãe */
  var LPIDG=[[/subordina/,[6233,6234,6235]],[/classes? de palavras/,[303]],[/\bmorfologia/,[296]],[/\bsintaxe/,[317]],[/\blinguagem\b/,[3593]],[/\btextos?\b|\bleitura/,[348]]];
  var LPIDN={5640:"Substantivo",5649:"Adjetivo",5651:"Advérbio",5647:"Artigo",5648:"Numeral",5653:"Interjeição",5650:"Preposição",5652:"Conjunção",9507:"Pronomes Relativos",6237:"Funções Sintáticas dos Pronomes Relativos",5654:"Pronomes",330:"Colocação Pronominal",5641:"Verbo",5669:"Locução Verbal",306:"Vozes (Voz Passiva e Voz Ativa)",5668:"Correlação Verbal",294:"Pontuação",335:"Concordância (Verbal e Nominal)",332:"Regência Nominal e Verbal",333:"Crase",344:"Coerência. Coesão",342:"Sinônimos e Antônimos",341:"Homônimos e Parônimos",339:"Denotação e Conotação",1499:"Polissemia",3844:"Significação de Vocábulo e Expressões",338:"Semântica",346:"Figuras de Linguagem",347:"Vícios de Linguagem",4635:"Elementos da Comunicação e Funções da Linguagem",348:"Interpretação de Textos (Compreensão)",3818:"Tipologia e Gênero Textual",5637:"Ordenação de Parágrafos",5629:"Ortografia",5628:"Acentuação",5630:"Uso do Hífen",5635:"Fatos da Língua (Porquês, Onde/Aonde, Há/A)",5639:"Inicial Maiúscula",288:"Fonética. Separação Silábica",295:"Formação e Estrutura das Palavras",8205:"Sujeito",8206:"Predicado",8204:"Termos Essenciais da Oração",8207:"Transitividade Verbal e Termos Integrantes",8208:"Termos Acessórios. Vocativo",6230:"Funções Sintáticas",6229:"Frase, Oração e Período",6232:"Orações Coordenadas",6233:"Orações Subordinadas Substantivas",6234:"Orações Subordinadas Adjetivas",6235:"Orações Subordinadas Adverbiais",6236:"Orações Reduzidas",4501:"Variações da Linguagem",3594:"Linguagem Formal e Informal",3779:"Tipos de Discurso",5655:"Partícula \"Se\"",5656:"Vocábulo \"Que\"",5657:"Vocábulo \"Como\"",349:"Paralelismo",5631:"Reescrita de Frases",351:"Clareza e Correção",303:"Classes de Palavras",296:"Morfologia",317:"Sintaxe",3593:"Linguagem"};
  function lpIds(title){var tx=" "+norm(title||"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ")+" ",out=[];LPID.forEach(function(d){if(d[0].test(tx))d[1].forEach(function(i){if(out.indexOf(i)<0)out.push(i)})});
    if(!out.length)LPIDG.some(function(d){if(d[0].test(tx)){out=d[1].slice();return true}return false});return out.slice(0,10)}
  /* título genérico (sem assunto específico): usa o assunto-mãe do TEC */
  var LPG=[[/classes? de palavras|\bmorfologia/,["classes de palavras","morfologia"]],[/\bsintaxe/,["sintaxe"]],[/\bortografia|\bortoepia/,["ortografia"]],[/\btextos?\b|\bleitura/,["interpretacao"]]];
  async function lpPick(it,mi){var fx=function(x){return" "+norm(x).replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ")+" "},txt=fx(it.t||""),out=[],seen={};
    /* só o título da aula: os tópicos do edital ligados à aula costumam listar outros assuntos (ex.: "classes de palavras… vozes verbais") e puxavam assunto errado */
    var DL=LPD.filter(function(d){return d[0].test(txt)});if(!DL.length)DL=LPG.filter(function(d){return d[0].test(txt)}).slice(0,1);
    for(var d=0;d<DL.length;d++){var T=DL[d][1];
      for(var t=0;t<T.length;t++){var o=typeof T[t]==="string"?{q:T[t]}:T[t],st=/\*$/.test(o.q),q=o.q.replace(/\*$/,""),qw=q.split(" ").map(sing),L=await search(st?q:sing(q)),hit=[];
        L.forEach(function(r){if(mi.length&&!(r.materia&&mi.indexOf(r.materia.id)>=0))return;var N=sws(r.nome);if(o.need&&!N.some(function(x){return x.indexOf(o.need)===0}))return;
          var ok=qw.every(function(w){return N.some(function(x){return st?x.indexOf(w)===0:x===w})});if(!ok)return;hit.push({r:r,s:(N[0]&&(st?N[0].indexOf(qw[0])===0:N[0]===qw[0])?0:1),l:N.length})});
        hit.sort(function(a,b){return a.s-b.s||a.l-b.l});hit.slice(0,3).forEach(function(h){if(!seen[h.r.id]&&out.length<10){seen[h.r.id]=1;out.push(h.r)}})}}
    return out}
  async function famPick(tp,it,mi,search){var out=[],seen={},cov={};
    /* nome só genérico (ex.: "Classes de palavras"): não vira caderno, senão puxa todas as classes para uma aula de um assunto só */
    if(!words(tp).some(function(w){return !/^(classes?|palavras?|morfologia|nocoes|gerais|parte|aula|revisao)$/.test(w)}))return [];
    var segs=String(tp).replace(/\([^)]*\)/g," ").split(/[.,;:–—]|\s-\s|\s+e\s+(?=[A-ZÁ-Ú])/).map(words).filter(function(x){return x.length});
    async function fam(ws){var q=sing(ws.length===1?ws[0]:ws[ws.length-1]),L=await search(q);
      return L.filter(function(r){var inM=r.materia&&mi.indexOf(r.materia.id)>=0;if(mi.length&&!inM)return false;if(ws.length>1)return hasAll(r.nome,ws);var k=sing(ws[0]);return sws(String(r.nome).replace(/[()]/g," ")).some(function(x){return x.indexOf(k)===0})})}
    function add(F,ws){if(!F.length||F.length>10)return false;F.forEach(function(r){if(!seen[r.id]){seen[r.id]=1;out.push(r)}});ws.forEach(function(w){cov[w]=1});return true}
    /* pares de palavras vizinhas dentro do mesmo trecho (não atravessa vírgula ou ponto) */
    for(var s=0;s<segs.length;s++){var W=segs[s];for(var i=0;i+1<W.length;i++){if((GEN[W[i]]||MOD[W[i]])&&(GEN[W[i+1]]||MOD[W[i+1]]))continue;add(await fam([W[i],W[i+1]]),[W[i],W[i+1]])}}
    /* palavra longa e específica, ou o trecho de uma palavra só (ex.: "União", "Nacionalidade"), se ainda não coberta por um par */
    for(var s2=0;s2<segs.length;s2++){var W2=segs[s2];for(var j=0;j<W2.length;j++){var w=W2[j];if(cov[w]||GEN[w]||MOD[w])continue;if(w.length>=8||(segs.length===1&&W2.length===1&&w.length>=3))add(await fam([w]),[w])}}
    if(out.length)return out.slice(0,10);
    var CTX=toks([it.t||""].concat(it.a||[],it.kw||[]).join(" "));function cover(nome){var N=toks(nome),k=Object.keys(N);if(!k.length)return 0;var i=0;k.forEach(function(x){if(CTX[x])i++});return i/k.length}
    var T=toks(tp),best=null,bv=0,cs=cands(tp);
    for(var c=0;c<cs.length;c++){var L2=await search(cs[c]);L2.forEach(function(r){var inM=r.materia&&mi.indexOf(r.materia.id)>=0;if(mi.length&&!inM)return;var nk=Object.keys(toks(r.nome)).length,ex=norm(r.nome)===norm(tp)||norm(r.nome)===norm(cs[c]);
        var v=ex?1:Math.min(dice(T,toks(r.nome))*.55+cover(r.nome)*.45+(norm(r.nome).indexOf(norm(cs[c]))>=0?.1:0),.99);if(!ex&&nk<=1)v=Math.min(v,.5);if(!mi.length&&v<.9)return;if(v>bv){bv=v;best=r}});if(bv>=.95)break}
    return best&&bv>=.7?[best]:[]}
    /* diagnóstico (suporte): lista TODOS os assuntos de Língua Portuguesa do TEC, com número e assunto-pai, para fixar o assunto certo de cada aula. Não cria nada. */
    if(J.mode==="lpmap"){var lpM=M.filter(function(x){return/portugu/.test(norm(x.nome))}).map(function(x){return x.id}),ALL={},raw0="",qs="a e i o u ca co de en es ia ra re ta to ver pro con nom".split(" ");
      for(var qi=0;qi<qs.length;qi++){show('<p style="margin:0">Lendo os assuntos de Português no TEC… ('+(qi+1)+' de '+qs.length+')</p>');var LL=await search(qs[qi]);
        LL.forEach(function(r){if(!(r.materia&&lpM.indexOf(r.materia.id)>=0))return;if(!raw0)raw0=JSON.stringify(r).slice(0,400);if(!ALL[r.id])ALL[r.id]=r});await sleep(200)}
      var PIDf=function(r){return r.idPai||r.paiId||r.idAssuntoPai||(r.pai&&r.pai.id)||(r.assuntoPai&&r.assuntoPai.id)||""};
      var out="TEC-LP v1 · materias "+lpM.join(",")+" · "+Object.keys(ALL).length+" assuntos\nexemplo: "+raw0+"\n"+Object.keys(ALL).map(function(k){var r=ALL[k];return r.id+"|"+String(r.nome).replace(/\s+/g," ")+"|"+PIDf(r)}).sort(function(a,b){return a.split("|")[1]<b.split("|")[1]?-1:1}).join("\n");
      show('<p style="margin:0 0 8px"><b>'+Object.keys(ALL).length+' assuntos de Português</b> lidos no TEC. Toque em <b>Copiar</b> e cole na conversa com o suporte da A Jornada.</p><textarea id="jxLp" readonly style="width:100%;height:220px;background:#0b0820;color:#f1ecff;border:1px solid #a06bff;border-radius:10px;font:12px/1.4 monospace">'+esc(out)+'</textarea><button id="jxLpC" style="'+BTN+'">Copiar</button>');
      var cb=D.getElementById("jxLpC");if(cb)cb.onclick=function(){var t=D.getElementById("jxLp");t.select();try{navigator.clipboard.writeText(out)}catch(e){}try{D.execCommand("copy")}catch(e){}cb.textContent="Copiado ✓"};try{sessionStorage.removeItem("jxcad")}catch(e){}return}
    if(J.mode==="guia"){await guiaRun();return}
    if(J.mode==="inc"){await incRun();return}
    for(var i=0;i<J.items.length;i++){if(STOP)break;var it=J.items[i];if(!it||!it.k||DONE[it.k])continue;
      prog(i,J.items.length,it.m+" · "+it.t);
      try{var mi=mats(it.m),ids=[],names=[],pick=[];
        var tops=(it.a||[]).slice(0,5),isLP=/portugu/.test(norm(it.m))&&!/\|\*$/.test(it.k),lpd=0;
        /* Português: primeiro o dicionário fixo (assunto certo sempre); só se ele não achar nada usa a busca por semelhança */
        if(isLP){lpIds(it.t).forEach(function(x){ids.push(x);names.push(LPIDN[x]||String(x))});lpd=1;tops=[]}
        for(var j=0;j<tops.length;j++){var got=await famPick(tops[j],it,mi,search);got.forEach(function(r){if(ids.indexOf(r.id)<0&&ids.length<10){ids.push(r.id);names.push(r.nome);pick.push(r)}})}
        /* nada na matéria da aula: o TEC às vezes guarda o assunto em matéria vizinha (Juros Simples em Matemática Financeira, LINDB em Legislação Civil,
           Simples Nacional em Legislação Tributária); aceita só nome igual ao tópico ou que traz o tópico inteiro */
        if(!ids.length&&!lpd&&!/\|\*$/.test(it.k)){for(var j2=0;j2<tops.length&&ids.length<3;j2++){var ph=norm(String(tops[j2]).replace(/\([^)]*\)/g," ")).replace(/[^a-z0-9 ]/g," ").replace(/^\s*(d[aoe]s?|lei n[oº]?\s*[\d.\/]+\s*)\s+/," ").replace(/\s+/g," ").trim();
            if(ph.length<6||(ph.split(" ").length<2&&ph.length<8))continue;var L3=await search(ph),ex=null,ct=null;
            L3.forEach(function(r){var nn=norm(String(r.nome).replace(/\([^)]*\)/g," ")).replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();if(nn===ph){ex=ex||r}else if((" "+nn+" ").indexOf(" "+ph+" ")>=0&&(!ct||nn.length<norm(ct.nome).length))ct=r});
            var rr=ex||ct;if(rr&&ids.indexOf(rr.id)<0){ids.push(rr.id);names.push(rr.nome);pick.push(rr)}}}
        /* dois ou mais assuntos irmãos (mesmo assunto-pai no TEC): usa o pai, que cobre a aula inteira sem puxar outro ramo */
        var PID=function(r){return r.idPai||r.paiId||r.idAssuntoPai||(r.pai&&r.pai.id)||(r.assuntoPai&&r.assuntoPai.id)||0},grp={};
        /* com o dicionário de Português não troca pelo pai: "Substantivo, Adjetivo…" viraria "Classes de Palavras" inteira (com verbo, pronome…) */
        if(!lpd)pick.forEach(function(r){var p=PID(r);if(p)(grp[p]=grp[p]||[]).push(r)});
        Object.keys(grp).forEach(function(p){var g=grp[p];if(g.length<2)return;var par=g[0].pai||g[0].assuntoPai||null,pn=par&&par.nome?par.nome:"";if(!pn)return;
          ids=ids.filter(function(x){return!g.some(function(r){return r.id===x})});names=names.filter(function(x){return!g.some(function(r){return r.nome===x})});ids.unshift(+p);names.unshift(pn)});
        /* nunca troca o assunto pela matéria inteira: sem assunto encontrado, a aula fica de fora e a plataforma avisa */
        /* fora de Português, confere cada assunto escolhido contra o título da aula; o que não bate sai do caderno */
        if(!lpd&&!/\|\*$/.test(it.k)){var kI=[],kN=[];ids.forEach(function(x,i){if(titleOk(names[i]||"",it)){kI.push(x);kN.push(names[i])}});ids=kI;names=kN}
        var F=ids.map(function(x){return["ASSUNTO",x]}),geral=0,whole=/\|\*$/.test(it.k);
        /* o caderno da "matéria inteira" é o único que usa a matéria toda */
        if(whole&&mi.length){F=mi.map(function(x){return["MATERIA",x]})}
        if(!F.length){FAIL.push(it.k);continue}
        /* sempre a banca do concurso do aluno: basta ter 5 questões dela no assunto; só sem isso usa as outras bancas (e a plataforma avisa) */
        /* banca do concurso sempre primeiro, até esgotar: qualquer questão dela no assunto já vale; outras bancas só quando ela não tem nenhuma
           ou quando o aluno pede "completar com outras bancas" (it.ob) depois de esgotar as da banca */
        var nb=banca&&!it.ob?await count(F.concat([["BANCA",banca.id]])):0,useB=nb>=1,n=useB?nb:await count(F);var ob=banca&&!useB&&!it.ob?1:0,poucas=useB&&nb<Math.min(+it.n||N,100)?nb:0;
        /* poucas questões da banca nesse assunto: completa com o MESMO assunto em outras bancas (nunca com outra matéria) */
        if(n<1){FAIL.push(it.k);continue}
        var q=Math.min(Math.min(+it.n||N,100),n),FF=useB?F.concat([["BANCA",banca.id]]):F;
        var nome=((whole?"A Jornada · "+it.m+" · Matéria inteira":"A Jornada · "+it.m+" › "+names.slice(0,3).join(" / "))+(useB?" · "+(banca.sigla||banca.nome):it.ob?" · outras bancas":"")).replace(/\s+/g," ").slice(0,140);
        var cid=await create(FF,nome,q);
        if(cid){var r={v:5,k:it.k,t:String(it.t||"").slice(0,90),ids:lpd?ids.slice(0,10):[],id:cid,n:q,ob:ob,pb:poucas,xb:it.ob?1:0,b:useB?banca.sigla:"",as:names.slice(0,8).join("; ").slice(0,300),g:geral};RES.push(r);try{sessionStorage.setItem("jxcad-res",JSON.stringify(RES))}catch(e){}}else FAIL.push(it.k);
      }catch(e){FAIL.push(it.k)}
      await sleep(250)}
    finish()})();
})();
