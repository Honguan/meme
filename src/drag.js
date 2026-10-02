import { isUnit, playError } from './game.js';

export function dropIntent(game, index, zone) {
  const side=game.active,card=game.cards[game.players[side].hand[index]];
  const error=playError(game,side,index);
  if(error)return {error};
  if(!zone)return {error:'已取消'};
  const own=Number(zone.side)===side;
  if(isUnit(card)) {
    if(!own||zone.kind!=='unit')return {error:'角色要放在自己的角色區'};
    const slot=Number(zone.slot);
    return {slot,error:playError(game,side,index,undefined,slot)};
  }
  if(card.type==='trap')return {error:own&&zone.kind==='trap'&&!zone.occupied?'':'陷阱要放在空的陷阱區'};
  if(card.type==='field')return {error:zone.kind==='field'?'':'場地卡要放在場地區'};
  if(zone.kind==='unit'&&zone.uid) {
    const valid=card.type==='equip'?own:card.effects.some(e=>e.trigger==='play'&&(['ally','allies','self'].includes(e.target)?own:!own));
    return {targetId:zone.uid,error:valid?'':'這張卡不能指定這個目標'};
  }
  if(card.type==='spell'&&own&&zone.kind==='cast')return {error:''};
  return {error:card.type==='equip'?'裝備要交給自己的角色':'這裡不能發動這張卡'};
}

// Pointer events share one path for mouse, pen and touch; horizontal touch scrolling stays native.
export function bindDrag(root, { canStart, start, over, drop, cancel }) {
  let pending,ghost,active=false,suppressClick=false,scrollFrame,point;
  const scroll=()=>{
    if(!active)return;
    const speed=point.y<48?-10:point.y>innerHeight-48?10:0;
    if(speed){window.scrollBy(0,speed);over(document.elementFromPoint(point.x,point.y)?.closest('[data-drop]'));}
    scrollFrame=requestAnimationFrame(scroll);
  };
  const cleanup=()=>{
    cancelAnimationFrame(scrollFrame);
    pending?.element.classList.remove('drag-source');ghost?.remove();ghost=null;active=false;
    if(pending?.element.hasPointerCapture(pending.id))pending.element.releasePointerCapture(pending.id);
    pending=null;document.body.classList.remove('card-dragging');
  };
  const abort=()=>{if(!pending)return;const wasActive=active;cleanup();if(wasActive)cancel();};
  root.addEventListener('pointerdown',e=>{
    const element=e.target.closest('[data-hand],[data-unit]');
    if(pending||e.button!==0||!element||!canStart(element))return;
    pending={element,id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch'};
  });
  root.addEventListener('pointermove',e=>{
    if(!pending||e.pointerId!==pending.id)return;
    point={x:e.clientX,y:e.clientY};
    const dx=e.clientX-pending.x,dy=e.clientY-pending.y;
    if(!active) {
      if(Math.hypot(dx,dy)<9)return;
      if(pending.touch&&Math.abs(dx)>Math.abs(dy)){cleanup();return;}
      active=true;pending.element.setPointerCapture(e.pointerId);start(pending.element);
      ghost=pending.element.cloneNode(true);ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.classList.add('drag-ghost');
      ghost.style.width=`${pending.element.getBoundingClientRect().width}px`;document.body.append(ghost);
      pending.element.classList.add('drag-source');document.body.classList.add('card-dragging');
      scrollFrame=requestAnimationFrame(scroll);
    }
    e.preventDefault();ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`;
    over(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]'));
  });
  root.addEventListener('pointerup',e=>{
    if(!pending||e.pointerId!==pending.id)return;
    if(!active){cleanup();return;}
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]');
    suppressClick=true;cleanup();drop(target);setTimeout(()=>{suppressClick=false;},0);
  });
  root.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
  root.addEventListener('pointercancel',e=>{if(e.pointerId===pending?.id)abort();});
  root.addEventListener('lostpointercapture',e=>{if(active&&e.pointerId===pending?.id&&e.target===pending.element)abort();});
  root.addEventListener('dragstart',e=>{if(e.target.closest('[data-hand],[data-unit]'))e.preventDefault();});
  window.addEventListener('blur',abort);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')abort();});
  return abort;
}
