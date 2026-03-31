# CADVisor — Ghid Complet de Utilizare a Aplicației Web

> **URL aplicație (local):** http://localhost:3000
>
> Acest ghid este destinat utilizatorilor noi care nu au mai folosit CADVisor. Parcurge fiecare secțiune în ordine pentru a înțelege cum funcționează platforma.

---

## Cuprins

1. [Pagina de start (Landing Page)](#1-pagina-de-start)
2. [Creare cont nou (Sign Up)](#2-creare-cont-nou)
3. [Autentificare (Login)](#3-autentificare-login)
4. [Dashboard — Pagina principală](#4-dashboard--pagina-principala)
5. [Proiecte (Projects)](#5-proiecte-projects)
   - 5.1 [Lista proiectelor](#51-lista-proiectelor)
   - 5.2 [Creare proiect nou](#52-creare-proiect-nou)
   - 5.3 [Pagina unui proiect](#53-pagina-unui-proiect)
6. [Submisii (Submissions)](#6-submisii-submissions)
   - 6.1 [Lista submisiilor](#61-lista-submisiilor)
   - 6.2 [Creare submisie nouă](#62-creare-submisie-noua)
   - 6.3 [Pagina unei submisii](#63-pagina-unei-submisii)
   - 6.4 [Încărcarea fișierelor CAD/documente](#64-incarcarea-fisierelor-caddocumente)
   - 6.5 [Lansarea analizei AI](#65-lansarea-analizei-ai)
   - 6.6 [Vizualizarea constatărilor (Findings)](#66-vizualizarea-constatarilor-findings)
7. [Baza de cunoștințe (Knowledge Base)](#7-baza-de-cunostinte-knowledge-base)
   - 7.1 [Lista documentelor indexate](#71-lista-documentelor-indexate)
   - 7.2 [Upload document nou](#72-upload-document-nou)
   - 7.3 [Statistici KB](#73-statistici-kb)
8. [Rapoarte (Reports)](#8-rapoarte-reports)
9. [Profil și setări cont](#9-profil-si-setari-cont)
10. [Facturare și abonament (Billing)](#10-facturare-si-abonament-billing)
11. [Funcționalități transversale](#11-functionalitati-transversale)
12. [Rezolvarea problemelor frecvente](#12-rezolvarea-problemelor-frecvente)

---

## 1. Pagina de start

**URL:** `http://localhost:3000`

Prima pagină este publică și nu necesită autentificare. Conține:

- **Logo + titlu** CADVisor în bara de navigare
- **Buton Login** (dreapta-sus) — dacă ai deja un cont
- **Buton Sign Up** (dreapta-sus) — pentru cont nou
- **Hero section** cu descrierea platformei și butoanele *Start Free Trial* / *Learn More*
- **Disclaimer** obligatoriu: platforma oferă sugestii, nu înlocuiește revizuirea juridică
- **Secțiunea Features** — lista funcționalităților principale
- **Secțiunea Pricing** — planurile de abonament disponibile

> **Acțiune recomandată:** Click pe **Sign Up** pentru a crea un cont nou.

---

## 2. Creare cont nou

**URL:** `http://localhost:3000/auth/signup`

### Formularul de înregistrare

Completează câmpurile în ordine:

| Câmp | Descriere | Exemplu |
|---|---|---|
| **Full Name** | Numele tău complet | Ion Popescu |
| **Email address** | Adresa de email (va fi username-ul) | ion.popescu@firma.ro |
| **Organization Name** | Numele firmei/companiei tale | Arhitect Studio SRL |
| **Password** | Parola contului | minim 8 caractere |
| **Confirm Password** | Repetă parola | aceeași parolă |
| **Accept Terms** | Bifează pentru a accepta termenii | ✓ |

### Cerințele pentru parolă

Pe măsură ce tastezi parola, un indicator de putere îți arată progresul:

- Minim 8 caractere
- Cel puțin o literă mare (A-Z)
- Cel puțin o literă mică (a-z)
- Cel puțin o cifră (0-9)
- Cel puțin un caracter special (!@#$%...)

Indicatorul devine verde când parola este **Strong** (scor 3+/5).

### Procesul de înregistrare

1. Completează toate câmpurile
2. Click **Create Account**
3. Sistemul creează automat:
   - Contul tău de utilizator
   - Organizația cu numele specificat
   - Te adaugă ca **Admin** al organizației
4. Ești redirecționat la pagina de login cu mesajul de succes
5. Loghează-te cu credențialele create

> **Alternativă:** Poți folosi autentificarea rapidă cu **Google**, **Apple** sau **Microsoft** (butoane OAuth în partea de sus a formularului).

---

## 3. Autentificare (Login)

**URL:** `http://localhost:3000/auth/login`

### Login cu email și parolă

1. Introdu **Email address**
2. Introdu **Password**
3. Bifează **Remember me** dacă vrei să rămâi autentificat mai mult timp
4. Click **Sign in**

### Login OAuth (social login)

- Click pe butonul **Continue with Google** / **Continue with Microsoft** / **Continue with Apple**
- Vei fi redirecționat la provider-ul respectiv pentru autentificare
- La revenire, ești logat automat în CADVisor

### Parolă uitată

1. Click pe **Forgot password?** sub formularul de login
2. **URL:** `/auth/forgot-password`
3. Introdu emailul contului tău
4. Verifică inbox-ul pentru emailul de resetare
5. Click pe linkul din email → **URL:** `/auth/reset-password`
6. Completează parola nouă

### Erori frecvente la login

| Mesaj | Cauza | Soluție |
|---|---|---|
| *Invalid email or password* | Credențiale greșite | Verifică caps lock, încearcă din nou |
| *Account not found* | Email neînregistrat | Creează un cont nou |
| *Authentication failed* | Problemă temporară | Reîncearcă după 30 secunde |

---

## 4. Dashboard — Pagina principală

**URL:** `http://localhost:3000/dashboard`

Aceasta este prima pagină după autentificare. Afișează o privire de ansamblu a activității tale.

### Bara de navigare (stânga sau sus)

Navighezi între secțiunile platformei prin meniul principal:

```
📊 Dashboard
📁 Projects
📄 Submissions
📚 Knowledge Base
📋 Reports
```

Iconițele din dreapta barei: **Profil** și **Logout**.

### Cardurile cu statistici (KPI-uri)

Patru carduri principale afișate în partea de sus:

| Card | Ce arată |
|---|---|
| **Total Projects** | Numărul total de proiecte create |
| **Total Submissions** | Numărul total de submisii înregistrate |
| **Total Files** | Numărul total de fișiere uploadate |
| **Total Findings** | Numărul total de constatări generate de AI |

### Graficele de trend

Sub carduri apar două grafice:

- **Submission Trend** — evoluția numărului de submisii în timp
- **Finding Severity Chart** — distribuția constatărilor pe severitate (pie chart)

Poți filtra perioada afișată: **7 zile / 30 zile / 90 zile** (butoane în dreapta-sus ale graficelor).

### Activitate recentă

Secțiunea **Recent Activity** listează ultimele acțiuni: submisii create, analize finalizate, fișiere uploadate.

### System Status

Indică dacă toate serviciile rulează:
- ✅ **API** — serviciul principal
- ✅ **AI Service** — motorul de analiză
- ✅ **Database** — baza de date
- ✅ **Queue** — coada de procesare Celery

> **Notă:** Dashboard-ul se **auto-actualizează** la fiecare 30 de secunde. Poți forța refresh cu butonul din colțul din dreapta sus.

### Butoane de acces rapid

- **New Project** — deschide formularul de creare proiect
- **New Submission** — deschide formularul de creare submisie
- **Upload to KB** — deschide upload documentele din baza de cunoștințe
- **View Reports** — navighează la lista de rapoarte

---

## 5. Proiecte (Projects)

### 5.1 Lista proiectelor

**URL:** `http://localhost:3000/projects`

Afișează toate proiectele organizației tale sub formă de carduri.

**Bara de filtrare:**

| Control | Funcție |
|---|---|
| 🔍 **Search** (câmp text) | Caută proiecte după nume (cu debounce 300ms) |
| **Building Type** (dropdown) | Filtrează după: Residential / Commercial / Industrial / Public / Mixed Use |
| **Sort by** (dropdown) | Ordonează după: Last Updated / Name / Date Created |

**Informațiile afișate pe fiecare card:**

- Numele proiectului + tipul clădirii (badge colorat)
- Data ultimei actualizări
- Numărul de submisii asociate
- Butoane rapide: **View Submissions** și **New Submission**

**Când nu există proiecte**, apare mesajul *No projects yet* cu buton **Create Your First Project**.

### 5.2 Creare proiect nou

**URL:** `http://localhost:3000/projects/new`
**Acces:** Buton **New Project** din lista proiectelor sau din Dashboard

**Formularul:**

| Câmp | Tip | Descriere | Exemplu |
|---|---|---|---|
| **Project Name** *(obligatoriu)* | Text | Numele proiectului | Bloc P+4 Str. Libertății 5 |
| **Building Type** *(obligatoriu)* | Dropdown | Tipul construcției | Residential |
| **Description** *(opțional)* | Textarea | Context suplimentar | Bloc de locuințe cu 20 apartamente |

**Opțiunile pentru Building Type:**

- `residential` — Bloc/casă de locuit
- `commercial` — Spații comerciale, birouri
- `industrial` — Fabrici, depozite
- `public` — Spații publice, instituții
- `mixed_use` — Clădiri cu destinație mixtă
- `other` — Altele

**Procesul:**

1. Completează câmpurile obligatorii
2. Click **Create Project**
3. La succes ești redirecționat automat la pagina proiectului creat
4. La eroare apare un mesaj roșu cu detalii (ex: *You do not have permission to create projects*)

### 5.3 Pagina unui proiect

**URL:** `http://localhost:3000/projects/{id}`

Afișează detaliile proiectului și lista submisiilor asociate.

**Informații afișate:**
- Numele și tipul proiectului
- Data creării și ultima actualizare
- Numărul total de submisii

**Acțiuni disponibile:**
- **New Submission** — creează o submisie pentru acest proiect *(buton principal)*
- **Edit** — modifică numele/descrierea/tipul proiectului
- **Delete** — șterge proiectul *(necesită confirmare, ireversibil)*

---

## 6. Submisii (Submissions)

### 6.1 Lista submisiilor

**URL:** `http://localhost:3000/submissions`

Afișează toate submisiile din organizație (din toate proiectele).

**Bara de filtrare:**

| Control | Funcție |
|---|---|
| 🔍 **Search** | Caută după numele submisiei |
| **Status** (dropdown) | Filtrează după status |
| **Sort** (dropdown) | Newest / Oldest / Name |

**Statusurile posibile** (cu culori):

| Status | Culoare | Înțeles |
|---|---|---|
| `draft` | 🟡 Galben | Submisie creată, fără analiză |
| `submitted` / `analyzing` | 🔵 Albastru | Analiză în curs |
| `reviewed` / `approved` | 🟢 Verde | Analizat și revizuit |
| `rejected` | 🔴 Roșu | Respinsă |

**Bara de severitate** — fiecare submisie afișează o bară colorată mică ce reprezintă distribuția constatărilor (roșu=critical, portocaliu=high, galben=medium, albastru=low).

### 6.2 Creare submisie nouă

**URL:** `http://localhost:3000/submissions/new`
**Acces:** Buton **New Submission** din Dashboard, lista proiectelor sau lista submisiilor

**Formularul — Pasul 1: Detalii submisie**

| Câmp | Tip | Descriere |
|---|---|---|
| **Submission Name** *(obligatoriu)* | Text | ex: PAC Revizia 1 |
| **Project** *(obligatoriu)* | Dropdown | Selectează proiectul din lista celor existente |
| **Building Type** *(obligatoriu)* | Dropdown | Tipul clădirii (Residential/Commercial/...) |
| **Description** *(opțional)* | Textarea | Ce conține pachetul de documentație |

**Formularul — Pasul 2: Upload fișiere** *(pe aceeași pagină, apare după ce se creează submisia)*

1. Completează detaliile și click **Create Submission & Upload Files**
2. Sistemul creează submisia și afișează zona de upload
3. Continuă cu upload-ul fișierelor (detaliat în [secțiunea 6.4](#64-incarcarea-fisierelor-caddocumente))

### 6.3 Pagina unei submisii

**URL:** `http://localhost:3000/submissions/{id}`

Aceasta este pagina centrală de lucru. Conține mai multe **tab-uri**:

#### Tab-ul FILES

Listează toate fișierele uploadate în submisie. Pentru fiecare fișier:

- Numele fișierului + iconița tipului
- Statusul procesării:
  - ⬆️ **Uploading** — transfer în curs (bară de progres %)
  - ⏳ **Parsing** — extractie date CAD în fundal (timp scurs)
  - ✅ **Completed** — gata de analiză
  - ❌ **Failed** — eroare la parsare
- Buton **Details** — deschide tab-ul detaliat al fișierului (metadata extrase)
- Buton de ștergere (🗑️)

Buton **Upload More Files** pentru a adăuga fișiere suplimentare.

#### Tab-ul ANALYSIS

Afișează statusul analizei AI:

- **Run Analysis** — butonul principal pentru lansarea analizei *(apare când toate fișierele sunt Completed)*
- Progresul analizei în timp real (bară animată)
- Istoricul analizelor anterioare (dacă mai au fost rulate)

#### Tab-ul FINDINGS

Lista constatărilor generate de AI, organizate pe severitate:

- Contoare sumar: Total / 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low
- Fiecare constatare are: titlu, descriere, categorie, localizare, recomandare
- Acțiuni: **Approve** ✅ / **Reject** ❌ / **Override** ✏️ / **Comment** 💬

#### Tab-ul DETAILS

Metadatele tehnice extrase din fișierele CAD:
- Tipul clădirii, numărul de etaje, suprafața estimată
- Lista elementelor identificate (pereți, uși, ferestre, scări)
- Sisteme tehnice detectate (electric, instalații sanitare, HVAC, protecție incendiu)
- Scorul de completitudine al dosarului

#### Tab-ul SETTINGS

Permite editarea numelui și descrierii submisiei.

Butonul **Delete Submission** (roșu) cu dialog de confirmare — **ireversibil**.

### 6.4 Încărcarea fișierelor CAD/documente

Din pagina submisiei → buton **Upload Files** sau drag-and-drop direct.

**Pași:**

1. **Selectează fișierele** — click și selectează din file explorer, sau trage fișierele în zona delimitată
2. Fișierele selectate apar în listă cu numele și dimensiunea
3. Click **Upload** (sau upload-ul începe automat)
4. Urmărești progresul în timp real:

```
[ Fisier1.ifc      ] ████████████ 100%  ✅ Completed  (2.3 MB)
[ Plan_parter.dxf  ] ████████░░░░  68%  🔄 Parsing... (1:24 elapsed)
[ Memoriu.pdf      ] ████░░░░░░░░  32%  ⬆️ Uploading  (580 KB)
```

**Formate acceptate:**

| Extensie | Tip | Ce se extrage |
|---|---|---|
| `.ifc` | Model BIM 3D | Etaje, spații, elemente arhitecturale, sisteme MEP |
| `.dxf` | Desen 2D AutoCAD | Layere, blocuri, texturi, dimensiuni, legendă incendiu |
| `.dwg` | AutoCAD nativ | Similar DXF (suport parțial) |
| `.pdf` | Document PDF | Text complet (pentru KB) sau planuri scanate |
| `.docx` | Document Word | Text complet — memorii tehnice, breviare |

**Limite și recomandări:**

- Un singur fișier poate fi mare (suport pentru 2GB+)
- Fișierele IFC cu modele complexe pot dura 2-5 minute la parsare
- Dacă statusul rămâne la **Parsing** mai mult de 10 minute → contactează suportul
- Poți continua să lucrezi în altă parte — parsarea se face în fundal

**Butonul Retry** apare lângă fișierele cu status **Failed** — încearcă re-uploadul.

### 6.5 Lansarea analizei AI

**Condiție prealabilă:** Toate fișierele din submisie trebuie să fie în status ✅ **Completed**.

**Pași:**

1. Din pagina submisiei → tab **Analysis**
2. Click butonul **Run Analysis** (albastru, cu iconița Play ▶)
3. Confirmă dacă apare dialog de confirmare
4. Urmărești progresul analizei:

```
⏳ Pending      → Se pune în coadă
🔄 Running      → Se extrag date, se caută în KB, rulează LLM-ul
✅ Completed    → Constatările sunt gata
❌ Failed       → Verifică eroarea afișată
```

**Ce se întâmplă în fundal (invizibil pentru utilizator):**

1. Sistemul construiește profilul tehnic al submisiei din toate fișierele
2. Caută în Knowledge Base normele și standardele relevante (RAG)
3. LLM-ul (Mistral 7B) analizează documentația față de norme
4. Constatările sunt salvate și clasificate pe severitate
5. Statusul submisiei se actualizează automat

**Durata tipică:** 2-15 minute, în funcție de numărul/dimensiunea fișierelor și puterea serverului.

> Pagina se **auto-actualizează** în timp ce analiza rulează — nu trebuie să dai refresh manual.

### 6.6 Vizualizarea constatărilor (Findings)

**URL:** Tab **Findings** în pagina submisiei

**Sumar numeric:**

```
Total: 23   🔴 Critical: 3   🟠 High: 7   🟡 Medium: 9   🔵 Low: 4
```

**Fiecare constatare afișează:**

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 CRITICAL  [Fire Safety]                              │
│ Lipsa legendei de rezistență la foc                     │
│                                                          │
│ Descriere: Nu a fost identificată o legendă de           │
│ rezistență la foc în planurile DXF analizate.            │
│ Conform P118-2025 art. 4.2, planurile trebuie să         │
│ conțină o legendă REI completă.                          │
│                                                          │
│ 📍 Localizare: layer "FIRE_PLAN", pagina 3              │
│ 💡 Recomandare: Adaugă legendă cu clase REI 30-120      │
│                                                          │
│ [ ✅ Approve ]  [ ❌ Reject ]  [ ✏️ Override ]  [ 💬 ] │
└─────────────────────────────────────────────────────────┘
```

**Acțiunile de revizie umană:**

| Acțiune | Când o folosești |
|---|---|
| **Approve** ✅ | Constatarea este corectă și trebuie remediată în proiect |
| **Reject** ❌ | Constatarea este un fals pozitiv — AI-ul a greșit |
| **Override** ✏️ | Ai remediat problema, marchezi ca rezolvată |
| **Comment** 💬 | Adaugi o notă explicativă pentru colegi |

> Feedback-ul tău îmbunătățește modelul AI pe viitor.

---

## 7. Baza de cunoștințe (Knowledge Base)

### 7.1 Lista documentelor indexate

**URL:** `http://localhost:3000/knowledge-base`

Afișează toate documentele (norme, standarde) indexate semantic și folosite de AI la analiză.

**Bara de căutare** — caută documente după titlu.

**Fiecare card de document afișează:**
- Titlul documentului
- Categorie (badge colorat): `fire_safety` / `building_code` / `structural` / `accessibility` / `electrical` / `plumbing`
- Statusul indexării: Pending → Processing → **Indexed** ✅
- Numărul de chunks indexate (ex: *142 chunks*)
- Data adăugării

**Butoane din dreapta sus:**
- **View Stats** — deschide dashboard-ul statisticilor KB
- **Upload Document** — adaugă un document nou

### 7.2 Upload document nou

**URL:** `http://localhost:3000/knowledge-base/upload`
**Acces:** Buton **Upload Document** din lista KB sau din Dashboard

**Formularul:**

| Câmp | Tip | Descriere | Exemplu |
|---|---|---|---|
| **Title** *(obligatoriu)* | Text | Titlul normei/standardului | Normativ P118-2025 |
| **Category** *(obligatoriu)* | Dropdown | Domeniul documentului | `fire_safety` |
| **Source Type** *(obligatoriu)* | Dropdown | Tipul sursei | `document` |
| **Description** *(opțional)* | Textarea | Scurtă descriere | Normativ privind securitatea la incendiu |
| **File** *(obligatoriu)* | Upload | Fișierul propriu-zis | P118-2025.pdf |

**Categoriile disponibile:**

| Valoare | Domeniu |
|---|---|
| `building_code` | Coduri de construcție generale |
| `fire_safety` | Siguranță la incendiu |
| `structural` | Cerințe structurale |
| `accessibility` | Accesibilitate (persoane cu dizabilități) |
| `electrical` | Instalații electrice |
| `plumbing` | Instalații sanitare |
| `mechanical` | Instalații mecanice / HVAC |
| `zoning` | Urbanism, plan urbanistic |

**Formate acceptate pentru indexare:** `.pdf`, `.docx`, `.txt`

**Procesul după upload:**

1. Fișierul este salvat în MinIO
2. Sistemul extrage textul (PyPDF2 / python-docx)
3. Textul este împărțit în fragmente de ~600 tokeni cu overlap
4. Se generează embeddings cu `nomic-embed-text` pentru fiecare fragment
5. Fragmentele + vectorii sunt salvați în baza de date (pgvector)
6. Statusul trece în ✅ **Indexed**

> Titlul se completează automat din numele fișierului selectat, dar poți modifica.

**Bară de progres** afișată în timpul upload-ului și procesării.

### 7.3 Statistici KB

**URL:** `http://localhost:3000/knowledge-base/dashboard`

Afișează statistici despre Knowledge Base:
- Numărul total de surse / documente indexate
- Distribuția pe categorii
- Numărul total de chunks și imagini indexate
- Istoricul upload-urilor recente

---

## 8. Rapoarte (Reports)

**URL:** `http://localhost:3000/reports`

Afișează toate rapoartele PDF generate din analizele finalizate.

**Fiecare raport afișează:**
- Titlul raportului
- Tipul raportului (Compliance Report, Summary, etc.)
- Proiectul asociat
- Data generării
- Statusul: **Generating** 🔄 / **Completed** ✅ / **Failed** ❌

**Acțiuni disponibile:**
- **Download** ⬇️ — descarcă PDF-ul pe calculator
- **View** 👁️ — previzualizare în browser *(dacă e implementat)*

### Generarea unui raport nou

**URL:** `http://localhost:3000/reports/generate`
**Acces:** Buton **Generate Report** din lista rapoartelor

1. Selectează submisia pentru care vrei raportul
2. Alege tipul de raport (Compliance Summary, Detailed Findings, etc.)
3. Click **Generate**
4. Procesul rulează în fundal (Celery worker)
5. La finalizare raportul apare în lista cu status **Completed**
6. Click **Download** pentru a salva PDF-ul

**Conținutul unui raport tipic:**
- Pagina de copertă (proiect, data, organizație)
- Sumar executiv (scor de conformitate, numărul de constatări)
- Tabel cu constatările sortate pe severitate
- Detalii pentru fiecare constatare (cu citare din normă)
- Statusul revizuirii umane (aprobat/respins/overridden)
- Recomandări finale

---

## 9. Profil și setări cont

### Profilul utilizatorului

**URL:** `http://localhost:3000/profile`
**Acces:** Click pe Avatar/Inițiale în bara de navigare → **Profile**

**Ce poți modifica:**
- **Full Name** — click **Edit**, modifică, click **Save Changes**
- **Email** — *nu se poate modifica din interfață* (contactează suportul)

**Secțiunea OAuth Connections** — afișează dacă ai cont conectat cu Google/Apple/Microsoft.

### Setări securitate

**URL:** `http://localhost:3000/settings/security`

- **Schimbare parolă** — completi parola curentă + parola nouă (× 2)
- Confirmarea se face imediat sau după email de confirmare

---

## 10. Facturare și abonament (Billing)

**URL:** `http://localhost:3000/billing`
**Acces:** Meniu → **Billing** (sau Avatar → Billing)

### Planul de abonament curent

Afișează:
- **Plan activ** (Trial / Starter / Professional / Enterprise)
- **Status** (Active / Expired / Cancelled)
- **Data expirării trial-ului** (dacă ești în trial)
- **Perioada de facturare** (start → end)

### Utilizarea resurselor

Trei bare de progres cu utilizarea față de limita planului:

| Resursă | Exemplu limită Trial |
|---|---|
| **Projects** | 3 / 5 proiecte |
| **Submissions this month** | 12 / 20 submisii |
| **Storage** | 1.2 GB / 5 GB |

Culoarea barei indică urgența:
- 🟢 Verde — utilizare normală (sub 70%)
- 🟡 Galben — atenție (70-90%)
- 🔴 Roșu — la limită (peste 90%)

> Când atingi limita planului, operațiunile respective sunt blocate cu mesaj de eroare.

---

## 11. Funcționalități transversale

### Modul Întunecat / Luminat (Dark Mode)

- Buton 🌙/☀️ în bara de navigare din dreapta sus
- Comutare instantă între tema Dark și Light
- Preferința este salvată în browser

### Indicator de încărcare global

Pe fiecare pagină apare o bară subțire de progres (loading spinner) la navigare între pagini — indică că datele se încarcă.

### Notificări Toast

Mesajele de succes/eroare apar în colțul din dreapta-jos al ecranului ca notificări temporare (dispar după 3-5 secunde):

- 🟢 **Success** — acțiune realizată cu succes
- 🔴 **Error** — ceva a mers rău, cu detalii
- 🟡 **Warning** — atenționare

### Căutare și filtrare

Pe paginile cu liste (proiecte, submisii, KB) există mereu:
- **Câmp de căutare** cu filtrare în timp real (debounce 250-300ms)
- **Dropdown-uri de filtrare** pentru categorie/status/tip
- **Selector de sortare** pentru modificarea ordinii

### Responsiveness

Interfața funcționează pe:
- Desktop (1920px+) — layout complet cu sidebar
- Laptop (1024-1919px) — layout complet adaptat
- Tabletă (768-1023px) — meniu colaps automat
- Mobil (sub 768px) — navigare prin hamburger menu

---

## 12. Rezolvarea problemelor frecvente

### Nu mă pot autentifica

1. Verifică că serviciile rulează: `docker-compose ps`
2. Verifică că API-ul este accesibil: http://localhost:8000/health
3. Încearcă cu credențialele demo: `admin@buildguard.local` / `BuildGuard2025!`

### Fișierul a rămas în status "Parsing" prea mult

1. Fișierele IFC mari (50MB+) pot dura 5-10 minute — așteaptă
2. Dacă a trecut mai mult de 15 minute, încearcă să ștergi și re-uploadezi fișierul
3. Verifică logurile AI service: `docker-compose logs ai`

### Analiza nu pornește (butonul Run Analysis este dezactivat)

- Verifică că **toți** fișierele din submisie sunt în status ✅ **Completed** (nu doar unele)
- Dacă un fișier este în **Error/Failed**, șterge-l și uploadează-l din nou sau șterge-l dacă nu este necesar

### Nu găsesc constatări după analiză

1. Verifică că Knowledge Base are documente indexate (minim unul cu status **Indexed**)
2. Dacă KB-ul este gol, execută: `docker-compose exec api python scripts/ingest_sample_kb.py`
3. Verifică logurile AI: `docker-compose logs ai --tail=100`

### Raportul rămâne în status "Generating"

1. Verifică că Celery worker rulează: `docker-compose ps celery`
2. Verifică logurile: `docker-compose logs celery`
3. Restartează worker-ul: `docker-compose restart celery`

### Eroarea "You do not have permission"

- Înseamnă că rolul tău nu permite acea acțiune
- Cere unui **Admin** al organizației să îți schimbe rolul
- Rolurile cu permisiuni complete: **Admin** → **Manager** → **Reviewer** → **Viewer**

### Nu se afișează nimic pe Dashboard

- Confirmă că ești conectat la internetul local (Docker network)
- Verifică consola browser-ului (F12) pentru erori API
- Dacă API-ul returnează 401, sesiunea a expirat — re-loghează-te

---

*Ultima actualizare: Martie 2026 | Versiunea platformei: 1.0.0*
