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
/** Shared SiteCalendar: MFL-like compact month header, 42-day grid and footer,
 * with fast month/year controls suitable for choosing a birth date. */
export function renderDateControl(value,lang,open=false,view=initialCalendarMonth(value)){
 const month=shiftCalendarMonth(view,0),year=Number(month.slice(0,4)),m=Number(month.slice(5)),today=localToday();
 const displayed=birthDateLabel(value,lang),labels=calendarMonthNames(lang);
 const months=labels.map((label,i)=>'<option value="'+String(i+1).padStart(2,'0')+'"'+(i+1===m?' selected':'')+'>'+e(label)+'</option>').join('');
 const years=Array.from({length:Number(today.slice(0,4))-1899},(_,i)=>1900+i).reverse().map(y=>
  '<option value="'+y+'"'+(y===year?' selected':'')+'>'+y+'</option>').join('');
 const days=calendarGridDays(month,today).map(day=>
  '<button type="button" role="gridcell" class="fa-calendar-day'+(day.outside?' is-outside':'')+(day.iso===value?' is-selected':'')+(day.iso===today?' is-today':'')+'" data-action="calendar-day" data-value="'+day.iso+'" aria-selected="'+(day.iso===value)+'" aria-label="'+day.iso+'"'+(day.iso===today?' aria-current="date"':'')+(day.disabled?' disabled':'')+'>'+day.day+'</button>').join('');
 const headers=calendarWeekdays(lang).map(w=>'<span class="fa-calendar-weekday">'+e(w)+'</span>').join('');
 const pop=open?'<section class="fa-picker-popover fa-calendar-panel" role="dialog" aria-label="'+t(lang,'Scegli la data di nascita','Choose date of birth')+'">'+
  '<div class="fa-calendar-head">'+
  '<button type="button" class="fa-calendar-nav" data-action="calendar-prev" aria-label="'+t(lang,'Mese precedente','Previous month')+'"'+(month==='1900-01'?' disabled':'')+'>‹</button>'+
  '<div class="fa-calendar-title" aria-live="polite">'+e(labels[m-1]+' '+year)+'</div>'+
  '<button type="button" class="fa-calendar-nav" data-action="calendar-next" aria-label="'+t(lang,'Mese successivo','Next month')+'"'+(month===today.slice(0,7)?' disabled':'')+'>›</button></div>'+
  '<div class="fa-calendar-jump">'+
  '<select class="fa-calendar-month" data-calendar-part="month" aria-label="'+t(lang,'Mese','Month')+'">'+months+'</select>'+
  '<select class="fa-calendar-year" data-calendar-part="year" aria-label="'+t(lang,'Anno','Year')+'">'+years+'</select></div>'+
  '<div class="fa-calendar-weekdays">'+headers+'</div>'+
  '<div class="fa-calendar-grid" role="grid" aria-label="'+e(labels[m-1]+' '+year)+'">'+days+'</div>'+
  '<div class="fa-calendar-footer">'+
  '<button type="button" class="fa-calendar-today" data-action="calendar-today">'+t(lang,'Oggi','Today')+'</button>'+
  '<button type="button" class="fa-calendar-clear" data-action="calendar-clear">'+t(lang,'Cancella data','Clear date')+'</button></div></section>':'';
 return '<div class="fa-picker fa-calendar-picker" data-fa-picker="calendar">'+
  '<input type="hidden" name="birthDate" value="'+e(value)+'">'+
  '<button id="manager-birth-date" type="button" class="fa-interactive-box fa-picker-trigger wizard-profile-input" data-action="calendar-toggle" aria-haspopup="dialog" aria-expanded="'+open+'" aria-labelledby="manager-birth-date-label manager-birth-date-value" aria-invalid="false" aria-describedby="manager-form-error">'+
  '<span id="manager-birth-date-value" class="'+(displayed?'':'fa-picker-placeholder')+'">'+e(displayed||t(lang,'Seleziona data','Select date'))+'</span>'+icon('calendar',18)+'</button>'+pop+'</div>';
}
