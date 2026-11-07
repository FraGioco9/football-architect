#!/usr/bin/env node
// NAMES-REALISM-01: read-only audit of catalog provenance and role ambiguity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const countries={
 KOR:{surnames:2000,scope:'South Korea resident surnames and Seoul supplementary lists',
  note:'Resident/country labels do not establish Korean-origin names or representative frequencies.'},
 MAR:{surnames:3000,scope:'Morocco-labeled surname compilations and 2019 address-directory data',
  note:'Directory records may mix surnames, given names and businesses; copyright/redistribution rights remain uncertain.'},
 POR:{surnames:3000,scope:'Forebears incidence lists plus third-party Portuguese alphabetical indexes',
  note:'Original surname role, independent attestations and licensing are not fully resolved.'}
};
const cases=[
 ['KOR','surname','Kim','official_reference','Official national surname anchor; no weight is inferred.'],
 ['KOR','surname','I','romanization','Investigate Roman-script variants with original writing before changing anything.'],
 ['KOR','surname','Pak','romanization','Potential spelling variant; no automatic de-duplication.'],
 ['KOR','surname','Larson','territorial_or_contamination','Needs original source row, surname-role and residency evidence.'],
 ['KOR','surname','Dias','territorial_or_contamination','Needs original source row, surname-role and residency evidence.'],
 ['KOR','surname','Mohamed','territorial_or_contamination','Possible legitimate resident surname; avoid guessing ancestry.'],
 ['KOR','surname','Sutton','territorial_or_contamination','Check original source entry and surname-role evidence.'],
 ['KOR','surname','Elliott','territorial_or_contamination','Check original source entry and surname-role evidence.'],
 ['MAR','surname','Aamara','item_source_needed','Reference entry; original source row not supplied per item.'],
 ['MAR','surname','Nissaboury','item_source_needed','Reference entry; original source row not supplied per item.'],
 ['MAR','surname','Kristoffersen','territorial_or_contamination','Check surname-role and Moroccan resident/citizenship evidence; do not remove.'],
 ['MAR','surname','Yahya','given_surname_overlap','Also in the same-country first-name bank; not necessarily an error.'],
 ['MAR','surname','Philippe','given_surname_overlap','Also in the same-country first-name bank; verify surname role.'],
 ['MAR','first','Giánnis','citizenship_cohort','Citizenship-biography samples do not prove typical Moroccan birth-name frequency.'],
 ['POR','surname','Silva','item_source_needed','Source anchor; per-record population weight absent.'],
 ['POR','surname','Ferreira','item_source_needed','Source anchor; per-record population weight absent.'],
 ['POR','surname','Daniela','given_name_shape','Could be valid as surname; require independent surname evidence.'],
 ['POR','surname','Zina','given_name_shape','Check surname use rather than judging by appearance.'],
 ['POR','surname','Yahya','given_name_shape','Check individual surname record and category.'],
 ['POR','surname','Carinhas','item_source_needed','Individual source and license verification needed.']
];
const official=[
 {code:'KOR',url:'https://www.kostat.go.kr/boardDownload.es?bid=11747&list_no=356507&seq=1',
  note:'Statistics Korea 2015: top 10 family names accounted for 63.9% of Korean citizens.'},
 {code:'KOR',url:'https://www.mcst.go.kr/english/policy/kocis/newsView.jsp?pSeq=88',
  note:'Korean culture ministry: romanization of family names varies.'},
 {code:'POR',url:'https://irn.justica.gov.pt/Servicos/Cidadao/Nascimento/Composicao-do-nome',
  note:'Official distinction between given names and surnames, including multiple surname words.'}
];
function readBank(code,type){
 const prefix=type==='surname'?'../data/players/surnames/countries/':'../data/players/names/countries/';
 const relative=prefix+code+'.json';
 const bytes=readFileSync(new URL(relative,import.meta.url));
 const doc=JSON.parse(bytes.toString('utf8'));
 const records=type==='surname'?doc.surnames:doc.given_names;
 assert.equal(doc.code,code);
 assert.ok(Array.isArray(records));
 const values=records.map(r=>r.value);
 assert.ok(values.every(v=>typeof v==='string'&&v.length>0&&v===v.normalize('NFC')));
 assert.equal(new Set(values).size,values.length);
 return {doc,records,values,set:new Set(values),file:relative.replace('../',''),
  digest:createHash('sha256').update(bytes).digest('hex')};
}
function audit(){
 const ledger=JSON.parse(readFileSync(new URL('../docs/players/names-residency-evidence-01.json',import.meta.url),'utf8'));
 assert.equal(ledger.schema_version,1);
 assert.ok(Array.isArray(ledger.records)&&ledger.records.length===20);
 const evidenceMap=new Map();
 for(const record of ledger.records){
  const key=[record.country,record.field,record.value].join('|');
  assert.ok(!evidenceMap.has(key),'Duplicate evidence entry '+key);
  assert.ok(Object.hasOwn(ledger.categories,record.evidence_category));
  assert.equal(record.original_catalog_row_source_verified,false);
  assert.equal(record.action,'retain_unchanged');
  assert.equal(record.person_level_residence_documented,
   record.evidence_category==='direct_resident_biography');
  if(record.evidence_category!=='catalog_only')
   assert.ok(typeof record.source_url==='string'&&record.source_url.startsWith('https://'));
  if(record.evidence_category==='territorial_model')
   assert.ok(Number.isInteger(record.modeled_incidence)&&record.modeled_incidence>0);
  evidenceMap.set(key,record);
 }
 const details=[],review=[],bank={};
 for(const code of ['KOR','MAR','POR']){
  const s=readBank(code,'surname'),g=readBank(code,'first'),config=countries[code];
  bank[code]={s,g};
  assert.equal(s.records.length,config.surnames);
  assert.equal(g.records.length,300);
  assert.equal(s.doc.kind,'surnames');
  assert.equal(s.doc.selection_policy,'uniform');
  assert.equal(s.doc.production_ready,false);
  assert.ok(s.records.every(r=>Object.keys(r).length===1),'Per-record source references were added: revise audit.');
  const overlaps=s.values.filter(x=>g.set.has(x));
  const sources=(s.doc.sources??[]).map((x,i)=>({
   index:i,id:x.id??null,title:x.title??null,url:x.url??x.source_url??null,
   license:x.license??null,limitations:x.limitations??null
  }));
  assert.ok(sources.length>0);
  details.push({
   code,surname_count:s.records.length,first_count:g.records.length,
   surname_path:s.file,first_path:g.file,surname_sha256:s.digest,first_sha256:g.digest,
   source_scope:config.scope,given_cohort:g.doc.cohort,
   sources,source_count:sources.length,
   explicit_source_licence_notes:sources.filter(x=>x.license).length,
   source_limitation_notes:sources.filter(x=>x.limitations).length,
   per_record_source_links:0,production_ready:false,
   given_surname_overlap_count:overlaps.length,
   given_surname_overlap_percent:Number((100*overlaps.length/s.records.length).toFixed(2)),
   overlap_examples:overlaps.slice(0,18),
   per_surname_uniform_percent:Number((100/s.records.length).toFixed(4)),
   limitation:config.note
  });
 }
 for(const [code,field,value,signal,notes] of cases){
  const b=bank[code],selected=field==='surname'?b.s:b.g;
  assert.ok(selected.set.has(value),'Review candidate missing: '+code+'/'+value);
  const evidence=evidenceMap.get([code,field,value].join('|'));
  assert.ok(evidence,'Missing evidence record '+code+'/'+value);
  review.push({code,field,value,signal,notes,
   residence_evidence_category:evidence.evidence_category,
   residence_evidence_url:evidence.source_url,
   third_party_modeled_incidence:evidence.modeled_incidence,
   source_reference_period:evidence.reference_period,
   residence_evidence_note:evidence.note,
   person_level_residence_documented:evidence.person_level_residence_documented,
   original_catalog_row_source_verified:false,
   bank_membership_confirmed:true,
   same_country_given_name_overlap:field==='surname'&&b.g.set.has(value),
   item_specific_evidence_available:false,classification:'UNREVIEWED',
   status:'KEEP_UNCHANGED_AND_REQUEST_INDIVIDUAL_EVIDENCE'});
 }
 assert.equal(evidenceMap.size,review.length,'Evidence queue must cover all 20 cases');
 const evidenceCounts=Object.fromEntries(
  Object.keys(ledger.categories).map(k=>[k,review.filter(x=>x.residence_evidence_category===k).length]));
 const pairOverlap=[];
 for(const [a,b] of [['KOR','MAR'],['KOR','POR'],['MAR','POR']]){
  const shared=bank[a].s.values.filter(v=>bank[b].s.set.has(v));
  pairOverlap.push({pair:a+'-'+b,exact_spelling_overlap:shared.length,sample:shared.slice(0,16),
   caveat:'Identical strings do not imply identical linguistic origin.'});
 }
 return {
  spec:'NAMES-REALISM-01',status:'REVIEW_ONLY',version:1,
  exact_head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  no_catalog_changes:true,no_generator_changes:true,
  unchanged_name_origin_distribution:'50/15/25/10',
  unchanged_surname_policy:'uniform',
  catalogs:details,review_queue:review,cross_country_overlap:pairOverlap,
  residency_evidence_categories:ledger.categories,residency_evidence_counts:evidenceCounts,
  direct_person_level_residence_cases:review.filter(x=>x.person_level_residence_documented).length,
  territorial_models_not_automatic_proof:true,
  external_context:official,
  limitations:[
   'A listed country/resident/citizenship surname is not automatically a culturally typical national surname.',
   'Name appearance is not evidence of a persons ethnicity or heritage.',
   'Given/surname overlap is a triage signal, not a proven error.',
   'Each surname is a value-only record without per-item source provenance.',
   'The 63.9% Korean official census statistic and this territorial bank have different populations; no direct population-weight ratio is assumed.'
  ],
  decisions_open:[
   'Approve intended national bank semantics: territorial residents, name-origin typicality, or separate explicitly labeled pools.',
   'Obtain per-item source rows and review licenses, family-name role and romanization before changing records.',
   'Decide whether to retain uniform surname sampling or test separately approved core/resident weighting.',
   'Retain 50/15/25/10 dual-source naming probabilities and current player schema until separately approved.'
  ]
 };
}
function md(report){
 const out=[
 '# NAMES-REALISM-01 — source provenance and review queue',
 '',
 'REVIEW ONLY; no catalog or generator changes. Exact HEAD: '+report.exact_head,
 '',
 '## Catalog results',
 '',
 '| Code | Surnames | Given names | Sources | Records with item-level links | Same-country given/surname overlap | Uniform per surname |',
 '|---|---:|---:|---:|---:|---:|---:|'
 ];
 for(const x of report.catalogs)out.push('| '+x.code+' | '+x.surname_count+' | '+x.first_count+' | '+
  x.source_count+' | '+x.per_record_source_links+' | '+x.given_surname_overlap_count+' ('+
  x.given_surname_overlap_percent+'%) | '+x.per_surname_uniform_percent+'% |');
 out.push('','## Source scopes');
 for(const x of report.catalogs){
  out.push('', '### '+x.code,'','Surnames: '+x.source_scope+'.','First names: '+x.given_cohort+'.',
   'Known limitation: '+x.limitation,'Surname SHA-256: '+x.surname_sha256+'.',
   'Source license notes: '+x.explicit_source_licence_notes+'/'+x.source_count+'.');
  for(const src of x.sources.slice(0,7))out.push('- '+(src.title??src.id??'Source '+src.index)+': '+
   (src.url??'(not specified)')+(src.limitations?' — '+src.limitations:''));
 }
 out.push('','## Examples needing human source verification','',
  '| Code | Field | Candidate | Review signal | In given-name bank too? | Disposition |',
  '|---|---|---|---|---|---|');
 for(const x of report.review_queue)out.push('| '+x.code+' | '+x.field+' | '+x.value+' | '+
  x.signal+' | '+(x.same_country_given_name_overlap?'Yes':'No')+' | Retain / review |');
 out.push('');
 for(const x of report.review_queue)out.push('- '+x.code+' '+x.value+': '+x.notes);
 out.push('','## Source-based residence evidence per item','','| Country | Field | Value | Evidence type | Reported territorial incidence | Person-level resident proof | Source |','|---|---|---|---|---:|---|---|');
 for(const x of report.review_queue)out.push('| '+x.code+' | '+x.field+' | '+x.value+
  ' | '+x.residence_evidence_category+' | '+(x.third_party_modeled_incidence??'—')+
  ' | '+(x.person_level_residence_documented?'Historical biographical example':'No')+
  ' | '+(x.residence_evidence_url??'No independently matched URL')+' |');
 out.push('','**Evidence totals:** '+JSON.stringify(report.residency_evidence_counts)+
  '. The historical biographical example is not linked to the original source row of the catalog, and modeled territorial tables are not official registers.');
 out.push('','## Country-pair string matches');
 for(const item of report.cross_country_overlap)out.push('- '+item.pair+': '+item.exact_spelling_overlap+
  ' shared spellings; samples: '+item.sample.join(', ')+'.');
 out.push('','## Official context');
 for(const x of report.external_context)out.push('- '+x.code+': '+x.url+' — '+x.note);
 out.push('','## Limits');
 for(const line of report.limitations)out.push('- '+line);
 out.push('','## Decisions still open');
 for(const line of report.decisions_open)out.push('- '+line);
 out.push('','No name is automatically removed, reweighted or culturally classified. No deploy, database writes or merge.','');
 return out.join('\n');
}
function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help'))return console.log('Options: --self-test --json PATH --markdown PATH');
 for(let i=0;i<args.length;i++){
  assert.ok(['--self-test','--json','--markdown'].includes(args[i]),'Unknown argument '+args[i]);
  if(args[i]!=='--self-test'){assert.ok(args[i+1]&&!args[i+1].startsWith('--'));i++;}
 }
 const report=audit();
 assert.equal(report.review_queue.length,20);
 assert.equal(Object.values(report.residency_evidence_counts).reduce((sum,n)=>sum+n,0),20);
 assert.equal(report.residency_evidence_counts.direct_resident_biography,1);
 assert.equal(report.residency_evidence_counts.territorial_model,16);
 assert.ok(report.review_queue.every(x=>x.original_catalog_row_source_verified===false));
 assert.deepEqual(report.catalogs.map(x=>x.surname_count),[2000,3000,3000]);
 assert.deepEqual(report.catalogs.map(x=>x.first_count),[300,300,300]);
 assert.ok(report.catalogs.every(x=>x.per_record_source_links===0&&!x.production_ready));
 if(args.includes('--self-test')){
  assert.deepEqual(audit(),report,'Read-only seeded-free audit must be deterministic');
  return console.log('NAMES_REALISM_SELF_TEST_PASS');
 }
 for(const [flag,data] of [['--json',JSON.stringify(report,null,2)+'\n'],['--markdown',md(report)]]){
  const index=args.indexOf(flag);if(index>=0)writeFileSync(args[index+1],data);
 }
 console.log('NAMES_REALISM_SUMMARY '+JSON.stringify({
  head:report.exact_head,catalogs:report.catalogs.map(x=>({
   code:x.code,n:x.surname_count,sources:x.source_count,overlap:x.given_surname_overlap_count,
   overlap_percent:x.given_surname_overlap_percent,uniform_per_surname_pct:x.per_surname_uniform_percent,
   item_sources:x.per_record_source_links,source_licences:x.explicit_source_licence_notes})),
  review_queue:report.review_queue.length,
  residency_evidence:report.residency_evidence_counts,
  direct_resident_biography:report.direct_person_level_residence_cases,
  original_catalog_rows_verified:0,automatic_deletions:0}));
}
try{main()}catch(e){console.error('NAMES_REALISM_FAILED',e);process.exitCode=1;}
