// Synthetic, culturally styled names. No roster or name database of real footballers is used.
const given={
  IT:['Alessio','Ludovico','Niccolò','Eliano','Ettore','Riccardo','Samuele','Tommaso','Raffaele','Gabriele','Matteo','Filippo','Pietro','Emanuele','Jacopo','Davide','Michele','Andrea'],
  ENG:['Oliver','Elliot','Harry','Nathan','Lewis','Callum','George','Alfie','Isaac','Freddie','Joshua','Mason','Connor','Noah','Theo','Finley','Archie','Harvey'],
  ES:['Izan','Mateo','Sergio','Ander','Bruno','Hugo','Raúl','Iker','Álvaro','Darío','Javier','Marcos','Nicolás','Samuel','Iván','Rubén','Adrián','Leo'],
  DE:['Lukas','Jonas','Felix','Emil','Moritz','Leon','Finn','Timo','Nico','Jakob','Jannis','Paul','Florian','Henrik','Julian','Anton','Erik','Milan'],
  FR:['Théo','Noé','Mathis','Adrien','Loïc','Rémi','Clément','Émile','Bastien','Maxence','Lucien','Hugo','Antoine','Alexis','Gaël','Raphaël','Simon','Arthur'],
  PT:['Tiago','Nuno','Rúben','Diogo','Gonçalo','Tomás','Rafael','Afonso','Duarte','João','Pedro','Miguel','André','Bernardo','Martim','Simão','Leandro','Henrique'],
  NL:['Bram','Daan','Milan','Joris','Koen','Thijs','Luuk','Niels','Jasper','Sven','Sem','Tijn','Gijs','Wout','Joost','Lars','Ruben','Floris'],
  BR:['Caio','Davi','Luiz','João','Mateus','Enzo','Felipe','Rafael','Vinícius','Danilo','Pedro','Thiago','Renan','Vitor','Heitor','Bruno','Ícaro','Lucas']
};
const stems={
  IT:['Rav','Bellan','Cors','Vall','Ferr','Mont','Loren','Calv','Verd','Serran','Nov','Bert','Rinal','Mor','Pell'],
  ENG:['Ash','Wen','Brack','Holl','West','Oak','Moor','Hart','Ridge','Cran','Fair','Brom','Whit','Thorn','Wood'],
  ES:['Val','Rened','Mor','Salced','Mont','Carr','Castr','Verd','Vill','Alvar','Romer','Calder','Mir','Bellan','Sol'],
  DE:['Falken','Berg','Wald','Stein','Eichen','Hohen','Kron','Winter','Linden','Bauer','Heller','Braun','Weiden','Keller','Sonn'],
  FR:['Beau','Mont','Val','Chantel','Brun','Duver','Riv','Clair','Vern','Bel','Mar','Lauri','Vaud','Car','Giraud'],
  PT:['Val','More','Silv','Monte','Carvalh','Ribeir','Serr','Font','Barreir','Vian','Ferreir','Costa','Lour','Marqu','Pinheir'],
  NL:['Veld','Wester','Meer','Hout','Berg','Dijk','Bos','Waal','Kamp','Ver','Noord','Veen','Zand','Linde','Broek'],
  BR:['Rav','Soar','Monte','Caval','Val','Ferreir','Pinh','More','Oliveir','Barros','Mora','Cost','Luz','Pereir','Serr']
};
const endings={
  IT:['etti','elli','oni','ari','ini','aldi','ucci','asso','ani','aro','ante','ino'],
  ENG:['ford','well','son','ley','wood','field','ton','hurst','wick','bridge','more','ham'],
  ES:['edo','ales','ero','ino','ez','ado','ales','ona','illo','ero','iego','ura'],
  DE:['mann','feld','berg','wald','heim','bach','hoff','stein','berger','hardt','er','rich'],
  FR:['eau','mont','ier','ard','ault','enne','et','in','elle','eux','on','ois'],
  PT:['eira','eiro','ães','al','edo','oso','eiros','eiro','ão','adas','o','es'],
  NL:['meer','kamp','hoven','dijk','veld','beek','burg','man','huis','berg','hout','veen'],
  BR:['eira','eiro','es','ão','oso','al','ado','ano','inho','ares','edo','eiras']
};
export function syntheticName(rand,homeCountry,used){
  // Local identity predominates, with a small number of foreign signings.
  const codes=Object.keys(given),nationalityCode=rand()<.83?homeCountry:codes[Math.floor(rand()*codes.length)];
  let fullName='';
  for(let attempt=0;attempt<150;attempt++){
    const first=given[nationalityCode][Math.floor(rand()*given[nationalityCode].length)];
    const stem=stems[nationalityCode][Math.floor(rand()*stems[nationalityCode].length)];
    const end=endings[nationalityCode][Math.floor(rand()*endings[nationalityCode].length)];
    const surname=stem+end;
    fullName=`${first} ${surname}`;
    if(!used.has(fullName))break;
  }
  used.add(fullName);
  const nation={IT:'Italia',ENG:'Inghilterra',ES:'Spagna',DE:'Germania',FR:'Francia',PT:'Portogallo',NL:'Paesi Bassi',BR:'Brasile'}[nationalityCode];
  return {name:fullName,nationality:nation};
}
