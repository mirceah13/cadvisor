# CADVisor — Arhitectură & Manual de Utilizare

> **Disclaimer:** CADVisor oferă sugestii de asistență în luarea deciziilor și **nu înlocuiește** revizuirea inginerească sau juridică certificată. Platforma nu este un organism legal îndreptățit să emită certificate de conformitate.

---

## Cuprins

1. [Ce este CADVisor?](#1-ce-este-cadvisor)
2. [Arhitectura sistemului](#2-arhitectura-sistemului)
   - 2.1 [Vedere de ansamblu](#21-vedere-de-ansamblu)
   - 2.2 [Serviciile componente](#22-serviciile-componente)
   - 2.3 [Baza de date](#23-baza-de-date)
   - 2.4 [Stocarea fișierelor](#24-stocarea-fisierelor)
   - 2.5 [Coada de procesare asincronă](#25-coada-de-procesare-asincrona)
   - 2.6 [Motorul AI local](#26-motorul-ai-local)
3. [Fluxul de date — de la fișier la raport](#3-fluxul-de-date--de-la-fisier-la-raport)
4. [Manual de utilizare pas cu pas](#4-manual-de-utilizare-pas-cu-pas)
   - 4.1 [Pornirea platformei (prima dată)](#41-pornirea-platformei-prima-data)
   - 4.2 [Înregistrare și autentificare](#42-inregistrare-si-autentificare)
   - 4.3 [Crearea Organizației](#43-crearea-organizatiei)
   - 4.4 [Crearea unui Proiect](#44-crearea-unui-proiect)
   - 4.5 [Crearea unei Submisii](#45-crearea-unei-submisii)
   - 4.6 [Încărcarea fișierelor CAD/documente](#46-incarcarea-fisierelor-caddocumente)
   - 4.7 [Lansarea analizei AI](#47-lansarea-analizei-ai)
   - 4.8 [Revizuirea rezultatelor (Findings)](#48-revizuirea-rezultatelor-findings)
   - 4.9 [Generarea și descărcarea raportului](#49-generarea-si-descarcarea-raportului)
   - 4.10 [Baza de cunoștințe (Knowledge Base)](#410-baza-de-cunostinte-knowledge-base)
   - 4.11 [Dashboard și statistici](#411-dashboard-si-statistici)
5. [Glosar de termeni](#5-glosar-de-termeni)

---

## 1. Ce este CADVisor?

**CADVisor** (denumit intern și *BuildGuard Advisor*) este o platformă SaaS multi-tenant care ajută companiile de construcții să valideze **pachete de documentație tehnică** (fișiere CAD + documente) față de standarde, norme legale și ghiduri interne.

### Ce problemă rezolvă?

Înainte de depunerea unui proiect de construcție la autorități, echipele de proiectare trebuie să se asigure că documentația respectă o serie de cerințe tehnice și legale (norme de securitate la incendiu, accesibilitate, normative structurale etc.). Verificarea manuală este lentă, costisitoare și predispusă la erori umane. CADVisor automatizează această verificare cu ajutorul AI.

### Principalele funcționalități

| Funcționalitate | Descriere |
|---|---|
| **Analiză fișiere CAD** | Parsează IFC (3D BIM), DXF (2D AutoCAD), PDF, DOCX |
| **Motor de reguli AI** | Verifică conformitatea față de normative din baza de cunoștințe |
| **RAG (Retrieval-Augmented Generation)** | LLM-ul citește norma relevantă și compară cu proiectul |
| **Revizie umană** | Expertul poate aproba/respinge/corecta fiecare constatare |
| **Rapoarte PDF** | Rapoarte de conformitate cu citări și dovezi |
| **Baza de cunoștințe** | Repository de norme/standarde indexate semantic |
| **Multi-tenant RBAC** | Organizații separate, roluri (Admin, Manager, Reviewer, Viewer) |
| **Abonamente** | Trial 14 zile, planuri plătite cu limite de utilizare |
| **Securitate** | JWT, Argon2, presigned URLs, audit log complet |

---

## 2. Arhitectura sistemului

### 2.1 Vedere de ansamblu

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET / BROWSER                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS :3000
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND — Next.js 14                         │
│            (TypeScript · TailwindCSS · shadcn/ui)               │
│  Pagini: Dashboard / Proiecte / Submisii / KB / Rapoarte        │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API :8000
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API SERVICE — FastAPI                        │
│              (Python 3.11 · SQLAlchemy · Alembic)               │
│  Auth · Organizations · Projects · Submissions · Files           │
│  Analysis · KB · Billing · Feedback · Reports · Dashboard       │
└──────┬───────────────────────────────────────┬──────────────────┘
       │ Celery tasks (Redis broker)            │ HTTP :8001
       ▼                                        ▼
┌─────────────────┐              ┌──────────────────────────────┐
│  CELERY WORKER  │              │   AI SERVICE — FastAPI        │
│  (procesare     │              │   (Python · Ollama · ezdxf    │
│   asincronă)    │              │    IfcOpenShell · pgvector)   │
└──────┬──────────┘              └──────────────┬───────────────┘
       │                                         │
       ▼                                         ▼
┌─────────────────┐              ┌──────────────────────────────┐
│   REDIS :6379   │              │     OLLAMA :11434             │
│  (broker + cache│              │  (LLM local: Mistral 7B       │
│   rezultate)    │              │   + nomic-embed-text)         │
└─────────────────┘              └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL 16 + pgvector :5432                      │
│  (date business + vectori embeddings pentru căutare semantică)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              MinIO (S3-compatible) :9002 / :9001                 │
│  (stocare fișiere: IFC, DXF, PDF, DOCX, rapoarte generate)     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Serviciile componente

#### Frontend (`apps/web/`)
- **Tehnologie:** Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **Autentificare:** NextAuth.js cu sesiuni JWT (email/parolă + OAuth: Google, Apple, Microsoft)
- **Pagini principale:**
  - `/` — Landing page public
  - `/dashboard` — Statistici generale, grafice de trend
  - `/projects` — Lista proiectelor din organizație
  - `/submissions` — Lista submisiilor cu statusul analizei
  - `/knowledge-base` — Baza de cunoștințe (upload norme, status indexare)
  - `/reports` — Rapoarte de conformitate generate
  - `/settings` — Setări cont și organizație
  - `/billing` — Abonament și utilizare

#### API Service (`services/api/`)
- **Tehnologie:** FastAPI (Python 3.11), SQLAlchemy ORM, Alembic (migrări)
- **Responsabilități:** Toată logica de business, CRUD, autentificare, autorizare RBAC, orchestrarea task-urilor Celery
- **Securitate:** Rate limiting, CORS, Trusted Host, header X-Request-ID, audit logging
- **Endpoint-uri principale:**
  - `POST /api/v1/auth/signup` / `login` / `logout`
  - `GET/POST /api/v1/organizations`
  - `GET/POST /api/v1/projects`
  - `GET/POST /api/v1/submissions`
  - `POST /api/v1/files/presign-upload` / `complete-upload`
  - `POST /api/v1/analysis/{submission_id}/run`
  - `GET /api/v1/analysis/{run_id}/findings`
  - `GET/POST /api/v1/kb` (Knowledge Base)
  - `POST /api/v1/reports/{submission_id}/generate`
  - `GET /api/v1/dashboard/stats`

#### AI Service (`services/ai/`)
- **Tehnologie:** FastAPI (Python), IfcOpenShell (parsare IFC/BIM), ezdxf (parsare DXF), PyPDF2, python-docx, pgvector
- **Responsabilități:** Parsarea fișierelor CAD, generarea de embeddings, căutare vectorială (RAG), rularea LLM pentru analiză, analiza de siguranță la incendiu
- **Capabilități de parsare:**
  - **IFC**: structura clădirii (etaje, spații), elemente (pereți, uși, ferestre, scări), sisteme MEP
  - **DXF**: layere, blocuri, entități, texte, dimensiuni, analiza legendei de rezistență la foc
  - **PDF/DOCX**: extragere text pentru indexare în KB

#### Celery Worker (`services/api/app/worker.py`)
- Procesare asincronă pentru operațiuni lente:
  - Parsarea și indexarea fișierelor CAD uploadate
  - Ingestia documentelor din Knowledge Base (chunking + embeddings)
  - Rularea analizei AI complete
  - Generarea rapoartelor PDF

### 2.3 Baza de date

PostgreSQL 16 cu extensia **pgvector** pentru stocarea vectorilor de embeddings.

**Tabele principale:**

| Tabel | Descriere |
|---|---|
| `users` | Conturi utilizatori (Argon2 hash parole, OAuth IDs) |
| `organizations` | Chiriași (tenants) — companii/firme |
| `organization_members` | Legătura user ↔ organizație + rol (admin/manager/reviewer/viewer) |
| `projects` | Proiecte de construcție (tip clădire, jurisdicție) |
| `submissions` | Pachete de documentație pentru un proiect |
| `files` | Fișiere uploadate (metadate, checksum SHA-256, tip MIME) |
| `knowledge_sources` | Surse din baza de cunoștințe (norme, standarde) |
| `kb_chunks` | Fragmente text indexate + vectori embeddings (pgvector) |
| `kb_images` | Imagini extrase din documente KB (embeddings CLIP) |
| `analysis_runs` | Rulări de analiză AI pe o submisie |
| `findings` | Constatări individuale generate de AI (cu severitate și dovezi) |
| `feedback` | Feedback uman pe constatări (aprobare/respingere/corecție) |
| `rulesets` | Seturi de reguli configurabile |
| `subscriptions` | Abonamentele organizațiilor |
| `usage_events` | Log de utilizare pentru facturare |
| `audit_logs` | Jurnal complet de audit (cine ce a făcut când) |

### 2.4 Stocarea fișierelor

**MinIO** (compatibil S3) stochează toate fișierele binare în bucket-ul `cadvisor-files`, organizat pe directoare per organizație. Upload-ul se face direct din browser prin **presigned URLs** (URL-uri temporare cu expirare de 15 minute), fără a trece prin API — aceasta reduce latența și sarcina serverului. În producție se poate înlocui cu AWS S3.

### 2.5 Coada de procesare asincronă

**Celery + Redis**: task-urile lente (parsare CAD, generare embeddings, analiză LLM) sunt puse în coadă și procesate în fundal de worker-ul Celery. Utilizatorul vede statusul în timp real (polling sau WebSocket).

### 2.6 Motorul AI local

**Ollama** rulează modele LLM local, fără a trimite date în cloud:
- **Mistral 7B Instruct** — model de limbaj pentru analiză și generare rapoarte
- **nomic-embed-text** — model de embeddings pentru căutare semantică (RAG)

Fluxul RAG:
1. Submisia este parsată → se extrag metadate tehnice
2. Se generează o interogare semantică
3. Se caută în `kb_chunks` (pgvector cosine similarity) fragmentele relevante din norme
4. LLM-ul primește contextul (metadate proiect + normele relevante) și generează constatări
5. Constatările sunt clasificate pe severitate: **Critical / High / Medium / Low / Info**

---

## 3. Fluxul de date — de la fișier la raport

```
  UTILIZATOR
     │
     │ 1. Uploadează fișiere (IFC/DXF/PDF/DOCX)
     ▼
  FRONTEND ──presigned URL──► MINIO (stocare directă)
     │
     │ 2. Notifică API că upload-ul s-a terminat
     ▼
  API SERVICE
     │
     │ 3. Înregistrează fișierul în DB (checksum SHA-256)
     │ 4. Pune task în coadă: "parsează fișierul X"
     ▼
  CELERY WORKER
     │
     │ 5. Descarcă fișierul din MinIO
     │ 6. Parsează cu IFCParser / DXFParser / PDFParser
     │ 7. Salvează metadatele extrase în DB
     │ 8. Status fișier → "processed"
     │
     │ (la cererea utilizatorului: Rulează Analiza)
     │
     │ 9. Pune task: "analizează submisia Y"
     ▼
  AI SERVICE
     │
     │ 10. Construiește profilul submisiei (toate fișierele)
     │ 11. Generează query RAG
     │ 12. Caută în KB (pgvector similarity search)
     │ 13. Trimite prompt la Ollama (LLM)
     │ 14. Salvează Finding-urile în DB
     │ 15. Status analiză → "completed"
     │
     │ 16. Utilizatorul revizuiește → aprobă/respinge Finding-uri
     │
     │ 17. Generează Raport PDF
     ▼
  UTILIZATOR primește raportul final
```

---

## 4. Manual de utilizare pas cu pas

### 4.1 Pornirea platformei (prima dată)

> **Cerințe preliminare:** Docker Desktop instalat, minim 16GB RAM, 20GB spațiu liber.

**Pasul 1 — Clonează repository-ul și configurează variabilele de mediu:**

```powershell
git clone <repo-url>
cd CADVisor
Copy-Item .env.example .env
# Editează .env dacă dorești parole/chei personalizate
```

**Pasul 2 — Pornește toate serviciile:**

```powershell
docker-compose up -d
```

Aceasta pornește automat: PostgreSQL, Redis, MinIO, Ollama, API, AI Service, Frontend.

**Pasul 3 — Inițializează baza de date:**

```powershell
docker-compose exec api alembic upgrade head
docker-compose exec api python scripts/seed.py
```

**Pasul 4 — Descarcă modelele AI:**

```powershell
# Model LLM principal (~4GB)
docker-compose exec ollama ollama pull mistral:7b-instruct

# Model embeddings (~274MB)
docker-compose exec ollama ollama pull nomic-embed-text
```

**Pasul 5 — (Opțional) Populează baza de cunoștințe cu date demo:**

```powershell
docker-compose exec api python scripts/ingest_sample_kb.py
```

**Verificare — serviciile disponibile:**

| Serviciu | URL |
|---|---|
| Aplicație Web | http://localhost:3000 |
| API (documentație Swagger) | http://localhost:8000/docs |
| AI Service | http://localhost:8001 |
| MinIO Console | http://localhost:9001 |

**Credențiale demo pre-instalate:**
- Email: `admin@buildguard.local`
- Parolă: `BuildGuard2025!`

---

### 4.2 Înregistrare și autentificare

1. Deschide http://localhost:3000
2. Click **Sign Up** (sau folosește contul demo de mai sus cu **Login**)
3. Completează: Nume, Email, Parolă (minim 8 caractere)
4. Alternativ, poți folosi autentificarea OAuth: **Google**, **Apple** sau **Microsoft**
5. După autentificare ești redirecționat automat la **Dashboard**

---

### 4.3 Crearea Organizației

O **Organizație** reprezintă firma/compania ta. Toți utilizatorii și proiectele sunt grupate sub ea.

1. La primul login, dacă nu ai o organizație, vei fi promptat să creezi una
2. Sau din meniu → **Settings** → **Organization** → **Create Organization**
3. Completează: Nume organizație, Descriere (opțional)
4. Poți invita colegi specificând emailul lor și rolul:
   - **Admin** — acces deplin (setări, facturare, ștergere)
   - **Manager** — creare/gestionare proiecte și submisii
   - **Reviewer** — poate revizui și aproba/respinge constatări
   - **Viewer** — acces read-only la rapoarte

---

### 4.4 Crearea unui Proiect

Un **Proiect** corespunde unui obiectiv de construcție (o clădire, un complex etc.).

1. Din Dashboard → click **New Project** (sau din meniu → **Projects** → **+**)
2. Completează:
   - **Nume proiect** — ex: "Bloc rezidențial Str. Florilor 12"
   - **Tip clădire** — Rezidențial / Comercial / Industrial / Public
   - **Jurisdicție** — țara/regiunea aplicabilă (influențează normele folosite)
   - **Descriere** — context suplimentar (opțional)
3. Click **Create Project**
4. Proiectul apare în lista de proiecte

---

### 4.5 Crearea unei Submisii

O **Submisie** este un pachet de fișiere depus pentru verificare (ex: documentația fazei PAC sau PT).

1. Intră în proiectul dorit → tab **Submissions** → **New Submission**
2. Completează:
   - **Nume submisie** — ex: "PAC Faza 1 - Revizia 2"
   - **Descriere** — ce conține pachetul (opțional)
3. Click **Create Submission**

---

### 4.6 Încărcarea fișierelor CAD/documente

1. Intră în submisia creată → secțiunea **Files** → butonul **Upload Files**
2. Trage fișierele în zona drag-and-drop sau click pentru a selecta
3. **Formate acceptate:**
   - `.ifc` — model BIM 3D (Industry Foundation Classes)
   - `.dxf` — desen 2D AutoCAD
   - `.dwg` — desen AutoCAD nativ (cu suport parțial)
   - `.pdf` — planuri scanate, memorii, avize
   - `.docx` — memorii tehnice, breviare de calcul
4. Fișierele sunt uploadate direct în MinIO (securizat, nu trec prin server)
5. Statusul fiecărui fișier:
   - 🔄 **Uploading** — transfer în curs
   - ⏳ **Processing** — parsing CAD în fundal (Celery)
   - ✅ **Processed** — gata pentru analiză
   - ❌ **Error** — eroare la parsare (fișier corupt sau format nesuportat)

---

### 4.7 Lansarea analizei AI

> Toți fișierele trebuie să fie în status **Processed** înainte de a lansa analiza.

1. Din pagina submisiei → butonul **Run Analysis**
2. Sistemul:
   - Construiește profilul tehnic al submisiei (din toate fișierele)
   - Caută în Baza de Cunoștințe normele relevante (RAG)
   - Rulează LLM-ul local (Mistral 7B) pentru a genera constatări
3. Progresul este vizibil în timp real (status: **Pending → Running → Completed**)
4. Durata analizei depinde de numărul și dimensiunea fișierelor (de la câteva minute la 15-20 min)

---

### 4.8 Revizuirea rezultatelor (Findings)

Odată completată analiza, constatările sunt afișate clasificate pe severitate:

| Severitate | Culoare | Înțeles |
|---|---|---|
| 🔴 **Critical** | Roșu | Neconformitate majoră — blochează aprobarea |
| 🟠 **High** | Portocaliu | Problemă semnificativă — necesită remediere |
| 🟡 **Medium** | Galben | Îmbunătățire recomandată |
| 🔵 **Low** | Albastru | Observație minoră |
| ⚪ **Info** | Gri | Informație suplimentară |

**Pentru fiecare constatare poți vedea:**
- Descrierea problemei
- Norma/articolul invocat (cu citare din KB)
- Localizarea în fișier (layer, element, pagina)
- Recomandarea de remediere

**Acțiunile disponibile (rolurile Reviewer și Admin):**
- ✅ **Approve** — constatarea este corectă, trebuie remediată
- ❌ **Reject** — constatarea este eronată (fals pozitiv)
- ✏️ **Override** — ai aplicat o remediere manuală
- 💬 **Add Comment** — notă suplimentară pentru echipă

Feedback-ul tău este salvat și folosit pentru îmbunătățirea continuă a modelului.

---

### 4.9 Generarea și descărcarea raportului

1. Din pagina submisiei → tab **Reports** → **Generate Report**
2. Raportul PDF include:
   - Sumar executiv cu scorul de conformitate
   - Lista completă a constatărilor cu severitate
   - Citări din normele relevante ca dovezi
   - Statusul revizuirii umane (aprobat/respins/overridden)
3. Click **Download** pentru a salva raportul
4. Raportul poate fi partajat direct din interfață

---

### 4.10 Baza de cunoștințe (Knowledge Base)

Baza de cunoștințe conține normele și standardele față de care se face verificarea (ex: P118-2025 — Normativ privind securitatea la incendiu, Legea 10/1995 etc.).

**Cum adaugi o normă nouă:**

1. Meniu → **Knowledge Base** → **Upload Document**
2. Alege fișierul (PDF, DOCX sau TXT)
3. Completează metadatele:
   - **Titlu** — ex: "Normativ P118-2025 - Securitate la incendiu"
   - **Categorie** — `fire_safety` / `structural` / `accessibility` / `building_code` / `electrical` / `plumbing`
   - **Organizație** — la nivelul cărei organizații este disponibilă
4. Click **Upload**
5. Sistemul procesează automat documentul:
   - Extrage textul
   - Îl împarte în fragmente (chunks) de ~500-800 tokeni
   - Generează embeddings cu `nomic-embed-text`
   - Indexează în pgvector
6. Statusul indexării:
   - ⏳ **Pending** → 🔄 **Processing** → ✅ **Indexed** (gata de utilizat)

---

### 4.11 Dashboard și statistici

Dashboard-ul oferă o vedere de ansamblu a activității:

- **Total Proiecte** / **Submisii** / **Fișiere** / **Constatări**
- **Grafic Trends** — numărul de submisii/constatări pe ultimele 7/30/90 zile
- **Distribuție severitate** — grafic pie cu constatările pe severitate
- **Activitate recentă** — ultimele acțiuni din platformă
- **System Status** — sănătatea serviciilor (API, AI, DB, Queue)

Dashboard-ul se auto-actualizează la fiecare 30 de secunde.

---

## 5. Glosar de termeni

| Termen | Explicație |
|---|---|
| **IFC** | Industry Foundation Classes — format standard deschis pentru modele BIM 3D |
| **DXF** | Drawing Exchange Format — format AutoCAD pentru planuri 2D |
| **BIM** | Building Information Modeling — modelare informațională a clădirii |
| **RAG** | Retrieval-Augmented Generation — tehnică AI: LLM-ul primește context extras din KB |
| **pgvector** | Extensie PostgreSQL pentru stocarea și căutarea vectorilor de embeddings |
| **Embedding** | Reprezentare numerică (vector) a unui text, care permite căutare semantică |
| **LLM** | Large Language Model — model de limbaj mare (ex: Mistral 7B) |
| **Ollama** | Platformă pentru rularea LLM-urilor local, fără cloud |
| **MinIO** | Stocare de obiecte compatibilă S3, rulată local |
| **Celery** | Sistem de cozi de task-uri asincrone pentru Python |
| **RBAC** | Role-Based Access Control — control acces bazat pe roluri |
| **Submission** | Pachet de documentație tehnică depus pentru verificare |
| **Finding** | O constatare/problemă identificată de AI în documentație |
| **KB (Knowledge Base)** | Baza de cunoștințe — colecția de norme, standarde, regulamente |
| **Presigned URL** | URL temporar semnat pentru upload/download direct în/din MinIO |
| **REI** | Clasificare rezistență la foc: R=capacitate portantă, E=etanșeitate, I=izolare |
| **P118-2025** | Normativul român privind siguranța la incendiu a construcțiilor |
| **Multi-tenant** | Arhitectură în care mai mulți clienți (organizații) partajează aceeași instanță, cu date izolate |
| **JWT** | JSON Web Token — mecanism de autentificare fără sesiuni stocate pe server |
| **Argon2** | Algoritm modern de hashing al parolelor, rezistent la atacuri brute-force |
