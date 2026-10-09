// Football Architect's alternative football history.
// Countries and cities are real. Leagues, clubs, grounds, and founding stories are fictional.
// Club entries are [fictional historical-style name, real city, fictional stadium].
const definitions = [
  {
    id:'IT', flag:'🇮🇹', country:{it:'Italia',en:'Italy'}, competition:'Lega Federale',
    clubs:[
      ['US Velaria Torino','Torino','Campo Sociale Velaria'],
      ['AC Rinascenti Bologna','Bologna','Stadio delle Fornaci'],
      ['SC Portuale Genova','Genova','Campo di San Vento'],
      ['CS Collina Firenze','Firenze','Stadio della Querceta'],
      ['AS Corallo Verona','Verona','Campo del Corallo'],
      ['FC Altavia Parma','Parma','Stadio delle Vallette'],
      ['US Valtena Modena','Modena','Campo della Filanda'],
      ['AC Levantina Trieste','Trieste','Stadio di Porto Nuovo'],
      ['SS Adriatica Bari','Bari','Campo del Levante'],
      ['US Fontechiara Perugia','Perugia','Stadio delle Fonti'],
      ['SC Smeralda Cagliari','Cagliari','Campo della Marina Alta'],
      ['AS Bellariva Lecce','Lecce','Stadio degli Ulivi'],
      ['AC Naviglio Milano','Milano','Campo del Vecchio Naviglio'],
      ['US Partenope Nuova Napoli','Napoli','Stadio di Pietramare'],
      ['SS Trinacria Marina Palermo','Palermo','Campo dei Cantieri'],
      ['AC Euganea Padova','Padova','Stadio delle Mura Antiche'],
      ['US Arnoverde Pisa','Pisa','Campo delle Vettovaglie'],
      ['FC Dorica Ancona','Ancona','Stadio del Belvedere'],
      ['CS Bizantina Ravenna','Ravenna','Campo degli Artigiani'],
      ['AC Ferrea Brescia','Brescia','Stadio della Ferriera']
    ]
  },
  {
    id:'ENG', flag:'🇬🇧', country:{it:'Inghilterra',en:'England'}, competition:'Crown League',
    clubs:[
      ['London Southwick FC','London','Southwick Recreation Ground'],
      ['Bristol Crownbridge AFC','Bristol','Crownbridge Road'],
      ['Leeds Westmere Athletic','Leeds','Westmere Lane'],
      ['Liverpool Dockfield FC','Liverpool','Dockfield Ground'],
      ['Manchester Moorfield FC','Manchester','Moorfield Road'],
      ['Birmingham Alderwick Town','Birmingham','Alderwick Fields'],
      ['Sheffield Northvale Athletic','Sheffield','Northvale Common'],
      ['Nottingham Oakspire FC','Nottingham','Oakspire Lane'],
      ['Newcastle Riverbank AFC','Newcastle upon Tyne','Riverbank Park'],
      ['Brighton Seabrook Rovers','Brighton','Seabrook Ground'],
      ['York Kingsreach Town','York','Kingsreach Road'],
      ['Plymouth Harbourside FC','Plymouth','Harbourside Park'],
      ['Norwich Fenwick Wanderers','Norwich','Fenwick Meadow'],
      ['Leicester Stoneford Albion','Leicester','Stoneford Field'],
      ['Coventry Bellcroft United','Coventry','Bellcroft Lane'],
      ['Oxford Ashcombe Athletic','Oxford','Ashcombe Recreation Ground'],
      ['Portsmouth Eastquay FC','Portsmouth','Eastquay Ground'],
      ['Derby Willowden County','Derby','Willowden Road'],
      ['Southampton Maritime Rovers','Southampton','Maritime Park'],
      ['Exeter Redcliff Town','Exeter','Redcliff Lane']
    ]
  },
  {
    id:'ES', flag:'🇪🇸', country:{it:'Spagna',en:'Spain'}, competition:'Liga de la Unión',
    clubs:[
      ['CD Alborada Madrid','Madrid','Campo de la Alborada'],
      ['FC Mar de Cobre Barcelona','Barcelona','Estadi del Mirador'],
      ['UD Monteazul Valencia','Valencia','Estadio Monteazul'],
      ['CD Ribera Clara Sevilla','Sevilla','Campo del Naranjal'],
      ['Atlético Viento Sur Málaga','Málaga','Estadio del Viento'],
      ['SD Encinar Zaragoza','Zaragoza','Parque del Encinar'],
      ['CD Harizti Bilbao','Bilbao','Zelai Berria'],
      ['Unión Izarra Donostia','Donostia / San Sebastián','Itsasargi Zelaia'],
      ['CF Lumbre Granada','Granada','Estadio de la Lumbre'],
      ['CD Robledal Valladolid','Valladolid','Campo del Robledal'],
      ['UD Bravura Salamanca','Salamanca','Campo del Tormes'],
      ['SC Brétema Coruña','A Coruña','Campo da Brétema'],
      ['CD Calzada Córdoba','Córdoba','Estadio de la Calzada'],
      ['Unión Bahía Dorada Cádiz','Cádiz','Campo del Astillero'],
      ['SD Monteverde Oviedo','Oviedo','Campo de Monteverde'],
      ['Racing de Peñaclara Santander','Santander','Campos de Peñaclara'],
      ['Atlético Almadraba Almería','Almería','Estadio del Saladar'],
      ['CD Cigarral Toledo','Toledo','Campo del Cigarral'],
      ['Unión Levantina Alicante','Alicante','Campo de la Acequia'],
      ['Sporting de Valduna Gijón','Gijón','Campo de Valduna']
    ]
  },
  {
    id:'DE', flag:'🇩🇪', country:{it:'Germania',en:'Germany'}, competition:'Meisterliga',
    clubs:[
      ['SV Morgenrot Berlin','Berlin','Morgenrot-Sportplatz'],
      ['FC Hafenstern Hamburg','Hamburg','Hafenstern-Stadion'],
      ['TSV Silberwald München','München','Silberwald-Platz'],
      ['SC Rheinglanz Köln','Köln','Rheinglanz-Stadion'],
      ['VfB Höhenblick Stuttgart','Stuttgart','Höhenblick-Sportfeld'],
      ['SV Lindenhof Leipzig','Leipzig','Lindenhof-Stadion'],
      ['Dresdner SC Elbengrün','Dresden','Elbengrün-Platz'],
      ['FC Nordweide Bremen','Bremen','Nordweide-Sportplatz'],
      ['TSV Eichenfeld Hannover','Hannover','Eichenfeld-Stadion'],
      ['Freiburger SV Sonnenhain','Freiburg im Breisgau','Sonnenhain-Sportfeld'],
      ['FC Burglicht Nürnberg','Nürnberg','Burglicht-Platz'],
      ['Bonner FV Rheinbogen','Bonn','Rheinbogen-Stadion'],
      ['SC Westfelde Dortmund','Dortmund','Westfelde-Kampfbahn'],
      ['Essener SV Kupferhain','Essen','Kupferhain-Sportplatz'],
      ['Düsseldorfer FC Auenfeld','Düsseldorf','Auenfeld-Stadion'],
      ['Augsburger TSV Lechhöhe','Augsburg','Lechhöhe-Platz'],
      ['Kieler SC Fördewind','Kiel','Fördewind-Sportfeld'],
      ['Mainzer FV Rebental','Mainz','Rebental-Stadion'],
      ['Rostocker FC Hafentor','Rostock','Hafentor-Platz'],
      ['Münsteraner SV Waldkrone','Münster','Waldkrone-Stadion']
    ]
  },
  {
    id:'FR', flag:'🇫🇷', country:{it:'Francia',en:'France'}, competition:'Ligue des Sociétés',
    clubs:[
      ['Union Sportive Équinoxe Paris','Paris','Stade de l’Équinoxe'],
      ['FC Montclair Lyon','Lyon','Parc Montclair'],
      ['Sporting Azurline Marseille','Marseille','Stade des Calanques'],
      ['Stade de l’Éclat Toulouse','Toulouse','Terrain de l’Éclat'],
      ['AS Belrive Bordeaux','Bordeaux','Parc des Rives'],
      ['FC Aveline Nantes','Nantes','Stade des Voiles'],
      ['Union Clairbois Lille','Lille','Stade Clairbois'],
      ['Racing Brumelune Strasbourg','Strasbourg','Parc des Passerelles'],
      ['Étoile Méridienne Nice','Nice','Stade du Méridien'],
      ['Stade Chanterive Rennes','Rennes','Terrain Chanterive'],
      ['Cercle Vermeil Montpellier','Montpellier','Stade du Vermeil'],
      ['AS Valfleuri Dijon','Dijon','Parc Valfleuri'],
      ['US Coteaux Reims','Reims','Stade des Coteaux'],
      ['Cercle Sportif Ardoise Angers','Angers','Parc de l’Ardoise'],
      ['FC Pennaroc Brest','Brest','Stade de Pennaroc'],
      ['Sporting Belledonne Grenoble','Grenoble','Stade du Belledonne'],
      ['Union des Tonneliers Tours','Tours','Terrain des Tonneliers'],
      ['Amiens FC Valbrume','Amiens','Parc Valbrume'],
      ['AS Mosellane Metz','Metz','Stade des Ateliers'],
      ['Olympique du Loiret Orléans','Orléans','Stade des Saules']
    ]
  },
  {
    id:'PT', flag:'🇵🇹', country:{it:'Portogallo',en:'Portugal'}, competition:'Liga Lusitana',
    clubs:[
      ['Sport Clube Miradouro Lisboa','Lisboa','Campo do Miradouro'],
      ['FC Ribeiralta Porto','Porto','Estádio da Ribeiralta'],
      ['Clube Atlético Carvalho Braga','Braga','Campo do Carvalho'],
      ['União Mondeverde Coimbra','Coimbra','Parque Mondeverde'],
      ['Sporting Sol Nascente Faro','Faro','Estádio da Ria Clara'],
      ['AC Maré Clara Aveiro','Aveiro','Campo da Maré Clara'],
      ['Grupo Desportivo Alentejar Évora','Évora','Estádio do Alentejar'],
      ['FC Serramar Setúbal','Setúbal','Parque do Serramar'],
      ['União Montebrilho Guimarães','Guimarães','Campo Montebrilho'],
      ['Académico Serra Nova Viseu','Viseu','Estádio da Serra Nova'],
      ['SC Pinhal Nobre Leiria','Leiria','Campo do Pinhal Nobre'],
      ['Clube Marítimo Atlante Funchal','Funchal','Parque do Atlante'],
      ['Grupo União Planície Beja','Beja','Campo da Planície'],
      ['AC Vila do Monte Vila Real','Vila Real','Campo do Alto Monte'],
      ['SC Costa Verde Viana','Viana do Castelo','Estádio da Costa Verde'],
      ['FC Portalegrense Serrado','Portalegre','Campo do Serrado'],
      ['União Ribatejana Santarém','Santarém','Parque do Ribatejo'],
      ['SC Albicastrense Valealto','Castelo Branco','Campo do Valealto'],
      ['Clube Atlético Montesinho Bragança','Bragança','Estádio de Montesinho'],
      ['FC Templário Novo Tomar','Tomar','Campo da Várzea Nova']
    ]
  },
  {
    id:'NL', flag:'🇳🇱', country:{it:'Paesi Bassi',en:'Netherlands'}, competition:'Oranjeliga',
    clubs:[
      ['VV Waterpoort Amsterdam','Amsterdam','Waterpoort Sportpark'],
      ['SV Havenlicht Rotterdam','Rotterdam','Havenlicht Stadion'],
      ['Utrechtse VV Groenveld','Utrecht','Groenveld Sportterrein'],
      ['Eindhovense FC Blauwmeer','Eindhoven','Blauwmeer Stadion'],
      ['Groninger VV Noorderwind','Groningen','Noorderwind Sportpark'],
      ['Haarlemse FC Duinroos','Haarlem','Duinroos Veld'],
      ['Bredase SV Zilverbeek','Breda','Zilverbeek Park'],
      ['Tilburgse VV Boskant','Tilburg','Boskant Stadion'],
      ['Nijmeegse FC Rivieren','Nijmegen','Rivieren Sportpark'],
      ['Arnhemse SV Heuvelrand','Arnhem','Heuvelrand Veld'],
      ['Delftse VV Molenwijk','Delft','Molenwijk Stadion'],
      ['Maastrichtse FC Maaslicht','Maastricht','Maaslicht Sportterrein'],
      ['Leidse VV Wetering','Leiden','Sportpark Wetering'],
      ['Zwolsche SV Zandhof','Zwolle','Zandhof Terrein'],
      ['Deventer FC IJselrand','Deventer','IJselrand Stadion'],
      ['Enschedese VV Veldhoek','Enschede','Veldhoek Park'],
      ['Apeldoornse SV Dennenrust','Apeldoorn','Dennenrust Sportpark'],
      ['Amersfoortse FC Poortzicht','Amersfoort','Poortzicht Veld'],
      ['Alkmaarse VV Polderveen','Alkmaar','Polderveen Stadion'],
      ['Leeuwarder SC Westerwier','Leeuwarden','Westerwier Terrein']
    ]
  },
  {
    id:'BR', flag:'🇧🇷', country:{it:'Brasile',en:'Brazil'}, competition:'Liga das Associações',
    clubs:[
      ['AC Sol das Marés Rio','Rio de Janeiro','Estádio das Marés'],
      ['AA Vila Brilhante São Paulo','São Paulo','Campo Vila Brilhante'],
      ['EC Porto do Dendê Salvador','Salvador','Campo do Dendê'],
      ['União Maré Alta Recife','Recife','Estádio Maré Alta'],
      ['FC Ventos do Litoral Fortaleza','Fortaleza','Campo do Litoral'],
      ['CA Serra Clara Belo Horizonte','Belo Horizonte','Parque Serra Clara'],
      ['Grêmio Pampa Dourado Porto Alegre','Porto Alegre','Estádio do Pampa'],
      ['EC Pinheiro Azul Curitiba','Curitiba','Campo do Pinheiro'],
      ['Associação Planalto Verde Brasília','Brasília','Estádio do Planalto'],
      ['SC Marajó Azul Belém','Belém','Campo Marajó Azul'],
      ['União Rio Neblina Manaus','Manaus','Estádio Rio Neblina'],
      ['AC Cerrado Solar Goiânia','Goiânia','Campo do Cerrado'],
      ['EC Estação Velha Campinas','Campinas','Campo da Estação Velha'],
      ['Associação Atlética Ilha Branca Florianópolis','Florianópolis','Estádio da Ilha Branca'],
      ['FC Dunas do Norte Natal','Natal','Campo das Dunas'],
      ['Esporte Clube Cabo Branco João Pessoa','João Pessoa','Estádio das Falésias'],
      ['União Marinha Nova Aracaju','Aracaju','Campo da Marinha Nova'],
      ['AA Buritizal Teresina','Teresina','Estádio do Buritizal'],
      ['SC Lagoa Serena Maceió','Maceió','Campo da Lagoa Serena'],
      ['União Pedra da Costa Vitória','Vitória','Estádio da Pedra da Costa']
    ]
  }
];
const colors=[['#42dcb0','#135546'],['#ef996a','#633629'],['#65b7f8','#244978'],['#f8d172','#826227'],['#d887ef','#583277'],['#f27c8e','#883b4b'],['#7ee0da','#246a74'],['#a6b4ff','#4955a1'],['#e4a55b','#805225'],['#b7df85','#55743b'],['#f0a8bd','#9b506b'],['#b7c5d1','#5a738a']];
const countrySeeds={IT:0,ENG:17,ES:30,DE:47,FR:63,PT:79,NL:96,BR:114};
export const LEAGUES=Object.freeze(definitions.map(({clubs,...league})=>Object.freeze({...league,clubCount:clubs.length})));
export function leagueById(id){return LEAGUES.find(l=>l.id===id)||LEAGUES[0];}
export function getLeagueClubs(id='IT'){
  const league=leagueById(id);
  const entries=definitions.find(l=>l.id===league.id).clubs;
  return entries.map(([name,city,stadium],index)=>({
    id:index+1,name,city,stadium,countryId:league.id,country:league.country.it,
    short:name.replace(/[^\p{L} ]/gu,'').split(/\s+/).filter(Boolean).map(word=>word[0]).join('').slice(0,3).toUpperCase().padEnd(3,'X'),
    colors:colors[(index+Math.floor(countrySeeds[league.id]/4))%colors.length],
    founded:league.id==='BR'?(city==='Brasília'?1968:1904+(index*7+countrySeeds[league.id])%39):1888+(index*11+countrySeeds[league.id])%43,
    reputation:Math.max(65,89-Math.floor(index*1.16)+(index%3)),
    capacity:Math.max(11000,39000-index*1300+(index%3)*420)
  }));
}

// DIV-02: immutable country and competition catalogs; existing UI keeps using LEAGUES.
// Division membership is the initial catalog assignment, not a permanent club ID.
const secondDivisionNames=Object.freeze({
  IT:'Lega delle Città',ENG:'Shield League',ES:'Liga de las Regiones',
  DE:'Vereinsliga',FR:'Ligue des Régions',PT:'Liga Atlântica',
  NL:'Bondsklasse',BR:'Liga das Regiões'
});
export const COUNTRIES=Object.freeze(LEAGUES.map(league=>Object.freeze({
  id:league.id,flag:league.flag,country:Object.freeze({...league.country})
})));
export const COMPETITIONS=Object.freeze(LEAGUES.flatMap(league=>[
  Object.freeze({
    id:league.id+'-1',countryId:league.id,tier:1,name:league.competition,
    clubCount:league.clubCount,capacity:20
  }),
  Object.freeze({
    id:league.id+'-2',countryId:league.id,tier:2,name:secondDivisionNames[league.id],
    clubCount:0,capacity:20 // DIV-03 will add the second division's 20 clubs.
  })
]));
export function countryById(id){return COUNTRIES.find(country=>country.id===id)??null;}
export function competitionById(id){return COMPETITIONS.find(competition=>competition.id===id)??null;}
export function getCountryClubs(countryId){
  if(!countryById(countryId))throw new RangeError('Unknown country');
  return getLeagueClubs(countryId);
}
export function getCompetitionClubs(competitionId){
  const competition=competitionById(competitionId);
  if(!competition)throw new RangeError('Unknown competition');
  return competition.tier===1?getCountryClubs(competition.countryId):[];
}
export function getClub(countryId,clubId){
  if(!countryById(countryId)||!Number.isSafeInteger(clubId)||clubId<1)return null;
  return getCountryClubs(countryId).find(club=>club.id===clubId)??null;
}
