import {icon} from './icons.js';
import {localToday} from './simulation.js';
import {nationalityOptions,nationalityLabel,initialCalendarMonth,shiftCalendarMonth,calendarDays,calendarGridDays,calendarMonthNames,calendarWeekdays,birthDateLabel} from './site-pickers.js';
const e=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const t=(l,it,en)=>l==='en'?en:it;
/** Shared site nationality dropdown (not tied to an HTML label's click). */
export function renderNationalityControl(value,lang,open=false){
 const selected=nationalityLabel(value,lang);
 const options=open?nationalityOptions(lang).map(o=>
  '<button type="button" role="option" class="fa-picker-option'+(o.code===value?' is-selected':'')+'" data-action="nationality-select" data-value="'+o.code+'" aria-selected="'+(o.code===value)+'">'+e(o.label)+(o.code===value?icon('check',14):'')+'</button>'
 ).join(''):'';
 return '<div class="fa-picker fa-nationality-picker" data-fa-picker="nationality">'+
  '<input type="hidden" name="nationality" value="'+e(value)+'">'+
  '<button id="manager-nationality" type="button" class="fa-interactive-box fa-picker-trigger wizard-profile-input" data-action="nationality-toggle" aria-haspopup="listbox" aria-expanded="'+open+'" aria-labelledby="manager-nationality-label manager-nationality-value" aria-invalid="false" aria-describedby="manager-form-error">'+
  '<span id="manager-nationality-value" class="'+(selected?'':'fa-picker-placeholder')+'">'+e(selected||t(lang,'Seleziona nazionalità','Choose nationality'))+'</span>'+icon('chevron-down',17)+'</button>'+
  (open?'<div class="fa-picker-popover fa-nationality-menu" role="listbox" aria-label="'+t(lang,'Nazionalità','Nationality')+'">'+options+'</div>':'')+'</div>';
}
/** Baraccano SiteCalendar: five-column navigation, 42 dates, month and year views. */
export function renderDateControl(value,lang,open=false,view=initialCalendarMonth(value),calendarView='days'){
 const month=shiftCalendarMonth(view,0),year=Number(month.slice(0,4)),m=Number(month.slice(5)),today=localToday();
 const todayYear=Number(today.slice(0,4)),todayMonth=Number(today.slice(5,7));
 const mode=['days','months','years'].includes(calendarView)?calendarView:'days';
 const displayed=birthDateLabel(value,lang),labels=calendarMonthNames(lang);
 const title=mode==='days'?labels[m-1]+' '+year:mode==='months'?String(year):t(lang,'Anno','Year');
 const dayMarkup=calendarGridDays(month,today).map(day=>'<button type="button" role="gridcell" class="fa-calendar-day'+
  (day.outside?' is-outside':'')+(day.iso===value?' is-selected':'')+(day.iso===today?' is-today':'')+
  '" data-action="calendar-day" data-value="'+day.iso+'" aria-selected="'+(day.iso===value)+'" aria-label="'+day.iso+'"'+
  (day.iso===today?' aria-current="date"':'')+(day.disabled?' disabled':'')+'>'+day.day+'</button>').join('');
 const months=labels.map((label,i)=>'<button type="button" role="gridcell" class="fa-calendar-month-option'+
  (i+1===m?' is-selected':'')+'" data-action="calendar-month-select" data-value="'+String(i+1).padStart(2,'0')+
  '" aria-selected="'+(i+1===m)+'"'+(year===todayYear&&i+1>todayMonth?' disabled':'')+'>'+e(label)+'</button>').join('');
 const years=Array.from({length:todayYear-1899},(_,i)=>1900+i).map(y=>
  '<button type="button" role="gridcell" class="fa-calendar-year-option'+(y===year?' is-selected':'')+
  '" data-action="calendar-year-select" data-value="'+y+'" aria-selected="'+(y===year)+'">'+y+'</button>').join('');
 const labelsWeek=calendarWeekdays(lang).map(w=>'<span class="fa-calendar-weekday">'+e(w)+'</span>').join('');
 const atMin=month==='1900-01',atMax=month===today.slice(0,7);
 const minStep=mode==='days'?atMin:year<=1900,maxStep=mode==='days'?atMax:year>=todayYear;
 const pop=open?'<section class="fa-picker-popover fa-calendar-panel" role="dialog" aria-label="'+t(lang,'Scegli la data di nascita','Choose date of birth')+'" data-calendar-view="'+mode+'">'+
  '<div class="fa-calendar-head">'+
  '<button type="button" class="fa-calendar-nav" data-action="calendar-prev-coarse" aria-label="'+t(lang,'Anno precedente','Previous year')+'"'+(atMin?' disabled':'')+'>«</button>'+
  '<button type="button" class="fa-calendar-nav" data-action="calendar-prev" aria-label="'+t(lang,'Mese precedente','Previous month')+'"'+(minStep?' disabled':'')+'>‹</button>'+
  '<button type="button" class="fa-calendar-title" data-action="calendar-jump-toggle" aria-expanded="'+(mode!=='days')+'" aria-label="'+t(lang,'Scegli mese o anno','Choose month or year')+'"'+(mode==='years'?' disabled':'')+'>'+e(title)+'</button>'+
  '<button type="button" class="fa-calendar-nav" data-action="calendar-next" aria-label="'+t(lang,'Mese successivo','Next month')+'"'+(maxStep?' disabled':'')+'>›</button>'+
  '<button type="button" class="fa-calendar-nav" data-action="calendar-next-coarse" aria-label="'+t(lang,'Anno successivo','Next year')+'"'+(maxStep?' disabled':'')+'>»</button></div>'+
  '<div class="fa-calendar-weekdays">'+labelsWeek+'</div>'+
  '<div class="fa-calendar-grid" role="grid" aria-label="'+e(labels[m-1]+' '+year)+'">'+dayMarkup+'</div>'+
  '<div class="fa-calendar-footer"><button type="button" data-action="calendar-clear" class="fa-calendar-clear">'+t(lang,'Cancella data','Clear date')+'</button>'+
  '<button type="button" data-action="calendar-today" class="fa-calendar-today">'+t(lang,'Oggi','Today')+'</button></div>'+
  (mode==='months'?'<div class="fa-calendar-month-picker" role="grid" aria-label="'+t(lang,'Scegli mese','Choose month')+'">'+months+'</div>':'')+
  (mode==='years'?'<div class="fa-calendar-year-picker" role="grid" aria-label="'+t(lang,'Scegli anno','Choose year')+'">'+years+'</div>':'')+'</section>':'';
 return '<div class="fa-picker fa-calendar-picker" data-fa-picker="calendar">'+
  '<input type="hidden" name="birthDate" value="'+e(value)+'">'+
  '<button id="manager-birth-date" type="button" class="fa-interactive-box fa-picker-trigger wizard-profile-input" data-action="calendar-toggle" aria-haspopup="dialog" aria-expanded="'+open+'" aria-labelledby="manager-birth-date-label manager-birth-date-value" aria-invalid="false" aria-describedby="manager-form-error">'+
  '<span id="manager-birth-date-value" class="'+(displayed?'':'fa-picker-placeholder')+'">'+e(displayed||t(lang,'Seleziona data','Select date'))+'</span>'+icon('calendar',18)+'</button>'+pop+'</div>';
}
