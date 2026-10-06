// Domain logic: no DOM, browser storage or UI dependencies.

export const currency=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n||0);

export const compactMoney=n=>Math.abs(n)>=1e6?`${(n/1e6).toFixed(1).replace('.',',')} M€`:Math.abs(n)>=1e3?`${Math.round(n/1e3)} mila €`:`${Math.round(n)} €`;
