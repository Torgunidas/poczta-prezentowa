# Poczta Prezentowa

[Otwórz aplikację](https://torgunidas.github.io/poczta-prezentowa/)

Świąteczne losowanie prezentów na jednym telefonie. Wpisz co najmniej dwa imiona i przekazuj telefon osobie wskazanej na ekranie. Trafienie na siebie pozwala losować ponownie. Każdy poprawny wynik usuwa odbiorcę z puli, a ostatnia osoba zawsze ma dla kogo kupić prezent.

Przebieg rundy jest zapisywany w pamięci sesji przeglądarki. Po odświeżeniu uczestnik może odsłonić ten sam wynik. Imiona i przydziały pozostają na urządzeniu.

## Uruchomienie lokalne

W katalogu projektu wykonaj `python -m http.server 8000 --directory dist` i otwórz [lokalną stronę](http://localhost:8000/).

Testy uruchamia polecenie `node --test tests/draw.test.mjs` (Node.js 20 lub nowszy). Wysłanie zmian na gałąź `main` uruchamia testy i publikację katalogu `dist` przez GitHub Pages.

<details>
<summary>Ilustracja świątecznej koperty</summary>

[Ilustrację używaną na stronie](dist/assets/swiateczna-koperta.jpg) wygenerowano wbudowanym narzędziem ImageGen. Poniżej znajduje się oryginalny opis użyty do jej wygenerowania.

> Wide editorial still life for a Polish Christmas gift exchange app. A single large cream envelope closed with a deep red wax seal embossed with a tiny fir tree, resting diagonally against one warm kraft gift wrapped with a voluminous burgundy velvet ribbon and one dark evergreen-wrapped gift. Real fir sprigs. Antique Scandinavian Christmas greeting-card illustration using fine 1940s gouache, stippled lithographic shadows, visible tiny ink flecks, richly detailed folds in ribbon and pine needles. Isolated cohesive still life on uniform warm ivory uncoated paper #faf7f0, fading into blank ivory at the outer edges. Wide landscape 3:2 framing. Elegant limited inks in forest green, deep brick red, warm ochre. Gifts and objects centered and fill the frame well, margins all around, soft paper shadows under objects only. Simple silhouette reads on a small screen. No text or lettering, no people, no border, no frame, no logo.

</details>
