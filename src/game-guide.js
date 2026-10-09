import {icon} from './icons.js';

/* Self-contained, read-only bilingual game guide. No career data is accessed here. */
const COPY={
  "it": {
    "eyebrow": "GUIDA AL GIOCO",
    "title": "Come funziona Football Architect",
    "intro": "Football Architect simula il trascorrere delle stagioni in un universo calcistico immaginario. Qui sono spiegate le regole e le meccaniche già presenti nel gioco.",
    "nav": "Argomenti",
    "read": "Contenuti della guida",
    "topics": [
      {
        "id": "world",
        "icon": "flag",
        "title": "Il mondo calcistico",
        "text": "Il gioco è ambientato in Paesi e città reali, ma squadre e competizioni sono immaginarie.",
        "bullets": [
          "Sono presenti otto Paesi: Italia, Inghilterra, Spagna, Germania, Francia, Portogallo, Paesi Bassi e Brasile.",
          "Ogni Paese dispone attualmente di una divisione composta da 20 club.",
          "I club hanno identità proprie; la carriera segue la squadra scelta nel trascorrere degli anni."
        ]
      },
      {
        "id": "seasons",
        "icon": "calendar",
        "title": "Le stagioni",
        "text": "Il calendario usa date reali, mentre le stagioni sono numerate rispetto all'inizio della carriera: Stagione 1, Stagione 2 e così via.",
        "bullets": [
          "La prestagione comincia il 1° luglio.",
          "Il periodo stagionale va dal 15 agosto al 31 maggio.",
          "Dal 1° giugno inizia la pausa estiva; il 1° luglio comincia una nuova stagione.",
          "Il numero della stagione aumenta automaticamente al passaggio del 1° luglio."
        ]
      },
      {
        "id": "time",
        "icon": "clock",
        "title": "Come scorre il tempo",
        "text": "Il gioco mantiene un proprio orologio: un giorno simulato dura sempre 24 ore e non dipende dall'ora legale del computer.",
        "bullets": [
          "Il tempo può avanzare a intervalli di un'ora o di più giorni.",
          "Nella simulazione continua l'orologio avanza progressivamente finché la simulazione viene fermata.",
          "L'avanzamento aggiorna data, ora, fase stagionale e stato delle finestre di mercato.",
          "Attualmente il passaggio del tempo non genera risultati, trasferimenti o altri eventi gestionali."
        ]
      },
      {
        "id": "league",
        "icon": "shield",
        "title": "La struttura dei campionati",
        "text": "Ciascuna divisione attualmente disponibile è organizzata con un girone di andata e uno di ritorno.",
        "bullets": [
          "20 squadre partecipano a ogni campionato.",
          "Ogni squadra incontra le altre 19 due volte: una in casa e una in trasferta.",
          "La stagione comprende 38 giornate, con 10 incontri per giornata e 380 incontri programmati per divisione.",
          "Le classifiche e i passaggi tra divisioni non sono ancora calcolati dalla simulazione."
        ]
      },
      {
        "id": "fixtures",
        "icon": "calendar",
        "title": "La programmazione delle partite",
        "text": "Ogni incontro ha una data, un orario di inizio, una squadra di casa e una in trasferta. Il programma è deterministico per competizione e stagione.",
        "bullets": [
          "Le partite sono distribuite tra metà agosto e fine maggio, principalmente nei fine settimana e talvolta in turni infrasettimanali.",
          "Gli orari di inizio possono variare; il calendario tiene conto di almeno 72 ore di riposo fra due incontri della stessa squadra.",
          "Non sono programmate partite tra il 24 dicembre e il 2 gennaio, inclusi.",
          "Gli incontri sono per ora soltanto programmati: non vengono giocati e non producono ancora risultati."
        ]
      },
      {
        "id": "market",
        "icon": "clock",
        "title": "Il calciomercato",
        "text": "Il gioco riconosce due finestre annuali di mercato e ne mostra lo stato in base alla data simulata.",
        "bullets": [
          "Finestra estiva: dal 1° luglio fino alla fine del 31 agosto.",
          "Finestra invernale: dal 1° gennaio fino alla fine del 31 gennaio.",
          "Allo scoccare della mezzanotte del 1° settembre e del 1° febbraio la rispettiva finestra risulta chiusa.",
          "Le finestre sono attualmente informative: non è ancora possibile effettuare trasferimenti."
        ]
      }
    ],
    "faqTitle": "Domande sulle meccaniche",
    "faqs": [
      [
        "Quando cambia la stagione?",
        "La prestagione inizia il 1° luglio e il numero della stagione aumenta in quel giorno. Il periodo stagionale decorre dal 15 agosto al 31 maggio."
      ],
      [
        "Perché una squadra ha 38 partite in calendario?",
        "In una divisione da 20 club ogni squadra affronta 19 avversarie due volte, una in casa e una in trasferta: 38 incontri totali."
      ],
      [
        "Il risultato cambia quando la data supera quella di una partita?",
        "No. Nella versione attuale le gare vengono soltanto programmate: l'avanzamento del calendario non simula incontri, punteggi o classifiche."
      ],
      [
        "Durante il mercato vengono comprati o venduti giocatori?",
        "No. Per ora le finestre indicano soltanto quando il mercato sarebbe aperto o chiuso; i trasferimenti non vengono ancora simulati."
      ]
    ],
    "footer": "La guida descrive solo le meccaniche implementate. Risultati, classifiche, trasferimenti e regolamenti non ancora operativi non vengono presentati come regole attive.",
    "back": "Torna al menu"
  },
  "en": {
    "eyebrow": "GAME GUIDE",
    "title": "How Football Architect works",
    "intro": "Football Architect simulates the passage of seasons in a fictional football universe. This guide explains the rules and mechanics already present in the game.",
    "nav": "Topics",
    "read": "Guide sections",
    "topics": [
      {
        "id": "world",
        "icon": "flag",
        "title": "The football world",
        "text": "The game takes place in real countries and cities, but all clubs and competitions are fictional.",
        "bullets": [
          "Eight countries are currently included: Italy, England, Spain, Germany, France, Portugal, the Netherlands and Brazil.",
          "Each country currently has one division with 20 clubs.",
          "Clubs have their own identities; a career follows the selected team across the years."
        ]
      },
      {
        "id": "seasons",
        "icon": "calendar",
        "title": "Seasons",
        "text": "The calendar uses real dates, while seasons are numbered relative to the start of a career: Season 1, Season 2 and so on.",
        "bullets": [
          "Preseason starts on 1 July.",
          "The season period runs from 15 August through 31 May.",
          "The summer break starts on 1 June; a new season begins on 1 July.",
          "The season number increases automatically when 1 July is reached."
        ]
      },
      {
        "id": "time",
        "icon": "clock",
        "title": "How time passes",
        "text": "The game keeps its own clock: a simulated day always lasts 24 hours, independently of the computer's daylight-saving changes.",
        "bullets": [
          "Time may advance by one hour or by several days.",
          "Continuous simulation advances the clock progressively until it is stopped.",
          "Time progression updates the date, hour, season phase and transfer-window status.",
          "Currently, advancing time does not generate results, transfers or other management events."
        ]
      },
      {
        "id": "league",
        "icon": "shield",
        "title": "League structure",
        "text": "Each currently available division follows a double round-robin schedule.",
        "bullets": [
          "20 teams take part in each league.",
          "Each team meets all 19 opponents twice: once at home and once away.",
          "A season contains 38 rounds, with 10 fixtures per round and 380 scheduled fixtures per division.",
          "League tables and movement between divisions are not yet calculated by the simulation."
        ]
      },
      {
        "id": "fixtures",
        "icon": "calendar",
        "title": "Match scheduling",
        "text": "Every fixture has a date, kick-off time, home side and away side. The schedule is deterministic for each competition and season.",
        "bullets": [
          "Fixtures run from mid-August through late May, mainly on weekends with some midweek rounds.",
          "Kick-off times may vary; scheduling preserves at least 72 hours of rest between a team's fixtures.",
          "No games are scheduled between 24 December and 2 January, inclusive.",
          "Fixtures are scheduled only: matches are not played and do not yet produce results."
        ]
      },
      {
        "id": "market",
        "icon": "clock",
        "title": "Transfer windows",
        "text": "The game recognises two annual transfer windows and displays whether each is open based on simulated time.",
        "bullets": [
          "Summer window: from 1 July through the end of 31 August.",
          "Winter window: from 1 January through the end of 31 January.",
          "The relevant window closes at midnight at the start of 1 September or 1 February.",
          "The windows are currently informational: transfers are not available yet."
        ]
      }
    ],
    "faqTitle": "Questions about game mechanics",
    "faqs": [
      [
        "When does a new season begin?",
        "Preseason starts on 1 July and the season number increases on that date. The season period runs from 15 August through 31 May."
      ],
      [
        "Why does a team have 38 fixtures?",
        "In a 20-club division, each team faces 19 opponents twice, once at home and once away: 38 scheduled matches."
      ],
      [
        "Does the score change when the date passes a scheduled match?",
        "No. In the current version matches are scheduled only; time progression does not simulate games, scores or league tables."
      ],
      [
        "Are players bought or sold during transfer windows?",
        "No. For now the windows only indicate when the market would be open or closed; transfers are not simulated yet."
      ]
    ],
    "footer": "This guide covers implemented mechanics only. Results, league tables, transfers and competition rules that are not operational are never presented as active rules.",
    "back": "Back to menu"
  }
};

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function guidePage(lang='it'){
 const c=COPY[lang==='en'?'en':'it'];
 const topics=c.topics.map(topic=>'<section id="guide-'+topic.id+'" class="panel guide-topic" aria-labelledby="guide-title-'+topic.id+'">'+
  '<div class="guide-topic-heading"><span class="guide-topic-icon">'+icon(topic.icon,20)+'</span>'+
  '<h2 id="guide-title-'+topic.id+'">'+esc(topic.title)+'</h2></div>'+
  '<p>'+esc(topic.text)+'</p><ul>'+topic.bullets.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>'+
  '</section>').join('');
 const links=c.topics.map(topic=>
  '<a href="#guide-'+topic.id+'">'+icon(topic.icon,17)+'<span>'+esc(topic.title)+'</span>'+icon('chevron-right',15)+'</a>').join('');
 const faqs=c.faqs.map(([question,answer])=>
  '<details class="guide-question"><summary>'+esc(question)+icon('chevron-down',18)+'</summary>'+
  '<p>'+esc(answer)+'</p></details>').join('');
 return '<div class="game-guide">'+
  '<header class="guide-header fa-page-heading"><button type="button" class="page-back" data-action="home">'+
  icon('arrow-left',17)+esc(c.back)+'</button><span class="kicker">'+esc(c.eyebrow)+'</span>'+
  '<h1 class="fa-page-title">'+esc(c.title)+'</h1><p>'+esc(c.intro)+'</p></header>'+
  '<nav class="guide-nav panel" aria-label="'+esc(c.nav)+'">'+
  '<h2>'+esc(c.read)+'</h2><div class="guide-nav-links">'+links+'</div></nav>'+
  '<div class="guide-topic-grid">'+topics+'</div>'+
  '<section class="panel guide-faq" aria-labelledby="guide-faq-title">'+
  '<h2 id="guide-faq-title">'+esc(c.faqTitle)+'</h2>'+faqs+'</section>'+
  '<p class="guide-footnote">'+icon('shield',17)+'<span>'+esc(c.footer)+'</span></p>'+
  '</div>';
}
