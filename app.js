(() => {
  "use strict";
  const C = window.KAFV_CONFIG;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = {
    data:null,itemName:"",activeSection:"price",location:null,deferredPrompt:null,
    recent:readStore("kafv_recent",[]),favorites:readStore("kafv_favorites",[])
  };
  const SECTION_LABELS={price:"가격정보",encyclopedia:"수산물사전",market:"시장",restaurant:"맛집",culture:"문화"};
  const FALLBACKS={market:"assets/fallback-market.svg",restaurant:"assets/fallback-food.svg",culture:"assets/fallback-culture.svg"};

  function readStore(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
  function writeStore(key,val){localStorage.setItem(key,JSON.stringify(val))}
  function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
  function fmtNum(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("ko-KR").format(n):"-"}
  function fmtPrice(v){return `${fmtNum(v)}원`}
  function fmtDistance(m){const n=Number(m);if(!Number.isFinite(n))return "";return n<1000?`${Math.round(n)}m`:`${(n/1000).toFixed(1)}km`}
  function secureImage(url,fallback){if(!url)return fallback;return String(url).replace(/^http:\/\/tong\.visitkorea\.or\.kr/i,"https://tong.visitkorea.or.kr")}
  function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
  function showView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$("#mainScroll").scrollTo({top:0,behavior:"smooth"})}
  function setBottom(nav){$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===nav))}

  async function callIntegrated(itemName){
    const args={item_name:itemName,radius_m:C.DEFAULT_RADIUS_M,place_limit:C.DEFAULT_PLACE_LIMIT,include_price:true,include_encyclopedia:true,include_places:true};
    if(state.location){args.longitude=state.location.longitude;args.latitude=state.location.latitude}
    const body={jsonrpc:"2.0",id:Date.now(),method:"tools/call",params:{name:"get_seafood_life_overview",arguments:args}};
    const r=await fetch(C.API_BASE+C.MCP_PATH,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const payload=await r.json();
    if(payload.error)throw new Error(payload.error.message||"MCP error");
    return payload.result?.structuredContent||null;
  }

  async function runSearch(section="price"){
    const itemName=$("#itemInput").value.trim();
    if(!itemName){toast("수산물명을 입력해 주세요.");return}
    state.itemName=itemName;state.activeSection=section;
    showView("resultView");setBottom("home");
    $("#resultTitle").textContent=`${itemName} 수산생활정보`;
    $("#sectionContent").innerHTML='<div class="loading"><div><div class="spinner"></div><b>검증된 데이터를 불러오는 중입니다.</b></div></div>';
    try{
      state.data=await callIntegrated(itemName);
      if(!state.data)throw new Error("structuredContent missing");
      addRecent(itemName);
      renderStatus();renderSection(section);
    }catch(e){
      $("#sectionContent").innerHTML=`<div class="state-card"><strong>통합조회 오류</strong><span>${esc(e.message)}</span></div>`;
      toast("데이터 조회에 실패했습니다.");
    }
  }

  function addRecent(itemName){
    const row={item:itemName,time:new Date().toISOString(),location:state.location};
    state.recent=[row,...state.recent.filter(x=>x.item!==itemName)].slice(0,20);writeStore("kafv_recent",state.recent);
  }
  function renderStatus(){
    const ms=state.data?.module_statuses||{};
    $("#statusStrip").innerHTML=Object.keys(SECTION_LABELS).map(k=>`<span class="status-chip ${esc(ms[k]||'unconfirmed')}">${SECTION_LABELS[k]} · ${statusText(ms[k])}</span>`).join("");
  }
  function statusText(s){return ({available:"자료 있음",empty:"0건",unconfirmed:"미확인",error:"API 오류"})[s]||"미확인"}
  function renderSection(section){
    state.activeSection=section;
    $$('#sectionTabs button').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
    const sec=state.data?.sections?.[section];
    if(!sec){$("#sectionContent").innerHTML=stateCard("정보 없음","해당 모듈의 응답이 없습니다.");return}
    if(sec.status!=="available"){
      let msg=sec.status==="empty"?"자동탐색 범위를 정상 확인했으나 실제 자료가 없습니다.":sec.status==="unconfirmed"?"현재 조건에서는 최종 확인하지 못했습니다.":"데이터 호출 중 오류가 발생했습니다.";
      if(sec?.error?.code==="LOCATION_REQUIRED")msg="시장·맛집·문화 조회에는 현재 위치가 필요합니다. 홈에서 ‘현재 위치 사용’을 누른 뒤 다시 조회해 주세요.";
      $("#sectionContent").innerHTML=stateCard(`${SECTION_LABELS[section]} · ${statusText(sec.status)}`,msg);return;
    }
    if(section==="price")renderPrice(sec);else if(section==="encyclopedia")renderEncyclopedia(sec);else renderPlaces(sec,section);
  }
  function stateCard(title,msg){return `<div class="state-card"><strong>${esc(title)}</strong><span>${esc(msg)}</span></div>`}

  function renderPrice(sec){
    const r=sec.result||{}, sums=r.endpoint_summaries||{}, latest=r.latest_dates||{};
    const recent=sums.recent||{}, rows=recent.sample_rows||[];
    const trend=(sums.trend?.sample_rows||[])[0];
    const metrics=`<div class="metric-grid"><div class="metric"><small>최신 가격 기준일</small><b>${esc(latest.recent||'-')}</b></div><div class="metric"><small>사용 가능한 가격 Endpoint</small><b>${fmtNum(r.available_count||0)}개</b></div></div>`;
    const prices=rows.length?rows.map(x=>`<div class="price-row"><div class="topline"><div><div class="condition">${esc(x.se_nm||'')} · ${esc(x.vrty_nm||'')} · ${esc(x.grd_nm||'')}</div><small>${esc(x.unit_sz||'')} ${esc(x.unit||'')}</small></div><div class="value">${fmtPrice(x.exmn_dd_prc)}</div></div></div>`).join(""):stateCard("가격정보","조건별 가격 표본이 없습니다.");
    const trendHtml=trend?`<div class="price-row"><div class="topline"><div><div class="condition">추세 · ${esc(trend.se_nm)} / ${esc(trend.vrty_nm)} / ${esc(trend.unit_sz)}${esc(trend.unit)}</div><small>4주 전 → 현재</small></div><div class="value">${fmtPrice(trend.exmn_dd_avg_prc)}</div></div>${sparkline([trend.ww4_bfr_avg_prc,trend.ww3_bfr_avg_prc,trend.ww2_bfr_avg_prc,trend.ww1_bfr_avg_prc,trend.exmn_dd_avg_prc])}</div>`:"";
    $("#sectionContent").innerHTML=metrics+`<div class="section-hero"><div class="body"><h3>조건별 현재가격</h3><p>서로 다른 단위·규격·유통단계는 하나의 대표가격으로 합치지 않습니다.</p></div></div>`+prices+trendHtml;
  }
  function sparkline(vals){const nums=vals.map(Number).filter(Number.isFinite);if(nums.length<2)return"";const min=Math.min(...nums),max=Math.max(...nums),span=max-min||1;const pts=nums.map((v,i)=>`${8+i*(284/(nums.length-1))},${56-44*((v-min)/span)}`).join(" ");return `<svg class="spark" viewBox="0 0 300 68" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#1677cc" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="58" x2="292" y2="58" stroke="#dce7ee"/></svg>`}

  function renderEncyclopedia(sec){
    const item=sec.result||{}, sections=item.sections||{}, img=`assets/seafood/${esc(item.ui?.image_key||'unknown')}.webp`;
    const cards=Object.values(sections).map(s=>`<div class="ency-card"><b>${esc(s.source_label)}</b><p>${esc(s.text)}</p></div>`).join("");
    $("#sectionContent").innerHTML=`<div class="section-hero"><img src="${img}" onerror="this.onerror=null;this.src='assets/fallback-seafood.svg'" alt="${esc(item.display_name)}"><div class="body"><h3>${esc(item.display_name||state.itemName)}</h3><p>실사형 대표이미지는 image_key 기준으로 순차 연결합니다.</p></div></div><div class="ency-grid">${cards}</div><div class="notice">${esc(sec.health_information_notice||'건강 관련 내용은 일반 영양·식생활 정보입니다.')}</div>`;
  }

  function renderPlaces(sec,type){
    const items=sec.items||[];
    if(!items.length){$("#sectionContent").innerHTML=stateCard(SECTION_LABELS[type],"표시할 장소가 없습니다.");return}
    $("#sectionContent").innerHTML=`<div class="section-hero"><div class="body"><h3>${SECTION_LABELS[type]}</h3><p>${esc(sec.message||'')}</p></div></div><div class="card-list">${items.map(x=>placeCard(x,type)).join("")}</div>`;
    $$('#sectionContent [data-fav]').forEach(btn=>btn.addEventListener('click',()=>toggleFavorite(btn.dataset.fav,type,items.find(x=>x.content_id===btn.dataset.fav))));
  }
  function placeCard(x,type){
    const image=secureImage(x.image||x.image_original,FALLBACKS[type]); const fav=isFavorite(x.content_id);
    const mapUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.latitude},${x.longitude}`)}`;
    return `<article class="info-card"><img src="${esc(image)}" onerror="this.onerror=null;this.src='${FALLBACKS[type]}'" alt="${esc(x.title)}"><div class="card-body"><span class="distance">${fmtDistance(x.distance_m)}</span><h4>${esc(x.title)}</h4><p>${esc(x.address||'주소 정보 없음')}</p>${x.telephone?`<p>☎ ${esc(x.telephone)}</p>`:""}<div class="card-actions"><a class="mini-btn" href="${mapUrl}" target="_blank" rel="noopener">위치 보기</a><button class="mini-btn heart ${fav?'active':''}" data-fav="${esc(x.content_id)}">${fav?'♥ 저장됨':'♡ 저장'}</button></div></div></article>`;
  }
  function isFavorite(id){return state.favorites.some(x=>x.id===id)}
  function toggleFavorite(id,type,item){
    if(!item)return;const i=state.favorites.findIndex(x=>x.id===id);
    if(i>=0){state.favorites.splice(i,1);toast("즐겨찾기에서 삭제했습니다.")}else{state.favorites.unshift({id,type,title:item.title,address:item.address,image:item.image||item.image_original,latitude:item.latitude,longitude:item.longitude});toast("즐겨찾기에 저장했습니다.")}
    writeStore("kafv_favorites",state.favorites);renderSection(type);
  }

  function renderRecent(){const box=$("#recentList");box.innerHTML=state.recent.length?state.recent.map(x=>`<button class="utility-card" data-recent="${esc(x.item)}" style="width:100%;text-align:left;border:1px solid var(--line)"><b>${esc(x.item)}</b><small>${new Date(x.time).toLocaleString('ko-KR')}</small></button>`).join(""):stateCard("최근기록 없음","통합조회한 수산물이 여기에 표시됩니다.");$$('[data-recent]').forEach(b=>b.onclick=()=>{$('#itemInput').value=b.dataset.recent;showView('homeView');setBottom('home');runSearch('price')})}
  function renderFavorites(){const box=$("#favoriteList");box.innerHTML=state.favorites.length?state.favorites.map(x=>`<div class="utility-card"><b>${esc(x.title)}</b><small>${esc(x.address||'')}</small></div>`).join(""):stateCard("즐겨찾기 없음","시장·맛집·문화 카드에서 저장할 수 있습니다.")}

  function useLocation(){
    if(!navigator.geolocation){toast("이 브라우저는 위치 기능을 지원하지 않습니다.");return}
    const btn=$("#locationBtn");btn.disabled=true;btn.textContent="위치 확인 중…";
    navigator.geolocation.getCurrentPosition(pos=>{
      state.location={longitude:pos.coords.longitude,latitude:pos.coords.latitude,accuracy:pos.coords.accuracy};
      $("#locationText").textContent=`현재 위치 연결됨 · 정확도 약 ${Math.round(pos.coords.accuracy)}m`;
      btn.disabled=false;btn.textContent="✓ 현재 위치 사용 중";toast("현재 위치를 연결했습니다.");
    },err=>{btn.disabled=false;btn.textContent="◎ 현재 위치 사용";toast(err.message||"위치 권한을 확인해 주세요.")},{enableHighAccuracy:true,timeout:10000,maximumAge:300000});
  }

  $("#searchBtn").onclick=()=>runSearch("price");$("#itemInput").addEventListener("keydown",e=>{if(e.key==="Enter")runSearch("price")});$("#locationBtn").onclick=useLocation;$("#backHomeBtn").onclick=()=>{showView("homeView");setBottom("home")};
  $$('#hubGrid [data-section]').forEach(b=>b.onclick=()=>runSearch(b.dataset.section));
  $$('#sectionTabs [data-section]').forEach(b=>b.onclick=()=>renderSection(b.dataset.section));
  $$('.bottom-nav [data-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.nav;setBottom(nav);if(nav==="home")showView("homeView");if(nav==="recent"){renderRecent();showView("recentView")}if(nav==="favorite"){renderFavorites();showView("favoriteView")}if(nav==="my")showView("myView")});
  $("#appVersion").textContent=`UI ${C.APP_VERSION} · MCP integrated orchestrator v0.1.0`;

  let touchX=null;$("#sectionContent").addEventListener("touchstart",e=>touchX=e.touches[0].clientX,{passive:true});$("#sectionContent").addEventListener("touchend",e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(dx)<70||!state.data)return;const order=["price","encyclopedia","market","restaurant","culture"];let i=order.indexOf(state.activeSection);i=dx<0?Math.min(order.length-1,i+1):Math.max(0,i-1);renderSection(order[i])},{passive:true});

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredPrompt=e;$("#installBtn").hidden=false});$("#installBtn").onclick=async()=>{if(!state.deferredPrompt)return;state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;$("#installBtn").hidden=true};
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();
