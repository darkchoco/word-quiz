// Only the Latin subsets are bundled: "latin-ext" holds the letters with macrons (ā ē ī ō ū).
// Importing a package as a whole would add Cyrillic, Greek and other alphabets to the download.
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/eb-garamond/latin-ext-500.css';
import '@fontsource/eb-garamond/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
// The interface font. The Korean subset is one ~530 KB file per weight, so only 400 and 500 are bundled.
import '@fontsource/noto-sans-kr/latin-400.css';
import '@fontsource/noto-sans-kr/latin-500.css';
import '@fontsource/noto-sans-kr/korean-400.css';
import '@fontsource/noto-sans-kr/korean-500.css';
