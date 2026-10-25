import { defineMessages } from "../define";

/**
 * Projects and the rest of Blob: the cards a page is on, "Add to project", a project's materials and
 * shared note, the projects of a subject, and today's calendar on Home.
 */
export const projectLinksText = defineMessages({
  en: {
    // A page and its project cards
    inProjects: (n: number) => (n === 1 ? "1 project" : `${n} projects`),
    inProjectsTitle: "On project cards",
    cardDone: "done",
    archived: "archived",
    addToProject: "Add to project",
    addTitle: (page: string) => `Add “${page}” to a project`,
    addHint: "It becomes a new card in the project, with the page attached.",
    cardTitle: "Card title",
    shareWithGroup: "Share the page with the people in the project",
    shareWithGroupHint: (n: number) => (n === 1 ? "1 person can then open and edit it." : `${n} people can then open and edit it.`),
    alone: "Only you are in this project.",
    noProjects: "You don’t have a project to add cards to yet.",
    newProject: "New project",
    add: "Add",
    added: (project: string) => `Added to “${project}”.`,
    addedShared: (project: string) => `Added to “${project}” and shared with the group.`,
    failed: "That didn’t work. Try again?",
    alreadyThere: "already on a card",

    // A project's materials
    materials: "Materials",
    materialsTitle: "Everything attached to the cards",
    materialsEmpty: "Nothing attached yet. Notes, presentations, files and links you add to cards show up here.",
    groups: { pages: "Notes and presentations", files: "Files", links: "Links" },
    onCard: (card: string) => `on “${card}”`,
    noAccess: "Not shared with you",
    newNote: "New shared note",
    newNoteHint: "For everyone in the project, on a card of its own",
    noteTitle: (project: string) => `${project}: notes`,
    noteCard: "Shared notes",
    noteMade: "Here is your shared note. Everyone in the project can work on it.",
    noteMadeAlone: "Here is your project note. Invite people to the project and they can work on it too.",

    // A subject's projects
    projects: "Projects",
    newProjectFor: "New project",

    // Home: today in the calendar
    today: "Today",
    tomorrow: "Tomorrow",
    calendar: "Calendar",
    allDay: "All day",
    now: "now",
    more: (n: number) => `${n} more`,
  },
  de: {
    inProjects: (n: number) => (n === 1 ? "1 Projekt" : `${n} Projekte`),
    inProjectsTitle: "Auf Projektkarten",
    cardDone: "erledigt",
    archived: "archiviert",
    addToProject: "Zu Projekt hinzufügen",
    addTitle: (page: string) => `„${page}“ zu einem Projekt hinzufügen`,
    addHint: "Es wird eine neue Karte im Projekt, an der die Seite hängt.",
    cardTitle: "Titel der Karte",
    shareWithGroup: "Seite mit den Leuten im Projekt teilen",
    shareWithGroupHint: (n: number) => (n === 1 ? "Dann kann 1 Person sie öffnen und bearbeiten." : `Dann können ${n} Personen sie öffnen und bearbeiten.`),
    alone: "In diesem Projekt bist nur du.",
    noProjects: "Du hast noch kein Projekt, zu dem du Karten hinzufügen kannst.",
    newProject: "Neues Projekt",
    add: "Hinzufügen",
    added: (project: string) => `Zu „${project}“ hinzugefügt.`,
    addedShared: (project: string) => `Zu „${project}“ hinzugefügt und mit der Gruppe geteilt.`,
    failed: "Das hat nicht geklappt. Nochmal versuchen?",
    alreadyThere: "schon auf einer Karte",

    materials: "Unterlagen",
    materialsTitle: "Alles, was an den Karten hängt",
    materialsEmpty: "Noch hängt nichts an den Karten. Notizen, Präsentationen, Dateien und Links von Karten erscheinen hier.",
    groups: { pages: "Notizen und Präsentationen", files: "Dateien", links: "Links" },
    onCard: (card: string) => `an „${card}“`,
    noAccess: "Nicht mit dir geteilt",
    newNote: "Neue gemeinsame Notiz",
    newNoteHint: "Für alle im Projekt, auf einer eigenen Karte",
    noteTitle: (project: string) => `${project}: Notizen`,
    noteCard: "Gemeinsame Notizen",
    noteMade: "Hier ist eure gemeinsame Notiz. Alle im Projekt können daran arbeiten.",
    noteMadeAlone: "Hier ist deine Projektnotiz. Lädst du Leute ins Projekt ein, können sie mitschreiben.",

    projects: "Projekte",
    newProjectFor: "Neues Projekt",

    today: "Heute",
    tomorrow: "Morgen",
    calendar: "Kalender",
    allDay: "Ganztägig",
    now: "jetzt",
    more: (n: number) => (n === 1 ? "1 weiterer" : `${n} weitere`),
  },
});
