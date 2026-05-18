import{V as e,j as k,y as v,u as P,x as c,t as u,n as f,h as b}from"./three-BK8GnUnT.js";import{r as C,B as E}from"./index-jPrBeSKw.js";import"./physics-DAiIzLkS.js";class L{constructor(t,s,i){this.scene=t,this.drill=s,this.profile=i,this.hintsEnabled=!1,this.hintMeshes=[],this.zoneMesh=null,this.labelEl=null,this.hintBtnEl=null,this.resetBtnEl=null,this._buildUI()}_buildUI(){const t=document.getElementById("ui-layer");t&&(this.labelEl=document.createElement("div"),this.labelEl.style.cssText=`
      position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
      padding: 8px 20px;
      background: rgba(12,14,17,0.7);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      color: #fff; font-size: 14px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      z-index: 15;
      white-space: nowrap;
    `,this.labelEl.textContent=`🎯 ${this.drill.name}`,t.appendChild(this.labelEl),this.hintBtnEl=document.createElement("button"),this.hintBtnEl.textContent="💡 提示: 关",this.hintBtnEl.style.cssText=`
      position: absolute; bottom: 38px; right: 60px;
      padding: 10px 18px;
      background: rgba(12,14,17,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      z-index: 15;
    `,this.hintBtnEl.onmouseenter=()=>{this.hintBtnEl.style.background="rgba(255,255,255,0.2)"},this.hintBtnEl.onmouseleave=()=>{this.hintBtnEl.style.background="rgba(12,14,17,0.6)"},this.hintBtnEl.onclick=()=>this.toggleHints(),t.appendChild(this.hintBtnEl),this.resetBtnEl=document.createElement("button"),this.resetBtnEl.textContent="↺ 重置球型",this.resetBtnEl.style.cssText=`
      position: absolute; bottom: 38px; left: 50%; transform: translateX(-50%);
      padding: 10px 18px;
      background: rgba(12,14,17,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      z-index: 15;
    `,this.resetBtnEl.onmouseenter=()=>{this.resetBtnEl.style.background="rgba(255,255,255,0.2)"},this.resetBtnEl.onmouseleave=()=>{this.resetBtnEl.style.background="rgba(12,14,17,0.6)"},t.appendChild(this.resetBtnEl))}setOnReset(t){this.resetBtnEl&&(this.resetBtnEl.onclick=null,this.resetBtnEl.onclick=t)}toggleHints(){this.hintsEnabled=!this.hintsEnabled,this.hintBtnEl.textContent=this.hintsEnabled?"💡 提示: 开":"💡 提示: 关",this.hintsEnabled?this._showHints():this._hideHints()}_showHints(){this._hideHints();const s=[new e(-this.profile.width/2,0,-this.profile.depth/2),new e(this.profile.width/2,0,-this.profile.depth/2),new e(-this.profile.width/2,0,0),new e(this.profile.width/2,0,0),new e(-this.profile.width/2,0,this.profile.depth/2),new e(this.profile.width/2,0,this.profile.depth/2)][this.drill.targetPocket];if(!s)return;const{positions:i}=C(this.drill,this.profile),g=Object.keys(this.drill.ballPositions).map(Number).find(y=>y!==0);if(g===void 0)return;const l=i[g];if(!l)return;const h=new e(l.x,E.radius,l.z),a=s.clone();a.y=E.radius;const d=new e().subVectors(a,h).normalize(),x=new k().setFromPoints([h,a]),m=new v({color:58998,dashSize:3,gapSize:2,linewidth:1}),p=new P(x,m);p.computeLineDistances(),this.scene.add(p),this.hintMeshes.push(p);const o=h.clone().addScaledVector(d,-2*E.radius),B=new c(2.5,3.5,32),w=new u({color:16766720,transparent:!0,opacity:.6,side:f}),r=new b(B,w);r.position.set(o.x,.1,o.z),r.rotation.x=-Math.PI/2,this.scene.add(r),this.hintMeshes.push(r);const M=new c(8,8.5,32,1,0,Math.PI),z=new u({color:16755456,transparent:!0,opacity:.4,side:f}),n=new b(M,z);n.position.set(o.x,.1,o.z),n.rotation.x=-Math.PI/2,n.rotation.z=Math.atan2(d.x,d.z),this.scene.add(n),this.hintMeshes.push(n)}_hideHints(){for(const t of this.hintMeshes)this.scene.remove(t),t.geometry&&t.geometry.dispose(),t.material&&t.material.dispose();this.hintMeshes=[]}showTargetZone(t){if(!t)return;this._hideTargetZone();const s=new c(t.radius*.95,t.radius,64),i=new u({color:58998,transparent:!0,opacity:.35,side:f});this.zoneMesh=new b(s,i),this.zoneMesh.position.set(t.x,.08,t.z),this.zoneMesh.rotation.x=-Math.PI/2,this.scene.add(this.zoneMesh)}_hideTargetZone(){this.zoneMesh&&(this.scene.remove(this.zoneMesh),this.zoneMesh.geometry&&this.zoneMesh.geometry.dispose(),this.zoneMesh.material&&this.zoneMesh.material.dispose(),this.zoneMesh=null)}updateLabel(t){this.labelEl&&(this.labelEl.textContent=t)}dispose(){this._hideHints(),this._hideTargetZone(),this.labelEl&&this.labelEl.parentNode&&this.labelEl.parentNode.removeChild(this.labelEl),this.hintBtnEl&&this.hintBtnEl.parentNode&&this.hintBtnEl.parentNode.removeChild(this.hintBtnEl),this.resetBtnEl&&this.resetBtnEl.parentNode&&this.resetBtnEl.parentNode.removeChild(this.resetBtnEl),this.labelEl=null,this.hintBtnEl=null,this.resetBtnEl=null}}export{L as TrainerHUD};
