import type { ReactNode } from "react";
import { defineMessages } from "../define";

/** Inline code inside a sentence. */
const C = ({ children }: { children: ReactNode }) => <code className="rounded-[5px] bg-hover px-1 py-px font-mono text-[0.88em] text-ink">{children}</code>;

/** The public developer docs for "Sign in with Blob" (/developers), plus code comments shared with the admin panel. */
export const developersText = defineMessages({
  en: {
    meta: {
      title: "Sign in with Blob: developer docs",
      description: "Add “Sign in with Blob” to your website with OpenID Connect: SDK, endpoints, scopes and tokens.",
    },
    header: { docs: "Developers", open: "Open Blob", home: "Blob home", nav: "Sections" },
    copy: "Copy",
    copied: "Copied",
    toc: {
      label: "On this page",
      how: "How it works",
      quick: "Quick start",
      popup: "Popup and callback",
      sdk: "SDK reference",
      scopes: "Scopes and claims",
      endpoints: "Endpoints",
      server: "Apps with a server",
      tokens: "Tokens and lifetimes",
      security: "Security notes",
    },
    hero: {
      eyebrow: "Sign in with Blob",
      title: "Let people sign in with their Blob account",
      body: "Blob is an OpenID Connect provider. Add one button to your website and students sign in with the account they already use for notes and lessons. You never see or store a password.",
      start: "Quick start",
      discovery: "Discovery document",
      preview: "Preview",
      previewNote: (
        <>
          The button <C>blob.button()</C> makes. Your own button works just as well.
        </>
      ),
      button: "Sign in with Blob",
      signedIn: "Signed in as",
      demoName: "Alex Morgan",
      signOut: "Sign out",
    },
    how: {
      title: "How it works",
      steps: [
        { title: "Your page opens Blob", body: "signIn() opens Blob in a small popup window. If popups are blocked, it uses a normal redirect instead." },
        { title: "People sign in and say yes", body: "Blob shows who is signing in and what your site will see. Trusted apps skip this step." },
        { title: "Back with a one-time code", body: "Blob sends the popup to your redirect URI. The callback page hands the code to your page and closes itself." },
        { title: "Your page gets the user", body: "The SDK swaps the code for tokens with PKCE, checks the ID token and gives you the user." },
      ],
    },
    quick: {
      title: "Quick start",
      intro: "For websites without their own server code. Three steps.",
      register: "Register your app",
      registerBody: (
        <>
          A Blob admin adds your site under Admin › Apps &amp; APIs and gives you a client ID. Tell them your redirect URI, for example{" "}
          <C>https://your-site.org/blob-callback.html</C>.
        </>
      ),
      callback: "Put the callback page on your site",
      callbackBody: (
        <>
          Copy <C>blob-callback.html</C> to exactly that redirect URI. It is a tiny page that hands the result back to the window that opened Blob.
        </>
      ),
      download: "Download blob-callback.html",
      sdk: "Add the SDK",
      sdkBody: (
        <>
          Load the module from Blob, create <C>BlobAuth</C> with your client ID and redirect URI, and call <C>signIn()</C> when someone clicks your button.
        </>
      ),
      full: "A complete page",
      fullBody: "With sign-out, updates from other tabs and a token for your own API.",
      placeholderNote: (
        <>
          Replace <C>YOUR_CLIENT_ID</C> and the redirect URI with your app&apos;s values from the admin panel.
        </>
      ),
    },
    example: { site: "your-site.org", redirect: "https://your-site.org/blob-callback.html" },
    popup: {
      title: "The popup and the callback page",
      flowEnd: "gets the user",
      paragraphs: [
        <>
          <C>signIn()</C> opens Blob in a centred popup about 480 pixels wide. People sign in there (or create an account) and allow your app. Blob then
          sends the popup to your redirect URI with a one-time <C>code</C> and your <C>state</C>.
        </>,
        <>
          <C>blob-callback.html</C> lives on your own domain, so it may talk to your page. It posts the result to the window that opened the popup and
          closes itself. The SDK checks <C>state</C>, swaps the code for tokens and resolves <C>signIn()</C> with the user.
        </>,
        <>
          Without a popup (blocked, or <C>signIn({"{"} popup: false {"}"})</C>), the whole page goes to Blob and comes back through the callback page. Call{" "}
          <C>blob.handleRedirect()</C> once when your page loads to finish that kind of sign-in. It also finishes sign-ins that end in another tab, for
          example after someone confirms a new account by email.
        </>,
      ],
    },
    sdk: {
      title: "SDK reference",
      intro: (
        <>
          <C>blob-auth.js</C> is a small ES module without dependencies. Tokens are kept in <C>localStorage</C> and refreshed automatically.
        </>
      ),
      head: { name: "Member", what: "What it does" },
      rows: [
        ["new BlobAuth({ clientId, redirectUri, issuer?, scope? })", "Creates the client. issuer defaults to where the SDK was loaded from, scope to “openid profile email offline_access”."],
        ["signIn()", "Opens Blob and resolves with the user. Rejects with a BlobAuthError, e.g. code “access_denied” or “popup_closed”."],
        ["handleRedirect()", "Finishes a sign-in that came back without the popup. Call it once on page load."],
        ["user", "The signed-in person ({ sub, name, given_name, email, picture, locale }) or null."],
        ["onChange(callback)", "Calls back right away and whenever someone signs in or out, in any tab. Returns a function to stop listening."],
        ["getAccessToken()", "A valid access token for your own API, refreshed when needed, or null when signed out."],
        ["signOut()", "Signs out of your site and revokes the refresh token. Blob itself stays signed in."],
        ["button()", "A ready-made “Sign in with Blob” button that calls signIn()."],
        ["data.list() · get(key) · put(key, value) · delete(key)", "The app's own data in the person's Blob account (needs the “data” scope). Each app only sees its own keys."],
      ] as [string, string][],
    },
    scopes: {
      title: "Scopes and claims",
      intro: "Ask only for what you need. People see each scope on the consent screen, and the admin decides which ones your app may ask for.",
      head: { scope: "Scope", claims: "Claims", meaning: "What it means" },
      rows: {
        openid: "Required. A private, stable ID for the person in your app.",
        profile: "Name, first name, profile picture and language, as set in Blob.",
        email: "The email address and whether it is confirmed.",
        data: "Lets the app keep its own data for the person in Blob (like progress), through blob.data or /api/v1/data. Only for apps the admin allowed it.",
        offline_access: "A refresh token, so people stay signed in for up to 30 days.",
      } as Record<string, string>,
      claims: {
        openid: "sub",
        profile: "name, given_name, picture, locale, updated_at",
        email: "email, email_verified",
        data: "–",
        offline_access: "refresh_token",
      } as Record<string, string>,
      note: (
        <>
          The same claims come from the userinfo endpoint with an access token. <C>sub</C> never changes, so use it (not the email) to recognise people.
        </>
      ),
    },
    endpoints: {
      title: "Endpoints",
      intro: "Everything is also in the discovery document, so OpenID Connect libraries can set themselves up from one URL.",
      discovery: "Discovery",
      issuer: "Issuer",
      names: {
        authorization_endpoint: "Authorization",
        token_endpoint: "Token",
        userinfo_endpoint: "User info",
        revocation_endpoint: "Revocation",
        jwks_uri: "Public keys (JWKS)",
        blob_data_endpoint: "App data (scope data)",
      } as Record<string, string>,
    },
    server: {
      title: "Apps with a server",
      body: (
        <>
          If your app has its own server, it can be registered as a confidential client with a client secret. Send people to the authorization endpoint,
          then swap the code on your server. Authenticate with HTTP Basic (<C>client_secret_basic</C>) or form fields (<C>client_secret_post</C>). PKCE is
          recommended here too.
        </>
      ),
      authorize: "1. Send people to Blob",
      exchange: "2. Swap the code for tokens",
      response: "The answer",
      verify: (
        <>
          Verify the ID token before you trust it: RS256 signature with a key from the JWKS, <C>iss</C> is the issuer, <C>aud</C> is your client ID,{" "}
          <C>exp</C> is in the future and <C>nonce</C> is the one you sent.
        </>
      ),
    },
    tokens: {
      title: "Tokens and lifetimes",
      head: { token: "Token", lifetime: "Lifetime", notes: "Notes" },
      rows: [
        ["Authorization code", "2 minutes", "One-time use. Bound to the redirect URI and the PKCE challenge."],
        ["Access token", "1 hour", "JWT signed with RS256 (typ at+jwt). For userinfo and your own API."],
        ["ID token", "1 hour", "JWT with the person's claims, aud = your client ID."],
        ["Refresh token", "30 days", "Rotates: every use returns a new one. Using an old one again revokes the whole sign-in."],
      ] as [string, string, string][],
    },
    security: {
      title: "Security notes",
      items: [
        "PKCE with S256 is required for browser apps and recommended for everyone.",
        "Redirect URIs must match exactly: no wildcards, https only (http just for localhost), no #fragment.",
        "Always send state and nonce, and check them on the way back. The SDK does this for you.",
        "Blob adds iss to the redirect (RFC 9207). Check it if your site talks to more than one provider.",
        "Never put a client secret into browser code. Browser apps don't get one.",
        "People can remove your app any time in Blob under Settings › Connected apps. Refresh tokens then stop working, so treat invalid_grant as signed out.",
        "The consent screen can't be shown inside a frame. Use the popup or a redirect.",
      ],
    },
    footer: { tagline: "Sign in with Blob", questions: "Questions? Ask whoever runs your Blob." },
    notes: {
      login: "Sign in with Blob",
      logout: "Sign out",
      finish: "Finish a sign-in that came back without the popup",
      changes: "Called now and whenever someone signs in or out (in any tab)",
      signIn: "opens Blob in a popup",
      token: "For your own API: send it as Authorization: Bearer …",
      button: "Or use the ready-made button:",
      exchange: "On your server: swap the one-time code for tokens (within 2 minutes)",
      refresh: "Later: a fresh access token. The refresh token rotates, keep the new one",
    },
  },
  de: {
    meta: {
      title: "Mit Blob anmelden: Doku für Entwickler",
      description: "Bau „Mit Blob anmelden“ mit OpenID Connect in deine Website ein: SDK, Endpunkte, Scopes und Tokens.",
    },
    header: { docs: "Entwickler", open: "Blob öffnen", home: "Blob-Startseite", nav: "Abschnitte" },
    copy: "Kopieren",
    copied: "Kopiert",
    toc: {
      label: "Auf dieser Seite",
      how: "So funktioniert's",
      quick: "Schnellstart",
      popup: "Pop-up und Callback",
      sdk: "SDK-Referenz",
      scopes: "Scopes und Claims",
      endpoints: "Endpunkte",
      server: "Apps mit Server",
      tokens: "Tokens und Laufzeiten",
      security: "Sicherheit",
    },
    hero: {
      eyebrow: "Mit Blob anmelden",
      title: "Lass Leute sich mit ihrem Blob-Konto anmelden",
      body: "Blob ist ein OpenID-Connect-Anbieter. Bau einen Button in deine Website ein, und Schülerinnen und Schüler melden sich mit dem Konto an, das sie schon für Notizen und Lektionen nutzen. Du siehst und speicherst nie ein Passwort.",
      start: "Schnellstart",
      discovery: "Discovery-Dokument",
      preview: "Vorschau",
      previewNote: (
        <>
          Der Button, den <C>blob.button()</C> erzeugt. Ein eigener Button geht genauso.
        </>
      ),
      button: "Mit Blob anmelden",
      signedIn: "Angemeldet als",
      demoName: "Lena Schmidt",
      signOut: "Abmelden",
    },
    how: {
      title: "So funktioniert's",
      steps: [
        { title: "Deine Seite öffnet Blob", body: "signIn() öffnet Blob in einem kleinen Pop-up-Fenster. Sind Pop-ups blockiert, gibt es stattdessen eine normale Weiterleitung." },
        { title: "Anmelden und zustimmen", body: "Blob zeigt, wer sich anmeldet und was deine Seite sehen darf. Vertrauenswürdige Apps überspringen diesen Schritt." },
        { title: "Zurück mit einem Einmal-Code", body: "Blob schickt das Pop-up an deine Redirect-URI. Die Callback-Seite gibt den Code an deine Seite weiter und schließt sich." },
        { title: "Deine Seite kennt die Person", body: "Das SDK tauscht den Code mit PKCE gegen Tokens, prüft das ID-Token und gibt dir die Person." },
      ],
    },
    quick: {
      title: "Schnellstart",
      intro: "Für Websites ohne eigenen Servercode. Drei Schritte.",
      register: "App registrieren",
      registerBody: (
        <>
          Ein Blob-Admin trägt deine Seite unter Admin › Apps und APIs ein und gibt dir eine Client-ID. Nenn dabei deine Redirect-URI, zum Beispiel{" "}
          <C>https://deine-seite.de/blob-callback.html</C>.
        </>
      ),
      callback: "Callback-Seite ablegen",
      callbackBody: (
        <>
          Leg <C>blob-callback.html</C> genau unter dieser Redirect-URI ab. Die winzige Seite gibt das Ergebnis an das Fenster zurück, das Blob geöffnet hat.
        </>
      ),
      download: "blob-callback.html herunterladen",
      sdk: "SDK einbinden",
      sdkBody: (
        <>
          Lade das Modul von Blob, erstell <C>BlobAuth</C> mit deiner Client-ID und Redirect-URI und ruf <C>signIn()</C> auf, wenn jemand auf deinen Button
          klickt.
        </>
      ),
      full: "Eine vollständige Seite",
      fullBody: "Mit Abmelden, Updates aus anderen Tabs und einem Token für deine eigene API.",
      placeholderNote: (
        <>
          Ersetz <C>YOUR_CLIENT_ID</C> und die Redirect-URI durch die Werte deiner App aus dem Admin-Bereich.
        </>
      ),
    },
    example: { site: "deine-seite.de", redirect: "https://deine-seite.de/blob-callback.html" },
    popup: {
      title: "Das Pop-up und die Callback-Seite",
      flowEnd: "kennt die Person",
      paragraphs: [
        <>
          <C>signIn()</C> öffnet Blob in einem zentrierten Pop-up, etwa 480 Pixel breit. Dort meldet man sich an (oder erstellt ein Konto) und erlaubt
          deine App. Dann schickt Blob das Pop-up mit einem Einmal-<C>code</C> und deinem <C>state</C> an deine Redirect-URI.
        </>,
        <>
          <C>blob-callback.html</C> liegt auf deiner eigenen Domain und darf deshalb mit deiner Seite sprechen. Sie schickt das Ergebnis an das Fenster,
          das das Pop-up geöffnet hat, und schließt sich. Das SDK prüft <C>state</C>, tauscht den Code gegen Tokens und erfüllt <C>signIn()</C> mit der
          Person.
        </>,
        <>
          Ohne Pop-up (blockiert oder <C>signIn({"{"} popup: false {"}"})</C>) geht die ganze Seite zu Blob und kommt über die Callback-Seite zurück. Ruf{" "}
          <C>blob.handleRedirect()</C> einmal beim Laden deiner Seite auf, um so eine Anmeldung abzuschließen. Das klappt auch, wenn die Anmeldung in
          einem anderen Tab endet, etwa nachdem jemand ein neues Konto per E-Mail bestätigt hat.
        </>,
      ],
    },
    sdk: {
      title: "SDK-Referenz",
      intro: (
        <>
          <C>blob-auth.js</C> ist ein kleines ES-Modul ohne Abhängigkeiten. Tokens liegen im <C>localStorage</C> und werden automatisch erneuert.
        </>
      ),
      head: { name: "Mitglied", what: "Was es macht" },
      rows: [
        ["new BlobAuth({ clientId, redirectUri, issuer?, scope? })", "Erstellt den Client. issuer ist standardmäßig die Adresse, von der das SDK geladen wurde, scope „openid profile email offline_access“."],
        ["signIn()", "Öffnet Blob und liefert die Person. Schlägt mit einem BlobAuthError fehl, z. B. Code „access_denied“ oder „popup_closed“."],
        ["handleRedirect()", "Schließt eine Anmeldung ab, die ohne Pop-up zurückkam. Einmal beim Laden der Seite aufrufen."],
        ["user", "Die angemeldete Person ({ sub, name, given_name, email, picture, locale }) oder null."],
        ["onChange(callback)", "Ruft sofort zurück und jedes Mal, wenn sich jemand an- oder abmeldet, in jedem Tab. Gibt eine Funktion zum Abmelden des Listeners zurück."],
        ["getAccessToken()", "Ein gültiges Access-Token für deine eigene API, bei Bedarf erneuert, oder null, wenn niemand angemeldet ist."],
        ["signOut()", "Meldet von deiner Seite ab und widerruft das Refresh-Token. Blob selbst bleibt angemeldet."],
        ["button()", "Ein fertiger Button „Mit Blob anmelden“, der signIn() aufruft."],
        ["data.list() · get(key) · put(key, value) · delete(key)", "Die eigenen Daten der App im Blob-Konto der Person (braucht den Scope „data“). Jede App sieht nur ihre eigenen Schlüssel."],
      ],
    },
    scopes: {
      title: "Scopes und Claims",
      intro: "Frag nur nach dem, was du brauchst. Jeder Scope steht auf der Zustimmungsseite, und der Admin legt fest, welche deine App anfragen darf.",
      head: { scope: "Scope", claims: "Claims", meaning: "Bedeutung" },
      rows: {
        openid: "Pflicht. Eine private, feste ID der Person in deiner App.",
        profile: "Name, Vorname, Profilbild und Sprache, so wie sie in Blob stehen.",
        email: "Die E-Mail-Adresse und ob sie bestätigt ist.",
        data: "Die App darf eigene Daten der Person in Blob ablegen (z. B. Fortschritt), über blob.data oder /api/v1/data. Nur für Apps, denen der Admin das erlaubt.",
        offline_access: "Ein Refresh-Token, damit man bis zu 30 Tage angemeldet bleibt.",
      } as Record<string, string>,
      claims: {
        openid: "sub",
        profile: "name, given_name, picture, locale, updated_at",
        email: "email, email_verified",
        data: "–",
        offline_access: "refresh_token",
      } as Record<string, string>,
      note: (
        <>
          Dieselben Claims liefert der Userinfo-Endpunkt mit einem Access-Token. <C>sub</C> ändert sich nie, nutz es also (nicht die E-Mail), um Leute
          wiederzuerkennen.
        </>
      ),
    },
    endpoints: {
      title: "Endpunkte",
      intro: "Alles steht auch im Discovery-Dokument, damit sich OpenID-Connect-Bibliotheken mit einer einzigen URL einrichten können.",
      discovery: "Discovery",
      issuer: "Issuer",
      names: {
        authorization_endpoint: "Autorisierung",
        token_endpoint: "Token",
        userinfo_endpoint: "Benutzerinfo",
        revocation_endpoint: "Widerruf",
        jwks_uri: "Öffentliche Schlüssel (JWKS)",
        blob_data_endpoint: "App-Daten (Scope data)",
      } as Record<string, string>,
    },
    server: {
      title: "Apps mit Server",
      body: (
        <>
          Hat deine App einen eigenen Server, kann sie als vertraulicher Client mit Client-Secret registriert werden. Schick die Leute zum
          Autorisierungs-Endpunkt und tausch den Code dann auf deinem Server. Authentifiziert wird per HTTP Basic (<C>client_secret_basic</C>) oder mit
          Formularfeldern (<C>client_secret_post</C>). PKCE ist auch hier empfohlen.
        </>
      ),
      authorize: "1. Leute zu Blob schicken",
      exchange: "2. Code gegen Tokens tauschen",
      response: "Die Antwort",
      verify: (
        <>
          Prüf das ID-Token, bevor du ihm vertraust: RS256-Signatur mit einem Schlüssel aus dem JWKS, <C>iss</C> ist der Issuer, <C>aud</C> ist deine
          Client-ID, <C>exp</C> liegt in der Zukunft und <C>nonce</C> ist die, die du geschickt hast.
        </>
      ),
    },
    tokens: {
      title: "Tokens und Laufzeiten",
      head: { token: "Token", lifetime: "Laufzeit", notes: "Hinweise" },
      rows: [
        ["Autorisierungscode", "2 Minuten", "Nur einmal nutzbar. An die Redirect-URI und die PKCE-Challenge gebunden."],
        ["Access-Token", "1 Stunde", "JWT, signiert mit RS256 (typ at+jwt). Für Userinfo und deine eigene API."],
        ["ID-Token", "1 Stunde", "JWT mit den Claims der Person, aud = deine Client-ID."],
        ["Refresh-Token", "30 Tage", "Rotiert: Jede Nutzung liefert ein neues. Wird ein altes noch mal benutzt, ist die ganze Anmeldung gesperrt."],
      ],
    },
    security: {
      title: "Sicherheit",
      items: [
        "PKCE mit S256 ist für Browser-Apps Pflicht und für alle anderen empfohlen.",
        "Redirect-URIs müssen genau passen: keine Platzhalter, nur https (http nur für localhost), kein #Fragment.",
        "Schick immer state und nonce mit und prüf sie bei der Rückkehr. Das SDK macht das für dich.",
        "Blob hängt iss an die Weiterleitung an (RFC 9207). Prüf es, wenn deine Seite mit mehreren Anbietern spricht.",
        "Ein Client-Secret gehört nie in Browser-Code. Browser-Apps bekommen keins.",
        "Man kann deiner App den Zugriff jederzeit in Blob unter Einstellungen › Verbundene Apps entziehen. Dann funktionieren Refresh-Tokens nicht mehr, behandle invalid_grant also wie „abgemeldet“.",
        "Die Zustimmungsseite lässt sich nicht in einem Frame anzeigen. Nimm das Pop-up oder eine Weiterleitung.",
      ],
    },
    footer: { tagline: "Mit Blob anmelden", questions: "Fragen? Wende dich an die Person, die dein Blob betreibt." },
    notes: {
      login: "Mit Blob anmelden",
      logout: "Abmelden",
      finish: "Anmeldung abschließen, die ohne Pop-up zurückkam",
      changes: "Wird sofort aufgerufen und bei jedem An- oder Abmelden (in jedem Tab)",
      signIn: "öffnet Blob in einem Pop-up",
      token: "Für deine eigene API: als Authorization: Bearer … mitschicken",
      button: "Oder der fertige Button:",
      exchange: "Auf deinem Server: Einmal-Code gegen Tokens tauschen (innerhalb von 2 Minuten)",
      refresh: "Später: frisches Access-Token. Das Refresh-Token rotiert, heb das neue auf",
    },
  },
});
