#!/usr/bin/env python3
"""Editor interactiv de text OpenDocument; folosește doar biblioteca standard."""

import argparse
import io
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile


TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"
SUPPORTED = {
    b"application/vnd.oasis.opendocument.text",
    b"application/vnd.oasis.opendocument.text-template",
}
DEFAULT_DOCUMENT = Path("/Users/danianca/Downloads/Reteta tipizat Regina Maria.pdf")


def load_pdf(source):
    try:
        from pypdf import PdfReader, PdfWriter
        from pypdf.generic import ContentStream, TextStringObject
    except ImportError:
        raise ValueError("Pentru PDF este necesar pypdf: python3 -m pip install pypdf") from None
    reader = PdfReader(source)
    if reader.is_encrypted:
        raise ValueError("PDF criptat; folosește o copie decriptată.")
    if reader.get_fields():
        raise ValueError("Acest editor de text nu modifică PDF-uri cu câmpuri de formular.")
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    paragraphs, bindings, streams = [], [], []
    for number, page in enumerate(writer.pages, 1):
        stream = ContentStream(page.get_contents(), writer)
        streams.append(stream)
        font_name = None
        for operands, operator in stream.operations:
            if operator == b"Tf":
                font_name = operands[0]
            if operator not in (b"Tj", b"TJ"):
                continue
            font = page.get("/Resources", {}).get("/Font", {}).get(font_name)
            font = font.get_object() if font else {}
            supported = (font.get("/Subtype") == "/Type1" and
                         font.get("/BaseFont") in ("/Helvetica", "/Helvetica-Bold", "/Helvetica-Oblique", "/Times-Roman", "/Times-Bold", "/Courier") and
                         font.get("/Encoding") in (None, "/WinAnsiEncoding", "/StandardEncoding"))
            paragraph = ET.Element(TEXT + "p")
            strings = operands if operator == b"Tj" else operands[0]
            for index, value in enumerate(strings):
                if isinstance(value, TextStringObject):
                    span = ET.SubElement(paragraph, TEXT + "span")
                    span.text = str(value)
                    bindings.append((span, strings, index, str(value), supported))
            if visible(paragraph).strip():
                paragraphs.append((f"pagina {number}", paragraph))
    if not paragraphs:
        raise ValueError("PDF fără text editabil; poate necesita OCR.")
    return paragraphs, (writer, streams, bindings)


def validate_pdf_replacement(pdf, chosen, replacement):
    # Fonturile PDF simple nu conțin automat glifele necesare pentru Unicode.
    if not replacement.isascii() or any(ord(char) < 32 for char in replacement):
        raise ValueError("Pentru acest PDF introdu text fără diacritice sau caractere de control (fonturi standard).")
    selected_nodes = {node for paragraph, _, _ in chosen for node in paragraph.iter()}
    for node, _, _, _, supported in pdf[2]:
        if node in selected_nodes and not supported:
            raise ValueError("Fragmentul folosește un font PDF nesuportat pentru modificare.")


def save_pdf(destination, pdf):
    from pypdf.generic import TextStringObject
    writer, streams, bindings = pdf
    for node, operands, index, original, _ in bindings:
        if (node.text or "") != original:
            operands[index] = TextStringObject(node.text or "")
    for page, stream in zip(writer.pages, streams):
        page.replace_contents(stream)
    with destination.open("xb") as output:
        try:
            writer.write(output)
        except BaseException:
            output.close()
            destination.unlink()
            raise


def ask(prompt):
    return input(prompt)


def parse_xml(data):
    # Păstrează prefixele ODF, inclusiv cele folosite în valorile atributelor.
    for _, (prefix, uri) in ET.iterparse(io.BytesIO(data), events=("start-ns",)):
        if prefix != "xml":
            ET.register_namespace(prefix, uri)
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True, insert_pis=True))
    return ET.fromstring(data, parser=parser)


def slots(paragraph):
    """Textul logic poate fi împărțit între mai multe span-uri de formatare."""
    result = []

    def visit(node):
        if node.text:
            result.append((node, "text", node.text))
        for child in node:
            if child.tag in (TEXT + "p", TEXT + "h"):
                # Paragrafele din note/casete sunt listate separat.
                pass
            elif child.tag == TEXT + "s":
                result.append((child, "space", " " * int(child.get(TEXT + "c", "1"))))
            elif child.tag == TEXT + "tab":
                result.append((child, "control", "\t"))
            elif child.tag == TEXT + "line-break":
                result.append((child, "control", "\n"))
            elif isinstance(child.tag, str):
                visit(child)
            if child.tail:
                result.append((child, "tail", child.tail))

    visit(paragraph)
    return result


def visible(paragraph):
    return "".join(value for _, _, value in slots(paragraph))


def replace_range(paragraph, start, end, replacement):
    entries = slots(paragraph)
    offset = 0
    changes = []
    for node, attr, value in entries:
        next_offset = offset + len(value)
        if offset < end and next_offset > start:
            if attr == "control":
                raise ValueError("Alege text fără tab-uri sau întreruperi de linie.")
            left = max(0, start - offset)
            right = min(len(value), end - offset)
            addition = replacement if offset <= start < next_offset else ""
            changes.append((node, attr, value[:left] + addition + value[right:]))
        offset = next_offset
    for node, attr, value in changes:
        if attr == "space":
            # Span-ul înlocuiește doar secvența text:s, cu stilul moștenit.
            node.tag = TEXT + "span"
            node.attrib.clear()
            node.text = value
        else:
            setattr(node, attr, value)


def list_text(paragraphs):
    print("\nTextul documentului (paragrafe, celule, antet/subsol):")
    for number, (part, paragraph) in enumerate(paragraphs, 1):
        print(f"[{number}] ({part}) {visible(paragraph)}")


def find_matches(paragraphs, target):
    found = []
    for number, (_, paragraph) in enumerate(paragraphs, 1):
        value = visible(paragraph)
        offset = 0
        while (start := value.find(target, offset)) >= 0:
            end = start + len(target)
            found.append((paragraph, start, end))
            context = value[max(0, start - 55):start] + "⟦" + target + "⟧" + value[end:end + 55]
            print(f"{len(found)}. Paragraful [{number}]: {context}")
            offset = end
    return found


def select_matches(answer, count):
    if answer.casefold() == "toate":
        return set(range(count))
    try:
        selected = {int(item.strip()) - 1 for item in answer.split(",")}
    except ValueError:
        raise ValueError("Introdu numere separate prin virgulă sau «toate».") from None
    if not selected or min(selected) < 0 or max(selected) >= count:
        raise ValueError("Număr de apariție inexistent.")
    return selected


def save_copy(source, destination, trees, changed_parts):
    # Modul exclusiv împiedică suprascrierea inclusiv a documentului original.
    with destination.open("xb") as stream:
        try:
            with zipfile.ZipFile(source) as original, zipfile.ZipFile(stream, "w") as result:
                result.comment = original.comment
                for item in original.infolist():
                    data = original.read(item)
                    if item.filename in changed_parts:
                        data = ET.tostring(trees[item.filename], encoding="utf-8", xml_declaration=True)
                    result.writestr(item, data)
        except BaseException:
            stream.close()
            destination.unlink()
            raise


def main():
    parser = argparse.ArgumentParser(description="Listează și înlocuiește interactiv text în ODT/OTT sau PDF cu fonturi standard. Originalul rămâne intact.")
    parser.add_argument("document", nargs="?", default=str(DEFAULT_DOCUMENT), help=f"Documentul (implicit: {DEFAULT_DOCUMENT})")
    parser.add_argument("--output", type=Path, help="Copia de salvat (trebuie să nu existe)")
    args = parser.parse_args()
    source = Path(args.document).expanduser().resolve()
    destination = (args.output.expanduser().resolve() if args.output else
                   source.with_name(source.stem + "-modificat" + source.suffix))
    if destination.exists():
        raise ValueError(f"Destinația există deja: {destination}. Alege alta cu --output.")
    trees = {}
    pdf = None
    with source.open("rb") as stream:
        is_pdf = stream.read(5) == b"%PDF-"
    if is_pdf:
        paragraphs, pdf = load_pdf(source)
        print("PDF: se păstrează poziția și fontul textului. Verifică vizual copia pentru texte mai lungi.")
    else:
        paragraphs = load_odf(source, trees)
    if not paragraphs:
        raise ValueError("Nu am găsit text în document.")
    list_text(paragraphs)
    edit_loop(source, destination, trees, paragraphs, pdf)


def load_odf(source, trees):
    with zipfile.ZipFile(source) as archive:
        if archive.read("mimetype").strip() not in SUPPORTED:
            raise ValueError("Fișierul nu este un document ODT/OTT. PDF-ul necesită un editor separat.")
        if any("signatures" in name.lower() for name in archive.namelist()):
            raise ValueError("Documentul este semnat digital; modificarea ar invalida semnătura.")
        if "META-INF/manifest.xml" in archive.namelist():
            manifest = ET.fromstring(archive.read("META-INF/manifest.xml"))
            if any(str(node.tag).endswith("}encryption-data") for node in manifest.iter()):
                raise ValueError("Documentul este criptat. Folosește o copie decriptată.")
        for name in ("content.xml", "styles.xml"):
            if name in archive.namelist():
                trees[name] = parse_xml(archive.read(name))
    paragraphs = [(name, node) for name, root in trees.items() for node in root.iter()
                  if node.tag in (TEXT + "p", TEXT + "h") and visible(node).strip()]
    return paragraphs


def edit_loop(source, destination, trees, paragraphs, pdf=None):
    print("\nAlege NUMĂRUL din listă pentru modificare (ex.: 3).")
    print("Pentru căutare după text: :cauta. Comenzi: :lista, :salveaza, :iesire.")
    changed_parts = set()
    while True:
        target = ask("\nNumărul valorii de modificat (sau :cauta / :salveaza / :iesire): ").strip()
        if target == ":iesire":
            print("Închis fără salvare.")
            return
        if target == ":lista":
            list_text(paragraphs)
            continue
        if target == ":salveaza":
            if not changed_parts:
                print("Nu există modificări de salvat.")
                continue
            if pdf:
                save_pdf(destination, pdf)
            else:
                save_copy(source, destination, trees, changed_parts)
            print(f"Document salvat: {destination}")
            return
        if not target:
            continue
        try:
            row_number = target.removeprefix("#")
            if row_number.isdecimal():
                index = int(row_number) - 1
                if index < 0 or index >= len(paragraphs):
                    raise ValueError(f"Alege un număr între 1 și {len(paragraphs)}.")
                paragraph = paragraphs[index][1]
                target = visible(paragraph)
                chosen = [(paragraph, 0, len(target))]
                print(f"Ai ales [{index + 1}]: {target!r}")
            else:
                if target == ":cauta":
                    target = ask("Valoarea actuală de căutat (text exact): ")
                elif target.startswith(":"):
                    raise ValueError("Comandă necunoscută. Folosește :lista, :cauta, :salveaza sau :iesire.")
                if not target:
                    continue
                found = find_matches(paragraphs, target)
                if not found:
                    print("Valoarea nu apare în text.")
                    continue
                answer = ask("Ce apariții schimbi? Numere cu virgulă / toate / Enter pentru anulare: ")
                if not answer:
                    continue
                selected = select_matches(answer, len(found))
                chosen = [found[index] for index in sorted(selected)]
            # Validează toate aparițiile înainte de orice modificare.
            if "\t" in target or "\n" in target:
                raise ValueError("Alege text fără tab-uri sau întreruperi de linie.")
            replacement = ask("Valoarea nouă (Enter = ștergere): ")
            if pdf:
                validate_pdf_replacement(pdf, chosen, replacement)
            print(f"Propunere: {target!r} → {replacement!r}, în {len(chosen)} apariții.")
            if ask("Aplic modificarea? [da/nu]: ").strip().casefold() != "da":
                continue
            # De la dreapta la stânga, pentru a păstra pozițiile găsite.
            for paragraph, start, end in reversed(chosen):
                replace_range(paragraph, start, end, replacement)
            for name, paragraph in paragraphs:
                if any(paragraph is match[0] for match in chosen):
                    changed_parts.add(name)
            print("Modificare aplicată în memorie. Continuă sau introdu :salveaza.")
        except ValueError as error:
            print(f"Eroare: {error}")


if __name__ == "__main__":
    try:
        main()
    except (EOFError, KeyboardInterrupt):
        print("\nÎnchis fără salvare.")
        sys.exit(130)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        print(f"Eroare: {error}", file=sys.stderr)
        sys.exit(1)
