# Modificarea interactivă a unui document

Necesită Bash și Python 3; pentru PDF folosește biblioteca `pypdf` (deja disponibilă în mediul curent).

```bash
bash /Users/danianca/ancavisuals/scripts/modifica-document.sh
```

Fără argument, deschide `/Users/danianca/Downloads/Reteta tipizat Regina Maria.pdf`.
Poți specifica alt document și o destinație explicită:

```bash
bash scripts/modifica-document.sh "/cale/document.odt" --output "/cale/document-nou.odt"
```

1. Scriptul afișează textul numerotat. În PDF, fiecare fragment de text are un număr; în ODT, fiecare paragraf are un număr.
2. Introdu **numărul din listă**, de exemplu `3` sau `#3`. Îți arată valoarea aleasă.
3. Introdu valoarea nouă. Enter înseamnă ștergerea valorii alese.
4. Verifică propunerea și răspunde `da` pentru aplicare în memorie.
5. Repetă pentru alte valori. `:lista` afișează textul actualizat; `:salveaza` scrie copia; `:iesire` renunță fără salvare.

Pentru căutare după text, introdu `:cauta`, apoi textul exact. Vezi aparițiile și alegi numerele lor, separate prin virgulă, sau `toate`. Folosește `:cauta` inclusiv pentru a căuta o valoare numerică, precum `28`, în loc de a selecta poziția 28.

Implicit, copia se salvează **lângă original**, cu sufixul `-modificat` și aceeași extensie. Pentru documentul implicit: `/Users/danianca/Downloads/Reteta tipizat Regina Maria-modificat.pdf`. Scriptul refuză suprascrierea unui fișier existent; folosește `--output` pentru alt nume. La EOF sau Ctrl+C, modificările nesalvate se pierd.

Formatul este identificat din conținut: ODT și OTT sunt acceptate, inclusiv un fișier cu extensia `.ocdt` dacă este realmente ODT/OTT. Acceptă și PDF cu text selectabil și fonturi standard simple, precum documentul implicit. PDF-urile cu câmpuri de formular și documentele criptate sunt respinse; ODT-urile semnate digital sunt respinse. DOCX nu este suportat.

În PDF, textul nou păstrează poziția și fontul original. Sunt acceptate înlocuiri ASCII, fără diacritice. Textele mai lungi pot depăși celula, deci verifică vizual copia. Nu modifică textul desenat în imagini, inclusiv imaginea semnăturii/parafei.

„Valorile” sunt textul documentului, nu o interpretare automată a câmpurilor sau a semnificației lor. Căutarea este exactă și sensibilă la majuscule, în interiorul unui paragraf; nu extrage text din imagini, nu editează metadate/atribute și nu recalculează câmpuri automate sau formule. Câmpurile generate pot fi regenerate de LibreOffice la deschidere. Textul înlocuit moștenește stilul de la începutul apariției; modificările lungi pot schimba paginarea. Verifică vizual copia în LibreOffice înainte de utilizare.
