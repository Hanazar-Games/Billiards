import{V as s,j as y,y as k,u as v,x as u,t as f,n as b,h as x}from"./three-CsPdlfT-.js";import{D as C,r as _,B as g}from"./index-D1LyawaN.js";import"./physics-DAiIzLkS.js";class I{constructor(t,e,i){this.scene=t,this.drill=e,this.profile=i,this.hintsEnabled=!1,this.hintMeshes=[],this.zoneMesh=null,this.labelEl=null,this.hintBtnEl=null,this.resetBtnEl=null,this._buildUI()}_buildUI(){const t=document.getElementById("ui-layer");if(!t)return;const e=C.getProgress(this.drill.id);if(this.labelEl=document.createElement("div"),this.labelEl.style.cssText=`
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
      display: flex; align-items: center; gap: 10px;
    `,this.titleSpan=document.createElement("span"),this.titleSpan.textContent=`🎯 ${this.drill.name}`,this.labelEl.appendChild(this.titleSpan),e&&e.stars>0){const i=document.createElement("span");i.style.cssText=`
        font-size: 11px; font-weight: 600; color: #ffd700;
        background: rgba(255,215,0,0.12);
        padding: 2px 8px; border-radius: 4px;
        border: 1px solid rgba(255,215,0,0.25);
      `;const n=e.bestPowerError;i.textContent=`最佳 ${e.stars}★`+(n!==null?` · 误差${n.toFixed(1)}`:""),this.labelEl.appendChild(i)}t.appendChild(this.labelEl),this.drill.hintPower&&(this.powerPill=document.createElement("div"),this.powerPill.style.cssText=`
        position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
        padding: 4px 12px;
        background: rgba(68,138,255,0.15);
        border: 1px solid rgba(68,138,255,0.35);
        border-radius: 20px;
        color: #448aff; font-size: 12px; font-weight: 700;
        pointer-events: none;
        z-index: 15;
        white-space: nowrap;
      `,this.powerPill.textContent=`💪 建议力度: ${this.drill.hintPower}%`,t.appendChild(this.powerPill)),this.hintBtnEl=document.createElement("button"),this.hintBtnEl.textContent="💡 提示: 关",this.hintBtnEl.style.cssText=`
      position: absolute; bottom: calc(var(--hud-bottom-safe) + 4px); right: 60px;
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
      position: absolute; bottom: calc(var(--hud-bottom-safe) + 4px); left: 50%; transform: translateX(-50%);
      padding: 10px 18px;
      background: rgba(12,14,17,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      z-index: 15;
    `,this.resetBtnEl.onmouseenter=()=>{this.resetBtnEl.style.background="rgba(255,255,255,0.2)"},this.resetBtnEl.onmouseleave=()=>{this.resetBtnEl.style.background="rgba(12,14,17,0.6)"},t.appendChild(this.resetBtnEl)}setOnReset(t){this.resetBtnEl&&(this.resetBtnEl.onclick=null,this.resetBtnEl.onclick=t)}toggleHints(){this.hintsEnabled=!this.hintsEnabled,this.hintBtnEl.textContent=this.hintsEnabled?"💡 提示: 开":"💡 提示: 关",this.hintsEnabled?this._showHints():this._hideHints()}_showHints(){this._hideHints();const e=[new s(-this.profile.width/2,0,-this.profile.depth/2),new s(this.profile.width/2,0,-this.profile.depth/2),new s(-this.profile.width/2,0,0),new s(this.profile.width/2,0,0),new s(-this.profile.width/2,0,this.profile.depth/2),new s(this.profile.width/2,0,this.profile.depth/2)][this.drill.targetPocket];if(!e)return;const{positions:i}=_(this.drill,this.profile),n=Object.keys(this.drill.ballPositions).map(Number).find(P=>P!==0);if(n===void 0)return;const h=i[n];if(!h)return;const a=new s(h.x,g.radius,h.z),d=e.clone();d.y=g.radius;const p=new s().subVectors(d,a).normalize(),E=new y().setFromPoints([a,d]),m=new k({color:58998,dashSize:3,gapSize:2,linewidth:1}),c=new v(E,m);c.computeLineDistances(),this.scene.add(c),this.hintMeshes.push(c);const r=a.clone().addScaledVector(p,-2*g.radius),w=new u(2.5,3.5,32),B=new f({color:16766720,transparent:!0,opacity:.6,side:b}),l=new x(w,B);l.position.set(r.x,.1,r.z),l.rotation.x=-Math.PI/2,this.scene.add(l),this.hintMeshes.push(l);const z=new u(8,8.5,32,1,0,Math.PI),M=new f({color:16755456,transparent:!0,opacity:.4,side:b}),o=new x(z,M);o.position.set(r.x,.1,r.z),o.rotation.x=-Math.PI/2,o.rotation.z=Math.atan2(p.x,p.z),this.scene.add(o),this.hintMeshes.push(o)}_hideHints(){for(const t of this.hintMeshes)this.scene.remove(t),t.geometry&&t.geometry.dispose(),t.material&&t.material.dispose();this.hintMeshes=[]}showTargetZone(t){if(!t)return;this._hideTargetZone();const e=new u(t.radius*.95,t.radius,64),i=new f({color:58998,transparent:!0,opacity:.35,side:b});this.zoneMesh=new x(e,i),this.zoneMesh.position.set(t.x,.08,t.z),this.zoneMesh.rotation.x=-Math.PI/2,this.scene.add(this.zoneMesh)}_hideTargetZone(){this.zoneMesh&&(this.scene.remove(this.zoneMesh),this.zoneMesh.geometry&&this.zoneMesh.geometry.dispose(),this.zoneMesh.material&&this.zoneMesh.material.dispose(),this.zoneMesh=null)}updateLabel(t){this.titleSpan&&(this.titleSpan.textContent=t)}dispose(){this._hideHints(),this._hideTargetZone(),this.labelEl&&this.labelEl.parentNode&&this.labelEl.parentNode.removeChild(this.labelEl),this.hintBtnEl&&this.hintBtnEl.parentNode&&this.hintBtnEl.parentNode.removeChild(this.hintBtnEl),this.resetBtnEl&&this.resetBtnEl.parentNode&&this.resetBtnEl.parentNode.removeChild(this.resetBtnEl),this.powerPill&&this.powerPill.parentNode&&this.powerPill.parentNode.removeChild(this.powerPill),this.labelEl=null,this.hintBtnEl=null,this.resetBtnEl=null,this.powerPill=null}}export{I as TrainerHUD};
