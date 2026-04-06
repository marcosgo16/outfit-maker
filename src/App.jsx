import { useState, useCallback, useEffect, useRef } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { hasRemoteApi, hasGoogleAuth, fetchRemoteState, putRemoteState, postGoogleAuth, getApiUrl, getAuthHeaders } from "./lib/api.js";
import { getSessionToken, setSessionToken, clearSession } from "./lib/session.js";

const SLOTS = [
  { key: "outerwear", label: "Chaqueta",   cats: ["Chaquetas"] },
  { key: "top",       label: "Top / Polo", cats: ["Tops", "Camisas"] },
  { key: "mid",       label: "Jersey",     cats: ["Jerseys"] },
  { key: "bottom",    label: "Pantalón",   cats: ["Pantalones"] },
  { key: "shoes",     label: "Calzado",    cats: ["Calzado"] },
  { key: "accessory", label: "Accesorio",  cats: ["Accesorios"] },
];

const ALL_EMOJIS = ["👕","👔","🧥","🧶","👖","👟","🥾","👞","🩳","🧢","⌚","🕶️","🧣","🎒"];

const COLORS = [
  { name:"Navy",    hex:"#1C2B4A" },
  { name:"Blanco",  hex:"#FAFAFA", border:"#ddd" },
  { name:"Negro",   hex:"#1A1A1A" },
  { name:"Gris",    hex:"#9E9E9E" },
  { name:"Azul",    hex:"#3A6EA5" },
  { name:"Celeste", hex:"#87CEEB" },
  { name:"Beige",   hex:"#D4B896" },
  { name:"Camel",   hex:"#C9A96E" },
  { name:"Verde",   hex:"#4A7C59" },
  { name:"Burdeos", hex:"#7C2D3A" },
  { name:"Rojo",    hex:"#C0392B" },
  { name:"Marrón",  hex:"#7B4F2E" },
];

const CATS = ["Tops","Camisas","Jerseys","Chaquetas","Pantalones","Calzado","Accesorios"];

// Each user starts with an empty wardrobe — data lives in their own localStorage
const EMPTY_WARDROBE = [];

/** Límite aproximado para data URLs en JSON (localStorage / Mongo). */
const MAX_IMAGE_DATA_URL_CHARS = 2_400_000;

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function persist(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

const cl = {
  cream: "#F5F0E8", navy: "#1C2B4A", camel: "#C9A96E",
  stone: "#9C9083", white: "#FDFCFA", border: "#E2D9CC",
  tag: "#EDE8DF", danger: "#C0392B",
};

const S = {
  app:      { maxWidth:430, margin:"0 auto", minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',system-ui,sans-serif", color:cl.navy, background:cl.cream },
  hdr:      { background:cl.navy, padding:"18px 20px 14px", position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 },
  hdrSync:  { fontSize:11, color:cl.camel, letterSpacing:".04em", whiteSpace:"nowrap" },
  hdrAuth:  { display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"flex-end", maxWidth:200 },
  btnOut:   { fontSize:10, padding:"4px 8px", borderRadius:6, border:`1px solid ${cl.camel}`, background:"transparent", color:cl.camel, cursor:"pointer", fontFamily:"inherit" },
  hdrSub:   { fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:cl.camel, marginBottom:2 },
  hdrH1:    { fontFamily:"Georgia,serif", fontSize:21, color:cl.cream, fontWeight:600 },
  tabs:     { display:"flex", background:cl.white, borderBottom:`1px solid ${cl.border}`, position:"sticky", top:57, zIndex:99 },
  tab:      { flex:1, padding:"12px 4px", fontSize:11, fontWeight:500, letterSpacing:".06em", textTransform:"uppercase", textAlign:"center", cursor:"pointer", border:"none", borderBottom:"2px solid transparent", background:"none", color:cl.stone },
  tabOn:    { color:cl.navy, borderBottom:`2px solid ${cl.camel}` },
  sec:      { padding:16, flex:1 },
  grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 },
  slot:     { background:cl.white, border:`1.5px dashed ${cl.border}`, borderRadius:12, minHeight:110, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative", padding:10, textAlign:"center" },
  slotFill: { borderStyle:"solid", borderColor:cl.navy },
  slotLbl:  { fontSize:10, letterSpacing:".1em", textTransform:"uppercase", color:cl.stone, marginBottom:5, fontWeight:500 },
  slotEm:   { fontSize:27, marginBottom:3 },
  slotName: { fontSize:11, fontWeight:500, lineHeight:1.3 },
  slotBrand:{ fontSize:10, color:cl.stone, marginTop:2, display:"flex", alignItems:"center", gap:3 },
  slotX:    { position:"absolute", top:5, right:5, width:18, height:18, borderRadius:"50%", background:cl.danger, color:"#fff", fontSize:10, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  dot:      (bg, size=9) => ({ width:size, height:size, borderRadius:"50%", border:"1px solid rgba(0,0,0,.1)", flexShrink:0, display:"inline-block", background:bg }),
  notesBox: { background:cl.white, border:`1px solid ${cl.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12 },
  textarea: { width:"100%", border:"none", outline:"none", fontFamily:"inherit", fontSize:13, color:cl.navy, background:"transparent", resize:"none", minHeight:46 },
  row:      { display:"flex", gap:10, marginBottom:18 },
  btn:      { flex:1, padding:12, borderRadius:10, fontFamily:"inherit", fontSize:13, fontWeight:500, cursor:"pointer", border:"none" },
  btnP:     { background:cl.navy, color:cl.cream },
  btnS:     { background:cl.white, color:cl.navy, border:`1.5px solid ${cl.border}` },
  btnSm:    { padding:"6px 11px", fontSize:11, borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontWeight:500, border:"none" },
  btnSmP:   { background:cl.navy, color:cl.cream },
  btnSmD:   { background:"#fde8e8", color:cl.danger },
  secTitle: { fontFamily:"Georgia,serif", fontSize:16, marginBottom:12 },
  card:     { background:cl.white, border:`1px solid ${cl.border}`, borderRadius:14, padding:14, marginBottom:10 },
  cardHdr:  { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 },
  cardName: { fontWeight:500, fontSize:14 },
  cardDate: { fontSize:10, color:cl.stone },
  chips:    { display:"flex", gap:6, flexWrap:"wrap" },
  chip:     { background:cl.tag, borderRadius:20, padding:"4px 10px", fontSize:11, display:"flex", alignItems:"center", gap:4 },
  cardNote: { fontSize:11, color:cl.stone, marginTop:7, fontStyle:"italic" },
  cardAct:  { display:"flex", gap:7, marginTop:9, flexWrap:"wrap" },
  wHdr:     { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:11 },
  filterRow:{ display:"flex", gap:6, overflowX:"auto", paddingBottom:9, marginBottom:11 },
  fchip:    { whiteSpace:"nowrap", padding:"6px 13px", borderRadius:20, fontSize:11, fontWeight:500, letterSpacing:".06em", textTransform:"uppercase", cursor:"pointer", border:`1.5px solid ${cl.border}`, background:cl.white, color:cl.stone },
  fchipOn:  { background:cl.navy, color:cl.cream, border:`1.5px solid ${cl.navy}` },
  itemGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
  itemCard: { background:cl.white, border:`1px solid ${cl.border}`, borderRadius:13, padding:"13px 11px", position:"relative" },
  itemEm:   { fontSize:28, marginBottom:7, display:"block" },
  itemName: { fontSize:12, fontWeight:500, lineHeight:1.3, marginBottom:2 },
  itemBrand:{ fontSize:10, color:cl.stone, marginBottom:4 },
  itemColor:{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:cl.stone },
  itemDel:  { position:"absolute", top:7, right:7, width:20, height:20, borderRadius:"50%", background:"#fde8e8", color:cl.danger, fontSize:11, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  formBox:  { background:cl.white, border:`1px solid ${cl.border}`, borderRadius:16, padding:17, marginBottom:15 },
  formH3:   { fontFamily:"Georgia,serif", fontSize:16, marginBottom:15 },
  fg:       { marginBottom:12 },
  flbl:     { display:"block", fontSize:11, fontWeight:500, letterSpacing:".08em", textTransform:"uppercase", color:cl.stone, marginBottom:5 },
  finput:   { width:"100%", padding:"10px 12px", border:`1.5px solid ${cl.border}`, borderRadius:10, fontFamily:"inherit", fontSize:13, color:cl.navy, background:cl.cream, outline:"none", WebkitAppearance:"none" },
  fsel:     { width:"100%", padding:"10px 12px", border:`1.5px solid ${cl.border}`, borderRadius:10, fontFamily:"inherit", fontSize:13, color:cl.navy, background:cl.cream, outline:"none", WebkitAppearance:"none" },
  ep:       { display:"flex", flexWrap:"wrap", gap:7, marginTop:3 },
  eo:       { width:38, height:38, borderRadius:9, border:`2px solid ${cl.border}`, background:cl.cream, fontSize:19, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  eoOn:     { border:`2px solid ${cl.navy}`, background:cl.white },
  cp:       { display:"flex", gap:7, flexWrap:"wrap" },
  co:       { width:27, height:27, borderRadius:"50%", border:"2px solid transparent", cursor:"pointer" },
  coOn:     { border:`2px solid ${cl.navy}`, outline:`2px solid ${cl.cream}`, outlineOffset:-4 },
  overlay:  { position:"fixed", inset:0, background:"rgba(28,43,74,.52)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" },
  modal:    { background:cl.white, borderRadius:"20px 20px 0 0", padding:20, width:"100%", maxWidth:430, maxHeight:"72vh", overflowY:"auto" },
  mHandle:  { width:34, height:4, background:cl.border, borderRadius:2, margin:"0 auto 15px" },
  mTitle:   { fontFamily:"Georgia,serif", fontSize:17, marginBottom:3 },
  mSub:     { fontSize:11, color:cl.stone, marginBottom:14, letterSpacing:".06em", textTransform:"uppercase" },
  mGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  mItem:    { background:cl.cream, border:`1.5px solid ${cl.border}`, borderRadius:11, padding:"11px 9px", cursor:"pointer", textAlign:"center" },
  mEm:      { fontSize:24, marginBottom:4 },
  mName:    { fontSize:11, fontWeight:500, lineHeight:1.3 },
  mBrand:   { fontSize:10, color:cl.stone, display:"flex", alignItems:"center", justifyContent:"center", gap:4 },
  empty:    { textAlign:"center", padding:"40px 16px", color:cl.stone },
  emptyIco: { fontSize:40, marginBottom:12 },
  emptyP:   { fontSize:13, lineHeight:1.6 },
  toast:    { position:"fixed", bottom:22, left:"50%", transform:"translateX(-50%) translateY(70px)", background:cl.navy, color:cl.cream, padding:"9px 18px", borderRadius:30, fontSize:13, fontWeight:500, zIndex:999, whiteSpace:"nowrap", pointerEvents:"none", transition:"transform .3s" },
  toastShow:{ transform:"translateX(-50%) translateY(0)" },
};

function ItemVisual({ item, size = 36, imgStyle }) {
  const [imgErr, setImgErr] = useState(false);
  if (item.imageUrl && !imgErr) {
    return (
      <img
        src={item.imageUrl}
        alt=""
        width={size}
        height={size}
        style={{
          objectFit: "cover",
          borderRadius: 9,
          border: "1px solid rgba(0,0,0,.08)",
          flexShrink: 0,
          ...imgStyle,
        }}
        onError={() => setImgErr(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span style={{ fontSize: Math.round(size * 0.68), lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {item.emoji || "👕"}
    </span>
  );
}

export default function App() {
  const [tab, setTab]           = useState("builder");
  const [wardrobe, setWardrobe] = useState(EMPTY_WARDROBE);
  const [saved, setSaved]       = useState([]);
  const [initDone, setInitDone] = useState(false);
  const [sync, setSync]         = useState({ mode: "loading" });
  const [authVersion, setAuthVersion] = useState(0);
  const [user, setUser]         = useState(null);
  const saveTimer = useRef(null);
  const imageFileInputRef = useRef(null);
  const [outfit, setOutfit]     = useState({});
  const [notes, setNotes]       = useState("");
  const [editId, setEditId]     = useState(null);
  const [filterCat, setFilterCat] = useState("Todos");
  const [modal, setModal]       = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [aiModal, setAiModal] = useState(null); // { outfit }
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [renameVal, setRenameVal]   = useState("");
  const [toast, setToast]       = useState({ msg:"", on:false });
  const [newName, setNewName]   = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newCat, setNewCat]     = useState("Tops");
  const [newEmoji, setNewEmoji] = useState("👕");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newColorName, setNewColorName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

  const showToast = useCallback((msg) => {
    setToast({ msg, on:true });
    setTimeout(() => setToast(t => ({...t, on:false})), 2200);
  }, []);

  const applyImageDataUrl = useCallback((dataUrl) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      showToast("Tiene que ser una imagen");
      return;
    }
    if (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
      showToast("Imagen demasiado grande; prueba otra más pequeña");
      return;
    }
    setNewImageUrl(dataUrl);
  }, [showToast]);

  const onPickImageFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(f);
      });
      applyImageDataUrl(dataUrl);
    } catch {
      showToast("No se pudo leer la imagen");
    }
    e.target.value = "";
  };

  const onPasteImage = useCallback(
    (e) => {
      if (tab !== "wardrobe") return;
      if (e.target && typeof e.target.closest === "function" && e.target.closest("input, textarea")) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          const r = new FileReader();
          r.onload = () => applyImageDataUrl(r.result);
          r.onerror = () => showToast("No se pudo pegar la imagen");
          r.readAsDataURL(file);
          break;
        }
      }
    },
    [tab, applyImageDataUrl, showToast]
  );

  useEffect(() => {
    window.addEventListener("paste", onPasteImage);
    return () => window.removeEventListener("paste", onPasteImage);
  }, [onPasteImage]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const localW = load("om_wardrobe", EMPTY_WARDROBE);
      const localS = load("om_outfits", []);

      if (!hasRemoteApi() || !hasGoogleAuth()) {
        if (!cancelled) {
          setWardrobe(localW);
          setSaved(localS);
          setSync({ mode: "local" });
          setUser(null);
          setInitDone(true);
        }
        return;
      }

      const token = getSessionToken();
      if (!token) {
        if (!cancelled) {
          // Datos siguen en localStorage; la vista queda vacía hasta iniciar sesión.
          setWardrobe(EMPTY_WARDROBE);
          setSaved([]);
          setSync({ mode: "local", needLogin: true });
          setUser(null);
          setInitDone(true);
        }
        return;
      }

      try {
        const data = await fetchRemoteState();
        if (cancelled) return;
        const w = data.wardrobe ?? [];
        const s = data.outfits ?? [];
        const serverEmpty = !w.length && !s.length;
        const localHasData = localW.length > 0 || localS.length > 0;
        if (serverEmpty && localHasData) {
          await putRemoteState({ wardrobe: localW, outfits: localS });
          setWardrobe(localW);
          setSaved(localS);
          persist("om_wardrobe", localW);
          persist("om_outfits", localS);
        } else {
          setWardrobe(w);
          setSaved(s);
          persist("om_wardrobe", w);
          persist("om_outfits", s);
        }
        setUser({
          email: data.email ?? "",
          name: data.name ?? "",
          picture: data.picture ?? "",
        });
        setSync({ mode: "cloud" });
      } catch {
        if (!cancelled) {
          clearSession();
          setWardrobe(EMPTY_WARDROBE);
          setSaved([]);
          setUser(null);
          setSync({ mode: "local", needLogin: true, fromError: true });
          showToast("Sin servidor o sesión caducada");
        }
      }
      if (!cancelled) setInitDone(true);
    }
    init();
    return () => { cancelled = true; };
  }, [authVersion]);

  useEffect(() => {
    if (!initDone) return;
    const session = getSessionToken();
    const hideLocalWhileLoggedOut = hasGoogleAuth() && !session;
    if (!hideLocalWhileLoggedOut) {
      persist("om_wardrobe", wardrobe);
      persist("om_outfits", saved);
    }
    if (!hasRemoteApi() || !hasGoogleAuth() || !session) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      putRemoteState({ wardrobe, outfits: saved })
        .then(() => setSync((prev) => ({ ...prev, mode: "cloud", fromError: false })))
        .catch(() => {
          clearSession();
          setUser(null);
          setWardrobe(EMPTY_WARDROBE);
          setSaved([]);
          setOutfit({});
          setNotes("");
          setEditId(null);
          setModal(null);
          setRenamingId(null);
          setRenameVal("");
          setNewImageUrl("");
          setSync((prev) => ({ ...prev, mode: "local", needLogin: true, fromError: true }));
        });
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [wardrobe, saved, initDone]);

  const onGoogleSuccess = async (credentialResponse) => {
    try {
      const r = await postGoogleAuth(credentialResponse.credential);
      setSessionToken(r.token);
      setUser(r.user);
      setAuthVersion((v) => v + 1);
      showToast("Sesión iniciada");
    } catch {
      showToast("No se pudo iniciar sesión");
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setWardrobe(EMPTY_WARDROBE);
    setSaved([]);
    setOutfit({});
    setNotes("");
    setEditId(null);
    setModal(null);
    setRenamingId(null);
    setRenameVal("");
    setFilterCat("Todos");
    setTab("builder");
    setNewImageUrl("");
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    setSync((prev) => ({ ...prev, mode: "local", needLogin: true }));
    showToast("Sesión cerrada");
  };

  const setW = (w) => { setWardrobe(w); };
  const setS = (s) => { setSaved(s); };

  // ── Builder ──
  const removeSlot  = (key) => { const o = {...outfit}; delete o[key]; setOutfit(o); };
  const clearOutfit = () => { setOutfit({}); setNotes(""); setEditId(null); };
  const saveOutfit  = () => {
    if (!Object.keys(outfit).length) { showToast("Añade al menos una prenda"); return; }
    const date = new Date().toLocaleDateString("es-ES", { day:"2-digit", month:"short" });
    if (editId) {
      setS((prev) => prev.map(o => o.id === editId ? {...o, slots:{...outfit}, notes, date} : o));
      showToast("Outfit actualizado ✓");
    } else {
      setS((prev) => [{ id:Date.now(), name:`Outfit ${prev.length+1}`, slots:{...outfit}, notes, date }, ...prev]);
      showToast("Outfit guardado ✓");
    }
    clearOutfit(); setTab("saved");
  };

  // ── Modal ──
  const selectItem = (item) => { setOutfit({...outfit, [modal.key]: item}); setModal(null); };

  // ── Saved ──
  const loadOutfit   = (o) => { setOutfit({...o.slots}); setNotes(o.notes||""); setEditId(o.id); setTab("builder"); showToast("Cargado ✓"); };
  const deleteOutfit = (id) => { setS((prev) => prev.filter(o => o.id !== id)); showToast("Eliminado"); };
  const startRename  = (id) => { const o = saved.find(x => x.id === id); if (!o) return; setRenamingId(id); setRenameVal(o.name); };
  const confirmRename = (id) => {
    if (renameVal.trim()) setS((prev) => prev.map(x => x.id === id ? {...x, name:renameVal.trim()} : x));
    setRenamingId(null); setRenameVal("");
  };

  // ── Wardrobe ──
  const deleteItem = (id) => {
    setW((prev) => prev.filter(i => i.id !== id));
    const o = {...outfit}; Object.keys(o).forEach(k => { if (o[k].id === id) delete o[k]; }); setOutfit(o);
    showToast("Prenda eliminada");
  };
  const addItem = () => {
    if (!newName.trim()) { showToast("Introduce el nombre"); return; }
    setW((prev) => [...prev, {
      id: Date.now(),
      name: newName.trim(),
      brand: newBrand.trim()||"—",
      category: newCat,
      emoji: newEmoji,
      color: newColor.hex,
      colorName: newColorName.trim()||newColor.name,
      ...(newImageUrl ? { imageUrl: newImageUrl } : {}),
    }]);
    setNewName(""); setNewBrand(""); setNewColorName("");
    setNewImageUrl("");
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    showToast("Prenda añadida ✓");
  };

  const filteredW    = filterCat === "Todos" ? wardrobe : wardrobe.filter(i => i.category === filterCat);
  const wardrobeCats = ["Todos", ...new Set(wardrobe.map(i => i.category))];

  const syncLabel =
    sync.mode === "loading" ? "Cargando…" :
    !hasGoogleAuth() ? "📴 Solo en el dispositivo" :
    sync.mode === "cloud" ? "☁️ MongoDB + Google" :
    sync.needLogin ? "Inicia sesión para la nube" :
    "📴 Solo en el dispositivo";

  const showGoogleLogin = hasGoogleAuth() && !user && initDone;

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const question = aiInput.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", text: question }]);
    setAiLoading(true);
    try {
      const r = await fetch(getApiUrl("/api/ai"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ wardrobe, outfits: saved, question }),
      });
      const data = await r.json();
      setAiMessages(prev => [...prev, { role: "ai", text: data.reply || data.error }]);
    } catch (e) {
      setAiMessages(prev => [...prev, { role: "ai", text: "Error al conectar con la IA" }]);
    }
    setAiLoading(false);
  };
  
  return (
    <div style={S.app}>
      {!initDone && (
        <div style={{ position:"fixed", inset:0, background:"rgba(245,240,232,.94)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", fontSize:18, color:cl.navy }}>
          Cargando datos…
        </div>
      )}

      {/* HEADER */}
      <div style={S.hdr}>
        <div><div style={S.hdrSub}>Marco's</div><div style={S.hdrH1}>Outfit Maker</div></div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, justifyContent:"flex-end", minWidth:0 }}>
          <div style={S.hdrSync} title={sync.mode === "cloud" ? "Cuenta de Google vinculada a tu documento en MongoDB" : "Puedes usar la app solo en el navegador o iniciar sesión para guardar en la nube"}>{syncLabel}</div>
          <div style={S.hdrAuth}>
            {user && sync.mode === "cloud" && (
              <>
                {user.picture ? <img src={user.picture} alt="" width={24} height={24} style={{ borderRadius:"50%" }} /> : null}
                <span style={{ ...S.hdrSync, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis" }}>{user.name || user.email}</span>
                <button type="button" style={S.btnOut} onClick={logout}>Salir</button>
              </>
            )}
            {showGoogleLogin && (
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => showToast("Error con Google")}
                useOneTap={false}
                text="signin_with"
                shape="rectangular"
                size="small"
                locale="es"
              />
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={S.tabs}>
        {[["builder","Constructor"],["saved","Guardados"],["wardrobe","Armario"]].map(([id,lbl]) => (
          <button key={id} style={{...S.tab, ...(tab===id ? S.tabOn : {})}} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* ── BUILDER ── */}
      {tab === "builder" && (
        <div style={S.sec}>
          <div style={S.grid2}>
            {SLOTS.map(slot => {
              const item = outfit[slot.key];
              return (
                <div key={slot.key} style={{...S.slot, ...(item ? S.slotFill : {})}} onClick={() => !item && setModal(slot)}>
                  <div style={S.slotLbl}>{slot.label}</div>
                  {item ? (<>
                    <div style={{ ...S.slotEm, display:"flex", alignItems:"center", justifyContent:"center", minHeight:36 }}><ItemVisual item={item} size={34} /></div>
                    <div style={S.slotName}>{item.name}</div>
                    <div style={S.slotBrand}><span style={S.dot(item.color)}></span>{item.brand}</div>
                    <button style={S.slotX} onClick={e => { e.stopPropagation(); removeSlot(slot.key); }}>✕</button>
                  </>) : (<>
                    <div style={{fontSize:20, color:cl.stone, marginBottom:3}}>+</div>
                    <div style={{fontSize:11, color:cl.stone}}>Añadir</div>
                  </>)}
                </div>
              );
            })}
          </div>
          <div style={S.notesBox}>
            <textarea style={S.textarea} placeholder="Notas (ocasión, temporada…)" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={S.row}>
            <button style={{...S.btn, ...S.btnS}} onClick={clearOutfit}>Limpiar</button>
            <button style={{...S.btn, ...S.btnP}} onClick={saveOutfit}>Guardar outfit</button>
          </div>
          {wardrobe.length === 0 && (
            <div style={{...S.empty, padding:"20px 0"}}>
              <div style={S.emptyIco}>👔</div>
              <p style={S.emptyP}>Tu armario está vacío.<br/>Ve a <strong>Armario</strong> y añade tus prendas.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SAVED ── */}
      {tab === "saved" && (
        <div style={S.sec}>
          <div style={S.secTitle}>Outfits guardados</div>
          {!saved.length ? (
            <div style={S.empty}><div style={S.emptyIco}>🪡</div><p style={S.emptyP}>Aún no tienes outfits guardados.<br/>Crea uno en el Constructor.</p></div>
          ) : saved.map(o => {
            const pieces = Object.values(o.slots);
            return (
              <div key={o.id} style={S.card}>
                <div style={S.cardHdr}>
                  {renamingId === o.id ? (
                    <div style={{display:"flex", gap:6, flex:1, alignItems:"center"}}>
                      <input
                        autoFocus
                        style={{...S.finput, padding:"5px 9px", fontSize:13, flex:1}}
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key==="Enter") confirmRename(o.id); if (e.key==="Escape") setRenamingId(null); }}
                      />
                      <button style={{...S.btnSm, ...S.btnSmP}} onClick={() => confirmRename(o.id)}>OK</button>
                    </div>
                  ) : (
                    <div style={S.cardName}>{o.name}</div>
                  )}
                  <div style={{...S.cardDate, marginLeft:8}}>{o.date}</div>
                </div>
                <div style={S.chips}>
                  {pieces.map((p,i) => (
                    <span key={i} style={S.chip}>
                      <span style={S.dot(p.color)}></span>
                      <ItemVisual item={p} size={15} />
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
                {o.notes && <div style={S.cardNote}>{o.notes}</div>}
                <div style={S.cardAct}>
                  <button style={{...S.btnSm, ...S.btnSmP}} onClick={() => loadOutfit(o)}>Editar</button>
                  <button style={{...S.btnSm, ...S.btnSmD}} onClick={() => deleteOutfit(o.id)}>Eliminar</button>
                  <button style={{...S.btnSm, background:cl.tag, color:cl.navy}} onClick={() => startRename(o.id)}>Renombrar</button>
                  <button style={{...S.btnSm, background:"#f0e6ff", color:"#6b21a8"}} onClick={() => { setAiModal({ outfit: o }); setAiMessages([{ role:"ai", text:`Hola, cuéntame qué quieres saber sobre tu outfit "${o.name}" o tu armario en general.` }]); }}>Boris</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── WARDROBE ── */}
      {tab === "wardrobe" && (
        <div style={S.sec}>
          <div style={S.formBox}>
            <div style={S.formH3}>Añadir prenda</div>
            <div style={S.fg}><label style={S.flbl}>Nombre</label><input style={S.finput} placeholder="Ej: Chinos beige" value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div style={S.fg}><label style={S.flbl}>Marca</label><input style={S.finput} placeholder="Ej: Ralph Lauren" value={newBrand} onChange={e => setNewBrand(e.target.value)} /></div>
            <div style={S.fg}>
              <label style={S.flbl}>Foto (opcional)</label>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <input ref={imageFileInputRef} type="file" accept="image/*" style={{ fontSize:12, maxWidth:"100%" }} onChange={onPickImageFile} />
                {newImageUrl ? (
                  <button type="button" style={{...S.btnSm, ...S.btnSmD}} onClick={() => { setNewImageUrl(""); if (imageFileInputRef.current) imageFileInputRef.current.value = ""; }}>Quitar foto</button>
                ) : null}
              </div>
              <div style={{ fontSize:10, color:cl.stone, marginTop:6, lineHeight:1.45 }}>
                Sube una imagen desde el ordenador o <strong>pega una captura</strong> con Ctrl+V estando en la pestaña Armario.
              </div>
              {newImageUrl ? <img src={newImageUrl} alt="" style={{ marginTop:8, maxWidth:130, maxHeight:130, objectFit:"cover", borderRadius:10, border:`1px solid ${cl.border}` }} /> : null}
            </div>
            <div style={S.fg}>
              <label style={S.flbl}>Categoría</label>
              <select style={S.fsel} value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={S.fg}>
              <label style={S.flbl}>Icono</label>
              <div style={S.ep}>
                {ALL_EMOJIS.map(em => (
                  <button key={em} style={{...S.eo, ...(newEmoji===em ? S.eoOn : {})}} onClick={() => setNewEmoji(em)}>{em}</button>
                ))}
              </div>
            </div>
            <div style={S.fg}>
              <label style={S.flbl}>Color</label>
              <div style={S.cp}>
                {COLORS.map(col => (
                  <button key={col.hex} style={{...S.co, ...(newColor.hex===col.hex ? S.coOn : {}), background:col.hex, ...(col.border ? {border:`2px solid ${col.border}`} : {})}} onClick={() => { setNewColor(col); setNewColorName(col.name); }} />
                ))}
              </div>
              <input style={{...S.finput, marginTop:8}} placeholder="Nombre del color" value={newColorName} onChange={e => setNewColorName(e.target.value)} />
            </div>
            <button style={{...S.btn, ...S.btnP, width:"100%"}} onClick={addItem}>Añadir al armario</button>
          </div>

          <div style={S.wHdr}>
            <div style={{...S.secTitle, margin:0}}>Mi armario</div>
            <div style={{fontSize:12, color:cl.stone}}>{filteredW.length} prendas</div>
          </div>

          {wardrobe.length === 0 ? (
            <div style={S.empty}><div style={S.emptyIco}>🧺</div><p style={S.emptyP}>Tu armario está vacío.<br/>Añade tu primera prenda arriba.</p></div>
          ) : (<>
            <div style={S.filterRow}>
              {wardrobeCats.map(cat => (
                <button key={cat} style={{...S.fchip, ...(filterCat===cat ? S.fchipOn : {})}} onClick={() => setFilterCat(cat)}>{cat}</button>
              ))}
            </div>
            <div style={S.itemGrid}>
              {filteredW.map(item => (
                <div key={item.id} style={S.itemCard}>
                  <div style={{ ...S.itemEm, display:"flex", alignItems:"center", justifyContent:"center" }}><ItemVisual item={item} size={36} /></div>
                  <div style={S.itemName}>{item.name}</div>
                  <div style={S.itemBrand}>{item.brand}</div>
                  <div style={S.itemColor}><span style={S.dot(item.color)}></span>{item.colorName}</div>
                  <button style={S.itemDel} onClick={() => deleteItem(item.id)}>✕</button>
                </div>
              ))}
            </div>
          </>)}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={S.modal}>
            <div style={S.mHandle} />
            <div style={S.mTitle}>{modal.label}</div>
            <div style={S.mSub}>{modal.cats.join(" · ")}</div>
            <div style={S.mGrid}>
              {wardrobe.filter(i => modal.cats.includes(i.category)).length === 0
                ? <div style={{gridColumn:"span 2", textAlign:"center", color:cl.stone, fontSize:13, padding:20}}>No hay prendas en esta categoría.</div>
                : wardrobe.filter(i => modal.cats.includes(i.category)).map(item => (
                  <div key={item.id} style={S.mItem} onClick={() => selectItem(item)}>
                    <div style={{ ...S.mEm, display:"flex", alignItems:"center", justifyContent:"center" }}><ItemVisual item={item} size={30} /></div>
                    <div style={S.mName}>{item.name}</div>
                    <div style={S.mBrand}><span style={S.dot(item.color, 8)}></span>{item.brand}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

  {aiModal && (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setAiModal(null); }}>
      <div style={{...S.modal, maxHeight:"80vh", display:"flex", flexDirection:"column"}}>
        <div style={S.mHandle} />
        <div style={{...S.mTitle, marginBottom:4}}>Boris Izaguirre</div>
        <div style={{fontSize:11, color:cl.stone, marginBottom:12}}>Pregunta sobre tu outfit o armario</div>
        <div style={{flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, marginBottom:12, minHeight:0}}>
          {aiMessages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? cl.navy : cl.tag,
              color: m.role === "user" ? cl.cream : cl.navy,
              padding:"9px 13px", borderRadius:14, fontSize:13, maxWidth:"85%", lineHeight:1.5
            }}>{m.text}</div>
          ))}
          {aiLoading && <div style={{alignSelf:"flex-start", background:cl.tag, padding:"9px 13px", borderRadius:14, fontSize:13, color:cl.stone}}>Pensando…</div>}
        </div>
        <div style={{display:"flex", gap:8}}>
          <input
            style={{...S.finput, flex:1}}
            placeholder="Escribe tu pregunta…"
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendAiMessage(); }}
          />
          <button style={{...S.btn, ...S.btnP, flex:"none", padding:"10px 16px"}} onClick={sendAiMessage}>→</button>
        </div>
      </div>
    </div>
  )}

      {/* TOAST */}
      <div style={{...S.toast, ...(toast.on ? S.toastShow : {})}}>{toast.msg}</div>
    </div>
  );
}
