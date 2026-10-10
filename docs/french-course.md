# The French course

A Duolingo-style French course in the learning centre (`/learn/french`). The course is data:
units in `src/learn/french/units/`, registered in `UNITS` of `src/learn/french/course.ts`. The
generator (`generate.ts`) turns a unit into short lessons; nothing about a lesson is written by hand
except its material.

- Types: `src/learn/french/types.ts`
- The reference unit: `src/learn/french/units/u01-bonjour.ts`. Every unit is written like it.
- Check before you commit: `npm run check:french` (or `npm run check:french -- ecole ville` for some
  units). It must report 0 problems and 0 warnings.

## What students do with a unit

Every unit is 7 teaching lessons and a unit review (the 8th, added by `course.ts`: no new words,
the whole unit mixed, mostly writing). A lesson introduces its new words (word card, then a picture
question when the word has an emoji), then a pairs game, then about 13 steps with the lesson's
sentences and some earlier ones: build the translation from word tiles (both directions), type it
(both directions), pick the right translation, fill grammar gaps (drills), and in between:

- **Le or la?** (un or une for `l'…` nouns): made from the nouns and their gender `g`.
- **Spell it**: write the French (with its article) for a picture and meaning: made from the words.
- **Spot the mistake**: a drill's sentence with one of its wrong options in the gap; the student taps
  the wrong word. So a drill's wrong options must be really wrong, never another correct sentence.
- **Best reply**: a question from a story (a line ending in `?`) and the next person's answer, among
  answers from other stories. So stories need clear question-and-answer exchanges.

The unit's stories come near the end of their lessons (5 and 7). Practice mixes everything learned
so far, weakest words first. There is no sound: everything is read, tapped and written. Write words
out (`Monsieur`, not `M.`; `douze`, not `12`).

## How a unit is written

**Audience**: teenagers and adults starting from zero, in English or German. Friendly, everyday,
a bit funny; Blob (the purple mascot, who wears a béret in this course) is part of the stories.

**Words** (about 25 to 33 per unit: 18 to 26 in lessons 1 to 5, a few more in lessons 6 and 7)
- `id`: unique in the whole course, lowercase with dashes: `pain`, `je-mange`, `grand-mere`. The
  syllabus below fixes the ids of the core words, so later units can count on them.
- Nouns carry their article (`le pain`, `la pomme`, `l'eau`, `les parents`) and their gender `g`
  (`l'eau`: f; plural nouns: the gender of the singular).
- `emoji` only for things a picture shows well, and different from every other emoji in the unit.
- `alt`: other right translations a student might type (`thanks` for merci).
- `note`: Blob's memory hook for words where one helps (not every word).

**Lessons**: 7 per unit. 2 to 6 new words each (numbers up to 7); lessons 6 and 7 may have fewer.
Every word is in exactly one lesson. Lessons 1 to 5 bring the unit's main words and grammar, with
the first story in lesson 5. Lessons 6 and 7 go further: a few new words, the unit's grammar in new
combinations (questions, negation, plural forms, words of earlier units), and the second story in
lesson 7.

**Sentences** (6 or 7 per lesson in lessons 1 to 5, 7 or 8 in lessons 6 and 7; about 50 per unit)
- Short (2 to 9 words), natural, everyday French at A1 (section 2: see below).
- Use only words taught in this unit or before, the little words of `BASE` in `glossary.ts`, and
  forms listed in the unit's `gloss` (verb forms, plurals, feminine forms). The checker warns about
  every French word a student couldn't tap for a meaning.
- French typography as in unit 1: a space before `! ? : ;` and inside `« »`: `Bonjour, Léa !`
- English and German are natural translations, not word for word. German with „…“ quotes and ß.
  British English (colour, Mrs).
- `alt` lists every other right answer: other French word orders and forms (`Comment tu t'appelles ?`),
  `il`/`elle` or masculine/feminine forms when the English or German doesn't say which (`I am French`
  → `Je suis français.` and `Je suis française.`), `tu` and `vous` when the prompt doesn't decide,
  other English and German wordings. English contractions are matched automatically (`I'm` = `I am`),
  so don't list them; accents and capitals don't matter for German and English answers either.
  For a German prompt that says `du` (or `ihr`/`Sie`), French alternatives with the other form are
  left out automatically, so list both forms freely for the English prompt.
- Two sentences of a unit with the same English or German must accept each other's French (the
  checker reports it).
- Numbers inside English and German: write the word and add the digits as an `alt` (`I am twelve.`,
  alt `I am 12.`).
- Names: Léa and Hugo (teen friends), Blob, Madame and Monsieur Martin (neighbours), and any other
  first names. A name must also come up inside some sentence (not only first), else its word tile
  starts with a small letter.

**Drills** (about 16: 2 to 3 per lesson): one gap `___` and 2 to 4 options that test this unit's
grammar (article and gender, verb form, agreement, negation, preposition). `why` is Blob's short
explanation with **bold** for the key form, speaking to the student as "you" / "du". Every wrong
option must make a wrong sentence (it's also shown as the mistake to spot); the checker reports a
wrong option that makes a sentence the course accepts.

**Stories** (`dialogues`, 2 per unit, in lessons 5 and 7; 6 to 10 lines each): a little scene with
Blob and the cast (`blob`, `lea`, `hugo`, `madame`, `serveur`, `maman`, `papa`, `prof`, `vendeur`),
using the unit's words, then 3 questions about it (bilingual options; `answer` is the right one's
index). Put in at least two clear exchanges where one person asks (the line ends with `?`) and the
next person answers in a way that only fits that question: they become "best reply" exercises.

**Tips** (4 per unit, one of them for lessons 6 and 7): the unit's guidebook. One idea each, simple and short, `**bold**` for forms,
paragraphs split by a blank line (`\n\n`), 2 to 4 examples, and a small table for a conjugation or
the articles.

**Gloss**: every form used in sentences, drills and dialogues that isn't a word of the course or in
`BASE`: `{ fr: "mange", en: "eat / eats", de: "esse / isst" }`. Little words a unit needs that BASE
doesn't have go here too (BASE is shared, don't edit it).

## Syllabus: section 1 (A1)

Core words per unit with their ids (more words are welcome, these must be there). Later units use
the earlier ones.

| # | slug | title | grammar | core words (id: French) |
|---|---|---|---|---|
| 1 | bonjour | Hello! | je suis, tu es, je m'appelle | done |
| 2 | qui-es-tu | Who's who? | être (all forms), c'est, ne … pas, nationality agreement | il-est: il est · elle-est: elle est · nous-sommes: nous sommes · vous-etes: vous êtes · ils-sont: ils sont · c-est: c'est · qui-est-ce: qui est-ce ? · garcon: le garçon · fille: la fille · ami: l'ami · amie: l'amie · francais: français · allemand: allemand · anglais: anglais · d-ou: tu es d'où ? · ne-pas: ne … pas · sympa: sympa · content: content · fatigue: fatigué |
| 3 | manger | Bon appétit! | le/la/les, un/une/des, du/de la, manger, aimer, boire (je/tu/il) | pain: le pain · pomme: la pomme · fromage: le fromage · eau: l'eau · lait: le lait · croissant: le croissant · pizza: la pizza · banane: la banane · chocolat: le chocolat · poisson: le poisson · salade: la salade · je-mange: je mange · tu-manges: tu manges · il-mange: il mange · j-aime: j'aime · tu-aimes: tu aimes · je-bois: je bois · tu-bois: tu bois · c-est-bon: c'est bon · delicieux: délicieux |
| 4 | famille | My family | avoir (all forms), mon/ma/mes, ton/ta/tes, son/sa/ses | mere: la mère · pere: le père · frere: le frère · soeur: la sœur · parents: les parents · famille: la famille · chien: le chien · chat: le chat · grand-mere: la grand-mère · grand-pere: le grand-père · j-ai: j'ai · tu-as: tu as · il-a: il a · nous-avons: nous avons · vous-avez: vous avez · ils-ont: ils ont · petit: petit · grand: grand |
| 5 | nombres | Numbers and birthdays | numbers 1–20, age with avoir, il y a, combien | num-1 … num-20: un … vingt · ans: ans · quel-age: tu as quel âge ? · il-y-a: il y a · combien: combien |
| 6 | ecole | At school | -er verbs (parler, écouter, regarder, travailler), est-ce que | ecole: l'école · classe: la classe · livre: le livre · stylo: le stylo · cahier: le cahier · sac: le sac · professeur: le professeur · eleve: l'élève · devoirs: les devoirs · je-parle: je parle · tu-parles: tu parles · il-parle: il parle · nous-parlons: nous parlons · vous-parlez: vous parlez · j-ecoute: j'écoute · je-regarde: je regarde · je-travaille: je travaille · est-ce-que: est-ce que |
| 7 | ville | In town | aller (all forms), à la / au / à l' / aux, où | ville: la ville · gare: la gare · parc: le parc · boulangerie: la boulangerie · cinema: le cinéma · piscine: la piscine · plage: la plage · musee: le musée · maison: la maison · supermarche: le supermarché · je-vais: je vais · tu-vas: tu vas · il-va: il va · nous-allons: nous allons · vous-allez: vous allez · ils-vont: ils vont · ou: où · a-droite: à droite · a-gauche: à gauche · tout-droit: tout droit |
| 8 | loisirs | Free time | faire (all forms), jouer au / jouer de la, days of the week | je-fais: je fais · tu-fais: tu fais · il-fait: il fait · sport: le sport · velo: le vélo · musique: la musique · foot: le foot · guitare: la guitare · nager: nager · danser: danser · lundi … dimanche: lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche · week-end: le week-end |
| 9 | vetements | Clothes and colours | adjective agreement and place, porter, ce/cette | rouge · bleu · vert · jaune · noir · blanc · gris · pantalon: le pantalon · robe: la robe · chemise: la chemise · t-shirt: le t-shirt · chaussures: les chaussures · pull: le pull · jupe: la jupe · veste: la veste · beret: le béret · je-porte: je porte · tu-portes: tu portes · il-porte: il porte · joli: joli |
| 10 | cafe | At the café | je voudrais, vous (polite), prices | je-voudrais: je voudrais · s-il-vous-plait: s'il vous plaît · s-il-te-plait: s'il te plaît · addition: l'addition · carte: la carte · cafe: le café · the: le thé · limonade: la limonade · jus-d-orange: le jus d'orange · crepe: la crêpe · glace: la glace · gateau: le gâteau · c-est-combien: c'est combien ? · euros: euros · vous-desirez: vous désirez ? · voila: voilà · bien-sur: bien sûr |

## Section 2 (A2): what changes

Section 2 is for students who finished section 1: everything there is known and should come back
often (that's how words stick). The rules above hold, with these differences:

- **Sentences** may be a little longer: 3 to 11 words. Still everyday French, now at A2.
- **Recycle**: about half of the sentences use words of section 1 in the unit's new grammar
  (`Hier, j'ai mangé une crêpe.`, `Demain, je vais aller à la piscine.`).
- **Cast**: Léa, Hugo, Blob and the Martins, plus **Chloé** (Léa's cousin from Lyon, speaker
  `chloe`, she visits in unit 11 and stays for the section) and **the doctor** (speaker `medecin`,
  a woman: `la médecin`, addressed as `Docteur`) in unit 17.
- **The past** (units 14 and 15): the English prompt is the simple past (`I ate a pizza.`), with the
  present perfect as an `alt` (`I have eaten a pizza.`); the German prompt is the Perfekt (`Ich habe
  eine Pizza gegessen.`), with the Präteritum as an `alt` where people say it (`Ich war`, `Ich ging`).
  With être, add the feminine and plural forms as French `alt`s whenever the prompt doesn't decide
  (`I went to Paris.` → `Je suis allé à Paris.` and `Je suis allée à Paris.`). Participles are words
  of their own (`mangé`, id `pp-mange`): en `eaten / ate`, de `gegessen`.
- **The near future** (unit 13 on): `I'm going to …` with `I will …` as an `alt`; German `Ich werde
  …` or the present with a time word (`Morgen gehe ich …`), each as an `alt` of the other.
- **Explanations**: Blob already explains two typical A2 slips by himself (the wrong helper in the
  past: `j'ai allé`; a reflexive verb without `me/te/se`). Drills and tips should teach exactly these.
- Object pronouns (`le`, `la`, `les` before a verb: `je le prends`) and the reflexive pronouns
  (`me`, `te`, `se`) are in `BASE`. Phrases the tap dictionary should keep together (`j'ai fait`,
  `plus grand`) go into the unit's `gloss`.

## Syllabus: section 2 (A2)

| # | slug | title | grammar | core words (id: French) |
|---|---|---|---|---|
| 11 | ma-journee | My day | reflexive verbs (se lever, se réveiller, se laver, s'habiller, se coucher: all persons), telling the time, d'abord / ensuite / après | je-me-reveille: je me réveille · je-me-leve: je me lève · tu-te-leves: tu te lèves · il-se-leve: il se lève · nous-nous-levons: nous nous levons · je-me-lave: je me lave · je-m-habille: je m'habille · je-me-couche: je me couche · matin: le matin · soir: le soir · petit-dejeuner: le petit-déjeuner · dejeuner: le déjeuner · diner: le dîner · heure: l'heure · quelle-heure: quelle heure est-il ? · et-demie: et demie · et-quart: et quart · midi: midi · minuit: minuit · tot: tôt · tard: tard · d-abord: d'abord · ensuite: ensuite |
| 12 | chez-moi | At home | habiter, rooms and furniture, places: devant, derrière, à côté de, entre (with dans, sur, sous), il n'y a pas de | j-habite: j'habite · tu-habites: tu habites · il-habite: il habite · appartement: l'appartement · chambre: la chambre · cuisine: la cuisine · salon: le salon · salle-de-bains: la salle de bains · jardin: le jardin · lit: le lit · table: la table · chaise: la chaise · canape: le canapé · fenetre: la fenêtre · porte: la porte · devant: devant · derriere: derrière · a-cote-de: à côté de · entre: entre · il-n-y-a-pas-de: il n'y a pas de |
| 13 | projets | Plans | the near future: aller + infinitive (all persons), its negation (je ne vais pas manger), time words for later | demain: demain · ce-soir: ce soir · semaine-prochaine: la semaine prochaine · bientot: bientôt · plus-tard: plus tard · faire: faire · voir: voir · visiter: visiter · acheter: acheter · dormir: dormir · partir: partir · inviter: inviter · preparer: préparer · rester: rester |
| 14 | hier | Yesterday | passé composé with avoir: -er verbs (mangé, regardé, joué, parlé), fait, vu, bu, pris, fini; negation (je n'ai pas mangé); tu as fait quoi ? | hier: hier · hier-soir: hier soir · semaine-derniere: la semaine dernière · deja: déjà · pas-encore: pas encore · pp-mange: mangé · pp-regarde: regardé · pp-joue: joué · pp-parle: parlé · pp-fait: fait · pp-vu: vu · pp-bu: bu · pp-pris: pris · pp-fini: fini · tu-as-fait-quoi: tu as fait quoi ? |
| 15 | voyage | On the road | passé composé with être (aller, partir, arriver, venir, rester, rentrer) and its agreement (allé, allée, allés); en train, en avion, en voiture, à vélo; en France, en Allemagne | train: le train · avion: l'avion · voiture: la voiture · valise: la valise · billet: le billet · vacances: les vacances · mer: la mer · montagne: la montagne · pays: le pays · france: la France · allemagne: l'Allemagne · pp-alle: allé · pp-parti: parti · pp-arrive: arrivé · pp-venu: venu · pp-reste: resté · pp-rentre: rentré |
| 16 | marche | At the market | acheter (all persons), quantities with de (un kilo de, une bouteille de, beaucoup de, pas de), numbers 30 to 100 by tens and prices | marche: le marché · fruits: les fruits · legumes: les légumes · tomate: la tomate · carotte: la carotte · fraise: la fraise · pomme-de-terre: la pomme de terre · kilo: le kilo · bouteille: la bouteille · beaucoup-de: beaucoup de · j-achete: j'achète · tu-achetes: tu achètes · il-achete: il achète · nous-achetons: nous achetons · cher: cher · num-30: trente · num-40: quarante · num-50: cinquante · num-60: soixante · num-100: cent |
| 17 | sante | Feeling ill | avoir mal à (au, à la, à l', aux), body parts, devoir + infinitive (all persons), advice | tete: la tête · ventre: le ventre · dos: le dos · bras: le bras · jambe: la jambe · main: la main · pied: le pied · dents: les dents · gorge: la gorge · j-ai-mal: j'ai mal · malade: malade · medecin: le médecin · pharmacie: la pharmacie · je-dois: je dois · tu-dois: tu dois · il-doit: il doit · vous-devez: vous devez · fievre: la fièvre |
| 18 | saisons | Seasons and weather | weather (il fait + adjective, il pleut, il neige, il y a du soleil / du vent), seasons (au printemps, en été…), months and dates (le premier mai, le quatorze juillet) | printemps: le printemps · ete: l'été · automne: l'automne · hiver: l'hiver · janvier · fevrier: février · mars · avril · mai · juin · juillet · aout: août · septembre · octobre · novembre · decembre: décembre · mois: le mois · saison: la saison · temps: le temps · quel-temps: quel temps fait-il ? · il-fait-chaud: il fait chaud · il-fait-froid: il fait froid · il-neige: il neige · soleil: le soleil · vent: le vent |
| 19 | sorties | Going out | vouloir and pouvoir + infinitive (all persons), venir, inviting, saying yes and no politely | je-veux: je veux · tu-veux: tu veux · il-veut: il veut · vous-voulez: vous voulez · je-peux: je peux · tu-peux: tu peux · il-peut: il peut · vous-pouvez: vous pouvez · je-viens: je viens · tu-viens: tu viens · fete: la fête · concert: le concert · restaurant: le restaurant · film: le film · d-accord: d'accord · desole: désolé · rendez-vous: le rendez-vous · ensemble: ensemble · on-y-va: on y va ! |
| 20 | comparer | Which one is better? | comparing (plus … que, moins … que, aussi … que, meilleur), the most (le plus …), object pronouns le / la / les (je le prends), shopping for things | plus-que: plus … que · moins-que: moins … que · aussi-que: aussi … que · meilleur: meilleur · le-plus: le plus · magasin: le magasin · taille: la taille · essayer: essayer · beau: beau · vieux: vieux · jeune: jeune · rapide: rapide · lent: lent · je-le-prends: je le prends · je-la-prends: je la prends · je-les-prends: je les prends |
