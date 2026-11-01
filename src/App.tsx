import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, Bell, CalendarDays, Check,
  ChevronDown, CircleHelp, Clock3, CreditCard, Dumbbell, FileCheck2,
  FileText, Home, Instagram, LogOut, Menu, MoreHorizontal, Plus,
  Search, Settings, ShieldCheck, Sparkles, Upload, Users, Wallet,
  X, UserRound, CheckCircle2, AlertCircle, Image as ImageIcon
} from 'lucide-react'

type Role = 'associado' | 'admin' | 'financeiro' | 'atividades'
type Tab = 'inicio' | 'feed' | 'atividades' | 'financeiro' | 'perfil' | 'associados' | 'calendario' | 'conteudo' | 'validacao' | 'configuracoes'
type Member = { id:number; name:string; email:string; status:'Ativo'|'Pendente'|'Inativo'; initials:string; color:string; phone:string; createdAt:string }
type PaymentRecord = { id:number; memberId?:number; name:string; initials:string; competence:string; value:string; date:string; file:string; status:'pending'|'approved'|'rejected'; reason?:string }
type AuditEntry = { id:number; action:string; detail:string; date:string; actor:string }
type DemoProfile = { memberId?:number; name:string; email:string; phone:string; joinedAt:string }

function useStoredState<T>(key:string, initialValue:T):[T, React.Dispatch<React.SetStateAction<T>>] {
  const [value,setValue]=useState<T>(()=>{
    try { const saved=localStorage.getItem(`orion:${key}`); return saved ? JSON.parse(saved) as T : initialValue }
    catch { return initialValue }
  })
  useEffect(()=>{ try { localStorage.setItem(`orion:${key}`,JSON.stringify(value)) } catch { /* O armazenamento local é apenas uma facilidade do protótipo. */ } },[key,value])
  return [value,setValue]
}

function localDateISO(date=new Date()):string { const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,'0');const d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}` }
function currentCompetenceLabel(date=new Date()):string { return date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(' de ',' ').replace(/^./,c=>c.toUpperCase()) }

function expandMemberOccurrences(source:any[], from=new Date(), horizonDays=180):any[] {
  const today=new Date(from.getFullYear(),from.getMonth(),from.getDate(),12)
  const last=new Date(today);last.setDate(last.getDate()+horizonDays)
  const result:any[]=[]
  for(const activity of source){
    if(activity.kind!=='recurring'||!activity.startDate){
      const date=activity.startDate?new Date(`${activity.startDate}T12:00:00`):null
      if(!date||date>=today&&date<=last)result.push(activity)
      continue
    }
    const start=new Date(`${activity.startDate}T12:00:00`)
    const until=activity.endDate?new Date(`${activity.endDate}T12:00:00`):last
    const end=until<last?until:last
    const every=Math.max(1,Number(activity.interval)||1)
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      if(d<today)continue
      const dayDiff=Math.round((d.getTime()-start.getTime())/86400000)
      const monthDiff=(d.getFullYear()-start.getFullYear())*12+d.getMonth()-start.getMonth()
      const matches=activity.recurrence==='daily'?dayDiff%every===0
        :activity.recurrence==='weekly'?dayDiff%(7*every)===0
        :activity.recurrence==='biweekly'?dayDiff%(14*every)===0
        :activity.recurrence==='monthly'?d.getDate()===Math.min(start.getDate(),new Date(d.getFullYear(),d.getMonth()+1,0).getDate())&&monthDiff%every===0
        :false
      if(matches){
        const iso=localDateISO(d)
        result.push({...activity,id:`${activity.id}@${iso}`,seriesId:activity.id,startDate:iso,date:d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}),joined:0})
      }
    }
  }
  return result.sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||'')))
}

function activitySignupCount(activity:any, joined:Array<number|string>):number {
  if(activity.kind==='recurring'){
    const nextOccurrence=expandMemberOccurrences([activity],new Date(),180)[0]
    return nextOccurrence&&joined.includes(nextOccurrence.id)?1:0
  }
  return Number(activity.joined||0)+(joined.includes(activity.id)?1:0)
}

const PROOF_DB_NAME = 'orion-local-documents'
function openProofDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('Armazenamento de arquivos indisponível neste navegador.'));return}
    const request=indexedDB.open(PROOF_DB_NAME,1)
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('proofs'))request.result.createObjectStore('proofs')}
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error||new Error('Não foi possível abrir o armazenamento local.'))
  })
}
async function saveProofFile(id:number,file:File):Promise<void>{
  const db=await openProofDatabase()
  try { await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('proofs','readwrite');tx.objectStore('proofs').put(file,id)
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Falha ao guardar o comprovante.'));tx.onabort=()=>reject(tx.error||new Error('Gravação do comprovante cancelada.'))
  }) } finally { db.close() }
}
async function readProofFile(id:number):Promise<Blob|null>{
  const db=await openProofDatabase()
  const result=await new Promise<Blob|null>((resolve,reject)=>{
    const tx=db.transaction('proofs','readonly');const request=tx.objectStore('proofs').get(id)
    request.onsuccess=()=>resolve((request.result as Blob|undefined)||null)
    request.onerror=()=>reject(request.error||new Error('Falha ao ler o comprovante.'))
  })
  db.close();return result
}

const activities = [
  { id: 1, title: 'Racha de Badminton', category: 'Esporte', date: 'Ter, 3 nov', startDate:'2026-11-03', time: '19:00 – 21:00', place: 'Quadra principal', joined: 12, capacity: 16, noLimit:false, color: 'mint', description: 'Encontro semanal para jogar, praticar e se divertir.', kind:'single' },
  { id: 2, title: 'Noite de jogos', category: 'Social', date: 'Sex, 6 nov', startDate:'2026-11-06', time: '19:30 – 22:00', place: 'Salão social', joined: 18, capacity: 30, noLimit:false, color: 'lavender', description: 'Uma noite leve para reunir os associados.', kind:'single' },
  { id: 3, title: 'Treino funcional', category: 'Bem-estar', date: 'Sáb, 7 nov', startDate:'2026-11-07', time: '08:00 – 09:00', place: 'Área externa', joined: 8, capacity: 12, noLimit:false, color: 'peach', description: 'Treino em grupo para todos os níveis.', kind:'single' },
]
const initialMembers:Member[] = [
  { id:1, name: 'Marina Costa', email: 'marina.costa@email.com', status: 'Ativo', initials: 'MC', color: 'lavender', phone:'(12) 99911-1001', createdAt:'15/03/2023' },
  { id:2, name: 'Rafael Almeida', email: 'rafael.almeida@email.com', status: 'Ativo', initials: 'RA', color: 'mint', phone:'(12) 99911-1002', createdAt:'20/05/2023' },
  { id:3, name: 'Camila Nunes', email: 'camila.nunes@email.com', status: 'Pendente', initials: 'CN', color: 'peach', phone:'(12) 99911-1003', createdAt:'04/10/2026' },
  { id:4, name: 'Lucas Ferreira', email: 'lucas.ferreira@email.com', status: 'Ativo', initials: 'LF', color: 'blue', phone:'(12) 99911-1004', createdAt:'11/01/2024' },
  { id:5, name: 'Leandro Silva', email: 'leandro@email.com', status: 'Ativo', initials: 'LS', color: 'mint', phone:'(12) 99999-0000', createdAt:'15/03/2023' },
]
const pendingPayments:PaymentRecord[] = [
  { id:101, memberId:1, name: 'Marina Costa', initials: 'MC', competence: 'Outubro 2026', value: 'R$ 180,00', date: 'Hoje, 09:42', file: 'comprovante_pix.pdf', status:'pending' },
  { id:102, memberId:2, name: 'Rafael Almeida', initials: 'RA', competence: 'Outubro 2026', value: 'R$ 180,00', date: 'Ontem, 18:17', file: 'pix_outubro.png', status:'pending' },
  { id:103, memberId:3, name: 'Camila Nunes', initials: 'CN', competence: 'Outubro 2026', value: 'R$ 180,00', date: 'Ontem, 14:03', file: 'pagamento.pdf', status:'pending' },
]
const initialPosts = [
  { id: 1, title: 'Encontro de associados: uma noite para celebrar', body: 'Confira os registros do nosso último encontro e fique por dentro da programação do clube.', category: 'COMUNIDADE', date: 'Hoje · 10:30', image: '', author: 'Equipe Orion' },
  { id: 2, title: 'Racha de Badminton: inscrições abertas', body: 'Nossa atividade semanal está com inscrições abertas. Garanta sua vaga!', category: 'ESPORTES', date: 'Ontem · 16:15', image: '', author: 'Equipe de atividades' },
  { id: 3, title: 'Novidades na agenda de novembro', body: 'Preparamos novas experiências esportivas e sociais para este mês. Acesse a área de atividades para conferir.', category: 'AVISOS', date: '28 out · 09:00', image: '', author: 'Equipe Orion' },
]


function Avatar({ initials, color = 'mint', size = 'normal' }: { initials: string; color?: string; size?: 'normal' | 'large' }) {
  return <div className={`avatar ${color} ${size === 'large' ? 'avatar-large' : ''}`}>{initials}</div>
}
function Status({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status status-${tone}`}><span />{children}</span>
}
function App() {
  const [role, setRole] = useState<Role>('associado')
  const [tab, setTab] = useState<Tab>('inicio')
  const [joined, setJoined] = useStoredState<Array<number|string>>('joined',[1])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [selectedProofFile, setSelectedProofFile] = useState<File|null>(null)
  const [notice, setNotice] = useState('')
  const [members, setMembers] = useStoredState<Member[]>('members',initialMembers)
  const [payments, setPayments] = useStoredState<PaymentRecord[]>('payments',pendingPayments)
  const [auditLog, setAuditLog] = useStoredState<AuditEntry[]>('audit',[])
  const [search, setSearch] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showAllActivities, setShowAllActivities] = useState(true)
  const [activityModal, setActivityModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<any|null>(null)
  const [newsModal, setNewsModal] = useState(false)
  const [memberModal, setMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<Member|null>(null)
  const [rejectingPayment, setRejectingPayment] = useState<PaymentRecord|null>(null)
  const [calendarDate, setCalendarDate] = useState(()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),1)})
  const [customActivities, setCustomActivities] = useStoredState<any[]>('activities',[])
  const [posts, setPosts] = useStoredState<any[]>('posts',initialPosts)
  const [monthlyFee,setMonthlyFee] = useStoredState<number>('monthlyFee',180)
  const [dueDay,setDueDay] = useStoredState<number>('dueDay',10)
  const [pixKey,setPixKey] = useStoredState<string>('pixKey','')
  const [profile,setProfile] = useStoredState<DemoProfile>('profile',{memberId:5,name:'Leandro Silva',email:'leandro@email.com',phone:'(12) 99999-0000',joinedAt:'15/03/2023'})

  const isAdmin = role !== 'associado'
  const roleLabel = role === 'admin' ? 'Administrador geral' : role === 'financeiro' ? 'Responsável financeiro' : role === 'atividades' ? 'Responsável por atividades' : 'Associado'
  const allActivities = useMemo(() => [...activities,...customActivities], [customActivities])
  const memberActivities = useMemo(() => expandMemberOccurrences(allActivities), [allActivities])
  const filteredMembers = useMemo(() => members.filter(m => `${m.name} ${m.email} ${m.phone}`.toLowerCase().includes(search.toLowerCase())), [members, search])
  function recordAudit(action:string,detail:string){setAuditLog(prev=>[{id:Date.now(),action,detail,date:new Date().toLocaleString('pt-BR'),actor:roleLabel},...prev].slice(0,100))}

  function go(next: Tab) { setTab(next); setMobileMenu(false); setNotice('') }
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }
  function closeUpload(){setUploadOpen(false);setFileName('');setSelectedProofFile(null)}
  function toggleJoin(id: number|string) {
    const activity = memberActivities.find(a => a.id === id) || allActivities.find(a => a.id === id)
    if (!activity) return
    if (joined.includes(id)) {
      setJoined(prev=>prev.filter(x => x !== id)); recordAudit('Inscrição cancelada',activity.title); flash(`Inscrição cancelada: ${activity.title}`)
    } else if (members.find(m=>m.id===profile.memberId)?.status!=='Ativo') {
      flash('Seu cadastro não está ativo. Procure a administração do clube para regularizar o acesso às inscrições.')
    } else if (activity.capacity != null && Number(activity.joined || 0) >= activity.capacity) {
      flash('A atividade está lotada. Não foi possível confirmar a inscrição.')
    } else {
      setJoined(prev=>[...prev,id]); recordAudit('Inscrição realizada',activity.title); flash(`Inscrição confirmada: ${activity.title}`)
    }
  }
  function selectProof(file?:File){
    if(!file)return
    const allowed=['application/pdf','image/jpeg','image/png']
    if(!allowed.includes(file.type)){flash('Formato inválido. Selecione PDF, JPG ou PNG.');return}
    if(file.size>10*1024*1024){flash('O comprovante deve ter até 10 MB.');return}
    setFileName(file.name);setSelectedProofFile(file)
  }
  async function submitProof() {
    if (!fileName || !selectedProofFile) { flash('Selecione um arquivo de comprovante primeiro.'); return }
    const competence=currentCompetenceLabel()
    if(payments.some(p=>(p.memberId===profile.memberId||(!p.memberId&&p.name===profile.name))&&p.competence===competence&&p.status!=='rejected')){flash('Esta competência já possui pagamento aprovado ou comprovante em análise.');return}
    const id=Date.now()
    const record:PaymentRecord={id,memberId:profile.memberId,name:profile.name,initials:profile.name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join(''),competence,value:`R$ ${monthlyFee.toFixed(2).replace('.',',')}`,date:new Date().toLocaleString('pt-BR'),file:fileName,status:'pending'}
    try {
      await saveProofFile(id,selectedProofFile)
      setPayments(prev=>[record,...prev]);recordAudit('Comprovante enviado',`${record.name} · ${record.competence} · ${record.file}`)
      setUploadOpen(false);flash('Comprovante salvo neste navegador e enviado para a fila de validação.');setFileName('');setSelectedProofFile(null)
    } catch (error) {
      flash(error instanceof Error?error.message:'Não foi possível guardar o comprovante. Tente novamente.')
    }
  }
  async function openProof(id:number){
    const popup=window.open('about:blank','_blank')
    try{
      const file=await readProofFile(id)
      if(!file){popup?.close();flash('Este comprovante de exemplo não possui arquivo anexado.');return}
      const url=URL.createObjectURL(file)
      if(popup)popup.location.href=url
      else {const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.click()}
      window.setTimeout(()=>URL.revokeObjectURL(url),60000)
    }catch(error){popup?.close();flash(error instanceof Error?error.message:'Não foi possível abrir o arquivo.')}
  }

  function approvePayment(id:number){const p=payments.find(x=>x.id===id);if(!p)return;setPayments(prev=>prev.map(x=>x.id===id?{...x,status:'approved',reason:undefined}:x));recordAudit('Pagamento aprovado',`${p.name} · ${p.competence} · ${p.value}`);flash(`Pagamento de ${p.name} aprovado.`)}
  function rejectPayment(id:number,reason:string){const p=payments.find(x=>x.id===id);if(!p)return;setPayments(prev=>prev.map(x=>x.id===id?{...x,status:'rejected',reason}:x));recordAudit('Pagamento rejeitado',`${p.name} · ${p.competence} · Motivo: ${reason}`);setRejectingPayment(null);flash(`Pagamento de ${p.name} rejeitado com justificativa.`)}
  function addMember(member:Omit<Member,'id'|'createdAt'>){if(members.some(m=>m.email.toLowerCase()===member.email.toLowerCase())){flash('Já existe um associado cadastrado com este e-mail.');return}const item:Member={...member,id:Date.now(),createdAt:new Date().toLocaleDateString('pt-BR')};setMembers(prev=>[item,...prev]);recordAudit('Associado cadastrado',item.name);setMemberModal(false);flash(`Associado ${item.name} cadastrado.`)}
  function updateMember(member:Omit<Member,'id'|'createdAt'>){if(!editingMember)return;if(members.some(m=>m.id!==editingMember.id&&m.email.toLowerCase()===member.email.toLowerCase())){flash('Outro associado já utiliza este e-mail.');return}setMembers(prev=>prev.map(m=>m.id===editingMember.id?{...m,...member}:m));if(profile.memberId===editingMember.id)setProfile(prev=>({...prev,name:member.name,email:member.email,phone:member.phone}));recordAudit('Cadastro de associado atualizado',member.name);setMemberModal(false);setEditingMember(null);flash(`Cadastro de ${member.name} atualizado.`)}
  function toggleMemberStatus(id:number){const item=members.find(m=>m.id===id);if(!item)return;const status=item.status==='Ativo'?'Inativo':'Ativo';setMembers(prev=>prev.map(m=>m.id===id?{...m,status}:m));recordAudit('Situação de associado alterada',`${item.name}: ${status}`);flash(`${item.name}: cadastro ${status.toLowerCase()}.`)}

  const adminItems = [
    { id: 'inicio' as Tab, label: 'Dashboard', icon: Home },
    { id: 'associados' as Tab, label: 'Associados', icon: Users },
    { id: 'calendario' as Tab, label: 'Calendário', icon: CalendarDays },
    { id: 'conteudo' as Tab, label: 'Notícias e atividades', icon: FileText },
    { id: 'validacao' as Tab, label: 'Financeiro', icon: Wallet },
    { id: 'configuracoes' as Tab, label: 'Configurações', icon: Settings },
  ]
  const navItems = role==='admin' ? adminItems
    : role==='financeiro' ? adminItems.filter(item=>['inicio','validacao'].includes(item.id))
    : role==='atividades' ? adminItems.filter(item=>['inicio','calendario','conteudo'].includes(item.id))
    : [
        { id: 'inicio' as Tab, label: 'Início', icon: Home },
        { id: 'feed' as Tab, label: 'Feed', icon: FileText },
        { id: 'atividades' as Tab, label: 'Atividades', icon: CalendarDays },
        { id: 'financeiro' as Tab, label: 'Financeiro', icon: Wallet },
        { id: 'perfil' as Tab, label: 'Meu perfil', icon: UserRound },
      ]


  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span>O</span><i /></div>
          <div><strong>orion</strong><small>CLUBE</small></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={18}/></button>
        </div>
        <div className="club-switcher">
          <div className="club-symbol">O</div>
          <div className="club-copy"><strong>Clube Orion</strong><span>Área {isAdmin ? 'administrativa' : 'do associado'}</span></div>
          <ChevronDown size={15} className="muted-icon"/>
        </div>
        <div className="nav-label">{isAdmin ? 'ADMINISTRAÇÃO' : 'MENU PRINCIPAL'}</div>
        <nav className="side-nav">
          {navItems.map(item => {
            const Icon = item.icon
            return <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => go(item.id)}><Icon size={18}/><span>{item.label}</span>{item.id === 'validacao' && isAdmin && <b className="nav-count">{payments.filter(p=>p.status==='pending').length}</b>}</button>
          })}
        </nav>
        {!isAdmin && <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={18}/></div><strong>Clube é conexão.</strong><p>Participe das atividades e fique por dentro de tudo.</p><button onClick={() => go('atividades')}>Explorar atividades <ArrowRight size={14}/></button></div>}
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => flash('Central de ajuda: recurso demonstrativo.')}><CircleHelp size={18}/><span>Ajuda e suporte</span></button>
          <div className="side-profile"><Avatar initials={isAdmin ? 'OR' : profile.name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')} color="mint"/><div><strong>{isAdmin ? 'Equipe Orion' : profile.name}</strong><span>{roleLabel}</span></div><MoreHorizontal size={18} className="muted-icon"/></div>
        </div>
      </aside>

      {mobileMenu && <button className="scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={20}/></button>
            <div className="breadcrumb">Clube Orion <span>/</span> <strong>{navItems.find(n => n.id === tab)?.label || 'Meu perfil'}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="role-picker"><span>Visualizar como</span><select value={role} onChange={e => {setRole(e.target.value as Role); setTab('inicio')}} aria-label="Alternar perfil"><option value="associado">Associado</option><option value="admin">Administrador geral</option><option value="financeiro">Responsável financeiro</option><option value="atividades">Responsável por atividades</option></select></label>
            <button className="icon-button notification-button" aria-label="Notificações" onClick={() => flash('Você está em dia com as notificações demonstrativas.')}><Bell size={19}/><i /></button>
            <Avatar initials={isAdmin ? 'OR' : profile.name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')} color={isAdmin ? 'peach' : 'mint'}/>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className="toast"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15}/></button></div>}

          {tab === 'inicio' && !isAdmin && <MemberHome joined={joined} onJoin={toggleJoin} onGo={go} onUpload={() => setUploadOpen(true)} allActivities={memberActivities} posts={posts} profile={profile} monthlyFee={monthlyFee} latestPayment={payments.filter(p=>(p.memberId===profile.memberId||(!p.memberId&&p.name===profile.name))&&p.competence===currentCompetenceLabel()).sort((a,b)=>b.id-a.id)[0]} />}
          {tab === 'inicio' && isAdmin && <AdminHome role={role} onGo={go} activities={allActivities} payments={payments} members={members} joined={joined}/>}
          {tab === 'feed' && !isAdmin && <FeedPage posts={posts}/>}
          {tab === 'atividades' && !isAdmin && <ActivitiesPage activities={memberActivities} joined={joined} onJoin={toggleJoin} showAll={showAllActivities} setShowAll={setShowAllActivities}/>}
          {tab === 'financeiro' && !isAdmin && <FinancePage payments={payments} monthlyFee={monthlyFee} dueDay={dueDay} memberName={profile.name} memberId={profile.memberId} pixKey={pixKey} onUpload={() => setUploadOpen(true)} onViewProof={openProof} />}
          {tab === 'perfil' && !isAdmin && <ProfilePage profile={profile} memberStatus={members.find(m=>m.id===profile.memberId)?.status||'Pendente'} onSave={next=>{const duplicate=members.some(m=>m.id!==(profile.memberId||-1)&&m.email.toLowerCase()===next.email.toLowerCase());if(duplicate){flash('Este e-mail já está cadastrado para outro associado.');return}setProfile(next);if(profile.memberId)setMembers(prev=>prev.map(m=>m.id===profile.memberId?{...m,name:next.name,email:next.email,phone:next.phone,initials:next.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')}:m));recordAudit('Perfil atualizado',next.name);flash('Perfil atualizado nesta demonstração.')}} flash={flash} />}
          {tab === 'associados' && isAdmin && <MembersPage members={filteredMembers} search={search} setSearch={setSearch} onAdd={() => {setEditingMember(null);setMemberModal(true)}} onEdit={member=>{setEditingMember(member);setMemberModal(true)}} onToggleStatus={toggleMemberStatus} />}
          {tab === 'calendario' && isAdmin && <CalendarPage date={calendarDate} setDate={setCalendarDate} activities={allActivities} joined={joined} onCreate={()=>{setEditingActivity(null);setActivityModal(true)}} />}
          {tab === 'conteudo' && isAdmin && <ContentPage onGo={go} onCreateActivity={()=>{setEditingActivity(null);setActivityModal(true)}} onEditActivity={item=>{setEditingActivity(item);setActivityModal(true)}} onCreateNews={()=>setNewsModal(true)} activities={allActivities} posts={posts} joined={joined} onDeleteActivity={id=>{const item=customActivities.find(a=>a.id===id);if(item&&window.confirm(`Remover a atividade “${item.title}” da agenda?`)){setCustomActivities(prev=>prev.filter(a=>a.id!==id));setJoined(prev=>prev.filter(x=>x!==id&&!(typeof x==='string'&&x.startsWith(`${id}@`))));recordAudit('Atividade removida',item.title);flash(`Atividade ${item.title} removida.`)}}} onDeletePost={id=>{const item=posts.find(p=>p.id===id);if(item&&window.confirm(`Remover a publicação “${item.title}” do feed?`)){setPosts(prev=>prev.filter(p=>p.id!==id));recordAudit('Publicação removida',item.title);flash(`Publicação ${item.title} removida do feed.`)}}} />}
          {tab === 'validacao' && isAdmin && <ValidationPage payments={payments} members={members} monthlyFee={monthlyFee} dueDay={dueDay} approve={approvePayment} onReject={p=>setRejectingPayment(p)} role={role} onViewProof={openProof} flash={flash} />}
          {tab === 'configuracoes' && role==='admin' && <SettingsPage flash={flash} monthlyFee={monthlyFee} setMonthlyFee={setMonthlyFee} dueDay={dueDay} setDueDay={setDueDay} pixKey={pixKey} setPixKey={setPixKey} auditLog={auditLog}/>}
          {isAdmin && !navItems.some(item=>item.id===tab) && <div className="info-banner"><div><ShieldCheck size={19}/></div><p>Este perfil não possui acesso a esta área. Selecione uma das opções disponíveis no menu.</p></div>}
        </div>
      </main>

      {activityModal && <ActivityModal activity={editingActivity||undefined} onClose={() => {setActivityModal(false);setEditingActivity(null)}} onSave={(item) => { if(editingActivity){setCustomActivities(prev=>prev.map(a=>a.id===editingActivity.id?item:a));recordAudit('Atividade atualizada',item.title);flash('Atividade atualizada no calendário e na área do associado.')}else{setCustomActivities(prev=>[...prev,item]);recordAudit('Atividade criada',item.title);flash('Atividade cadastrada e disponível no calendário e na área do associado.')}setActivityModal(false);setEditingActivity(null)}}/>}
      {newsModal && <NewsModal onClose={() => setNewsModal(false)} onPublish={(post) => { setPosts(prev=>[{...post, id: Date.now(), date: new Date().toLocaleString('pt-BR'), author: 'Equipe Orion'}, ...prev]); recordAudit('Publicação criada',post.title); setNewsModal(false); flash('Publicação adicionada ao feed do associado.') }}/>}
      {memberModal && <MemberModal member={editingMember||undefined} onClose={()=>{setMemberModal(false);setEditingMember(null)}} onSave={editingMember?updateMember:addMember}/>}
      {rejectingPayment && <RejectPaymentModal payment={rejectingPayment} onClose={()=>setRejectingPayment(null)} onConfirm={reason=>rejectPayment(rejectingPayment.id,reason)}/>}
      {uploadOpen && <div className="modal-backdrop" role="presentation" onClick={closeUpload}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title" onClick={e => e.stopPropagation()}>
          <div className="modal-head"><div className="modal-icon"><Upload size={21}/></div><button className="icon-button" onClick={closeUpload} aria-label="Fechar"><X size={19}/></button></div>
          <h2 id="upload-title">Enviar comprovante</h2>
          <p className="modal-description">Anexe o comprovante da competência atual. A equipe financeira fará a validação.</p>
          <div className="form-field"><label>Mensalidade</label><div className="select-static">{currentCompetenceLabel()} <span>{`R$ ${monthlyFee.toFixed(2).replace('.',',')}`}</span></div></div>
          <div className="form-field"><label>Arquivo do comprovante</label><label className="dropzone"><input type="file" accept=".pdf,image/png,image/jpeg" onChange={e => selectProof(e.target.files?.[0])}/>{fileName ? <><FileCheck2 size={24}/><strong>{fileName}</strong><span>Clique para escolher outro arquivo</span></> : <><div className="upload-cloud"><Upload size={21}/></div><strong>Escolher arquivo</strong><span>PDF, JPG ou PNG · até 10 MB</span></>}</label></div>
          <div className="secure-note"><ShieldCheck size={16}/><span>Na versão conectada, o comprovante será privado e acessível somente ao associado e à equipe financeira.</span></div>
          <div className="modal-actions"><button className="button-secondary" onClick={closeUpload}>Cancelar</button><button className="button-primary" onClick={()=>void submitProof()} disabled={!selectedProofFile}>Enviar para validação <ArrowRight size={16}/></button></div>
          <p className="demo-warning">O arquivo fica neste navegador (IndexedDB) nesta demonstração. Na produção será enviado ao Storage privado do Supabase.</p>
        </section>
      </div>}

      <div className="mobile-bottom-nav">
        {navItems.slice(0,4).map(item => {const Icon = item.icon; return <button key={item.id} className={tab===item.id?'active':''} onClick={()=>go(item.id)}><Icon size={20}/><span>{item.label}</span></button>})}
      </div>
    </div>
  )
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: React.ReactNode; description?: string; action?: React.ReactNode }) {
  return <div className="page-title-row"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-title-action">{action}</div>}</div>
}
function SectionHeading({ title, link, onClick }: { title: string; link?: string; onClick?: () => void }) {
  return <div className="section-heading"><h2>{title}</h2>{link && <button onClick={onClick}>{link}<ArrowRight size={15}/></button>}</div>
}
function MemberHome({ joined, onJoin, onGo, onUpload, allActivities, posts, profile, monthlyFee, latestPayment }: { joined: Array<number|string>; onJoin: (id:number|string)=>void; onGo:(tab:Tab)=>void; onUpload:()=>void; allActivities:any[]; posts:any[]; profile:DemoProfile; monthlyFee:number; latestPayment?:PaymentRecord }) {
  const today=localDateISO()
  const upcoming=[...allActivities].filter(a=>String(a.startDate||'')>=today).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))
  const next=upcoming[0]
  const nextDate=next?new Date(`${next.startDate}T12:00:00`):null
  const firstName=profile.name.trim().split(/\s+/)[0]||'associado'
  const moneyStatus=latestPayment?.status==='pending'?'Em análise':latestPayment?.status==='rejected'?'Com pendência':latestPayment?.status==='approved'?'Pago':'Sem envio recente'
  return <>
    <PageTitle eyebrow={new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date()).toUpperCase()} title={<>Bom te ver por aqui, <span>{firstName}!</span></>} description="Seu clube, suas pessoas, seus momentos." action={<button className="button-secondary desktop-only" onClick={() => onGo('perfil')}><UserRound size={16}/> Meu perfil</button>}/>
    <div className="hero-banner">
      <div className="hero-content"><div className="hero-pill"><Sparkles size={13}/> VIDA DE CLUBE</div><h2>Mais momentos.<br/><em>Mais Orion.</em></h2><p>Uma comunidade fica mais forte quando a gente participa.</p><button className="hero-button" onClick={() => onGo('atividades')}>Descobrir atividades <ArrowRight size={16}/></button></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-sun"/><div className="hero-figure figure-one"/><div className="hero-figure figure-two"/><div className="hero-ball"/></div>
      <div className="hero-number">01 <span>/ 03</span></div>
    </div>
    <div className="member-summary-grid">
      <div className="summary-card"><div className="summary-icon mint-icon"><Wallet size={18}/></div><span>Mensalidade</span><strong>{`R$ ${monthlyFee.toFixed(2).replace('.',',')}`}</strong><small className={latestPayment?.status==='rejected'?'payment-reason':'summary-good'}>{moneyStatus}</small></div>
      <div className="summary-card"><div className="summary-icon lilac-icon"><CalendarDays size={18}/></div><span>Minhas atividades</span><strong>{joined.length.toString().padStart(2,'0')}</strong><small>Inscrições confirmadas</small></div>
      <div className="summary-card"><div className="summary-icon peach-icon"><Bell size={18}/></div><span>Novidades</span><strong>{posts.length.toString().padStart(2,'0')}</strong><small>Comunicados recentes</small></div>
    </div>
    <div className="content-grid">
      <section className="content-main">
        <SectionHeading title="Vem aí no Orion" link="Ver todas" onClick={() => onGo('atividades')}/>
        <div className="activity-list">
          {upcoming.slice(0,2).map(a => <ActivityCard key={a.id} activity={a} joined={joined.includes(a.id)} onJoin={() => onJoin(a.id)}/>)}
        </div>
        <SectionHeading title="Do clube para você" link="Ver notícias" onClick={() => onGo('feed')}/>
        <article className="news-card"><div className="news-visual"><div className="news-sun"/><div className="news-hill hill-a"/><div className="news-hill hill-b"/><span>ORION<br/>EM MOVIMENTO</span></div><div className="news-body"><span className="news-tag">{posts[0]?.category || 'COMUNIDADE'}</span><h3>{posts[0]?.title || 'O melhor do clube acontece quando você participa.'}</h3><p>{posts[0]?.body || 'Confira as próximas atividades e convide a turma para estar junto.'}</p><button onClick={() => onGo('feed')}>Ver no feed <ArrowRight size={15}/></button></div></article>
      </section>
      <aside className="content-aside">
        <div className="side-card next-event"><div className="side-card-top"><span className="eyebrow">SUA PRÓXIMA ATIVIDADE</span><span className="event-dot"/></div>{next&&nextDate?<><div className="date-tile"><strong>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit'}).format(nextDate)}</strong><span>{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(nextDate).replace('.','').toUpperCase()}</span></div><h3>{next.title}</h3><div className="event-detail"><Clock3 size={15}/> {new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(nextDate)} · {next.time}</div><div className="event-detail"><Activity size={15}/> {next.place||'Clube Orion'}</div></>:<><div className="date-tile"><strong>—</strong><span>—</span></div><h3>Sem atividade agendada</h3><p>Novas atividades aparecerão aqui quando forem publicadas.</p></>}<button className="button-primary full-button" onClick={() => onGo('atividades')}>Ver atividades <ArrowRight size={15}/></button></div>
        <div className="instagram-card"><div className="insta-icon"><Instagram size={19}/></div><div><strong>Segue o Orion</strong><p>Acompanhe as novidades no Instagram.</p><button onClick={() => window.open('https://crorion.com.br/', '_blank', 'noopener,noreferrer')}>Site oficial <ArrowRight size={14}/></button></div></div>
      </aside>
    </div>
  </>
}
function ActivityCard({ activity, joined, onJoin }: { activity:any; joined:boolean; onJoin:()=>void }) {
  const capacity = activity.noLimit ? null : activity.capacity
  const enrolled = Number(activity.joined || 0) + (joined ? 1 : 0)
  const pct = capacity ? Math.min(100, Math.round(enrolled/capacity*100)) : 0
  const remaining = capacity == null ? null : Math.max(0,capacity-enrolled)
  return <article className="activity-card">
    <div className={`activity-illustration ${activity.color || 'mint'}`}><div className="illustration-ring"/><Dumbbell size={31}/><span>{(activity.category || 'CLUBE').toUpperCase()}</span></div>
    <div className="activity-card-content">
      <div className="activity-meta"><span>{activity.date || activity.startDate}</span><span className="meta-dot"/> <span>{activity.time}</span></div>
      <h3>{activity.title}</h3><p>{activity.place || 'Clube Orion'}</p>
      {activity.description && <p className="activity-description">{activity.description}</p>}
      <div className="capacity"><div className="capacity-bar"><span style={{width:`${pct}%`}}/></div><small>{capacity == null ? `${enrolled} inscritos · sem limite` : `${remaining} vagas restantes`}</small></div>
      <button className={joined?'button-joined':'button-outline'} onClick={onJoin}>{joined ? <><Check size={15}/> Cancelar inscrição</> : <>Quero participar <ArrowRight size={15}/></>}</button>
    </div>
  </article>
}
function ActivitiesPage({ activities:allActivities, joined, onJoin, showAll, setShowAll }: { activities:any[]; joined:Array<number|string>; onJoin:(id:number|string)=>void; showAll:boolean; setShowAll:(v:boolean)=>void }) {
  const ordered = [...allActivities].sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||'')))
  const visible = showAll ? ordered : ordered.filter(a=>!joined.includes(a.id) && (a.capacity==null || a.joined<a.capacity))
  return <>
    <PageTitle eyebrow="AGENDA DO CLUBE" title="Atividades" description="Encontre sua próxima experiência no Orion." action={<button className="button-secondary" onClick={()=>setShowAll(!showAll)}><CalendarDays size={16}/> {showAll?'Mostrar disponíveis':'Mostrar todas'}</button>}/>
    <div className="filter-row"><span className="filter-chip active">{showAll?'Todas as atividades':'Disponíveis para inscrição'}</span><div className="filter-spacer"/><span className="results-count">{visible.length} atividades encontradas</span></div>
    {visible.length ? <div className="activities-grid">{visible.map(a=><ActivityCard key={a.id} activity={a} joined={joined.includes(a.id)} onJoin={()=>onJoin(a.id)}/>)}</div> : <div className="panel empty-state"><h3>Você está inscrito em todas as atividades exibidas.</h3><p>Use “Mostrar todas” para consultar suas inscrições.</p></div>}
    <div className="info-banner"><div><ShieldCheck size={19}/></div><p><strong>Inscrições transparentes.</strong> A disponibilidade de vagas é apresentada em cada atividade. Neste protótipo, a contagem é demonstrativa e não substitui a validação transacional do servidor.</p></div>
  </>
}
function FinancePage({ onUpload, payments, monthlyFee, dueDay, memberName, memberId, pixKey, onViewProof }: { onUpload:()=>void; payments:PaymentRecord[]; monthlyFee:number; dueDay:number; memberName:string; memberId?:number; pixKey:string; onViewProof:(id:number)=>void }) {
  const mine=payments.filter(p=>memberId?(p.memberId===memberId||(!p.memberId&&p.name===memberName)):p.name===memberName).sort((a,b)=>b.id-a.id)
  const latest=mine[0]
  const currentMonth=currentCompetenceLabel()
  const currentPayment=mine.find(p=>p.competence===currentMonth)
  const dueAt=new Date(new Date().getFullYear(),new Date().getMonth(),dueDay)
  const isOverdue=new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())>dueAt
  const statusLabel=currentPayment?.status==='pending'?'Em análise':currentPayment?.status==='rejected'?'Com pendência':currentPayment?.status==='approved'?'Pago':isOverdue?'Em atraso':'Em aberto'
  const statusTone=currentPayment?.status==='rejected'||(!currentPayment&&isOverdue)?'red':currentPayment?.status==='pending'||!currentPayment?'amber':'green'
  const currentValue=`R$ ${monthlyFee.toFixed(2).replace('.',',')}`
  const dueDate=new Date(new Date().getFullYear(),new Date().getMonth(),dueDay).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})
  return <>
    <PageTitle eyebrow="ÁREA DO ASSOCIADO" title="Meu financeiro" description="Acompanhe suas mensalidades e comprovantes." action={<button className="button-primary" onClick={onUpload}><Upload size={16}/> Enviar comprovante</button>}/>
    <div className="finance-overview"><div className="finance-main-card"><div className="finance-card-top"><span>STATUS DA MENSALIDADE</span><Status tone={statusTone}>{statusLabel}</Status></div><div className="finance-amount">{currentValue}</div><p>Mensalidade de {currentMonth}</p><div className="finance-divider"/><div className="finance-details"><div><span>Vencimento</span><strong>{dueDate}</strong></div><div><span>Último envio</span><strong>{latest?.date || 'Nenhum comprovante'}</strong></div></div>{currentPayment?.status==='rejected'&&<p className="payment-reason"><strong>Motivo da rejeição:</strong> {currentPayment.reason}</p>}</div><div className="finance-help-card"><div className="help-icon"><FileCheck2 size={20}/></div><h3>Pagou por PIX ou transferência?</h3><p>Envie o comprovante por aqui. Nossa equipe financeira fará a conferência e atualizará o status.</p>{pixKey&&<div className="pix-key-box"><span>CHAVE PIX DO CLUBE</span><strong>{pixKey}</strong><button type="button" onClick={()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(pixKey).then(()=>window.alert('Chave PIX copiada.')).catch(()=>window.alert('Não foi possível copiar a chave.'));else window.alert('Selecione a chave PIX para copiá-la.')}}>Copiar chave PIX</button></div>}<button className="button-outline" onClick={onUpload}>Anexar comprovante <ArrowRight size={15}/></button></div></div>
    <section className="table-section"><SectionHeading title="Histórico de comprovantes"/><div className="responsive-table"><table><thead><tr><th>COMPETÊNCIA</th><th>DATA DO ENVIO</th><th>VALOR</th><th>ARQUIVO</th><th>STATUS</th></tr></thead><tbody>{mine.length ? mine.map(p=><tr key={p.id}><td><strong>{p.competence}</strong></td><td>{p.date}</td><td>{p.value}</td><td><button className="text-action" type="button" onClick={()=>onViewProof(p.id)}>{p.file}</button></td><td><Status tone={p.status==='approved'?'green':p.status==='rejected'?'red':'amber'}>{p.status==='approved'?'Aprovado':p.status==='rejected'?'Rejeitado':'Em análise'}</Status></td></tr>) : <tr><td colSpan={5}>Nenhum comprovante enviado nesta demonstração.</td></tr>}</tbody></table></div></section>
    <div className="info-banner"><div><ShieldCheck size={19}/></div><p><strong>Privacidade financeira.</strong> No produto final, comprovantes devem ficar em armazenamento privado, com acesso restrito ao associado e à equipe financeira. Nesta demonstração, o arquivo permanece no IndexedDB local deste navegador.</p></div>
  </>
}
function ProfilePage({ profile, memberStatus, onSave, flash }: { profile:DemoProfile; memberStatus:Member['status']; onSave:(p:DemoProfile)=>void; flash:(m:string)=>void }) {
  const [draft,setDraft]=useState(profile)
  useEffect(()=>setDraft(profile),[profile])
  return <><PageTitle eyebrow="MINHA CONTA" title="Meu perfil" description="Revise seus dados de contato e mantenha seu cadastro atualizado."/><div className="profile-layout"><section className="profile-card"><div className="profile-cover"/><div className="profile-avatar-row"><Avatar initials={draft.name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')} color="mint" size="large"/><button className="button-secondary small-button" onClick={()=>flash('Foto de perfil será habilitada com o armazenamento seguro no Supabase.')}><ImageIcon size={15}/> Alterar foto</button></div><h2>{draft.name}</h2><p className="profile-subtitle">Associado desde {draft.joinedAt}</p><Status tone={memberStatus==='Ativo'?'green':memberStatus==='Pendente'?'amber':'red'}>{memberStatus==='Ativo'?'Cadastro ativo':memberStatus==='Pendente'?'Cadastro pendente':'Cadastro inativo'}</Status><div className="profile-stats"><div><strong>—</strong><span>Atividades</span></div><div><strong>—</strong><span>De clube</span></div><div><strong>—</strong><span>Financeiro</span></div></div></section><section className="profile-form-card"><h3>Informações pessoais</h3><p>Algumas alterações poderão precisar de validação da administração.</p><div className="form-grid"><div className="form-field"><label>Nome completo</label><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></div><div className="form-field"><label>E-mail</label><input value={draft.email} type="email" onChange={e=>setDraft({...draft,email:e.target.value})}/></div><div className="form-field"><label>Telefone</label><input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></div><div className="form-field"><label>Data de entrada</label><input value={draft.joinedAt} disabled/></div></div><div className="form-footer"><span><ShieldCheck size={15}/> Seus dados ficam neste navegador de demonstração.</span><button className="button-primary" disabled={!draft.name.trim()||!/^\S+@\S+\.\S+$/.test(draft.email)} onClick={()=>onSave(draft)}>Salvar alterações</button></div></section></div></>
}
function AdminHome({ role, onGo, activities:allActivities, payments, members, joined }: { role:Role; onGo:(tab:Tab)=>void; activities:any[]; payments:PaymentRecord[]; members:Member[]; joined:Array<number|string> }) {
  const canFinance=role==='admin'||role==='financeiro'
  const canActivities=role==='admin'||role==='atividades'
  const pending=payments.filter(p=>p.status==='pending')
  const approved=payments.filter(p=>p.status==='approved')
  const activeMembers=members.filter(m=>m.status==='Ativo').length
  const upcoming=allActivities.filter(a=>String(a.startDate||'')>=localDateISO()).length
  const quickAction=canActivities?{label:'Nova atividade',tab:'conteudo' as Tab,icon:<Plus size={16}/>}:{label:'Ver pagamentos',tab:'validacao' as Tab,icon:<Wallet size={16}/>}
  return <>
    <PageTitle eyebrow="VISÃO GERAL" title="Olá, equipe Orion." description="Veja o que está acontecendo no clube hoje." action={<button className="button-primary" onClick={()=>onGo(quickAction.tab)}>{quickAction.icon} {quickAction.label}</button>}/>
    <div className="admin-metric-grid">
      {role!=='financeiro'&&<Metric icon={<Users size={18}/>} label="Associados ativos" value={String(activeMembers)} delta="Cadastros ativos na demonstração" color="mint"/>}
      {canFinance&&<Metric icon={<Wallet size={18}/>} label="Pagamentos aprovados" value={String(approved.length)} delta="Histórico desta demonstração" color="lilac"/>}
      {canFinance&&<Metric icon={<FileCheck2 size={18}/>} label="Pagamentos pendentes" value={String(pending.length).padStart(2,'0')} delta="Precisam de análise" color="peach"/>}
      {canActivities&&<Metric icon={<CalendarDays size={18}/>} label="Atividades cadastradas" value={String(allActivities.length).padStart(2,'0')} delta={`${upcoming} com data a partir de hoje`} color="blue"/>}
    </div>
    <div className="admin-grid">
      {canFinance&&<section className="panel"><div className="panel-heading"><div><h2>Validações financeiras</h2><p>Comprovantes aguardando análise</p></div><button className="text-action" onClick={()=>onGo('validacao')}>Ver fila <ArrowRight size={15}/></button></div>{pending.slice(0,4).map(p=><div className="pending-row" key={p.id}><Avatar initials={p.initials} color="mint"/><div className="pending-person"><strong>{p.name}</strong><span>{p.competence} · {p.date}</span></div><div className="pending-value"><strong>{p.value}</strong><span>Em análise</span></div><button className="icon-button" onClick={()=>onGo('validacao')} aria-label="Analisar pagamento"><ArrowRight size={17}/></button></div>)}{pending.length===0&&<p className="empty-note">Nenhum comprovante pendente.</p>}<button className="panel-bottom-action" onClick={()=>onGo('validacao')}>Ver todos os comprovantes <ArrowRight size={15}/></button></section>}
      {canActivities&&<section className="panel"><div className="panel-heading"><div><h2>Agenda do clube</h2><p>Atividades cadastradas</p></div><button className="text-action" onClick={()=>onGo('calendario')}>Calendário <ArrowRight size={15}/></button></div>{allActivities.slice(0,5).map(a=><div className="agenda-row" key={a.id}><div className={`agenda-date ${a.color||'mint'}`}><strong>{a.startDate?.slice(8,10)||'—'}</strong><span>{a.startDate?.slice(5,7)||'—'}</span></div><div className="agenda-copy"><strong>{a.title}</strong><span>{a.time} · {a.place}</span><div className="mini-progress"><span style={{width:`${a.capacity?Math.min(100,Math.round(activitySignupCount(a,joined)/a.capacity*100)):0}%`}}/></div></div><span className="agenda-count">{activitySignupCount(a,joined)}/{a.noLimit?'∞':a.capacity}</span></div>)}</section>}
    </div>
    <div className="admin-footer-note"><ShieldCheck size={17}/><span>Indicadores calculados a partir dos dados locais da demonstração. Não representam dados oficiais do clube.</span></div>
  </>
}
function Metric({ icon, label, value, delta, color }: { icon:React.ReactNode; label:string; value:string; delta:string; color:string }) {
  return <div className="metric-card"><div className={`metric-icon ${color}`}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{delta}</small></div>
}
function MembersPage({ members, search, setSearch, onAdd, onEdit, onToggleStatus }: { members:Member[]; search:string; setSearch:(s:string)=>void; onAdd:()=>void; onEdit:(member:Member)=>void; onToggleStatus:(id:number)=>void }) {
  return <><PageTitle eyebrow="GESTÃO DE PESSOAS" title="Associados" description="Cadastre, pesquise e acompanhe a situação dos membros." action={<button className="button-primary" onClick={onAdd}><Plus size={16}/> Novo associado</button>}/><div className="list-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone..."/></label><span className="results-count">{members.length} associados</span></div><div className="table-section"><div className="responsive-table"><table><thead><tr><th>ASSOCIADO</th><th>CONTATO</th><th>SITUAÇÃO</th><th>CADASTRO</th><th>AÇÃO</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td><div className="member-cell"><Avatar initials={m.initials} color={m.color}/><div><strong>{m.name}</strong><span>{m.email}</span></div></div></td><td>{m.phone||'—'}</td><td><Status tone={m.status==='Ativo'?'green':m.status==='Pendente'?'amber':'red'}>{m.status}</Status></td><td>{m.createdAt}</td><td><div className="member-actions"><button className="button-secondary small-button" onClick={()=>onEdit(m)}>Editar</button><button className="button-secondary small-button" onClick={()=>onToggleStatus(m.id)}>{m.status==='Ativo'?'Desativar':'Ativar'}</button></div></td></tr>)}</tbody></table></div></div><div className="admin-footer-note"><ShieldCheck size={17}/><span>Cadastro e status ficam salvos neste navegador. Na versão real, alterações exigirão autenticação, autorização por papel e trilha de auditoria no servidor.</span></div></>
}
function ContentPage({ onGo, onCreateActivity, onEditActivity, onCreateNews, activities:allActivities, posts, joined, onDeleteActivity, onDeletePost }: { onGo:(tab:Tab)=>void; onCreateActivity:()=>void; onEditActivity:(a:any)=>void; onCreateNews:()=>void; activities:any[]; posts:any[]; joined:Array<number|string>; onDeleteActivity:(id:number)=>void; onDeletePost:(id:number)=>void }) {
  const recurrenceLabel=(a:any)=>a.kind!=='recurring'?'Atividade única':a.recurrence==='daily'?'Recorrência diária':a.recurrence==='weekly'?`A cada ${a.interval||1} semana(s)`:a.recurrence==='biweekly'?`A cada ${2*(a.interval||1)} semana(s)`:`A cada ${a.interval||1} mês(es)`
  return <>
    <PageTitle eyebrow="PROGRAMAÇÃO DO CLUBE" title="Notícias e atividades" description="Organize a agenda, publique comunicados e mantenha o feed atualizado." action={<button className="button-primary" onClick={onCreateNews}><Plus size={16}/> Nova publicação</button>}/>
    <div className="content-admin-grid"><div className="create-card"><div className="create-icon mint-icon"><CalendarDays size={21}/></div><h3>Nova atividade</h3><p>Crie uma atividade única ou recorrente, defina capacidade de vagas e abra inscrições para os associados.</p><button className="button-outline" onClick={onCreateActivity}>Cadastrar atividade <ArrowRight size={15}/></button></div><div className="create-card"><div className="create-icon lilac-icon"><FileText size={21}/></div><h3>Nova notícia</h3><p>Publique comunicados, novidades, eventos e artes de divulgação no feed dos associados.</p><button className="button-outline" onClick={onCreateNews}>Criar publicação <ArrowRight size={15}/></button></div></div>
    <section className="panel schedule-panel"><div className="panel-heading"><div><h2>Atividades programadas</h2><p>Séries e atividades únicas cadastradas</p></div><button className="text-action" onClick={()=>onGo('calendario')}>Ver calendário <ArrowRight size={15}/></button></div>{allActivities.map((a:any)=><div className="admin-activity-row" key={a.id}><div className={`agenda-date ${a.color||'mint'}`}><CalendarDays size={18}/></div><div className="agenda-copy"><strong>{a.title}</strong><span>{a.date||a.startDate} · {a.time} · {a.place||'Clube Orion'} · {recurrenceLabel(a)}</span></div><div className="activity-admin-capacity"><Status>{a.noLimit?'Sem limite':`${a.capacity} vagas`}</Status><small>{activitySignupCount(a,joined)} inscrito(s) no próximo encontro</small></div>{a.isCustom&&<div className="member-actions"><button className="button-secondary small-button" onClick={()=>onEditActivity(a)}>Editar</button><button className="icon-button" aria-label={`Remover ${a.title}`} onClick={()=>onDeleteActivity(a.id)}><X size={17}/></button></div>}</div>)}</section>
    <section className="panel schedule-panel"><div className="panel-heading"><div><h2>Publicações recentes</h2><p>O que os associados veem no feed</p></div><button className="text-action" onClick={()=>onGo('inicio')}>Painel <ArrowRight size={15}/></button></div>{posts.length?posts.slice(0,10).map((p:any)=><div className="admin-activity-row" key={p.id}><div className="agenda-date lavender"><FileText size={18}/></div><div className="agenda-copy"><strong>{p.title}</strong><span>{p.date} · {p.category}</span></div><button className="icon-button" aria-label={`Excluir publicação ${p.title}`} onClick={()=>onDeletePost(p.id)}><X size={17}/></button></div>):<p className="empty-note">Nenhuma publicação cadastrada.</p>}</section>
    <div className="admin-footer-note"><AlertCircle size={17}/><span>Atividades, publicações e imagens ficam salvas neste navegador. O armazenamento compartilhado e seguro entre dispositivos depende da integração com Supabase.</span></div>
  </>
}

function CalendarPage({ date, setDate, activities: allActivities, joined, onCreate }: { date:Date; setDate:(d:Date)=>void; activities:any[]; joined:Array<number|string>; onCreate:()=>void }) {
  const year=date.getFullYear(), month=date.getMonth()
  const first=new Date(year,month,1), offset=(first.getDay()+6)%7, days=new Date(year,month+1,0).getDate()
  const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i-offset+1)
  const monthLabel=date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
  const entries = allActivities.flatMap((a:any) => {
    if (!a.startDate || a.kind !== 'recurring') { const d=a.startDate ? new Date(`${a.startDate}T12:00:00`) : new Date(year,month,3); return d.getFullYear()===year&&d.getMonth()===month ? [{...a, day:d.getDate(), occurrenceId:a.id}] : [] }
    const start = new Date(`${a.startDate}T12:00:00`)
    const until = a.endDate ? new Date(`${a.endDate}T12:00:00`) : new Date(year, month + 1, 0)
    const out:any[] = []
    for (let d = new Date(year, month, 1, 12); d.getMonth() === month; d.setDate(d.getDate()+1)) {
      if (d < start || d > until) continue
      const diffDays = Math.floor((d.getTime()-start.getTime())/86400000)
      const diffMonths = (d.getFullYear()-start.getFullYear())*12 + d.getMonth()-start.getMonth()
      const every = Math.max(1, Number(a.interval)||1)
      const matches = a.recurrence === 'daily' ? diffDays % every === 0
        : a.recurrence === 'weekly' ? diffDays % (7*every) === 0
        : a.recurrence === 'biweekly' ? diffDays % (14*every) === 0
        : a.recurrence === 'monthly' ? d.getDate() === Math.min(start.getDate(),new Date(year,month+1,0).getDate()) && diffMonths % every === 0
        : false
      if (matches) out.push({...a, day:d.getDate(), occurrenceId:`${a.id}@${localDateISO(d)}`})
    }
    return out
  })
  return <><PageTitle eyebrow="PLANEJAMENTO DO CLUBE" title="Calendário de atividades" description="Visualize a programação mensal e organize os próximos encontros." action={<button className="button-primary" onClick={onCreate}><Plus size={16}/> Nova atividade</button>}/><section className="calendar-panel"><div className="calendar-toolbar"><div><span className="eyebrow">AGENDA MENSAL</span><h2>{monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1)}</h2></div><div className="calendar-controls"><button className="button-secondary" onClick={()=>setDate(new Date(year,month-1,1))}>‹</button><button className="button-secondary" onClick={()=>{const now=new Date();setDate(new Date(now.getFullYear(),now.getMonth(),1))}}>Hoje</button><button className="button-secondary" onClick={()=>setDate(new Date(year,month+1,1))}>›</button></div></div><div className="calendar-grid calendar-weekdays">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><div key={d}>{d}</div>)}</div><div className="calendar-grid">{cells.map((day,i)=>{const valid=day>0&&day<=days; const dayEvents=valid?entries.filter((a:any)=>a.day===day):[];return <div key={i} className={`calendar-cell ${valid?'':'outside'}`}><span className="calendar-day">{valid?day:''}</span>{dayEvents.map((a:any,j)=><div className={`calendar-event ${j%2?'event-purple':''}`} key={`${a.id}-${j}`} title={a.title}>{a.title}</div>)}</div>})}</div><div className="calendar-legend"><span><i/> Atividade do clube</span><span><i className="purple-dot"/> Outra atividade</span></div></section><section className="panel calendar-upcoming"><div className="panel-heading"><div><h2>Programação cadastrada</h2><p>Atividades demonstrativas e cadastradas nesta sessão</p></div></div>{allActivities.map((a:any)=><div className="admin-activity-row" key={a.id}><div className="agenda-date mint"><CalendarDays size={18}/></div><div className="agenda-copy"><strong>{a.title}</strong><span>{a.date || a.startDate} · {a.time || a.startTime} · {a.place || 'Clube Orion'}</span></div><div className="activity-admin-capacity"><Status>{a.noLimit?'Sem limite':`${a.capacity} vagas`}</Status><small>{joined.includes(a.kind==='recurring'?expandMemberOccurrences([a],new Date(),180)[0]?.id:a.id)?'Você está inscrito neste encontro':'Sem inscrição deste perfil'}</small></div></div>)}</section></>
}
function MemberModal({onClose,onSave,member}:{onClose:()=>void;onSave:(m:Omit<Member,'id'|'createdAt'>)=>void;member?:Member}){
  const [name,setName]=useState(member?.name||''),[email,setEmail]=useState(member?.email||''),[phone,setPhone]=useState(member?.phone||''),[status,setStatus]=useState<'Ativo'|'Pendente'|'Inativo'>(member?.status||'Pendente')
  const initials=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'NO'
  return <div className="modal-backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><div className="modal-head"><div className="modal-icon"><Users size={21}/></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div><h2>{member?'Editar associado':'Novo associado'}</h2><p className="modal-description">{member?'Atualize os dados cadastrais deste membro.':'Cadastre os dados básicos do membro no ambiente de demonstração.'}</p><div className="form-field"><label>Nome completo *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do associado"/></div><div className="form-field"><label>E-mail *</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@email.com"/></div><div className="form-field"><label>Telefone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(12) 99999-9999"/></div><div className="form-field"><label>Situação inicial</label><select value={status} onChange={e=>setStatus(e.target.value as 'Ativo'|'Pendente'|'Inativo')}><option value="Pendente">Pendente</option><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select></div><div className="modal-actions"><button className="button-secondary" onClick={onClose}>Cancelar</button><button className="button-primary" disabled={!name.trim()||!/^\S+@\S+\.\S+$/.test(email)} onClick={()=>onSave({name:name.trim(),email:email.trim(),phone,status,initials,color:member?.color||'mint'})}>{member?'Salvar alterações':'Cadastrar associado'} <ArrowRight size={16}/></button></div><p className="demo-warning">Alterações ficam somente neste navegador; convites e contas de acesso não são criados.</p></section></div>
}
function RejectPaymentModal({payment,onClose,onConfirm}:{payment:PaymentRecord;onClose:()=>void;onConfirm:(reason:string)=>void}){
  const [reason,setReason]=useState('')
  return <div className="modal-backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><div className="modal-head"><div className="modal-icon"><AlertCircle size={21}/></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div><h2>Rejeitar comprovante</h2><p className="modal-description">Informe uma justificativa clara para que o associado possa corrigir o envio.</p><div className="select-static">{payment.name} · {payment.competence} · {payment.value}</div><div className="form-field"><label>Motivo da rejeição *</label><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: comprovante ilegível ou valor divergente..."/></div><div className="modal-actions"><button className="button-secondary" onClick={onClose}>Cancelar</button><button className="button-primary" disabled={reason.trim().length<5} onClick={()=>onConfirm(reason.trim())}>Confirmar rejeição <ArrowRight size={16}/></button></div></section></div>
}

function ActivityModal({ onClose, onSave, activity }: { onClose:()=>void; onSave:(item:any)=>void; activity?:any }) {
  const [title,setTitle]=useState(activity?.title||'')
  const [description,setDescription]=useState(activity?.description||'')
  const [category,setCategory]=useState(activity?.category||'Social')
  const [kind,setKind]=useState(activity?.kind||'single')
  const [date,setDate]=useState(activity?.startDate||(()=>{const d=new Date();d.setDate(d.getDate()+3);return localDateISO(d)})())
  const [time,setTime]=useState(activity?.time||'19:00')
  const [place,setPlace]=useState(activity?.place||'Clube Orion')
  const [recurrence,setRecurrence]=useState(activity?.recurrence||'weekly')
  const [interval,setInterval]=useState(String(activity?.interval||1))
  const [endDate,setEndDate]=useState(activity?.endDate||(()=>{const d=new Date();d.setDate(d.getDate()+90);return localDateISO(d)})())
  const [noLimit,setNoLimit]=useState(Boolean(activity?.noLimit))
  const [capacity,setCapacity]=useState(String(activity?.capacity??16))
  function save(){
    if(!title.trim()||!date||!time||Number(interval)<1||(!noLimit&&(!capacity||Number(capacity)<1))||(kind==='recurring'&&endDate<date))return
    onSave({id:activity?.id||Date.now(),title:title.trim(),description,category,kind,isCustom:true,date:kind==='single'?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):`A partir de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')}`,startDate:date,day:Number(date.slice(8,10)),time,place,recurrence,interval:Number(interval),endDate,noLimit,capacity:noLimit?null:Number(capacity),joined:activity?.joined||0,color:activity?.color||'mint'})
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="modal activity-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><div className="modal-head"><div className="modal-icon"><CalendarDays size={21}/></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div><h2>{activity?'Editar atividade':'Criar atividade'}</h2><p className="modal-description">Configure os detalhes, a programação e a capacidade de participantes.</p>
    <div className="form-field"><label>Nome da atividade *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Racha de Badminton"/></div>
    <div className="form-field"><label>Descrição</label><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Conte um pouco sobre a atividade..."/></div>
    <div className="form-field"><label>Categoria</label><select value={category} onChange={e=>setCategory(e.target.value)}><option>Social</option><option>Esporte</option><option>Bem-estar</option><option>Cultural</option><option>Comunitária</option></select></div>
    <div className="form-field"><label>Tipo de atividade</label><div className="choice-row"><button className={kind==='single'?'selected':''} onClick={()=>setKind('single')}>Esporádica</button><button className={kind==='recurring'?'selected':''} onClick={()=>setKind('recurring')}>Recorrente</button></div></div>
    <div className="form-grid"><div className="form-field"><label>{kind==='single'?'Data':'Data de início'} *</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="form-field"><label>Horário *</label><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></div></div>
    {kind==='recurring'&&<div className="recurrence-box"><div className="form-grid"><div className="form-field"><label>Repetir</label><select value={recurrence} onChange={e=>setRecurrence(e.target.value)}><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option><option value="biweekly">A cada 2 semanas</option><option value="monthly">Todo mês</option></select></div><div className="form-field"><label>Intervalo</label><input type="number" min="1" step="1" value={interval} onChange={e=>setInterval(e.target.value)}/></div></div><div className="form-field"><label>Repetir até</label><input type="date" value={endDate} min={date} onChange={e=>setEndDate(e.target.value)}/></div></div>}
    <div className="form-field"><label>Local</label><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="Local da atividade"/></div>
    <div className="form-field"><label>Participantes</label><label className="check-line"><input type="checkbox" checked={noLimit} onChange={e=>setNoLimit(e.target.checked)}/> Sem limite de inscritos</label>{!noLimit&&<input type="number" min="1" step="1" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Quantidade máxima"/>}</div>
    <div className="modal-actions"><button className="button-secondary" onClick={onClose}>Cancelar</button><button className="button-primary" onClick={save} disabled={!title.trim()||!date||!time||(kind==='recurring'&&(endDate<date||!Number.isInteger(Number(interval))||Number(interval)<1))||(!noLimit&&(!Number.isInteger(Number(capacity))||Number(capacity)<1))}>{activity?'Salvar alterações':'Salvar atividade'} <ArrowRight size={16}/></button></div><p className="demo-warning">Demonstração local: ainda não grava no Supabase.</p></section></div>
}
function NewsModal({ onClose, onPublish }: { onClose:()=>void; onPublish:(post:any)=>void }) {
  const [title,setTitle]=useState(''),[body,setBody]=useState(''),[category,setCategory]=useState('NOTÍCIAS'),[image,setImage]=useState('')
  const [preview,setPreview]=useState(false)
  function choose(file?:File){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){window.alert('Selecione uma imagem PNG, JPG ou WebP.');return}if(file.size>1500*1024){window.alert('Para manter o protótipo leve, a imagem deve ter até 1,5 MB.');return}const reader=new FileReader();reader.onload=()=>setImage(String(reader.result||''));reader.readAsDataURL(file)}
  const post={title,body,category,image}
  return <div className="modal-backdrop" onClick={onClose}><section className="modal news-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><div className="modal-head"><div className="modal-icon"><FileText size={21}/></div><button className="icon-button" onClick={onClose}><X size={19}/></button></div><h2>{preview?'Prévia da publicação':'Nova publicação'}</h2><p className="modal-description">{preview?'Confira como a publicação aparecerá no feed dos associados.':'Crie uma notícia, comunicado ou divulgação para o feed do clube.'}</p>{preview?<article className="feed-post"><div className="feed-post-head"><Avatar initials="OR" color="mint"/><div><strong>Clube Orion</strong><span>Agora · {category}</span></div></div>{image&&<img className="post-image" src={image} alt="Prévia da arte"/>}<div className="feed-post-copy"><h3>{title}</h3><p>{body}</p></div></article>:<><div className="form-field"><label>Título *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título da publicação"/></div><div className="form-field"><label>Categoria</label><select value={category} onChange={e=>setCategory(e.target.value)}><option>NOTÍCIAS</option><option>COMUNICADOS</option><option>EVENTOS</option><option>COMUNIDADE</option></select></div><div className="form-field"><label>Texto</label><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Escreva a mensagem para os associados..."/></div><div className="form-field"><label>Arte ou imagem</label><label className="dropzone"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>choose(e.target.files?.[0])}/>{image?<><img className="upload-preview" src={image} alt="Imagem selecionada"/><strong>Imagem selecionada</strong><span>Clique para substituir</span></>:<><div className="upload-cloud"><Upload size={21}/></div><strong>Selecionar imagem</strong><span>PNG, JPG ou WebP</span></>}</label></div></>}<div className="modal-actions">{preview?<button className="button-secondary" onClick={()=>setPreview(false)}>Voltar para edição</button>:<button className="button-secondary" onClick={onClose}>Cancelar</button>}{preview?<button className="button-primary" onClick={()=>onPublish(post)} disabled={!title.trim()}>Publicar no feed <ArrowRight size={16}/></button>:<button className="button-primary" onClick={()=>setPreview(true)} disabled={!title.trim()}>Pré-visualizar <ArrowRight size={16}/></button>}</div><p className="demo-warning">A publicação e a imagem são salvas localmente neste navegador. Não use material confidencial nesta demonstração.</p></section></div>
}
function FeedPage({ posts }: { posts:any[] }) {
  const ordered=[...posts].sort((a,b)=>Number(b.id)-Number(a.id))
  return <><PageTitle eyebrow="VIDA DO CLUBE" title="Feed do Orion" description="Notícias, eventos e momentos importantes da nossa comunidade."/><div className="feed-layout"><div className="feed-stream">{ordered.map(p=><article className="feed-post" key={p.id}><div className="feed-post-head"><Avatar initials="OR" color="mint"/><div><strong>{p.author}</strong><span>{p.date} · {p.category}</span></div></div>{p.image?<img className="post-image" src={p.image} alt="Imagem da publicação"/>:<div className="post-art"><span>ORION</span><strong>{p.category}</strong><i/></div>}<div className="feed-post-copy"><h3>{p.title}</h3><p>{p.body}</p></div><div className="feed-post-foot"><span><CheckCircle2 size={14}/> Publicação do clube</span><button onClick={()=>{const shareText=`${p.title}\n${p.body}`;if(navigator.share)navigator.share({title:p.title,text:shareText}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(shareText)}}>Compartilhar <ArrowRight size={14}/></button></div></article>)}</div><aside className="feed-aside"><div className="side-card"><span className="eyebrow">CLUBE ORION</span><h3>Faça parte de tudo que acontece.</h3><p>Atividades, encontros e novidades em um só lugar.</p><Instagram size={19}/></div></aside></div></>
}
function ValidationPage({ payments, members, monthlyFee, dueDay, approve, onReject, role, onViewProof, flash }: { payments:PaymentRecord[]; members:Member[]; monthlyFee:number; dueDay:number; approve:(id:number)=>void; onReject:(p:PaymentRecord)=>void; role:Role; onViewProof:(id:number)=>void; flash:(s:string)=>void }) {
  const competence=currentCompetenceLabel()
  const activeMembers=members.filter(m=>m.status==='Ativo')
  const monthlyRows=activeMembers.map(member=>({member,payment:payments.filter(p=>(p.memberId===member.id||(!p.memberId&&p.name===member.name))&&p.competence===competence).sort((a,b)=>b.id-a.id)[0]}))
  const configuredDueDate=new Date(new Date().getFullYear(),new Date().getMonth(),dueDay)
  const isMonthOverdue=new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())>configuredDueDate
  const pending=payments.filter(p=>p.status==='pending')
  const completed=payments.filter(p=>p.status!=='pending')
  const total=pending.reduce((sum,p)=>sum+Number(p.value.replace(/[^0-9,]/g,'').replace(',','.')),0)
  return <><PageTitle eyebrow="CONTROLE FINANCEIRO" title="Validação de pagamentos" description="Revise os comprovantes enviados pelos associados e registre a decisão."/><div className="validation-summary"><div><span>Em análise</span><strong>{pending.length.toString().padStart(2,'0')}</strong></div><div><span>Aprovados</span><strong>{payments.filter(p=>p.status==='approved').length.toString().padStart(2,'0')}</strong></div><div><span>Valor em análise</span><strong>{`R$ ${total.toFixed(2).replace('.',',')}`}</strong></div></div>{role!=='financeiro'&&<div className="info-banner"><div><ShieldCheck size={19}/></div><p><strong>Permissões de demonstração.</strong> Nesta versão, o perfil de administrador geral também pode validar. A aplicação final deve restringir esta ação ao papel financeiro e auditar a decisão no backend.</p></div>}
    <section className="panel validation-panel"><div className="panel-heading"><div><h2>Mensalidades da competência — {competence}</h2><p>{activeMembers.length} associados ativos · referência de {`R$ ${monthlyFee.toFixed(2).replace('.',',')}`} · vencimento dia {dueDay}</p></div></div><div className="responsive-table"><table><thead><tr><th>ASSOCIADO</th><th>VALOR</th><th>SITUAÇÃO</th><th>COMPROVANTE / RETORNO</th></tr></thead><tbody>{monthlyRows.map(({member,payment})=><tr key={member.id}><td><strong>{member.name}</strong></td><td>{`R$ ${monthlyFee.toFixed(2).replace('.',',')}`}</td><td>{!payment?<Status tone={isMonthOverdue?'red':'amber'}>{isMonthOverdue?'Em atraso':'Sem envio'}</Status>:<Status tone={payment.status==='approved'?'green':payment.status==='rejected'?'red':'amber'}>{payment.status==='approved'?'Pago':payment.status==='rejected'?'Rejeitado':'Em análise'}</Status>}</td><td>{payment?.reason||payment?.file||'Aguardando pagamento'}</td></tr>)}</tbody></table></div></section>
    <section className="panel validation-panel"><div className="panel-heading"><div><h2>Comprovantes aguardando análise</h2><p>Ordenados pelos envios mais recentes</p></div><span className="filter-chip active">{pending.length} pendentes</span></div>{pending.length?pending.map(p=><div className="validation-row" key={p.id}><Avatar initials={p.initials} color="mint"/><div className="validation-person"><strong>{p.name}</strong><span>{p.competence} · Enviado {p.date}</span><div className="file-pill"><FileText size={14}/>{p.file}</div></div><div className="validation-value"><strong>{p.value}</strong><span>Valor informado</span></div><div className="validation-actions"><button className="button-secondary small-button" onClick={()=>void onViewProof(p.id)}>Ver arquivo</button><button className="approve-button" onClick={()=>approve(p.id)}><Check size={15}/> Aprovar</button><button className="icon-button reject-button" aria-label="Rejeitar comprovante" onClick={()=>onReject(p)}><X size={17}/></button></div></div>):<p className="empty-note">Nenhum comprovante aguardando análise.</p>}</section>
    <section className="panel validation-panel"><div className="panel-heading"><div><h2>Histórico de decisões</h2><p>Pagamentos aprovados ou rejeitados</p></div></div>{completed.length?completed.map(p=><div className="validation-row" key={p.id}><Avatar initials={p.initials} color="mint"/><div className="validation-person"><strong>{p.name}</strong><span>{p.competence} · {p.date}</span><div className="file-pill"><FileText size={14}/>{p.file}</div>{p.reason&&<span className="payment-reason">Motivo: {p.reason}</span>}</div><div className="validation-value"><strong>{p.value}</strong><button className="text-action" type="button" onClick={()=>void onViewProof(p.id)}>Ver arquivo</button></div><Status tone={p.status==='approved'?'green':'red'}>{p.status==='approved'?'Aprovado':'Rejeitado'}</Status></div>):<p className="empty-note">Ainda não há decisões registradas.</p>}</section>
    <div className="admin-footer-note"><ShieldCheck size={17}/><span>O protótipo registra decisões e justificativas apenas no armazenamento local deste navegador. A versão de produção deve validar permissões no servidor e manter logs imutáveis.</span></div></>
}
function SettingsPage({ flash, monthlyFee, setMonthlyFee, dueDay, setDueDay, pixKey, setPixKey, auditLog }: { flash:(s:string)=>void; monthlyFee:number; setMonthlyFee:(n:number)=>void; dueDay:number; setDueDay:(n:number)=>void; pixKey:string; setPixKey:(s:string)=>void; auditLog:AuditEntry[] }) {
  return <><PageTitle eyebrow="ADMINISTRAÇÃO" title="Configurações" description="Preferências, regras financeiras e rastreabilidade do ambiente Orion."/><div className="settings-list"><section className="settings-row settings-edit-row"><div className="settings-row-icon"><Wallet size={19}/></div><div className="settings-edit-content"><strong>Mensalidades</strong><p>Defina o valor de referência e o dia de vencimento.</p><div className="settings-inline-fields"><label>Valor mensal (R$)<input type="number" min="0" step="0.01" value={monthlyFee} onChange={e=>setMonthlyFee(Math.max(0,Number(e.target.value)||0))}/></label><label>Dia de vencimento<input type="number" min="1" max="28" value={dueDay} onChange={e=>setDueDay(Math.min(28,Math.max(1,Number(e.target.value)||1)))}/></label><label className="pix-setting">Chave PIX<input type="text" value={pixKey} onChange={e=>setPixKey(e.target.value)} placeholder="Chave PIX oficial do clube"/></label></div></div><Status>Salvo localmente</Status></section>
    <div className="settings-row"><div className="settings-row-icon"><Users size={19}/></div><div><strong>Usuários e permissões</strong><p>Perfis previstos: administrador geral, financeiro, atividades e associado.</p></div><button className="button-secondary" onClick={()=>flash('Os perfis de demonstração são alternados no seletor do topo. A autorização real será aplicada pelo Supabase RLS.')}>Ver papéis <ArrowRight size={15}/></button></div>
    <div className="settings-row"><div className="settings-row-icon"><ShieldCheck size={19}/></div><div><strong>Privacidade e LGPD</strong><p>Definir política de privacidade, finalidades, bases legais, retenção e canal de solicitações.</p></div><button className="button-secondary" onClick={()=>flash('Checklist de privacidade documentado no README. A validação jurídica e operacional ainda é necessária.')}>Ver checklist <ArrowRight size={15}/></button></div>
    <div className="settings-row"><div className="settings-row-icon"><Activity size={19}/></div><div><strong>Auditoria</strong><p>{auditLog.length} ação(ões) registradas nesta demonstração.</p></div><button className="button-secondary" onClick={()=>flash(auditLog.slice(0,3).map(a=>`${a.date}: ${a.action} — ${a.detail}`).join(' | ')||'Nenhuma ação registrada ainda.')}>Últimas ações <ArrowRight size={15}/></button></div></div>
    <section className="panel audit-panel"><div className="panel-heading"><div><h2>Trilha de auditoria local</h2><p>Eventos recentes da sessão persistidos neste navegador</p></div></div>{auditLog.length?auditLog.slice(0,20).map(a=><div className="audit-row" key={a.id}><div><strong>{a.action}</strong><span>{a.detail}</span></div><small>{a.date} · {a.actor}</small></div>):<p className="empty-note">Nenhuma ação registrada ainda.</p>}</section>
    <div className="admin-footer-note"><ShieldCheck size={17}/><span>Não use dados pessoais ou comprovantes reais neste protótipo: o localStorage não é um cofre seguro, não oferece controle de acesso e pode ser lido pelo navegador local.</span></div></>
}
export default App
