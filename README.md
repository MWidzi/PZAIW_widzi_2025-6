# PZAIW_widzi_2025-6
Repozytorium do programowania zaawansowanych aplikacji webowych w roku szkolnym 2025/6

### Legenda folderów:
- projekt na 13-10-2025: first-server
- projekt na 10-11-2025: projekt02 
- projekt na 15-12-2025: projekt03
- projekt na 30-02-2026: projekt04

## README do projekt03
### Konfiguracja: 
Wejść w katalog projekt03 i uruchomić komendę: 
```sh 
npm install
```

### Uruchomienie:
W katalogu projekt03:
```sh 
node index.js
```

Projekt zostanie uruchomiony na [tym adresie](http://localhost:8000)

### Działanie programu:
Link na postronie / prowadzi do "podstrony głównej" aplikacji. Klikając w link na niej widoczny zostaniemy przeniesieni do formularza, w ktorym wyświetla się każdy poziom trudnośći każdej piosenki. Używając **checkboxów** zaznaczamy czy mamy na piosence FC czy AP. Po zaznaczeniu tego co chcemy należy kliknąć na przycisk nad tabelą, aplikacja ponownie zabierze nas na "stronę główną", na której tym razem będą widniały zaznaczone piosenki oraz metryka, mająca na celu zwizualizować umiejętności gracza w postaci liczby od 0 do 10.

## README do projekt04
### Konfiguracja: 
Wejść w katalog projekt04 i uruchomić komendę: 
```sh 
npm install
```

### Inicjalizacja zmiennych środowiskowych:
W katalogu projekt04:
```sh 
npm run generate_env
```

### Inicjalizacja bazy danych danymi testowymi:
W katalogu projekt04:
```sh 
npm run populate_db
```
komenda najpierw spyta o hasło dla konta administratora, gdy zostanie poprawnie wprowadzone od razu uruchamia serwer.

### Kolejne uruchomienia:
W katalogu projekt04:
```sh 
npm run dev
```

Projekt zostanie uruchomiony na [tym adresie](http://localhost:8000)

### Sens aplikacji:
Aplikacja ma pozwolić użytkownikom zwizualizować swój poziom umiejętności w grach rytmicznych, biorąc pod uwagę kilka gier jednocześnie, oraz dodatkowo służyć jako miejsce, w którym można szybko i łatwo sprawdzić informacje o piosence. Na podstawie zaznaczonych przez użytkownika wyników aplikacja oblicza współczynnik w łatwy sposób pokazujący jego poziom, który może potem przykładowo porównać z innymi graczami na mediach społecznościowych. Defakto można powiedzieć że jest to agregator pojedyńczych wyników w grach rytmicznych, który przy okazji daje prosty do zrozumienia feedback.

### Funkcjonalności aplikacji:
**Dostępne dla wszystkich użytkowników:**
- wyświetlanie listy piosenek w aplikacji
- wyświetlanie informacji o poszczególnych piosenkach
**Dostępne tylko dla zalogowanych użytkowników:**
- wyświetlanie listy konkretnych poziomów trudności, oraz odznaczania typów wyników jakie użytkownik na nich zdobył
- zaznaczone wyniki zapisują się, oraz na ich podstawie obliczany jest "rating"
**Dostępne tylko dla użytkowników z uprawnieniami administratora:**
- wyświetlanie listy wszystkich użytkowników, nie będących administratorami
- wyświetlanie i edycja informacji o wynikach poszczególnych użytkowników
- dodawanie nowych piosenk z poziomu aplikacji
- edytowanie piosenek z pioziomu aplikacji
- usuwanie piosenek z poziomu aplikacji
