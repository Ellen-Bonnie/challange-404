(() => {
'use strict';
const $ = id => document.getElementById(id);
let client, user, duo, me, members=[], todayTasks=[], challengeDefinitions=[], channel, signingUp=false, myGroups=[];
let historyExpanded=false, historyRows=[], historyDuoId=null;

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = message => {const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500);};
const show = id => ['auth-panel','room-panel','dashboard'].forEach(p=>$(p).classList.toggle('hidden',p!==id));
const day = () => {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=t=>parts.find(p=>p.type===t)?.value;
 return value('year')+'-'+value('month')+'-'+value('day');
};
const label = d => new Date(d+'T12:00:00').toLocaleDateString('uk-UA',{day:'numeric',month:'long'});
function mode(signup){signingUp=signup;$('show-login').classList.toggle('active',!signup);$('show-signup').classList.toggle('active',signup);$('name-field').classList.toggle('hidden',!signup);$('display-name').required=signup;$('auth-submit').textContent=signup?'Зареєструватися ✨':'Увійти ✨';}
function config(){const preset=window.DAILY_DUO_CONFIG;return preset?.url && (preset.key?.startsWith('sb_publishable_') || preset.key?.startsWith('eyJ')) ? preset : null;}
function initClient(){const c=config();if(!c)return false;if(!window.supabase?.createClient)throw new Error('Supabase SDK не завантажився');client=window.supabase.createClient(c.url,c.key);return true;}
async function boot(){
 try{
   if(!initClient()){show('auth-panel');toast('Конфігурація Supabase відсутня. Перевір config.js.');return;}
   // Subscribe before reading the session so PASSWORD_RECOVERY is not missed
   // while the Supabase client exchanges the recovery link for a session.
   const recoveryLink=location.hash.includes('type=recovery')||
     new URLSearchParams(location.search).get('type')==='recovery';
   client.auth.onAuthStateChange((event,session)=>{
     user=session?.user||null;
     if(event==='PASSWORD_RECOVERY'){
       // Supabase has verified the emailed recovery link and created a temporary session.
       setTimeout(()=>openPasswordChange(true),0);
     }
     if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='INITIAL_SESSION'){
       setTimeout(()=>load().catch(e=>toast(e.message)),0);
     }
   });
   const {data,error}=await client.auth.getSession();
   if(error)throw error;
   user=data.session?.user||null;
   await load();
   if(recoveryLink){
     // Supabase processes the recovery token during client initialization.
     setTimeout(async()=>{
       const {data:current}=await client.auth.getSession();
       if(current.session)openPasswordChange(true);
     },200);
   }
   const qs=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
   const authError=qs.get('error_description')||hash.get('error_description');
   if(authError)toast('Посилання для відновлення недійсне або протерміноване. Надішли новий запит.');
 }catch(e){show('auth-panel');toast(e.message);}
}
const selectedGroupKey=()=>user?'daily-duo-selected-group-'+user.id:'';
function displayGroupSwitcher(){
 const dropdown=$('group-select');
 dropdown.innerHTML=myGroups.map(g=>'<option value="'+g.duo_id+'">'+escapeHtml(g.duos?.name||'Нова група')+'</option>').join('');
 if(duo)dropdown.value=duo.id;
}
async function load(preferredId=null){
 if(!user){
   if(channel){client.removeChannel(channel);channel=null;}
   myGroups=[];duo=null;me=null;
   show('auth-panel');$('header-signout').classList.add('hidden');
   return;
 }
 const requestUser=user.id;
 const {data,error}=await client.from('duo_members')
   .select('duo_id,user_id,display_name,joined_at,duos(*)')
   .eq('user_id',requestUser).order('joined_at',{ascending:false});
 if(error)throw error;
 if(user?.id!==requestUser)return;
 myGroups=data||[];
 const preferred=preferredId||localStorage.getItem(selectedGroupKey())||duo?.id;
 me=myGroups.find(g=>g.duo_id===preferred)||myGroups[0]||null;
 const previousId=duo?.id;
 duo=me?.duos||null;
 if(!duo){
   if(channel){client.removeChannel(channel);channel=null;}
   historyDuoId=null;historyRows=[];historyExpanded=false;todayTasks=[];challengeDefinitions=[];
   show('room-panel');$('header-signout').classList.add('hidden');
   return;
 }
 localStorage.setItem(selectedGroupKey(),duo.id);
 if(previousId!==duo.id||historyDuoId!==duo.id){
   historyDuoId=duo.id;historyExpanded=false;historyRows=[];todayTasks=[];challengeDefinitions=[];
   if(channel){client.removeChannel(channel);channel=null;}
 }
 displayGroupSwitcher();
 show('dashboard');
 $('header-signout').classList.remove('hidden');
 subscribe();
 await render();
}
$('group-select').onchange=async e=>{
 if(!myGroups.some(g=>g.duo_id===e.target.value))return;
 try{await load(e.target.value);}catch(err){toast('Не вдалося змінити групу: '+err.message);}
};
async function render(){
 if(!duo||!user)return;
 const activeDuoId=duo.id;
 const [membersResult,challengesResult,tasksResult]=await Promise.all([
   client.from('duo_members').select('user_id,display_name,joined_at').eq('duo_id',activeDuoId).order('joined_at'),
   client.from('duo_challenges').select('id,duo_id,title,description,is_active,created_by,created_at').eq('duo_id',activeDuoId).order('created_at',{ascending:true}),
   client.rpc('get_or_create_daily_tasks',{p_duo_id:activeDuoId})
 ]);
 for(const r of [membersResult,challengesResult,tasksResult])if(r.error)throw r.error;
 if(!user||!duo||duo.id!==activeDuoId)return;
 members=membersResult.data||[];
 challengeDefinitions=challengesResult.data||[];
 if($('manage-challenges-dialog').open)renderChallengeManagement();
 todayTasks=tasksResult.data||[];
 const taskIds=todayTasks.map(t=>t.id);
 const completionResult=taskIds.length
   ? await client.from('task_completions').select('task_id,user_id').in('task_id',taskIds)
   : {data:[],error:null};
 if(completionResult.error)throw completionResult.error;
 const completionByTask=new Map();
 for(const check of completionResult.data||[]){
   if(!completionByTask.has(check.task_id))completionByTask.set(check.task_id,new Set());
   completionByTask.get(check.task_id).add(check.user_id);
 }
 const roomName=duo.name||'Daily Duo';
 $('room-title').textContent=roomName;
 $('rename-wrap').classList.toggle('hidden',duo.created_by!==user.id);
 $('rename-open').classList.toggle('hidden',duo.created_by!==user.id);
 if(document.activeElement!==$('rename-room'))$('rename-room').value=roomName;
 $('today-label').textContent='TODAY · '+label(day()).toUpperCase();
 $('invite-title').textContent='Запросити Bestie';
 $('invite-code').textContent=duo.invite_code;
 $('invite-copy').textContent='Поділися кодом, щоб Bestie приєдналася до цієї групи.';

 $('challenge-list').innerHTML=todayTasks.length?todayTasks.map((t,index)=>{
   const completed=completionByTask.get(t.id)||new Set();
   const participants=members.map((m,i)=>{
     const mine=m.user_id===user.id;
     const done=completed.has(m.user_id);
     return '<div class="member-row"><div class="avatar '+(i%2?'friend':'')+'">'+(i%2?'💗':'🐾')+'</div>'+
       '<div class="member-info"><div class="member-name">'+escapeHtml(m.display_name)+(mine?' (ти)':'')+'</div>'+
       '<div class="member-state">'+(done?'Виконано!':'Ще не відмічено')+'</div></div>'+
       '<button type="button" class="done-button '+(done?'done':'')+'" data-task-id="'+t.id+'" '+(mine?'':'disabled')+
       ' aria-label="'+escapeHtml((done?'Зняти відмітку: ':'Відмітити: ')+t.title)+'">'+(done?'✓ Готово':'○ Виконала')+'</button></div>';
   }).join('');
   return '<article class="challenge-card '+(index%2?'challenge-card-alt':'')+'">'+
     '<div class="challenge-card-header"><h3>'+escapeHtml(t.title)+'</h3>'+
     '<span class="count-pill">'+completed.size+' / '+members.length+'</span></div>'+
     (t.description?'<p class="challenge-description">'+escapeHtml(t.description)+'</p>':'')+
     '<div class="challenge-members">'+participants+'</div>'+
     (members.length===2&&completed.size===2?'<p class="challenge-together">💗 Ви обидві впоралися!</p>':'')+
     '</article>';
 }).join(''):'<div class="panel empty-challenges"><p>Поки немає активних челенджів 🐾</p><p class="muted">Натисни «+ Додати», щоб створити перший.</p></div>';

 const history=[];
 for(let offset=0;offset<10000;offset+=500){
   const {data:page,error:historyError}=await client.from('daily_tasks')
     .select('id,challenge_id,task_date,title,task_completions(user_id)')
     .eq('duo_id',activeDuoId).order('task_date',{ascending:false}).range(offset,offset+499);
   if(historyError)throw historyError;
   history.push(...(page||[]));
   if((page||[]).length<500)break;
 }
 if(!user||!duo||duo.id!==activeDuoId)return;
 // Archive removes a challenge from the active tracker and its visible history.
 // Keep all historical records in Supabase so restoring brings them back.
 const activeChallengeIds=new Set(challengeDefinitions.filter(c=>c.is_active).map(c=>c.id));
 const byDay=new Map();
 for(const t of history){
   if(!activeChallengeIds.has(t.challenge_id))continue;
   if(!byDay.has(t.task_date))byDay.set(t.task_date,[]);
   byDay.get(t.task_date).push(t);
 }
 historyRows=[...byDay].map(([date,tasks])=>({date,tasks}));
 updateHistoryPreview();
 const hasAllChecks=(tasks,ids)=>tasks.length>0&&tasks.every(t=>
   ids.every(id=>(t.task_completions||[]).some(c=>c.user_id===id))
 );
 const togetherDays=historyRows.filter(row=>members.length===2&&hasAllChecks(row.tasks,members.map(m=>m.user_id))).length;
 $('together-count').textContent=togetherDays+' дн.';
 // The current streak includes today only once ALL currently active challenges
 // are marked; archived challenges must never block it.
 const myCompletedDays=new Set(historyRows.filter(row=>hasAllChecks(row.tasks,[user.id])).map(row=>row.date));
 let dateCursor=new Date(day()+'T12:00:00');
 if(!myCompletedDays.has(day()))dateCursor.setDate(dateCursor.getDate()-1);
 let streak=0;
 while(streak<10000){
   const d=dateCursor.getFullYear()+'-'+String(dateCursor.getMonth()+1).padStart(2,'0')+'-'+String(dateCursor.getDate()).padStart(2,'0');
   if(!myCompletedDays.has(d))break;
   streak++;dateCursor.setDate(dateCursor.getDate()-1);
 }
 $('my-streak').textContent=streak+' дн.';
}
function updateHistoryPreview(){
 const shown=historyExpanded?historyRows:historyRows.slice(0,3);
 $('history-list').innerHTML=shown.length?shown.map(row=>{
   const total=row.tasks.length*members.length;
   const completed=row.tasks.reduce((acc,t)=>acc+(t.task_completions||[]).length,0);
   const items=row.tasks.map(t=>'<div class="history-task-item"><span>'+escapeHtml(t.title)+'</span>'+
     '<span>'+new Set((t.task_completions||[]).map(c=>c.user_id)).size+'/'+members.length+'</span></div>').join('');
   return '<div class="history-day"><div class="history-day-header"><strong>'+label(row.date)+'</strong>'+
     '<span>'+completed+' / '+total+' відміток</span></div>'+items+'</div>';
 }).join(''):'<p class="history-empty">Поки немає записів. Ваша історія почнеться сьогодні 🐾</p>';
 const expandable=historyRows.length>3;
 const button=$('history-toggle');
 button.disabled=!expandable;
 button.setAttribute('aria-expanded',String(expandable&&historyExpanded));
 button.setAttribute('aria-label',expandable?(historyExpanded?'Згорнути історію':'Розгорнути історію'):'Історія — усі записи показано');
 $('history-chevron').classList.toggle('hidden',!expandable);
 $('history-chevron').textContent=historyExpanded?'⌃':'⌄';
}
$('history-toggle').onclick=()=>{historyExpanded=!historyExpanded;updateHistoryPreview();};
$('challenge-list').onclick=async e=>{
 const b=e.target.closest('button[data-task-id]');
 if(!b||b.disabled||!user||!duo)return;
 const taskItem=todayTasks.find(t=>t.id===b.dataset.taskId);
 if(!taskItem)return;
 b.disabled=true;
 try{
   const {data,error}=await client.from('task_completions')
     .select('task_id').eq('task_id',taskItem.id).eq('user_id',user.id).maybeSingle();
   if(error)throw error;
   if(data){
     const r=await client.from('task_completions').delete().eq('task_id',taskItem.id).eq('user_id',user.id);
     if(r.error)throw r.error;
     toast('Відмітку прибрано');
   }else{
     const r=await client.from('task_completions').insert({task_id:taskItem.id,duo_id:duo.id,user_id:user.id});
     if(r.error)throw r.error;
     toast('Челендж виконано! 🐾');
   }
   await render();
 }catch(err){toast('Не вдалося змінити відмітку: '+err.message);}
 finally{b.disabled=false;}
};
function subscribe(){
 if(channel)client.removeChannel(channel);
 channel=client.channel('duo-'+duo.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'task_completions',filter:'duo_id=eq.'+duo.id},()=>render().catch(err=>toast(err.message)))
   .on('postgres_changes',{event:'*',schema:'public',table:'duo_challenges',filter:'duo_id=eq.'+duo.id},()=>render().catch(err=>toast(err.message)))
   .on('postgres_changes',{event:'*',schema:'public',table:'daily_tasks',filter:'duo_id=eq.'+duo.id},()=>render().catch(err=>toast(err.message)))
   .on('postgres_changes',{event:'*',schema:'public',table:'duo_members',filter:'duo_id=eq.'+duo.id},()=>render().catch(err=>toast(err.message)))
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'duos',filter:'id=eq.'+duo.id},payload=>{
     if(payload.new?.name&&duo?.id===payload.new.id){
       duo.name=payload.new.name;
       const row=myGroups.find(g=>g.duo_id===duo.id);
       if(row?.duos)row.duos.name=payload.new.name;
       displayGroupSwitcher();
       render().catch(()=>{});
     }
   }).subscribe();
}
function renderChallengeManagement(){
 const list=$('manage-challenges-list');
 const ordered=[...challengeDefinitions].sort((a,b)=>Number(b.is_active)-Number(a.is_active));
 list.innerHTML=ordered.length
   ? ordered.map(c=>{
       const canManage=c.created_by===user?.id||duo?.created_by===user?.id;
       const controls=canManage?'<div class="manage-actions">'+
           '<button type="button" data-manage-challenge="'+c.id+'" data-manage-action="toggle" class="manage-challenge-action '+(c.is_active?'archive':'restore')+'">'+
             (c.is_active?'Архівувати':'Відновити')+'</button>'+
           '<button type="button" data-manage-challenge="'+c.id+'" data-manage-action="delete" class="manage-challenge-action danger">Видалити назавжди</button>'+
         '</div>':'';
       return '<div class="manage-challenge-row"><div class="manage-challenge-info">'+
         '<strong>'+escapeHtml(c.title)+'</strong>'+
         (c.description?'<span>'+escapeHtml(c.description)+'</span>':'')+
         (!c.is_active?'<span class="manage-archived-label">В архіві</span>':'')+
         '</div>'+controls+'</div>';
     }).join('')
   : '<p class="muted">Тут поки немає челенджів.</p>';
}
$('manage-challenges-open').onclick=()=>{
 if(!duo||!user)return;
 $('manage-challenges-message').textContent='';
 renderChallengeManagement();
 $('manage-challenges-dialog').showModal();
};
$('manage-challenges-close').onclick=()=>$('manage-challenges-dialog').close();
$('manage-challenges-dialog').addEventListener('click',e=>{
 if(e.target===$('manage-challenges-dialog'))$('manage-challenges-dialog').close();
});
$('manage-challenges-list').onclick=async e=>{
 const button=e.target.closest('button[data-manage-challenge][data-manage-action]');
 if(!button||button.disabled||!client||!duo||!user)return;
 const definition=challengeDefinitions.find(c=>c.id===button.dataset.manageChallenge);
 if(!definition)return;
 if(definition.created_by!==user.id&&duo.created_by!==user.id){
   $('manage-challenges-message').textContent='Ці дії доступні авторці челенджу або власниці команди.';
   return;
 }
 const action=button.dataset.manageAction;
 if(action!=='toggle'&&action!=='delete')return;
 if(action==='delete'){
   const message='Видалити «'+definition.title+'» НАЗАВЖДИ?\n\nБуде безповоротно видалено всі щоденні записи та галочки обох учасниць цього челенджу. Це змінить історію і статистику. Повернути дані не можна.';
   if(!window.confirm(message))return;
   // Extra confirmation protects against accidental irreversible deletion on mobile.
   if(!window.confirm('Підтвердити остаточне видалення «'+definition.title+'»?'))return;
 }else if(definition.is_active){
   if(!window.confirm('Архівувати «'+definition.title+'»? Челендж зникне з активних, але історія збережеться.'))return;
 }
 const buttons=[...$('manage-challenges-list').querySelectorAll('button[data-manage-challenge]')];
 buttons.forEach(b=>b.disabled=true);
 $('manage-challenges-message').textContent='Зберігаємо зміни…';
 try{
   if(action==='delete'){
     const {data,error}=await client.from('duo_challenges')
       .delete()
       .eq('id',definition.id).eq('duo_id',duo.id)
       .select('id').maybeSingle();
     if(error)throw error;
     if(!data)throw new Error('Сервер не підтвердив видалення. Перевір права доступу.');
     // Database ON DELETE CASCADE removes associated daily_tasks and completions.
     await render();
     $('manage-challenges-message').textContent='Челендж і його історію видалено назавжди.';
     toast('Челендж повністю видалено 🐾');
   }else{
     const nextActive=!definition.is_active;
     const {data,error}=await client.from('duo_challenges')
       .update({is_active:nextActive})
       .eq('id',definition.id).eq('duo_id',duo.id)
       .select('id,is_active').maybeSingle();
     if(error)throw error;
     if(!data||data.is_active!==nextActive)throw new Error('Сервер не підтвердив зміну. Перевір права доступу.');
     await render();
     $('manage-challenges-message').textContent=nextActive
       ? 'Челендж відновлено! Він знову зʼявиться у щоденному списку.'
       : 'Челендж в архіві. Його історія збережена.';
     toast(nextActive?'Челендж відновлено 🐾':'Челендж архівовано 🐾');
   }
 }catch(err){
   $('manage-challenges-message').textContent='Не вдалося виконати дію: '+err.message;
 }finally{
   $('manage-challenges-list').querySelectorAll('button[data-manage-challenge]').forEach(b=>b.disabled=false);
 }
};
$('add-challenge-open').onclick=()=>{
 $('challenge-form').reset();
 $('challenge-dialog').showModal();
 $('new-challenge-title').focus();
};
$('challenge-dialog-close').onclick=()=>$('challenge-dialog').close();
$('challenge-dialog').addEventListener('click',e=>{if(e.target===$('challenge-dialog'))$('challenge-dialog').close();});
$('challenge-form').onsubmit=async e=>{
 e.preventDefault();
 if(!client||!user||!duo)return;
 const title=$('new-challenge-title').value.trim();
 const description=$('new-challenge-description').value.trim();
 if(!title||title.length>60||description.length>280)return toast('Назва має бути до 60 символів, опис — до 280.');
 const b=$('add-challenge-save');b.disabled=true;
 try{
   const {data,error}=await client.from('duo_challenges').insert({
     duo_id:duo.id,title,description,created_by:user.id
   }).select('id,title').single();
   if(error)throw error;
   $('challenge-dialog').close();
   await render();
   toast('Челендж «'+data.title+'» додано до команди! 💗');
 }catch(err){toast('Не вдалося створити челендж: '+err.message);}
 finally{b.disabled=false;}
};
// Password fields: visibility toggles, recovery email, authenticated password update.
let passwordRecoveryMode=false;
document.addEventListener('click',e=>{
 const toggle=e.target.closest('button[data-toggle-password]');
 if(!toggle)return;
 const input=$(toggle.dataset.togglePassword);
 if(!input)return;
 const visible=input.type==='password';
 input.type=visible?'text':'password';
 toggle.setAttribute('aria-pressed',String(visible));
 toggle.setAttribute('aria-label',visible?'Приховати пароль':'Показати пароль');
 toggle.textContent=visible?'🙈':'👁';
});
function openPasswordChange(recovery=false){
 if(!$('password-change-dialog')||!client)return;
 passwordRecoveryMode=Boolean(recovery);
 $('password-change-title').textContent=recovery?'Новий пароль 💗':'Змінити пароль 🔒';
 $('password-change-description').textContent=recovery
   ? 'Посилання підтверджено. Придумай новий пароль для входу.'
   : 'Придумай новий пароль для свого акаунта.';
 $('password-change-form').reset();
 $('password-change-message').textContent='';
 if(!$('password-change-dialog').open)$('password-change-dialog').showModal();
}
$('forgot-password-open').onclick=()=>{
 $('password-reset-request-form').reset();
 $('password-reset-email').value=$('email').value.trim();
 $('password-reset-request-message').textContent='';
 $('password-reset-request-dialog').showModal();
};
$('password-reset-request-close').onclick=()=>$('password-reset-request-dialog').close();
$('password-reset-request-dialog').addEventListener('click',e=>{
 if(e.target===$('password-reset-request-dialog'))$('password-reset-request-dialog').close();
});
$('password-reset-request-form').onsubmit=async e=>{
 e.preventDefault();
 const email=$('password-reset-email').value.trim(),button=$('password-reset-request-send');
 if(!client)return toast('Немає підключення до Supabase.');
 if(!email)return;
 button.disabled=true;
 $('password-reset-request-message').textContent='Надсилаємо лист…';
 try{
   const redirectTo=location.origin+location.pathname;
   const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
   if(error)throw error;
   // Avoid revealing whether a specific email has an account.
   $('password-reset-request-message').textContent='Якщо цей email зареєстрований, на нього надійде лист із посиланням. Перевір також Спам.';
 }catch(err){
   $('password-reset-request-message').textContent='Не вдалося надіслати лист: '+err.message;
 }finally{button.disabled=false;}
};
$('change-password-room').onclick=()=>openPasswordChange(false);
$('change-password-dashboard').onclick=()=>openPasswordChange(false);
$('password-change-close').onclick=()=>{
 $('password-change-dialog').close();
 passwordRecoveryMode=false;
};
$('password-change-form').onsubmit=async e=>{
 e.preventDefault();
 const password=$('new-password').value,confirmPassword=$('confirm-new-password').value;
 const button=$('password-change-save');
 if(password.length<8)return $('password-change-message').textContent='Пароль має містити щонайменше 8 символів.';
 if(password!==confirmPassword)return $('password-change-message').textContent='Паролі не збігаються.';
 button.disabled=true;
 $('password-change-message').textContent='Змінюємо пароль…';
 try{
   const {data:sessionInfo,error:sessionError}=await client.auth.getSession();
   if(sessionError)throw sessionError;
   if(!sessionInfo.session)throw new Error('Сеанс завершився. Запроси нове посилання для відновлення або увійди знову.');
   const {error}=await client.auth.updateUser({password});
   if(error)throw error;
   $('password-change-form').reset();
   $('password-change-message').textContent='✓ Пароль успішно змінено! Тепер можна входити з новим паролем.';
   toast('Пароль оновлено 🔒');
   const wasRecovery=passwordRecoveryMode;
   passwordRecoveryMode=false;
   if(wasRecovery){
     // Strip reset tokens from browser history after successful use.
     history.replaceState(null,'',location.pathname);
   }
 }catch(err){$('password-change-message').textContent='Не вдалося змінити пароль: '+err.message;}
 finally{button.disabled=false;}
};
$('show-login').onclick=()=>mode(false);$('show-signup').onclick=()=>mode(true);
$('auth-form').onsubmit=async e=>{e.preventDefault();if(!client){toast('Не вдалося підключити сервер. Спробуй оновити сторінку.');return;}const email=$('email').value.trim(),password=$('password').value,b=$('auth-submit');b.disabled=true;try{if(signingUp){const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:$('display-name').value.trim()}}});if(error)throw error;toast(data.session?'Акаунт створено!':'Перевір пошту й підтвердь адресу, потім увійди.');}else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;}}catch(err){toast(err.message)}finally{b.disabled=false;}};
async function persistDuoName(value) {
 const name=value.trim();
 if(!duo||!user||duo.created_by!==user.id)throw new Error('Назву може змінити власниця дуету.');
 if(!name||name.length>40)throw new Error('Вкажи назву до 40 символів.');
 const {data,error}=await client.from('duos')
   .update({name})
   .eq('id',duo.id)
   .eq('created_by',user.id)
   .select('id,name')
   .maybeSingle();
 if(error) {
   if(error.code==='42703'||error.code==='PGRST204'||/column.*name|schema cache/i.test(error.message||'')) {
     throw new Error('У базі немає поля для назви. Спочатку запусти room-name-migration.sql у Supabase → SQL Editor.');
   }
   throw new Error('Supabase не зберіг назву: '+error.message);
 }
 if(!data||data.name!==name) {
   throw new Error('Supabase не підтвердив збереження. Перевір права власниці та SQL-політику для таблиці duos.');
 }
 // Re-read server value instead of assuming a successful update.
 const {data:verified,error:readError}=await client.from('duos').select('id,name').eq('id',duo.id).single();
 if(readError||verified?.name!==name)throw new Error('Не вдалося перевірити назву в базі.');
 duo.name=verified.name;
 const selectedGroup=myGroups.find(g=>g.duo_id===duo.id);
 if(selectedGroup?.duos)selectedGroup.duos.name=verified.name;
 displayGroupSwitcher();
 $('room-title').textContent=verified.name;
 
 return verified.name;
}
async function createNewGroup(groupName){
 const name=groupName.trim();
 if(!name||name.length>40)throw new Error('Вкажи назву групи до 40 символів.');
 const displayName=user.user_metadata?.display_name?.trim()||user.email.split('@')[0];
 const {data,error}=await client.rpc('create_duo',{p_display_name:displayName});
 if(error)throw error;
 const newId=Array.isArray(data)?data[0]?.duo_id:data?.duo_id;
 if(!newId)throw new Error('Групу створено, але сервер не повернув її ID. Онови сторінку.');
 await load(newId);
 try{await persistDuoName(name);}
 catch(err){toast('Групу створено, але назву не збережено: '+err.message);throw err;}
 await load(newId);
 return newId;
}
async function joinExistingGroup(code){
 const normalized=code.trim().toUpperCase();
 if(!normalized)throw new Error('Введи код групи.');
 const displayName=user.user_metadata?.display_name?.trim()||user.email.split('@')[0];
 const {data,error}=await client.rpc('join_duo',{p_invite_code:normalized,p_display_name:displayName});
 if(error)throw error;
 await load(data);
 return data;
}
$('create-room-form').onsubmit=async e=>{
 e.preventDefault();
 const b=e.submitter;if(b)b.disabled=true;
 try{await createNewGroup($('room-name').value);toast('Нову групу створено! 🐾');}
 catch(err){toast('Помилка створення групи: '+err.message);}
 finally{if(b)b.disabled=false;}
};
$('join-room-form').onsubmit=async e=>{
 e.preventDefault();
 const b=e.submitter;if(b)b.disabled=true;
 try{await joinExistingGroup($('room-code').value);toast('Ти приєдналася до групи! 💗');}
 catch(err){toast('Не вдалося приєднатися: '+err.message);}
 finally{if(b)b.disabled=false;}
};
$('add-group-open').onclick=()=>{
 $('group-create-form').reset();$('group-join-form').reset();
 $('group-message').textContent='';$('group-dialog').showModal();
};
$('group-dialog-close').onclick=()=>$('group-dialog').close();
$('group-dialog').addEventListener('click',e=>{
 if(e.target===$('group-dialog'))$('group-dialog').close();
});
$('group-create-form').onsubmit=async e=>{
 e.preventDefault();
 const button=$('create-group-save');button.disabled=true;
 $('group-message').textContent='Створюємо групу…';
 try{
   await createNewGroup($('new-group-name').value);
   $('group-dialog').close();
   toast('Групу додано! Тепер у неї окремі челенджі 🐾');
 }catch(err){$('group-message').textContent=err.message;}
 finally{button.disabled=false;}
};
$('group-join-form').onsubmit=async e=>{
 e.preventDefault();
 const button=$('join-group-save');button.disabled=true;
 $('group-message').textContent='Приєднуємося…';
 try{
   await joinExistingGroup($('new-group-code').value);
   $('group-dialog').close();
   toast('Готово! Групу додано до списку 💗');
 }catch(err){$('group-message').textContent=err.message;}
 finally{button.disabled=false;}
};
async function signout(){if(channel)client.removeChannel(channel);await client.auth.signOut();user=null;duo=null;myGroups=[];show('auth-panel');$('header-signout').classList.add('hidden');}
$('header-signout').onclick=signout;$('signout-room').onclick=signout;
$('leave-room').onclick=async()=>{
 if(!user||!duo)return;
 const groupId=duo.id;
 const owner=duo.created_by===user.id;
 const count=members.length;
 const message=owner&&count===1
   ? 'Ти єдина учасниця групи «'+(duo.name||'Daily Duo')+'». Якщо покинеш її, група й усі її челенджі та відмітки видаляться НАЗАВЖДИ. Продовжити?'
   : owner
     ? 'Покинути групу «'+(duo.name||'Daily Duo')+'»? Права власниці перейдуть Bestie. Група та історія залишаться.'
     : 'Покинути групу «'+(duo.name||'Daily Duo')+'»? Ти втратиш доступ до її челенджів.';
 if(!window.confirm(message))return;
 if(owner&&count===1&&!window.confirm('Остаточно видалити цю групу з усією історією?'))return;
 const b=$('leave-room');b.disabled=true;
 try{
   const {data,error}=await client.rpc('leave_duo',{p_duo_id:groupId});
   if(error)throw error;
   await load();
   toast(data==='deleted_group'?'Групу видалено 🐾':'Ти покинула групу 🐾');
 }catch(err){toast('Не вдалося покинути групу: '+err.message);}
 finally{b.disabled=false;}
};
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(duo.invite_code);toast('Код скопійовано! 💌');}catch{toast('Код: '+duo.invite_code);}};
$('invite-open').onclick=()=>$('invite-dialog').showModal();
$('rename-open').onclick=()=>{
 $('rename-message').textContent='';
 $('invite-dialog').showModal();
 $('rename-room').focus();
 $('rename-room').select();
};
$('save-room-name').onclick=async()=>{
 const button=$('save-room-name');
 button.disabled=true;
 $('rename-message').textContent='Зберігаємо на сервері…';
 try{
   const name=await persistDuoName($('rename-room').value);
   $('rename-message').textContent='✓ Назву «'+name+'» збережено в Supabase.';
   toast('Назву дуету збережено! 🐾');
 }catch(err){
   $('rename-message').textContent=err.message;
   toast('Назву не збережено. Деталі під полем.');
 }finally{button.disabled=false;}
};
$('invite-close').onclick=()=>$('invite-dialog').close();
$('invite-dialog').addEventListener('click',e=>{if(e.target===$('invite-dialog'))$('invite-dialog').close();});
$('share-code').onclick=async()=>{if(!duo)return;const text='Приєднуйся до нашої групи «'+(duo.name||'Daily Duo')+'» 🐾 Код: '+duo.invite_code+'\n'+location.href;if(navigator.share){try{await navigator.share({title:'Daily Duo 🐾',text});return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(text);toast('Запрошення скопійовано! 🐾');}catch{toast('Код: '+duo.invite_code);}};
mode(false);boot();
})();