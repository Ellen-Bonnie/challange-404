(() => {
'use strict';
const $ = id => document.getElementById(id);
let client, user, duo, me, members=[], task, channel, signingUp=false;
const reminderZone = (()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Sofia';}catch{return 'Europe/Sofia';}})();
const desiredRoomNameKey=id=>'daily-duo-room-name-'+id;

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = message => {const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500);};
const show = id => ['auth-panel','room-panel','dashboard'].forEach(p=>$(p).classList.toggle('hidden',p!==id));
const day = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const label = d => new Date(d+'T12:00:00').toLocaleDateString('uk-UA',{day:'numeric',month:'long'});
function mode(signup){signingUp=signup;$('show-login').classList.toggle('active',!signup);$('show-signup').classList.toggle('active',signup);$('name-field').classList.toggle('hidden',!signup);$('display-name').required=signup;$('auth-submit').textContent=signup?'Зареєструватися ✨':'Увійти ✨';}
function config(){const preset=window.DAILY_DUO_CONFIG;return preset?.url && (preset.key?.startsWith('sb_publishable_') || preset.key?.startsWith('eyJ')) ? preset : null;}
function initClient(){const c=config();if(!c)return false;if(!window.supabase?.createClient)throw new Error('Supabase SDK не завантажився');client=window.supabase.createClient(c.url,c.key);return true;}
async function boot(){try{if(!initClient()){show('auth-panel');toast('Конфігурація Supabase відсутня. Перевір config.js.');return;}const {data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;await load();client.auth.onAuthStateChange((_e,session)=>{user=session?.user||null;setTimeout(()=>load().catch(e=>toast(e.message)),0);});}catch(e){show('auth-panel');toast(e.message);}}
async function load(){if(!user){show('auth-panel');$('header-signout').classList.add('hidden');$('header-room-name').textContent='Daily Duo';return;}const {data,error}=await client.from('duo_members').select('duo_id,user_id,display_name,joined_at,duos(*)').eq('user_id',user.id).order('joined_at',{ascending:false}).limit(1);if(error)throw error;me=data?.[0]||null;duo=me?.duos||null;if(!duo){show('room-panel');$('header-signout').classList.add('hidden');$('header-room-name').textContent='Daily Duo';return;}show('dashboard');$('header-signout').classList.remove('hidden');await render();subscribe();await loadReminderPreferences();}
async function render(){if(!duo||!user)return;
 const {data:memberData,error:memberError}=await client.from('duo_members').select('user_id,display_name,joined_at').eq('duo_id',duo.id).order('joined_at');if(memberError)throw memberError;members=memberData||[];
 const {data:todayTask,error:taskError}=await client.rpc('get_or_create_daily_task',{p_duo_id:duo.id});if(taskError){$('task-title').textContent='Щоденне завдання ще не налаштовано';$('task-hint').textContent='Потрібно запустити останній SQL-код для генерації завдань. '+taskError.message;return;}task=todayTask;
 const {data:checks,error:checksError}=await client.from('task_completions').select('user_id,completed_at').eq('task_id',task.id);if(checksError)throw checksError;const completed=new Set((checks||[]).map(c=>c.user_id));
 const roomName=duo.name||localStorage.getItem(desiredRoomNameKey(duo.id))||'Daily Duo';$('room-title').textContent=roomName;$('header-room-name').textContent=roomName;$('rename-wrap').classList.toggle('hidden',duo.created_by!==user.id);$('rename-room').value=roomName;$('welcome-copy').textContent='Ваша планка на '+label(task.task_date);$('today-label').textContent='TODAY · '+label(task.task_date).toUpperCase();$('category-pill').textContent=task.category||'💪 ПЛАНКА';$('challenge-date').textContent=label(task.task_date);$('task-title').textContent=task.title;$('task-hint').textContent=task.description||'';$('invite-title').textContent='Запросити подругу';$('invite-code').textContent=duo.invite_code;$('invite-copy').textContent='Поділися цим кодом, щоб подруга приєдналася.';$('completion-count').textContent=completed.size+' / '+members.length;
 $('members-list').innerHTML=members.map((m,i)=>'<div class="member-row"><div class="avatar '+(i%2?'friend':'')+'">'+(i%2?'💗':'🐾')+'</div><div class="member-info"><div class="member-name">'+escapeHtml(m.display_name)+(m.user_id===user.id?' (ти)':'')+'</div><div class="member-state">'+(completed.has(m.user_id)?'Виконано!':'Ще не відмічено')+'</div></div><button type="button" class="done-button '+(completed.has(m.user_id)?'done':'')+'" data-user="'+m.user_id+'" '+(m.user_id!==user.id?'disabled':'')+'>'+(completed.has(m.user_id)?'✓ Готово':'○ Виконала')+'</button></div>').join('');
 $('members-list').querySelectorAll('button[data-user="'+user.id+'"]').forEach(b=>b.addEventListener('click',toggle));
 $('both-done').classList.toggle('hidden',members.length!==2||completed.size!==2);
 const {data:history}=await client.from('daily_tasks').select('id,task_date,title,task_completions(user_id)').eq('duo_id',duo.id).order('task_date',{ascending:false}).limit(30);
 $('history-list').innerHTML=(history||[]).map(t=>'<div class="history-row"><span class="history-date">'+label(t.task_date)+'</span><span class="history-task">'+escapeHtml(t.title)+'</span><span class="history-status">'+new Set((t.task_completions||[]).map(c=>c.user_id)).size+'/2</span></div>').join('');
 const both=(history||[]).filter(t=>members.length===2&&new Set((t.task_completions||[]).map(c=>c.user_id)).size===2).length;$('together-count').textContent=both+' дн.';
 const myDates=new Set((history||[]).filter(t=>(t.task_completions||[]).some(c=>c.user_id===user.id)).map(t=>t.task_date));let d=new Date(day()+'T12:00:00');if(!myDates.has(day()))d.setDate(d.getDate()-1);let streak=0;while(streak<30){const s=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(!myDates.has(s))break;streak++;d.setDate(d.getDate()-1);}$('my-streak').textContent=streak+' дн.';
}
async function toggle(e){const b=e.currentTarget;b.disabled=true;try{const {data,error}=await client.from('task_completions').select('task_id').eq('task_id',task.id).eq('user_id',user.id).maybeSingle();if(error)throw error;if(data){const r=await client.from('task_completions').delete().eq('task_id',task.id).eq('user_id',user.id);if(r.error)throw r.error;toast('Відмітку прибрано');}else{const r=await client.from('task_completions').insert({task_id:task.id,duo_id:duo.id,user_id:user.id});if(r.error)throw r.error;toast('Планку виконано! 💪');}await render();}catch(err){toast(err.message)}finally{b.disabled=false;}}
function subscribe(){if(channel)client.removeChannel(channel);channel=client.channel('duo-'+duo.id).on('postgres_changes',{event:'*',schema:'public',table:'task_completions'},()=>render().catch(()=>{})).on('postgres_changes',{event:'*',schema:'public',table:'duo_members',filter:'duo_id=eq.'+duo.id},()=>render().catch(()=>{})).on('postgres_changes',{event:'UPDATE',schema:'public',table:'duos',filter:'id=eq.'+duo.id},payload=>{if(payload.new?.name){duo.name=payload.new.name;render().catch(()=>{});}}).subscribe();}
$('show-login').onclick=()=>mode(false);$('show-signup').onclick=()=>mode(true);
$('auth-form').onsubmit=async e=>{e.preventDefault();if(!client){toast('Не вдалося підключити сервер. Спробуй оновити сторінку.');return;}const email=$('email').value.trim(),password=$('password').value,b=$('auth-submit');b.disabled=true;try{if(signingUp){const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:$('display-name').value.trim()}}});if(error)throw error;toast(data.session?'Акаунт створено!':'Перевір пошту й підтвердь адресу, потім увійди.');}else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;}}catch(err){toast(err.message)}finally{b.disabled=false;}};
$('create-room-form').onsubmit=async e=>{e.preventDefault();try{const name=$('display-name').value.trim()||user.user_metadata?.display_name||user.email.split('@')[0];const roomName=$('room-name').value.trim();const {data,error}=await client.rpc('create_duo',{p_display_name:name});if(error)throw error;await load();if(duo){localStorage.setItem(desiredRoomNameKey(duo.id),roomName);const {error:nameError}=await client.from('duos').update({name:roomName}).eq('id',duo.id).eq('created_by',user.id);if(!nameError){duo.name=roomName;}else{toast('Дует створено. Для спільного відображення назви застосуй SQL-оновлення бази.');}await render();}toast('Дует для планки створено! 🐾');}catch(err){toast(err.message);}};
$('join-room-form').onsubmit=async e=>{e.preventDefault();try{const name=$('display-name').value.trim()||user.user_metadata?.display_name||user.email.split('@')[0];const {error}=await client.rpc('join_duo',{p_invite_code:$('room-code').value.trim(),p_display_name:name});if(error)throw error;await load();toast('Ти приєдналася! 💞');}catch(err){toast(err.message);}};
async function signout(){if(channel)client.removeChannel(channel);await client.auth.signOut();user=null;duo=null;$('wa-phone').value='';$('wa-consent').checked=false;show('auth-panel');$('header-signout').classList.add('hidden');$('header-room-name').textContent='Daily Duo';}
$('header-signout').onclick=signout;$('signout-room').onclick=signout;
$('leave-room').onclick=()=>toast('Вихід із дуету поки недоступний; акаунт можна змінити через «Вийти».');
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(duo.invite_code);toast('Код скопійовано! 💌');}catch{toast('Код: '+duo.invite_code);}};
$('invite-open').onclick=()=>$('invite-dialog').showModal();
$('save-room-name').onclick=async()=>{if(!duo||duo.created_by!==user.id)return;const name=$('rename-room').value.trim();if(!name)return toast('Введи назву дуету.');const {error}=await client.from('duos').update({name}).eq('id',duo.id).eq('created_by',user.id);if(error){toast('Не вдалося зберегти назву. Переконайся, що SQL-оновлення застосоване.');return;}duo.name=name;localStorage.setItem(desiredRoomNameKey(duo.id),name);await render();toast('Назву дуету збережено! 🐾');};
$('invite-close').onclick=()=>$('invite-dialog').close();
$('invite-dialog').addEventListener('click',e=>{if(e.target===$('invite-dialog'))$('invite-dialog').close();});
$('share-code').onclick=async()=>{if(!duo)return;const text='Приєднуйся до нашого Daily Duo 🐾 Код: '+duo.invite_code+'\n'+location.href;if(navigator.share){try{await navigator.share({title:'Daily Duo 🐾',text});return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(text);toast('Запрошення скопійовано! 🐾');}catch{toast('Код: '+duo.invite_code);}};
// Each friend opts in independently. Settings are persisted in Supabase,
 // not merely localStorage. Production delivery additionally needs Meta credentials.
$('wa-time-zone').textContent='Часовий пояс цього пристрою: '+reminderZone;
async function loadReminderPreferences(){
 if(!client||!user||!duo)return;
 const requestUser=user.id;
 $('reminder-status').textContent='Завантажуємо налаштування WhatsApp…';
 const {data,error}=await client.from('daily_duo_whatsapp_preferences')
   .select('phone_e164,reminder_time,time_zone,enabled,consented_at')
   .eq('user_id',user.id).maybeSingle();
 if(requestUser!==user?.id)return;
 if(error){
   $('reminder-status').textContent='WhatsApp ще не підключений до бази. Спочатку застосуй whatsapp-setup.sql у Supabase.';
   $('disable-reminder').classList.add('hidden');
   return;
 }
 if(!data){
   $('wa-phone').value='';
   $('wa-consent').checked=false;
   $('disable-reminder').classList.add('hidden');
   $('reminder-status').textContent='Ще не підключено. Для реальної відправки також потрібні налаштування Meta й Netlify.';
   return;
 }
 $('wa-phone').value=data.phone_e164||'';
 $('reminder-time').value=String(data.reminder_time||'20:00').slice(0,5);
 $('wa-consent').checked=Boolean(data.enabled&&data.consented_at);
 $('disable-reminder').classList.toggle('hidden',!data.enabled);
 $('reminder-status').textContent=data.enabled
   ? 'Згоду збережено. Час: '+$('reminder-time').value+
      ' ('+(data.time_zone||reminderZone)+'). Доставка працюватиме після налаштування Meta і Netlify.'
   : 'WhatsApp-нагадування вимкнені.';
}
$('save-reminder').onclick=async()=>{
 if(!client||!user||!duo)return toast('Спочатку увійди у свій дует.');
 const phone=$('wa-phone').value.trim().replace(/[\s\-()]/g,'');
 const time=$('reminder-time').value;
 const b=$('save-reminder');
 if(!/^\+[1-9]\d{7,14}$/.test(phone))return toast('Введи свій номер із кодом країни, наприклад +359…');
 if(!/^\d\d:(00|15|30|45)$/.test(time))return toast('Обери час із кроком 15 хвилин: 00, 15, 30 або 45.');
 if(!$('wa-consent').checked)return toast('Щоб отримувати повідомлення, спочатку підтвердь згоду.');
 b.disabled=true;
 try{
   const {error}=await client.from('daily_duo_whatsapp_preferences').upsert({
      user_id:user.id,
      duo_id:duo.id,
      phone_e164:phone,
      reminder_time:time+':00',
      time_zone:reminderZone,
      enabled:true,
      consented_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(error)throw error;
   await loadReminderPreferences();
   toast('Згоду та час збережено 🐾');
 }catch(err){
   toast('Не вдалося зберегти WhatsApp-налаштування.');
   $('reminder-status').textContent='Перевір, чи застосовано whatsapp-setup.sql. Помилка: '+err.message;
 }finally{b.disabled=false;}
};
$('disable-reminder').onclick=async()=>{
 if(!client||!user)return;
 const b=$('disable-reminder');b.disabled=true;
 try{
  const {error}=await client.from('daily_duo_whatsapp_preferences').delete().eq('user_id',user.id);
  if(error)throw error;
  $('wa-phone').value='';$('wa-consent').checked=false;
  $('disable-reminder').classList.add('hidden');
  $('reminder-status').textContent='WhatsApp-нагадування вимкнені. Номер видалено з налаштувань.';
  toast('Нагадування вимкнені 🐾');
 }catch(err){toast('Не вдалося вимкнути WhatsApp-нагадування: '+err.message);}
 finally{b.disabled=false;}
};
mode(false);boot();
})();