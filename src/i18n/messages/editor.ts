import { defineMessages } from "../define";

/** One "/" command: what the menu shows, and extra words that find it. */
type SlashText = { title: string; description: string; keywords: string[] };

/**
 * The notes editor: title, placeholders, "/" menu, formatting bubble, note meta, outline,
 * page links, icon picker, quick start and image uploads.
 */
export const editorText = defineMessages({
  en: {
    untitled: "Untitled",
    titleLabel: "Page title",
    contentLabel: "Note content",
    broken: "Part of this note uses blocks Blob can't show yet, so editing is paused to keep the original safe. The title can still be changed.",

    placeholder: {
      /** Empty note while you're in it (and the slash hint). */
      empty: "Start writing, or type '/' for commands…",
      /** Empty note when the editor isn't focused. */
      emptyIdle: "Start writing…",
      /** The empty line holding the caret. */
      line: "Type '/' for commands…",
      heading: (level: number) => `Heading ${level}`,
      list: "List",
      todo: "To-do",
      quote: "Quote",
      callout: "Key idea…",
      /** After a lone "/", until you type. */
      slashQuery: "Type to filter…",
    },

    slash: {
      label: "Insert block",
      noMatch: "No blocks match",
      quote: (q: string) => `“${q}”`,
      navigate: "navigate",
      insert: "insert",
      close: "close",
      groups: { basic: "Basic blocks", lists: "Lists", school: "For school", media: "Media", advanced: "Advanced" },
      items: {
        text: { title: "Text", description: "Just start writing plain text", keywords: ["paragraph", "plain", "body", "p"] },
        h1: { title: "Heading 1", description: "Big section heading", keywords: ["title", "big", "large", "h1"] },
        h2: { title: "Heading 2", description: "Medium section heading", keywords: ["subtitle", "medium", "h2"] },
        h3: { title: "Heading 3", description: "Small section heading", keywords: ["subheading", "small", "h3"] },
        quote: { title: "Quote", description: "Capture a quotation", keywords: ["blockquote", "citation", "cite"] },
        divider: { title: "Divider", description: "Visually split sections", keywords: ["hr", "horizontal", "rule", "line", "separator"] },
        bullet: { title: "Bulleted list", description: "A simple list of points", keywords: ["unordered", "ul", "bullets", "points"] },
        numbered: { title: "Numbered list", description: "Steps in order", keywords: ["ordered", "ol", "numbers", "steps"] },
        todo: { title: "To-do list", description: "Track homework with checkboxes", keywords: ["task", "checkbox", "checklist", "todo", "check"] },
        image: { title: "Image", description: "Upload a picture or diagram", keywords: ["picture", "photo", "upload", "img", "diagram", "screenshot"] },
        code: { title: "Code block", description: "Write a snippet of code", keywords: ["snippet", "pre", "program", "monospace"] },
        callout: { title: "Callout", description: "Make a key idea stand out", keywords: ["note", "tip", "info", "important", "box", "highlight"] },
        subpage: { title: "Sub-page", description: "Nest a new page inside this one", keywords: ["page", "child", "nested", "new", "link"] },
        pageRef: { title: "Link to page", description: "Link to another note in the text", keywords: ["link", "mention", "reference", "wiki", "page", "backlink"] },
        date: { title: "Today's date", description: "Insert the current date", keywords: ["today", "now", "time", "day"] },
        toggle: { title: "Toggle", description: "Hide content under a line you can open", keywords: ["collapse", "details", "expand", "fold", "hide", "spoiler"] },
        math: { title: "Formula", description: "An equation on its own line", keywords: ["equation", "math", "maths", "latex", "tex", "katex"] },
        mathInline: { title: "Formula in text", description: "Maths inside a sentence ($…$)", keywords: ["inline", "equation", "math", "latex", "dollar"] },
        chem: { title: "Chemical formula", description: "Reactions and molecules like H₂O", keywords: ["chemistry", "reaction", "molecule", "ce", "equation"] },
        flashcard: { title: "Flashcard", description: "Question on the front, answer on the back", keywords: ["card", "learn", "study", "quiz", "question", "answer", "vocab"] },
        definition: { title: "Definition", description: "Explain a term", keywords: ["term", "meaning", "define", "glossary"] },
        rule: { title: "Key rule", description: "Something to remember for the test", keywords: ["remember", "rule", "important", "note", "memo"] },
        example: { title: "Example", description: "A worked example", keywords: ["sample", "for example", "e.g."] },
        warning: { title: "Watch out", description: "A common mistake to avoid", keywords: ["warning", "careful", "mistake", "caution", "attention"] },
        table: { title: "Table", description: "Rows and columns", keywords: ["grid", "rows", "columns", "spreadsheet", "matrix"] },
        diagram: { title: "Diagram", description: "Process, timeline, cycle and more", keywords: ["mermaid", "flowchart", "chart", "timeline", "sequence", "pie", "graph"] },
        mindmap: { title: "Mind map", description: "Ideas around a topic", keywords: ["mindmap", "brainstorm", "ideas", "map", "diagram"] },
        sketch: { title: "Sketch", description: "Draw with your mouse, pen or finger", keywords: ["draw", "drawing", "pen", "handwriting", "doodle", "paint", "scribble"] },
        file: { title: "File", description: "Attach a PDF, worksheet, audio or other file", keywords: ["attach", "attachment", "pdf", "upload", "document", "worksheet", "audio", "video"] },
        lesson: { title: "Lesson", description: "Link a topic of the learning center", keywords: ["learn", "topic", "practice", "learning center", "exercise"] },
        deck: { title: "Presentation", description: "Show one of your presentations", keywords: ["slides", "deck", "present", "embed", "slideshow"] },
        plot: { title: "Function plot", description: "Graphs of f(x), with zoom", keywords: ["graph", "function", "plot", "curve", "parabola", "coordinate", "axis", "chart"] },
      } satisfies Record<string, SlashText>,
    },

    bubble: {
      turnInto: "Turn into",
      blocks: {
        text: "Text",
        h1: "Heading 1",
        h2: "Heading 2",
        h3: "Heading 3",
        bullet: "Bulleted list",
        numbered: "Numbered list",
        todo: "To-do list",
        quote: "Quote",
      },
      bold: "Bold",
      italic: "Italic",
      underline: "Underline",
      strike: "Strikethrough",
      code: "Inline code",
      highlight: "Highlight",
      formula: "Formula",
      addLink: "Add link",
      editLink: "Edit link",
      /** Keyboard names in shortcut hints off a Mac ("Ctrl+B", "Ctrl+Shift+S"). */
      ctrl: "Ctrl+",
      shift: "Shift+",
      linkPlaceholder: "Paste or type a link…",
      linkAddress: "Link address",
      applyLink: "Apply link",
      apply: "Apply",
      openLink: "Open link",
      removeLink: "Remove link",
    },

    meta: {
      edited: {
        justNow: "Edited just now",
        minutes: (n: number) => `Edited ${n} min ago`,
        hours: (n: number) => `Edited ${n} hr ago`,
        yesterday: "Edited yesterday",
        weekday: (day: string) => `Edited ${day}`,
        date: (date: string) => `Edited ${date}`,
      },
      /** date-fns patterns for older edits. */
      weekdayFormat: "EEEE",
      dateFormat: "MMM d",
      dateYearFormat: "MMM d, yyyy",
      words: (n: number, formatted: string) => `${formatted} ${n === 1 ? "word" : "words"}`,
      minRead: (n: number) => `${n} min read`,
      changeSubject: "Change subject",
      addSubject: "Add subject",
      subject: "Subject",
      noSubject: "No subject",
    },

    outline: "On this page",

    pageLink: {
      open: (title: string) => `Open ${title}`,
      trashed: "This page was moved to the trash",
      inTrash: "in trash",
    },

    icon: {
      pick: "Pick an icon",
      random: "Random",
      remove: "Remove",
      use: (emoji: string) => `Use ${emoji}`,
      change: "Change icon",
      add: "Add icon",
    },

    quickStart: { heading: "Heading", checklist: "Checklist", flashcard: "Flashcard", image: "Image" },

    upload: {
      uploading: "Uploading…",
      badType: "I can add PNG, JPG, GIF or WebP images.",
      tooBig: "That image is over 10 MB. Try a smaller one?",
      failed: "That upload didn't work. Check your connection and try again?",
    },

    /** Working on a shared note together. */
    together: {
      viewOnly: "You can read this note. Ask its owner if you want to edit it too.",
      offline: "No connection. Your changes are kept and sent as soon as you're back.",
      catchingUp: "Catching up with the others…",
      switching: "One moment, getting the note ready for working together…",
      carryFailed: "Someone else wrote here at the same time. Your last change couldn't be brought over, so please check the note.",
    },

    study: {
      label: "Learn",
      title: "Learn this note",
      intro: "Turn this note into something to learn with.",
      cards: "Flashcards",
      cardsHint: "Learn it card by card",
      quiz: "Quiz",
      quizHint: "Test what you know",
      summary: "Summary",
      summaryHint: "The key points at a glance",
      due: (n: number) => (n === 1 ? "1 card due today" : `${n} cards due today`),
    },
  },
  de: {
    untitled: "Ohne Titel",
    titleLabel: "Seitentitel",
    contentLabel: "Inhalt der Notiz",
    broken:
      "Ein Teil dieser Notiz nutzt Blöcke, die Blob noch nicht anzeigen kann. Damit das Original sicher bleibt, ist das Bearbeiten pausiert. Den Titel kannst du trotzdem ändern.",

    placeholder: {
      empty: "Schreib einfach los oder tippe „/“ für Befehle…",
      emptyIdle: "Schreib einfach los…",
      line: "Tippe „/“ für Befehle…",
      heading: (level) => `Überschrift ${level}`,
      list: "Liste",
      todo: "To-do",
      quote: "Zitat",
      callout: "Merksatz…",
      slashQuery: "Tippen zum Filtern…",
    },

    slash: {
      label: "Block einfügen",
      noMatch: "Kein Block passt zu",
      quote: (q) => `„${q}“`,
      navigate: "auswählen",
      insert: "einfügen",
      close: "schließen",
      groups: { basic: "Grundblöcke", lists: "Listen", school: "Für die Schule", media: "Medien", advanced: "Erweitert" },
      items: {
        text: { title: "Text", description: "Schreib einfach normalen Text", keywords: ["absatz", "normal", "fließtext", "fliesstext"] },
        h1: { title: "Überschrift 1", description: "Große Abschnittsüberschrift", keywords: ["titel", "groß", "gross", "h1"] },
        h2: { title: "Überschrift 2", description: "Mittlere Abschnittsüberschrift", keywords: ["untertitel", "mittel", "h2"] },
        h3: { title: "Überschrift 3", description: "Kleine Abschnittsüberschrift", keywords: ["zwischenüberschrift", "klein", "h3"] },
        quote: { title: "Zitat", description: "Halte ein Zitat fest", keywords: ["zitieren", "quelle", "spruch"] },
        divider: { title: "Trennlinie", description: "Trennt Abschnitte voneinander", keywords: ["linie", "strich", "trenner", "trennen", "hr"] },
        bullet: { title: "Aufzählung", description: "Eine einfache Liste mit Punkten", keywords: ["liste", "punkte", "stichpunkte", "ul"] },
        numbered: { title: "Nummerierte Liste", description: "Schritte der Reihe nach", keywords: ["nummern", "zahlen", "schritte", "reihenfolge", "ol"] },
        todo: { title: "To-do-Liste", description: "Hausaufgaben zum Abhaken", keywords: ["checkliste", "aufgaben", "abhaken", "kästchen", "todo"] },
        image: { title: "Bild", description: "Lade ein Foto oder eine Skizze hoch", keywords: ["foto", "hochladen", "grafik", "diagramm", "skizze", "screenshot"] },
        code: { title: "Codeblock", description: "Schreib ein Stück Code", keywords: ["programm", "quelltext", "programmieren"] },
        callout: { title: "Merkkasten", description: "Hebt einen wichtigen Gedanken hervor", keywords: ["merke", "merksatz", "hinweis", "tipp", "wichtig", "kasten", "box", "info"] },
        subpage: { title: "Unterseite", description: "Eine neue Seite in dieser Seite", keywords: ["seite", "neu", "verschachtelt", "verlinken"] },
        pageRef: { title: "Link zu Seite", description: "Im Text auf eine andere Notiz verlinken", keywords: ["link", "verlinken", "verweis", "seite", "notiz", "querverweis"] },
        date: { title: "Heutiges Datum", description: "Fügt das aktuelle Datum ein", keywords: ["heute", "datum", "jetzt", "tag"] },
        toggle: { title: "Aufklappbar", description: "Inhalt unter einer Zeile verstecken", keywords: ["aufklappen", "zuklappen", "einklappen", "verstecken", "ausklappen"] },
        math: { title: "Formel", description: "Eine Gleichung in eigener Zeile", keywords: ["gleichung", "mathe", "rechnung", "latex", "term"] },
        mathInline: { title: "Formel im Text", description: "Mathe mitten im Satz ($…$)", keywords: ["gleichung", "mathe", "latex", "dollar", "im satz"] },
        chem: { title: "Chemische Formel", description: "Reaktionen und Moleküle wie H₂O", keywords: ["chemie", "reaktion", "reaktionsgleichung", "molekül", "summenformel"] },
        flashcard: { title: "Karteikarte", description: "Vorne die Frage, hinten die Antwort", keywords: ["karte", "lernen", "abfragen", "vokabel", "frage", "antwort"] },
        definition: { title: "Definition", description: "Einen Begriff erklären", keywords: ["begriff", "bedeutung", "erklärung", "fachbegriff"] },
        rule: { title: "Merksatz", description: "Etwas, das du dir für den Test merkst", keywords: ["merke", "regel", "wichtig", "merken"] },
        example: { title: "Beispiel", description: "Ein Beispiel mit Lösung", keywords: ["zum beispiel", "musteraufgabe", "z. b."] },
        warning: { title: "Achtung", description: "Ein typischer Fehler", keywords: ["vorsicht", "fehler", "aufpassen", "warnung", "falle"] },
        table: { title: "Tabelle", description: "Zeilen und Spalten", keywords: ["zeilen", "spalten", "raster", "wertetabelle"] },
        diagram: { title: "Diagramm", description: "Ablauf, Zeitstrahl, Kreislauf und mehr", keywords: ["mermaid", "ablauf", "zeitstrahl", "flussdiagramm", "kreislauf", "kreisdiagramm", "schaubild"] },
        mindmap: { title: "Mindmap", description: "Ideen rund um ein Thema", keywords: ["gedankenkarte", "brainstorming", "ideen", "diagramm"] },
        sketch: { title: "Skizze", description: "Zeichne mit Maus, Stift oder Finger", keywords: ["zeichnen", "zeichnung", "malen", "stift", "handschrift", "kritzeln"] },
        file: { title: "Datei", description: "PDF, Arbeitsblatt, Audio oder andere Datei anhängen", keywords: ["anhang", "anhängen", "pdf", "hochladen", "dokument", "arbeitsblatt", "audio", "video"] },
        lesson: { title: "Lektion", description: "Ein Thema aus dem Lernbereich verlinken", keywords: ["lernen", "thema", "üben", "lernbereich", "übung"] },
        deck: { title: "Präsentation", description: "Eine deiner Präsentationen zeigen", keywords: ["folien", "referat", "präsentieren", "einbetten", "vortrag"] },
        plot: { title: "Funktionsgraph", description: "Graphen von f(x), mit Zoom", keywords: ["graph", "funktion", "parabel", "gerade", "koordinatensystem", "schaubild", "kurve", "achse"] },
      },
    },

    bubble: {
      turnInto: "Umwandeln in",
      blocks: {
        text: "Text",
        h1: "Überschrift 1",
        h2: "Überschrift 2",
        h3: "Überschrift 3",
        bullet: "Aufzählung",
        numbered: "Nummerierte Liste",
        todo: "To-do-Liste",
        quote: "Zitat",
      },
      bold: "Fett",
      italic: "Kursiv",
      underline: "Unterstrichen",
      strike: "Durchgestrichen",
      code: "Code im Text",
      highlight: "Textmarker",
      formula: "Formel",
      addLink: "Link einfügen",
      editLink: "Link bearbeiten",
      ctrl: "Strg+",
      shift: "Umschalt+",
      linkPlaceholder: "Link einfügen oder eintippen…",
      linkAddress: "Linkadresse",
      applyLink: "Link übernehmen",
      apply: "Übernehmen",
      openLink: "Link öffnen",
      removeLink: "Link entfernen",
    },

    meta: {
      edited: {
        justNow: "Gerade bearbeitet",
        minutes: (n) => `Bearbeitet vor ${n} Min.`,
        hours: (n) => `Bearbeitet vor ${n} Std.`,
        yesterday: "Gestern bearbeitet",
        weekday: (day) => `Bearbeitet am ${day}`,
        date: (date) => `Bearbeitet am ${date}`,
      },
      weekdayFormat: "EEEE",
      dateFormat: "d. MMM",
      dateYearFormat: "d. MMM yyyy",
      words: (n, formatted) => `${formatted} ${n === 1 ? "Wort" : "Wörter"}`,
      minRead: (n) => `${n} Min. Lesezeit`,
      changeSubject: "Fach ändern",
      addSubject: "Fach hinzufügen",
      subject: "Fach",
      noSubject: "Kein Fach",
    },

    outline: "Auf dieser Seite",

    pageLink: {
      open: (title) => `„${title}“ öffnen`,
      trashed: "Diese Seite liegt im Papierkorb",
      inTrash: "im Papierkorb",
    },

    icon: {
      pick: "Symbol auswählen",
      random: "Zufällig",
      remove: "Entfernen",
      use: (emoji) => `${emoji} verwenden`,
      change: "Symbol ändern",
      add: "Symbol hinzufügen",
    },

    quickStart: { heading: "Überschrift", checklist: "Checkliste", flashcard: "Karteikarte", image: "Bild" },

    upload: {
      uploading: "Wird hochgeladen…",
      badType: "Ich kann PNG-, JPG-, GIF- und WebP-Bilder einfügen.",
      tooBig: "Das Bild ist größer als 10 MB. Hast du ein kleineres?",
      failed: "Das Hochladen hat nicht geklappt. Prüf deine Verbindung und versuch es nochmal.",
    },

    together: {
      viewOnly: "Du kannst diese Notiz lesen. Frag die Besitzerin oder den Besitzer, wenn du mitschreiben möchtest.",
      offline: "Keine Verbindung. Deine Änderungen bleiben erhalten und werden gesendet, sobald du wieder online bist.",
      catchingUp: "Hole die Änderungen der anderen…",
      switching: "Einen Moment, die Notiz wird fürs gemeinsame Arbeiten vorbereitet…",
      carryFailed: "Jemand hat gleichzeitig hier geschrieben. Deine letzte Änderung ließ sich nicht übernehmen, schau bitte kurz drüber.",
    },

    study: {
      label: "Lernen",
      title: "Mit dieser Notiz lernen",
      intro: "Mach aus dieser Notiz etwas zum Lernen.",
      cards: "Karteikarten",
      cardsHint: "Lerne sie Karte für Karte",
      quiz: "Quiz",
      quizHint: "Teste, was du schon weißt",
      summary: "Zusammenfassung",
      summaryHint: "Das Wichtigste auf einen Blick",
      due: (n) => (n === 1 ? "1 Karte ist heute dran" : `${n} Karten sind heute dran`),
    },
  },
});

export type EditorText = (typeof editorText)["en"];
