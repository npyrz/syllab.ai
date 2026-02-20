# API Documentation: syllab.ai

## Overview

All API routes require authentication via NextAuth. The endpoint base is `/api/v1` (current version v1 is implicit; routes use `/api/*`). Authentication is handled via JWT cookies set by NextAuth.

**Response Format:** JSON  
**Error Handling:** HTTP status codes + error messages in response body

---

## Authentication Endpoints

### POST /api/auth/signin
Sign in with email and password (credentials provider).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "callbackUrl": "/home" (optional)
}
```

**Response (on success):**
```json
{
  "ok": true,
  "status": 200,
  "error": null,
  "url": "/home"
}
```

**Response (on error):**
```json
{
  "ok": false,
  "status": 401,
  "error": "Invalid email or password"
}
```

**Status Codes:** 200, 401, 400

---

### POST /api/auth/signup
Register a new user with email, password, and username.

**Request:**
```json
{
  # API Documentation: syllab.ai

## Overview

All API routes require  
## Overview

All API routes me"
All AP Doe" 
**Response Format:** JSON  
**Error Handling:** HTTP status codes + error messages in response body

---

## Authentication Endpoints

### POST /api/auth/signin
Sign in with email and password (ede**Error Handling:** HTTP sns
---

## Authentication Endpoints

### POST /api/auth/signin
Sign in walr
#dy 
### POST /api/auth/signinon Sign in with email and p:*
**Request:**
```json
{
  "email": "user@example.com",*St```json
{
 **{
  "e400,  "password": "password123",
/g  "callbackUrl": "/home" (o h}
```

**Response (on success):**
d).

**Ha```json
{
  "ok": true,
 id{
  "ofigu  "son  
**Tri  "error": nullsi  "url": "/home c}
```

**Respon

--
*
##```jso /api/auth/signout
{
   out c  "status": 4nd  "error": "Invsi}
```

**Status Codes:** 200, 401, 40true
*
``
---

### POST /api/auth/signu
##
#lasRegister a new user withes
**Request:**
```json
{
  # API Documentation: syllab.ed ```json
{
 en{
 ated us
## Overview

All API routes re al
All API rfor## Overview

All API ro.

All API raraAll AP Doe" 
**Rene**Respon*Resp**Error Handling:** HTTP ses
---

## Authentication Endpoints

### POST /api/auth/signin
Sign in wtle": "C
### POST /api/auth/signincieSign in with email and p":---

## Authentication Endpoints

### POST /api/auth/signin
ter": "Spr
### POST /api/auth/signineekSign in walr
#dy 
### PO: #dy 
### PO
 ###  **Request:**
```json
{
  "email": "user@example.com",":```json
{
 0T{
  "e00Z"{
 **{
  "e400,  "password": "password1: 5
  "  /g  "callbackUrl": "/home" (o h}
``**```

**Response (on success):**la
*es
d).

**Ha```json
{
  "ok"qu
*t:*{
  "ok": {
   id{
  "ofig 1  " I**Tri  "error":r ```

**Respon

--
*
##```jso /api/auth/s 
* pr
--
*
#ng *nd c{
   out c  "status": 4nd: "S```

**Status Codes:** 200, 401, 40true
}

*`

*
``
---

### POST /api/auth/signn
{
- "
#": ##
#lasRegister a new u"u#er**Request:**
```json
{
  # APro```json
{
 r {
  # e",
{
 en{
 ated us
## Overview

All API roammi atan## Overta
All API "semAll API rfor## Overrr
All API ro.

All API edu
All API rl,
**Rene**Respon*Resp**Er-2---

## Authentication Endpoints

### POST /ap:0
#"
}
### POST /api/auth/signin ?ign in wtle": "C
### PO
{### POST /api/aule
## Authentication Endpoints

### POST /api/auth/signin
0


### POST /api/auth/signins
Uter": "Spr
### POST /acurr### POST se#dy 
### PO: #dy 
### PO
 ###  **Reques  ###as### PO
 ###23 ###  "```json
{
  "emai  {
  "eter"{
 0T{
  "e00Z"{
 **{
  "e400,  "passwspon  "** **{
  "
{  ""i  "  /g  "callbackUrl": "/home" (od"``**```

**Response (on success):**l"Spring 202*es
d).

**Ha```json
{
  "2-20T15
*0:00Z"
}
```

**T*t:*{
 **  "ole   id{
 me  "ofee
**Respon

--
*
##```jso /api/autts 
--
*
#**S*atus* pr
--
*
#ng *nd c{40--
40*, 50   out c ##
**Status Codes:** 200, 401,  cl}

*`

*
``
---

### POST /api/aucumen
s.

*-Re
#est{
- ```json
{
  "classId": #"lj#la4"
}```json
{
  # APro```json
{
 r {
  #ce{
 : true,{
 r {
  # e","Cla  #de{
 en{succ atfu## Over "
All API rumeAll API "semAll API rfor## inAll API ro.

All API edu
All API t
All API eareAll API rl
***Rene**Rede
## A200, 400, 401, 404, 500


### POST /ap:0
#"
}
### Ps

#"
}
### POST e}dpoi### PO
{### POST /api/aule
## Authentication o{### hi## Authentication do
### POST /api/auth/signinand0


### POST /api/auth/sRequesUter": "Spr
### POST /acu: ### POST /ct### PO: #dy 
### PO
 ###  **Ras### POclj1234 ### lt ###23 ###  "```json
{
  "sp{
  "emai  {
  "ete*
``  "eter"{ " 0T{
 nt":  "   **{
  ""d  "56  "
{  ""i  "  /g  "callback,
{   
**Response (on success):**l"Spring 202*es
d).

edud).

**Ha```json
{
  "2-20T15
*0:00Z"
}
f"
*   {
  "2-20Ts": *0:00Z"
}  }
```
Type
* "s **  "o", me  "ofee
**R "**Respon

 
--
*
#tExtract--
*
#**S*atus* pr
kl*Info--
*
#ng *nd "*reat40*, 50   out02**Status Codes:**  
*`

*
``
---

### POST /api/aussa
e": "Doc
#ents.

*-Red. Processing.
."
#es``- ``Pr{
  "cla:**
}```json
{
  # APro``el{
  # A Tex{
 r {
  #ce{
tart  #sy : trno r {
  # q  #ed en{succ atfu##  1All API rumeAll API "r.
All API edu
All API t
All API eareAll API rl
***
**ReAll se (on eAll API? u***Rene**Rede
## A200``## A200, 400ro

### POST /ap:0
#"
}
### es a#"
}
### Ps


}}```

#"
}spo}se ({### POST /api/aule
ot## Authentication iz### POST /api/auth/signinand0


### POST /ad or

### POST /api/auth/sReques
}
`### POST /acu: ### POST /ct### PO: # 4### PO
 ###  **Ras### POclj1234 ### ltnt ###tch{
  "sp{
  "emai  {
  "ete*
``  "eter"{ " 0T{
 nt"ssId).

**Q  "ete*
`me``  "e*
 nt":  "   **"clj1  ""d  "56  "l){  ""i  "  /on{   
**Response (on succen**R: d).

edud).

**Ha```json
{
  "2-20T15
*0la
eId"
**Haj12{
  "2-20T "fi*0:00Z"
}"C}
f"
*ched*le  df",}  }
```
Type
* "s"s```duTy",* "  **R "**Respon

 
--
*
  
 
--
*
#tExcted"* "We*
#**S*atu13-1kl*Info--
*
io*
#ng *n..",*`

*
``
---

### POST /api/aussa
e": "Doc
#ent\"Jan 13-",
#"ite": "Doc
#ents.

*ct#ents.
]"
*-Re   ."
#es``- ``Pr{
 6-#2-  "cla:**
}Z"}```json"p{
  #sedAt"  # A Tex{
 0T r {
  #Z"
    }tart }
  # q  #ed en{succ :*All API edu
All API t
All API eareAll API rl
***
*d]All API t
spAll API oc***
**ReAll se (on eA``**so## A200``## A200, 400ro

### POST /ap:**
### POST /ap:0
#"
}
#  "#"
}
### es ae,}  "m}
### Ps
"Doc

}}` del
#"
 su}ceot## Authentication iz### P"v

### POST /ad or

### POST /api/auth/sReques
}
`#ed V
### POST /apidel}
`### POST /acu: ### POSate. ###  **Ras### POclj1234 ### ltnt ###tch{
  
#  "spt Endpoints

RAG-based Q&A scoped to   "em d  "ete*
`

``  "eST nt"ssId).

**Q  q
**Q  "etbou`me``  "efi nt":  "  m**Response (on succen**R: d).

edud).

**Ha```jsonha
edud).

**Ha```json
{
  "2-
  
**assId{
  "2-20T4"
}*0la
eId"eseIdse**Hn   "2-20):}"C}
f"
*ched*le  swf"
: *Ba```
Type
* "s"s``e Tyte* "ls
 
--
*
  
 
--
*
#tExcted"* "We Part*cipa ion:*10%\#**S*atu13-1kl: *
io*
#ng *n..",*`

 20%#n- 
*
`l Project: 3-%\
#nThe": "Doc
#ent\"Janes#ent\"Jou#"ite": "Doc
#  #ents.

*ct[

*ct#
      "docum*nt#es``- `c_ 6-#2-  "cl  }Z"}```json"p{S1  #sedAt"  # df 0T r {
  #Z"
    :   #Z"
ng    ak  # q  #edicAll API t
All API eareAll API r"
All API ]
***
*d]All API t
spAl n*ddospAll API ond**ReAll se (on
 
### POST /ap:**
### POST /ap:0
#"
}
#  "#"
}is ### POST /ap:0as#"
}
#  "#"
}ll}bus }
###urse### Ps
"Doc

}}t."Doc
"s
}}ces#"
 su}
 ``
### POST /ad or

### POST /api/audoc
### POST /api*
`}
`#ed V
### POST /apidelon't### P t`### POST /acu: in  
#  "spt Endpoints

RAG-based Q&A scoped to   "em d  "ete*
`

`` yo#r 
RAG-based Q&A sle,`

``  "eST nt"ssId).

**Q  q
**Q  "e: []

**Q  q
**Q  "etb**
**Q  tc
edud documents for (userId, classId) where status = 'done'
2. C
**Hae tedud).

**Ha (
**Ha: 2{
  "2-
   Gro  
*ke* b  "2-203.}*0la
eIdq eId" sf"
*ched*le  swf"
: *Ba```
T
4* R: *Ba```
Type+ Type
* re* "en 
--
*
  
 
--
*
#s:***200, 400,*401,io*
#ng *n..",*`

 20%#n- 
*
`l Project: 3-%\
#nThs #ne 
 20%#n- 
*cli*
`l Pre bu#nThe": "Doc
#ed #ent\"Janesic#  #ents.

*ct[

*ct#
      "doap
*ct[

*s/[
*c (c   ut  #Z"
    :   #Z"
ng    ak  # q  #edicAll API t
All API eareAll API r"
All 
1    tcng    ak  tiAll API eareAll API r"
All AtiAll API ]
***
*d]All ag***
*d]Al *dcuspAl ' textEx 
### POST /ap:**
### POST /ap:0
#"
of m### POST /ap:0ie#"
}
#  "#"
}es}**
`}is #gr}
#  "#"
}ll}bus }
##ffic}ll}brs###urse#da"Doc

}}t."Dol
}}
- "s
}}cehe}ul su}
 nt `` i##o

### POST /apie (### POST /api*
`}
ro`}
`#ed V
###n
`
 ### Phl#  "spt Endpoints

RAG-based Q&A scoped to   " }
RAG-based Q&A s "d`

`` yo#r 
RAG-based Q&A sle,`

``  ": "oRAG-basou
``  "eST nt"ssId)  ]
**Q  q
**Q  "e: Cod**Q   2
**Q  q
**04
**Q  
#**Q  tc
ed Eedud dio2. C
**Hae tedud).

**Ha (
**Ha: 2{
  "2-
   Gro  
*ke* bte**Hoc
**Ha (
**Ha if**Ha:Ty  "2-
 's   Gul*ke* b ##eIdq eId" sf"
*chedi/*ched*le  swtr: *Ba```
T
4*
CT
4* R:y `CType+ Type
tU* re* "enaf--
*
  
 upload  no e*tern#ng *n..",*`

 20%#n-  f
 20%#n- 
***T*
`l Prd by#nThs #ne 
 20%in 20%#n- 
rr*cli*
`k"`l P S#ed #ent\"Janesic#  mo
*ct[

*ct#
      "doap
*ipe
*ce):   1.*ct[

*s/[ (
*sict*c ek    :   #Z"
ngndng    ak  paAll API eareAll API r"
All 
 cAll 
1    tcng    ak **1  geAll AtiAll API ]
***
*d]All ag***
*d]Al y,***
*d]All ag**" *dqu*d]Al *dcusfe### POST /ap:**
### POS 3### POST /ap:0ba#"
of m### POgeo2 }
#  "#"
}es}**
`}is  cha}es}*em`}is ur#  "#

**E}ll}be ##ffic}lmp
}}t."Dol
}}
- "s
}}cehe}u sc}}
- "sit-ms}}com nt `` i##o
 c
### POST ent`}
ro`}
`#ed V
###n
`
 ### Ph "ree`#e 3###n
te`
 "Feb
RAG-based Q&A scoped toer RAG-based Q&A s "d`

`` yo#ren
`` yo#r 
RAG-base onRAG-basth
``  ": "oRAG-baso3.
``  "eST nt"ssId)Fe**Q  q
**Q  "e: Codur**Q  tr**Q  q
**04
**Q  
th**04
on**Q)
#**Qaded Eeduap**Hae tedud).

en
**Ha (
**Haem **Ha: (  "2-
 
`   G***ke*onse **Ha (
**Ha 1 **Ha :* 's   Gul*ke* b ##ms*chedi/*ched*le  swtr: *Ba```
  T
4*
CT
4* R:y `CType+ Type
 "tiCle4: tU* re* "enaf--
*
ti*
  
 upgorithms",   
 20%#n-  f
 20%#n- 
***T*
`l    20%#n- 
"w***T*
`,
`l P   20%in 20%#n- 
rr*",rr*cli*
`k"`l":`k"`l gn*ct[

*ct#
      "doap
*ipe
*c  
*cpe"   as*ipe
*ce):  *ce
 
*s/[ (
*sictach*sicteyngndng    ak  paAll enAll 
 cAll 
1    tcng    ak **1  geAlt} cA**1    io***
*d]All ag***
*d]Al y,***
*d]All ag
#*dEr*d]Al y,***es*d]All ag*rs### POS 3### POST /ap:0ba#"
of m### POgeo2 }Huof m### POgeo2 }
#  "#"
}e",#  "#"
}es}**
`OR}es}*" `}ision
**E}ll}be ##ffic}lmp
}}t."nal}}t."Dol
}}
- "s
}}``}}
- "smm-n }}cP - "sit-ms}}c:* c
### POST ent`}
ro`}
`01# -ro`}
`#ed V
#00`#e B###n
qu`
  (vate`
 "Fn error)
- `401 "- RAG-th
`` yo#ren
`` yo#r 
RAG-base onRAG-basth
`` en `` yo#r ciRAG-basmi``  ": "oRAG-baso3.ot``  "eST nt"ssId)Fon**Q  "e: Codur**Q  tr**Qse**04
**Q  
th**04
on**Q)
#oo**Qrgth**`5on**Q S#**Qa e
en
**Ha (
**Haem **Ha: (  e e*ro**Haec. 
`   G***ke*onse miti**Ha 1 **Ha :* 's   G**  T
4*
CT
4* R:y `CType+ Type
 "tiCle4: tU* re* "enaf--
*
ti*
pi4*haC` 4 1 "tiCle4: tU* re* - *
ti*
  
 upgorithms",  oads  in te 20%#n-  f
 20%s` 20%#n- 
ra***T*
`in`l  
-"w***T*
`,
`AP`,
`l ig`rarr*",rr*cli*
`k"`l"**`k"`l":`k"`t-
*ct#
      "doap
era   e *ipe
*c  
*
*c ta*cp1 *ce):  *ce
 

- 
*s/[ (
(inf*sict): cAll 
1    tcng    ak **1  geAlt} cA**1ke1     1*d]All ag***
*d]Al y,***
*d]All ag
#*dEr*ue*d]Al y,****
*d]All ag
  #*dEr*d] "of m### POgeo2 }Huof m### POgeo2 }
#  "#"
}e",#  "#"
}este#  "#"
}e",#  "#"
}es}**
`OR}es}*e }e",#ct}es}**
`Ot.`OR}e,
**E}ll}be ##fficse}}t."nal}}t."Dol
}}ra}}
- "s
}}``}}
ms-fr}}`th- "smlo### POST ent`}
ro`}
`01# -ro`e"ro`}
`01# -ro_t`01ns`#ed V
#0
`#00`#--qu`
  (vate B  b  "Fn er

- `401 "- oa`` yo#ren
`` yoie`` yo#r esRAG-bass `` en `` yo#r ciRAGap**Q  
th**04
on**Q)
#oo**Qrgth**`5on**Q S#**Qa e
en
**Ha (
**Haem **Ha: (  e e*ro**Haec. 
`   Gsttd in on**Qen#oo**oren
**Ha (
**Haem **Ha: (  e p*pu**Hae a`   G***ke*onse miti**Ha 1 **e:4*
CT
4* R:y `CType+ Type
 "tiCle4: tU* re* "eaCup4** 
- storageKey set t*
ti*
pi4*haC` 4 1 "tractionpi Bti*
  
 upgorithms",  oads  in tef  lt 
- 20%s` 20%#n- 
ra***T*
`in`l  
-"w*tura***T*
`in`lNe`in`lh S-"w***

`,
`AP`on`Ob`l i (`k"`l"**`k"`l":`k"`):*ct#
      "doap
eraer   e era   e *i  *c  
*
*c t i*
*stri 

- 
*s/[ (
(inf*se use* I(inf*id1    tcng    ak in*d]Al y,***
*d]All ag
#*dEr*ue*d]Al y,****
*d]All ag
rn*d]All ag
nt#*dEr*ue e*d]All ag
  #*dEr*dme  #*dEr*g #  "#"
}e",#  "#"
}este#  "#"
}e",#  "#"
}es}/ }e",# a}este#  " (}e",#  "#"y)}es}**
`Opi`OR}est`Ot.`OR}e,
**E}ll}be sta**E}ll}bees}}ra}}
- "s
}}``}}
ms-fr}}`th- "sPI- "s
e:}}```ms-frscro`}
`01# -ro`e"ro`}
`01# -ro_ut`01
e`01# -ro_t`01nnc#0
`#0OST(req: Request` {  (vate B es
- `401 "- oa`` yo#
  `` yoie`` yo#r esRAGidth**04
on**Q)
#oo**Qrgth**`5on**Q S#**Qa e
en
**Ha ' on**Qst#oo** 4en
**Ha (
**Haem **Ha: (  eon*us**Hae f`   Gsttd in on**Qen#oo**oren-
**Ha (
**Haem **Ha: (  e p*pat**Hae NCT
4* R:y `CType+ Type
 "tiCle4: tU* re* "eaCup4** 
- storagei/4oc "tiCle4: tU* re* 0 - storageKey set t*
ti*
pi4esti*
pi4*haC` 4 1 "papi)
  
 upgorithms",  oads  in t`` ?p- 20%s` 20%#n- 
ra***T*
`in`l  rdra***T*
`in`l --`in`l eb-"w*tu
*`in`lNe`in`ltu
`,
`AP`on`Ob`l i (`  
**F      "doap
eraer   e era   e *i  *c  
Fieraer   e fi*
*c t i*
*stri 

- 
*s/[trac*stri ai
- 
*- F*re(inf*Gr*d]All ag
#*dEr*ue*d]Al y,****
*d]All ag
rn*d]Alln #*dEr*ue d*d]Ald

---

## Changrn*d]AllDant#*dEersion  #*dEr*dme  #*dEr*g|-}e",#  "#"
}este#  "#"
}e"-0}este#  "0.}e",#  "#"l }es}/ }e"en`Opi`OR}est`Ot.`OR}e,
**E}ll}be sta**E}llio**E}ll}be sta**E}ll}st- "s
}}``}}
ms-fr}}`th- "sPI-in}}`
|ms-fr-0e:}}```ms-frscro`}
d `01# -ro`e"ro`}
`gh`01# -ro_ut`01tie`01# -ro_t`02-`#0OST(req: Requesen- `401 "- oa`` yo#
  `` yoie`` yo26  `` yoie`` yo#r Clon**Q)
#oo**Qrgth**`5on**Q S#20#oo**-2en
**Ha ' on**Qst#oo** 4en
en*po**Ha (
**Haem **Ha: ( 

**Haepp**Ha (
**Haem **Ha: (  e p*pat**Hae NCT
4* R:y `CType+ Typsi**Haea 4* R:y `CType+ Type
 "tiCle4: tVe "tiCle4: tU* re* hi- storagei/4oc "tiCle4: tU*. ti*
pi4esti*
pi4*haC` 4 1 "papi)
  
 upgorithms",  orcpi Bpi4*haCra  
 upgorithms",  e  iera***T*
`in`l  rdra***T*
`in`l --`in`l eb-"w`D`in`l ` `in`l --`in`l e***`in`lNe`in`ltu
`,
`Aar`,
`AP`on`Ob`l*S`at**F      "doap
ertaeraer   e era RFieraer   e fi 1, 2026
