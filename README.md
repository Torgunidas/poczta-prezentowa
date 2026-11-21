# Poczta Prezentowa

[Otwórz aplikację](https://torgunidas.github.io/poczta-prezentowa/)

Świąteczne losowanie prezentów na jednym telefonie. Wpisz co najmniej dwa imiona i przekazuj telefon osobie wskazanej na ekranie. Trafienie na siebie pozwala losować ponownie. Każdy poprawny wynik usuwa odbiorcę z puli, a ostatnia osoba zawsze ma dla kogo kupić prezent.

Przebieg rundy jest zapisywany w pamięci sesji przeglądarki. Po odświeżeniu uczestnik może odsłonić ten sam wynik. Imiona i przydziały pozostają na urządzeniu.

## Uruchomienie lokalne

W katalogu projektu wykonaj `python -m http.server 8000 --directory dist` i otwórz [lokalną stronę](http://localhost:8000/).

Testy uruchamia polecenie `node --test tests/draw.test.mjs` (Node.js 20 lub nowszy). Wysłanie zmian na gałąź `main` uruchamia testy i publikację katalogu `dist` przez GitHub Pages.
